import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type CodemagicTokenRecord = {
  id: string
  name: string
  token: string
  tokenLastFour: string
  userId: string
  teamCount: number
  appCount: number
  permissionSummary: string
  createdAt: string
  updatedAt: string
  lastCheckedAt: string
}

export type CodemagicTokenView = Omit<CodemagicTokenRecord, 'token'> & {
  tokenConfigured: boolean
}

export type CodemagicTokenInput = {
  id?: string
  name: string
  token?: string
}

export type CodemagicTeam = {
  id: string
  name: string
}

export type CodemagicApp = {
  id: string
  name: string
  teamId: string
  repositoryUrl: string
  settingsSource: string
  projectType: string
  lastBuildId: string
  archived: boolean
}

export type CodemagicArtifact = {
  name: string
  type: string
  sizeInBytes: number
  downloadUrl: string
  versionCode: string
  versionName: string
}

export type CodemagicBuild = {
  id: string
  appId: string
  workflowId: string
  workflowName: string
  status: string
  branch: string
  tag: string
  commit: string
  createdAt: string
  startedAt: string
  finishedAt: string
  artifacts: CodemagicArtifact[]
}

export type CodemagicBuildStartInput = {
  appId: string
  workflowId: string
  branch?: string
  tag?: string
  labels?: string[]
  environment?: {
    variables?: Record<string, string>
    groups?: string[]
    softwareVersions?: Record<string, string>
  }
}

type CodemagicTokenSettingsFile = {
  tokens: CodemagicTokenRecord[]
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const codemagicApiBaseUrl = 'https://api.codemagic.io'
const codemagicV3BaseUrl = 'https://codemagic.io'
const defaultCodemagicTokenSettings: CodemagicTokenSettingsFile = { tokens: [] }

function getCodemagicTokensPath(userDataPath: string): string {
  return join(userDataPath, 'codemagic-tokens.json')
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getTokenLastFour(token: string): string {
  return token.slice(Math.max(0, token.length - 4))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
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

function boolField(record: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase() === 'true'
    }
  }

  return false
}

function normalizeStringArray(values: unknown): string[] {
  return asArray(values)
    .map((value) => normalizeText(value))
    .filter(Boolean)
}

function getCodemagicHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-auth-token': token
  }
}

async function readJsonResponse(response: Response, context: string): Promise<unknown> {
  const text = await response.text().catch(() => '')
  let payload: unknown = {}

  try {
    payload = text ? JSON.parse(text) as unknown : {}
  } catch {
    payload = { detail: text }
  }

  if (!response.ok) {
    const record = asRecord(payload)
    const detail = stringField(record, 'detail', 'message', 'error') || text
    const retryAfter = response.headers.get('ratelimit-reset') || response.headers.get('retry-after')
    const rateLimitHint = response.status === 429 && retryAfter ? `，请在 ${retryAfter} 秒后重试` : ''
    throw new Error(`${context}失败：HTTP ${response.status}${detail ? ` ${detail}` : ''}${rateLimitHint}`)
  }

  return payload
}

function unwrapData(payload: unknown): unknown {
  const record = asRecord(payload)
  return Object.hasOwn(record, 'data') ? record.data : payload
}

function normalizeCodemagicTokenRecord(input: Partial<CodemagicTokenRecord>): CodemagicTokenRecord | null {
  const id = normalizeText(input.id)
  const token = normalizeText(input.token)

  if (!id || !token) {
    return null
  }

  const now = new Date().toISOString()

  return {
    id,
    name: normalizeText(input.name) || 'Codemagic Token',
    token,
    tokenLastFour: normalizeText(input.tokenLastFour) || getTokenLastFour(token),
    userId: normalizeText(input.userId),
    teamCount: Number(input.teamCount ?? 0),
    appCount: Number(input.appCount ?? 0),
    permissionSummary: normalizeText(input.permissionSummary) || 'Codemagic API Token',
    createdAt: normalizeText(input.createdAt) || now,
    updatedAt: normalizeText(input.updatedAt) || now,
    lastCheckedAt: normalizeText(input.lastCheckedAt) || ''
  }
}

function normalizeCodemagicTokenSettings(input: Partial<CodemagicTokenSettingsFile>): CodemagicTokenSettingsFile {
  return {
    tokens: (Array.isArray(input.tokens) ? input.tokens : [])
      .map((token) => normalizeCodemagicTokenRecord(token))
      .filter((token): token is CodemagicTokenRecord => Boolean(token))
  }
}

function redactCodemagicToken(record: CodemagicTokenRecord): CodemagicTokenView {
  const { token: _token, ...view } = record
  return {
    ...view,
    tokenConfigured: Boolean(record.token)
  }
}

