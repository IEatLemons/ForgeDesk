import { resolve } from 'node:path'

export type ProjectAiBinding = {
  projectId: string
  providerId: string
  workspacePath: string
  createdAt: string
  updatedAt: string
}

export type ProjectAiBindingInput = {
  projectId: string
  providerId: string
  workspacePath: string
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: any[]) => unknown[]
    get: (...params: any[]) => unknown
    run: (...params: any[]) => unknown
  }
}

export function migrateProjectAiBindingTable(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_ai_bindings (
      project_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, provider_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

function mapBindingRow(row: Record<string, unknown>): ProjectAiBinding {
  return {
    projectId: String(row.project_id ?? ''),
    providerId: String(row.provider_id ?? ''),
    workspacePath: String(row.workspace_path ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

export function getProjectAiBinding(db: DatabaseLike, projectId: string, providerId: string): ProjectAiBinding | null {
  const row = db.prepare(
    'SELECT project_id, provider_id, workspace_path, created_at, updated_at FROM project_ai_bindings WHERE project_id = ? AND provider_id = ?'
  ).get(projectId, providerId) as Record<string, unknown> | undefined

  return row ? mapBindingRow(row) : null
}

export function listProjectAiBindings(db: DatabaseLike, projectId?: string): ProjectAiBinding[] {
  const statement = projectId
    ? db.prepare('SELECT project_id, provider_id, workspace_path, created_at, updated_at FROM project_ai_bindings WHERE project_id = ? ORDER BY provider_id ASC')
    : db.prepare('SELECT project_id, provider_id, workspace_path, created_at, updated_at FROM project_ai_bindings ORDER BY project_id ASC, provider_id ASC')
  const rows = projectId ? statement.all(projectId) : statement.all()
  return rows.map((row) => mapBindingRow(row as Record<string, unknown>))
}

export function saveProjectAiBinding(db: DatabaseLike, input: ProjectAiBindingInput): ProjectAiBinding {
  const projectId = input.projectId.trim()
  const providerId = input.providerId.trim()
  const workspacePath = resolve(input.workspacePath.trim())

  if (!projectId) throw new Error('项目 ID 不能为空')
  if (!providerId) throw new Error('AI 工具 ID 不能为空')
  if (!input.workspacePath.trim()) throw new Error('项目目录不能为空')
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) throw new Error('项目不存在')

  const existing = getProjectAiBinding(db, projectId, providerId)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO project_ai_bindings (project_id, provider_id, workspace_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(project_id, provider_id) DO UPDATE SET
      workspace_path = excluded.workspace_path,
      updated_at = excluded.updated_at
  `).run(projectId, providerId, workspacePath, existing?.createdAt || now, now)

  return getProjectAiBinding(db, projectId, providerId) as ProjectAiBinding
}
