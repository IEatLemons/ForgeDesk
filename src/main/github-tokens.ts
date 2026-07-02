import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type GithubTokenType = 'classic' | 'fine-grained-or-app' | 'unknown'

export type GithubTokenRecord = {
  id: string
  name: string
  token: string
  tokenLastFour: string
  githubLogin: string
  scopes: string[]
  tokenType: GithubTokenType
  permissionSummary: string
  createdAt: string
  updatedAt: string
  lastCheckedAt: string
}

export type GithubTokenView = Omit<GithubTokenRecord, 'token'> & {
  tokenConfigured: boolean
}

export type GithubTokenInput = {
  id?: string
  name: string
  token?: string
}

type GithubTokenSettingsFile = {
  tokens: GithubTokenRecord[]
}

type GithubUserPayload = {
  login?: string
  message?: string
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const defaultGithubTokenSettings: GithubTokenSettingsFile = {
  tokens: []
}

function getGithubTokensPath(userDataPath: string): string {
  return join(userDataPath, 'github-tokens.json')
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getTokenLastFour(token: string): string {
  return token.slice(Math.max(0, token.length - 4))
}

export function parseGithubScopes(headerValue: string | null): string[] {
  return (headerValue ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
}

function createPermissionSummary(scopes: string[]): string {
  if (scopes.length > 0) {
    return scopes.join(', ')
  }

  return 'GitHub 未返回 OAuth scopes；可能是 fine-grained PAT 或 GitHub App token'
}

function normalizeGithubTokenRecord(input: Partial<GithubTokenRecord>): GithubTokenRecord | null {
  const id = normalizeText(input.id)
  const token = normalizeText(input.token)

  if (!id || !token) {
    return null
  }

  const scopes = Array.isArray(input.scopes) ? input.scopes.map(normalizeText).filter(Boolean) : []
  const now = new Date().toISOString()

  return {
    id,
    name: normalizeText(input.name) || 'GitHub Token',
    token,
    tokenLastFour: normalizeText(input.tokenLastFour) || getTokenLastFour(token),
    githubLogin: normalizeText(input.githubLogin),
    scopes,
    tokenType: input.tokenType === 'classic' || input.tokenType === 'fine-grained-or-app' ? input.tokenType : 'unknown',
    permissionSummary: normalizeText(input.permissionSummary) || createPermissionSummary(scopes),
    createdAt: normalizeText(input.createdAt) || now,
    updatedAt: normalizeText(input.updatedAt) || now,
    lastCheckedAt: normalizeText(input.lastCheckedAt) || ''
  }
}

function normalizeGithubTokenSettings(input: Partial<GithubTokenSettingsFile>): GithubTokenSettingsFile {
  return {
    tokens: (Array.isArray(input.tokens) ? input.tokens : [])
      .map((token) => normalizeGithubTokenRecord(token))
      .filter((token): token is GithubTokenRecord => Boolean(token))
  }
}

function redactGithubToken(record: GithubTokenRecord): GithubTokenView {
  const { token: _token, ...view } = record
  return {
    ...view,
    tokenConfigured: Boolean(record.token)
  }
}

function sortGithubTokenViews(tokens: GithubTokenRecord[]): GithubTokenView[] {
  return [...tokens]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(redactGithubToken)
}

export async function readGithubTokenSettingsFile(userDataPath: string): Promise<GithubTokenSettingsFile> {
  try {
    const content = await readFile(getGithubTokensPath(userDataPath), 'utf8')
    return normalizeGithubTokenSettings(JSON.parse(content) as Partial<GithubTokenSettingsFile>)
  } catch {
    return defaultGithubTokenSettings
  }
}

async function writeGithubTokenSettingsFile(userDataPath: string, settings: GithubTokenSettingsFile): Promise<GithubTokenSettingsFile> {
  const normalized = normalizeGithubTokenSettings(settings)

  await mkdir(userDataPath, { recursive: true })
  await writeFile(getGithubTokensPath(userDataPath), `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 })

  return normalized
}

export async function inspectGithubToken(token: string, fetchImpl: FetchLike = globalThis.fetch): Promise<Pick<GithubTokenRecord, 'githubLogin' | 'scopes' | 'tokenType' | 'permissionSummary' | 'lastCheckedAt'>> {
  const trimmedToken = token.trim()

  if (!trimmedToken) {
    throw new Error('请填写 GitHub Token')
  }

  const response = await fetchImpl('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${trimmedToken}`,
      'user-agent': 'ForgeDesk',
      'x-github-api-version': '2022-11-28'
    }
  })
  const payload = await response.json().catch(() => ({})) as GithubUserPayload

  if (!response.ok) {
    throw new Error(payload.message ? `GitHub Token 校验失败：${payload.message}` : `GitHub Token 校验失败：HTTP ${response.status}`)
  }

  const scopes = parseGithubScopes(response.headers.get('x-oauth-scopes'))
  const tokenType: GithubTokenType = scopes.length > 0
    ? 'classic'
    : response.headers.get('github-authentication-token-expiration')
      ? 'fine-grained-or-app'
      : 'unknown'

  return {
    githubLogin: normalizeText(payload.login),
    scopes,
    tokenType,
    permissionSummary: createPermissionSummary(scopes),
    lastCheckedAt: new Date().toISOString()
  }
}

export async function listGithubTokens(userDataPath: string): Promise<GithubTokenView[]> {
  const settings = await readGithubTokenSettingsFile(userDataPath)
  return sortGithubTokenViews(settings.tokens)
}

export async function saveGithubToken(userDataPath: string, input: GithubTokenInput, fetchImpl?: FetchLike): Promise<GithubTokenView[]> {
  const settings = await readGithubTokenSettingsFile(userDataPath)
  const id = normalizeText(input.id) || randomUUID()
  const existing = settings.tokens.find((token) => token.id === id)
  const nextToken = normalizeText(input.token) || existing?.token || ''
  const name = normalizeText(input.name)

  if (!name) {
    throw new Error('请填写 GitHub Token 名称')
  }

  if (!nextToken) {
    throw new Error('请填写 GitHub Token')
  }

  const verification = normalizeText(input.token)
    ? await inspectGithubToken(nextToken, fetchImpl)
    : existing
      ? {
          githubLogin: existing.githubLogin,
          scopes: existing.scopes,
          tokenType: existing.tokenType,
          permissionSummary: existing.permissionSummary,
          lastCheckedAt: existing.lastCheckedAt
        }
      : await inspectGithubToken(nextToken, fetchImpl)
  const now = new Date().toISOString()
  const nextRecord: GithubTokenRecord = {
    id,
    name,
    token: nextToken,
    tokenLastFour: getTokenLastFour(nextToken),
    githubLogin: verification.githubLogin,
    scopes: verification.scopes,
    tokenType: verification.tokenType,
    permissionSummary: verification.permissionSummary,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastCheckedAt: verification.lastCheckedAt
  }
  const nextTokens = existing
    ? settings.tokens.map((token) => (token.id === id ? nextRecord : token))
    : [nextRecord, ...settings.tokens]
  const nextSettings = await writeGithubTokenSettingsFile(userDataPath, { tokens: nextTokens })

  return sortGithubTokenViews(nextSettings.tokens)
}

export async function refreshGithubToken(userDataPath: string, tokenId: string, fetchImpl?: FetchLike): Promise<GithubTokenView[]> {
  const settings = await readGithubTokenSettingsFile(userDataPath)
  const id = tokenId.trim()
  const existing = settings.tokens.find((token) => token.id === id)

  if (!existing) {
    throw new Error('找不到这个 GitHub Token')
  }

  const verification = await inspectGithubToken(existing.token, fetchImpl)
  const now = new Date().toISOString()
  const nextRecord: GithubTokenRecord = {
    ...existing,
    githubLogin: verification.githubLogin,
    scopes: verification.scopes,
    tokenType: verification.tokenType,
    permissionSummary: verification.permissionSummary,
    updatedAt: now,
    lastCheckedAt: verification.lastCheckedAt
  }
  const nextSettings = await writeGithubTokenSettingsFile(userDataPath, {
    tokens: settings.tokens.map((token) => (token.id === id ? nextRecord : token))
  })

  return sortGithubTokenViews(nextSettings.tokens)
}

export async function deleteGithubToken(userDataPath: string, tokenId: string): Promise<GithubTokenView[]> {
  const settings = await readGithubTokenSettingsFile(userDataPath)
  const id = tokenId.trim()
  const nextSettings = await writeGithubTokenSettingsFile(userDataPath, {
    tokens: settings.tokens.filter((token) => token.id !== id)
  })

  return sortGithubTokenViews(nextSettings.tokens)
}

export async function getGithubTokenSecret(userDataPath: string, tokenId: string): Promise<string> {
  const settings = await readGithubTokenSettingsFile(userDataPath)
  const token = settings.tokens.find((item) => item.id === tokenId.trim())?.token

  if (!token) {
    throw new Error('找不到这个 GitHub Token')
  }

  return token
}
