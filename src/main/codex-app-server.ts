import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

type JsonObject = Record<string, unknown>

export type CodexAppServerErrorCode = 'not-installed' | 'timeout' | 'unauthorized' | 'protocol' | 'process' | 'unavailable'

export class CodexAppServerError extends Error {
  readonly code: CodexAppServerErrorCode

  constructor(code: CodexAppServerErrorCode, message: string) {
    super(message)
    this.name = 'CodexAppServerError'
    this.code = code
  }
}

export type CodexAppServerWindow = {
  usedPercent: number | null
  windowDurationMins: number | null
  resetsAt: number | null
}

export type CodexAppServerRateLimits = {
  limitId: string
  limitName: string
  primary: CodexAppServerWindow | null
  secondary: CodexAppServerWindow | null
  credits: {
    hasCredits: boolean | null
    unlimited: boolean | null
    balance: string | null
  } | null
  individualLimit: {
    limit: string
    used: string
    remainingPercent: number | null
    resetsAt: number | null
  } | null
  spendControlReached: boolean | null
  planType: string
  rateLimitReachedType: string
  resetCredits: {
    availableCount: number | null
    credits: Array<{
      id: string
      resetType: string
      status: string
      grantedAt: number | null
      expiresAt: number | null
      title: string
      description: string
    }> | null
  } | null
}

export type CodexAppServerUsage = {
  summary: {
    lifetimeTokens: string | null
    peakDailyTokens: string | null
    longestRunningTurnSec: string | null
    currentStreakDays: string | null
    longestStreakDays: string | null
  } | null
  dailyUsageBuckets: Array<{ startDate: string; tokens: string }> | null
}

export type CodexAppServerSnapshot = {
  account: {
    type: string
    email: string
    planType: string
    requiresOpenaiAuth: boolean
  }
  rateLimits: CodexAppServerRateLimits | null
  rateLimitsByLimitId: Record<string, CodexAppServerRateLimits> | null
  usage: CodexAppServerUsage | null
  checkedAt: string
}

type JsonRpcResponse = {
  id?: number | string
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
  method?: string
  params?: unknown
}

export type CodexAppServerThread = {
  id: string
  name: string
  cwd: string
  status: string
  updatedAt: string
}

export type CodexAppServerTurn = {
  id: string
  status: string
}

export type CodexAppServerNotification = {
  method: string
  params: unknown
}

