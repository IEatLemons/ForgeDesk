import { execFile } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'
import { createAiNetworkError, createAiRequestError } from './ai-errors.js'
import { buildAiRequestHeaders, isAiSettingsConfigured, isLocalAiProvider, type AiProvider, type AiSettings } from './ai-settings.js'

const execFileAsync = promisify(execFile)
type LocalAiProvider = 'codex-cli' | 'cursor-cli'
type ExecFileText = (file: string, args: string[], options: { timeout?: number }) => Promise<{ stdout: string; stderr: string }>

type LocalCommandLookupOptions = {
  env?: NodeJS.ProcessEnv
  executableExists?: (command: string, env?: NodeJS.ProcessEnv) => Promise<boolean>
}

type AiRuntimeInspectionOptions = LocalCommandLookupOptions & {
  execFileText?: ExecFileText
  fetchImpl?: typeof fetch
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
type ProcessFailure = Error & {
  stderr?: string | Buffer
  stdout?: string | Buffer
  code?: string | number
}

function outputText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Buffer.isBuffer(value)) return value.toString('utf8').trim()
  return ''
}

export function formatLocalAiFailure(error: unknown): string {
  const processFailure = error && typeof error === 'object' ? error as ProcessFailure : null
  const output = [outputText(processFailure?.stderr), outputText(processFailure?.stdout)].filter(Boolean).join('\n')
  const rawDetail = output || (error instanceof Error ? error.message : String(error))
  const detail = rawDetail.replace(/\s+/g, ' ').trim()

  if (/readonly database|read-only database|operation not permitted|permission denied/i.test(detail)) {
    return `Codex CLI 无法写入本机状态目录：${detail}。请检查 ChatGPT/ForgeDesk 的磁盘访问权限后重启应用。`
  }

  if (/^Command failed:/i.test(detail)) {
    const code = processFailure?.code === undefined ? '' : `（退出码 ${processFailure.code}）`
    return `Codex CLI 执行失败${code}，没有返回具体错误信息。`
  }

  return detail || 'Codex CLI 执行失败，未返回错误信息。'
}

export function getLocalProviderCommandCandidates(provider: LocalAiProvider, env: NodeJS.ProcessEnv = process.env): string[] {
  if (provider === 'codex-cli') {
    return ['codex', '/Applications/ChatGPT.app/Contents/Resources/codex']
  }

  return ['cursor-agent', 'agent', join(env.HOME || '', '.local/bin/cursor-agent')]
}

async function executableExists(command: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (command.includes('/')) {
    try {
      await access(command)
      return true
    } catch {
      return false
    }
  }

  for (const directory of (env.PATH || '').split(delimiter).filter(Boolean)) {
    try {
      await access(join(directory, command))
      return true
    } catch {
      // Continue searching PATH.
    }
  }
  return false
}

export async function findLocalAiCommand(provider: LocalAiProvider, options: LocalCommandLookupOptions = {}): Promise<string> {
  const exists = options.executableExists ?? executableExists
  const env = options.env ?? process.env

  for (const command of getLocalProviderCommandCandidates(provider, env)) {
    if (command && await exists(command, env)) return command
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

async function runLocalAi(settings: AiSettings, messages: AiMessage[], localEnvironment?: NodeJS.ProcessEnv): Promise<string> {
  const provider = settings.provider as LocalAiProvider
  const command = await findLocalAiCommand(provider, { env: localEnvironment })
  if (!command) throw new Error(provider === 'codex-cli' ? '未检测到 AI 编程助手运行环境，请先安装或打开 ChatGPT 桌面应用。' : '未检测到 Cursor Agent CLI，请先安装 cursor-agent。')

  const prompt = promptFromMessages(messages)
  const args = provider === 'codex-cli'
    // The working directory is disposable, so workspace-write keeps the model isolated
    // while allowing Codex CLI to initialize its own runtime state.
    ? ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--color', 'never', ...(settings.model ? ['--model', settings.model] : []), prompt]
    : ['--print', '--output-format', 'json', ...(settings.model ? ['--model', settings.model] : []), prompt]

  const isolatedDirectory = await mkdtemp(join(tmpdir(), 'forgedesk-local-ai-'))
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: isolatedDirectory,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...localEnvironment, NO_COLOR: '1' }
    })
    if (provider === 'cursor-cli') {
      const payload = JSON.parse(stdout) as { result?: string }
      if (payload.result?.trim()) return payload.result.trim()
    }
    if (stdout.trim()) return stdout.trim()
    throw new Error('本地 AI 没有返回内容')
  } catch (error) {
    throw new Error(`本地 AI 调用失败：${formatLocalAiFailure(error)}`)
  } finally {
    await rm(isolatedDirectory, { recursive: true, force: true })
  }
}

