import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listOpenRouterModels } from './openrouter-models.js'

describe('OpenRouter models', () => {
  it('normalizes, deduplicates, and sorts models by newest first', async () => {
    const models = await listOpenRouterModels(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'openai/gpt-old', name: 'GPT Old', created: 10 },
            { id: 'openai/gpt-new', name: 'GPT New', created: 20 },
            { id: 'openai/gpt-old', name: 'Duplicate', created: 30 },
            { id: '', name: 'Invalid' }
          ]
        }),
        { status: 200 }
      )
    )

    assert.deepEqual(models, [
      { id: 'openai/gpt-new', name: 'GPT New', created: 20 },
      { id: 'openai/gpt-old', name: 'GPT Old', created: 10 }
    ])
  })

  it('reports an API failure with its status code', async () => {
    await assert.rejects(
      () => listOpenRouterModels(async () => new Response(null, { status: 503 })),
      /HTTP 503/
    )
  })
})
