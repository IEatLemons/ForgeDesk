import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requestReleaseSuggestion } from './ai-release-assistant.js'
import type { AiSettings } from './ai-settings.js'

const readySettings: AiSettings = {
  enabled: true,
  provider: 'openai-compatible',
  baseUrl: 'https://api.example.test/v1',
  apiKey: 'secret',
  model: 'gpt-test',
  temperature: 0.2
}

describe('ai release assistant', () => {
  it('calls an OpenAI-compatible endpoint and returns structured release metadata', async () => {
    const seen: { url?: string; body?: unknown } = {}
    const suggestion = await requestReleaseSuggestion({
      settings: readySettings,
      repositoryName: 'ForgeDesk',
      currentVersion: '1.0.2',
      suggestedVersion: '1.0.3',
      suggestedTagName: 'v1.0.3',
      recentCommits: ['feat: add app updates'],
      documentationContext: 'ForgeDesk is a project-first desktop tool.',
      fetchImpl: async (url, init) => {
        seen.url = String(url)
        seen.body = JSON.parse(String(init?.body ?? '{}'))

        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  version: '1.0.3',
                  tagName: 'v1.0.3',
                  releaseTitle: 'ForgeDesk 1.0.3',
                  releaseNotes: 'Adds in-app updates.',
                  commitMessage: 'chore: release v1.0.3'
                })
              }
            }
          ]
        }))
      }
    })

    assert.equal(seen.url, 'https://api.example.test/v1/chat/completions')
    assert.equal(suggestion.releaseTitle, 'ForgeDesk 1.0.3')
    assert.equal(suggestion.commitMessage, 'chore: release v1.0.3')
    assert.equal(suggestion.releaseNotes, 'Adds in-app updates.')
  })

  it('rejects disabled or incomplete settings', async () => {
    await assert.rejects(
      () =>
        requestReleaseSuggestion({
          settings: { ...readySettings, enabled: false },
          repositoryName: 'ForgeDesk',
          currentVersion: '1.0.2',
          suggestedVersion: '1.0.3',
          suggestedTagName: 'v1.0.3',
          recentCommits: [],
          documentationContext: ''
        }),
      /启用 AI/
    )
  })
})
