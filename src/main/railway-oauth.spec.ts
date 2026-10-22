import assert from 'node:assert/strict'
import { createCipheriv, createDecipheriv, createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import type { CustomFetch } from 'openid-client'
import { RailwayOAuthManager, type RailwayOAuthCodec, type RailwayOAuthGrant } from './railway-oauth.js'
import { listServiceConnections, migrateServiceMonitoringTables, saveServiceConnection, saveProjectService, listAllProjectServices, deleteServiceConnection, syncServiceConnection } from './service-monitoring.js'
import { railwayOAuthRedirectUri, railwayOAuthScopes } from '../shared/railway-oauth.js'

const issuer = 'https://backboard.railway.com'
const key = randomBytes(32)
const codec: RailwayOAuthCodec = {
  isEncryptionAvailable: () => true,
  encryptString(value) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()])
  },
  decryptString(value) {
    const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12))
    decipher.setAuthTag(value.subarray(-16))
    return Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]).toString()
  }
}

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY)')
  migrateServiceMonitoringTables(db)
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', use: 'sig', alg: 'ES256' }
  const requests: Array<{ url: string; body: URLSearchParams; headers: Record<string, string> }> = []
  let authorization: URL
  let onOpen: (url: URL) => Promise<unknown> = async (url) => {
    await fetch(`${railwayOAuthRedirectUri}?code=single-use-code&state=${url.searchParams.get('state')}&iss=${encodeURIComponent(issuer)}`)
  }
  let nonceOverride: string | undefined
  let invalidSignature = false
  let invalidIssuer = false
  let profileSubject = 'user-1'
  let refreshError = ''
  let refreshCount = 0
  let failNetwork = false
  let now = Date.now()
  let releaseRefresh: (() => void) | undefined
  let waitRefresh: Promise<void> | undefined
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const fetcher: CustomFetch = async (url, options) => {
    const body = new URLSearchParams(String(options.body ?? ''))
    requests.push({ url, body, headers: options.headers })
    if (url.includes('openid-configuration')) return json({
      issuer, authorization_endpoint: `${issuer}/oauth/auth`, token_endpoint: `${issuer}/oauth/token`,
      userinfo_endpoint: `${issuer}/oauth/me`, jwks_uri: `${issuer}/oauth/jwks`,
      response_types_supported: ['code'], subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['ES256'], token_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: true
    })
    if (url.endsWith('/jwks')) return json({ keys: [jwk] })
    if (url.endsWith('/me')) return json({ sub: profileSubject, name: 'Railway User', email: 'user@example.com' })
    if (url.endsWith('/token')) {
      if (failNetwork) throw new Error('secret-provider-error access-value refresh-value code-value')
      const refreshing = body.get('grant_type') === 'refresh_token'
      if (refreshing) {
        refreshCount++
        if (waitRefresh) await waitRefresh
        if (refreshError) return json({ error: refreshError, error_description: 'secret-provider-error' }, 400)
        return json({ access_token: `access-${refreshCount}`, refresh_token: `refresh-${refreshCount}`, token_type: 'Bearer', expires_in: 3600, scope: railwayOAuthScopes })
      }
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const unsigned = `${encode({ alg: 'ES256', kid: 'test' })}.${encode({
        iss: invalidIssuer ? 'https://untrusted.example' : issuer, aud: 'native-client', sub: 'user-1',
        nonce: nonceOverride ?? authorization.searchParams.get('nonce'),
        iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600
      })}`
      const signature = sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
      return json({ access_token: 'access-value', refresh_token: 'refresh-value', expires_in: 3600, token_type: 'Bearer',
        scope: railwayOAuthScopes, id_token: `${unsigned}.${invalidSignature ? Buffer.alloc(64).toString('base64url') : signature}` })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  const options = { codec, fetcher, now: () => now, openExternal: async (url: string) => { authorization = new URL(url); await onOpen(authorization) } }
  const manager = new RailwayOAuthManager(db, options)
  const createConnection = (grant: RailwayOAuthGrant, current = manager) => {
    const connection = saveServiceConnection(db, { provider: 'railway', name: 'OAuth', authMethod: 'oauth' })
    current.save(connection.id, grant)
    return connection.id
  }
  return {
    db, manager, options, requests, createConnection,
    get authorization() { return authorization }, get refreshCount() { return refreshCount },
    onOpen: (fn: typeof onOpen) => { onOpen = fn },
    expire: () => { now += 3_600_000 },
    nonce: (value: string) => { nonceOverride = value },
    badSignature: () => { invalidSignature = true }, badIssuer: () => { invalidIssuer = true },
    profileSubject: (value: string) => { profileSubject = value },
    refreshError: (value: string) => { refreshError = value }, failNetwork: () => { failNetwork = true },
    pauseRefresh: () => { waitRefresh = new Promise<void>((resolve) => { releaseRefresh = resolve }); return () => releaseRefresh!() }
  }
}

describe('Railway Native OAuth', { concurrency: false }, () => {
  it('uses PKCE, fresh state and nonce, consent, exact loopback redirect and no client secret or hint', async () => {
    const h = setup()
    const grant = await h.manager.login('native-client')
    const first = h.authorization
    const tokenRequest = h.requests.find((request) => request.body.get('grant_type') === 'authorization_code')!
    assert.equal(first.searchParams.get('redirect_uri'), railwayOAuthRedirectUri)
    assert.equal(first.searchParams.get('scope'), railwayOAuthScopes)
    assert.equal(first.searchParams.get('prompt'), 'consent')
    assert.equal(first.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(first.searchParams.get('code_challenge'), createHash('sha256').update(tokenRequest.body.get('code_verifier')!).digest('base64url'))
    assert.equal(tokenRequest.body.get('client_id'), 'native-client')
    assert.equal(tokenRequest.body.has('client_secret'), false)
    assert.equal(first.searchParams.has('id_token_hint'), false)
    assert.equal(grant.accountEmail, 'user@example.com')
    await h.manager.login('native-client')
    assert.notEqual(h.authorization.searchParams.get('state'), first.searchParams.get('state'))
    assert.notEqual(h.authorization.searchParams.get('nonce'), first.searchParams.get('nonce'))
  })

  it('ignores wrong state and invalid routes, and handles a valid callback once', async () => {
    const h = setup()
    h.onOpen(async (url) => {
      assert.equal((await fetch(`${railwayOAuthRedirectUri}?code=x&state=wrong`)).status, 400)
      assert.equal((await fetch('http://127.0.0.1:43827/other')).status, 404)
      const callback = `${railwayOAuthRedirectUri}?code=one&state=${url.searchParams.get('state')}&iss=${encodeURIComponent(issuer)}`
      assert.equal((await fetch(callback)).status, 200)
      assert.equal((await fetch(callback)).status, 409)
    })
    await h.manager.login('native-client')
    assert.equal(h.requests.filter((r) => r.body.get('grant_type') === 'authorization_code').length, 1)
  })

  for (const [label, configure] of [
    ['nonce', (h: ReturnType<typeof setup>) => h.nonce('wrong')],
    ['signature', (h: ReturnType<typeof setup>) => h.badSignature()],
    ['issuer', (h: ReturnType<typeof setup>) => h.badIssuer()],
    ['profile subject', (h: ReturnType<typeof setup>) => h.profileSubject('different-user')]
  ] as const) {
    it(`rejects an invalid ${label} without leaking provider details`, async () => {
      const h = setup(); configure(h)
      await assert.rejects(h.manager.login('native-client'), /OAuth 校验或通信失败/)
    })
  }

  it('supports denied consent and a fresh subsequent login', async () => {
    const h = setup()
    h.onOpen(async (url) => { await fetch(`${railwayOAuthRedirectUri}?error=access_denied&error_description=secret-value&state=${url.searchParams.get('state')}`) })
    await assert.rejects(h.manager.login('native-client'), /授权已拒绝/)
    h.onOpen(async (url) => { await fetch(`${railwayOAuthRedirectUri}?code=x&state=${url.searchParams.get('state')}&iss=${encodeURIComponent(issuer)}`) })
    await h.manager.login('native-client')
  })

  it('cancels while waiting in the browser and closes the listener', async () => {
    const h = setup()
    h.onOpen(async () => { h.manager.cancelLogin() })
    await assert.rejects(h.manager.login('native-client'), /登录已取消/)
    await assert.rejects(fetch(railwayOAuthRedirectUri))
  })

  it('times out without leaving a callback listener', async () => {
    const h = setup()
    h.onOpen(async () => undefined)
    const manager = new RailwayOAuthManager(h.db, { ...h.options, timeoutMs: 40 })
    await assert.rejects(manager.login('native-client'), /登录超时/)
    await assert.rejects(fetch(railwayOAuthRedirectUri))
  })

  it('reports an occupied callback port without changing the redirect', async () => {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(43827, '127.0.0.1', resolve))
    try { await assert.rejects(setup().manager.login('native-client'), /43827 被占用/) }
    finally { await new Promise<void>((resolve) => server.close(() => resolve())) }
  })

  it('encrypts credentials, returns only public fields and restores after restart', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    const serialized = JSON.stringify(listServiceConnections(h.db))
    assert.equal(serialized.includes('access-value'), false)
    assert.equal(serialized.includes('refresh-value'), false)
    assert.equal(serialized.includes('resolveToken'), false)
    const row = h.db.prepare('SELECT * FROM railway_oauth_credentials').get()!
    assert.equal(JSON.stringify(row).includes('access-value'), false)
    assert.equal(listServiceConnections(h.db)[0].oauth?.persistent, true)
    const restarted = new RailwayOAuthManager(h.db, h.options)
    assert.equal(await restarted.accessToken(id), 'access-value')
  })

  it('migrates existing Token connections without losing credentials or bindings', () => {
    const h = setup()
    const connection = saveServiceConnection(h.db, { provider: 'railway', name: 'Legacy', token: 'legacy-token', railwayTokenType: 'project' })
    saveProjectService(h.db, { provider: 'railway', connectionId: connection.id, name: 'API', externalServiceId: 'service-1' })
    migrateServiceMonitoringTables(h.db)
    const [migrated] = listServiceConnections(h.db)
    assert.equal(migrated.authMethod, 'token')
    assert.equal(migrated.tokenConfigured, true)
    assert.equal(migrated.token, '')
    assert.equal(h.db.prepare('SELECT token FROM global_service_connections WHERE id = ?').get(connection.id)?.token, 'legacy-token')
    assert.equal(listAllProjectServices(h.db)[0].connectionId, connection.id)
  })

  it('requires login after encrypted credentials cannot be decrypted', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    h.db.prepare("UPDATE railway_oauth_credentials SET secret = 'corrupted' WHERE connection_id = ?").run(id)
    const restarted = new RailwayOAuthManager(h.db, h.options)
    await assert.rejects(restarted.accessToken(id), /需要重新登录/)
    assert.equal(restarted.summary(id)?.status, 'needs-login')
    assert.equal(h.db.prepare('SELECT secret FROM railway_oauth_credentials').get()?.secret, '')
  })

  it('clears OAuth credentials when switching back to API Token authentication', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    const updated = saveServiceConnection(h.db, { id, provider: 'railway', name: 'Token', authMethod: 'token', token: 'new-api-token' })
    assert.equal(updated.authMethod, 'token')
    assert.equal(updated.tokenConfigured, true)
    assert.equal(updated.oauth, undefined)
    await assert.rejects(h.manager.accessToken(id), /需要重新登录/)
    assert.equal(h.db.prepare('SELECT * FROM railway_oauth_credentials').get(), undefined)
  })

  it('uses memory only when safe encryption is unavailable or basic_text is selected', async () => {
    for (const unavailable of [true, false]) {
      const h = setup()
      const manager = new RailwayOAuthManager(h.db, { ...h.options, codec: { ...codec,
        isEncryptionAvailable: () => !unavailable, getSelectedStorageBackend: () => 'basic_text',
        encryptString: () => { throw new Error('must not persist') }
      } })
      const id = h.createConnection(await manager.login('native-client'), manager)
      assert.equal(manager.summary(id)?.persistent, false)
      assert.equal(await manager.accessToken(id), 'access-value')
      const restarted = new RailwayOAuthManager(h.db, h.options)
      assert.equal(restarted.summary(id)?.status, 'needs-login')
      await assert.rejects(restarted.accessToken(id), /需要重新登录/)
    }
  })

  it('coalesces concurrent refreshes and persists the rotated refresh token', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    h.expire()
    assert.deepEqual(await Promise.all([h.manager.accessToken(id), h.manager.accessToken(id), h.manager.accessToken(id)]), ['access-1', 'access-1', 'access-1'])
    assert.equal(h.refreshCount, 1)
    const restarted = new RailwayOAuthManager(h.db, h.options)
    h.expire()
    await restarted.accessToken(id)
    const refreshes = h.requests.filter((r) => r.body.get('grant_type') === 'refresh_token')
    assert.equal(refreshes[0].body.get('refresh_token'), 'refresh-value')
    assert.equal(refreshes[1].body.get('refresh_token'), 'refresh-1')
    assert.equal(refreshes.every((r) => !r.body.has('client_secret')), true)
  })

  it('requires login after revocation, but retains credentials on transient failures', async () => {
    for (const permanent of [true, false]) {
      const h = setup()
      const id = h.createConnection(await h.manager.login('native-client'))
      h.expire()
      if (permanent) h.refreshError('invalid_grant'); else h.failNetwork()
      await assert.rejects(h.manager.accessToken(id), permanent ? /需要重新登录/ : /稍后重试/)
      assert.equal(h.manager.summary(id)?.status, permanent ? 'needs-login' : 'connected')
    }
  })

  it('disconnects without deleting bindings, including during an in-flight refresh', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    saveProjectService(h.db, { provider: 'railway', connectionId: id, name: 'api', externalProjectId: 'project-1', externalServiceId: 'service-1' })
    h.expire()
    const release = h.pauseRefresh()
    const pending = h.manager.accessToken(id)
    // Wait for the token request to reach the transport, not an arbitrary delay.
    while (h.refreshCount === 0) await new Promise<void>((resolve) => setImmediate(resolve))
    h.manager.disconnect(id)
    release()
    await assert.rejects(pending, /需要重新登录/)
    assert.equal(h.manager.summary(id)?.status, 'needs-login')
    assert.equal(listAllProjectServices(h.db).length, 1)
    deleteServiceConnection(h.db, id)
    assert.equal(h.db.prepare('SELECT * FROM railway_oauth_credentials').get(), undefined)
  })

  it('refreshes through service monitoring and uses OAuth project discovery with bearer auth', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    h.expire()
    let discovery = false
    const services = await syncServiceConnection(h.db, id, async (url, init) => {
      assert.equal(String(url), 'https://backboard.railway.com/graphql/v2')
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer access-1')
      assert.equal('Project-Access-Token' in (init?.headers ?? {}), false)
      const { query } = JSON.parse(String(init?.body))
      let data: unknown
      if (query.includes('externalWorkspaces')) { discovery = true; data = { externalWorkspaces: [{ id: 'workspace-1', projects: [{ id: 'project-1' }] }] } }
      else if (query.includes('project(id:')) data = { project: { id: 'project-1', name: 'Project', services: { edges: [{ node: { id: 'service-1', name: 'API' } }] }, environments: { edges: [] } } }
      else throw new Error('Unexpected OAuth discovery query')
      return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } })
    })
    assert.equal(discovery, true)
    assert.equal(services[0].externalProjectId, 'project-1')
    assert.equal(h.refreshCount, 1)
  })

  it('marks revoked HTTP access as requiring login without exposing the error body', async () => {
    const h = setup()
    const id = h.createConnection(await h.manager.login('native-client'))
    await assert.rejects(syncServiceConnection(h.db, id, async () => new Response('access-value refresh-value', { status: 401 })), /需要重新登录/)
    assert.equal(listServiceConnections(h.db)[0].tokenConfigured, false)
    assert.equal(h.manager.summary(id)?.status, 'needs-login')
  })
})
