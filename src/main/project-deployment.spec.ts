import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  getDefaultDeploymentConfig,
  getDeploymentProviderCapabilities,
  inspectProjectDeploymentContext,
  listProjectDeploymentTasks,
  listProjectDeploymentTargets,
  migrateProjectDeploymentTables,
  recoverProjectDeploymentTasks,
  saveProjectDeploymentTask,
  saveProjectDeploymentTarget,
  validateProjectDeploymentConfig,
  type ProjectDeploymentConfig
} from './project-deployment.js'

describe('project deployment context and persistence', () => {
  it('detects common project build inputs while redacting secrets and limiting source context', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-deployment-'))

    try {
      await mkdir(join(directory, '.github', 'workflows'), { recursive: true })
      await mkdir(join(directory, 'src'), { recursive: true })
      await writeFile(join(directory, 'package.json'), JSON.stringify({
        dependencies: { next: '^15.0.0' },
        scripts: { build: 'next build', start: 'next start' }
      }))
      await writeFile(join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0')
      await writeFile(join(directory, 'README.md'), '# Example\nDeploy this app.')
      await writeFile(join(directory, 'Dockerfile'), 'FROM node:22')
      await writeFile(join(directory, 'docker-compose.yml'), 'services:\n  web:\n    build: .')
      await writeFile(join(directory, '.env.example'), 'DATABASE_URL=do-not-send\nPORT=3000\n')
      await writeFile(join(directory, '.github', 'workflows', 'deploy.yml'), 'name: deploy\n')
      await writeFile(join(directory, 'src', 'server.ts'), 'const token = "super-secret"\nexport default token\n')

      const inspection = await inspectProjectDeploymentContext({
        repositoryId: 'repo-1',
        repositoryName: 'Example Web',
        localPath: directory,
        currentBranch: 'main',
        defaultBranch: 'main',
        branches: ['main'],
        remoteBranches: ['origin/main'],
        remoteUrl: 'https://github.com/example/web.git'
      })

      assert.equal(inspection.detected.framework, 'nextjs')
      assert.equal(inspection.detected.packageManager, 'pnpm')
      assert.equal(inspection.detected.hasDockerfile, true)
      assert.equal(inspection.detected.hasCompose, true)
      assert.equal(inspection.files.some((file) => file.path === '.github/workflows/deploy.yml'), true)
      assert.equal(inspection.aiContext.includes('do-not-send'), false)
      assert.equal(inspection.aiContext.includes('super-secret'), false)
      assert.ok(inspection.aiContext.length <= 50000)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('builds provider-aware defaults and reports unsupported or unsafe configuration', () => {
    const inspection = {
      repositoryId: 'repo-1',
      repositoryName: 'web',
      localPath: '/tmp/web',
      currentBranch: 'main',
      defaultBranch: 'main',
      branches: ['main'],
      remoteBranches: [],
      remoteUrl: 'https://github.com/example/web.git',
      files: [],
      aiContext: '',
      detected: {
        framework: 'vite',
        packageManager: 'pnpm' as const,
        scripts: { build: 'pnpm build' },
        nodeVersion: '22',
        pythonVersion: '',
        hasDockerfile: false,
        hasCompose: false,
        hasReadme: true,
        hasEnvironmentExample: true
      }
    }
    const config = getDefaultDeploymentConfig(inspection, 'vercel', 'git')
    assert.equal(config.outputDirectory, 'dist')
    assert.equal(getDeploymentProviderCapabilities('railway').supportsLocal, false)

    const invalid: ProjectDeploymentConfig = { ...config, rootDirectory: '../outside', provider: 'railway', sourceMode: 'local' }
    const validation = validateProjectDeploymentConfig(invalid, inspection)
    assert.ok(validation.issues.some((issue) => issue.includes('仓库内')))
    assert.ok(validation.issues.some((issue) => issue.includes('Railway')))
  })

  it('does not invent npm commands for a Python or otherwise package-less repository', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-deployment-python-'))
    try {
      await writeFile(join(directory, 'requirements.txt'), 'fastapi\n')
      const inspection = await inspectProjectDeploymentContext({
        repositoryId: 'repo-python',
        repositoryName: 'python-service',
        localPath: directory,
        currentBranch: 'main',
        defaultBranch: 'main',
        branches: [],
        remoteBranches: [],
        remoteUrl: ''
      })
      const config = getDefaultDeploymentConfig(inspection, 'ssh-pm2', 'local')
      assert.equal(inspection.detected.packageManager, '')
      assert.equal(config.installCommand, '')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('migrates targets and persists immutable task configuration snapshots', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY); CREATE TABLE repositories (id TEXT PRIMARY KEY); INSERT INTO projects VALUES (\'project-1\'); INSERT INTO repositories VALUES (\'repo-1\');')
    migrateProjectDeploymentTables(db)
    const baseConfig: ProjectDeploymentConfig = {
      repositoryId: 'repo-1',
      provider: 'ssh-pm2',
      sourceMode: 'local',
      rootDirectory: '',
      branch: 'main',
      installCommand: 'pnpm install',
      buildCommand: 'pnpm build',
      outputDirectory: '',
      framework: 'nextjs',
      packageManager: 'pnpm',
      runtimeVersion: '22',
      startCommand: 'pm2 start npm --name web -- start',
      port: '3000',
      healthPath: '/',
      remoteHost: 'deploy@example.com',
      remotePath: '/srv/web',
      uploadPath: '/tmp/forgedesk',
      appName: 'web',
      dockerContext: '.',
      dockerfile: 'Dockerfile',
      composeFile: '',
      composeService: '',
      envBindings: [{ key: 'DATABASE_URL', source: 'manual', required: true, configured: false }],
      extra: {}
    }
    const target = saveProjectDeploymentTarget(db, {
      projectId: 'project-1',
      repositoryId: 'repo-1',
      provider: 'ssh-pm2',
      displayName: 'Production SSH',
      config: baseConfig
    })
    assert.equal(listProjectDeploymentTargets(db, 'project-1')[0].id, target.id)
    assert.equal(target.config.envBindings[0].key, 'DATABASE_URL')

    const task = saveProjectDeploymentTask(db, {
      id: 'task-1',
      projectId: 'project-1',
      targetId: target.id,
      repositoryId: 'repo-1',
      targetName: target.displayName,
      provider: 'ssh-pm2',
      sourceMode: 'local',
      status: 'running',
      phase: '构建',
      phaseIndex: 2,
      phaseTotal: 5,
      hint: 'running',
      log: 'started',
      stdout: '',
      stderr: '',
      exitCode: null,
      config: baseConfig,
      startedAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:01.000Z'
    })
    assert.equal(listProjectDeploymentTasks(db, 'project-1')[0].config.buildCommand, 'pnpm build')
    assert.equal(task.id, 'task-1')
    assert.equal(recoverProjectDeploymentTasks(db)[0].status, 'failed')
    assert.match(recoverProjectDeploymentTasks(db)[0].error ?? '', /重启/)
    db.close()
  })
})
