import { createDecipheriv, createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { importCodexAccountObject, listCodexAccounts, type CodexManagedAccount } from './codex-accounts.js'
import { getCodexApiService, saveCodexApiServiceSettings } from './codex-api-service.js'
import type { CockpitAccountMetadata, CockpitImportInput, CockpitImportPreview, CockpitImportResult } from '../shared/cockpit-import'

type ObjectValue = Record<string, unknown>
const object = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
const string = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const percent = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null
function date(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const parsed = new Date(typeof value === 'number' ? value * 1000 : string(value))
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : ''
}

async function json(path: string): Promise<unknown> {
  if ((await stat(path)).size > 16 * 1024 * 1024) throw new Error('文件过大，请分批导出账号')
  const content = await readFile(path, 'utf8')
  try { return JSON.parse(content) } catch { throw new Error('Cockpit JSON 文件无效') }
}

async function resolveSource(sourcePath: string | undefined, homeDirectory: string): Promise<string> {
  if (sourcePath?.trim()) return realpath(resolve(sourcePath.trim()))
  for (const path of [join(homeDirectory, '.cockpit_tools'), join(homeDirectory, 'Library/Application Support/com.antigravity.cockpit-tools')]) {
    try {
      await stat(join(path, 'codex_accounts.json'))
      return realpath(path)
    } catch { /* Try the next known data location without creating it. */ }
  }
  throw new Error('未找到 Cockpit 数据，请选择数据目录或在 Cockpit 中导出的账号 JSON')
}

async function decodeDetail(value: unknown, directory: string): Promise<ObjectValue> {
  const envelope = object(value)
  if (!envelope.ciphertext) return envelope
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM' || envelope.kind !== 'codex') throw new Error('账号加密格式不受支持，请从 Cockpit 导出账号 JSON')
  try {
    const key = Buffer.from((await readFile(join(directory, 'secure-account-storage.key'), 'utf8')).trim(), 'base64')
    const nonce = Buffer.from(string(envelope.nonce), 'base64')
    const encrypted = Buffer.from(string(envelope.ciphertext), 'base64')
    if (key.length !== 32 || nonce.length !== 12 || encrypted.length < 16) throw new Error('invalid envelope')
    const decipher = createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAuthTag(encrypted.subarray(-16))
    return object(JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8')))
  } catch {
    throw new Error('无法解密此账号，请选择完整 Cockpit 数据目录，或从 Cockpit 导出账号 JSON')
  }
}

type Entry = { id: string; detail: ObjectValue; error: string }
type Source = { path: string; currentId: string; entries: Entry[]; api: ObjectValue | null; warnings: string[] }
async function readSource(sourcePath: string | undefined, homeDirectory: string): Promise<Source> {
  const path = await resolveSource(sourcePath, homeDirectory)
  const directory = (await stat(path)).isDirectory() ? path : dirname(path)
  const isDirectory = (await stat(path)).isDirectory()
  const data = await json(isDirectory ? join(path, 'codex_accounts.json') : path)
  const index = object(data)
  const values = Array.isArray(data) ? data : Array.isArray(index.accounts) ? index.accounts : [data]
  if (values.length > 500) throw new Error('最多一次导入 500 个账号，请分批导出')
  const entries: Entry[] = []
  const ids = new Set<string>()
  for (const [position, value] of values.entries()) {
    const summary = object(value)
    const id = string(summary.id) || `export-${position + 1}`
    if (ids.has(id)) continue
    ids.add(id)
    try {
      let detail = summary
      if (!summary.tokens && !summary.access_token && !summary.openai_api_key && !summary.OPENAI_API_KEY && Array.isArray(index.accounts)) {
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('账号 ID 格式无效')
        const detailDirectory = await realpath(join(directory, 'codex_accounts'))
        const file = await realpath(join(detailDirectory, `${id}.json`))
        const location = relative(detailDirectory, file)
        if (location.startsWith('..') || isAbsolute(location)) throw new Error('账号文件超出所选目录')
        detail = { ...summary, ...await decodeDetail(await json(file), directory) }
      } else {
        detail = await decodeDetail(summary, directory)
      }
      entries.push({ id, detail, error: '' })
    } catch (error) {
      // Never relay JSON parser output: it can include credential fragments.
      entries.push({ id, detail: summary, error: error instanceof SyntaxError ? '账号 JSON 无效' : error instanceof Error && /账号|Cockpit/.test(error.message) ? error.message : '账号详情不可读取' })
    }
  }
  const warnings: string[] = []
  if (entries.some(entry => entry.detail.egress_proxy || entry.detail.egress_proxy_url || entry.detail.api_model_mappings || entry.detail.app_speed && entry.detail.app_speed !== 'standard')) {
    warnings.push('账号代理、模型映射和 CLI 运行设置不转移，请在 ForgeDesk 中单独配置。')
  }
  let api: ObjectValue | null = null
  if (isDirectory || Array.isArray(index.accounts)) {
    try { api = object(await json(join(directory, 'codex_local_access.json'))) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') warnings.push('本地 API 配置无法读取，可继续导入账号。')
    }
  }
  if (api) warnings.push('仅兼容 API 端口与客户端密钥。账号池、代理、路由、OAuth 绑定、模型映射及其他高级设置不导入；导入后服务保持停止。')
  return { path, currentId: string(index.current_account_id), entries, api, warnings }
}

function convert(entry: Entry): { auth: ObjectValue; metadata: CockpitAccountMetadata; error: string } {
  const detail = entry.detail
  const tokens = object(detail.tokens)
  const apiKey = string(detail.openai_api_key || detail.OPENAI_API_KEY)
  const accessToken = string(tokens.access_token || detail.access_token)
  const refreshToken = string(tokens.refresh_token || detail.refresh_token)
  const accountId = string(detail.account_id || tokens.account_id)
  const email = string(detail.email)
  const quota = object(detail.quota)
  const fingerprint = createHash('sha256').update(accountId ? `${accountId}:${email}` : apiKey || refreshToken || accessToken).digest('hex')
  const metadata: CockpitAccountMetadata = {
    sourceId: entry.id, fingerprint, teamName: string(detail.account_name), note: string(detail.account_note),
    tags: Array.isArray(detail.tags) ? detail.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    planType: string(detail.plan_type), subscriptionExpiresAt: date(detail.subscription_active_until),
    quota: Object.keys(quota).length ? {
      hourlyRemaining: quota.hourly_window_present === false ? null : percent(quota.hourly_percentage),
      weeklyRemaining: quota.weekly_window_present === false ? null : percent(quota.weekly_percentage),
      hourlyResetAt: date(quota.hourly_reset_time), weeklyResetAt: date(quota.weekly_reset_time),
      resetCredits: typeof quota.reset_credits_available === 'number' ? quota.reset_credits_available : null,
      resetCreditsExpireAt: date(quota.reset_credits_next_expires_at), checkedAt: date(detail.usage_updated_at)
    } : undefined
  }
  const error = entry.error || (detail.api_provider_mode === 'custom' || detail.api_base_url && !/^https:\/\/api\.openai\.com\/?(?:v1\/?)?$/.test(string(detail.api_base_url))
    ? '自定义供应商账号请在模型提供商中单独配置，避免丢失上游地址'
    : !apiKey && !accessToken && !refreshToken ? '没有可用凭据；如为远程托管账号，请先从 Cockpit 导出完整账号' : '')
  return {
    auth: apiKey ? { OPENAI_API_KEY: apiKey, email, plan_type: metadata.planType } : {
      auth_mode: 'chatgpt', email, plan_type: metadata.planType,
      tokens: { access_token: accessToken, refresh_token: refreshToken, id_token: string(tokens.id_token || detail.id_token), account_id: accountId }
    }, metadata, error
  }
}

function duplicate(entry: Entry, accounts: CodexManagedAccount[]): boolean {
  const { metadata, auth } = convert(entry)
  const accountId = string(object(auth.tokens).account_id)
  return accounts.some(account => account.cockpit?.fingerprint === metadata.fingerprint || Boolean(accountId && account.accountId === accountId && account.email === string(entry.detail.email)))
}

export async function previewCockpitImport(userDataPath: string, sourcePath?: string, homeDirectory = homedir()): Promise<CockpitImportPreview> {
  let source: Source
  try { source = await readSource(sourcePath, homeDirectory) } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Cockpit 索引或导出 JSON 无效')
    throw error
  }
  const registry = await listCodexAccounts(userDataPath, homeDirectory)
  return {
    sourcePath: source.path,
    accounts: source.entries.map(entry => {
      const converted = convert(entry)
      return { id: entry.id, name: string(entry.detail.account_name) || string(entry.detail.email) || entry.id,
        email: string(entry.detail.email), planType: converted.metadata.planType, teamName: converted.metadata.teamName,
        subscriptionExpiresAt: converted.metadata.subscriptionExpiresAt, current: entry.id === source.currentId,
        duplicate: duplicate(entry, registry.accounts), importable: !converted.error, error: converted.error }
    }),
    api: source.api && Number.isInteger(source.api.port) && Number(source.api.port) > 0 && Number(source.api.port) <= 65535
      ? { port: Number(source.api.port), keyConfigured: Boolean(string(source.api.apiKey || source.api.api_key)) } : null,
    warnings: source.warnings
  }
}

let importQueue: Promise<unknown> = Promise.resolve()
export function importCockpitData(userDataPath: string, input: CockpitImportInput, homeDirectory = homedir()): Promise<CockpitImportResult> {
  const task = importQueue.catch(() => undefined).then(async () => {
    const source = await readSource(input.sourcePath, homeDirectory)
    const result: CockpitImportResult = { imported: 0, skipped: 0, errors: [], apiSettingsImported: false }
    const selected = new Set(input.accountIds)
    if ([...selected].some(id => !source.entries.some(entry => entry.id === id))) throw new Error('所选账号已变化，请重新预览')
    for (const entry of source.entries.filter(entry => selected.has(entry.id))) {
      const { auth, metadata, error } = convert(entry)
      if (error) { result.errors.push(`${entry.id}：${error}`); continue }
      const registry = await listCodexAccounts(userDataPath, homeDirectory)
      if (duplicate(entry, registry.accounts)) { result.skipped++; continue }
      try {
        await importCodexAccountObject(userDataPath, auth, string(entry.detail.account_name) || string(entry.detail.email), metadata, homeDirectory)
        result.imported++
      } catch { result.errors.push(`${entry.id}：写入 ForgeDesk 失败，可重新导入。`) }
    }
    if (input.importApiSettings) {
      try {
        if (!source.api) throw new Error('源目录没有本地 API 配置')
        if ((await getCodexApiService(userDataPath)).running) throw new Error('请先停止 ForgeDesk 本地 API 服务，再导入配置')
        await saveCodexApiServiceSettings(userDataPath, { port: Number(source.api.port), apiKey: string(source.api.apiKey || source.api.api_key) || undefined, enabled: false })
        result.apiSettingsImported = true
      } catch (error) { result.errors.push(error instanceof Error ? error.message : 'API 配置导入失败') }
    }
    return result
  })
  importQueue = task
  return task
}
