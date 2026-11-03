import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { migrateServiceMonitoringTables, saveServiceConnection, saveProjectService, recordServiceMonitorCheck, readProjectOperations, refreshProjectOperations, listServiceRuntimeLogs } from './service-monitoring.js'
import type { ServiceProviderFetch } from './service-provider-adapters.js'
import { readVercelRuntimeLogs } from './service-provider-adapters.js'

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE projects(id TEXT PRIMARY KEY); CREATE TABLE repositories(id TEXT PRIMARY KEY); INSERT INTO projects VALUES ('a'),('b'); INSERT INTO repositories VALUES ('repo');`)
  migrateServiceMonitoringTables(db)
  const connection = saveServiceConnection(db, { projectId: 'a', provider: 'vercel', name: 'Vercel', token: 'test-only', teamId: 'team-a' })
  const service = saveProjectService(db, { projectId: 'a', provider: 'vercel', connectionId: connection.id, repositoryId: 'repo', name: 'web', externalProjectId: 'prj-bound', externalProjectAlias: '网站', environments: [{ name: 'production', latestDeploymentId: 'cached' }], domains: [{ domain: 'example.test', environmentName: 'production', kind: 'custom' }, { domain: 'manual.test', kind: 'manual', enabled: false }] })
  recordServiceMonitorCheck(db, { projectId: 'a', serviceId: service.id, domainId: service.domains[0].id, status: 'online', statusCode: 200, responseMs: 12 })
  return { db, service, connection }
}
function fixture(requests: URL[], overrides: (url: URL) => Response | undefined = () => undefined): ServiceProviderFetch {
  return async input => {
    const url = new URL(String(input)); requests.push(url)
    const override = overrides(url)
    if (override) return override
    if (url.pathname.endsWith('/custom-environments')) return Response.json({ environments: [{ id: 'env-stage', slug: 'staging' }] })
    if (url.pathname.endsWith('/domains')) return Response.json({ domains: [{ name: 'example.test' }, { name: 'preview.test', gitBranch: 'feature' }] })
    if (url.pathname.endsWith('/prj-bound')) return Response.json({ targets: { production: { id: 'dpl-active', readyState: 'READY', url: 'active.vercel.app', meta: { githubCommitSha: 'active-sha' } } } })
    if (url.pathname === '/v7/deployments') {
      const target = url.searchParams.get('target')
      return Response.json({ deployments: target === 'preview' ? [] : [{ uid: target === 'staging' ? 'dpl-stage' : 'dpl-new-failed', target: target || 'production', state: target === 'staging' ? 'BUILDING' : 'ERROR', url: 'new.vercel.app', createdAt: Date.now(), meta: { githubCommitSha: 'new-sha' } }] })
    }
    throw new Error(`Unexpected request ${url}`)
  }
}

describe('project operations', () => {
  it('reads a single runtime log record as well as multi-record NDJSON streams', async () => {
    const lines = await readVercelRuntimeLogs({ token: 'test' }, 'project', 'deployment', async () => new Response(JSON.stringify({ message: 'one event', timestamp: Date.now(), level: 'info' })))
    assert.equal(lines.length, 1)
    assert.equal(lines[0].message, 'one event')
  })
  it('refreshes only bound resources, preserves bindings and health, and keeps active production separate from the latest failure', async () => {
    const { db, service } = setup()
    try {
      const requests: URL[] = []
      const data = await refreshProjectOperations(db, { projectId: 'a' }, fixture(requests))
      assert.equal(data.states[service.id].production?.id, 'dpl-active')
      assert.equal(data.deployments[service.id][0].state, 'ERROR')
      assert.deepEqual(data.services[0].environments.map(environment => environment.name).sort(), ['preview', 'production', 'staging'])
      assert.equal(data.services[0].environments.find(environment => environment.name === 'preview')?.latestDeploymentId, '')
      assert.equal(data.services[0].repositoryId, 'repo')
      assert.equal(data.services[0].externalProjectAlias, '网站')
      const domain = data.services[0].domains.find(domain => domain.domain === 'example.test')!
      assert.equal(domain.lastStatus, 'online'); assert.equal(domain.lastResponseMs, 12)
      assert.equal(data.services[0].domains.find(domain => domain.domain === 'manual.test')?.enabled, false)
      assert.equal(data.services[0].domains.find(domain => domain.domain === 'preview.test')?.environmentName, 'preview')
      assert.equal(readProjectOperations(db, 'b').services.length, 0)
      assert.ok(requests.every(url => url.searchParams.get('teamId') === 'team-a'))
      assert.ok(requests.every(url => !/\/projects$/.test(url.pathname)))
      const count = requests.length
      await refreshProjectOperations(db, { projectId: 'a' }, fixture(requests))
      assert.equal(requests.length, count)
      assert.ok(Object.values(data.states[service.id].sources).every(source => source.updatedAt && !source.error))
      migrateServiceMonitoringTables(db)
      assert.equal(readProjectOperations(db, 'a').states[service.id].production?.id, 'dpl-active')
    } finally { db.close() }
  })
  it('coalesces simultaneous forced requests from multiple windows', async () => {
    const { db } = setup()
    try {
      const requests: URL[] = []
      const fetcher = fixture(requests)
      const [a, b] = await Promise.all([refreshProjectOperations(db, { projectId: 'a', force: true }, fetcher), refreshProjectOperations(db, { projectId: 'a', force: true }, fetcher)])
      assert.deepEqual(a, b)
      assert.equal(requests.filter(url => url.pathname.endsWith('/prj-bound')).length, 1)
    } finally { db.close() }
  })
  it('keeps cached results on partial failure and does not turn unavailable domain data into an empty domain list', async () => {
    const { db, service } = setup()
    try {
      await refreshProjectOperations(db, { projectId: 'a' }, fixture([]))
      const snapshot = readProjectOperations(db, 'a')
      const result = await refreshProjectOperations(db, { projectId: 'a', force: true }, fixture([], url => url.pathname.endsWith('/domains') ? new Response('Forbidden', { status: 403 }) : undefined))
      assert.deepEqual(result.services[0].domains, snapshot.services[0].domains)
      assert.match(result.states[service.id].sources.domains.error, /403/)
      assert.equal(result.states[service.id].sources.domains.updatedAt, snapshot.states[service.id].sources.domains.updatedAt)
      assert.equal(result.states[service.id].production?.id, 'dpl-active')
      assert.equal(result.states[service.id].sources.production.error, '')
    } finally { db.close() }
  })
  it('honors Retry-After for forced refreshes and isolates failed connections', async () => {
    const { db, service } = setup()
    try {
      const connection = saveServiceConnection(db, { projectId: 'a', provider: 'vercel', name: 'Other', token: 'test' })
      const other = saveProjectService(db, { projectId: 'a', provider: 'vercel', connectionId: connection.id, externalProjectId: 'other', name: 'other' })
      const requests: URL[] = []
      const fetcher = fixture(requests, url => url.pathname.includes('prj-bound') ? new Response('rate limited', { status: 429, headers: { 'Retry-After': '120' } }) : url.pathname.includes('other') ? Response.json({ environments: [], domains: [], targets: {} }) : undefined)
      const result = await refreshProjectOperations(db, { projectId: 'a' }, fetcher)
      assert.match(result.states[service.id].sources.environments.error, /429/)
      assert.ok(Date.parse(result.states[service.id].sources.environments.retryAt) - Date.now() > 115_000)
      assert.equal(result.states[other.id].sources.environments.error, '')
      const count = requests.filter(url => url.pathname.includes('prj-bound') || url.searchParams.get('projectId') === 'prj-bound').length
      await refreshProjectOperations(db, { projectId: 'a', force: true }, fetcher)
      assert.equal(requests.filter(url => url.pathname.includes('prj-bound') || url.searchParams.get('projectId') === 'prj-bound').length, count)
    } finally { db.close() }
  })
  it('represents a missing production pointer as unconfirmed rather than guessing from a Ready deployment', async () => {
    const { db, service } = setup()
    try {
      const data = await refreshProjectOperations(db, { projectId: 'a' }, fixture([], url => url.pathname.endsWith('/prj-bound') ? Response.json({ targets: {} }) : undefined))
      assert.equal(data.states[service.id].production, null)
      assert.ok(data.states[service.id].sources.production.updatedAt)
    } finally { db.close() }
  })
  it('follows a rollback pointer and invalidates production confirmation when credentials change', async () => {
    const { db, service, connection } = setup()
    try {
      await refreshProjectOperations(db, { projectId: 'a' }, fixture([]))
      const rolledBack = await refreshProjectOperations(db, { projectId: 'a', force: true }, fixture([], url => url.pathname.endsWith('/prj-bound') ? Response.json({ targets: { production: { id: 'dpl-older', readyState: 'READY', target: 'production' } } }) : undefined))
      assert.equal(rolledBack.states[service.id].production?.id, 'dpl-older')
      saveServiceConnection(db, { id: connection.id, projectId: 'a', provider: 'vercel', name: 'Changed', token: 'new-token', teamId: 'new-team' })
      assert.equal(readProjectOperations(db, 'a').states[service.id].production, null)
      const requests: URL[] = []
      await refreshProjectOperations(db, { projectId: 'a' }, fixture(requests))
      assert.ok(requests.length > 0)
      assert.ok(requests.every(url => url.searchParams.get('teamId') === 'new-team'))
    } finally { db.close() }
  })
  it('reads production runtime logs for the confirmed active deployment and rejects unrelated IDs', async () => {
    const { db, service } = setup()
    try {
      await refreshProjectOperations(db, { projectId: 'a' }, fixture([]))
      const requests: string[] = []
      const fetcher: ServiceProviderFetch = async url => { requests.push(String(url)); return Response.json({ logs: [{ message: 'active production' }] }) }
      const lines = await listServiceRuntimeLogs(db, service.id, 'production', fetcher, 'dpl-active')
      assert.equal(lines[0].message, 'active production')
      assert.ok(requests[0].includes('/dpl-active/runtime-logs'))
      await assert.rejects(listServiceRuntimeLogs(db, service.id, 'production', fetcher, 'another-service-deployment'), /不属于/)
      assert.equal(requests.length, 1)
    } finally { db.close() }
  })
  it('preserves cached environments on authentication failure and skips disabled services', async () => {
    const { db, service } = setup()
    try {
      const before = readProjectOperations(db, 'a')
      const failed = await refreshProjectOperations(db, { projectId: 'a' }, fixture([], () => new Response('Unauthorized', { status: 401 })))
      assert.deepEqual(failed.services[0].environments, before.services[0].environments)
      assert.match(failed.states[service.id].sources.environments.error, /401/)
      db.prepare('UPDATE global_services SET enabled=0 WHERE id=?').run(service.id)
      const requests: URL[] = []
      await refreshProjectOperations(db, { projectId: 'a', force: true }, fixture(requests))
      assert.equal(requests.length, 0)
    } finally { db.close() }
  })
  it('refreshes built-in environments when custom environments are unavailable', async () => {
    const { db, service } = setup()
    try {
      const result = await refreshProjectOperations(db, { projectId: 'a' }, fixture([], url => url.pathname.endsWith('/custom-environments') ? new Response('Feature unavailable', { status: 402 }) : undefined))
      assert.equal(result.states[service.id].sources.environments.error, '')
      assert.deepEqual(result.services[0].environments.map(environment => environment.name).sort(), ['preview', 'production'])
      assert.equal(result.services[0].environments.find(environment => environment.name === 'production')?.deploymentStatus, 'ERROR')
    } finally { db.close() }
  })
})
