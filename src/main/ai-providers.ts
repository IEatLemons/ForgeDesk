import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { access, mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { findLocalAiCommand } from './ai-runtime.js'
import { listCodexAccounts, type CodexAccountRegistryView, type CodexManagedAccount } from './codex-accounts.js'
import { CodexAppServerError, readCodexAppServerSnapshot, type CodexAppServerRateLimits, type CodexAppServerSnapshot, type CodexAppServerUsage } from './codex-app-server.js'

const execFileAsync = promisify(execFile)
const quotaCacheFileName = 'codex-quota-cache.json'
const maxSessionFiles = 80
const maxSessionTailBytes = 1024 * 1024
const cacheWriteQueues = new Map<string, Promise<void>>()

export const codexInstallUrl = 'https://openai.com/codex/'

export type AiProviderKey = 'codex'
export type QuotaSource = 'app-server' | 'session' | 'cache' | 'auth' | 'unavailable'
export type QuotaStatus = 'available' | 'stale' | 'unknown' | 'error' | 'reauth-required'

export type AiProviderRuntimeSnapshot = {
  id: AiProviderKey
  label: string
  installed: boolean
  authenticated: boolean
  command: string
  appPath: string
  version: string
  openMode: 'app' | 'cli' | 'none'
  installUrl: string
  message: string
  checkedAt: string
}

export type QuotaWindow = {
  label: 'primary' | 'secondary' | 'hourly' | 'weekly'
  used: number | null
  limit: number | null
  remaining: number | null
  usedPercent: number | null
  remainingPercent: number | null
  windowDurationMins: number | null
  resetsAt: number | null
  resetAt: string
  source: QuotaSource
}

export type QuotaCredits = {
  hasCredits: boolean | null
  unlimited: boolean | null
  balance: string | null
  availableCount: number | null
  credits: Array<{
    id: string
    resetType: string
    status: string
    grantedAt: string
    expiresAt: string
    title: string
    description: string
  }> | null
}

export type QuotaLimitBucket = {
  id: string
  name: string
  planType: string
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
  credits: QuotaCredits | null
  rateLimitReachedType: string
}

export type DailyUsageSnapshot = {
  summary: {
    lifetimeTokens: string | null
    peakDailyTokens: string | null
    longestRunningTurnSec: string | null
    currentStreakDays: string | null
    longestStreakDays: string | null
  } | null
  dailyUsageBuckets: Array<{ startDate: string; tokens: string }> | null
}

export type QuotaSnapshot = {
  providerId: AiProviderKey
  accountId: string
  email: string
  authMode: string
  requiresOpenaiAuth: boolean | null
  planType: string
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
  limitBuckets: QuotaLimitBucket[]
  hourly: QuotaWindow | null
  weekly: QuotaWindow | null
  credits: QuotaCredits | null
  monthlyLimit: {
    limit: string
    used: string
    remainingPercent: number | null
    resetsAt: string
  } | null
  rateLimitReachedType: string
  usage: DailyUsageSnapshot | null
  checkedAt: string
  source: QuotaSource
  status: QuotaStatus
  stale: boolean
  errorCode: string
  message: string
}

export type CodexAccountLiveSnapshot = {
  accountId: string
  email: string
  authMode: string
  planType: string
  quota: QuotaSnapshot
  usage: DailyUsageSnapshot | null
}

export type AiProviderAccountSnapshot = {
  account: CodexManagedAccount
  live: CodexAccountLiveSnapshot
}

export type InitializationProjectSummary = {
  id: string
  name: string
  workspacePath: string
}

export type InitializationSnapshot = {
  requiresProject: boolean
  projectCount: number
  currentProject: InitializationProjectSummary | null
  codex: AiProviderRuntimeSnapshot
}

export type AiProviderAdapter = {
  id: AiProviderKey
  label: string
  detect: (userDataPath: string, env?: NodeJS.ProcessEnv) => Promise<AiProviderRuntimeSnapshot>
  getAccounts: (userDataPath: string) => Promise<CodexAccountRegistryView>
  getQuota: (userDataPath: string, accountId?: string, options?: { refresh?: boolean }) => Promise<QuotaSnapshot>
  getAccountSnapshots: (userDataPath: string, options?: { refresh?: boolean }) => Promise<AiProviderAccountSnapshot[]>
}

type CodexQuotaCacheRecord = QuotaSnapshot & {
  providerId: AiProviderKey
  accountId: string
}

type SessionQuotaSnapshot = {
  rateLimits: CodexAppServerRateLimits
  planType: string
  checkedAt: string
}

function appCandidates(): string[] {
  if (process.platform !== 'darwin') return []
  return [
    '/Applications/Codex.app',
    '/Applications/ChatGPT.app',
    join(homedir(), 'Applications', 'Codex.app'),
    join(homedir(), 'Applications', 'ChatGPT.app')
  ]
}

async function isPathAvailable(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function quotaCachePath(userDataPath: string): string {
  return join(userDataPath, quotaCacheFileName)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function unixSecondsToIso(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  const date = new Date(value * 1000)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function normalizeUsage(value: DailyUsageSnapshot | null | undefined): DailyUsageSnapshot | null {
  if (!value) return null
  return {
    summary: value.summary ? {
      lifetimeTokens: value.summary.lifetimeTokens || null,
      peakDailyTokens: value.summary.peakDailyTokens || null,
      longestRunningTurnSec: value.summary.longestRunningTurnSec || null,
      currentStreakDays: value.summary.currentStreakDays || null,
      longestStreakDays: value.summary.longestStreakDays || null
    } : null,
    dailyUsageBuckets: value.dailyUsageBuckets?.map((bucket) => ({
      startDate: asString(bucket.startDate),
      tokens: String(bucket.tokens || '0')
    })).filter((bucket) => bucket.startDate) || null
  }
}

function mapAppServerUsage(value: CodexAppServerUsage | null): DailyUsageSnapshot | null {
  return normalizeUsage(value)
}

function mapWindow(value: { usedPercent: number | null; windowDurationMins: number | null; resetsAt: number | null } | null, label: QuotaWindow['label'], source: QuotaSource): QuotaWindow | null {
  if (!value) return null
  const usedPercent = value.usedPercent === null ? null : Math.min(100, Math.max(0, value.usedPercent))
  const remainingPercent = usedPercent === null ? null : Math.max(0, 100 - usedPercent)
  return {
    label,
    used: usedPercent,
    limit: usedPercent === null ? null : 100,
    remaining: remainingPercent,
    usedPercent,
    remainingPercent,
    windowDurationMins: value.windowDurationMins,
    resetsAt: value.resetsAt,
    resetAt: unixSecondsToIso(value.resetsAt),
    source
  }
}

function mapCredits(value: CodexAppServerRateLimits['credits'], resetCredits: CodexAppServerRateLimits['resetCredits']): QuotaCredits | null {
  if (!value && !resetCredits) return null
  return {
    hasCredits: value?.hasCredits ?? null,
    unlimited: value?.unlimited ?? null,
    balance: value?.balance ?? null,
    availableCount: resetCredits?.availableCount ?? null,
    credits: resetCredits?.credits?.map((credit) => ({
      id: credit.id,
      resetType: credit.resetType,
      status: credit.status,
      grantedAt: unixSecondsToIso(credit.grantedAt),
      expiresAt: unixSecondsToIso(credit.expiresAt),
      title: credit.title,
      description: credit.description
    })) ?? null
  }
}

function createQuotaSnapshot(input: {
  accountId: string
  email?: string
  authMode?: string
  requiresOpenaiAuth?: boolean | null
  planType?: string
  rateLimits?: CodexAppServerRateLimits | null
  rateLimitsByLimitId?: Record<string, CodexAppServerRateLimits> | null
  usage?: DailyUsageSnapshot | null
  source: QuotaSource
  status: QuotaStatus
  stale?: boolean
  errorCode?: string
  message: string
  checkedAt?: string
}): QuotaSnapshot {
  const rateLimits = input.rateLimits
  const primary = mapWindow(rateLimits?.primary ?? null, 'primary', input.source)
  const secondary = mapWindow(rateLimits?.secondary ?? null, 'secondary', input.source)
  const limitBuckets = Object.values(input.rateLimitsByLimitId || {}).map((bucket) => ({
    id: bucket.limitId,
    name: bucket.limitName,
    planType: bucket.planType,
    primary: mapWindow(bucket.primary, 'primary', input.source),
    secondary: mapWindow(bucket.secondary, 'secondary', input.source),
    credits: mapCredits(bucket.credits, bucket.resetCredits),
    rateLimitReachedType: bucket.rateLimitReachedType
  })).filter((bucket) => bucket.id || bucket.name)
  return {
    providerId: 'codex',
    accountId: input.accountId,
    email: input.email || '',
    authMode: input.authMode || '',
    requiresOpenaiAuth: input.requiresOpenaiAuth ?? null,
    planType: input.planType || rateLimits?.planType || '',
    primary,
    secondary,
    limitBuckets,
    // These are retained for old renderer consumers. New UI uses primary/secondary
    // because the official API exposes named windows rather than fixed Hourly/Weekly.
    hourly: null,
    weekly: null,
    credits: mapCredits(rateLimits?.credits ?? null, rateLimits?.resetCredits ?? null),
    monthlyLimit: rateLimits?.individualLimit ? {
      limit: rateLimits.individualLimit.limit,
      used: rateLimits.individualLimit.used,
      remainingPercent: rateLimits.individualLimit.remainingPercent,
      resetsAt: unixSecondsToIso(rateLimits.individualLimit.resetsAt)
    } : null,
    rateLimitReachedType: rateLimits?.rateLimitReachedType || '',
    usage: normalizeUsage(input.usage),
    checkedAt: input.checkedAt || new Date().toISOString(),
    source: input.source,
    status: input.status,
    stale: Boolean(input.stale),
    errorCode: input.errorCode || '',
    message: input.message
  }
}

function normalizeQuotaWindow(value: unknown, label: QuotaWindow['label'], source: QuotaSource): QuotaWindow | null {
  const object = asObject(value)
  if (!Object.keys(object).length) return null
  const usedPercent = asNumber(object.usedPercent ?? object.used)
  const remainingPercent = asNumber(object.remainingPercent ?? object.remaining) ?? (usedPercent === null ? null : 100 - usedPercent)
  const resetsAt = asNumber(object.resetsAt)
  return {
    label,
    used: asNumber(object.used) ?? usedPercent,
    limit: asNumber(object.limit) ?? (usedPercent === null ? null : 100),
    remaining: asNumber(object.remaining) ?? remainingPercent,
    usedPercent,
    remainingPercent,
    windowDurationMins: asNumber(object.windowDurationMins),
    resetsAt,
    resetAt: asString(object.resetAt) || unixSecondsToIso(resetsAt),
    source
  }
}

function normalizeCredits(value: unknown): QuotaCredits | null {
  const object = asObject(value)
  if (!Object.keys(object).length) return null
  const rows = Array.isArray(object.credits) ? object.credits.map((item) => {
    const credit = asObject(item)
    return {
      id: asString(credit.id),
      resetType: asString(credit.resetType),
      status: asString(credit.status),
      grantedAt: asString(credit.grantedAt),
      expiresAt: asString(credit.expiresAt),
      title: asString(credit.title),
      description: asString(credit.description)
    }
  }).filter((credit) => credit.id) : null
  return {
    hasCredits: asBoolean(object.hasCredits),
    unlimited: asBoolean(object.unlimited),
    balance: asString(object.balance) || null,
    availableCount: asNumber(object.availableCount),
    credits: rows
  }
}

function normalizeQuotaRecord(value: unknown): CodexQuotaCacheRecord | null {
  const object = asObject(value)
  const accountId = asString(object.accountId)
  if (!accountId) return null
  const source = object.source === 'app-server' || object.source === 'session' || object.source === 'auth' ? object.source : 'cache'
  const primary = normalizeQuotaWindow(object.primary, 'primary', source)
  const secondary = normalizeQuotaWindow(object.secondary, 'secondary', source)
  const legacyHourly = normalizeQuotaWindow(object.hourly, 'hourly', source)
  const legacyWeekly = normalizeQuotaWindow(object.weekly, 'weekly', source)
  return {
    providerId: 'codex',
    accountId,
    email: asString(object.email),
    authMode: asString(object.authMode),
    requiresOpenaiAuth: asBoolean(object.requiresOpenaiAuth),
    planType: asString(object.planType),
    primary: primary || legacyHourly,
    secondary: secondary || legacyWeekly,
    limitBuckets: Array.isArray(object.limitBuckets) ? object.limitBuckets.map((item) => {
      const bucket = asObject(item)
      return {
        id: asString(bucket.id),
        name: asString(bucket.name),
        planType: asString(bucket.planType),
        primary: normalizeQuotaWindow(bucket.primary, 'primary', source),
        secondary: normalizeQuotaWindow(bucket.secondary, 'secondary', source),
        credits: normalizeCredits(bucket.credits),
        rateLimitReachedType: asString(bucket.rateLimitReachedType)
      }
    }).filter((bucket) => bucket.id || bucket.name) : [],
    hourly: legacyHourly,
    weekly: legacyWeekly,
    credits: normalizeCredits(object.credits),
    monthlyLimit: object.monthlyLimit && typeof object.monthlyLimit === 'object' ? {
      limit: asString(asObject(object.monthlyLimit).limit),
      used: asString(asObject(object.monthlyLimit).used),
      remainingPercent: asNumber(asObject(object.monthlyLimit).remainingPercent),
      resetsAt: asString(asObject(object.monthlyLimit).resetsAt)
    } : null,
    rateLimitReachedType: asString(object.rateLimitReachedType),
    usage: normalizeUsage(object.usage as DailyUsageSnapshot | null),
    checkedAt: asString(object.checkedAt),
    source,
    status: object.status === 'available' || object.status === 'stale' || object.status === 'reauth-required' || object.status === 'error' ? object.status : 'unknown',
    stale: Boolean(object.stale) || source === 'cache',
    errorCode: asString(object.errorCode),
    message: asString(object.message)
  }
}

async function readQuotaCacheRecords(userDataPath: string): Promise<CodexQuotaCacheRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(quotaCachePath(userDataPath), 'utf8')) as unknown
    const parsedObject = asObject(parsed)
    const records: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsedObject.records) ? parsedObject.records : []
    return records.map(normalizeQuotaRecord).filter((record): record is CodexQuotaCacheRecord => Boolean(record))
  } catch {
    return []
  }
}

