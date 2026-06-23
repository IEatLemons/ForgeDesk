import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  bindProjectService,
  buildServiceHealthUrl,
  classifyServiceMonitorStatus,
  deleteOldServiceMonitorHistory,
  deleteServiceConnection,
  listAllProjectServices,
  listProjectServices,
  listServiceConnections,
  listServiceMonitorHistory,
  migrateServiceMonitoringTables,
  recordServiceMonitorCheck,
  saveProjectService,
  saveServiceConnection,
  upsertProviderServiceSnapshot
} from './service-monitoring.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function runSqlite(databasePath: string, statements: string[]): string {
  const result = spawnSync('/usr/bin/sqlite3', [databasePath, '.bail on', ...statements], {
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout)
  }

  return result.stdout
}

function createDatabase(): TestDatabase {
  const projects = new Set(['project-a', 'project-b'])
  const serviceConnections: Array<Record<string, unknown>> = []
  const projectServices: Array<Record<string, unknown>> = []
  const projectServiceBindings: Array<Record<string, unknown>> = []
  const serviceEnvironments: Array<Record<string, unknown>> = []
  const serviceDomains: Array<Record<string, unknown>> = []
  const serviceMonitorChecks: Array<Record<string, unknown>> = []
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

      if (sql.includes('SELECT token FROM global_service_connections WHERE id = ?')) {
        return {
          all: () => [],
          get: (connectionId) => serviceConnections.find((connection) => connection.id === connectionId),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM global_service_connections WHERE id = ?')) {
        return {
          all: () => [],
          get: (connectionId) => serviceConnections.find((connection) => connection.id === connectionId),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM global_service_connections ORDER BY created_at ASC')) {
        return {
          all: () => serviceConnections,
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO global_service_connections')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, provider, name, token, teamId, workspaceId, railwayTokenType, createdAt, updatedAt) => {
            serviceConnections.push({
              id,
              provider,
              name,
              token,
              team_id: teamId,
              workspace_id: workspaceId,
              railway_token_type: railwayTokenType,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE global_service_connections')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (provider, name, token, teamId, workspaceId, railwayTokenType, updatedAt, id) => {
            const connection = serviceConnections.find((item) => item.id === id)

            if (connection) {
              Object.assign(connection, {
                provider,
                name,
                token,
                team_id: teamId,
                workspace_id: workspaceId,
                railway_token_type: railwayTokenType,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('DELETE FROM global_service_connections')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id) => {
            const index = serviceConnections.findIndex((connection) => connection.id === id)

            if (index >= 0) {
              serviceConnections.splice(index, 1)
            }
          }
        }
      }

      if (sql.includes('SELECT * FROM global_services WHERE id = ?')) {
        return {
          all: () => [],
          get: (serviceId) => projectServices.find((service) => service.id === serviceId),
          run: () => undefined
        }
      }

      if (sql.includes('FROM global_services services') && sql.includes('INNER JOIN project_service_bindings')) {
        return {
          all: (projectId) =>
            projectServiceBindings
              .filter((binding) => binding.project_id === projectId)
              .map((binding): Record<string, unknown> | null => {
                const service = projectServices.find((item) => item.id === binding.service_id)

                return service
                  ? {
                      ...service,
                      bound_project_id: binding.project_id,
                      bound_repository_id: binding.repository_id
                    }
                  : null
              })
              .filter((service): service is Record<string, unknown> => Boolean(service)),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes("SELECT services.*, '' AS bound_project_id")) {
        return {
          all: () => projectServices.map((service) => ({ ...service, bound_project_id: '', bound_repository_id: service.repository_id })),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO global_services')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (
            id,
            provider,
            connectionId,
            repositoryId,
            name,
            externalProjectId,
            externalServiceId,
            defaultEnvironment,
            healthPath,
            enabled,
            lastSyncedAt,
            createdAt,
            updatedAt
          ) => {
            projectServices.push({
              id,
              provider,
              connection_id: connectionId,
              repository_id: repositoryId,
              name,
              external_project_id: externalProjectId,
              external_service_id: externalServiceId,
              default_environment: defaultEnvironment,
              health_path: healthPath,
              enabled,
              last_synced_at: lastSyncedAt,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE global_services')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (
            provider,
            connectionId,
            repositoryId,
            name,
            externalProjectId,
            externalServiceId,
            defaultEnvironment,
            healthPath,
            enabled,
            lastSyncedAt,
            updatedAt,
            id
          ) => {
            const service = projectServices.find((item) => item.id === id)

            if (service) {
              Object.assign(service, {
                provider,
                connection_id: connectionId,
                repository_id: repositoryId,
                name,
                external_project_id: externalProjectId,
                external_service_id: externalServiceId,
                default_environment: defaultEnvironment,
                health_path: healthPath,
                enabled,
                last_synced_at: lastSyncedAt,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('DELETE FROM global_services')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id) => {
            const index = projectServices.findIndex((service) => service.id === id)

            if (index >= 0) {
              projectServices.splice(index, 1)
            }
          }
        }
      }

      if (sql.includes('INSERT INTO project_service_bindings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId, serviceId, repositoryId, createdAt, updatedAt) => {
            const binding = projectServiceBindings.find((item) => item.project_id === projectId && item.service_id === serviceId)

            if (binding) {
              Object.assign(binding, { repository_id: repositoryId, updated_at: updatedAt })
            } else {
              projectServiceBindings.push({ project_id: projectId, service_id: serviceId, repository_id: repositoryId, created_at: createdAt, updated_at: updatedAt })
            }
          }
        }
      }

      if (sql.includes('DELETE FROM project_service_bindings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (...params) => {
            const [first, second] = params
            const index = sql.includes('WHERE service_id = ?')
              ? projectServiceBindings.findIndex((binding) => binding.service_id === first)
              : projectServiceBindings.findIndex((binding) => binding.project_id === first && binding.service_id === second)

            if (index >= 0) {
              projectServiceBindings.splice(index, 1)
            }
          }
        }
      }

      if (sql.includes('DELETE FROM global_service_environments')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (serviceId) => {
            for (let index = serviceEnvironments.length - 1; index >= 0; index -= 1) {
              if (serviceEnvironments[index].service_id === serviceId) {
                serviceEnvironments.splice(index, 1)
              }
            }
          }
        }
      }

      if (sql.includes('SELECT id FROM global_services WHERE connection_id = ?')) {
        return {
          all: (connectionId) => projectServices.filter((service) => service.connection_id === connectionId).map((service) => ({ id: service.id })),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO global_service_environments')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, serviceId, provider, name, externalEnvironmentId, status, deploymentStatus, latestDeploymentId, latestDeploymentUrl, latestCommit, updatedAt) => {
            serviceEnvironments.push({
              id,
              service_id: serviceId,
              provider,
              name,
              external_environment_id: externalEnvironmentId,
              status,
              deployment_status: deploymentStatus,
              latest_deployment_id: latestDeploymentId,
              latest_deployment_url: latestDeploymentUrl,
              latest_commit: latestCommit,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('SELECT * FROM global_service_environments WHERE service_id = ? ORDER BY name ASC')) {
        return {
          all: (serviceId) => serviceEnvironments.filter((environment) => environment.service_id === serviceId),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('DELETE FROM global_service_domains')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (serviceId) => {
            for (let index = serviceDomains.length - 1; index >= 0; index -= 1) {
              if (serviceDomains[index].service_id === serviceId) {
                serviceDomains.splice(index, 1)
              }
            }
          }
        }
      }

      if (sql.includes('INSERT INTO global_service_domains')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (
            id,
            serviceId,
            environmentId,
            environmentName,
            domain,
            url,
            kind,
            enabled,
            createdAt,
            updatedAt
          ) => {
            serviceDomains.push({
              id,
              service_id: serviceId,
              environment_id: environmentId,
              environment_name: environmentName,
              domain,
              url,
              kind,
              enabled,
              last_status: 'unknown',
              last_status_code: 0,
              last_response_ms: 0,
              last_checked_at: '',
              last_error: '',
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('SELECT * FROM global_service_domains WHERE service_id = ? ORDER BY domain ASC')) {
        return {
          all: (serviceId) => serviceDomains.filter((domain) => domain.service_id === serviceId),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('UPDATE global_service_domains')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (status, statusCode, responseMs, checkedAt, lastError, updatedAt, serviceId, domainId) => {
            const domain = serviceDomains.find((item) => item.service_id === serviceId && item.id === domainId)

            if (domain) {
              Object.assign(domain, {
                last_status: status,
                last_status_code: statusCode,
                last_response_ms: responseMs,
                last_checked_at: checkedAt,
                last_error: lastError,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('INSERT INTO global_service_monitor_checks')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, serviceId, domainId, status, statusCode, responseMs, checkedAt, errorMessage) => {
            serviceMonitorChecks.push({
              id,
              service_id: serviceId,
              domain_id: domainId,
              status,
              status_code: statusCode,
              response_ms: responseMs,
              checked_at: checkedAt,
              error_message: errorMessage
            })
          }
        }
      }

      if (sql.includes('DELETE FROM global_service_monitor_checks WHERE service_id = ?')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (serviceId) => {
            for (let index = serviceMonitorChecks.length - 1; index >= 0; index -= 1) {
              if (serviceMonitorChecks[index].service_id === serviceId) {
                serviceMonitorChecks.splice(index, 1)
              }
            }
          }
        }
      }

      if (sql.includes('FROM global_service_monitor_checks checks') && sql.includes('bindings.project_id = ?') && sql.includes('checks.checked_at >= ?')) {
        return {
          all: (projectId, since) =>
            serviceMonitorChecks
              .filter((check) => projectServiceBindings.some((binding) => binding.project_id === projectId && binding.service_id === check.service_id))
              .filter((check) => String(check.checked_at) >= String(since))
              .map((check) => ({ ...check, project_id: projectId }))
              .sort((left, right) => String((right as Record<string, unknown>).checked_at).localeCompare(String((left as Record<string, unknown>).checked_at))),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('DELETE FROM global_service_monitor_checks WHERE checked_at < ?')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (cutoff) => {
            for (let index = serviceMonitorChecks.length - 1; index >= 0; index -= 1) {
              if (String(serviceMonitorChecks[index].checked_at) < String(cutoff)) {
                serviceMonitorChecks.splice(index, 1)
              }
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateServiceMonitoringTables(db)
  return db
}

describe('service monitoring storage', () => {
  it('migrates legacy monitor checks when duplicate global domains use a different id', () => {
    const directory = mkdtempSync(join(tmpdir(), 'forgedesk-service-migration-'))
    const databasePath = join(directory, 'forgedesk.db')

    try {
      runSqlite(databasePath, [
        `
        PRAGMA foreign_keys = ON;

        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'ready',
          owner TEXT NOT NULL DEFAULT '',
          workspace_path TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE service_connections (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          name TEXT NOT NULL,
          token TEXT NOT NULL DEFAULT '',
          team_id TEXT NOT NULL DEFAULT '',
          workspace_id TEXT NOT NULL DEFAULT '',
          railway_token_type TEXT NOT NULL DEFAULT 'workspace',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE project_services (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          connection_id TEXT NOT NULL DEFAULT '',
          repository_id TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL,
          external_project_id TEXT NOT NULL DEFAULT '',
          external_service_id TEXT NOT NULL DEFAULT '',
          default_environment TEXT NOT NULL DEFAULT '',
          health_path TEXT NOT NULL DEFAULT '/',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_synced_at TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE service_environments (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          service_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          name TEXT NOT NULL,
          external_environment_id TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT '',
          deployment_status TEXT NOT NULL DEFAULT '',
          latest_deployment_id TEXT NOT NULL DEFAULT '',
          latest_deployment_url TEXT NOT NULL DEFAULT '',
          latest_commit TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL,
          UNIQUE(service_id, name)
        );

        CREATE TABLE service_domains (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          service_id TEXT NOT NULL,
          environment_id TEXT NOT NULL DEFAULT '',
          environment_name TEXT NOT NULL DEFAULT '',
          domain TEXT NOT NULL,
          url TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'manual',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_status TEXT NOT NULL DEFAULT 'unknown',
          last_status_code INTEGER NOT NULL DEFAULT 0,
          last_response_ms INTEGER NOT NULL DEFAULT 0,
          last_checked_at TEXT NOT NULL DEFAULT '',
          last_error TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(service_id, domain, environment_name)
        );

        CREATE TABLE service_monitor_checks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          service_id TEXT NOT NULL,
          domain_id TEXT NOT NULL,
          status TEXT NOT NULL,
          status_code INTEGER NOT NULL DEFAULT 0,
          response_ms INTEGER NOT NULL DEFAULT 0,
          checked_at TEXT NOT NULL,
          error_message TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE global_services (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          connection_id TEXT NOT NULL DEFAULT '',
          repository_id TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL,
          external_project_id TEXT NOT NULL DEFAULT '',
          external_service_id TEXT NOT NULL DEFAULT '',
          default_environment TEXT NOT NULL DEFAULT '',
          health_path TEXT NOT NULL DEFAULT '/',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_synced_at TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE global_service_domains (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL,
          environment_id TEXT NOT NULL DEFAULT '',
          environment_name TEXT NOT NULL DEFAULT '',
          domain TEXT NOT NULL,
          url TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'manual',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_status TEXT NOT NULL DEFAULT 'unknown',
          last_status_code INTEGER NOT NULL DEFAULT 0,
          last_response_ms INTEGER NOT NULL DEFAULT 0,
          last_checked_at TEXT NOT NULL DEFAULT '',
          last_error TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(service_id, domain, environment_name),
          FOREIGN KEY (service_id) REFERENCES global_services(id) ON DELETE CASCADE
        );

        CREATE TABLE global_service_monitor_checks (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL,
          domain_id TEXT NOT NULL,
          status TEXT NOT NULL,
          status_code INTEGER NOT NULL DEFAULT 0,
          response_ms INTEGER NOT NULL DEFAULT 0,
          checked_at TEXT NOT NULL,
          error_message TEXT NOT NULL DEFAULT '',
          FOREIGN KEY (service_id) REFERENCES global_services(id) ON DELETE CASCADE,
          FOREIGN KEY (domain_id) REFERENCES global_service_domains(id) ON DELETE CASCADE
        );

        INSERT INTO projects (id, name, created_at, updated_at)
        VALUES ('project-a', 'Project A', '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');

        INSERT INTO project_services (
          id, project_id, provider, name, health_path, enabled, created_at, updated_at
        )
        VALUES (
          'service-a', 'project-a', 'vercel', 'web', '/', 1, '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z'
        );

        INSERT INTO service_domains (
          id, project_id, service_id, environment_name, domain, url, kind, enabled, created_at, updated_at
        )
        VALUES (
          'legacy-domain-a', 'project-a', 'service-a', 'production', 'web.example.com',
          'https://web.example.com/', 'custom', 1, '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z'
        );

        INSERT INTO service_monitor_checks (
          id, project_id, service_id, domain_id, status, status_code, response_ms, checked_at
        )
        VALUES (
          'legacy-check-a', 'project-a', 'service-a', 'legacy-domain-a', 'online', 200, 120, '2026-06-23T00:00:00.000Z'
        );

        INSERT INTO global_services (
          id, provider, name, health_path, enabled, created_at, updated_at
        )
        VALUES (
          'service-a', 'vercel', 'web', '/', 1, '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z'
        );

        INSERT INTO global_service_domains (
          id, service_id, environment_name, domain, url, kind, enabled, created_at, updated_at
        )
        VALUES (
          'global-domain-a', 'service-a', 'production', 'web.example.com',
          'https://web.example.com/', 'custom', 1, '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z'
        );
        `
      ])

      migrateServiceMonitoringTables({
        exec: (sql) => {
          runSqlite(databasePath, ['PRAGMA foreign_keys = ON;', sql])
        },
        prepare: () => {
          throw new Error('prepare is not used by migration')
        }
      })

      const migratedRows = runSqlite(databasePath, ["SELECT id || ':' || domain_id FROM global_service_monitor_checks ORDER BY id;"])
        .trim()
        .split('\n')

      assert.deepEqual(migratedRows, ['legacy-check-a:global-domain-a'])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('redacts provider tokens while preserving the configured state', () => {
    const db = createDatabase()

    const saved = saveServiceConnection(db, {
      projectId: 'project-a',
      provider: 'vercel',
      name: 'Vercel Team',
      token: 'vercel-secret',
      teamId: 'team_123'
    })
    const [listed] = listServiceConnections(db)
    const raw = db.prepare('SELECT token FROM global_service_connections WHERE id = ?').get(saved.id) as { token: string }

    assert.equal(saved.tokenConfigured, true)
    assert.equal(saved.token, '')
    assert.equal(listed.tokenConfigured, true)
    assert.equal(listed.teamId, 'team_123')
    assert.equal(raw.token, 'vercel-secret')
  })

  it('stores services with environments and domain mappings', () => {
    const db = createDatabase()
    const connection = saveServiceConnection(db, {
      projectId: 'project-a',
      provider: 'railway',
      name: 'Railway',
      token: 'railway-secret',
      railwayTokenType: 'workspace'
    })

    saveProjectService(db, {
      projectId: 'project-a',
      provider: 'railway',
      connectionId: connection.id,
      repositoryId: 'repo-a',
      name: 'api',
      externalProjectId: 'railway-project',
      externalServiceId: 'railway-service',
      healthPath: '/healthz',
      enabled: true,
      environments: [
        {
          name: 'production',
          externalEnvironmentId: 'env-prod',
          deploymentStatus: 'SUCCESS',
          latestDeploymentId: 'dep-1'
        }
      ],
      domains: [
        {
          domain: 'api.example.com',
          environmentName: 'production',
          kind: 'custom',
          enabled: true
        }
      ]
    })

    const [service] = listProjectServices(db, 'project-a')

    assert.equal(service.name, 'api')
    assert.equal(service.repositoryId, 'repo-a')
    assert.equal(service.environments[0].name, 'production')
    assert.equal(service.domains[0].domain, 'api.example.com')
    assert.equal(service.domains[0].url, 'https://api.example.com/healthz')
  })

  it('stores provider connections and synced services globally before project binding', () => {
    const db = createDatabase()
    const connection = saveServiceConnection(db, {
      provider: 'vercel',
      name: 'Vercel Team',
      token: 'vercel-secret',
      teamId: 'team_123'
    })

    const service = saveProjectService(db, {
      provider: 'vercel',
      connectionId: connection.id,
      name: 'web',
      externalProjectId: 'prj_1',
      domains: [{ domain: 'web.example.com', enabled: true }]
    })

    assert.equal(listServiceConnections(db).length, 1)
    assert.equal(listProjectServices(db, 'project-a').length, 0)
    assert.equal(listAllProjectServices(db).length, 1)

    bindProjectService(db, { projectId: 'project-a', serviceId: service.id, repositoryId: 'repo-a' })

    assert.equal(listProjectServices(db, 'project-a').length, 1)
    assert.equal(listProjectServices(db, 'project-a')[0].repositoryId, 'repo-a')
    assert.equal(listProjectServices(db, 'project-b').length, 0)
  })

  it('deletes provider connections together with services synced from that connection', () => {
    const db = createDatabase()
    const vercel = saveServiceConnection(db, {
      provider: 'vercel',
      name: 'Vercel Team',
      token: 'vercel-secret',
      teamId: 'team_123'
    })
    const railway = saveServiceConnection(db, {
      provider: 'railway',
      name: 'Railway Team',
      token: 'railway-secret',
      railwayTokenType: 'project'
    })
    const vercelService = saveProjectService(db, {
      provider: 'vercel',
      connectionId: vercel.id,
      name: 'web',
      domains: [{ domain: 'web.example.com', enabled: true }]
    })
    const railwayService = saveProjectService(db, {
      provider: 'railway',
      connectionId: railway.id,
      name: 'api',
      domains: [{ domain: 'api.example.com', enabled: true }]
    })

    bindProjectService(db, { projectId: 'project-a', serviceId: vercelService.id })
    bindProjectService(db, { projectId: 'project-a', serviceId: railwayService.id })

    const remainingConnections = deleteServiceConnection(db, vercel.id)

    assert.deepEqual(remainingConnections.map((connection) => connection.id), [railway.id])
    assert.deepEqual(listAllProjectServices(db).map((service) => service.id), [railwayService.id])
    assert.deepEqual(listProjectServices(db, 'project-a').map((service) => service.id), [railwayService.id])
  })

  it('preserves manual domains and removes generated domains when syncing provider snapshots', () => {
    const db = createDatabase()
    const connection = saveServiceConnection(db, {
      provider: 'vercel',
      name: 'Vercel Team',
      token: 'vercel-secret',
      teamId: 'team_123'
    })
    const existing = saveProjectService(db, {
      provider: 'vercel',
      connectionId: connection.id,
      name: 'web',
      externalProjectId: 'prj_1',
      domains: [
        { domain: 'manual.example.com', kind: 'manual', enabled: true },
        { domain: 'old-generated.vercel.app', environmentName: 'production', kind: 'generated', enabled: true }
      ]
    })

    const synced = upsertProviderServiceSnapshot(db, connection.id, {
      provider: 'vercel',
      name: 'web',
      externalProjectId: 'prj_1',
      environments: [{ name: 'production', deploymentStatus: 'READY' }],
      domains: [{ domain: 'app.example.com', environmentName: 'production', kind: 'custom', enabled: true }]
    })

    assert.equal(synced.id, existing.id)
    assert.deepEqual(
      synced.domains.map((domain) => `${domain.kind}:${domain.domain}`).sort(),
      ['custom:app.example.com', 'manual:manual.example.com']
    )
  })

  it('classifies checks and prunes monitoring history beyond retention', () => {
    const db = createDatabase()
    const service = saveProjectService(db, {
      projectId: 'project-a',
      provider: 'vercel',
      name: 'web',
      enabled: true,
      domains: [{ domain: 'web.example.com', enabled: true }]
    })
    const domain = service.domains[0]

    recordServiceMonitorCheck(db, {
      projectId: 'project-a',
      serviceId: service.id,
      domainId: domain.id,
      status: 'online',
      statusCode: 204,
      responseMs: 42,
      checkedAt: '2026-06-23T00:00:00.000Z',
      errorMessage: ''
    })
    recordServiceMonitorCheck(db, {
      projectId: 'project-a',
      serviceId: service.id,
      domainId: domain.id,
      status: 'offline',
      statusCode: 0,
      responseMs: 0,
      checkedAt: '2026-05-01T00:00:00.000Z',
      errorMessage: 'timeout'
    })

    assert.equal(classifyServiceMonitorStatus(302), 'online')
    assert.equal(classifyServiceMonitorStatus(503), 'degraded')
    assert.equal(classifyServiceMonitorStatus(0, 'timeout'), 'offline')
    assert.equal(buildServiceHealthUrl('web.example.com', '/ready'), 'https://web.example.com/ready')

    deleteOldServiceMonitorHistory(db, '2026-05-24T00:00:00.000Z')

    const history = listServiceMonitorHistory(db, 'project-a')
    assert.equal(history.length, 1)
    assert.equal(history[0].statusCode, 204)
  })
})
