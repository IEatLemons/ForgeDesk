export type ProjectBranchTagRecord = {
  id: string
  projectId: string
  label: string
  branchName: string
  color: string
}

export type ProjectBranchTagInput = {
  id?: string
  projectId: string
  label: string
  branchName: string
  color: string
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

const defaultBranchTag = {
  label: '主分支',
  branchName: 'main',
  color: '#f5222d'
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function normalizeColor(color: string): string {
  const value = color.trim()

  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error('请输入 6 位 HEX 颜色，例如 #f5222d')
  }

  return value.toLowerCase()
}

function normalizeBranchName(branchName: string): string {
  const value = branchName.trim().replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '').replace(/^[^/]+\//, '')

  if (!value) {
    throw new Error('请输入分支短名')
  }

  return value
}

function mapBranchTagRow(row: Record<string, unknown>): ProjectBranchTagRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    label: String(row.label ?? ''),
    branchName: String(row.branch_name ?? ''),
    color: String(row.color ?? '')
  }
}

function ensureDefaultProjectBranchTag(db: DatabaseLike, projectId: string): void {
  const existing = db.prepare('SELECT id FROM project_branch_tags WHERE project_id = ? LIMIT 1').get(projectId)

  if (existing) {
    return
  }

  const now = new Date().toISOString()
  db.prepare(
    `
    INSERT INTO project_branch_tags (id, project_id, label, branch_name, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(createId('branch-tag'), projectId, defaultBranchTag.label, defaultBranchTag.branchName, defaultBranchTag.color, now, now)
}

export function migrateProjectBranchTagTable(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_branch_tags (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      label TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, branch_name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export function listProjectBranchTags(db: DatabaseLike, projectId: string): ProjectBranchTagRecord[] {
  ensureDefaultProjectBranchTag(db, projectId)

  return db
    .prepare('SELECT * FROM project_branch_tags WHERE project_id = ? ORDER BY created_at ASC')
    .all(projectId)
    .map((row) => mapBranchTagRow(row as Record<string, unknown>))
}

export function saveProjectBranchTag(db: DatabaseLike, input: ProjectBranchTagInput): ProjectBranchTagRecord {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(input.projectId)

  if (!project) {
    throw new Error('项目不存在')
  }

  const branchName = normalizeBranchName(input.branchName)
  const label = input.label.trim() || branchName
  const color = normalizeColor(input.color)
  const existing = db.prepare('SELECT * FROM project_branch_tags WHERE project_id = ? AND branch_name = ?').get(input.projectId, branchName) as Record<string, unknown> | undefined
  const editing = input.id ? (db.prepare('SELECT * FROM project_branch_tags WHERE project_id = ? AND id = ?').get(input.projectId, input.id) as Record<string, unknown> | undefined) : undefined
  const now = new Date().toISOString()

  if (editing && (!existing || String(existing.id) === String(editing.id))) {
    db.prepare(
      `
      UPDATE project_branch_tags
      SET label = ?, branch_name = ?, color = ?, updated_at = ?
      WHERE project_id = ? AND id = ?
    `
    ).run(label, branchName, color, now, input.projectId, editing.id)
  } else if (existing) {
    db.prepare(
      `
      UPDATE project_branch_tags
      SET label = ?, color = ?, updated_at = ?
      WHERE project_id = ? AND id = ?
    `
    ).run(label, color, now, input.projectId, existing.id)

    if (editing) {
      db.prepare('DELETE FROM project_branch_tags WHERE project_id = ? AND id = ?').run(input.projectId, editing.id)
    }
  } else {
    db.prepare(
      `
      INSERT INTO project_branch_tags (id, project_id, label, branch_name, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(input.id || createId('branch-tag'), input.projectId, label, branchName, color, now, now)
  }

  const row = db.prepare('SELECT * FROM project_branch_tags WHERE project_id = ? AND branch_name = ?').get(input.projectId, branchName)

  if (!row) {
    throw new Error('分支标签保存失败')
  }

  return mapBranchTagRow(row as Record<string, unknown>)
}

export function deleteProjectBranchTag(db: DatabaseLike, projectId: string, tagId: string): ProjectBranchTagRecord[] {
  db.prepare('DELETE FROM project_branch_tags WHERE project_id = ? AND id = ?').run(projectId, tagId)
  return listProjectBranchTags(db, projectId)
}