export async function requestAiText(input: {
  settings: AiSettings
  messages: AiMessage[]
  fetchImpl?: typeof fetch
  webSearch?: boolean
  localEnvironment?: NodeJS.ProcessEnv
}): Promise<string> {
  if (!isAiSettingsConfigured(input.settings)) {
    throw new Error(isLocalAiProvider(input.settings.provider) ? '请先启用本地 AI' : '请先在公共设置里启用 AI 并填写 API Key')
  }
  if (isLocalAiProvider(input.settings.provider)) return runLocalAi(input.settings, input.messages, input.localEnvironment)

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
    if (input.settings.provider === 'codex-local-api') {
      throw new Error(`本地 Codex API 服务未运行，请先点击“创建并接入 ForgeDesk”。服务地址：${input.settings.baseUrl}`)
    }
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
  return inspectAiRuntimeWithOptions(settings, verify)
}

export async function inspectCodexRuntime(verify = false, codexHome?: string): Promise<AiRuntimeStatus> {
  return inspectAiRuntimeWithOptions({
    apiKey: '',
    baseUrl: '',
    enabled: true,
    model: '',
    provider: 'codex-cli',
    temperature: 0.2
  }, verify, codexHome ? { env: { ...process.env, CODEX_HOME: codexHome } } : {})
}

export async function inspectAiRuntimeWithOptions(
  settings: AiSettings,
  verify = false,
  options: AiRuntimeInspectionOptions = {}
): Promise<AiRuntimeStatus> {
  const checkedAt = new Date().toISOString()
  if (!isLocalAiProvider(settings.provider)) {
    if (!verify) return { provider: settings.provider, configured: isAiSettingsConfigured(settings), available: true, usable: null, label: settings.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI-compatible', command: '', version: '', message: '已保存配置，尚未验证连接', checkedAt }
    try {
      await requestAiText({ settings, fetchImpl: options.fetchImpl, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], localEnvironment: options.env })
      return { provider: settings.provider, configured: true, available: true, usable: true, label: settings.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI-compatible', command: '', version: '', message: '连接正常，模型可用', checkedAt }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { provider: settings.provider, configured: isAiSettingsConfigured(settings), available: settings.provider === 'codex-local-api' ? !message.includes('本地 Codex API 服务未运行') : true, usable: false, label: settings.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI-compatible', command: '', version: '', message, checkedAt }
    }
  }

  const localProvider = settings.provider as LocalAiProvider
  const command = await findLocalAiCommand(localProvider, options)
  const label = localProvider === 'codex-cli' ? 'AI 编程助手' : 'Cursor CLI'
  if (!command) return { provider: localProvider, configured: isAiSettingsConfigured(settings), available: false, usable: false, label, command: '', version: '', message: `未检测到 ${label}`, checkedAt }
  let version = ''
  try {
    version = (await (options.execFileText ?? execFileAsync)(command, ['--version'], { timeout: 5_000 })).stdout.trim().split('\n').pop() || ''
  } catch {
    // The executable is still present; verification below will report auth/runtime errors.
  }
  if (!verify) return { provider: localProvider, configured: isAiSettingsConfigured(settings), available: true, usable: null, label, command, version, message: '已检测到本地 CLI，尚未验证登录状态', checkedAt }
  try {
    await requestAiText({ settings: { ...settings, enabled: true }, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], localEnvironment: options.env })
    return { provider: localProvider, configured: true, available: true, usable: true, label, command, version, message: '本地 CLI 已登录且可用', checkedAt }
  } catch (error) {
    return { provider: localProvider, configured: true, available: true, usable: false, label, command, version, message: error instanceof Error ? error.message : String(error), checkedAt }
  }
}
