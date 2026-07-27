import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  findLocalAiCommand,
  getLocalProviderCommandCandidates,
  inspectAiRuntimeWithOptions
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
})
