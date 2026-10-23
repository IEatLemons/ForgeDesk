import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { RailwayOAuthManager } from './railway-oauth.js'
import { migrateProjectServiceOwnership } from './project-service-ownership.js'
import { migrateProjectDeploymentTables, saveProjectDeploymentTarget } from './project-deployment.js'
import {
  bindProjectService, deleteServiceConnection, listProjectServices, listServiceConnections,
  migrateServiceMonitoringTables, recordServiceMonitorCheck, saveProjectService,
  saveServiceConnection, saveServiceExternalProjectAlias, upsertProviderServiceSnapshot
} from './service-monitoring.js'

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    CREATE TABLE repositories (id TEXT PRIMARY KEY);
    INSERT INTO projects VALUES ('a'), ('b');
    INSERT INTO repositories VALUES ('repo-a'), ('repo-b');`)
  migrateServiceMonitoringTables(db)
  migrateProjectDeploymentTables(db)
  new RailwayOAuthManager(db, {
    codec: { isEncryptionAvailable: () => false, encryptString: value => Buffer.from(value), decryptString: value => value.toString() },
    openExternal: async () => undefined
  })
  return db
}

function legacySharedService(db: DatabaseSync, authMethod: 'token' | 'oauth' = 'token') {
  const connection = saveServiceConnection(db, { provider: 'railway', name: 'Shared', token: 'existing-token', authMethod })
  const service = saveProjectService(db, {
    provider: 'railway', connectionId: connection.id, name: 'api', externalProjectId: 'remote-project', externalServiceId: 'remote-api',
    environments: [{ name: 'production', externalEnvironmentId: 'remote-env' }],
    domains: [{ domain: 'api.example.com', environmentName: 'production', kind: 'manual' }]
  })
  bindProjectService(db, { projectId: 'a', serviceId: service.id, repositoryId: 'repo-a' })
  bindProjectService(db, { projectId: 'b', serviceId: service.id, repositoryId: 'repo-b' })
  recordServiceMonitorCheck(db, { projectId: 'a', serviceId: service.id, domainId: service.domains[0].id, status: 'online', statusCode: 200, responseMs: 50 })
  db.prepare(`INSERT INTO global_service_deployments (id, service_id, cached_at) VALUES ('deployment', ?, 'now')`).run(service.id)
  for (const project of ['a', 'b']) db.prepare(`INSERT INTO project_deployment_targets
    (id, project_id, repository_id, provider, connection_id, service_id, display_name, created_at, updated_at)
    VALUES (?, ?, ?, 'railway', ?, ?, 'api', 'now', 'now')`).run(project, project, `repo-${project}`, connection.id, service.id)
  return { connection, service }
}

describe('project-owned platform connections', () => {
  it('splits shared credentials, services, monitor history and saved targets without losing the original IDs', () => {
    const db = setup()
    try {
      const legacy = legacySharedService(db)
      migrateProjectServiceOwnership(db)
      const [a] = listServiceConnections(db, 'a')
      const [b] = listServiceConnections(db, 'b')
      assert.equal(a.id, legacy.connection.id)
      assert.notEqual(a.id, b.id)
      assert.equal(a.token, '')
      assert.equal(b.tokenConfigured, true)
      const [sa] = listProjectServices(db, 'a')
      const [sb] = listProjectServices(db, 'b')
      assert.equal(sa.id, legacy.service.id)
      assert.notEqual(sa.id, sb.id)
      assert.equal(sa.connectionId, a.id)
      assert.equal(sb.connectionId, b.id)
      assert.equal(sb.repositoryId, 'repo-b')
      assert.notEqual(sa.environments[0].id, sb.environments[0].id)
      assert.equal(sb.domains[0].environmentId, sb.environments[0].id)
      assert.equal(db.prepare('SELECT count(*) AS count FROM global_service_monitor_checks WHERE service_id = ?').get(sb.id)?.count, 1)
      assert.equal(db.prepare('SELECT count(*) AS count FROM global_service_deployments WHERE service_id = ?').get(sb.id)?.count, 1)
      assert.equal(db.prepare('SELECT service_id FROM project_deployment_targets WHERE id = ?').get('b')?.service_id, sb.id)
      migrateServiceMonitoringTables(db)
      migrateProjectServiceOwnership(db)
      assert.equal(listProjectServices(db, 'b').length, 1)
      assert.equal(listServiceConnections(db, 'b')[0].id, b.id)
    } finally { db.close() }
  })

  it('keeps a copied OAuth connection disconnected so rotating grants are never shared', () => {
    const db = setup()
    try {
      const legacy = legacySharedService(db, 'oauth')
      db.prepare(`INSERT INTO railway_oauth_credentials (connection_id, client_id, account_name, account_email, scopes) VALUES (?, 'native-client', 'User', 'user@example.com', 'project:member')`).run(legacy.connection.id)
      migrateProjectServiceOwnership(db)
      const [copy] = listServiceConnections(db, 'b')
      assert.equal(copy.authMethod, 'oauth')
      assert.equal(copy.tokenConfigured, false)
      assert.equal(copy.oauth?.status, 'needs-login')
      assert.equal(copy.oauth?.clientId, 'native-client')
    } finally { db.close() }
  })

  it('automatically puts synced services in the owning project and keeps repeated sync idempotent', () => {
    const db = setup()
    try {
      const connection = saveServiceConnection(db, { projectId: 'a', provider: 'railway', name: 'A', token: 'token' })
      const snapshot = { provider: 'railway' as const, name: 'api', externalProjectId: 'remote', externalServiceId: 'api', environments: [{ name: 'production' }], domains: [] }
      const service = upsertProviderServiceSnapshot(db, connection.id, snapshot)
      upsertProviderServiceSnapshot(db, connection.id, snapshot)
      assert.equal(service.projectId, 'a')
      assert.equal(listProjectServices(db, 'a').length, 1)
      assert.equal(listProjectServices(db, 'b').length, 0)
      assert.equal(listServiceConnections(db, 'b').length, 0)
      assert.throws(() => saveServiceConnection(db, { id: connection.id, projectId: 'b', provider: 'railway', name: 'B' }), /其他项目/)
      assert.throws(() => saveProjectService(db, { projectId: 'b', provider: 'railway', connectionId: connection.id, name: 'wrong' }), /当前项目/)
      assert.throws(() => bindProjectService(db, { projectId: 'b', serviceId: service.id }), /其他项目/)
    } finally { db.close() }
  })

  it('isolates aliases and connection deletion even when projects manage the same remote resource', () => {
    const db = setup()
    try {
      legacySharedService(db)
      migrateProjectServiceOwnership(db)
      saveServiceExternalProjectAlias(db, { projectId: 'a', provider: 'railway', externalProjectId: 'remote-project', alias: 'A alias' })
      assert.equal(listProjectServices(db, 'a')[0].externalProjectAlias, 'A alias')
      assert.equal(listProjectServices(db, 'b')[0].externalProjectAlias, '')
      deleteServiceConnection(db, listServiceConnections(db, 'a')[0].id)
      assert.equal(listServiceConnections(db, 'a').length, 0)
      assert.equal(listProjectServices(db, 'a').length, 0)
      assert.equal(listProjectServices(db, 'b').length, 1)
      assert.equal(listServiceConnections(db, 'b')[0].tokenConfigured, true)
    } finally { db.close() }
  })


  it('removes only the deleted project’s credentials and inventory', () => {
    const db = setup()
    try {
      legacySharedService(db)
      migrateProjectServiceOwnership(db)
      db.prepare('DELETE FROM projects WHERE id = ?').run('a')
      assert.equal(listServiceConnections(db, 'a').length, 0)
      assert.equal(listProjectServices(db, 'a').length, 0)
      assert.equal(listServiceConnections(db, 'b').length, 1)
      assert.equal(listProjectServices(db, 'b').length, 1)
    } finally { db.close() }
  })


  it('does not resurrect deleted project credentials from legacy tables after restart', () => {
    const db = setup()
    try {
      db.exec(`DELETE FROM service_monitoring_migrations;
        INSERT INTO service_connections (id, project_id, provider, name, token, created_at, updated_at)
        VALUES ('legacy-connection', 'a', 'railway', 'Legacy', 'old-token', 'now', 'now');
        INSERT INTO project_services (id, project_id, provider, connection_id, name, created_at, updated_at)
        VALUES ('legacy-service', 'a', 'railway', 'legacy-connection', 'api', 'now', 'now');`)
      migrateServiceMonitoringTables(db)
      migrateProjectServiceOwnership(db)
      assert.equal(listProjectServices(db, 'a').length, 1)
      deleteServiceConnection(db, 'legacy-connection')
      migrateServiceMonitoringTables(db)
      migrateProjectServiceOwnership(db)
      assert.equal(listServiceConnections(db, 'a').length, 0)
      assert.equal(listProjectServices(db, 'a').length, 0)
      assert.equal(db.prepare('SELECT count(*) AS count FROM global_service_connections').get()?.count, 0)
    } finally { db.close() }
  })

  it('rejects cross-project connections and services in saved deployment targets', () => {
    const db = setup()
    try {
      const { connection } = legacySharedService(db)
      migrateProjectServiceOwnership(db)
      assert.throws(() => saveProjectDeploymentTarget(db, {
        projectId: 'b', repositoryId: 'repo-b', provider: 'railway', connectionId: connection.id,
        config: { sourceMode: 'git' }
      }), /当前项目/)
    } finally { db.close() }
  })
})
