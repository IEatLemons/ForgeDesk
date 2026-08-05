import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCodexApiKey, getCodexApiService, maskCodexApiKey, normalizeCodexApiServiceSettings, startCodexApiService, stopCodexApiService, toCodexMessages } from './codex-api-service.js'

describe('codex api service', () => {
  it('creates the local client key format used by the API service', () => {
    const key = createCodexApiKey((size) => Buffer.alloc(size, 1))

    assert.match(key, /^agt_codex_/)
    assert.equal(maskCodexApiKey(key), `${key.slice(0, 12)}••••••••••••`)
  })

  it('normalizes service defaults without replacing an existing key', () => {
    const settings = normalizeCodexApiServiceSettings({ enabled: true, apiKey: 'agt_codex_existing', port: 55914 })

    assert.equal(settings.enabled, true)
    assert.equal(settings.apiKey, 'agt_codex_existing')
    assert.equal(settings.port, 55914)
    assert.equal(settings.model, 'gpt-5.3-codex')
  })

  it('maps chat and responses input into the CLI prompt shape', () => {
    assert.deepEqual(toCodexMessages([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }
    ]), [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Hello' }
    ])
  })

  it('creates a loopback OpenAI-compatible endpoint with a client key', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'forgedesk-codex-api-'))

    try {
      let service: Awaited<ReturnType<typeof startCodexApiService>>
      try {
        service = await startCodexApiService(userDataPath, { port: 0 })
      } catch (error) {
        if (error instanceof Error && /listen EPERM/.test(error.message)) return
        throw error
      }
      assert.equal(service.running, true)
      assert.match(service.baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/v1$/)

      const health = await fetch(`${service.baseUrl.replace(/\/v1$/, '')}/health`)
      assert.equal(health.status, 200)

      const unauthorized = await fetch(`${service.baseUrl}/models`)
      assert.equal(unauthorized.status, 401)

      const models = await fetch(`${service.baseUrl}/models`, { headers: { authorization: `Bearer ${service.apiKey}` } })
      assert.equal(models.status, 200)
      assert.equal((await models.json() as { data: Array<{ id: string }> }).data[0].id, service.model)

      const stopped = await stopCodexApiService(userDataPath)
      assert.equal(stopped.running, false)
      assert.equal((await getCodexApiService(userDataPath)).enabled, false)
    } finally {
      await stopCodexApiService(userDataPath).catch(() => undefined)
      await rm(userDataPath, { recursive: true, force: true })
    }
  })
})