async function writeQuotaCacheRecord(userDataPath: string, record: QuotaSnapshot): Promise<void> {
  const path = quotaCachePath(userDataPath)
  const previous = cacheWriteQueues.get(path) || Promise.resolve()
  const next = previous.then(async () => {
    const records = await readQuotaCacheRecords(userDataPath)
    const filtered = records.filter((item) => item.accountId !== record.accountId)
    filtered.push({ ...record, source: 'app-server' })
    await mkdir(userDataPath, { recursive: true, mode: 0o700 })
    await writeFile(path, `${JSON.stringify(filtered, null, 2)}\n`, { mode: 0o600 })
  })
  cacheWriteQueues.set(path, next.catch(() => undefined))
  await next
}

export async function readCodexQuota(userDataPath: string, accountId: string, planType = ''): Promise<QuotaSnapshot> {
  const cached = (await readQuotaCacheRecords(userDataPath)).find((item) => item.accountId === accountId)
  if (cached) return { ...cached, planType: cached.planType || planType, source: 'cache', status: cached.status === 'available' ? 'stale' : cached.status, stale: true }
  return createQuotaSnapshot({
    accountId,
    planType,
    source: 'unavailable',
    status: 'unknown',
    message: '当前无法读取 Codex 配额，请刷新 Codex 状态或重新登录。'
  })
}

