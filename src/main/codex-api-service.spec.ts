import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readAiSettingsFile, writeAiSettingsFile } from './ai-settings.js'
import { createCodexApiKey, getCodexApiService, getCodexApiServiceIntegrationSettings, maskCodexApiKey, normalizeCodexApiServiceSettings, saveCodexApiServiceSettings, startCodexApiService, stopCodexApiService, toCodexMessages } from './codex-api-service.js'

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

  it('keeps client keys stable after saving while read-only views create no configuration', async () => {
    const data = await mkdtemp(join(tmpdir(), 'forgedesk-codex-api-config-'))
    try {
      await writeFile(join(data, 'codex-accounts.json'), JSON.stringify({ activeAccountId: 'local', accounts: [{ id: 'local', source: 'local', codexHome: join(data, 'isolated-profile') }] }))
      assert.equal((await getCodexApiService(data)).apiKeyConfigured, false)
      await assert.rejects(stat(join(data, 'codex-api-service.json')), { code: 'ENOENT' })
      const saved = await saveCodexApiServiceSettings(data, { port: 50549, model: 'test-model' })
      assert.equal(saved.running, false)
      const first = await getCodexApiServiceIntegrationSettings(data)
      const second = await getCodexApiServiceIntegrationSettings(data)
      assert.equal(first.apiKey, second.apiKey)
      assert.equal((await getCodexApiService(data)).apiKeyMasked, maskCodexApiKey(first.apiKey))
    } finally { await rm(data, { recursive: true, force: true }) }
  })

  it('creates a loopback OpenAI-compatible endpoint with a client key', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'forgedesk-codex-api-'))

    try {
      await writeAiSettingsFile(userDataPath, {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'existing-key',
        model: 'existing-model',
        temperature: 0.2
      })

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

      const integration = await getCodexApiServiceIntegrationSettings(userDataPath)
      const aiSettings = await readAiSettingsFile(userDataPath)
      assert.equal(aiSettings.enabled, true)
      assert.equal(aiSettings.provider, 'codex-local-api')
      assert.equal(aiSettings.baseUrl, service.baseUrl)
      assert.equal(aiSettings.apiKey, integration.apiKey)
      assert.equal(aiSettings.model, service.model)
      const models = await fetch(`${service.baseUrl}/models`, { headers: { authorization: `Bearer ${integration.apiKey}` } })
      assert.equal(models.status, 200)
      assert.equal((await models.json() as { data: Array<{ id: string }> }).data[0].id, service.model)
      await assert.rejects(saveCodexApiServiceSettings(userDataPath, { port: 50549 }), /先停止/)

      const stopped = await stopCodexApiService(userDataPath)
      assert.equal(stopped.running, false)
      assert.equal((await getCodexApiService(userDataPath)).enabled, false)
    } finally {
      await stopCodexApiService(userDataPath).catch(() => undefined)
      await rm(userDataPath, { recursive: true, force: true })
    }
  })
})
