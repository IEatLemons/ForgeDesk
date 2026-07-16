import { execFile } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'
import { createAiNetworkError, createAiRequestError } from './ai-errors.js'
import { buildAiRequestHeaders, isAiSettingsConfigured, isLocalAiProvider, type AiProvider, type AiSettings } from './ai-settings.js'

const execFileAsync = promisify(execFile)
const localProviderCommands: Record<'codex-cli' | 'cursor-cli', string[]> = {
  'codex-cli': ['codex', '/Applications/ChatGPT.app/Contents/Resources/codex'],
  'cursor-cli': ['cursor-agent', 'agent', join(process.env.HOME || '', '.local/bin/cursor-agent')]
}

export type AiRuntimeStatus = {
  provider: AiProvider
  configured: boolean
  available: boolean
  usable: boolean | null
  label: string
  command: string
  version: string
  message: string
  checkedAt: string
}

type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function executableExists(command: string): Promise<boolean> {
  if (command.includes('/')) {
    try {
      await access(command)
      return true
    } catch {
      return false
    }
  }

  for (const directory of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    try {
      await access(join(directory, command))
      return true
    } catch {
      // Continue searching PATH.
    }
  }
  return false
}

async function findLocalCommand(provider: 'codex-cli' | 'cursor-cli'): Promise<string> {
  for (const command of localProviderCommands[provider]) {
    if (command && await executableExists(command)) return command
  }
  return ''
}

function promptFromMessages(messages: AiMessage[]): string {
  return [
    'You are being used as a text-generation backend inside ForgeDesk.',
    'Do not inspect files, run commands, or modify the workspace. Answer only from the content below.',
    ...messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
  ].join('\n\n')
}

async function runLocalAi(settings: AiSettings, messages: AiMessage[]): Promise<string> {
  const provider = settings.provider as 'codex-cli' | 'cursor-cli'
  const command = await findLocalCommand(provider)
  if (!command) throw new Error(provider === 'codex-cli' ? '未检测到 Codex CLI，请先安装或打开 Codex/ChatGPT 桌面应用。' : '未检测到 Cursor Agent CLI，请先安装 cursor-agent。')

  const prompt = promptFromMessages(messages)
  const args = provider === 'codex-cli'
    ? ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', ...(settings.model ? ['--model', settings.model] : []), prompt]
    : ['--print', '--output-format', 'json', ...(settings.model ? ['--model', settings.model] : []), prompt]

  const isolatedDirectory = await mkdtemp(join(tmpdir(), 'forgedesk-local-ai-'))
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: isolatedDirectory,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' }
    })
    if (provider === 'cursor-cli') {
      const payload = JSON.parse(stdout) as { result?: string }
      if (payload.result?.trim()) return payload.result.trim()
    }
    if (stdout.trim()) return stdout.trim()
    throw new Error('本地 AI 没有返回内容')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`本地 AI 调用失败：${detail}`)
  } finally {
    await rm(isolatedDirectory, { recursive: true, force: true })
  }
}

export async function requestAiText(input: {
  settings: AiSettings
  messages: AiMessage[]
  fetchImpl?: typeof fetch
  webSearch?: boolean
}): Promise<string> {
  if (!isAiSettingsConfigured(input.settings)) {
    throw new Error(isLocalAiProvider(input.settings.provider) ? '请先启用本地 AI' : '请先在公共设置里启用 AI 并填写 API Key')
  }
  if (isLocalAiProvider(input.settings.provider)) return runLocalAi(input.settings, input.messages)

  const fetchImpl = input.fetchImpl ?? fetch
  const officialOpenAi = /^https:\/\/api\.openai\.com\/v1$/i.test(input.settings.baseUrl)
  const useResponses = officialOpenAi && input.webSearch
  const url = `${input.settings.baseUrl}/${useResponses ? 'responses' : 'chat/completions'}`
  const body = useResponses
    ? { model: input.settings.model, tools: [{ type: 'web_search_preview' }], input: input.messages }
    : {
        model: input.settings.model,
        temperature: input.settings.temperature,
        messages: input.messages,
        ...(input.webSearch && input.settings.provider === 'openrouter' ? { plugins: [{ id: 'web', max_results: 12 }] } : {}),
        ...(input.webSearch && input.settings.provider !== 'openrouter' ? { web_search_options: { search_context_size: 'medium' } } : {})
      }
  let response: Response
  try {
    response = await fetchImpl(url, { method: 'POST', headers: buildAiRequestHeaders(input.settings), body: JSON.stringify(body) })
  } catch (error) {
    throw createAiNetworkError(error)
  }
  if (!response.ok) throw await createAiRequestError(response)
  const payload = await response.json() as {
    output_text?: string
    choices?: Array<{ message?: { content?: string } }>
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
  }
  return payload.output_text ?? payload.choices?.[0]?.message?.content ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text ?? ''
}

export async function inspectAiRuntime(settings: AiSettings, verify = false): Promise<AiRuntimeStatus> {
  const checkedAt = new Date().toISOString()
  if (!isLocalAiProvider(settings.provider)) {
    if (!verify) return { provider: settings.provider, configured: isAiSettingsConfigured(settings), available: true, usable: null, label: settings.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI-compatible', command: '', version: '', message: '已保存配置，尚未验证连接', checkedAt }
    try {
      await requestAiText({ settings, messages: [{ role: 'user', content: 'Reply with exactly: OK' }] })
      return { provider: settings.provider, configured: true, available: true, usable: true, label: settings.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI-compatible', command: '', version: '', message: '连接正常，模型可用', checkedAt }
    } catch (error) {
      return { provider: settings.provider, configured: isAiSettingsConfigured(settings), available: true, usable: false, label: settings.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI-compatible', command: '', version: '', message: error instanceof Error ? error.message : String(error), checkedAt }
    }
  }

  const localProvider = settings.provider as 'codex-cli' | 'cursor-cli'
  const command = await findLocalCommand(localProvider)
  const label = localProvider === 'codex-cli' ? 'Codex CLI' : 'Cursor CLI'
  if (!command) return { provider: localProvider, configured: isAiSettingsConfigured(settings), available: false, usable: false, label, command: '', version: '', message: `未检测到 ${label}`, checkedAt }
  let version = ''
  try {
    version = (await execFileAsync(command, ['--version'], { timeout: 5_000 })).stdout.trim().split('\n').pop() || ''
  } catch {
    // The executable is still present; verification below will report auth/runtime errors.
  }
  if (!verify) return { provider: localProvider, configured: isAiSettingsConfigured(settings), available: true, usable: null, label, command, version, message: '已检测到本地 CLI，尚未验证登录状态', checkedAt }
  try {
    await requestAiText({ settings: { ...settings, enabled: true }, messages: [{ role: 'user', content: 'Reply with exactly: OK' }] })
    return { provider: localProvider, configured: true, available: true, usable: true, label, command, version, message: '本地 CLI 已登录且可用', checkedAt }
  } catch (error) {
    return { provider: localProvider, configured: true, available: true, usable: false, label, command, version, message: error instanceof Error ? error.message : String(error), checkedAt }
  }
}
