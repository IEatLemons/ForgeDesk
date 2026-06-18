import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { buildAiRequestHeaders, getRedactedAiSettings, normalizeAiSettings, readAiSettingsFile, writeAiSettingsFile } from './ai-settings.js'

describe('ai settings', () => {
  it('returns safe defaults when settings file is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ai-settings-'))

    try {
      const settings = await readAiSettingsFile(directory)

      assert.equal(settings.provider, 'openai-compatible')
      assert.equal(settings.baseUrl, 'https://api.openai.com/v1')
      assert.equal(settings.model, 'gpt-4.1-mini')
      assert.equal(settings.apiKey, '')
      assert.equal(settings.enabled, false)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists settings and returns the api key for local renderer reads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ai-settings-'))

    try {
      const saved = await writeAiSettingsFile(directory, {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'sk-secret-value',
        model: 'gpt-test',
        temperature: 0.2
      })
      const raw = JSON.parse(await readFile(join(directory, 'ai-settings.json'), 'utf8')) as { apiKey: string }

      assert.equal(raw.apiKey, 'sk-secret-value')
      assert.equal(saved.enabled, true)
      assert.deepEqual(getRedactedAiSettings(saved), {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'sk-secret-value',
        apiKeyConfigured: true,
        model: 'gpt-test',
        temperature: 0.2
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('normalizes OpenRouter settings with provider defaults', () => {
    const settings = normalizeAiSettings({
      enabled: true,
      provider: 'openrouter',
      apiKey: ' openrouter-key '
    })

    assert.equal(settings.provider, 'openrouter')
    assert.equal(settings.baseUrl, 'https://openrouter.ai/api/v1')
    assert.equal(settings.model, '~openai/gpt-latest')
    assert.equal(settings.apiKey, 'openrouter-key')
  })

  it('adds OpenRouter attribution headers for chat requests', () => {
    const headers = buildAiRequestHeaders({
      enabled: true,
      provider: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'openrouter-key',
      model: '~openai/gpt-latest',
      temperature: 0.2
    })

    assert.equal(headers.authorization, 'Bearer openrouter-key')
    assert.equal(headers['content-type'], 'application/json')
    assert.equal(headers['X-OpenRouter-Title'], 'ForgeDesk')
  })
})
