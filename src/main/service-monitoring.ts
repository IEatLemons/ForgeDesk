import {
  addVercelProjectDomain,
  cancelVercelDeployment,
  inspectVercelDomainConfig,
  listRailwayDeployments,
  listRailwayProjectEnvVars,
  listVercelDeployments,
  listVercelProjectEnvVars,
  promoteVercelDeployment,
  readRailwayDeploymentLogs,
  readRailwayEnvironmentLogs,
  readVercelDeploymentLogs,
  readVercelEnvVar,
  readVercelRuntimeLogs,
  redeployVercelDeployment,
  removeVercelProjectDomain,
  removeVercelProjectEnvVar,
  rollbackVercelDeployment,
  saveVercelProjectEnvVar,
  syncRailwayProviderServices,
  syncVercelProviderServices,
  verifyVercelProjectDomain,
  type ProviderDeploymentLogLine,
  type ProviderServiceDomainSnapshot,
  type ProviderServiceEnvironmentSnapshot,
  type ProviderServiceSnapshot,
  type RailwayTokenType,
  type ServiceDeploymentListOptions,
  type ServiceDeploymentSummary,
  type ServiceEnvVarRecord,
  type ServiceProviderFetch,
  type ServiceProviderType,
  type VercelDeploymentListOptions,
  type VercelDeploymentSummary,
  type VercelDomainConfig,
  type VercelDomainInput,
  type VercelEnvVarInput,
  type VercelEnvVarRecord
} from './service-provider-adapters.js'

export type {
  RailwayTokenType,
  ServiceDeploymentListOptions,
  ServiceDeploymentSummary,
  ServiceEnvVarRecord,
  ServiceProviderFetch,
  ServiceProviderType,
  VercelDeploymentListOptions,
  VercelDeploymentSummary,
  VercelDomainConfig,
  VercelDomainInput,
  VercelEnvVarInput,
  VercelEnvVarRecord
}

export type ServiceMonitorStatus = 'online' | 'degraded' | 'offline' | 'unknown'

export type ServiceConnectionInput = {
  id?: string
  projectId?: string
  provider: ServiceProviderType
  name: string
  token?: string
  teamId?: string
  workspaceId?: string
  railwayTokenType?: RailwayTokenType
}

export type ServiceConnectionRecord = {
  id: string
  projectId: string
  provider: ServiceProviderType
  name: string
  token: string
  tokenConfigured: boolean
  teamId: string
  workspaceId: string
  railwayTokenType: RailwayTokenType
  createdAt: string
  updatedAt: string
}

export type ProjectServiceEnvironmentInput = ProviderServiceEnvironmentSnapshot & {
  status?: string
}

export type ProjectServiceDomainInput = ProviderServiceDomainSnapshot & {
  url?: string
}

export type ProjectServiceInput = {
  id?: string
  projectId?: string
  provider: ServiceProviderType
  connectionId?: string
  repositoryId?: string
  name: string
  externalProjectId?: string
  externalProjectName?: string
  externalProjectAlias?: string
  externalServiceId?: string
  defaultEnvironment?: string
  healthPath?: string
  enabled?: boolean
  lastSyncedAt?: string
  environments?: ProjectServiceEnvironmentInput[]
  domains?: ProjectServiceDomainInput[]
}

export type ProjectServiceBindingInput = {
  projectId: string
  serviceId: string
  repositoryId?: string
}

export type ProjectServiceEnvironmentRecord = {
  id: string
  projectId: string
  serviceId: string
  provider: ServiceProviderType
  name: string
  externalEnvironmentId: string
  status: string
  deploymentStatus: string
  latestDeploymentId: string
  latestDeploymentUrl: string
  latestCommit: string
  updatedAt: string
}

export type ProjectServiceDomainRecord = {
  id: string
  projectId: string
  serviceId: string
  environmentId: string
  environmentName: string
  domain: string
  url: string
  kind: 'custom' | 'generated' | 'manual'
  enabled: boolean
  lastStatus: ServiceMonitorStatus
  lastStatusCode: number
  lastResponseMs: number
  lastCheckedAt: string
  lastError: string
  createdAt: string
  updatedAt: string
}

export type ProjectServiceRecord = {
  id: string
  projectId: string
  provider: ServiceProviderType
  connectionId: string
  repositoryId: string
  name: string
  externalProjectId: string
  externalProjectName: string
  externalProjectAlias: string
  externalServiceId: string
  defaultEnvironment: string
  healthPath: string
  enabled: boolean
  lastSyncedAt: string
  createdAt: string
  updatedAt: string
  environments: ProjectServiceEnvironmentRecord[]
  domains: ProjectServiceDomainRecord[]
}

export type ServiceMonitorCheckInput = {
  projectId: string
  serviceId: string
  domainId: string
  status: ServiceMonitorStatus
  statusCode: number
  responseMs: number
  checkedAt?: string
  errorMessage?: string
}

export type ServiceMonitorCheckRecord = {
  id: string
  projectId: string
  serviceId: string
  domainId: string
  status: ServiceMonitorStatus
  statusCode: number
  responseMs: number
  checkedAt: string
  errorMessage: string
}

export type ServiceEnvironmentLogRecord = ProviderDeploymentLogLine

export type VercelDeploymentActionInput = {
  action: 'redeploy' | 'cancel' | 'promote' | 'rollback'
  deploymentId: string
  description?: string
}

export type ServiceExternalProjectAliasInput = {
  provider: ServiceProviderType
  externalProjectId: string
  alias?: string
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function assertProjectExists(db: DatabaseLike, projectId: string): void {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)

  if (!project) {
    throw new Error('项目不存在')
  }
}

