import { createServer, type Server } from 'node:http'
import * as oidc from 'openid-client'
import { railwayOAuthRedirectUri, railwayOAuthScopes, type RailwayOAuthSummary } from '../shared/railway-oauth.js'

const discoveryUrl = 'https://backboard.railway.com/oauth/.well-known/openid-configuration'
const issuer = 'https://backboard.railway.com'
const loginRequired = 'Railway 授权已失效，需要重新登录'
class RailwayOAuthError extends Error {}

export type RailwayOAuthDatabase = {
  exec(sql: string): void
  prepare(sql: string): {
    get(...args: any[]): unknown
    run(...args: any[]): unknown
  }
}

export type RailwayOAuthCodec = {
  isEncryptionAvailable(): boolean
  getSelectedStorageBackend?(): string
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

type Credentials = { accessToken: string; refreshToken: string; expiresAt: number; subject: string }
type CredentialRow = {
  client_id: string; account_name: string; account_email: string; scopes: string
  secret: string; status: string
}
export type RailwayOAuthGrant = {
  credentials: Credentials
  clientId: string
  accountName: string
  accountEmail: string
  scopes: string[]
}

type Options = {
  codec: RailwayOAuthCodec
  openExternal(url: string): Promise<unknown>
  fetcher?: oidc.CustomFetch
  now?: () => number
  timeoutMs?: number
}

const managers = new WeakMap<RailwayOAuthDatabase, RailwayOAuthManager>()

export function migrateRailwayOAuthTable(db: RailwayOAuthDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS railway_oauth_credentials (
    connection_id TEXT PRIMARY KEY REFERENCES global_service_connections(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL, account_name TEXT NOT NULL, account_email TEXT NOT NULL,
    scopes TEXT NOT NULL, secret TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'connected'
  )`)
}

export function getRailwayOAuthManager(db: RailwayOAuthDatabase): RailwayOAuthManager {
  const manager = managers.get(db)
  if (!manager) throw new Error('Railway OAuth 尚未初始化，请在桌面应用中重新登录')
  return manager
}

export class RailwayOAuthManager {
  private sessions = new Map<string, Credentials>()
  private refreshing = new Map<string, Promise<string>>()
  private versions = new Map<string, number>()
  private configurations = new Map<string, Promise<oidc.Configuration>>()
  private activeLogin?: { cancel(): void }
  private now: () => number

  constructor(private db: RailwayOAuthDatabase, private options: Options) {
    this.now = options.now ?? Date.now
    managers.set(db, this)
  }

  private row(id: string): CredentialRow | undefined {
    return this.db.prepare('SELECT * FROM railway_oauth_credentials WHERE connection_id = ?').get(id) as CredentialRow | undefined
  }

  private canEncrypt(): boolean {
    return this.options.codec.isEncryptionAvailable() && this.options.codec.getSelectedStorageBackend?.() !== 'basic_text'
  }

  summary(id: string): RailwayOAuthSummary | undefined {
    const row = this.row(id)
    if (!row) return undefined
    return {
      clientId: row.client_id, accountName: row.account_name, accountEmail: row.account_email,
      scopes: row.scopes.split(' ').filter(Boolean), persistent: Boolean(row.secret),
      status: row.status === 'connected' && (Boolean(row.secret) || this.sessions.has(id)) ? 'connected' : 'needs-login'
    }
  }

  private async configuration(clientId: string): Promise<oidc.Configuration> {
    let pending = this.configurations.get(clientId)
    if (!pending) {
      pending = oidc.discovery(new URL(discoveryUrl), clientId, { token_endpoint_auth_method: 'none', id_token_signed_response_alg: 'ES256' }, oidc.None(), {
        timeout: 20,
        execute: [oidc.enableNonRepudiationChecks],
        ...(this.options.fetcher ? { [oidc.customFetch]: this.options.fetcher } : {})
      }).then((config) => {
        if (config.serverMetadata().issuer !== issuer) throw new Error('Unexpected Railway issuer')
        return config
      })
      this.configurations.set(clientId, pending)
      void pending.catch(() => this.configurations.delete(clientId))
    }
    return pending
  }

  cancelLogin(): void { this.activeLogin?.cancel() }

  async login(clientId: string): Promise<RailwayOAuthGrant> {
    clientId = clientId.trim()
    if (!clientId || clientId.length > 512) throw new RailwayOAuthError('请填写有效的 Railway Native Client ID')
    if (this.activeLogin) throw new RailwayOAuthError('Railway 登录正在进行，请先完成或取消')
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const verifier = oidc.randomPKCECodeVerifier()
    let server: Server | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    let cancelled: RailwayOAuthError | undefined
    let resolveCallback!: (url: URL) => void
    let rejectCallback!: (error: Error) => void
    const callback = new Promise<URL>((resolve, reject) => { resolveCallback = resolve; rejectCallback = reject })
    // The callback can fail while discovery or the browser launch is still pending.
    void callback.catch(() => undefined)
    const fail = (message: string): void => {
      cancelled = new RailwayOAuthError(message)
      if (!settled) { settled = true; rejectCallback(cancelled) }
    }
    const close = (): void => { server?.close(); server?.closeAllConnections() }
    this.activeLogin = { cancel: () => { fail('Railway 登录已取消'); close() } }
    timer = setTimeout(() => { fail('Railway 登录超时，请重试'); close() }, this.options.timeoutMs ?? 300_000)
    try {
      const config = await Promise.race([this.configuration(clientId), callback.then(() => { throw new Error('Unexpected callback') })])
      if (cancelled) throw cancelled
      server = createServer((request, response) => {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Content-Security-Policy', "default-src 'none'")
        let url: URL
        try { url = new URL(request.url ?? '/', railwayOAuthRedirectUri) }
        catch { response.writeHead(400).end('Invalid callback'); return }
        if (request.method !== 'GET' || request.headers.host !== '127.0.0.1:43827' || url.origin !== new URL(railwayOAuthRedirectUri).origin || url.pathname !== '/oauth/railway/callback') {
          response.writeHead(404).end('Not found'); return
        }
        if (settled) { response.writeHead(409).end('此登录回调已处理'); return }
        if (url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== state) {
          response.writeHead(400).end('登录校验失败，请返回 ForgeDesk 重试'); return
        }
        if (url.searchParams.has('error')) {
          response.writeHead(400).end('授权未完成，请返回 ForgeDesk')
          fail(url.searchParams.get('error') === 'access_denied' ? 'Railway 授权已拒绝' : 'Railway 授权失败，请重新登录')
          return
        }
        if (url.searchParams.getAll('code').length !== 1 || !url.searchParams.get('code')) {
          response.writeHead(400).end('缺少授权码'); return
        }
        settled = true
        response.end('授权回调已收到，请返回 ForgeDesk 查看登录结果。')
        resolveCallback(url)
      })
      await new Promise<void>((resolve, reject) => {
        server!.once('error', () => reject(new RailwayOAuthError('Railway 登录回调端口 43827 被占用或无法监听，请释放端口后重试')))
        server!.listen(43827, '127.0.0.1', resolve)
      })
      if (cancelled) throw cancelled
      const authorizationUrl = oidc.buildAuthorizationUrl(config, {
        response_type: 'code', redirect_uri: railwayOAuthRedirectUri, scope: railwayOAuthScopes,
        state, nonce, code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256', prompt: 'consent'
      })
      try { await this.options.openExternal(authorizationUrl.href) } catch { throw new RailwayOAuthError('无法打开浏览器，请检查默认浏览器后重试') }
      const url = await callback
      const tokens = await oidc.authorizationCodeGrant(config, url, { expectedState: state, expectedNonce: nonce, pkceCodeVerifier: verifier, idTokenExpected: true })
      if (cancelled) throw cancelled
      const subject = tokens.claims()?.sub
      if (!subject || !tokens.refresh_token) throw new RailwayOAuthError('Railway 未返回完整授权，请确认 Native 应用配置并重新同意离线访问')
      const profile = await oidc.fetchUserInfo(config, tokens.access_token, subject)
      if (cancelled) throw cancelled
      const scopes = (tokens.scope ?? railwayOAuthScopes).split(' ').filter(Boolean)
      if (!scopes.includes('project:member')) throw new RailwayOAuthError('Railway 未授予项目权限，请重新授权')
      return {
        clientId, accountName: typeof profile.name === 'string' ? profile.name : subject,
        accountEmail: typeof profile.email === 'string' ? profile.email : '', scopes,
        credentials: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: this.now() + (tokens.expires_in ?? 3600) * 1000, subject }
      }
    } catch (error) {
      // Never forward provider descriptions, URLs, authorization codes or tokens to IPC/logs.
      if (cancelled) throw cancelled
      if (error instanceof RailwayOAuthError) throw error
      throw new Error('Railway OAuth 校验或通信失败，请检查 Native Client ID、回调配置后重新登录')
    } finally {
      clearTimeout(timer)
      close()
      this.activeLogin = undefined
    }
  }

  save(id: string, grant: RailwayOAuthGrant): void {
    const secret = this.canEncrypt() ? this.options.codec.encryptString(JSON.stringify(grant.credentials)).toString('base64') : ''
    this.db.prepare(`INSERT INTO railway_oauth_credentials (connection_id, client_id, account_name, account_email, scopes, secret, status)
      VALUES (?, ?, ?, ?, ?, ?, 'connected') ON CONFLICT(connection_id) DO UPDATE SET
      client_id=excluded.client_id, account_name=excluded.account_name, account_email=excluded.account_email,
      scopes=excluded.scopes, secret=excluded.secret, status='connected'`)
      .run(id, grant.clientId, grant.accountName, grant.accountEmail, grant.scopes.join(' '), secret)
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1)
    this.sessions.set(id, grant.credentials)
  }

  disconnect(id: string, remove = false): void {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1)
    this.sessions.delete(id)
    this.db.prepare(remove ? 'DELETE FROM railway_oauth_credentials WHERE connection_id = ?' : "UPDATE railway_oauth_credentials SET secret = '', status = 'needs-login' WHERE connection_id = ?").run(id)
  }

  async accessToken(id: string): Promise<string> {
    const row = this.row(id)
    if (!row || row.status !== 'connected') throw new Error(loginRequired)
    let credentials = this.sessions.get(id)
    if (!credentials && row.secret) {
      try { credentials = JSON.parse(this.options.codec.decryptString(Buffer.from(row.secret, 'base64'))) as Credentials }
      catch { this.disconnect(id); throw new Error(loginRequired) }
    }
    if (!credentials?.accessToken || !credentials.refreshToken || !Number.isFinite(credentials.expiresAt)) {
      this.disconnect(id); throw new Error(loginRequired)
    }
    this.sessions.set(id, credentials)
    if (credentials.expiresAt > this.now() + 60_000) return credentials.accessToken
    const pending = this.refreshing.get(id)
    if (pending) return pending
    const version = this.versions.get(id) ?? 0
    const refresh = (async () => {
      try {
        const config = await this.configuration(row.client_id)
        const tokens = await oidc.refreshTokenGrant(config, credentials.refreshToken)
        if ((this.versions.get(id) ?? 0) !== version) throw new Error(loginRequired)
        if (tokens.claims()?.sub && tokens.claims()!.sub !== credentials.subject) { this.disconnect(id); throw new Error(loginRequired) }
        this.save(id, {
          clientId: row.client_id, accountName: row.account_name, accountEmail: row.account_email,
          scopes: (tokens.scope ?? row.scopes).split(' ').filter(Boolean),
          credentials: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? credentials.refreshToken,
            expiresAt: this.now() + (tokens.expires_in ?? 3600) * 1000, subject: credentials.subject }
        })
        return tokens.access_token
      } catch (error) {
        if ((this.versions.get(id) ?? 0) !== version) throw new Error(loginRequired)
        if (error instanceof oidc.ResponseBodyError && ['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(error.error)) {
          this.disconnect(id); throw new Error(loginRequired)
        }
        throw new Error('Railway 授权刷新失败，请稍后重试')
      }
    })()
    this.refreshing.set(id, refresh)
    try { return await refresh } finally { if (this.refreshing.get(id) === refresh) this.refreshing.delete(id) }
  }
}
