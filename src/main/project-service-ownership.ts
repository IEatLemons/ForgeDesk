import { randomUUID } from 'node:crypto'

type Row = Record<string, any>
type DatabaseLike = {
  exec(sql: string): void
  prepare(sql: string): { all(...params: any[]): unknown[]; get(...params: any[]): unknown; run(...params: any[]): unknown }
}

// Keep the existing storage tables and IDs where possible so logs and saved
// deployment targets survive the transition from shared to project-owned data.
export function migrateProjectServiceOwnership(db: DatabaseLike): void {
  db.exec('CREATE TABLE IF NOT EXISTS project_service_ownership_migrations (version INTEGER PRIMARY KEY)')
  db.exec(`CREATE TRIGGER IF NOT EXISTS delete_project_owned_services BEFORE DELETE ON projects BEGIN
    DELETE FROM global_service_monitor_checks WHERE service_id IN (SELECT id FROM global_services WHERE project_id = OLD.id);
    DELETE FROM global_service_deployments WHERE service_id IN (SELECT id FROM global_services WHERE project_id = OLD.id);
    DELETE FROM global_service_domains WHERE service_id IN (SELECT id FROM global_services WHERE project_id = OLD.id);
    DELETE FROM global_service_environments WHERE service_id IN (SELECT id FROM global_services WHERE project_id = OLD.id);
    DELETE FROM project_service_bindings WHERE service_id IN (SELECT id FROM global_services WHERE project_id = OLD.id);
    DELETE FROM global_services WHERE project_id = OLD.id;
    DELETE FROM railway_oauth_credentials WHERE connection_id IN (SELECT id FROM global_service_connections WHERE project_id = OLD.id);
    DELETE FROM global_service_connections WHERE project_id = OLD.id;
  END`)
  if (db.prepare('SELECT version FROM project_service_ownership_migrations WHERE version = 1').get()) return
  db.exec('SAVEPOINT project_service_ownership')
  try {
    const rows = (table: string) => db.prepare(`SELECT * FROM ${table}`).all() as Row[]
    const insert = (table: string, row: Row) => {
      const columns = Object.keys(row)
      db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...Object.values(row))
    }
    const connections = rows('global_service_connections')
    const services = rows('global_services')
    const bindings = rows('project_service_bindings')
    const targets = rows('project_deployment_targets')
    const legacyConnections = rows('service_connections')
    const connectionOwners = new Map<string, Map<string, string>>()
    for (const connection of connections) {
      const projects = new Set<string>()
      for (const legacy of legacyConnections) if (legacy.id === connection.id && legacy.project_id) projects.add(legacy.project_id)
      for (const binding of bindings) {
        if (services.some(service => service.id === binding.service_id && service.connection_id === connection.id)) projects.add(binding.project_id)
      }
      for (const target of targets) if (target.connection_id === connection.id) projects.add(target.project_id)
      const owners = new Map<string, string>()
      for (const projectId of projects) {
        const id = owners.size === 0 ? connection.id : `service-connection-${randomUUID()}`
        owners.set(projectId, id)
        if (id === connection.id) {
          db.prepare('UPDATE global_service_connections SET project_id = ? WHERE id = ?').run(projectId, id)
        } else {
          // Refresh tokens rotate. Sharing an OAuth grant between copies would
          // invalidate one project's session when the other refreshes it.
          insert('global_service_connections', { ...connection, id, project_id: projectId })
          if (connection.auth_method === 'oauth') {
            const grant = db.prepare('SELECT * FROM railway_oauth_credentials WHERE connection_id = ?').get(connection.id) as Row | undefined
            if (grant) insert('railway_oauth_credentials', { ...grant, connection_id: id, secret: '', status: 'needs-login' })
          }
        }
        db.prepare('UPDATE project_deployment_targets SET connection_id = ? WHERE project_id = ? AND connection_id = ?').run(id, projectId, connection.id)
      }
      connectionOwners.set(connection.id, owners)
    }
    for (const service of services) {
      const serviceBindings = bindings.filter(binding => binding.service_id === service.id)
      const projects = new Set<string>(serviceBindings.map(binding => binding.project_id))
      for (const target of targets) if (target.service_id === service.id) projects.add(target.project_id)
      // Unbound services from a connection with an established owner belong to
      // that project as well, keeping the previously synced inventory available.
      if (!projects.size) {
        const owner = connectionOwners.get(service.connection_id)?.keys().next().value
        if (owner) projects.add(owner)
      }
      let first = true
      for (const projectId of projects) {
        const id = first ? service.id : `project-service-${randomUUID()}`
        const connectionId = connectionOwners.get(service.connection_id)?.get(projectId) ?? service.connection_id
        const repositoryId = serviceBindings.find(binding => binding.project_id === projectId)?.repository_id ?? service.repository_id
        if (first) {
          db.prepare('UPDATE global_services SET project_id = ?, connection_id = ?, repository_id = ? WHERE id = ?').run(projectId, connectionId, repositoryId, id)
        } else {
          insert('global_services', { ...service, id, project_id: projectId, connection_id: connectionId, repository_id: repositoryId })
          const environmentIds = new Map<string, string>()
          for (const environment of db.prepare('SELECT * FROM global_service_environments WHERE service_id = ?').all(service.id) as Row[]) {
            const newId = `service-env-${randomUUID()}`
            environmentIds.set(environment.id, newId)
            insert('global_service_environments', { ...environment, id: newId, service_id: id })
          }
          const domainIds = new Map<string, string>()
          for (const domain of db.prepare('SELECT * FROM global_service_domains WHERE service_id = ?').all(service.id) as Row[]) {
            const newId = `service-domain-${randomUUID()}`
            domainIds.set(domain.id, newId)
            insert('global_service_domains', { ...domain, id: newId, service_id: id, environment_id: environmentIds.get(domain.environment_id) ?? '' })
          }
          for (const check of db.prepare('SELECT * FROM global_service_monitor_checks WHERE service_id = ?').all(service.id) as Row[]) {
            if (domainIds.has(check.domain_id)) insert('global_service_monitor_checks', { ...check, id: `service-check-${randomUUID()}`, service_id: id, domain_id: domainIds.get(check.domain_id) })
          }
          for (const deployment of db.prepare('SELECT * FROM global_service_deployments WHERE service_id = ?').all(service.id) as Row[]) {
            insert('global_service_deployments', { ...deployment, service_id: id })
          }
          db.prepare('DELETE FROM project_service_bindings WHERE project_id = ? AND service_id = ?').run(projectId, service.id)
        }
        const now = new Date().toISOString()
        db.prepare(`INSERT OR IGNORE INTO project_service_bindings (project_id, service_id, repository_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(projectId, id, repositoryId, now, now)
        db.prepare('UPDATE project_deployment_targets SET service_id = ?, connection_id = ? WHERE project_id = ? AND service_id = ?').run(id, connectionId, projectId, service.id)
        first = false
      }
    }
    db.prepare('INSERT INTO project_service_ownership_migrations (version) VALUES (1)').run()
    db.exec('RELEASE project_service_ownership')
  } catch (error) {
    db.exec('ROLLBACK TO project_service_ownership; RELEASE project_service_ownership')
    throw error
  }
}