function sortCodemagicTokenViews(tokens: CodemagicTokenRecord[]): CodemagicTokenView[] {
  return [...tokens]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(redactCodemagicToken)
}

export async function readCodemagicTokenSettingsFile(userDataPath: string): Promise<CodemagicTokenSettingsFile> {
  try {
    const content = await readFile(getCodemagicTokensPath(userDataPath), 'utf8')
    return normalizeCodemagicTokenSettings(JSON.parse(content) as Partial<CodemagicTokenSettingsFile>)
  } catch {
    return defaultCodemagicTokenSettings
  }
}

async function writeCodemagicTokenSettingsFile(userDataPath: string, settings: CodemagicTokenSettingsFile): Promise<CodemagicTokenSettingsFile> {
  const normalized = normalizeCodemagicTokenSettings(settings)

  await mkdir(userDataPath, { recursive: true })
  await writeFile(getCodemagicTokensPath(userDataPath), `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 })

  return normalized
}

export async function inspectCodemagicToken(
  token: string,
  fetchImpl: FetchLike = globalThis.fetch
): Promise<Pick<CodemagicTokenRecord, 'userId' | 'teamCount' | 'appCount' | 'permissionSummary' | 'lastCheckedAt'>> {
  const trimmedToken = token.trim()

  if (!trimmedToken) {
    throw new Error('请填写 Codemagic API Token')
  }

  const [userPayload, teamsPayload, appsPayload] = await Promise.all([
    codemagicRequest('/api/v3/user', trimmedToken, undefined, 'Codemagic Token 校验', fetchImpl),
    codemagicRequest('/api/v3/user/teams?page_size=1', trimmedToken, undefined, '读取 Codemagic 团队', fetchImpl),
    codemagicRequest('/api/v3/user/apps?page_size=1', trimmedToken, undefined, '读取 Codemagic 应用', fetchImpl)
  ])
  const user = asRecord(unwrapData(userPayload))
  const teams = asRecord(teamsPayload)
  const apps = asRecord(appsPayload)
  const teamCount = asArray(teams.data).length || Number(teams.total_pages ?? 0)
  const appCount = asArray(apps.data).length || Number(apps.total_pages ?? 0)

  return {
    userId: stringField(user, 'id'),
    teamCount,
    appCount,
    permissionSummary: `可读取 ${teamCount} 个团队、${appCount} 个应用`,
    lastCheckedAt: new Date().toISOString()
  }
}

export async function listCodemagicTokens(userDataPath: string): Promise<CodemagicTokenView[]> {
  const settings = await readCodemagicTokenSettingsFile(userDataPath)
  return sortCodemagicTokenViews(settings.tokens)
}

export async function saveCodemagicToken(userDataPath: string, input: CodemagicTokenInput, fetchImpl?: FetchLike): Promise<CodemagicTokenView[]> {
  const settings = await readCodemagicTokenSettingsFile(userDataPath)
  const id = normalizeText(input.id) || randomUUID()
  const existing = settings.tokens.find((token) => token.id === id)
  const nextToken = normalizeText(input.token) || existing?.token || ''
  const name = normalizeText(input.name)

  if (!name) {
    throw new Error('请填写 Codemagic Token 名称')
  }

  if (!nextToken) {
    throw new Error('请填写 Codemagic API Token')
  }

  const verification = normalizeText(input.token)
    ? await inspectCodemagicToken(nextToken, fetchImpl)
    : existing
      ? {
          userId: existing.userId,
          teamCount: existing.teamCount,
          appCount: existing.appCount,
          permissionSummary: existing.permissionSummary,
          lastCheckedAt: existing.lastCheckedAt
        }
      : await inspectCodemagicToken(nextToken, fetchImpl)
  const now = new Date().toISOString()
  const nextRecord: CodemagicTokenRecord = {
    id,
    name,
    token: nextToken,
    tokenLastFour: getTokenLastFour(nextToken),
    userId: verification.userId,
    teamCount: verification.teamCount,
    appCount: verification.appCount,
    permissionSummary: verification.permissionSummary,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastCheckedAt: verification.lastCheckedAt
  }
  const nextTokens = existing
    ? settings.tokens.map((token) => (token.id === id ? nextRecord : token))
    : [nextRecord, ...settings.tokens]
  const nextSettings = await writeCodemagicTokenSettingsFile(userDataPath, { tokens: nextTokens })

  return sortCodemagicTokenViews(nextSettings.tokens)
}

export async function refreshCodemagicToken(userDataPath: string, tokenId: string, fetchImpl?: FetchLike): Promise<CodemagicTokenView[]> {
  const settings = await readCodemagicTokenSettingsFile(userDataPath)
  const id = tokenId.trim()
  const existing = settings.tokens.find((token) => token.id === id)

  if (!existing) {
    throw new Error('找不到这个 Codemagic Token')
  }

  const verification = await inspectCodemagicToken(existing.token, fetchImpl)
  const now = new Date().toISOString()
  const nextRecord: CodemagicTokenRecord = {
    ...existing,
    userId: verification.userId,
    teamCount: verification.teamCount,
    appCount: verification.appCount,
    permissionSummary: verification.permissionSummary,
    updatedAt: now,
    lastCheckedAt: verification.lastCheckedAt
  }
  const nextSettings = await writeCodemagicTokenSettingsFile(userDataPath, {
    tokens: settings.tokens.map((token) => (token.id === id ? nextRecord : token))
  })

  return sortCodemagicTokenViews(nextSettings.tokens)
}

export async function deleteCodemagicToken(userDataPath: string, tokenId: string): Promise<CodemagicTokenView[]> {
  const settings = await readCodemagicTokenSettingsFile(userDataPath)
  const id = tokenId.trim()
  const nextSettings = await writeCodemagicTokenSettingsFile(userDataPath, {
    tokens: settings.tokens.filter((token) => token.id !== id)
  })

  return sortCodemagicTokenViews(nextSettings.tokens)
}

export async function getCodemagicTokenSecret(userDataPath: string, tokenId: string): Promise<string> {
  const settings = await readCodemagicTokenSettingsFile(userDataPath)
  const token = settings.tokens.find((item) => item.id === tokenId.trim())

  if (!token?.token) {
    throw new Error('找不到这个 Codemagic Token')
  }

  return token.token
}

export async function codemagicRequest(
  path: string,
  token: string,
  init: RequestInit | undefined,
  context: string,
  fetchImpl: FetchLike = globalThis.fetch
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${codemagicV3BaseUrl}${path}`
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      ...getCodemagicHeaders(token),
      ...(init?.headers as Record<string, string> | undefined)
    }
  })

  return readJsonResponse(response, context)
}

