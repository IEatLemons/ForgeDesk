import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, it } from 'node:test'
import {
  analyzeDeploymentApproval,
  executeDeploymentApproval,
  migrateDeploymentApprovalTables,
  saveDeploymentApprovalConfig
} from './deployment-approvals.js'
import type { DeploymentApprovalDatabase } from './deployment-approvals.js'

const exec = promisify(execFile)
const temporaryPaths: string[] = []

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await exec('git', ['-C', cwd, ...args])).stdout.trim()
}

class FakeDatabase implements DeploymentApprovalDatabase {
  config: Record<string, unknown> | undefined
  targets: Record<string, unknown>[] = []
  approvals: Record<string, unknown>[] = []

  exec(): void {}

  prepare(sql: string): { run: (...params: any[]) => unknown; get: (...params: any[]) => unknown; all: (...params: any[]) => unknown[] } {
    const compact = sql.replace(/\s+/g, ' ').trim()
    return {
      run: (...params: any[]) => {
        if (compact.startsWith('INSERT INTO repository_deployment_approval_configs')) {
          const [repository_id, remote, branch, author_name, author_email, updated_at] = params
          this.config = { repository_id, remote, branch, author_name, author_email, updated_at }
        } else if (compact.startsWith('DELETE FROM repository_deployment_approval_targets')) {
          this.targets = []
        } else if (compact.startsWith('INSERT INTO repository_deployment_approval_targets')) {
          const [repository_id, target_id, target_name, root_directory, trigger_path, enabled] = params
          this.targets.push({ repository_id, target_id, target_name, root_directory, trigger_path, enabled })
        } else if (compact.startsWith('INSERT INTO repository_deployment_approvals')) {
          const [id, repository_id, source_sha, author_name, author_email, target_ids_json, trigger_paths_json, created_at] = params
          this.approvals.push({ id, repository_id, baseline_sha: '', source_sha, approval_commit_sha: '', author_name, author_email, target_ids_json, trigger_paths_json, status: 'running', error_message: '', created_at, finished_at: '' })
        } else if (compact.includes("status = 'succeeded'")) {
          const [baseline_sha, approval_commit_sha, finished_at, id] = params
          Object.assign(this.approvals.find((row) => row.id === id)!, { baseline_sha, approval_commit_sha, status: 'succeeded', finished_at })
        } else if (compact.includes("status = 'failed'")) {
          const [error_message, finished_at, id] = params
          Object.assign(this.approvals.find((row) => row.id === id)!, { status: 'failed', error_message, finished_at })
        }
        return {}
      },
      get: (...params: any[]) => {
        if (compact.includes('FROM repository_deployment_approval_configs')) return this.config
        if (compact.includes("status = 'succeeded'") && compact.includes('approval_commit_sha')) return [...this.approvals].reverse().find((row) => row.status === 'succeeded')
        if (compact.includes('WHERE id = ?')) return this.approvals.find((row) => row.id === params[0])
        return undefined
      },
      all: () => {
        if (compact.includes('FROM repository_deployment_approval_targets')) return this.targets
        if (compact.includes('FROM repository_deployment_approvals')) return [...this.approvals].reverse()
        return []
      }
    }
  }
}

