export type ProjectGitTaskAction = 'fetch' | 'push' | 'merge'
export type ProjectGitTaskStatus = 'running' | 'success' | 'failed' | 'skipped' | 'cancelled' | 'interrupted'

export type ProjectGitRepositoryTaskResult = {
  repositoryId: string
  repositoryName: string
  ok: boolean
  message: string
  stdout?: string
  stderr?: string
}

export type ProjectGitTaskLog = {
  id: string
  projectId: string
  projectName: string
  action: ProjectGitTaskAction
  status: ProjectGitTaskStatus
  startedAt: string
  finishedAt?: string
  summary: string
  repositoryResults: ProjectGitRepositoryTaskResult[]
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

export type ProjectGitTaskDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

export const projectGitTaskRetentionMs = 30 * 24 * 60 * 60 * 1000

const projectGitTaskActions = new Set<ProjectGitTaskAction>(['fetch', 'push', 'merge'])
const projectGitTaskStatuses = new Set<ProjectGitTaskStatus>(['running', 'success', 'failed', 'skipped', 'cancelled', 'interrupted'])

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function parseRepositoryResults(value: unknown): ProjectGitRepositoryTaskResult[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(String(value)) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const result: ProjectGitRepositoryTaskResult = {
          repositoryId: normalizeText(item.repositoryId ?? item.repository_id),
          repositoryName: normalizeText(item.repositoryName ?? item.repository_name),
          ok: Boolean(item.ok),
          message: normalizeText(item.message)
        }
        const stdout = normalizeText(item.stdout)
        const stderr = normalizeText(item.stderr)

        if (stdout) result.stdout = stdout
        if (stderr) result.stderr = stderr
        return result
      })
  } catch {
    return []
  }
}

function mapProjectGitTaskRow(row: Record<string, unknown>): ProjectGitTaskLog {
  const action = normalizeText(row.action) as ProjectGitTaskAction
  const status = normalizeText(row.status) as ProjectGitTaskStatus

  return {
    id: normalizeText(row.id),
    projectId: normalizeText(row.project_id),
    projectName: normalizeText(row.project_name),
    action: projectGitTaskActions.has(action) ? action : 'push',
    status: projectGitTaskStatuses.has(status) ? status : 'failed',
    startedAt: normalizeText(row.started_at),
    finishedAt: normalizeText(row.finished_at) || undefined,
    summary: normalizeText(row.summary),
    repositoryResults: parseRepositoryResults(row.repository_results_json)
  }
}

function assertTaskId(taskId: string): string {
  const normalized = normalizeText(taskId)

  if (!normalized) {
    throw new Error('Git 任务不存在')
  }

  return normalized
}

function assertProjectId(projectId: string): string {
  const normalized = normalizeText(projectId)

  if (!normalized) {
    throw new Error('项目不存在')
  }

  return normalized
}

function nowIso(): string {
  return new Date().toISOString()
}

function retentionCutoffIso(now = new Date()): string {
  return new Date(now.getTime() - projectGitTaskRetentionMs).toISOString()
}

export function migrateProjectGitTaskTable(db: ProjectGitTaskDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_git_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      summary TEXT NOT NULL DEFAULT '',
      repository_results_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_git_tasks_started_at
      ON project_git_tasks(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_project_git_tasks_project_id
      ON project_git_tasks(project_id);
  `)
}

export function pruneProjectGitTasks(db: ProjectGitTaskDatabase, now = new Date()): void {
  db.prepare(
    `
      DELETE FROM project_git_tasks
      WHERE COALESCE(finished_at, started_at) < ?
    `
  ).run(retentionCutoffIso(now))
}

export function recoverProjectGitTasks(db: ProjectGitTaskDatabase, now = new Date()): void {
  const finishedAt = now.toISOString()

  db.prepare(
    `
      UPDATE project_git_tasks
      SET status = 'interrupted',
          finished_at = ?,
          summary = CASE
            WHEN summary = '' OR summary = 'Git 任务正在执行' THEN '应用关闭时任务未完成，任务已中断'
            ELSE summary || '；应用关闭时任务未完成，任务已中断'
          END
      WHERE status = 'running'
    `
  ).run(finishedAt)
}

export function listProjectGitTasks(db: ProjectGitTaskDatabase, projectId?: string): ProjectGitTaskLog[] {
  pruneProjectGitTasks(db)

  const normalizedProjectId = projectId ? assertProjectId(projectId) : ''
  const rows = normalizedProjectId
    ? db.prepare('SELECT * FROM project_git_tasks WHERE project_id = ? ORDER BY started_at DESC').all(normalizedProjectId)
    : db.prepare('SELECT * FROM project_git_tasks ORDER BY started_at DESC').all()

  return rows.map((row) => mapProjectGitTaskRow(row as Record<string, unknown>))
}

export function getProjectGitTask(db: ProjectGitTaskDatabase, taskId: string): ProjectGitTaskLog | null {
  const row = db.prepare('SELECT * FROM project_git_tasks WHERE id = ?').get(assertTaskId(taskId)) as Record<string, unknown> | undefined
  return row ? mapProjectGitTaskRow(row) : null
}

export function saveProjectGitTask(db: ProjectGitTaskDatabase, task: ProjectGitTaskLog): ProjectGitTaskLog {
  const id = assertTaskId(task.id)
  const projectId = assertProjectId(task.projectId)
  const action = projectGitTaskActions.has(task.action) ? task.action : 'push'
  const status = projectGitTaskStatuses.has(task.status) ? task.status : 'failed'
  const startedAt = normalizeText(task.startedAt) || nowIso()
  const finishedAt = normalizeText(task.finishedAt) || null
  const projectName = normalizeText(task.projectName) || '未命名项目'
  const summary = normalizeText(task.summary)
  const repositoryResults = Array.isArray(task.repositoryResults) ? task.repositoryResults : []

  db.prepare(
    `
      INSERT INTO project_git_tasks (
        id, project_id, project_name, action, status, started_at, finished_at, summary, repository_results_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        project_name = excluded.project_name,
        action = excluded.action,
        status = excluded.status,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        summary = excluded.summary,
        repository_results_json = excluded.repository_results_json
    `
  ).run(id, projectId, projectName, action, status, startedAt, finishedAt, summary, JSON.stringify(repositoryResults))

  pruneProjectGitTasks(db)
  return getProjectGitTask(db, id) as ProjectGitTaskLog
}

export function deleteProjectGitTask(db: ProjectGitTaskDatabase, taskId: string): void {
  db.prepare('DELETE FROM project_git_tasks WHERE id = ?').run(assertTaskId(taskId))
}

export function clearProjectGitTasks(db: ProjectGitTaskDatabase): void {
  db.prepare('DELETE FROM project_git_tasks').run()
}