function mapCodemagicTeam(item: unknown): CodemagicTeam {
  const record = asRecord(item)
  return {
    id: stringField(record, 'id', '_id'),
    name: stringField(record, 'name')
  }
}

function mapCodemagicApp(item: unknown, teamId = ''): CodemagicApp {
  const record = asRecord(item)
  const repository = asRecord(record.repository)

  return {
    id: stringField(record, 'id', '_id'),
    name: stringField(record, 'name', 'appName'),
    teamId,
    repositoryUrl: stringField(repository, 'url', 'ssh_url', 'clone_url', 'repositoryUrl'),
    settingsSource: stringField(record, 'settings_source', 'settingsSource'),
    projectType: stringField(record, 'project_type', 'projectType'),
    lastBuildId: stringField(record, 'last_build_id', 'lastBuildId'),
    archived: boolField(record, 'archived')
  }
}

async function readPaginatedCodemagicList(pathname: string, token: string, context: string, fetchImpl?: FetchLike): Promise<unknown[]> {
  const results: unknown[] = []
  let page = 1
  let totalPages = 1

  do {
    const separator = pathname.includes('?') ? '&' : '?'
    const payload = await codemagicRequest(`${pathname}${separator}page_size=100&page=${page}`, token, undefined, context, fetchImpl)
    const record = asRecord(payload)

    results.push(...asArray(record.data))
    totalPages = Math.max(1, Number(record.total_pages ?? 1))
    page += 1
  } while (page <= totalPages)

  return results
}

export async function listCodemagicTeams(token: string, fetchImpl?: FetchLike): Promise<CodemagicTeam[]> {
  const teams = await readPaginatedCodemagicList('/api/v3/user/teams', token, '读取 Codemagic 团队', fetchImpl)
  return teams.map(mapCodemagicTeam).filter((team) => team.id)
}

export async function listCodemagicApps(
  token: string,
  input: { teamId?: string; name?: string } = {},
  fetchImpl?: FetchLike
): Promise<CodemagicApp[]> {
  const params = new URLSearchParams()

  if (input.name?.trim()) {
    params.set('name', input.name.trim())
  }

  const query = params.toString()
  const pathname = input.teamId?.trim()
    ? `/api/v3/teams/${encodeURIComponent(input.teamId.trim())}/apps${query ? `?${query}` : ''}`
    : `/api/v3/user/apps${query ? `?${query}` : ''}`
  const apps = await readPaginatedCodemagicList(pathname, token, '读取 Codemagic 应用', fetchImpl)

  return apps.map((app) => mapCodemagicApp(app, input.teamId?.trim() ?? '')).filter((app) => app.id)
}