async function listSessionFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listSessionFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path)
  }
  return files
}

async function readTail(path: string): Promise<string> {
  const file = await open(path, 'r')
  try {
    const size = (await file.stat()).size
    const length = Math.min(size, maxSessionTailBytes)
    const buffer = Buffer.alloc(length)
    await file.read(buffer, 0, length, Math.max(0, size - length))
    return buffer.toString('utf8')
  } finally {
    await file.close()
  }
}

function normalizeSessionRateLimits(value: unknown): CodexAppServerRateLimits | null {
  const object = asObject(value)
  if (!Object.keys(object).length) return null
  const window = (candidate: unknown): { usedPercent: number | null; windowDurationMins: number | null; resetsAt: number | null } | null => {
    const item = asObject(candidate)
    if (!Object.keys(item).length) return null
    return {
      usedPercent: asNumber(item.used_percent ?? item.usedPercent),
      windowDurationMins: asNumber(item.window_minutes ?? item.windowDurationMins),
      resetsAt: asNumber(item.resets_at ?? item.resetsAt)
    }
  }
  const credits = asObject(object.credits)
  return {
    limitId: asString(object.limit_id ?? object.limitId),
    limitName: asString(object.limit_name ?? object.limitName),
    primary: window(object.primary),
    secondary: window(object.secondary),
    credits: Object.keys(credits).length ? {
      hasCredits: asBoolean(credits.has_credits ?? credits.hasCredits),
      unlimited: asBoolean(credits.unlimited),
      balance: asString(credits.balance) || null
    } : null,
    individualLimit: null,
    spendControlReached: asBoolean(object.spend_control_reached ?? object.spendControlReached),
    planType: asString(object.plan_type ?? object.planType),
    rateLimitReachedType: asString(object.rate_limit_reached_type ?? object.rateLimitReachedType),
    resetCredits: null
  }
}

