import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requestConflictResolutionSuggestion } from './ai-conflict-assistant.js'

describe('ai conflict assistant', () => {
  it('calls an OpenAI-compatible endpoint and returns suggested content', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> })

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'const value = "merged"\n' } }]
        }),
        { status: 200 }
      )
    }

    const suggestion = await requestConflictResolutionSuggestion({
      settings: {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'secret',
        model: 'gpt-test',
        temperature: 0.2
      },
      repositoryName: 'ForgeDesk',
      filePath: 'src/example.ts',
      conflictedContent: '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature\n',
      fetchImpl: fakeFetch as typeof fetch
    })

    assert.equal(suggestion.suggestedContent, 'const value = "merged"\n')
    assert.equal(calls[0].url, 'https://llm.example.com/v1/chat/completions')
  })

  it('rejects disabled or incomplete settings', async () => {
    await assert.rejects(
      () =>
        requestConflictResolutionSuggestion({
          settings: {
            enabled: false,
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'gpt-test',
            temperature: 0.2
          },
          repositoryName: 'repo',
          filePath: 'file.ts',
          conflictedContent: '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature\n'
        }),
      /请先在公共设置里启用 AI/
    )
  })
})
