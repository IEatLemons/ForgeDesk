import { resolve } from 'node:path'

export type AiProjectResourceLink = {
  providerId: string
  resourceKey: string
  resourcePath: string
  projectId: string
  createdAt: string
  updatedAt: string
}

export type AiProjectResourceLinkInput = {
  providerId: string
  resourcePath: string
  projectId: string
}

type Statement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

export type AiProjectResourceLinkDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => Statement
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function aiProjectResourceKey(path: string): string {
  const value = text(path)
  return value ? resolve(value) : ''
}

function mapRow(row: Record<string, unknown>): AiProjectResourceLink {
  return {
    createdAt: text(row.created_at),
    projectId: text(row.project_id),
    providerId: text(row.provider_id),
    resourceKey: text(row.resource_key),
    resourcePath: text(row.resource_path),
    updatedAt: text(row.updated_at)
  }
}

export function migrateAiProjectResourceLinkTables(db: AiProjectResourceLinkDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_project_resource_links (
      provider_id TEXT NOT NULL,
      resource_key TEXT NOT NULL,
      resource_path TEXT NOT NULL,
      project_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (provider_id, resource_key),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ai_project_resource_links_project
      ON ai_project_resource_links(project_id, provider_id);
    CREATE TABLE IF NOT EXISTS ai_project_resource_link_migrations (
      migration_key TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL
    );
  `)
}

export function listAiProjectResourceLinks(db: AiProjectResourceLinkDatabase, query: { projectId?: string; providerId?: string } = {}): AiProjectResourceLink[] {
  const projectId = text(query.projectId)
  const providerId = text(query.providerId)
  const sql = projectId && providerId
    ? 'SELECT provider_id, resource_key, resource_path, project_id, created_at, updated_at FROM ai_project_resource_links WHERE project_id = ? AND provider_id = ? ORDER BY resource_path ASC'
    : projectId
      ? 'SELECT provider_id, resource_key, resource_path, project_id, created_at, updated_at FROM ai_project_resource_links WHERE project_id = ? ORDER BY provider_id ASC, resource_path ASC'
      : providerId
        ? 'SELECT provider_id, resource_key, resource_path, project_id, created_at, updated_at FROM ai_project_resource_links WHERE provider_id = ? ORDER BY resource_path ASC'
        : 'SELECT provider_id, resource_key, resource_path, project_id, created_at, updated_at FROM ai_project_resource_links ORDER BY provider_id ASC, resource_path ASC'
  const statement = db.prepare(sql)
  const rows = projectId && providerId ? statement.all(projectId, providerId) : projectId ? statement.all(projectId) : providerId ? statement.all(providerId) : statement.all()
  return (rows as Array<Record<string, unknown>>).map(mapRow)
}

export function saveAiProjectResourceLink(db: AiProjectResourceLinkDatabase, input: AiProjectResourceLinkInput): AiProjectResourceLink {
  const providerId = text(input.providerId)
  const projectId = text(input.projectId)
  const resourcePath = aiProjectResourceKey(input.resourcePath)
  if (!providerId) throw new Error('AI 工具 ID 不能为空')
  if (!projectId) throw new Error('ForgeDesk 项目不能为空')
  if (!resourcePath) throw new Error('AI 项目目录不能为空')
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) throw new Error('项目不存在')

  const now = new Date().toISOString()
  const existing = db.prepare('SELECT created_at FROM ai_project_resource_links WHERE provider_id = ? AND resource_key = ?').get(providerId, resourcePath) as Record<string, unknown> | undefined
  db.prepare(`
    INSERT INTO ai_project_resource_links (provider_id, resource_key, resource_path, project_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider_id, resource_key) DO UPDATE SET
      resource_path = excluded.resource_path,
      project_id = excluded.project_id,
      updated_at = excluded.updated_at
  `).run(providerId, resourcePath, resourcePath, projectId, text(existing?.created_at) || now, now)
  return mapRow(db.prepare('SELECT provider_id, resource_key, resource_path, project_id, created_at, updated_at FROM ai_project_resource_links WHERE provider_id = ? AND resource_key = ?').get(providerId, resourcePath) as Record<string, unknown>)
}

export function saveAiProjectResourceLinks(db: AiProjectResourceLinkDatabase, input: { providerId: string; projectId: string; resourcePaths: string[] }): AiProjectResourceLink[] {
  const uniquePaths = [...new Set(input.resourcePaths.map(aiProjectResourceKey).filter(Boolean))]
  return uniquePaths.map((resourcePath) => saveAiProjectResourceLink(db, { providerId: input.providerId, projectId: input.projectId, resourcePath }))
}

export function deleteAiProjectResourceLink(db: AiProjectResourceLinkDatabase, input: { providerId: string; resourcePath: string }): void {
  const providerId = text(input.providerId)
  const resourceKey = aiProjectResourceKey(input.resourcePath)
  if (!providerId || !resourceKey) return
  db.prepare('DELETE FROM ai_project_resource_links WHERE provider_id = ? AND resource_key = ?').run(providerId, resourceKey)
}

/** Import historic one-path provider bindings once. Explicit Codex links run after the generic record and therefore win. */
export function migrateLegacyAiProjectResourceLinks(db: AiProjectResourceLinkDatabase): void {
  const marker = 'legacy-project-ai-and-codex-links-v1'
  if (db.prepare('SELECT migration_key FROM ai_project_resource_link_migrations WHERE migration_key = ?').get(marker)) return
  const migrateRows = (sql: string, overwrite: boolean): void => {
    try {
      const rows = db.prepare(sql).all() as Array<Record<string, unknown>>
      for (const row of rows) {
        const providerId = text(row.provider_id) || 'codex'
        const projectId = text(row.project_id)
        const resourcePath = text(row.resource_path) || text(row.workspace_path) || text(row.cwd)
        if (!providerId || !projectId || !aiProjectResourceKey(resourcePath)) continue
        if (!overwrite && db.prepare('SELECT resource_key FROM ai_project_resource_links WHERE provider_id = ? AND resource_key = ?').get(providerId, aiProjectResourceKey(resourcePath))) continue
        saveAiProjectResourceLink(db, { providerId, projectId, resourcePath })
      }
    } catch {
      // Older ForgeDesk databases may not contain both historic tables.
    }
  }
  migrateRows('SELECT provider_id, project_id, workspace_path FROM project_ai_bindings', false)
  migrateRows("SELECT 'codex' AS provider_id, project_id, cwd FROM codex_project_links WHERE project_id IS NOT NULL", true)
  db.prepare('INSERT INTO ai_project_resource_link_migrations (migration_key, completed_at) VALUES (?, ?)').run(marker, new Date().toISOString())
}
