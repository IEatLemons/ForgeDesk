import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAiNetworkError, createAiRequestError } from './ai-errors.js'

describe('ai errors', () => {
  it('explains expired or invalid API keys without echoing key fragments', async () => {
    const error = await createAiRequestError(new Response(
      JSON.stringify({
        error: {
          message: 'Incorrect API key provided: sk-expired-secret-key.',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }),
      { status: 401 }
    ))

    assert.match(error.message, /AI API Key 无效、已过期/)
    assert.doesNotMatch(error.message, /sk-expired/)
  })

  it('separates quota errors from generic rate limit failures', async () => {
    const error = await createAiRequestError(new Response(
      JSON.stringify({
        error: {
          message: 'You exceeded your current quota.',
          code: 'insufficient_quota'
        }
      }),
      { status: 429 }
    ))

    assert.match(error.message, /额度不足/)
  })

  it('keeps useful provider details for model and endpoint mistakes', async () => {
    const error = await createAiRequestError(new Response(
      JSON.stringify({ error: { message: 'Model test-model not found', code: 'model_not_found' } }),
      { status: 404 }
    ))

    assert.match(error.message, /Base URL 和模型名称/)
    assert.match(error.message, /test-model/)
  })

  it('falls back to status and sanitized provider text for unknown failures', async () => {
    const error = await createAiRequestError(new Response('upstream rejected Bearer sk-secret-token-value', { status: 418 }))

    assert.match(error.message, /HTTP 418/)
    assert.match(error.message, /Bearer \*\*\*/)
    assert.doesNotMatch(error.message, /sk-secret/)
  })

  it('explains network failures as connection or Base URL problems', () => {
    const error = createAiNetworkError(new TypeError('fetch failed'))

    assert.match(error.message, /没有连上服务/)
    assert.match(error.message, /fetch failed/)
  })
})