type PendingRequest = {
  resolve: (response: JsonRpcResponse) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export type CodexAppServerSpawnProcess = (command: string, args: string[], options: {
  cwd?: string
  env?: NodeJS.ProcessEnv
  stdio: ['pipe', 'pipe', 'pipe']
}) => ChildProcessWithoutNullStreams

const defaultTimeoutMs = 12_000

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function asIntegerString(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  return null
}

function normalizeWindow(value: unknown): CodexAppServerWindow | null {
  const object = asObject(value)
  if (!Object.keys(object).length) return null
  return {
    usedPercent: asNumber(object.usedPercent),
    windowDurationMins: asNumber(object.windowDurationMins),
    resetsAt: asNumber(object.resetsAt)
  }
}

function normalizeRateLimits(value: unknown): CodexAppServerRateLimits | null {
  const object = asObject(value)
  if (!Object.keys(object).length) return null

  const creditsObject = asObject(object.credits)
  const individualObject = asObject(object.individualLimit)
  const resetCreditsObject = asObject(object.rateLimitResetCredits)
  const creditRows = Array.isArray(resetCreditsObject.credits)
    ? resetCreditsObject.credits.map((item) => {
      const credit = asObject(item)
      return {
        id: asString(credit.id),
        resetType: asString(credit.resetType),
        status: asString(credit.status),
        grantedAt: asNumber(credit.grantedAt),
        expiresAt: asNumber(credit.expiresAt),
        title: asString(credit.title),
        description: asString(credit.description)
      }
    }).filter((item) => item.id)
    : null

  return {
    limitId: asString(object.limitId),
    limitName: asString(object.limitName),
    primary: normalizeWindow(object.primary),
    secondary: normalizeWindow(object.secondary),
    credits: Object.keys(creditsObject).length
      ? {
        hasCredits: asBoolean(creditsObject.hasCredits),
        unlimited: asBoolean(creditsObject.unlimited),
        balance: asString(creditsObject.balance) || null
      }
      : null,
    individualLimit: Object.keys(individualObject).length
      ? {
        limit: asString(individualObject.limit),
        used: asString(individualObject.used),
        remainingPercent: asNumber(individualObject.remainingPercent),
        resetsAt: asNumber(individualObject.resetsAt)
      }
      : null,
    spendControlReached: asBoolean(object.spendControlReached),
    planType: asString(object.planType),
    rateLimitReachedType: asString(object.rateLimitReachedType),
    resetCredits: Object.keys(resetCreditsObject).length
      ? {
        availableCount: asNumber(resetCreditsObject.availableCount),
        credits: creditRows
      }
      : null
  }
}

function normalizeUsage(value: unknown): CodexAppServerUsage | null {
  const object = asObject(value)
  if (!Object.keys(object).length) return null
  const summary = asObject(object.summary)
  const buckets = Array.isArray(object.dailyUsageBuckets)
    ? object.dailyUsageBuckets.map((item) => {
      const bucket = asObject(item)
      return { startDate: asString(bucket.startDate), tokens: asIntegerString(bucket.tokens) || '0' }
    }).filter((item) => item.startDate)
    : null
  return {
    summary: Object.keys(summary).length
      ? {
        lifetimeTokens: asIntegerString(summary.lifetimeTokens),
        peakDailyTokens: asIntegerString(summary.peakDailyTokens),
        longestRunningTurnSec: asIntegerString(summary.longestRunningTurnSec),
        currentStreakDays: asIntegerString(summary.currentStreakDays),
        longestStreakDays: asIntegerString(summary.longestStreakDays)
      }
      : null,
    dailyUsageBuckets: buckets
  }
}

function accountFromResponse(value: unknown, requiresOpenaiAuth: unknown): CodexAppServerSnapshot['account'] {
  const object = asObject(value)
  return {
    type: asString(object.type),
    email: asString(object.email),
    planType: asString(object.planType),
    requiresOpenaiAuth: Boolean(requiresOpenaiAuth)
  }
}

function sanitizeRpcError(error: JsonRpcResponse['error']): CodexAppServerError {
  const message = asString(error?.message) || 'Codex App Server 返回了未知错误'
  const unauthorized = /unauthori[sz]ed|auth|login|token|credential|reauth/i.test(message)
  return new CodexAppServerError(unauthorized ? 'unauthorized' : 'protocol', message)
}

export class CodexAppServerClient {
  private readonly process: ChildProcessWithoutNullStreams
  private readonly pending = new Map<string, PendingRequest>()
  private nextId = 1
  private buffer = ''
  private disposed = false

  constructor(process: ChildProcessWithoutNullStreams, private readonly onNotification?: (notification: CodexAppServerNotification) => void) {
    this.process = process
    this.process.stdout.setEncoding('utf8')
    this.process.stdout.on('data', (chunk: string) => this.handleData(chunk))
    this.process.on('error', (error) => this.failAll(new CodexAppServerError('process', error.message)))
    this.process.on('exit', (code, signal) => {
      if (!this.disposed) this.failAll(new CodexAppServerError('process', `Codex App Server 已退出（${signal || code || '未知原因'}）`))
    })
  }

  private handleData(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      let message: JsonRpcResponse
      try {
        message = JSON.parse(line) as JsonRpcResponse
      } catch {
        this.failAll(new CodexAppServerError('protocol', 'Codex App Server 返回了无效 JSON'))
        continue
      }
      if (message.id === undefined || message.id === null) {
        if (message.method) this.onNotification?.({ method: message.method, params: message.params })
        continue
      }
      const request = this.pending.get(String(message.id))
      if (!request) continue
      this.pending.delete(String(message.id))
      clearTimeout(request.timer)
      if (message.error) request.reject(sanitizeRpcError(message.error))
      else request.resolve(message)
    }
  }

  private failAll(error: Error): void {
    for (const [id, request] of this.pending) {
      clearTimeout(request.timer)
      request.reject(error)
      this.pending.delete(id)
    }
  }

  async request(method: string, params?: unknown, timeoutMs = defaultTimeoutMs): Promise<unknown> {
    if (this.disposed) throw new CodexAppServerError('process', 'Codex App Server 连接已关闭')
    const id = this.nextId++
    // Codex App Server speaks JSON-RPC 2.0 over JSONL, but intentionally omits
    // the `jsonrpc` member on the wire. Newer Codex builds reject frames that
    // include the standard JSON-RPC header even though the payload is otherwise
    // valid JSON-RPC.
    const message = JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) })
    const response = new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(id))
        reject(new CodexAppServerError('timeout', `Codex App Server 请求超时：${method}`))
      }, timeoutMs)
      this.pending.set(String(id), { resolve, reject, timer })
    })
    this.process.stdin.write(`${message}\n`)
    return (await response).result
  }

  notify(method: string, params?: unknown): void {
    if (this.disposed) return
    const message = JSON.stringify({ method, ...(params === undefined ? {} : { params }) })
    this.process.stdin.write(`${message}\n`)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.failAll(new CodexAppServerError('process', 'Codex App Server 连接已关闭'))
    if (!this.process.killed) this.process.kill()
  }
}

