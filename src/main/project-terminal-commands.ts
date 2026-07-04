export type ProjectTerminalCommandRecord = {
  id: string
  projectId: string
  name: string
  command: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ProjectTerminalCommandInput = {
  id?: string
  projectId: string
  name: string
  command: string
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

function normalizeRequiredText(value: string | undefined, errorMessage: string): string {
  const normalized = value?.trim() ?? ''

  if (!normalized) {
    throw new Error(errorMessage)
  }

  return normalized
}

function mapCommandRow(row: Record<string, unknown>): ProjectTerminalCommandRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name ?? ''),
    command: String(row.command ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function assertProjectExists(db: DatabaseLike, projectId: string): string {
  const normalizedProjectId = normalizeRequiredText(projectId, '项目不存在')
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(normalizedProjectId)

  if (!project) {
    throw new Error('项目不存在')
  }

  return normalizedProjectId
}

function getProjectTerminalCommand(db: DatabaseLike, projectId: string, commandId: string): ProjectTerminalCommandRecord | null {
  const row = db.prepare('SELECT * FROM project_terminal_commands WHERE project_id = ? AND id = ?').get(projectId, commandId) as Record<string, unknown> | undefined
  return row ? mapCommandRow(row) : null
}

export function migrateProjectTerminalCommandTable(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_terminal_commands (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export function listProjectTerminalCommands(db: DatabaseLike, projectId: string): ProjectTerminalCommandRecord[] {
  const normalizedProjectId = assertProjectExists(db, projectId)

  return (
    db
      .prepare(
        `
        SELECT *
        FROM project_terminal_commands
        WHERE project_id = ?
        ORDER BY sort_order ASC, created_at ASC, name ASC
      `
      )
      .all(normalizedProjectId) as Array<Record<string, unknown>>
  ).map(mapCommandRow)
}

export function saveProjectTerminalCommand(db: DatabaseLike, input: ProjectTerminalCommandInput): ProjectTerminalCommandRecord {
  const projectId = assertProjectExists(db, input.projectId)
  const name = normalizeRequiredText(input.name, '请输入命令名称')
  const command = normalizeRequiredText(input.command, '请输入命令内容')
  const existing = input.id ? getProjectTerminalCommand(db, projectId, input.id) : null
  const now = nowIso()

  if (existing) {
    db.prepare(
      `
      UPDATE project_terminal_commands
      SET name = ?, command = ?, updated_at = ?
      WHERE project_id = ? AND id = ?
    `
    ).run(name, command, now, projectId, existing.id)

    return getProjectTerminalCommand(db, projectId, existing.id) as ProjectTerminalCommandRecord
  }

  const maxSortRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM project_terminal_commands WHERE project_id = ?')
    .get(projectId) as { max_sort_order?: unknown } | undefined
  const id = input.id || createId('terminal-command')
  const sortOrder = Number(maxSortRow?.max_sort_order ?? 0) + 1

  db.prepare(
    `
    INSERT INTO project_terminal_commands (id, project_id, name, command, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, projectId, name, command, sortOrder, now, now)

  return getProjectTerminalCommand(db, projectId, id) as ProjectTerminalCommandRecord
}

export function deleteProjectTerminalCommand(db: DatabaseLike, projectId: string, commandId: string): ProjectTerminalCommandRecord[] {
  const normalizedProjectId = assertProjectExists(db, projectId)

  db.prepare('DELETE FROM project_terminal_commands WHERE project_id = ? AND id = ?').run(normalizedProjectId, commandId)
  return listProjectTerminalCommands(db, normalizedProjectId)
}