export async function startCodemagicBuild(
  token: string,
  input: CodemagicBuildStartInput,
  fetchImpl: FetchLike = globalThis.fetch
): Promise<{ buildId: string }> {
  const appId = input.appId.trim()
  const workflowId = input.workflowId.trim()
  const branch = input.branch?.trim()
  const tag = input.tag?.trim()

  if (!appId) {
    throw new Error('请填写 Codemagic App ID')
  }

  if (!workflowId) {
    throw new Error('请填写 Codemagic Workflow ID')
  }

  if (!branch && !tag) {
    throw new Error('Codemagic 构建需要分支或 Tag')
  }

  const payload = await codemagicRequest(
    `${codemagicApiBaseUrl}/builds`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        appId,
        workflowId,
        ...(branch ? { branch } : {}),
        ...(tag ? { tag } : {}),
        labels: normalizeStringArray(input.labels),
        ...(input.environment ? { environment: input.environment } : {})
      })
    },
    '启动 Codemagic 构建',
    fetchImpl
  )
  const record = asRecord(payload)
  const buildId = stringField(record, 'buildId', 'id', '_id')

  if (!buildId) {
    throw new Error('启动 Codemagic 构建失败：响应中没有 buildId')
  }

  return { buildId }
}

function mapCodemagicArtifact(item: unknown): CodemagicArtifact {
  const record = asRecord(item)

  return {
    name: stringField(record, 'name'),
    type: stringField(record, 'type'),
    sizeInBytes: numberField(record, 'size_in_bytes', 'sizeInBytes', 'size'),
    downloadUrl: stringField(record, 'short_lived_download_url', 'downloadUrl', 'url'),
    versionCode: stringField(record, 'version_code', 'versionCode'),
    versionName: stringField(record, 'version_name', 'versionName')
  }
}

export function mapCodemagicBuild(payload: unknown): CodemagicBuild {
  const record = asRecord(unwrapData(payload))
  const workflow = asRecord(record.workflow)
  const commit = asRecord(record.commit)

  return {
    id: stringField(record, 'id', '_id'),
    appId: stringField(record, 'app_id', 'appId'),
    workflowId: stringField(workflow, 'id'),
    workflowName: stringField(workflow, 'name') || stringField(workflow, 'id'),
    status: stringField(record, 'status'),
    branch: stringField(record, 'branch'),
    tag: stringField(record, 'tag'),
    commit: stringField(commit, 'hash', 'sha') || stringField(record, 'commit'),
    createdAt: stringField(record, 'created_at', 'createdAt'),
    startedAt: stringField(record, 'started_at', 'startedAt'),
    finishedAt: stringField(record, 'finished_at', 'finishedAt'),
    artifacts: asArray(record.artifacts).map(mapCodemagicArtifact)
  }
}

export async function getCodemagicBuild(token: string, buildId: string, fetchImpl?: FetchLike): Promise<CodemagicBuild> {
  const id = buildId.trim()

  if (!id) {
    throw new Error('请填写 Codemagic Build ID')
  }

  const payload = await codemagicRequest(`/api/v3/builds/${encodeURIComponent(id)}`, token, undefined, '读取 Codemagic 构建', fetchImpl)
  return mapCodemagicBuild(payload)
}

export async function cancelCodemagicBuild(token: string, buildId: string, fetchImpl: FetchLike = globalThis.fetch): Promise<void> {
  const id = buildId.trim()

  if (!id) {
    throw new Error('请填写 Codemagic Build ID')
  }

  await codemagicRequest(
    `${codemagicApiBaseUrl}/builds/${encodeURIComponent(id)}/cancel`,
    token,
    { method: 'POST' },
    '取消 Codemagic 构建',
    fetchImpl
  )
}

export async function createCodemagicArtifactPublicUrl(
  token: string,
  secureFilename: string,
  expiresAt: number,
  fetchImpl: FetchLike = globalThis.fetch
): Promise<{ url: string; expiresAt: string }> {
  const filename = secureFilename.trim().replace(/^\/+/, '')

  if (!filename) {
    throw new Error('请提供 Codemagic artifact 路径')
  }

  const payload = await codemagicRequest(
    `${codemagicApiBaseUrl}/artifacts/${filename}/public-url`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ expiresAt })
    },
    '生成 Codemagic 下载链接',
    fetchImpl
  )
  const record = asRecord(payload)

  return {
    url: stringField(record, 'url'),
    expiresAt: stringField(record, 'expiresAt', 'expires_at')
  }
}
