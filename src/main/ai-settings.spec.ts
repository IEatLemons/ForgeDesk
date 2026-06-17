import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { getRedactedAiSettings, readAiSettingsFile, writeAiSettingsFile } from './ai-settings.js'

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

  it('persists settings and redacts the api key for renderer reads', async () => {
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
        apiKeyConfigured: true,
        model: 'gpt-test',
        temperature: 0.2
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
