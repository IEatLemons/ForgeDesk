import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getActiveCodexAccountInfo, resolveCodexHome, type CodexAccountInfo } from './codex-accounts.js'
import { requestAiText } from './ai-runtime.js'

const defaultPort = 55914
const defaultModel = 'gpt-5.3-codex'
const maxRequestBytes = 32 * 1024 * 1024

export type CodexApiServiceSettings = {
  enabled: boolean
  port: number
  apiKey: string
  model: string
  updatedAt: string
}

export type CodexApiServiceView = {
  enabled: boolean
  running: boolean
  host: '127.0.0.1'
  port: number
  baseUrl: string
  apiKeyMasked: string
  apiKeyConfigured: boolean
  model: string
  account: CodexAccountInfo
  message: string
}

export type CodexApiServiceIntegrationSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

type JsonObject = Record<string, unknown>
type CodexMessage = { role: 'system' | 'user' | 'assistant'; content: string }

let activeServer: Server | null = null
let activePort = 0
let activeUserDataPath = ''

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asPort(value: unknown): number {
  const port = Number(value)
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : defaultPort
}

function getSettingsPath(userDataPath: string): string {
  return join(userDataPath, 'codex-api-service.json')
}

export function createCodexApiKey(randomBytesImpl: (size: number) => Buffer = randomBytes): string {
  return `agt_codex_${randomBytesImpl(20).toString('base64url')}`
}

export function normalizeCodexApiServiceSettings(input: Partial<CodexApiServiceSettings> = {}): CodexApiServiceSettings {
  return {
    enabled: Boolean(input.enabled),
    port: asPort(input.port ?? defaultPort),
    apiKey: asString(input.apiKey) || createCodexApiKey(),
    model: asString(input.model) || defaultModel,
    updatedAt: asString(input.updatedAt) || new Date().toISOString()
  }
}

export function maskCodexApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 12) return `${apiKey.slice(0, 4)}••••`
  return `${apiKey.slice(0, 12)}••••••••••••`
}

export function toCodexMessages(value: unknown): CodexMessage[] {
  if (typeof value === 'string' && value.trim()) return [{ role: 'user', content: value.trim() }]
  if (!Array.isArray(value)) return []

  return value.flatMap((item): CodexMessage[] => {
    const object = asObject(item)
    const role = object.role === 'system' || object.role === 'assistant' ? object.role : 'user'
    const content = typeof object.content === 'string'
      ? object.content
      : Array.isArray(object.content)
        ? object.content.map((part) => asString(asObject(part).text || asObject(part).input_text || asObject(part).output_text)).filter(Boolean).join('\n')
        : ''
    return content.trim() ? [{ role, content: content.trim() }] : []
  })
}

async function readSettings(userDataPath: string): Promise<CodexApiServiceSettings> {
  try {
    return normalizeCodexApiServiceSettings(JSON.parse(await readFile(getSettingsPath(userDataPath), 'utf8')) as Partial<CodexApiServiceSettings>)
  } catch {
    return normalizeCodexApiServiceSettings()
  }
}

async function writeSettings(userDataPath: string, settings: CodexApiServiceSettings): Promise<void> {
  await mkdir(userDataPath, { recursive: true })
  await writeFile(getSettingsPath(userDataPath), `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
}

function buildView(settings: CodexApiServiceSettings, account: CodexAccountInfo): CodexApiServiceView {
  const running = Boolean(activeServer && activePort === settings.port)
  return {
    enabled: settings.enabled,
    running,
    host: '127.0.0.1',
    port: running ? activePort : settings.port,
    baseUrl: `http://127.0.0.1:${running ? activePort : settings.port}/v1`,
    apiKeyMasked: maskCodexApiKey(settings.apiKey),
    apiKeyConfigured: Boolean(settings.apiKey),
    model: settings.model,
    account,
    message: running ? 'Codex API 服务正在运行，仅接受本机连接。' : settings.enabled ? 'Codex API 服务已配置，尚未启动。' : 'Codex API 服务未启用。'
  }
}

export async function getCodexApiServiceIntegrationSettings(userDataPath: string): Promise<CodexApiServiceIntegrationSettings> {
  const settings = await readSettings(userDataPath)
  const port = activeServer && activeUserDataPath === userDataPath && activePort ? activePort : settings.port
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    apiKey: settings.apiKey,
    model: settings.model
  }
}

async function readRequestBody(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxRequestBytes) throw new Error('请求体过大，最大支持 32 MB')
    chunks.push(buffer)
  }
  if (size === 0) return {}
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  return asObject(parsed)
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  })
  response.end(body)
}

function sendError(response: ServerResponse, statusCode: number, message: string, type = 'invalid_request_error'): void {
  sendJson(response, statusCode, { error: { message, type } })
}

function isAuthorized(request: IncomingMessage, apiKey: string): boolean {
  const authorization = asString(request.headers.authorization)
  return authorization === `Bearer ${apiKey}`
}

