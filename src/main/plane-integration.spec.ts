import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deleteProjectPlaneBinding,
  getPlaneProjectContent,
  getPlaneSettings,
  getProjectPlaneBinding,
  listPlaneProjects,
  migratePlaneIntegrationTables,
  savePlaneSettings,
  saveProjectPlaneBinding,
  testPlaneConnection,
  type PlaneFetch
} from './plane-integration.js'

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

function createTestDatabase(): TestDatabase {
  const projects = new Set(['project-a'])
  const settingsRows: Array<Record<string, unknown>> = []
  const bindingRows: Array<Record<string, unknown>> = []
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

      if (sql.includes('SELECT * FROM plane_settings')) {
        return {
          all: () => [],
          get: (id) => settingsRows.find((row) => row.id === id),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT id FROM plane_settings')) {
        return {
          all: () => [],
          get: (id) => settingsRows.find((row) => row.id === id),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO plane_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, apiBaseUrl, webBaseUrl, apiToken, createdAt, updatedAt) => {
            settingsRows.push({
              id,
              api_base_url: apiBaseUrl,
              web_base_url: webBaseUrl,
              api_token: apiToken,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE plane_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (apiBaseUrl, webBaseUrl, apiToken, updatedAt, id) => {
            const row = settingsRows.find((item) => item.id === id)

            if (row) {
              Object.assign(row, {
                api_base_url: apiBaseUrl,
                web_base_url: webBaseUrl,
                api_token: apiToken,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('SELECT * FROM project_plane_bindings')) {
        return {
          all: () => [],
          get: (projectId) => bindingRows.find((row) => row.project_id === projectId),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO project_plane_bindings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId, workspaceSlug, planeProjectId, planeProjectName, planeProjectIdentifier, createdAt, updatedAt) => {
            bindingRows.push({
              project_id: projectId,
              workspace_slug: workspaceSlug,
              plane_project_id: planeProjectId,
              plane_project_name: planeProjectName,
              plane_project_identifier: planeProjectIdentifier,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE project_plane_bindings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (workspaceSlug, planeProjectId, planeProjectName, planeProjectIdentifier, updatedAt, projectId) => {
            const row = bindingRows.find((item) => item.project_id === projectId)

            if (row) {
              Object.assign(row, {
                workspace_slug: workspaceSlug,
                plane_project_id: planeProjectId,
                plane_project_name: planeProjectName,
                plane_project_identifier: planeProjectIdentifier,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('DELETE FROM project_plane_bindings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId) => {
            const index = bindingRows.findIndex((row) => row.project_id === projectId)

            if (index >= 0) {
              bindingRows.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migratePlaneIntegrationTables(db)
  return db
}

describe('plane integration', () => {
  it('stores Plane settings without exposing the API token to callers', () => {
    const db = createTestDatabase()

    const saved = savePlaneSettings(db, {
      apiBaseUrl: 'http://localhost:8000/',
      webBaseUrl: 'http://localhost:3000/',
      apiToken: ' plane_api_secret '
    })

    assert.deepEqual(saved, {
      apiBaseUrl: 'http://localhost:8000',
      webBaseUrl: 'http://localhost:3000',
      apiToken: '',
      tokenConfigured: true
    })

    const updated = savePlaneSettings(db, {
      apiBaseUrl: 'https://plane.example.com/api',
      webBaseUrl: 'https://plane.example.com',
      apiToken: undefined
    })

    assert.equal(updated.apiToken, '')
    assert.equal(updated.tokenConfigured, true)
    assert.equal(getPlaneSettings(db).apiBaseUrl, 'https://plane.example.com/api')
  })

  it('tests the connection with X-Api-Key authentication', async () => {
    const db = createTestDatabase()
    savePlaneSettings(db, {
      apiBaseUrl: 'http://plane.local',
      webBaseUrl: 'http://plane.local',
      apiToken: 'plane_api_secret'
    })

    const requests: Array<{ url: string; token: string }> = []
    const fetcher: PlaneFetch = async (url, init) => {
      requests.push({
        url: String(url),
        token: String((init?.headers as Record<string, string>)['X-Api-Key'])
      })
      return createJsonResponse({ id: 'user-1', email: 'stone@example.com', display_name: 'Stone' })
    }

    const result = await testPlaneConnection(db, undefined, fetcher)

    assert.equal(result.ok, true)
    assert.equal(result.userName, 'Stone')
    assert.equal(requests[0].url, 'http://plane.local/api/v1/users/me/')
    assert.equal(requests[0].token, 'plane_api_secret')
  })

  it('paginates Plane project lists and normalizes project rows', async () => {
    const db = createTestDatabase()
    savePlaneSettings(db, {
      apiBaseUrl: 'http://plane.local',
      webBaseUrl: 'http://plane.local',
      apiToken: 'plane_api_secret'
    })

    const cursors: string[] = []
    const fetcher: PlaneFetch = async (url) => {
      const requestUrl = new URL(String(url))
      cursors.push(requestUrl.searchParams.get('cursor') ?? '')

      if (!requestUrl.searchParams.get('cursor')) {
        return createJsonResponse({
          results: [{ id: 'plane-project-1', name: 'ForgeDesk', identifier: 'FD', total_cycles: 2, total_modules: 3 }],
          next_page_results: true,
          next_cursor: '50:1:0'
        })
      }

      return createJsonResponse({
        results: [{ id: 'plane-project-2', name: 'Plane', identifier: 'PLN' }],
        next_page_results: false,
        next_cursor: '50:1:0'
      })
    }

    const projects = await listPlaneProjects(db, 'workspace-a', fetcher)

    assert.deepEqual(cursors, ['', '50:1:0'])
    assert.deepEqual(
      projects.map((project) => ({ id: project.id, name: project.name, identifier: project.identifier, totalCycles: project.totalCycles, totalModules: project.totalModules })),
      [
        { id: 'plane-project-1', name: 'ForgeDesk', identifier: 'FD', totalCycles: 2, totalModules: 3 },
        { id: 'plane-project-2', name: 'Plane', identifier: 'PLN', totalCycles: 0, totalModules: 0 }
      ]
    )
  })

  it('saves and deletes project Plane bindings', () => {
    const db = createTestDatabase()

    const binding = saveProjectPlaneBinding(db, {
      projectId: 'project-a',
      workspaceSlug: 'workspace-a',
      planeProjectId: 'plane-project-1',
      planeProjectName: 'ForgeDesk',
      planeProjectIdentifier: 'FD'
    })

    assert.equal(binding.workspaceSlug, 'workspace-a')
    assert.equal(getProjectPlaneBinding(db, 'project-a')?.planeProjectIdentifier, 'FD')

    deleteProjectPlaneBinding(db, 'project-a')

    assert.equal(getProjectPlaneBinding(db, 'project-a'), null)
  })

  it('reads mapped Plane project content for a bound project', async () => {
    const db = createTestDatabase()
    savePlaneSettings(db, {
      apiBaseUrl: 'http://plane.local',
      webBaseUrl: 'http://plane-web.local',
      apiToken: 'plane_api_secret'
    })
    saveProjectPlaneBinding(db, {
      projectId: 'project-a',
      workspaceSlug: 'workspace-a',
      planeProjectId: 'plane-project-1',
      planeProjectName: 'ForgeDesk',
      planeProjectIdentifier: 'FD'
    })

    const fetcher: PlaneFetch = async (url) => {
      const pathname = new URL(String(url)).pathname

      if (pathname.endsWith('/summary/')) {
        return createJsonResponse({ id: 'plane-project-1', name: 'ForgeDesk', identifier: 'FD', counts: { issues: 4, cycles: 1, modules: 1, members: 2 } })
      }

      if (pathname.endsWith('/work-items/')) {
        return createJsonResponse({
          results: [
            {
              id: 'issue-1',
              name: 'Ship Plane integration',
              sequence_id: 42,
              priority: 'high',
              state_detail: { name: 'In Progress', group: 'started' },
              assignee_details: [{ display_name: 'Stone' }],
              target_date: '2026-07-01',
              updated_at: '2026-06-30T10:00:00.000Z'
            }
          ],
          next_page_results: false
        })
      }

      if (pathname.endsWith('/cycles/')) {
        return createJsonResponse({ results: [{ id: 'cycle-1', name: 'June', total_issues: 4, completed_issues: 2 }], next_page_results: false })
      }

      if (pathname.endsWith('/modules/')) {
        return createJsonResponse({ results: [{ id: 'module-1', name: 'Desktop', status: 'started', total_issues: 3 }], next_page_results: false })
      }

      throw new Error(`Unexpected URL: ${String(url)}`)
    }

    const content = await getPlaneProjectContent(db, 'project-a', fetcher)

    assert.equal(content.projectUrl, 'http://plane-web.local/workspace-a/projects/plane-project-1/issues')
    assert.equal(content.summary.counts.issues, 4)
    assert.equal(content.workItems[0].identifier, 'FD-42')
    assert.equal(content.workItems[0].assigneeNames[0], 'Stone')
    assert.equal(content.cycles[0].name, 'June')
    assert.equal(content.modules[0].name, 'Desktop')
  })
})