function normalizeProvider(value: string): ServiceProviderType {
  if (value === 'railway' || value === 'vercel') {
    return value
  }

  throw new Error('服务平台只支持 Railway 或 Vercel')
}

function normalizeRailwayTokenType(value: unknown): RailwayTokenType {
  return value === 'project' || value === 'workspace' || value === 'account' ? value : 'workspace'
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHealthPath(value: unknown): string {
  const path = trimText(value) || '/'

  return path.startsWith('/') ? path : `/${path}`
}

function normalizeDomainValue(value: string): string {
  const raw = value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')

  if (!raw) {
    throw new Error('请输入域名')
  }

  return raw.split('/')[0]
}

function normalizeDomainKind(value: unknown): ProjectServiceDomainRecord['kind'] {
  return value === 'custom' || value === 'generated' || value === 'manual' ? value : 'manual'
}

export function isMonitorableServiceDomain(domain: Pick<ProjectServiceDomainRecord, 'enabled' | 'kind'>, provider?: ServiceProviderType): boolean {
  return domain.enabled && (domain.kind === 'custom' || domain.kind === 'manual' || (provider === 'railway' && domain.kind === 'generated'))
}

export function buildServiceHealthUrl(domain: string, healthPath = '/'): string {
  const normalizedDomain = normalizeDomainValue(domain)
  const normalizedPath = normalizeHealthPath(healthPath)

  return `https://${normalizedDomain}${normalizedPath}`
}

export function classifyServiceMonitorStatus(statusCode: number, errorMessage = ''): ServiceMonitorStatus {
  if (errorMessage || statusCode === 0) {
    return 'offline'
  }

  return statusCode >= 200 && statusCode < 400 ? 'online' : 'degraded'
}

export function migrateServiceMonitoringTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_connections (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT '',
      team_id TEXT NOT NULL DEFAULT '',
      workspace_id TEXT NOT NULL DEFAULT '',
      railway_token_type TEXT NOT NULL DEFAULT 'workspace',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_services (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      connection_id TEXT NOT NULL DEFAULT '',
      repository_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      external_project_id TEXT NOT NULL DEFAULT '',
      external_project_name TEXT NOT NULL DEFAULT '',
      external_project_alias TEXT NOT NULL DEFAULT '',
      external_service_id TEXT NOT NULL DEFAULT '',
      default_environment TEXT NOT NULL DEFAULT '',
      health_path TEXT NOT NULL DEFAULT '/',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_environments (
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
      UNIQUE(service_id, name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES project_services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_domains (
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
      UNIQUE(service_id, domain, environment_name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES project_services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_monitor_checks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      status TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 0,
      response_ms INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT NOT NULL,
      error_message TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES project_services(id) ON DELETE CASCADE,
      FOREIGN KEY (domain_id) REFERENCES service_domains(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS global_service_connections (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT '',
      team_id TEXT NOT NULL DEFAULT '',
      workspace_id TEXT NOT NULL DEFAULT '',
      railway_token_type TEXT NOT NULL DEFAULT 'workspace',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_services (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      connection_id TEXT NOT NULL DEFAULT '',
      repository_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      external_project_id TEXT NOT NULL DEFAULT '',
      external_project_name TEXT NOT NULL DEFAULT '',
      external_project_alias TEXT NOT NULL DEFAULT '',
      external_service_id TEXT NOT NULL DEFAULT '',
      default_environment TEXT NOT NULL DEFAULT '',
      health_path TEXT NOT NULL DEFAULT '/',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_service_environments (
      id TEXT PRIMARY KEY,
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
      UNIQUE(service_id, name),
      FOREIGN KEY (service_id) REFERENCES global_services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS global_service_domains (
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

    CREATE TABLE IF NOT EXISTS global_service_monitor_checks (
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

    CREATE TABLE IF NOT EXISTS project_service_bindings (
      project_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      repository_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, service_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES global_services(id) ON DELETE CASCADE
    );

    INSERT OR IGNORE INTO global_service_connections (id, provider, name, token, team_id, workspace_id, railway_token_type, created_at, updated_at)
    SELECT id, provider, name, token, team_id, workspace_id, railway_token_type, created_at, updated_at
    FROM service_connections;

    INSERT OR IGNORE INTO global_services (
      id, provider, connection_id, repository_id, name, external_project_id, external_service_id,
      default_environment, health_path, enabled, last_synced_at, created_at, updated_at
    )
    SELECT id, provider, connection_id, repository_id, name, external_project_id, external_service_id,
      default_environment, health_path, enabled, last_synced_at, created_at, updated_at
    FROM project_services;

    INSERT OR IGNORE INTO project_service_bindings (project_id, service_id, repository_id, created_at, updated_at)
    SELECT project_id, id, repository_id, created_at, updated_at
    FROM project_services
    WHERE project_id != '';

    INSERT OR IGNORE INTO global_service_environments (
      id, service_id, provider, name, external_environment_id, status, deployment_status,
      latest_deployment_id, latest_deployment_url, latest_commit, updated_at
    )
    SELECT id, service_id, provider, name, external_environment_id, status, deployment_status,
      latest_deployment_id, latest_deployment_url, latest_commit, updated_at
    FROM service_environments;

    INSERT OR IGNORE INTO global_service_domains (
      id, service_id, environment_id, environment_name, domain, url, kind, enabled,
      last_status, last_status_code, last_response_ms, last_checked_at, last_error, created_at, updated_at
    )
    SELECT id, service_id, environment_id, environment_name, domain, url, kind, enabled,
      last_status, last_status_code, last_response_ms, last_checked_at, last_error, created_at, updated_at
    FROM service_domains;

    INSERT OR IGNORE INTO global_service_monitor_checks (id, service_id, domain_id, status, status_code, response_ms, checked_at, error_message)
    SELECT checks.id, checks.service_id, global_domains.id, checks.status, checks.status_code, checks.response_ms, checks.checked_at, checks.error_message
    FROM service_monitor_checks checks
    INNER JOIN global_services services ON services.id = checks.service_id
    INNER JOIN service_domains legacy_domains ON legacy_domains.id = checks.domain_id
    INNER JOIN global_service_domains global_domains
      ON global_domains.service_id = checks.service_id
      AND global_domains.domain = legacy_domains.domain
      AND global_domains.environment_name = legacy_domains.environment_name;

    CREATE INDEX IF NOT EXISTS idx_project_services_project ON project_services(project_id);
    CREATE INDEX IF NOT EXISTS idx_service_domains_project ON service_domains(project_id);
    CREATE INDEX IF NOT EXISTS idx_service_monitor_checks_project_checked ON service_monitor_checks(project_id, checked_at);
    CREATE INDEX IF NOT EXISTS idx_global_services_connection ON global_services(connection_id);
    CREATE INDEX IF NOT EXISTS idx_global_service_domains_service ON global_service_domains(service_id);
    CREATE INDEX IF NOT EXISTS idx_global_service_monitor_checks_checked ON global_service_monitor_checks(checked_at);
    CREATE INDEX IF NOT EXISTS idx_project_service_bindings_project ON project_service_bindings(project_id);
  `)

  addColumnIfMissing(db, 'project_services', 'external_project_name', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'project_services', 'external_project_alias', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'global_services', 'external_project_name', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'global_services', 'external_project_alias', "TEXT NOT NULL DEFAULT ''")
}

function addColumnIfMissing(db: DatabaseLike, table: string, column: string, definition: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch (error) {
    if (!String(error).toLowerCase().includes('duplicate column')) {
      throw error
    }
  }
}

function mapConnectionRow(row: Record<string, unknown>): ServiceConnectionRecord {
  const token = String(row.token ?? '')

  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ''),
    provider: normalizeProvider(String(row.provider)),
    name: String(row.name ?? ''),
    token: '',
    tokenConfigured: Boolean(token),
    teamId: String(row.team_id ?? ''),
    workspaceId: String(row.workspace_id ?? ''),
    railwayTokenType: normalizeRailwayTokenType(row.railway_token_type),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function mapConnectionSecretRow(row: Record<string, unknown>): ServiceConnectionRecord {
  return {
    ...mapConnectionRow(row),
    token: String(row.token ?? '')
  }
}

export function listServiceConnections(db: DatabaseLike): ServiceConnectionRecord[] {
  return db
    .prepare('SELECT * FROM global_service_connections ORDER BY created_at ASC')
    .all()
    .map((row) => mapConnectionRow(row as Record<string, unknown>))
}

function getServiceConnectionSecret(db: DatabaseLike, connectionId: string): ServiceConnectionRecord | null {
  const row = db.prepare('SELECT * FROM global_service_connections WHERE id = ?').get(connectionId) as Record<string, unknown> | undefined

  return row ? mapConnectionSecretRow(row) : null
}

export function saveServiceConnection(db: DatabaseLike, input: ServiceConnectionInput): ServiceConnectionRecord {
  const provider = normalizeProvider(input.provider)
  const name = trimText(input.name) || (provider === 'vercel' ? 'Vercel' : 'Railway')
  const editing = input.id ? getServiceConnectionSecret(db, input.id) : null
  const id = editing?.id ?? input.id ?? createId('service-connection')
  const token = input.token === undefined ? editing?.token ?? '' : trimText(input.token)
  const now = nowIso()

  if (editing) {
    db.prepare(
      `
      UPDATE global_service_connections
      SET provider = ?, name = ?, token = ?, team_id = ?, workspace_id = ?, railway_token_type = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(provider, name, token, trimText(input.teamId), trimText(input.workspaceId), normalizeRailwayTokenType(input.railwayTokenType), now, id)
  } else {
    db.prepare(
      `
      INSERT INTO global_service_connections (id, provider, name, token, team_id, workspace_id, railway_token_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, provider, name, token, trimText(input.teamId), trimText(input.workspaceId), normalizeRailwayTokenType(input.railwayTokenType), now, now)
  }

  const row = db.prepare('SELECT * FROM global_service_connections WHERE id = ?').get(id)

  if (!row) {
    throw new Error('服务连接保存失败')
  }

  return mapConnectionRow(row as Record<string, unknown>)
}

function deleteGlobalService(db: DatabaseLike, serviceId: string): void {
  db.prepare('DELETE FROM project_service_bindings WHERE service_id = ?').run(serviceId)
  db.prepare('DELETE FROM global_service_monitor_checks WHERE service_id = ?').run(serviceId)
  db.prepare('DELETE FROM global_service_domains WHERE service_id = ?').run(serviceId)
  db.prepare('DELETE FROM global_service_environments WHERE service_id = ?').run(serviceId)
  db.prepare('DELETE FROM global_services WHERE id = ?').run(serviceId)
}

export function deleteServiceConnection(db: DatabaseLike, connectionId: string): ServiceConnectionRecord[] {
  const connection = getServiceConnectionSecret(db, connectionId)

  if (!connection) {
    throw new Error('服务连接不存在')
  }

  const services = db.prepare('SELECT id FROM global_services WHERE connection_id = ?').all(connectionId) as Array<Record<string, unknown>>

  for (const service of services) {
    deleteGlobalService(db, String(service.id))
  }

  db.prepare('DELETE FROM global_service_connections WHERE id = ?').run(connectionId)

  return listServiceConnections(db)
}

function mapEnvironmentRow(row: Record<string, unknown>): ProjectServiceEnvironmentRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ''),
    serviceId: String(row.service_id),
    provider: normalizeProvider(String(row.provider)),
    name: String(row.name ?? ''),
    externalEnvironmentId: String(row.external_environment_id ?? ''),
    status: String(row.status ?? ''),
    deploymentStatus: String(row.deployment_status ?? ''),
    latestDeploymentId: String(row.latest_deployment_id ?? ''),
    latestDeploymentUrl: String(row.latest_deployment_url ?? ''),
    latestCommit: String(row.latest_commit ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function mapDomainRow(row: Record<string, unknown>): ProjectServiceDomainRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ''),
    serviceId: String(row.service_id),
    environmentId: String(row.environment_id ?? ''),
    environmentName: String(row.environment_name ?? ''),
    domain: String(row.domain ?? ''),
    url: String(row.url ?? ''),
    kind: normalizeDomainKind(row.kind),
    enabled: Boolean(row.enabled),
    lastStatus: classifyMonitorStatusValue(row.last_status),
    lastStatusCode: Number(row.last_status_code ?? 0),
    lastResponseMs: Number(row.last_response_ms ?? 0),
    lastCheckedAt: String(row.last_checked_at ?? ''),
    lastError: String(row.last_error ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function classifyMonitorStatusValue(value: unknown): ServiceMonitorStatus {
  return value === 'online' || value === 'degraded' || value === 'offline' || value === 'unknown' ? value : 'unknown'
}

function mapServiceRow(db: DatabaseLike, row: Record<string, unknown>): ProjectServiceRecord {
  const serviceId = String(row.id)
  const boundProjectId = String(row.bound_project_id ?? row.project_id ?? '')
  const boundRepositoryId = String(row.bound_repository_id ?? row.repository_id ?? '')

  return {
    id: serviceId,
    projectId: boundProjectId,
    provider: normalizeProvider(String(row.provider)),
    connectionId: String(row.connection_id ?? ''),
    repositoryId: boundRepositoryId,
    name: String(row.name ?? ''),
    externalProjectId: String(row.external_project_id ?? ''),
    externalProjectName: String(row.external_project_name ?? ''),
    externalProjectAlias: String(row.external_project_alias ?? ''),
    externalServiceId: String(row.external_service_id ?? ''),
    defaultEnvironment: String(row.default_environment ?? ''),
    healthPath: String(row.health_path ?? '/'),
    enabled: Boolean(row.enabled),
    lastSyncedAt: String(row.last_synced_at ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    environments: db
      .prepare('SELECT * FROM global_service_environments WHERE service_id = ? ORDER BY name ASC')
      .all(serviceId)
      .map((environmentRow) => mapEnvironmentRow(environmentRow as Record<string, unknown>)),
    domains: db
      .prepare('SELECT * FROM global_service_domains WHERE service_id = ? ORDER BY domain ASC')
      .all(serviceId)
      .map((domainRow) => mapDomainRow(domainRow as Record<string, unknown>))
  }
}

export function listProjectServices(db: DatabaseLike, projectId: string): ProjectServiceRecord[] {
  return db
    .prepare(
      `
      SELECT services.*, bindings.project_id AS bound_project_id, bindings.repository_id AS bound_repository_id
      FROM global_services services
      INNER JOIN project_service_bindings bindings ON bindings.service_id = services.id
      WHERE bindings.project_id = ?
      ORDER BY services.created_at ASC
    `
    )
    .all(projectId)
    .map((row) => mapServiceRow(db, row as Record<string, unknown>))
}

export function listAllProjectServices(db: DatabaseLike): ProjectServiceRecord[] {
  return db
    .prepare("SELECT services.*, '' AS bound_project_id, services.repository_id AS bound_repository_id FROM global_services services ORDER BY services.created_at ASC")
    .all()
    .map((row) => mapServiceRow(db, row as Record<string, unknown>))
}

function getProjectService(db: DatabaseLike, serviceId: string): ProjectServiceRecord | null {
  const row = db.prepare('SELECT * FROM global_services WHERE id = ?').get(serviceId) as Record<string, unknown> | undefined

  return row ? mapServiceRow(db, row) : null
}

function replaceServiceEnvironments(db: DatabaseLike, service: ProjectServiceRecord, environments: ProjectServiceEnvironmentInput[]): Map<string, string> {
  const now = nowIso()
  const environmentIds = new Map<string, string>()

  db.prepare('DELETE FROM global_service_environments WHERE service_id = ?').run(service.id)

  for (const environmentInput of environments) {
    const name = trimText(environmentInput.name) || 'production'
    const id = createId('service-env')

    environmentIds.set(name, id)
    db.prepare(
      `
      INSERT INTO global_service_environments (
        id, service_id, provider, name, external_environment_id, status, deployment_status,
        latest_deployment_id, latest_deployment_url, latest_commit, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      service.id,
      service.provider,
      name,
      trimText(environmentInput.externalEnvironmentId),
      trimText(environmentInput.status),
      trimText(environmentInput.deploymentStatus),
      trimText(environmentInput.latestDeploymentId),
      trimText(environmentInput.latestDeploymentUrl),
      trimText(environmentInput.latestCommit),
      now
    )
  }

  return environmentIds
}

function replaceServiceDomains(db: DatabaseLike, service: ProjectServiceRecord, domains: ProjectServiceDomainInput[], environmentIds: Map<string, string>): void {
  const now = nowIso()

  db.prepare('DELETE FROM global_service_domains WHERE service_id = ?').run(service.id)

  for (const domainInput of domains) {
    const domain = normalizeDomainValue(domainInput.domain)
    const environmentName = trimText(domainInput.environmentName)
    const url = trimText(domainInput.url) || buildServiceHealthUrl(domain, service.healthPath)

    db.prepare(
      `
      INSERT INTO global_service_domains (
        id, service_id, environment_id, environment_name, domain, url, kind, enabled,
        last_status, last_status_code, last_response_ms, last_checked_at, last_error, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unknown', 0, 0, '', '', ?, ?)
    `
    ).run(
      createId('service-domain'),
      service.id,
      environmentName ? environmentIds.get(environmentName) ?? '' : '',
      environmentName,
      domain,
      url,
      normalizeDomainKind(domainInput.kind),
      domainInput.enabled === false ? 0 : 1,
      now,
      now
    )
  }
}

export function saveProjectService(db: DatabaseLike, input: ProjectServiceInput): ProjectServiceRecord {
  if (input.projectId) {
    assertProjectExists(db, input.projectId)
  }

  const provider = normalizeProvider(input.provider)
  const name = trimText(input.name)

  if (!name) {
    throw new Error('请输入服务名称')
  }

  const editing = input.id ? getProjectService(db, input.id) : null
  const id = editing?.id ?? input.id ?? createId('project-service')
  const now = nowIso()
  const healthPath = normalizeHealthPath(input.healthPath)
  const externalProjectAlias = input.externalProjectAlias === undefined ? editing?.externalProjectAlias ?? '' : trimText(input.externalProjectAlias)

  if (editing) {
    db.prepare(
      `
      UPDATE global_services
      SET provider = ?, connection_id = ?, repository_id = ?, name = ?, external_project_id = ?,
          external_project_name = ?, external_project_alias = ?, external_service_id = ?, default_environment = ?, health_path = ?, enabled = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(
      provider,
      trimText(input.connectionId),
      trimText(input.repositoryId),
      name,
      trimText(input.externalProjectId),
      trimText(input.externalProjectName),
      externalProjectAlias,
      trimText(input.externalServiceId),
      trimText(input.defaultEnvironment),
      healthPath,
      input.enabled === false ? 0 : 1,
      trimText(input.lastSyncedAt) || editing.lastSyncedAt,
      now,
      id
    )
  } else {
    db.prepare(
      `
      INSERT INTO global_services (
        id, provider, connection_id, repository_id, name, external_project_id, external_project_name, external_project_alias, external_service_id,
        default_environment, health_path, enabled, last_synced_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      provider,
      trimText(input.connectionId),
      trimText(input.repositoryId),
      name,
      trimText(input.externalProjectId),
      trimText(input.externalProjectName),
      externalProjectAlias,
      trimText(input.externalServiceId),
      trimText(input.defaultEnvironment),
      healthPath,
      input.enabled === false ? 0 : 1,
      trimText(input.lastSyncedAt),
      now,
      now
    )
  }

  const service = getProjectService(db, id)

  if (!service) {
    throw new Error('服务保存失败')
  }

  const environmentIds = replaceServiceEnvironments(db, service, input.environments ?? [])
  replaceServiceDomains(db, { ...service, healthPath }, input.domains ?? [], environmentIds)

  if (input.projectId) {
    bindProjectService(db, { projectId: input.projectId, serviceId: id, repositoryId: input.repositoryId })
    return listProjectServices(db, input.projectId).find((item) => item.id === id) as ProjectServiceRecord
  }

  return getProjectService(db, id) as ProjectServiceRecord
}

export function bindProjectService(db: DatabaseLike, input: ProjectServiceBindingInput): ProjectServiceRecord[] {
  assertProjectExists(db, input.projectId)

  if (!getProjectService(db, input.serviceId)) {
    throw new Error('服务不存在')
  }

  const now = nowIso()

  db.prepare(
    `
    INSERT INTO project_service_bindings (project_id, service_id, repository_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(project_id, service_id) DO UPDATE SET repository_id = excluded.repository_id, updated_at = excluded.updated_at
  `
  ).run(input.projectId, input.serviceId, trimText(input.repositoryId), now, now)

  return listProjectServices(db, input.projectId)
}

export function saveServiceExternalProjectAlias(db: DatabaseLike, input: ServiceExternalProjectAliasInput): ProjectServiceRecord[] {
  const provider = normalizeProvider(input.provider)
  const externalProjectId = trimText(input.externalProjectId)

  if (!externalProjectId) {
    throw new Error('缺少平台项目 ID')
  }

  db.prepare(
    `
    UPDATE global_services
    SET external_project_alias = ?, updated_at = ?
    WHERE provider = ? AND external_project_id = ?
  `
  ).run(trimText(input.alias), nowIso(), provider, externalProjectId)

  return listAllProjectServices(db)
}

export function recordServiceMonitorCheck(db: DatabaseLike, input: ServiceMonitorCheckInput): ServiceMonitorCheckRecord {
  const checkedAt = input.checkedAt || nowIso()
  const id = createId('service-check')
  const status = classifyMonitorStatusValue(input.status)

  db.prepare(
    `
    INSERT INTO global_service_monitor_checks (id, service_id, domain_id, status, status_code, response_ms, checked_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, input.serviceId, input.domainId, status, input.statusCode, input.responseMs, checkedAt, input.errorMessage ?? '')
  db.prepare(
    `
    UPDATE global_service_domains
    SET last_status = ?, last_status_code = ?, last_response_ms = ?, last_checked_at = ?, last_error = ?, updated_at = ?
    WHERE service_id = ? AND id = ?
  `
  ).run(status, input.statusCode, input.responseMs, checkedAt, input.errorMessage ?? '', nowIso(), input.serviceId, input.domainId)

  return {
    id,
    projectId: input.projectId,
    serviceId: input.serviceId,
    domainId: input.domainId,
    status,
    statusCode: input.statusCode,
    responseMs: input.responseMs,
    checkedAt,
    errorMessage: input.errorMessage ?? ''
  }
}

function mapMonitorCheckRow(row: Record<string, unknown>): ServiceMonitorCheckRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    serviceId: String(row.service_id),
    domainId: String(row.domain_id),
    status: classifyMonitorStatusValue(row.status),
    statusCode: Number(row.status_code ?? 0),
    responseMs: Number(row.response_ms ?? 0),
    checkedAt: String(row.checked_at ?? ''),
    errorMessage: String(row.error_message ?? '')
  }
}

export function listServiceMonitorHistory(db: DatabaseLike, projectId: string, days = 30): ServiceMonitorCheckRecord[] {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  return db
    .prepare(
      `
      SELECT checks.*, bindings.project_id AS project_id
      FROM global_service_monitor_checks checks
      INNER JOIN project_service_bindings bindings ON bindings.service_id = checks.service_id
      WHERE bindings.project_id = ? AND checks.checked_at >= ?
      ORDER BY checks.checked_at DESC
    `
    )
    .all(projectId, since)
    .map((row) => mapMonitorCheckRow(row as Record<string, unknown>))
}

export function listAllServiceMonitorHistory(db: DatabaseLike, days = 30): ServiceMonitorCheckRecord[] {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  return db
    .prepare("SELECT checks.*, '' AS project_id FROM global_service_monitor_checks checks WHERE checked_at >= ? ORDER BY checked_at DESC")
    .all(since)
    .map((row) => mapMonitorCheckRow(row as Record<string, unknown>))
}

export function deleteOldServiceMonitorHistory(db: DatabaseLike, cutoffIso: string): void {
  db.prepare('DELETE FROM global_service_monitor_checks WHERE checked_at < ?').run(cutoffIso)
}

export function listLatestServiceMonitorChecks(db: DatabaseLike, projectId: string): ServiceMonitorCheckRecord[] {
  return db
    .prepare(
      `
      SELECT checks.*, bindings.project_id AS project_id
      FROM global_service_monitor_checks checks
      INNER JOIN project_service_bindings bindings ON bindings.service_id = checks.service_id
      INNER JOIN (
        SELECT domain_id, MAX(checked_at) AS checked_at
        FROM global_service_monitor_checks
        GROUP BY domain_id
      ) latest ON latest.domain_id = checks.domain_id AND latest.checked_at = checks.checked_at
      WHERE bindings.project_id = ?
      ORDER BY checks.checked_at DESC
    `
    )
    .all(projectId)
    .map((row) => mapMonitorCheckRow(row as Record<string, unknown>))
}

function providerSnapshotToProjectServiceInput(
  connectionId: string,
  snapshot: ProviderServiceSnapshot,
  existing?: ProjectServiceRecord
): ProjectServiceInput {
  const manualDomains =
    existing?.domains
      .filter((domain) => domain.kind === 'manual')
      .filter((domain) => !snapshot.domains.some((snapshotDomain) => normalizeDomainValue(snapshotDomain.domain) === domain.domain))
      .map((domain): ProjectServiceDomainInput => ({
        domain: domain.domain,
        environmentName: domain.environmentName,
        kind: 'manual',
        enabled: domain.enabled
      })) ?? []

  return {
    id: existing?.id,
    provider: snapshot.provider,
    connectionId,
    repositoryId: existing?.repositoryId,
    name: snapshot.name,
    externalProjectId: snapshot.externalProjectId,
    externalProjectName: snapshot.externalProjectName,
    externalProjectAlias: existing?.externalProjectAlias,
    externalServiceId: snapshot.externalServiceId,
    defaultEnvironment: existing?.defaultEnvironment,
    healthPath: existing?.healthPath || '/',
    enabled: existing?.enabled ?? true,
    lastSyncedAt: nowIso(),
    environments: snapshot.environments,
    domains: [...snapshot.domains.filter((domain) => snapshot.provider === 'railway' || domain.kind !== 'generated'), ...manualDomains]
  }
}

export function upsertProviderServiceSnapshot(
  db: DatabaseLike,
  connectionId: string,
  snapshot: ProviderServiceSnapshot
): ProjectServiceRecord {
  const existing = listAllProjectServices(db).find(
    (service) =>
      service.provider === snapshot.provider &&
      service.connectionId === connectionId &&
      service.externalProjectId === snapshot.externalProjectId &&
      service.externalServiceId === (snapshot.externalServiceId ?? '')
  )

  return saveProjectService(db, providerSnapshotToProjectServiceInput(connectionId, snapshot, existing))
}

export async function syncServiceConnection(db: DatabaseLike, connectionId: string, fetcher: ServiceProviderFetch = fetch): Promise<ProjectServiceRecord[]> {
  const connection = getServiceConnectionSecret(db, connectionId)

  if (!connection) {
    throw new Error('服务连接不存在')
  }

  if (!connection.token) {
    throw new Error('请先配置平台 Token')
  }

  const snapshots =
    connection.provider === 'vercel'
      ? await syncVercelProviderServices(connection, fetcher)
      : await syncRailwayProviderServices(connection, fetcher)

  return snapshots.map((snapshot) => upsertProviderServiceSnapshot(db, connectionId, snapshot))
}

type VercelServiceContext = {
  service: ProjectServiceRecord
  connection: ServiceConnectionRecord
  projectId: string
}

type RailwayServiceContext = VercelServiceContext & {
  serviceId: string
}

function getVercelServiceContext(db: DatabaseLike, serviceId: string): VercelServiceContext {
  const service = getProjectService(db, serviceId)

  if (!service) {
    throw new Error('服务不存在')
  }

  if (service.provider !== 'vercel') {
    throw new Error('仅支持 Vercel 服务')
  }

  const projectId = trimText(service.externalProjectId)

  if (!projectId) {
    throw new Error('缺少 Vercel 项目 ID')
  }

  const connection = getServiceConnectionSecret(db, service.connectionId)

  if (!connection?.token) {
    throw new Error('请先配置 Vercel Token')
  }

  return { service, connection, projectId }
}

function getRailwayServiceContext(db: DatabaseLike, serviceId: string): RailwayServiceContext {
  const service = getProjectService(db, serviceId)

  if (!service) {
    throw new Error('服务不存在')
  }

  if (service.provider !== 'railway') {
    throw new Error('仅支持 Railway 服务')
  }

  const projectId = trimText(service.externalProjectId)

  if (!projectId) {
    throw new Error('缺少 Railway Project ID')
  }

  const railwayServiceId = trimText(service.externalServiceId)

  if (!railwayServiceId) {
    throw new Error('缺少 Railway Service ID')
  }

  const connection = getServiceConnectionSecret(db, service.connectionId)

  if (!connection?.token) {
    throw new Error('请先配置 Railway Token')
  }

  return { service, connection, projectId, serviceId: railwayServiceId }
}

async function syncVercelServiceAndRead(db: DatabaseLike, service: ProjectServiceRecord, fetcher: ServiceProviderFetch): Promise<ProjectServiceRecord> {
  await syncServiceConnection(db, service.connectionId, fetcher)

  const refreshed = getProjectService(db, service.id)

  if (!refreshed) {
    throw new Error('服务同步后不存在')
  }

  return refreshed
}

export async function listServiceDeployments(
  db: DatabaseLike,
  serviceId: string,
  options: ServiceDeploymentListOptions = {},
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceDeploymentSummary[]> {
  const service = getProjectService(db, serviceId)

  if (!service) {
    throw new Error('服务不存在')
  }

  if (service.provider === 'railway') {
    const context = getRailwayServiceContext(db, serviceId)
    const targetEnvironments = options.target
      ? context.service.environments.filter((environment) => environment.name === options.target || environment.externalEnvironmentId === options.target)
      : context.service.environments

    if (targetEnvironments.length === 0 && options.target) {
      return []
    }

    const deployments = (
      await Promise.all(
        (targetEnvironments.length > 0 ? targetEnvironments : [{ externalEnvironmentId: '', name: '' }]).map((environment) =>
          listRailwayDeployments(
            context.connection,
            context.projectId,
            context.serviceId,
            environment.externalEnvironmentId,
            options,
            fetcher
          )
        )
      )
    ).flat()

    return deployments.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  return listVercelDeployments(connection, projectId, options, fetcher)
}

export async function runServiceDeploymentAction(
  db: DatabaseLike,
  serviceId: string,
  input: VercelDeploymentActionInput,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProjectServiceRecord> {
  const currentService = getProjectService(db, serviceId)

  if (currentService?.provider === 'railway') {
    throw new Error('Railway 部署操作暂不支持，当前版本只支持只读查看')
  }

  const { service, connection, projectId } = getVercelServiceContext(db, serviceId)
  const deploymentId = trimText(input.deploymentId)

  if (!deploymentId) {
    throw new Error('缺少 Vercel 部署 ID')
  }

  if (input.action === 'redeploy') {
    await redeployVercelDeployment(connection, deploymentId, fetcher)
  } else if (input.action === 'cancel') {
    await cancelVercelDeployment(connection, deploymentId, fetcher)
  } else if (input.action === 'promote') {
    await promoteVercelDeployment(connection, projectId, deploymentId, fetcher)
  } else if (input.action === 'rollback') {
    await rollbackVercelDeployment(connection, projectId, deploymentId, input.description ?? '', fetcher)
  } else {
    throw new Error('不支持的 Vercel 部署操作')
  }

  return syncVercelServiceAndRead(db, service, fetcher)
}

export async function listServiceEnvVars(
  db: DatabaseLike,
  serviceId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceEnvVarRecord[]> {
  const service = getProjectService(db, serviceId)

  if (!service) {
    throw new Error('服务不存在')
  }

  if (service.provider === 'railway') {
    const context = getRailwayServiceContext(db, serviceId)

    return listRailwayProjectEnvVars(context.connection, context.projectId, context.serviceId, context.service.environments, fetcher)
  }

  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  return listVercelProjectEnvVars(connection, projectId, fetcher)
}

export async function revealServiceEnvVar(
  db: DatabaseLike,
  serviceId: string,
  envVarId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceEnvVarRecord> {
  const service = getProjectService(db, serviceId)

  if (service?.provider === 'railway') {
    throw new Error('Railway 环境变量只支持只读查看')
  }

  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  return readVercelEnvVar(connection, projectId, envVarId, fetcher)
}

export async function saveServiceEnvVar(
  db: DatabaseLike,
  serviceId: string,
  input: VercelEnvVarInput,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceEnvVarRecord> {
  const service = getProjectService(db, serviceId)

  if (service?.provider === 'railway') {
    throw new Error('Railway 环境变量只支持只读查看')
  }

  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  return saveVercelProjectEnvVar(connection, projectId, input, fetcher)
}

export async function deleteServiceEnvVar(
  db: DatabaseLike,
  serviceId: string,
  envVarId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const service = getProjectService(db, serviceId)

  if (service?.provider === 'railway') {
    throw new Error('Railway 环境变量只支持只读查看')
  }

  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  await removeVercelProjectEnvVar(connection, projectId, envVarId, fetcher)
}

export async function addServiceDomain(
  db: DatabaseLike,
  serviceId: string,
  input: VercelDomainInput,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProjectServiceRecord> {
  const { service, connection, projectId } = getVercelServiceContext(db, serviceId)
  const environment = input.environmentName ? service.environments.find((item) => item.name === input.environmentName) : null

  await addVercelProjectDomain(
    connection,
    projectId,
    {
      ...input,
      environmentName: environment?.externalEnvironmentId || input.environmentName
    },
    fetcher
  )

  return syncVercelServiceAndRead(db, service, fetcher)
}

export async function removeServiceDomain(
  db: DatabaseLike,
  serviceId: string,
  domain: string,
  removeRedirects = false,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProjectServiceRecord> {
  const { service, connection, projectId } = getVercelServiceContext(db, serviceId)

  await removeVercelProjectDomain(connection, projectId, domain, removeRedirects, fetcher)

  return syncVercelServiceAndRead(db, service, fetcher)
}

export async function verifyServiceDomain(
  db: DatabaseLike,
  serviceId: string,
  domain: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProjectServiceRecord> {
  const { service, connection, projectId } = getVercelServiceContext(db, serviceId)

  await verifyVercelProjectDomain(connection, projectId, domain, fetcher)

  return syncVercelServiceAndRead(db, service, fetcher)
}

export async function inspectServiceDomainConfig(
  db: DatabaseLike,
  serviceId: string,
  domain: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelDomainConfig> {
  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  return inspectVercelDomainConfig(connection, projectId, domain, fetcher)
}

export async function listServiceEnvironmentLogs(
  db: DatabaseLike,
  serviceId: string,
  environmentName: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceEnvironmentLogRecord[]> {
  const service = getProjectService(db, serviceId)

  if (!service) {
    throw new Error('服务不存在')
  }

  const environment = service.environments.find((item) => item.name === environmentName)

  if (!environment?.latestDeploymentId) {
    return []
  }

  if (service.provider === 'railway') {
    const connection = getServiceConnectionSecret(db, service.connectionId)

    if (!connection?.token) {
      throw new Error('请先配置 Railway Token')
    }

    return readRailwayDeploymentLogs(connection, environment.latestDeploymentId, fetcher)
  }

  if (service.provider !== 'vercel') {
    return []
  }

  const connection = getServiceConnectionSecret(db, service.connectionId)

  if (!connection?.token) {
    throw new Error('请先配置 Vercel Token')
  }

  return readVercelDeploymentLogs(connection, environment.latestDeploymentId, fetcher)
}

export async function listServiceRuntimeLogs(
  db: DatabaseLike,
  serviceId: string,
  environmentName: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceEnvironmentLogRecord[]> {
  const service = getProjectService(db, serviceId)

  if (!service) {
    throw new Error('服务不存在')
  }

  const environment = service.environments.find((item) => item.name === environmentName)

  if (service.provider === 'railway') {
    if (!environment?.externalEnvironmentId) {
      return []
    }

    const connection = getServiceConnectionSecret(db, service.connectionId)

    if (!connection?.token) {
      throw new Error('请先配置 Railway Token')
    }

    return readRailwayEnvironmentLogs(connection, environment.externalEnvironmentId, fetcher)
  }

  const { connection, projectId } = getVercelServiceContext(db, serviceId)

  if (!environment?.latestDeploymentId) {
    return []
  }

  return readVercelRuntimeLogs(connection, projectId, environment.latestDeploymentId, fetcher)
}

export async function checkServiceDomain(
  domain: ProjectServiceDomainRecord,
  fetcher: ServiceProviderFetch = fetch,
  timeoutMs = 10000
): Promise<Omit<ServiceMonitorCheckInput, 'projectId' | 'serviceId' | 'domainId'>> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    let response = await fetcher(domain.url, { method: 'HEAD', signal: controller.signal })

    if (!response.ok && response.status === 405) {
      response = await fetcher(domain.url, { method: 'GET', signal: controller.signal })
    }

    const responseMs = Math.max(0, Date.now() - startedAt)

    return {
      status: classifyServiceMonitorStatus(response.status),
      statusCode: response.status,
      responseMs,
      checkedAt: nowIso(),
      errorMessage: ''
    }
  } catch (error) {
    return {
      status: 'offline',
      statusCode: 0,
      responseMs: Math.max(0, Date.now() - startedAt),
      checkedAt: nowIso(),
      errorMessage: error instanceof Error ? error.message : String(error)
    }
  } finally {
    clearTimeout(timer)
  }
}