async function createFixture(): Promise<{ root: string; repository: string; remote: string; baseline: string; source: string; db: FakeDatabase }> {
  const root = await mkdtemp(join(tmpdir(), 'forgedesk-approval-test-'))
  temporaryPaths.push(root)
  const repository = join(root, 'repository')
  const remote = join(root, 'remote.git')
  await exec('git', ['init', '--bare', remote])
  await exec('git', ['init', repository])
  await git(repository, 'config', 'user.name', 'Developer')
  await git(repository, 'config', 'user.email', 'developer@example.com')
  await git(repository, 'checkout', '-b', 'main')
  await exec('mkdir', ['-p', join(repository, 'apps/web')])
  await writeFile(join(repository, 'apps/web/package.json'), '{"name":"web"}\n')
  await git(repository, 'add', '.')
  await git(repository, 'commit', '-m', 'initial')
  const baseline = await git(repository, 'rev-parse', 'HEAD')
  await git(repository, 'remote', 'add', 'origin', remote)
  await git(repository, 'push', '-u', 'origin', 'main')
  await writeFile(join(repository, 'apps/web/page.tsx'), 'export const page = "review me"\n')
  await git(repository, 'add', '.')
  await git(repository, 'commit', '-m', 'feat: contributor change')
  const source = await git(repository, 'rev-parse', 'HEAD')
  await git(repository, 'push', 'origin', 'main')

  const db = new FakeDatabase()
  migrateDeploymentApprovalTables(db)
  saveDeploymentApprovalConfig(db, {
    repositoryId: 'repo-1', remote: 'origin', branch: 'main', authorName: 'Owner', authorEmail: 'owner@example.com', updatedAt: '',
    targets: [{ targetId: 'web', targetName: 'Web', rootDirectory: 'apps/web', triggerPath: '.forgedesk/deploy-trigger.json', enabled: true }]
  })
  return { root, repository, remote, baseline, source, db }
}

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('deployment approvals', () => {
  it('reviews remote main and pushes an isolated owner approval without touching the active worktree', async () => {
    const fixture = await createFixture()
    await git(fixture.repository, 'checkout', '-b', 'local-work')
    await writeFile(join(fixture.repository, 'local-note.txt'), 'keep me dirty\n')

    const analysis = await analyzeDeploymentApproval({
      db: fixture.db, repositoryId: 'repo-1', localPath: fixture.repository, manualBaselineSha: fixture.baseline
    })
    assert.equal(analysis.baselineSha, fixture.baseline)
    assert.equal(analysis.reviewedHeadSha, fixture.source)
    assert.equal(analysis.commits.length, 1)
    assert.equal(analysis.files[0].path, 'apps/web/page.tsx')
    assert.deepEqual(analysis.triggerPaths, ['apps/web/.forgedesk/deploy-trigger.json'])

    const result = await executeDeploymentApproval({
      db: fixture.db, repositoryId: 'repo-1', localPath: fixture.repository,
      reviewedHeadSha: analysis.reviewedHeadSha, baselineSha: analysis.baselineSha, tempRoot: fixture.root
    })
    assert.equal(result.ok, true)
    assert.equal(await git(fixture.repository, 'branch', '--show-current'), 'local-work')
    assert.equal(await readFile(join(fixture.repository, 'local-note.txt'), 'utf8'), 'keep me dirty\n')
    assert.equal(await git(fixture.repository, 'status', '--porcelain'), '?? local-note.txt')

    const clone = join(fixture.root, 'verification')
    await exec('git', ['clone', '--branch', 'main', fixture.remote, clone])
    assert.equal(await git(clone, 'log', '-1', '--format=%an <%ae>'), 'Owner <owner@example.com>')
    assert.equal(await git(clone, 'rev-parse', 'HEAD^'), fixture.source)
    assert.equal(await git(clone, 'show', '--pretty=', '--name-only', 'HEAD'), 'apps/web/.forgedesk/deploy-trigger.json')
    const marker = JSON.parse(await readFile(join(clone, 'apps/web/.forgedesk/deploy-trigger.json'), 'utf8'))
    assert.equal(marker.approvedSource, fixture.source)
  })

  it('rejects unsafe trigger paths and stale remote heads', async () => {
    const fixture = await createFixture()
    assert.throws(() => saveDeploymentApprovalConfig(fixture.db, {
      repositoryId: 'repo-1', remote: 'origin', branch: 'main', authorName: 'Owner', authorEmail: 'owner@example.com', updatedAt: '',
      targets: [{ targetId: 'bad', targetName: 'Bad', rootDirectory: '', triggerPath: '../outside.json', enabled: true }]
    }), /不能包含/)

    const analysis = await analyzeDeploymentApproval({
      db: fixture.db, repositoryId: 'repo-1', localPath: fixture.repository, manualBaselineSha: fixture.baseline
    })
    await git(fixture.repository, 'checkout', 'main')
    await git(fixture.repository, 'commit', '--allow-empty', '-m', 'concurrent update')
    await git(fixture.repository, 'push', 'origin', 'main')
    await assert.rejects(() => executeDeploymentApproval({
      db: fixture.db, repositoryId: 'repo-1', localPath: fixture.repository,
      reviewedHeadSha: analysis.reviewedHeadSha, baselineSha: analysis.baselineSha, tempRoot: fixture.root
    }), /已过期/)
  })

  it('executes a first approval from a manually reviewed baseline', async () => {
    const fixture = await createFixture()
    const analysis = await analyzeDeploymentApproval({
      db: fixture.db,
      repositoryId: 'repo-1',
      localPath: fixture.repository,
      manualBaselineSha: fixture.baseline
    })
    assert.equal(analysis.baselineSource, 'manual')
    const result = await executeDeploymentApproval({
      db: fixture.db,
      repositoryId: 'repo-1',
      localPath: fixture.repository,
      reviewedHeadSha: analysis.reviewedHeadSha,
      baselineSha: analysis.baselineSha,
      tempRoot: fixture.root
    })
    assert.equal(result.ok, true)
    assert.equal(result.approval.baselineSha, fixture.baseline)
  })
})
