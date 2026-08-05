import { chmod, copyFile, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

type JsonObject = Record<string, unknown>

export type CodexAccountInfo = {
  available: boolean
  authFilePath: string
  authMode: string
  email: string
  planType: string
  accountId: string
  accountIdSuffix: string
  accessTokenConfigured: boolean
  refreshTokenConfigured: boolean
  updatedAt: string
  message: string
}

export type CodexManagedAccount = CodexAccountInfo & {
  id: string
  name: string
  source: 'local' | 'imported'
  codexHome: string
  active: boolean
  createdAt: string
  lastUsedAt: string
}

export type CodexAccountRegistryView = {
  activeAccountId: string
  accounts: CodexManagedAccount[]
  message: string
}

export type CodexAccountImportInput = {
  name?: string
  sourcePath: string
}

export type CodexAccountCreateInput = {
  name?: string
}

type CodexAccountRecord = {
  id: string
  name: string
  source: 'local' | 'imported'
  codexHome: string
  createdAt: string
  lastUsedAt: string
}

type CodexAccountRegistry = {
  activeAccountId: string
  accounts: CodexAccountRecord[]
}

const registryFileName = 'codex-accounts.json'

function registryPath(userDataPath: string): string {
  return join(userDataPath, registryFileName)
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function decodeJwtPayload(token: string): JsonObject {
  const segment = token.split('.')[1]
  if (!segment) return {}

  try {
    return asObject(JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')))
  } catch {
    return {}
  }
}

function readNestedString(object: JsonObject, paths: string[][]): string {
  for (const path of paths) {
    let current: unknown = object
    for (const key of path) current = asObject(current)[key]
    const value = asString(current)
    if (value) return value
  }
  return ''
}

function redactId(value: string): { full: string; suffix: string } {
  const normalized = value.trim()
  return {
    full: normalized,
    suffix: normalized ? (normalized.length > 8 ? `…${normalized.slice(-8)}` : normalized) : ''
  }
}

function emptyAccount(authFilePath: string, message: string): CodexAccountInfo {
  return {
    available: false,
    authFilePath,
    authMode: '',
    email: '',
    planType: '',
    accountId: '',
    accountIdSuffix: '',
    accessTokenConfigured: false,
    refreshTokenConfigured: false,
    updatedAt: '',
    message
  }
}

function defaultCodexHome(homeDirectory = homedir()): string {
  return resolve(process.env.CODEX_HOME?.trim() || join(homeDirectory, '.codex'))
}

function normalizeRecord(value: unknown): CodexAccountRecord | null {
  const object = asObject(value)
  const id = asString(object.id)
  const codexHome = asString(object.codexHome)
  if (!id || !codexHome) return null
  return {
    codexHome: resolve(codexHome),
    createdAt: asString(object.createdAt) || new Date().toISOString(),
    id,
    lastUsedAt: asString(object.lastUsedAt),
    name: asString(object.name) || 'Codex 账户',
    source: object.source === 'imported' ? 'imported' : 'local'
  }
}

function defaultRegistry(homeDirectory = homedir()): CodexAccountRegistry {
  const now = new Date().toISOString()
  return {
    activeAccountId: 'local',
    accounts: [{
      codexHome: defaultCodexHome(homeDirectory),
      createdAt: now,
      id: 'local',
      lastUsedAt: now,
      name: '本机 Codex',
      source: 'local'
    }]
  }
}

async function readRegistry(userDataPath: string, homeDirectory = homedir()): Promise<CodexAccountRegistry> {
  try {
    const parsed = asObject(JSON.parse(await readFile(registryPath(userDataPath), 'utf8')))
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts.map(normalizeRecord).filter((record): record is CodexAccountRecord => Boolean(record)) : []
    const fallback = defaultRegistry(homeDirectory)
    const hasLocal = accounts.some((account) => account.id === 'local')
    if (!hasLocal) accounts.unshift(fallback.accounts[0])
    const activeAccountId = accounts.some((account) => account.id === asString(parsed.activeAccountId))
      ? asString(parsed.activeAccountId)
      : 'local'
    return { activeAccountId, accounts }
  } catch {
    return defaultRegistry(homeDirectory)
  }
}

async function writeRegistry(userDataPath: string, registry: CodexAccountRegistry): Promise<void> {
  await mkdir(userDataPath, { recursive: true, mode: 0o700 })
  await writeFile(registryPath(userDataPath), `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 })
}

function accountView(record: CodexAccountRecord, info: CodexAccountInfo, activeAccountId: string): CodexManagedAccount {
  return {
    ...info,
    active: record.id === activeAccountId,
    codexHome: record.codexHome,
    createdAt: record.createdAt,
    id: record.id,
    lastUsedAt: record.lastUsedAt,
    name: record.name,
    source: record.source
  }
}

async function readCodexAccountInfoAtHome(codexHome: string): Promise<CodexAccountInfo> {
  const authFilePath = join(resolve(codexHome), 'auth.json')

  let rawContent: string
  let updatedAt = ''
  try {
    const fileStat = await stat(authFilePath)
    updatedAt = fileStat.mtime.toISOString()
    rawContent = await readFile(authFilePath, 'utf8')
  } catch {
    return emptyAccount(authFilePath, '未找到本机 Codex 登录文件，请先登录 Codex。')
  }

  let parsed: JsonObject
  try {
    parsed = asObject(JSON.parse(rawContent))
  } catch {
    return emptyAccount(authFilePath, 'Codex 登录文件不是有效 JSON。')
  }

  const tokens = asObject(parsed.tokens)
  const accessToken = asString(tokens.access_token || tokens.accessToken || parsed.access_token || parsed.accessToken)
  const refreshToken = asString(tokens.refresh_token || tokens.refreshToken || parsed.refresh_token || parsed.refreshToken)
  const idToken = asString(tokens.id_token || tokens.idToken || parsed.id_token || parsed.idToken)
  const accessClaims = decodeJwtPayload(accessToken)
  const idClaims = decodeJwtPayload(idToken)
  const authClaims = asObject(accessClaims['https://api.openai.com/auth'] || idClaims['https://api.openai.com/auth'])
  const profileClaims = asObject(accessClaims['https://api.openai.com/profile'] || idClaims['https://api.openai.com/profile'])
  const accountId = readNestedString(parsed, [['account_id'], ['accountId']]) || readNestedString(tokens, [['account_id'], ['accountId']]) || readNestedString(accessClaims, [['account_id'], ['accountId']])
  const account = redactId(accountId)
  const email = readNestedString(parsed, [['email']]) || readNestedString(tokens, [['email']]) || readNestedString(accessClaims, [['email'], ['preferred_username']]) || readNestedString(idClaims, [['email'], ['preferred_username']]) || readNestedString(profileClaims, [['email'], ['email_address']])
  const planType = readNestedString(parsed, [['plan_type'], ['planType']]) || readNestedString(tokens, [['plan_type'], ['planType']]) || readNestedString(authClaims, [['chatgpt_plan_type'], ['plan_type'], ['planType']])
  const authMode = readNestedString(parsed, [['auth_mode'], ['authMode']]) || (asString(parsed.OPENAI_API_KEY || parsed.openai_api_key) ? 'apiKey' : accessToken ? 'chatgpt' : '')

  return {
    available: Boolean(accessToken || refreshToken || parsed.OPENAI_API_KEY || parsed.openai_api_key),
    authFilePath,
    authMode,
    email,
    planType,
    accountId: account.full,
    accountIdSuffix: account.suffix,
    accessTokenConfigured: Boolean(accessToken),
    refreshTokenConfigured: Boolean(refreshToken),
    updatedAt,
    message: accessToken || refreshToken || parsed.OPENAI_API_KEY || parsed.openai_api_key ? '已读取本机 Codex 登录状态（凭据已脱敏）。' : 'Codex 登录文件存在，但没有检测到可用凭据。'
  }
}

export async function readCodexAccountInfo(homeDirectory = homedir()): Promise<CodexAccountInfo> {
  return readCodexAccountInfoAtHome(defaultCodexHome(homeDirectory))
}

export async function listCodexAccounts(userDataPath: string, homeDirectory = homedir()): Promise<CodexAccountRegistryView> {
  const registry = await readRegistry(userDataPath, homeDirectory)
  const accounts = await Promise.all(registry.accounts.map(async (record) => accountView(record, await readCodexAccountInfoAtHome(record.codexHome), registry.activeAccountId)))
  return {
    accounts,
    activeAccountId: registry.activeAccountId,
    message: accounts.length === 1 ? '当前使用本机 Codex 登录态。' : `已管理 ${accounts.length} 个 Codex 账户。`
  }
}

export async function resolveCodexHome(userDataPath: string, accountId?: string, homeDirectory = homedir()): Promise<string> {
  const registry = await readRegistry(userDataPath, homeDirectory)
  const selectedId = accountId?.trim() || registry.activeAccountId
  return registry.accounts.find((account) => account.id === selectedId)?.codexHome || defaultCodexHome(homeDirectory)
}

export async function syncActiveCodexHome(userDataPath: string, homeDirectory = homedir()): Promise<string> {
  const codexHome = await resolveCodexHome(userDataPath, undefined, homeDirectory)
  process.env.CODEX_HOME = codexHome
  return codexHome
}

export async function activateCodexAccount(userDataPath: string, accountId: string, homeDirectory = homedir()): Promise<CodexAccountRegistryView> {
  const normalizedId = accountId.trim()
  if (!normalizedId) throw new Error('请选择要启用的 Codex 账户')
  const registry = await readRegistry(userDataPath, homeDirectory)
  const account = registry.accounts.find((item) => item.id === normalizedId)
  if (!account) throw new Error('Codex 账户不存在')
  account.lastUsedAt = new Date().toISOString()
  registry.activeAccountId = account.id
  await writeRegistry(userDataPath, registry)
  await syncActiveCodexHome(userDataPath, homeDirectory)
  return listCodexAccounts(userDataPath, homeDirectory)
}

export async function importCodexAccount(userDataPath: string, input: CodexAccountImportInput, homeDirectory = homedir()): Promise<CodexAccountRegistryView> {
  const rawSourcePath = input.sourcePath.trim()
  if (!rawSourcePath) throw new Error('请选择 Codex auth.json 文件或 profile 目录')
  const sourcePath = resolve(rawSourcePath)

  let sourceAuthPath = sourcePath
  try {
    if ((await stat(sourcePath)).isDirectory()) sourceAuthPath = join(sourcePath, 'auth.json')
  } catch {
    throw new Error('选择的 Codex profile 不存在')
  }
  if (basename(sourceAuthPath) !== 'auth.json') throw new Error('请选择 auth.json 或包含 auth.json 的 Codex profile 目录')
  try {
    await stat(sourceAuthPath)
  } catch {
    throw new Error('选择的 profile 中没有 auth.json')
  }

  const registry = await readRegistry(userDataPath, homeDirectory)
  const id = `account-${randomUUID()}`
  const destinationHome = join(userDataPath, 'codex-accounts', id)
  await mkdir(destinationHome, { recursive: true, mode: 0o700 })
  await copyFile(sourceAuthPath, join(destinationHome, 'auth.json'))
  await chmod(join(destinationHome, 'auth.json'), 0o600)

  const now = new Date().toISOString()
  registry.accounts.push({
    codexHome: destinationHome,
    createdAt: now,
    id,
    lastUsedAt: '',
    name: input.name?.trim() || `导入账户 ${registry.accounts.length + 1}`,
    source: 'imported'
  })
  await writeRegistry(userDataPath, registry)
  return listCodexAccounts(userDataPath, homeDirectory)
}

export async function createCodexAccount(userDataPath: string, input: CodexAccountCreateInput = {}, homeDirectory = homedir()): Promise<CodexAccountRegistryView> {
  const registry = await readRegistry(userDataPath, homeDirectory)
  const id = `account-${randomUUID()}`
  const destinationHome = join(userDataPath, 'codex-accounts', id)
  await mkdir(destinationHome, { recursive: true, mode: 0o700 })
  const now = new Date().toISOString()
  registry.accounts.push({
    codexHome: destinationHome,
    createdAt: now,
    id,
    lastUsedAt: '',
    name: input.name?.trim() || `新 Codex 账户 ${registry.accounts.length + 1}`,
    source: 'imported'
  })
  await writeRegistry(userDataPath, registry)
  return listCodexAccounts(userDataPath, homeDirectory)
}

export async function removeCodexAccount(userDataPath: string, accountId: string, homeDirectory = homedir()): Promise<CodexAccountRegistryView> {
  const normalizedId = accountId.trim()
  if (!normalizedId || normalizedId === 'local') throw new Error('本机 Codex 账户不能从 ForgeDesk 注册表删除')
  const registry = await readRegistry(userDataPath, homeDirectory)
  const account = registry.accounts.find((item) => item.id === normalizedId)
  if (!account) throw new Error('Codex 账户不存在')
  registry.accounts = registry.accounts.filter((item) => item.id !== normalizedId)
  if (registry.activeAccountId === normalizedId) registry.activeAccountId = 'local'
  await unlink(join(account.codexHome, 'auth.json')).catch(() => undefined)
  await writeRegistry(userDataPath, registry)
  await syncActiveCodexHome(userDataPath, homeDirectory)
  return listCodexAccounts(userDataPath, homeDirectory)
}

export async function getActiveCodexAccountInfo(userDataPath: string, homeDirectory = homedir()): Promise<CodexAccountInfo> {
  return readCodexAccountInfoAtHome(await resolveCodexHome(userDataPath, undefined, homeDirectory))
}
