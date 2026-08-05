import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  findLocalAiCommand,
  formatLocalAiFailure,
  getLocalProviderCommandCandidates,
  inspectAiRuntimeWithOptions,
  requestAiText
} from './ai-runtime.js'
import type { AiSettings } from './ai-settings.js'

const codexSettings: AiSettings = {
  apiKey: '',
  baseUrl: '',
  enabled: true,
  model: '',
  provider: 'codex-cli',
  temperature: 0.2
}

describe('ai runtime', () => {
  it('checks the PATH codex command before the ChatGPT app bundled binary', () => {
    assert.deepEqual(
      getLocalProviderCommandCandidates('codex-cli'),
      ['codex', '/Applications/ChatGPT.app/Contents/Resources/codex']
    )
  })

  it('falls back to the ChatGPT app bundled Codex CLI path', async () => {
    const checkedCommands: string[] = []
    const command = await findLocalAiCommand('codex-cli', {
      executableExists: async (candidate) => {
        checkedCommands.push(candidate)
        return candidate === '/Applications/ChatGPT.app/Contents/Resources/codex'
      }
    })

    assert.equal(command, '/Applications/ChatGPT.app/Contents/Resources/codex')
    assert.deepEqual(checkedCommands, ['codex', '/Applications/ChatGPT.app/Contents/Resources/codex'])
  })

  it('reports a missing AI coding assistant runtime without verification', async () => {
    const status = await inspectAiRuntimeWithOptions(codexSettings, false, {
      executableExists: async () => false
    })

    assert.equal(status.provider, 'codex-cli')
    assert.equal(status.available, false)
    assert.equal(status.usable, false)
    assert.equal(status.command, '')
    assert.match(status.message, /未检测到 AI 编程助手/)
  })

  it('returns command and version when Codex CLI is detected', async () => {
    const status = await inspectAiRuntimeWithOptions(codexSettings, false, {
      executableExists: async (candidate) => candidate === 'codex',
      execFileText: async () => ({ stdout: 'codex-cli 0.145.0\n', stderr: '' })
    })

    assert.equal(status.provider, 'codex-cli')
    assert.equal(status.available, true)
    assert.equal(status.usable, null)
    assert.equal(status.command, 'codex')
    assert.equal(status.version, 'codex-cli 0.145.0')
  })

  it('explains when the local Codex API service is not running', async () => {
    const status = await inspectAiRuntimeWithOptions({
      enabled: true,
      provider: 'codex-local-api',
      baseUrl: 'http://127.0.0.1:55914/v1',
      apiKey: 'agt_codex_key',
      model: 'gpt-5.3-codex',
      temperature: 0.2
    }, true, {
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      }
    })

    assert.equal(status.available, false)
    assert.equal(status.usable, false)
    assert.match(status.message, /创建并接入 ForgeDesk/)
  })

  it('uses a dedicated local API error for request failures', async () => {
    await assert.rejects(
      requestAiText({
        settings: {
          enabled: true,
          provider: 'codex-local-api',
          baseUrl: 'http://127.0.0.1:55914/v1',
          apiKey: 'agt_codex_key',
          model: 'gpt-5.3-codex',
          temperature: 0.2
        },
        messages: [{ role: 'user', content: 'ping' }],
        fetchImpl: async () => {
          throw new TypeError('fetch failed')
        }
      }),
      /本地 Codex API 服务未运行/
    )
  })

  it('preserves useful CLI stderr without echoing the full prompt command', () => {
    const error = Object.assign(new Error('Command failed: codex exec secret prompt'), {
      stderr: 'failed to open state DB: readonly database',
      code: 1
    })

    const detail = formatLocalAiFailure(error)

    assert.match(detail, /无法写入本机状态目录/)
    assert.match(detail, /readonly database/)
    assert.doesNotMatch(detail, /secret prompt/)
  })
})
