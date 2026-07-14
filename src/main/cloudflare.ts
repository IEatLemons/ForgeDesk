export type CloudflareFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

export type CloudflareDnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX'

export type ProjectCloudflareSettingsInput = {
  projectId: string
  domain?: string
  zoneId?: string
  apiToken?: string
}

export type ProjectCloudflareSettings = {
  projectId: string
  domain: string
  zoneId: string
  apiToken: string
  tokenConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type CloudflareConnectionTestResult = {
  ok: boolean
  message: string
  recordCount: number
}

export type CloudflareDnsRecordInput = {
  id?: string
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl?: number
  proxied?: boolean
  priority?: number
  comment?: string
}

export type CloudflareDnsRecord = {
  id: string
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl: number
  proxied: boolean
  proxiable: boolean
  priority: number
  comment: string
  createdAt: string
  modifiedAt: string
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

const cloudflareApiBaseUrl = 'https://api.cloudflare.com/client/v4'
const cloudflareRecordTypes: CloudflareDnsRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX']

function nowIso(): string {
  return new Date().toISOString()
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return 0
}

function booleanField(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => record[key] === true || record[key] === 'true')
}

function assertProjectExists(db: DatabaseLike, projectId: string): string {
  const normalizedProjectId = trimText(projectId)

  if (!normalizedProjectId) {
    throw new Error('缺少 ForgeDesk 项目 ID')
  }

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(normalizedProjectId)

  if (!project) {
    throw new Error('项目不存在')
  }

  return normalizedProjectId
}

function normalizeDomain(value: unknown): string {
  return trimText(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '')
    .toLowerCase()
}

function normalizeZoneId(value: unknown): string {
  return trimText(value)
}

function normalizeApiToken(value: unknown): string {
  return trimText(value)
}

function normalizeRecordType(value: unknown): CloudflareDnsRecordType {
  const type = trimText(value).toUpperCase()

  if (cloudflareRecordTypes.includes(type as CloudflareDnsRecordType)) {
    return type as CloudflareDnsRecordType
  }

  throw new Error('DNS 记录类型只支持 A、AAAA、CNAME、TXT 或 MX')
}

export function cloudflareRecordTypeSupportsProxy(type: CloudflareDnsRecordType): boolean {
  return type === 'A' || type === 'AAAA' || type === 'CNAME'
}

export function normalizeCloudflareDnsRecordName(name: string, domain: string): string {
  const normalizedDomain = normalizeDomain(domain)
  const normalizedName = trimText(name).replace(/\.+$/, '').toLowerCase()

  if (!normalizedName || normalizedName === '@') {
    return normalizedDomain
  }

  if (!normalizedDomain || normalizedName === normalizedDomain || normalizedName.endsWith(`.${normalizedDomain}`)) {
    return normalizedName
  }

  return `${normalizedName}.${normalizedDomain}`
}

function normalizeTtl(value: unknown): number {
  const ttl = Number(value ?? 1)

  return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 1
}

function normalizePriority(value: unknown): number {
  const priority = Number(value ?? 0)

  return Number.isFinite(priority) && priority >= 0 ? Math.floor(priority) : 0
}

function mapSettingsRow(row: Record<string, unknown>, includeSecret = false): ProjectCloudflareSettings {
  const apiToken = String(row.api_token ?? '')

  return {
    projectId: String(row.project_id ?? ''),
    domain: String(row.domain ?? ''),
    zoneId: String(row.zone_id ?? ''),
    apiToken: includeSecret ? apiToken : '',
    tokenConfigured: Boolean(apiToken),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function mapDnsRecord(value: unknown): CloudflareDnsRecord {
  const record = asRecord(value)
  const type = normalizeRecordType(record.type)

  return {
    id: stringField(record, 'id'),
    type,
    name: stringField(record, 'name'),
    content: stringField(record, 'content'),
    ttl: numberField(record, 'ttl'),
    proxied: booleanField(record, 'proxied'),
    proxiable: booleanField(record, 'proxiable'),
    priority: numberField(record, 'priority'),
    comment: stringField(record, 'comment'),
    createdAt: stringField(record, 'created_on', 'createdAt'),
    modifiedAt: stringField(record, 'modified_on', 'modifiedAt')
  }
}

function getProjectCloudflareSettingsSecret(db: DatabaseLike, projectId: string): ProjectCloudflareSettings | null {
  const row = db.prepare('SELECT * FROM project_cloudflare_settings WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined

  return row ? mapSettingsRow(row, true) : null
}

function resolveProjectCloudflareSettingsSecret(
  db: DatabaseLike,
  projectId: string,
  input?: ProjectCloudflareSettingsInput
): ProjectCloudflareSettings {
  const normalizedProjectId = assertProjectExists(db, projectId)
  const existing = getProjectCloudflareSettingsSecret(db, normalizedProjectId)

  if (!existing && !input) {
    throw new Error('请先在项目设置里配置 Cloudflare')
  }

  const domain = normalizeDomain(input?.domain ?? existing?.domain)
  const zoneId = normalizeZoneId(input?.zoneId ?? existing?.zoneId)
  const inputToken = normalizeApiToken(input?.apiToken)
  const apiToken = inputToken || existing?.apiToken || ''

  if (!domain) {
    throw new Error('请输入 Cloudflare 域名')
  }

  if (!zoneId) {
    throw new Error('请输入 Cloudflare Zone ID')
  }

  if (!apiToken) {
    throw new Error('请填写 Cloudflare API Token')
  }

  return {
    projectId: normalizedProjectId,
    domain,
    zoneId,
    apiToken,
    tokenConfigured: Boolean(apiToken),
    createdAt: existing?.createdAt ?? '',
    updatedAt: existing?.updatedAt ?? ''
  }
}

function createCloudflareUrl(pathname: string, params: Record<string, string | number | undefined> = {}): URL {
  const url = new URL(pathname.replace(/^\/+/, ''), `${cloudflareApiBaseUrl}/`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

function createCloudflareHeaders(settings: Pick<ProjectCloudflareSettings, 'apiToken'>): Record<string, string> {
  return {
    Authorization: `Bearer ${settings.apiToken}`,
    'Content-Type': 'application/json'
  }
}

function parseCloudflareErrors(payload: Record<string, unknown>): string {
  const errors = asArray(payload.errors)
    .map((item) => {
      const error = asRecord(item)
      return stringField(error, 'message') || stringField(error, 'code')
    })
    .filter(Boolean)

  return errors.join('；')
}

async function readCloudflareJson(response: Response, context: string): Promise<unknown> {
  const text = await response.text().catch(() => '')
  let payload: unknown = {}

  if (text.trim()) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { errors: [{ message: text }] }
    }
  }

  const record = asRecord(payload)
  const apiError = parseCloudflareErrors(record)

  if (!response.ok || record.success === false) {
    const detail = apiError || text || response.statusText
    throw new Error(`${context}失败：${response.status} ${response.statusText}${detail ? ` ${detail}` : ''}`.trim())
  }

  return payload
}

async function requestCloudflareJson(
  settings: ProjectCloudflareSettings,
  pathname: string,
  context: string,
  fetcher: CloudflareFetch,
  init?: RequestInit,
  params: Record<string, string | number | undefined> = {}
): Promise<unknown> {
  if (!settings.apiToken) {
    throw new Error('请填写 Cloudflare API Token')
  }

  const response = await fetcher(createCloudflareUrl(pathname, params), {
    ...(init ?? {}),
    headers: {
      ...createCloudflareHeaders(settings),
      ...(init?.headers as Record<string, string> | undefined)
    }
  })

  return readCloudflareJson(response, context)
}

async function listCloudflareDnsRecords(
  settings: ProjectCloudflareSettings,
  fetcher: CloudflareFetch,
  perPage = 100
): Promise<CloudflareDnsRecord[]> {
  const records: CloudflareDnsRecord[] = []

  for (let page = 1; page <= 20; page += 1) {
    const payload = asRecord(
      await requestCloudflareJson(
        settings,
        `/zones/${encodeURIComponent(settings.zoneId)}/dns_records`,
        '读取 Cloudflare DNS 记录',
        fetcher,
        undefined,
        { page, per_page: perPage }
      )
    )
    records.push(...asArray(payload.result).map(mapDnsRecord).filter((record) => record.id))

    const resultInfo = asRecord(payload.result_info)
    const totalPages = numberField(resultInfo, 'total_pages')

    if (!totalPages || page >= totalPages) {
      break
    }
  }

  return records
}

function createDnsRecordBody(settings: ProjectCloudflareSettings, input: CloudflareDnsRecordInput): Record<string, unknown> {
  const type = normalizeRecordType(input.type)
  const name = normalizeCloudflareDnsRecordName(input.name, settings.domain)
  const content = trimText(input.content)

  if (!name) {
    throw new Error('请输入 DNS 记录名称')
  }

  if (!content) {
    throw new Error('请输入 DNS 记录内容')
  }

  return {
    type,
    name,
    content,
    ttl: normalizeTtl(input.ttl),
    ...(cloudflareRecordTypeSupportsProxy(type) ? { proxied: input.proxied === true } : {}),
    ...(type === 'MX' ? { priority: normalizePriority(input.priority) } : {}),
    ...(trimText(input.comment) ? { comment: trimText(input.comment) } : {})
  }
}

export function migrateProjectCloudflareTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_cloudflare_settings (
      project_id TEXT PRIMARY KEY,
      domain TEXT NOT NULL DEFAULT '',
      zone_id TEXT NOT NULL DEFAULT '',
      api_token TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export function getProjectCloudflareSettings(db: DatabaseLike, projectId: string): ProjectCloudflareSettings | null {
  const normalizedProjectId = assertProjectExists(db, projectId)
  const row = db.prepare('SELECT * FROM project_cloudflare_settings WHERE project_id = ?').get(normalizedProjectId) as Record<string, unknown> | undefined

  return row ? mapSettingsRow(row) : null
}

export function saveProjectCloudflareSettings(db: DatabaseLike, input: ProjectCloudflareSettingsInput): ProjectCloudflareSettings {
  const projectId = assertProjectExists(db, input.projectId)
  const existing = getProjectCloudflareSettingsSecret(db, projectId)
  const domain = normalizeDomain(input.domain ?? existing?.domain)
  const zoneId = normalizeZoneId(input.zoneId ?? existing?.zoneId)
  const inputToken = normalizeApiToken(input.apiToken)
  const apiToken = inputToken || existing?.apiToken || ''
  const now = nowIso()

  if (!domain) {
    throw new Error('请输入 Cloudflare 域名')
  }

  if (!zoneId) {
    throw new Error('请输入 Cloudflare Zone ID')
  }

  if (!apiToken) {
    throw new Error('请填写 Cloudflare API Token')
  }

  if (existing) {
    db.prepare(
      `
      UPDATE project_cloudflare_settings
      SET domain = ?, zone_id = ?, api_token = ?, updated_at = ?
      WHERE project_id = ?
    `
    ).run(domain, zoneId, apiToken, now, projectId)
  } else {
    db.prepare(
      `
      INSERT INTO project_cloudflare_settings (project_id, domain, zone_id, api_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(projectId, domain, zoneId, apiToken, now, now)
  }

  const settings = getProjectCloudflareSettings(db, projectId)

  if (!settings) {
    throw new Error('Cloudflare 配置保存失败')
  }

  return settings
}

export function deleteProjectCloudflareSettings(db: DatabaseLike, projectId: string): void {
  const normalizedProjectId = assertProjectExists(db, projectId)
  db.prepare('DELETE FROM project_cloudflare_settings WHERE project_id = ?').run(normalizedProjectId)
}

export async function testProjectCloudflareConnection(
  db: DatabaseLike,
  projectId: string,
  input?: ProjectCloudflareSettingsInput,
  fetcher: CloudflareFetch = fetch
): Promise<CloudflareConnectionTestResult> {
  try {
    const settings = resolveProjectCloudflareSettingsSecret(db, projectId, input)
    await requestCloudflareJson(settings, '/user/tokens/verify', '验证 Cloudflare Token', fetcher)
    const records = await listCloudflareDnsRecords(settings, fetcher, 1)

    return {
      ok: true,
      message: `Cloudflare 连接成功：${settings.domain}`,
      recordCount: records.length
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Cloudflare 连接失败',
      recordCount: 0
    }
  }
}

export async function listProjectCloudflareDnsRecords(
  db: DatabaseLike,
  projectId: string,
  fetcher: CloudflareFetch = fetch
): Promise<CloudflareDnsRecord[]> {
  const settings = resolveProjectCloudflareSettingsSecret(db, projectId)
  return listCloudflareDnsRecords(settings, fetcher)
}

export async function saveProjectCloudflareDnsRecord(
  db: DatabaseLike,
  projectId: string,
  input: CloudflareDnsRecordInput,
  fetcher: CloudflareFetch = fetch
): Promise<CloudflareDnsRecord[]> {
  const settings = resolveProjectCloudflareSettingsSecret(db, projectId)
  const id = trimText(input.id)
  const body = createDnsRecordBody(settings, input)
  const method = id ? 'PUT' : 'POST'
  const pathname = id
    ? `/zones/${encodeURIComponent(settings.zoneId)}/dns_records/${encodeURIComponent(id)}`
    : `/zones/${encodeURIComponent(settings.zoneId)}/dns_records`

  await requestCloudflareJson(settings, pathname, id ? '更新 Cloudflare DNS 记录' : '创建 Cloudflare DNS 记录', fetcher, {
    method,
    body: JSON.stringify(body)
  })

  return listCloudflareDnsRecords(settings, fetcher)
}

export async function deleteProjectCloudflareDnsRecord(
  db: DatabaseLike,
  projectId: string,
  recordId: string,
  fetcher: CloudflareFetch = fetch
): Promise<CloudflareDnsRecord[]> {
  const settings = resolveProjectCloudflareSettingsSecret(db, projectId)
  const id = trimText(recordId)

  if (!id) {
    throw new Error('缺少 Cloudflare DNS 记录 ID')
  }

  await requestCloudflareJson(
    settings,
    `/zones/${encodeURIComponent(settings.zoneId)}/dns_records/${encodeURIComponent(id)}`,
    '删除 Cloudflare DNS 记录',
    fetcher,
    { method: 'DELETE' }
  )

  return listCloudflareDnsRecords(settings, fetcher)
}
