import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { access, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { findLocalAiCommand } from './ai-runtime.js'
import { listCodexAccounts, type CodexAccountRegistryView } from './codex-accounts.js'

const execFileAsync = promisify(execFile)
const quotaCacheFileName = 'codex-quota-cache.json'

export const codexInstallUrl = 'https://openai.com/codex/'

export type AiProviderKey = 'codex'

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
  label: 'hourly' | 'weekly'
  used: number | null
  limit: number | null
  remaining: number | null
  resetAt: string
}

export type QuotaSnapshot = {
  providerId: AiProviderKey
  accountId: string
  planType: string
  hourly: QuotaWindow | null
  weekly: QuotaWindow | null
  checkedAt: string
  source: 'cache' | 'provider' | 'unavailable'
  status: 'available' | 'unknown' | 'error'
  message: string
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
  getQuota: (userDataPath: string, accountId?: string) => Promise<QuotaSnapshot>
}

type CodexQuotaCacheRecord = QuotaSnapshot & {
  providerId: AiProviderKey
  accountId: string
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

function normalizeQuotaWindow(value: unknown, label: QuotaWindow['label']): QuotaWindow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const object = value as Record<string, unknown>
  const numberOrNull = (candidate: unknown): number | null => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
  return {
    label,
    used: numberOrNull(object.used),
    limit: numberOrNull(object.limit),
    remaining: numberOrNull(object.remaining),
    resetAt: typeof object.resetAt === 'string' ? object.resetAt : ''
  }
}

function normalizeQuotaRecord(value: unknown): CodexQuotaCacheRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const object = value as Record<string, unknown>
  const accountId = typeof object.accountId === 'string' ? object.accountId : ''
  if (!accountId) return null
  return {
    providerId: 'codex',
    accountId,
    planType: typeof object.planType === 'string' ? object.planType : '',
    hourly: normalizeQuotaWindow(object.hourly, 'hourly'),
    weekly: normalizeQuotaWindow(object.weekly, 'weekly'),
    checkedAt: typeof object.checkedAt === 'string' ? object.checkedAt : '',
    source: object.source === 'provider' ? 'provider' : 'cache',
    status: object.status === 'available' ? 'available' : object.status === 'error' ? 'error' : 'unknown',
    message: typeof object.message === 'string' ? object.message : ''
  }
}

export async function readCodexQuota(userDataPath: string, accountId: string, planType = ''): Promise<QuotaSnapshot> {
  try {
    const parsed = JSON.parse(await readFile(quotaCachePath(userDataPath), 'utf8')) as unknown
    const records = Array.isArray(parsed) ? parsed : []
    const cached = records.map(normalizeQuotaRecord).find((item) => item?.accountId === accountId)
    if (cached) return { ...cached, planType: cached.planType || planType, source: 'cache' }
  } catch {
    // Quota is optional and must never block project or account management.
  }

  return {
    providerId: 'codex',
    accountId,
    planType,
    hourly: null,
    weekly: null,
    checkedAt: '',
    source: 'unavailable',
    status: 'unknown',
    message: '当前无法读取 Codex 配额，请在 Codex 客户端的用量面板中查看。'
  }
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

const codexProviderAdapter: AiProviderAdapter = {
  id: 'codex',
  label: 'Codex',
  detect: detectCodexProvider,
  getAccounts: listCodexAccounts,
  getQuota: async (userDataPath, accountId) => {
    const accounts = await listCodexAccounts(userDataPath)
    const account = accounts.accounts.find((item) => item.id === accountId) ?? accounts.accounts.find((item) => item.active)
    return readCodexQuota(userDataPath, account?.id ?? '', account?.planType ?? '')
  }
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