function writeStreamResponse(response: ServerResponse, model: string, content: string): void {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  })
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const chunks = [
    { id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
    { id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { content }, finish_reason: null }] },
    { id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
  ]
  for (const chunk of chunks) response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  response.end('data: [DONE]\n\n')
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, settings: CodexApiServiceSettings, userDataPath: string): Promise<void> {
  const method = request.method || 'GET'
  const url = new URL(request.url || '/', 'http://127.0.0.1')
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-headers', 'Authorization, Content-Type')
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')

  if (method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }
  if (url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok', service: 'forgedesk-codex-api' })
    return
  }
  if (!isAuthorized(request, settings.apiKey)) {
    sendError(response, 401, '无效的 Codex API Key', 'authentication_error')
    return
  }
  if (method === 'GET' && url.pathname === '/v1/models') {
    sendJson(response, 200, {
      object: 'list',
      data: [{ id: settings.model, object: 'model', created: 0, owned_by: 'openai-codex' }]
    })
    return
  }
  if (method !== 'POST' || (url.pathname !== '/v1/chat/completions' && url.pathname !== '/v1/responses')) {
    sendError(response, 404, '未找到 Codex API 路径')
    return
  }

  let body: JsonObject
  try {
    body = await readRequestBody(request)
  } catch (error) {
    sendError(response, 400, error instanceof Error ? error.message : '请求 JSON 无效')
    return
  }

  const messages = toCodexMessages(body.messages ?? body.input)
  if (messages.length === 0) {
    sendError(response, 400, '请求缺少 messages 或 input')
    return
  }

  const model = asString(body.model) || settings.model
  let content: string
  try {
    const codexHome = await resolveCodexHome(userDataPath)
    content = await requestAiText({
      settings: {
        enabled: true,
        provider: 'codex-cli',
        baseUrl: '',
        apiKey: '',
        model,
        temperature: 0.2
      },
      messages,
      localEnvironment: { ...process.env, CODEX_HOME: codexHome }
    })
  } catch (error) {
    sendError(response, 502, error instanceof Error ? error.message : String(error), 'upstream_error')
    return
  }

  if (body.stream === true && url.pathname === '/v1/chat/completions') {
    writeStreamResponse(response, model, content)
    return
  }

  if (url.pathname === '/v1/responses') {
    sendJson(response, 200, {
      id: `resp_${randomUUID()}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      model,
      output_text: content,
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: content }] }]
    })
    return
  }

  sendJson(response, 200, {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }]
  })
}

export async function getCodexApiService(userDataPath: string): Promise<CodexApiServiceView> {
  const settings = await readSettings(userDataPath)
  return buildView(settings, await getActiveCodexAccountInfo(userDataPath))
}

export async function startCodexApiService(userDataPath: string, input: Partial<CodexApiServiceSettings> = {}): Promise<CodexApiServiceView> {
  const current = await readSettings(userDataPath)
  const settings = normalizeCodexApiServiceSettings({ ...current, ...input, enabled: true })

  if (activeServer && activeUserDataPath === userDataPath && activePort === settings.port && (!input.apiKey || input.apiKey === current.apiKey) && (!input.model || input.model === current.model)) {
    await writeSettings(userDataPath, settings)
    return buildView(settings, await getActiveCodexAccountInfo(userDataPath))
  }
  if (activeServer) await stopCodexApiService()

  const server = createServer((request, response) => {
    void handleRequest(request, response, settings, userDataPath).catch((error) => {
      if (!response.headersSent) sendError(response, 500, error instanceof Error ? error.message : String(error))
      else response.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening)
      reject(new Error(`Codex API 服务启动失败：${error.message}`))
    }
    const onListening = (): void => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(settings.port, '127.0.0.1')
  })

  const address = server.address()
  activeServer = server
  activePort = typeof address === 'object' && address ? address.port : settings.port
  activeUserDataPath = userDataPath
  const saved = { ...settings, port: activePort, enabled: true, updatedAt: new Date().toISOString() }
  await writeSettings(userDataPath, saved)
  return buildView(saved, await getActiveCodexAccountInfo(userDataPath))
}

export async function stopCodexApiService(userDataPath?: string, disable = true): Promise<CodexApiServiceView> {
  const path = userDataPath || activeUserDataPath
  const settings = await readSettings(path)
  if (activeServer) {
    const server = activeServer
    activeServer = null
    activePort = 0
    activeUserDataPath = ''
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  const saved = { ...settings, enabled: disable ? false : settings.enabled, updatedAt: new Date().toISOString() }
  if (path) await writeSettings(path, saved)
  return buildView(saved, await getActiveCodexAccountInfo(path))
}

export async function rotateCodexApiKey(userDataPath: string): Promise<CodexApiServiceView> {
  const settings = await readSettings(userDataPath)
  const next = { ...settings, apiKey: createCodexApiKey(), updatedAt: new Date().toISOString() }
  if (activeServer && activeUserDataPath === userDataPath) {
    await stopCodexApiService(userDataPath)
  }
  await writeSettings(userDataPath, next)
  if (next.enabled) await startCodexApiService(userDataPath, next)
  return buildView(next, await getActiveCodexAccountInfo(userDataPath))
}