async function readLatestSessionQuota(codexHome: string): Promise<SessionQuotaSnapshot | null> {
  const directory = join(codexHome, 'sessions')
  const files = await listSessionFiles(directory)
  const candidates = await Promise.all(files.map(async (path) => ({ path, modifiedAt: (await stat(path).catch(() => ({ mtimeMs: 0 }))).mtimeMs })))
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)
  for (const candidate of candidates.slice(0, maxSessionFiles)) {
    const content = await readTail(candidate.path).catch(() => '')
    const lines = content.split(/\r?\n/).reverse()
    for (const line of lines) {
      if (!line.includes('"rate_limits"')) continue
      try {
        const event = asObject(JSON.parse(line))
        const payload = asObject(event.payload)
        if (asString(payload.type) !== 'token_count') continue
        const limits = normalizeSessionRateLimits(payload.rate_limits)
        if (!limits || (!limits.primary && !limits.secondary)) continue
        return {
          rateLimits: limits,
          planType: limits.planType,
          checkedAt: asString(event.timestamp) || new Date(candidate.modifiedAt).toISOString()
        }
      } catch {
        // Ignore malformed or partial lines; session data is only a fallback.
      }
    }
  }
  return null
}

function appServerCommand(runtime: AiProviderRuntimeSnapshot): string {
  const appLabel = runtime.appPath ? basename(runtime.appPath, '.app') : ''
  if (runtime.command && runtime.command !== appLabel) return runtime.command
  return runtime.appPath ? join(runtime.appPath, 'Contents', 'Resources', 'codex') : ''
}