function threadFromResponse(value: unknown): CodexAppServerThread | null {
  const response = asObject(value)
  const thread = asObject(response.thread || value)
  const id = asString(thread.id)
  if (!id) return null
  const status = asObject(thread.status)
  return {
    id,
    name: asString(thread.name) || asString(thread.title) || asString(thread.preview),
    cwd: asString(thread.cwd),
    status: asString(status.type) || asString(thread.status) || 'idle',
    updatedAt: asString(thread.updatedAt) || new Date().toISOString()
  }
}

function turnFromResponse(value: unknown): CodexAppServerTurn | null {
  const turn = asObject(value)
  const id = asString(turn.id)
  if (!id) return null
  return { id, status: asString(turn.status) }
}

/**
 * A small persistent adapter for the local Codex App Server. It intentionally
 * exposes only the stable task-thread primitives ForgeDesk needs and keeps
 * the experimental JSON-RPC wire format out of renderer code.
 */
export class CodexAppServerThreadService {
  private client: CodexAppServerClient | null = null

  constructor(private readonly input: {
    command: string
    codexHome: string
    onNotification?: (notification: CodexAppServerNotification) => void
    spawnProcess?: CodexAppServerSpawnProcess
  }) {}

  async startThread(input: { cwd: string; title: string; model?: string; sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access' }): Promise<CodexAppServerThread> {
    const result = await this.request('thread/start', { cwd: input.cwd, model: input.model || null, sandbox: input.sandbox || 'workspace-write' })
    const thread = threadFromResponse(result)
    if (!thread) throw new CodexAppServerError('protocol', 'Codex App Server 未返回线程 ID')
    await this.renameThread(thread.id, input.title)
    return { ...thread, name: input.title }
  }

  async startTurn(input: { threadId: string; text: string; cwd?: string; outputSchema?: unknown; approvalPolicy?: 'untrusted' | 'on-request' | 'never' }): Promise<string> {
    const result = await this.request('turn/start', {
      threadId: input.threadId,
      cwd: input.cwd || null,
      input: [{ type: 'text', text: input.text }],
      outputSchema: input.outputSchema || null,
      approvalPolicy: input.approvalPolicy || 'on-request'
    })
    return asString(asObject(asObject(result).turn).id) || asString(asObject(result).id)
  }

  async listThreads(cwd?: string): Promise<CodexAppServerThread[]> {
    const result = asObject(await this.request('thread/list', { cwd: cwd || null, archived: false, sortKey: 'updated_at', sortDirection: 'desc' }))
    const threads = Array.isArray(result.data) ? result.data : Array.isArray(result.threads) ? result.threads : []
    return threads.map(threadFromResponse).filter((thread): thread is CodexAppServerThread => Boolean(thread))
  }

  async listTurns(threadId: string): Promise<CodexAppServerTurn[]> {
    const result = asObject(await this.request('thread/turns/list', { threadId, limit: 100, sortDirection: 'desc', itemsView: 'notLoaded' }))
    const turns = Array.isArray(result.data) ? result.data : Array.isArray(result.turns) ? result.turns : []
    return turns.map(turnFromResponse).filter((turn): turn is CodexAppServerTurn => Boolean(turn))
  }

  async interruptRunningTurns(threadId: string): Promise<number> {
    const turns = await this.listTurns(threadId)
    const runningTurns = turns.filter((turn) => turn.status === 'inProgress' || turn.status === 'running')
    for (const turn of runningTurns) await this.request('turn/interrupt', { threadId, turnId: turn.id })
    return runningTurns.length
  }

  async renameThread(threadId: string, title: string): Promise<void> {
    await this.request('thread/name/set', { threadId, name: title })
  }

  async dispose(): Promise<void> {
    this.client?.dispose()
    this.client = null
  }

  private async request(method: string, params?: unknown): Promise<unknown> {
    const client = await this.ready()
    return client.request(method, params)
  }

  private async ready(): Promise<CodexAppServerClient> {
    if (this.client) return this.client
    if (!this.input.command) throw new CodexAppServerError('not-installed', '未检测到可用的 Codex App Server 命令')
    const spawnImpl = this.input.spawnProcess || defaultSpawnProcess
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawnImpl(this.input.command, ['app-server', '--stdio'], {
        cwd: this.input.codexHome,
        env: { ...process.env, CODEX_HOME: this.input.codexHome, NO_COLOR: '1', RUST_LOG: 'off' },
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (error) {
      throw new CodexAppServerError('process', error instanceof Error ? error.message : String(error))
    }
    const client = new CodexAppServerClient(child, this.input.onNotification)
    try {
      await client.request('initialize', { clientInfo: { name: 'forgedesk', title: 'ForgeDesk', version: '1.1.1' }, capabilities: { experimentalApi: true } })
      client.notify('initialized', {})
      this.client = client
      return client
    } catch (error) {
      client.dispose()
      throw error
    }
  }
}

function defaultSpawnProcess(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; stdio: ['pipe', 'pipe', 'pipe'] }): ChildProcessWithoutNullStreams {
  return spawn(command, args, options)
}

export function normalizeCodexAppServerRateLimits(value: unknown): CodexAppServerRateLimits | null {
  return normalizeRateLimits(value)
}

export function normalizeCodexAppServerUsage(value: unknown): CodexAppServerUsage | null {
  return normalizeUsage(value)
}

export async function readCodexAppServerSnapshot(input: {
  command: string
  codexHome: string
  refreshToken?: boolean
  timeoutMs?: number
  spawnProcess?: CodexAppServerSpawnProcess
}): Promise<CodexAppServerSnapshot> {
  if (!input.command) throw new CodexAppServerError('not-installed', '未检测到可用的 Codex App Server 命令')
  const spawnImpl: CodexAppServerSpawnProcess = input.spawnProcess || defaultSpawnProcess
  let child: ChildProcessWithoutNullStreams
  try {
    child = spawnImpl(input.command, ['app-server', '--stdio'], {
      cwd: input.codexHome,
      env: { ...process.env, CODEX_HOME: input.codexHome, NO_COLOR: '1', RUST_LOG: 'off' },
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch (error) {
    throw new CodexAppServerError('process', error instanceof Error ? error.message : String(error))
  }

  const client = new CodexAppServerClient(child)
  const timeoutMs = input.timeoutMs || defaultTimeoutMs
  try {
    await client.request('initialize', {
      clientInfo: { name: 'forgedesk', title: 'ForgeDesk', version: '1.1.1' },
      capabilities: { experimentalApi: true }
    }, timeoutMs)
    client.notify('initialized', {})

    const accountResponse = asObject(await client.request('account/read', { refreshToken: Boolean(input.refreshToken) }, timeoutMs))
    let rateLimits: CodexAppServerRateLimits | null = null
    let rateLimitsByLimitId: Record<string, CodexAppServerRateLimits> | null = null
    let usage: CodexAppServerUsage | null = null
    let lastOptionalError: CodexAppServerError | null = null

    try {
      const response = await client.request('account/rateLimits/read', undefined, timeoutMs)
      const responseObject = asObject(response)
      const byLimitId = asObject(responseObject.rateLimitsByLimitId)
      const normalizedByLimitId = Object.fromEntries(Object.entries(byLimitId).flatMap(([id, value]) => {
        const normalized = normalizeRateLimits(value)
        return normalized ? [[id, normalized]] : []
      }))
      rateLimitsByLimitId = Object.keys(normalizedByLimitId).length ? normalizedByLimitId : null
      rateLimits = normalizeRateLimits(responseObject.rateLimits)
      if (rateLimitsByLimitId?.codex) rateLimits = rateLimitsByLimitId.codex
      if (rateLimits) {
        const resetCredits = asObject(responseObject.rateLimitResetCredits)
        const normalized = normalizeRateLimits({ ...rateLimits, rateLimitResetCredits: resetCredits })
        rateLimits = normalized || rateLimits
        if (rateLimitsByLimitId?.codex) rateLimitsByLimitId.codex = rateLimits
      }
    } catch (error) {
      lastOptionalError = error instanceof CodexAppServerError ? error : new CodexAppServerError('protocol', String(error))
    }

    try {
      usage = normalizeUsage(await client.request('account/usage/read', undefined, timeoutMs))
    } catch (error) {
      lastOptionalError = error instanceof CodexAppServerError ? error : new CodexAppServerError('protocol', String(error))
    }

    if (lastOptionalError && !rateLimits && !usage && lastOptionalError.code === 'unauthorized') throw lastOptionalError
    const account = accountFromResponse(accountResponse.account, accountResponse.requiresOpenaiAuth)
    if (rateLimits && !rateLimits.planType) rateLimits.planType = account.planType
    return { account, rateLimits, rateLimitsByLimitId, usage, checkedAt: new Date().toISOString() }
  } finally {
    client.dispose()
  }
}
