import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requestCommitMessageSuggestion } from './ai-commit-message-assistant.js'

describe('ai commit message assistant', () => {
  it('calls an OpenAI-compatible endpoint and returns a clean commit message', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> })

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '```text\nfeat: improve git commit dialog\n```' } }]
        }),
        { status: 200 }
      )
    }

    const suggestion = await requestCommitMessageSuggestion({
      settings: {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'secret',
        model: 'gpt-test',
        temperature: 0.2
      },
      repositoryName: 'ForgeDesk',
      files: [
        { path: 'src/renderer/src/App.tsx', status: 'M' },
        { path: 'src/main/index.ts', status: 'M' }
      ],
      diffSummary: 'src/renderer/src/App.tsx | 20 ++++++++++\nsrc/main/index.ts | 8 +++++',
      fetchImpl: fakeFetch as typeof fetch
    })

    assert.equal(suggestion.message, 'feat: improve git commit dialog')
    assert.equal(calls[0].url, 'https://llm.example.com/v1/chat/completions')
  })

  it('rejects disabled or incomplete settings', async () => {
    await assert.rejects(
      () =>
        requestCommitMessageSuggestion({
          settings: {
            enabled: false,
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'gpt-test',
            temperature: 0.2
          },
          repositoryName: 'repo',
          files: [{ path: 'src/App.tsx', status: 'M' }],
          diffSummary: 'src/App.tsx | 1 +'
        }),
      /请先在公共设置里启用 AI/
    )
  })
})