function liveAccountFromSnapshot(snapshot: CodexAppServerSnapshot): { email: string; planType: string; authMode: string; requiresOpenaiAuth: boolean } {
  return {
    email: snapshot.account.email,
    planType: snapshot.account.planType || snapshot.rateLimits?.planType || '',
    authMode: snapshot.account.type,
    requiresOpenaiAuth: snapshot.account.requiresOpenaiAuth
  }
}

async function readLiveCodexQuota(userDataPath: string, account: CodexManagedAccount, refresh: boolean): Promise<QuotaSnapshot> {
  const runtime = await detectCodexProvider(userDataPath)
  const command = appServerCommand(runtime)
  if (!command) throw new CodexAppServerError('not-installed', '未检测到 Codex App Server')
  const live = await readCodexAppServerSnapshot({ command, codexHome: account.codexHome, refreshToken: refresh })
  const accountInfo = liveAccountFromSnapshot(live)
  if (!live.rateLimits && !live.usage) {
    return createQuotaSnapshot({
      accountId: account.id,
      ...accountInfo,
      source: 'app-server',
      status: 'unknown',
      message: '已读取 Codex 账号信息，但官方暂未返回配额数据。',
      usage: mapAppServerUsage(live.usage),
      rateLimitsByLimitId: live.rateLimitsByLimitId,
      checkedAt: live.checkedAt
    })
  }
  return createQuotaSnapshot({
    accountId: account.id,
    ...accountInfo,
    rateLimits: live.rateLimits,
    rateLimitsByLimitId: live.rateLimitsByLimitId,
    usage: mapAppServerUsage(live.usage),
    source: 'app-server',
    status: live.rateLimits ? 'available' : 'unknown',
    message: live.rateLimits ? '已从 Codex App Server 读取实时账号与配额。' : '已读取 Codex 账号信息，但配额暂不可用。',
    checkedAt: live.checkedAt
  })
}

