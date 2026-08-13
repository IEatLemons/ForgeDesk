import { randomUUID } from 'node:crypto'

export type ProjectGroupRecord = {
  id: string
  name: string
  sortOrder: number
  projectCount: number
  createdAt: string
  updatedAt: string
}

export type ProjectGroupInput = {
  id?: string
  name: string
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

export type ProjectGroupDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function createGroupId(): string {
  return `project-group-${randomUUID()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapGroupRow(row: Record<string, unknown>): ProjectGroupRecord {
  return {
    createdAt: normalizeText(row.created_at),
    id: normalizeText(row.id),
    name: normalizeText(row.name),
    projectCount: Number(row.project_count ?? 0) || 0,
    sortOrder: Number(row.sort_order ?? 0) || 0,
    updatedAt: normalizeText(row.updated_at)
  }
}

export function migrateProjectGroupTables(db: ProjectGroupDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_groups_sort_order
      ON project_groups(sort_order ASC, created_at ASC, id ASC);
  `)

  const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name?: unknown }>
  if (!columns.some((column) => column.name === 'group_id')) {
    db.exec('ALTER TABLE projects ADD COLUMN group_id TEXT')
  }
}

export function listProjectGroups(db: ProjectGroupDatabase): ProjectGroupRecord[] {
  return (db.prepare(`
    SELECT groups.*, COUNT(projects.id) AS project_count
    FROM project_groups AS groups
    LEFT JOIN projects ON projects.group_id = groups.id
    GROUP BY groups.id
    ORDER BY groups.sort_order ASC, groups.created_at ASC, groups.id ASC
  `).all() as Array<Record<string, unknown>>).map(mapGroupRow)
}

export function saveProjectGroup(db: ProjectGroupDatabase, input: ProjectGroupInput): ProjectGroupRecord {
  const name = normalizeText(input.name).slice(0, 80)
  if (!name) throw new Error('请输入分组名称')

  const id = normalizeText(input.id) || createGroupId()
  const existing = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id) as Record<string, unknown> | undefined
  const now = nowIso()
  const sortOrder = existing ? Number(existing.sort_order ?? 0) || 0 : listProjectGroups(db).length

  db.prepare(`
    INSERT INTO project_groups (id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
  `).run(id, name, sortOrder, normalizeText(existing?.created_at) || now, now)

  const saved = db.prepare(`
    SELECT groups.*, COUNT(projects.id) AS project_count
    FROM project_groups AS groups
    LEFT JOIN projects ON projects.group_id = groups.id
    WHERE groups.id = ?
    GROUP BY groups.id
  `).get(id) as Record<string, unknown> | undefined

  if (!saved) throw new Error('项目分组保存失败')
  return mapGroupRow(saved)
}

export function deleteProjectGroup(db: ProjectGroupDatabase, groupId: string): ProjectGroupRecord[] {
  const id = normalizeText(groupId)
  if (!id) throw new Error('项目分组不存在')

  const transaction = (db as ProjectGroupDatabase & { transaction?: (fn: () => void) => () => void }).transaction?.(() => {
    db.prepare('UPDATE projects SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(nowIso(), id)
    db.prepare('DELETE FROM project_groups WHERE id = ?').run(id)
  })

  if (transaction) transaction()
  else {
    db.prepare('UPDATE projects SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(nowIso(), id)
    db.prepare('DELETE FROM project_groups WHERE id = ?').run(id)
  }

  return listProjectGroups(db)
}

export function reorderProjectGroups(db: ProjectGroupDatabase, groupIds: string[]): ProjectGroupRecord[] {
  const ids = Array.from(new Set(groupIds.map(normalizeText).filter(Boolean)))
  const allGroups = listProjectGroups(db)
  const knownIds = new Set(allGroups.map((group) => group.id))
  const orderedIds = [...ids, ...allGroups.map((group) => group.id).filter((id) => !ids.includes(id))]
  const now = nowIso()
  const transaction = (db as ProjectGroupDatabase & { transaction?: (fn: () => void) => () => void }).transaction?.(() => {
    orderedIds.forEach((id, index) => {
      if (knownIds.has(id)) db.prepare('UPDATE project_groups SET sort_order = ?, updated_at = ? WHERE id = ?').run(index, now, id)
    })
  })

  if (transaction) transaction()
  else orderedIds.forEach((id, index) => {
    if (knownIds.has(id)) db.prepare('UPDATE project_groups SET sort_order = ?, updated_at = ? WHERE id = ?').run(index, now, id)
  })

  return listProjectGroups(db)
}

export function setProjectGroup(db: ProjectGroupDatabase, projectId: string, groupId: string | null): void {
  const normalizedProjectId = normalizeText(projectId)
  const normalizedGroupId = normalizeText(groupId)
  if (!normalizedProjectId) throw new Error('项目不存在')
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(normalizedProjectId)) throw new Error('项目不存在')
  if (normalizedGroupId && !db.prepare('SELECT id FROM project_groups WHERE id = ?').get(normalizedGroupId)) throw new Error('项目分组不存在')

  db.prepare('UPDATE projects SET group_id = ?, updated_at = ? WHERE id = ?').run(normalizedGroupId || null, nowIso(), normalizedProjectId)
}
