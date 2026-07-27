import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requestProjectDeploymentSuggestion } from './ai-project-deployment-assistant.js'
import type { DeploymentInspection } from './project-deployment.js'

const settings = {
  enabled: true,
  provider: 'openai-compatible' as const,
  baseUrl: 'https://api.example.test/v1',
  apiKey: 'secret',
  model: 'gpt-test',
  temperature: 0.2
}

const inspection: DeploymentInspection = {
  repositoryId: 'repo-1',
  repositoryName: 'web',
  localPath: '/tmp/web',
  currentBranch: 'main',
  defaultBranch: 'main',
  branches: ['main'],
  remoteBranches: [],
  remoteUrl: 'https://github.com/example/web.git',
  files: [{ path: 'package.json', category: 'manifest', sizeBytes: 100, includedInAi: true, redacted: false }],
  detected: {
    framework: 'vite',
    packageManager: 'pnpm',
    scripts: { build: 'pnpm build' },
    nodeVersion: '22',
    pythonVersion: '',
    hasDockerfile: false,
    hasCompose: false,
    hasReadme: true,
    hasEnvironmentExample: true
  },
  aiContext: 'package.json\nDATABASE_URL=[REDACTED]'
}

describe('project deployment AI assistant', () => {
  it('falls back to deterministic configuration for invalid JSON and never sends credential values', async () => {
    let requestBody = ''
    const suggestion = await requestProjectDeploymentSuggestion({
      settings,
      inspection,
      provider: 'vercel',
      sourceMode: 'git',
      fetchImpl: async (_url, init) => {
        requestBody = String(init?.body ?? '')
        return new Response(JSON.stringify({ choices: [{ message: { content: '{not-json' } }] }))
      }
    })

    assert.equal(suggestion.config.framework, 'vite')
    assert.equal(suggestion.config.outputDirectory, 'dist')
    assert.equal(suggestion.reasons.length > 0, true)
    assert.equal(requestBody.includes('DATABASE_URL=[REDACTED]'), true)
    assert.equal(requestBody.includes('credential-value'), false)
  })

  it('accepts only safe structured fields and strips values from environment bindings', async () => {
    const suggestion = await requestProjectDeploymentSuggestion({
      settings,
      inspection,
      provider: 'vercel',
      sourceMode: 'git',
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          config: {
            buildCommand: 'pnpm build',
            envBindings: [{ key: 'DATABASE_URL', source: 'manual', value: 'credential-value', required: true, configured: false }]
          },
          confidence: 0.9,
          reasons: ['package.json script'],
          warnings: [],
          sources: ['package.json']
        }) } }]
      }))
    })

    assert.equal(suggestion.config.buildCommand, 'pnpm build')
    assert.deepEqual(suggestion.config.envBindings, [{ key: 'DATABASE_URL', source: 'manual', required: true, configured: false }])
    assert.equal(JSON.stringify(suggestion).includes('credential-value'), false)
  })
})