async function readLiveOrFallbackQuota(userDataPath: string, account: CodexManagedAccount, refresh: boolean): Promise<QuotaSnapshot> {
  let liveError: CodexAppServerError | null = null
  let liveInfo: QuotaSnapshot | null = null
  try {
    const live = await readLiveCodexQuota(userDataPath, account, refresh)
    if (live.status === 'available') {
      await writeQuotaCacheRecord(userDataPath, live).catch(() => undefined)
      return live
    }
    // App Server may know the account while temporarily omitting rate limits.
    // Keep that account information, but continue through the documented data
    // fallback chain for the last valid quota snapshot.
    liveInfo = live
  } catch (error) {
    liveError = error instanceof CodexAppServerError ? error : new CodexAppServerError('unavailable', String(error))
  }

  const accountInfo = {
    email: liveInfo?.email || account.email,
    authMode: liveInfo?.authMode || account.authMode,
    requiresOpenaiAuth: liveInfo?.requiresOpenaiAuth ?? (account.authMode === 'chatgpt' ? true : null),
    planType: liveInfo?.planType || account.planType
  }

  const session = await readLatestSessionQuota(account.codexHome)
  if (session) {
    const result = createQuotaSnapshot({
      accountId: account.id,
      ...accountInfo,
      planType: session.planType || accountInfo.planType,
      rateLimits: session.rateLimits,
      usage: liveInfo?.usage,
      source: 'session',
      status: liveError?.code === 'unauthorized' ? 'reauth-required' : 'stale',
      stale: true,
      errorCode: liveError?.code || '',
      checkedAt: session.checkedAt,
      message: liveError?.code === 'unauthorized'
        ? 'Codex 登录状态需要重新授权，当前显示最近一次本地用量记录。'
        : '当前无法连接 Codex App Server，显示最近一次本地用量记录。'
    })
    return result
  }

  const cached = await readCodexQuota(userDataPath, account.id, account.planType)
  if (cached.source === 'cache') {
    return {
      ...cached,
      email: cached.email || accountInfo.email,
      authMode: cached.authMode || accountInfo.authMode,
      requiresOpenaiAuth: cached.requiresOpenaiAuth ?? accountInfo.requiresOpenaiAuth,
      planType: cached.planType || accountInfo.planType,
      usage: liveInfo?.usage || cached.usage,
      status: liveError?.code === 'unauthorized' ? 'reauth-required' : 'stale',
      errorCode: liveError?.code || cached.errorCode,
      message: liveError?.code === 'unauthorized'
        ? 'Codex 登录状态需要重新授权，当前显示 ForgeDesk 最近一次真实数据。'
        : '当前无法连接 Codex App Server，显示 ForgeDesk 最近一次真实数据。'
    }
  }

  if (liveInfo) {
    return {
      ...liveInfo,
      status: liveError?.code === 'unauthorized' ? 'reauth-required' : 'unknown',
      stale: true,
      errorCode: liveError?.code || liveInfo.errorCode,
      message: liveError?.code === 'unauthorized'
        ? 'Codex 登录状态需要重新授权，暂时没有可用的历史配额记录。'
        : liveInfo.message
    }
  }

  return createQuotaSnapshot({
    accountId: account.id,
    ...accountInfo,
    source: 'auth',
    status: liveError?.code === 'unauthorized' ? 'reauth-required' : 'unknown',
    errorCode: liveError?.code || 'unavailable',
    message: liveError?.code === 'unauthorized'
      ? 'Codex 登录状态需要重新授权，暂时没有可用的历史配额记录。'
      : '暂时无法读取 Codex 配额；请确认 Codex 已登录后重试。'
  })
}

