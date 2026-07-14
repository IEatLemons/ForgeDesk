import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deleteProjectCloudflareDnsRecord,
  listProjectCloudflareDnsRecords,
  migrateProjectCloudflareTables,
  saveProjectCloudflareDnsRecord,
  saveProjectCloudflareSettings,
  testProjectCloudflareConnection,
  type CloudflareFetch
} from './cloudflare.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Failed',
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response
}

function createDatabase(): TestDatabase {
  const projects = new Set(['project-a'])
  const settingsRows: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    exec: () => undefined,
    prepare: (sql: string) => {
      if (sql.includes('SELECT id FROM projects')) {
        return {
          all: () => [],
          get: (projectId) => (projects.has(String(projectId)) ? { id: projectId } : undefined),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM project_cloudflare_settings')) {
        return {
          all: () => [],
          get: (projectId) => settingsRows.find((row) => row.project_id === projectId),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO project_cloudflare_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId, domain, zoneId, apiToken, createdAt, updatedAt) => {
            settingsRows.push({
              project_id: projectId,
              domain,
              zone_id: zoneId,
              api_token: apiToken,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE project_cloudflare_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (domain, zoneId, apiToken, updatedAt, projectId) => {
            const row = settingsRows.find((item) => item.project_id === projectId)

            if (row) {
              Object.assign(row, {
                domain,
                zone_id: zoneId,
                api_token: apiToken,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('DELETE FROM project_cloudflare_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId) => {
            const index = settingsRows.findIndex((row) => row.project_id === projectId)

            if (index >= 0) {
              settingsRows.splice(index, 1)
            }
          }
        }
      }

      if (sql.includes('DELETE FROM projects')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId) => {
            projects.delete(String(projectId))

            for (let index = settingsRows.length - 1; index >= 0; index -= 1) {
              if (settingsRows[index].project_id === projectId) {
                settingsRows.splice(index, 1)
              }
            }
          }
        }
      }

      if (sql.includes('SELECT COUNT(*) AS count FROM project_cloudflare_settings')) {
        return {
          all: () => [],
          get: () => ({ count: settingsRows.length }),
          run: () => undefined
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateProjectCloudflareTables(db)
  return db
}

describe('project Cloudflare integration', () => {
  it('stores project settings without exposing the API token and preserves blank token updates', async () => {
    const db = createDatabase()
    const saved = saveProjectCloudflareSettings(db, {
      projectId: 'project-a',
      domain: ' https://Example.com/path ',
      zoneId: ' zone-1 ',
      apiToken: ' cf_secret '
    })

    assert.equal(saved.domain, 'example.com')
    assert.equal(saved.zoneId, 'zone-1')
    assert.equal(saved.apiToken, '')
    assert.equal(saved.tokenConfigured, true)

    saveProjectCloudflareSettings(db, {
      projectId: 'project-a',
      domain: 'example.com',
      zoneId: 'zone-2',
      apiToken: ''
    })

    const requests: Array<{ url: string; authorization: string }> = []
    const fetcher: CloudflareFetch = async (url, init) => {
      requests.push({
        url: String(url),
        authorization: String((init?.headers as Record<string, string>).Authorization)
      })
      return createJsonResponse({ success: true, result: [], result_info: { total_pages: 1 } })
    }

    await listProjectCloudflareDnsRecords(db, 'project-a', fetcher)

    assert.equal(requests[0].url, 'https://api.cloudflare.com/client/v4/zones/zone-2/dns_records?page=1&per_page=100')
    assert.equal(requests[0].authorization, 'Bearer cf_secret')
  })

  it('requires a real project, zone id and token before saving settings', () => {
    const db = createDatabase()

    assert.throws(
      () => saveProjectCloudflareSettings(db, { projectId: 'missing', domain: 'example.com', zoneId: 'zone-1', apiToken: 'secret' }),
      /项目不存在/
    )
    assert.throws(() => saveProjectCloudflareSettings(db, { projectId: 'project-a', domain: 'example.com', apiToken: 'secret' }), /Zone ID/)
    assert.throws(() => saveProjectCloudflareSettings(db, { projectId: 'project-a', domain: 'example.com', zoneId: 'zone-1' }), /API Token/)
  })

  it('cascades project Cloudflare settings when the project is deleted', () => {
    const db = createDatabase()

    saveProjectCloudflareSettings(db, {
      projectId: 'project-a',
      domain: 'example.com',
      zoneId: 'zone-1',
      apiToken: 'secret'
    })
    db.prepare('DELETE FROM projects WHERE id = ?').run('project-a')

    const row = db.prepare('SELECT COUNT(*) AS count FROM project_cloudflare_settings').get() as { count: number }
    assert.equal(row.count, 0)
  })

  it('tests the connection with token verification and DNS read access', async () => {
    const db = createDatabase()

    saveProjectCloudflareSettings(db, {
      projectId: 'project-a',
      domain: 'example.com',
      zoneId: 'zone-1',
      apiToken: 'secret'
    })

    const requests: Array<{ path: string; authorization: string }> = []
    const fetcher: CloudflareFetch = async (url, init) => {
      requests.push({
        path: new URL(String(url)).pathname,
        authorization: String((init?.headers as Record<string, string>).Authorization)
      })
      return createJsonResponse({ success: true, result: [{ id: 'record-1', type: 'A', name: 'example.com', content: '192.0.2.1' }], result_info: { total_pages: 1 } })
    }

    const result = await testProjectCloudflareConnection(db, 'project-a', undefined, fetcher)

    assert.equal(result.ok, true)
    assert.deepEqual(requests.map((request) => request.path), ['/client/v4/user/tokens/verify', '/client/v4/zones/zone-1/dns_records'])
    assert.equal(requests.every((request) => request.authorization === 'Bearer secret'), true)
  })

  it('creates, updates and deletes DNS records with normalized names and bearer auth', async () => {
    const db = createDatabase()

    saveProjectCloudflareSettings(db, {
      projectId: 'project-a',
      domain: 'example.com',
      zoneId: 'zone-1',
      apiToken: 'secret'
    })

    const requests: Array<{ url: string; method: string; body: Record<string, unknown>; authorization: string }> = []
    const fetcher: CloudflareFetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: String(init?.method ?? 'GET'),
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
        authorization: String((init?.headers as Record<string, string>).Authorization)
      })

      if (String(url).includes('/record-1')) {
        return createJsonResponse({ success: true, result: { id: 'record-1' } })
      }

      if (init?.method === 'POST' || init?.method === 'PUT') {
        return createJsonResponse({ success: true, result: { id: 'record-1' } })
      }

      return createJsonResponse({
        success: true,
        result: [{ id: 'record-1', type: 'A', name: 'www.example.com', content: '192.0.2.1', ttl: 1, proxied: true }],
        result_info: { total_pages: 1 }
      })
    }

    await saveProjectCloudflareDnsRecord(
      db,
      'project-a',
      { type: 'A', name: 'www', content: '192.0.2.1', ttl: 1, proxied: true, comment: 'web' },
      fetcher
    )
    await saveProjectCloudflareDnsRecord(
      db,
      'project-a',
      { id: 'record-1', type: 'MX', name: '@', content: 'mail.example.com', ttl: 3600, priority: 20 },
      fetcher
    )
    await deleteProjectCloudflareDnsRecord(db, 'project-a', 'record-1', fetcher)

    assert.deepEqual(
      requests.filter((request) => request.method !== 'GET').map((request) => `${request.method} ${new URL(request.url).pathname}`),
      [
        'POST /client/v4/zones/zone-1/dns_records',
        'PUT /client/v4/zones/zone-1/dns_records/record-1',
        'DELETE /client/v4/zones/zone-1/dns_records/record-1'
      ]
    )
    assert.equal(requests[0].body.name, 'www.example.com')
    assert.equal(requests[0].body.proxied, true)
    assert.equal(requests[2].body.name, 'example.com')
    assert.equal(requests[2].body.priority, 20)
    assert.equal(requests.every((request) => request.authorization === 'Bearer secret'), true)
  })

  it('surfaces Cloudflare API errors with provider details', async () => {
    const db = createDatabase()

    saveProjectCloudflareSettings(db, {
      projectId: 'project-a',
      domain: 'example.com',
      zoneId: 'zone-1',
      apiToken: 'secret'
    })

    await assert.rejects(
      () =>
        listProjectCloudflareDnsRecords(db, 'project-a', async () =>
          createJsonResponse({ success: false, errors: [{ message: 'Invalid API token' }] }, true, 200)
        ),
      /Invalid API token/
    )
  })
})
