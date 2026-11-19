import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { ServiceHealthChecker } from './service-health-checks.js'
import { listProjectServices, listServiceMonitorHistory, migrateServiceMonitoringTables, saveProjectService, saveServiceConnection } from './service-monitoring.js'

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE projects(id TEXT PRIMARY KEY); CREATE TABLE repositories(id TEXT PRIMARY KEY); INSERT INTO projects VALUES ('a'),('b');")
  migrateServiceMonitoringTables(db)
  const connection = saveServiceConnection(db, { projectId: 'a', provider: 'vercel', name: 'QA', token: 'test-only' })
  const service = saveProjectService(db, { projectId: 'a', provider: 'vercel', connectionId: connection.id, name: 'Web', externalProjectId: 'qa', domains: [
    { domain: 'production.test', kind: 'custom', environmentName: 'production' },
    { domain: 'preview.test', kind: 'manual', environmentName: 'preview' },
    { domain: 'disabled.test', kind: 'custom', enabled: false },
    { domain: 'generated.vercel.app', kind: 'generated' }
  ] })
  return { db, service, connection }
}

describe('scoped service health checks', () => {
  it('checks the selected service and environment without checking disabled or generated Vercel domains', async () => {
    const { db, service, connection } = setup()
    try {
      saveProjectService(db, { projectId: 'a', provider: 'vercel', connectionId: connection.id, name: 'Other', externalProjectId: 'other', domains: [{ domain: 'other.test' }] })
      const requests: string[] = [], notified: string[] = []
      const checker = new ServiceHealthChecker(ids => notified.push(...ids))
      const result = await checker.check(db, { projectId: 'a', serviceId: service.id, environmentName: 'production' }, async (url, init) => {
        requests.push(String(url)); assert.equal(init?.method, 'HEAD'); return new Response('', { status: 200 })
      })
      assert.deepEqual(requests, ['https://production.test/'])
      assert.equal(result.length, 1)
      assert.equal(result[0].domains.find(domain => domain.domain === 'production.test')?.lastStatus, 'online')
      assert.equal(result[0].domains.find(domain => domain.domain === 'preview.test')?.lastCheckedAt, '')
      assert.deepEqual(notified, ['a'])
      assert.equal(listServiceMonitorHistory(db, 'a').length, 1)
      await assert.rejects(checker.check(db, { projectId: 'b', serviceId: service.id }), /当前范围/)
    } finally { db.close() }
  })

  it('shares overlapping manual and scheduled checks and records one history row per domain', async () => {
    const { db, service } = setup()
    try {
      const checker = new ServiceHealthChecker()
      let release!: () => void
      const gate = new Promise<void>(resolve => { release = resolve })
      const requests: string[] = []
      const fetcher = async (url: string | URL | Request) => { requests.push(String(url)); await gate; return new Response('', { status: 200 }) }
      const scheduled = checker.check(db, {}, fetcher)
      const manual = checker.check(db, { projectId: 'a', serviceId: service.id }, fetcher)
      release()
      await Promise.all([scheduled, manual])
      assert.equal(requests.length, 2)
      assert.equal(new Set(requests).size, 2)
      assert.equal(listServiceMonitorHistory(db, 'a').length, 2)
    } finally { db.close() }
  })

  it('records unreachable domains with check times and continues checking the remaining domains', async () => {
    const { db } = setup()
    try {
      const checker = new ServiceHealthChecker()
      await checker.check(db, { projectId: 'a' }, async url => {
        if (String(url).includes('production')) throw new Error('test timeout')
        return new Response('', { status: 503 })
      })
      const domains = listProjectServices(db, 'a')[0].domains
      const offline = domains.find(domain => domain.domain === 'production.test')!
      const degraded = domains.find(domain => domain.domain === 'preview.test')!
      assert.equal(offline.lastStatus, 'offline'); assert.match(offline.lastError, /test timeout/)
      assert.equal(degraded.lastStatus, 'degraded'); assert.equal(degraded.lastStatusCode, 503)
      assert.ok(offline.lastCheckedAt && degraded.lastCheckedAt)
      assert.equal(listServiceMonitorHistory(db, 'a').length, 2)
    } finally { db.close() }
  })

  it('does not send checks for a disabled service', async () => {
    const { db, service, connection } = setup()
    try {
      saveProjectService(db, { ...service, projectId: 'a', connectionId: connection.id, enabled: false })
      const checker = new ServiceHealthChecker()
      let calls = 0
      await checker.check(db, { projectId: 'a', serviceId: service.id }, async () => { calls++; return new Response('') })
      assert.equal(calls, 0)
    } finally { db.close() }
  })
})