export async function detectCodexProvider(userDataPath: string, env: NodeJS.ProcessEnv = process.env): Promise<AiProviderRuntimeSnapshot> {
  const command = await findLocalAiCommand('codex-cli', { env })
  const appPath = (await Promise.all(appCandidates().map(async (candidate) => ({ candidate, available: await isPathAvailable(candidate) })))).find((item) => item.available)?.candidate ?? ''
  let version = ''

  if (command) {
    try {
      version = (await execFileAsync(command, ['--version'], { timeout: 5_000 })).stdout.trim().split(/\r?\n/).pop() ?? ''
    } catch {
      // Presence is still useful even if the version command fails.
    }
  }

  let accounts: CodexAccountRegistryView | null = null
  try {
    accounts = await listCodexAccounts(userDataPath)
  } catch {
    accounts = null
  }

  const activeAccount = accounts?.accounts.find((account) => account.active)
  const installed = Boolean(appPath || command)
  const openMode = appPath ? 'app' : command ? 'cli' : 'none'
  const commandLabel = command || (appPath ? basename(appPath, '.app') : '')

  return {
    id: 'codex',
    label: 'Codex',
    installed,
    authenticated: Boolean(activeAccount?.available),
    command: commandLabel,
    appPath,
    version,
    openMode,
    installUrl: codexInstallUrl,
    message: !installed
      ? '未检测到 Codex 应用或 CLI。'
      : activeAccount?.available
        ? '已检测到 Codex，当前账户可用。'
        : '已检测到 Codex，但尚未读取到可用登录状态。',
    checkedAt: new Date().toISOString()
  }
}

export async function getInitializationSnapshot(
  userDataPath: string,
  projects: InitializationProjectSummary[]
): Promise<InitializationSnapshot> {
  return {
    requiresProject: projects.length === 0,
    projectCount: projects.length,
    currentProject: projects[0] ?? null,
    codex: await detectCodexProvider(userDataPath)
  }
}

async function getCodexAccountForQuota(userDataPath: string, accountId?: string): Promise<CodexManagedAccount> {
  const accounts = await listCodexAccounts(userDataPath)
  const account = accounts.accounts.find((item) => item.id === accountId) ?? accounts.accounts.find((item) => item.active)
  if (!account) throw new Error('没有可用的 Codex 账户')
  return account
}

async function getCodexQuota(userDataPath: string, accountId?: string, options: { refresh?: boolean } = {}): Promise<QuotaSnapshot> {
  const account = await getCodexAccountForQuota(userDataPath, accountId)
  return readLiveOrFallbackQuota(userDataPath, account, Boolean(options.refresh))
}

async function getCodexAccountSnapshots(userDataPath: string, options: { refresh?: boolean } = {}): Promise<AiProviderAccountSnapshot[]> {
  const accounts = await listCodexAccounts(userDataPath)
  return Promise.all(accounts.accounts.map(async (account) => {
    const quota = await readLiveOrFallbackQuota(userDataPath, account, Boolean(options.refresh))
    const live: CodexAccountLiveSnapshot = {
      accountId: account.id,
      email: quota.email || account.email,
      authMode: quota.authMode || account.authMode,
      planType: quota.planType || account.planType,
      quota,
      usage: quota.usage
    }
    return { account, live }
  }))
}

const codexProviderAdapter: AiProviderAdapter = {
  id: 'codex',
  label: 'Codex',
  detect: detectCodexProvider,
  getAccounts: listCodexAccounts,
  getQuota: getCodexQuota,
  getAccountSnapshots: getCodexAccountSnapshots
}

export const aiProviderAdapters: Record<AiProviderKey, AiProviderAdapter> = {
  codex: codexProviderAdapter
}

export function getAiProviderAdapter(providerId: string): AiProviderAdapter {
  const adapter = aiProviderAdapters[providerId as AiProviderKey]
  if (!adapter) throw new Error(`暂不支持 AI 工具：${providerId}`)
  return adapter
}

export async function listAiProviderRuntimeSnapshots(userDataPath: string): Promise<AiProviderRuntimeSnapshot[]> {
  return Promise.all(Object.values(aiProviderAdapters).map((adapter) => adapter.detect(userDataPath)))
}
