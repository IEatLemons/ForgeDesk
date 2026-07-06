export type ReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type ReleasePublishTaskSnapshot<TPlan extends object = Record<string, unknown>, TRepository extends object = Record<string, unknown>> = {
  id: string
  repositoryId: string
  repositoryName: string
  version: string
  tagName: string
  releaseTitle: string
  selectedScript: string
  status: ReleasePublishTaskStatus
  phase: string
  phaseIndex: number
  phaseTotal: number
  hint: string
  lastOutputAt: string
  processPid?: number
  startedAt: string
  updatedAt: string
  finishedAt?: string
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  error?: string
  plan?: TPlan
  repository?: TRepository
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

function parseOptionalJsonObject<T extends object>(value: unknown): T | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(String(value))
    return typeof parsed === 'object' && parsed !== null ? parsed as T : undefined
  } catch {
    return undefined
  }
}

function optionalString(value: unknown): string | undefined {
  const text = String(value ?? '')
  return text || undefined
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function mapReleasePublishTaskRow<TPlan extends object, TRepository extends object>(
  row: Record<string, unknown>
): ReleasePublishTaskSnapshot<TPlan, TRepository> {
  const processPid = optionalNumber(row.process_pid)

  return {
    id: String(row.id),
    repositoryId: String(row.repository_id),
    repositoryName: String(row.repository_name ?? ''),
    version: String(row.version ?? ''),
    tagName: String(row.tag_name ?? ''),
    releaseTitle: String(row.release_title ?? ''),
    selectedScript: String(row.selected_script ?? ''),
    status: (String(row.status || 'failed') as ReleasePublishTaskStatus),
    phase: String(row.phase ?? ''),
    phaseIndex: Number(row.phase_index ?? 0),
    phaseTotal: Number(row.phase_total ?? 0),
    hint: String(row.hint ?? ''),
    lastOutputAt: String(row.last_output_at ?? ''),
    ...(processPid === undefined ? {} : { processPid }),
    startedAt: String(row.started_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    finishedAt: optionalString(row.finished_at),
    log: String(row.log ?? ''),
    stdout: String(row.stdout ?? ''),
    stderr: String(row.stderr ?? ''),
    exitCode: nullableNumber(row.exit_code),
    error: optionalString(row.error),
    plan: parseOptionalJsonObject<TPlan>(row.plan_json),
    repository: parseOptionalJsonObject<TRepository>(row.repository_json)
  }
}

export function migrateReleasePublishTaskTable(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS release_publish_tasks (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      repository_name TEXT NOT NULL,
      version TEXT NOT NULL,
      tag_name TEXT NOT NULL,
      release_title TEXT NOT NULL,
      selected_script TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT '',
      phase_index INTEGER NOT NULL DEFAULT 0,
      phase_total INTEGER NOT NULL DEFAULT 0,
      hint TEXT NOT NULL DEFAULT '',
      last_output_at TEXT NOT NULL,
      process_pid INTEGER,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      log TEXT NOT NULL DEFAULT '',
      stdout TEXT NOT NULL DEFAULT '',
      stderr TEXT NOT NULL DEFAULT '',
      exit_code INTEGER,
      error TEXT,
      plan_json TEXT,
      repository_json TEXT
    );
  `)
}

export function saveReleasePublishTask<TPlan extends object, TRepository extends object>(
  db: DatabaseLike,
  task: ReleasePublishTaskSnapshot<TPlan, TRepository>
): void {
  db.prepare(
    `
    INSERT INTO release_publish_tasks (
      id, repository_id, repository_name, version, tag_name, release_title, selected_script,
      status, phase, phase_index, phase_total, hint, last_output_at, process_pid,
      started_at, updated_at, finished_at, log, stdout, stderr, exit_code, error,
      plan_json, repository_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      repository_id = excluded.repository_id,
      repository_name = excluded.repository_name,
      version = excluded.version,
      tag_name = excluded.tag_name,
      release_title = excluded.release_title,
      selected_script = excluded.selected_script,
      status = excluded.status,
      phase = excluded.phase,
      phase_index = excluded.phase_index,
      phase_total = excluded.phase_total,
      hint = excluded.hint,
      last_output_at = excluded.last_output_at,
      process_pid = excluded.process_pid,
      started_at = excluded.started_at,
      updated_at = excluded.updated_at,
      finished_at = excluded.finished_at,
      log = excluded.log,
      stdout = excluded.stdout,
      stderr = excluded.stderr,
      exit_code = excluded.exit_code,
      error = excluded.error,
      plan_json = excluded.plan_json,
      repository_json = excluded.repository_json
  `
  ).run(
    task.id,
    task.repositoryId,
    task.repositoryName,
    task.version,
    task.tagName,
    task.releaseTitle,
    task.selectedScript,
    task.status,
    task.phase,
    task.phaseIndex,
    task.phaseTotal,
    task.hint,
    task.lastOutputAt,
    task.processPid ?? null,
    task.startedAt,
    task.updatedAt,
    task.finishedAt ?? null,
    task.log,
    task.stdout,
    task.stderr,
    task.exitCode,
    task.error ?? null,
    task.plan ? JSON.stringify(task.plan) : null,
    task.repository ? JSON.stringify(task.repository) : null
  )
}

export function listReleasePublishTasks<TPlan extends object = Record<string, unknown>, TRepository extends object = Record<string, unknown>>(
  db: DatabaseLike,
  repositoryId?: string
): Array<ReleasePublishTaskSnapshot<TPlan, TRepository>> {
  const sql = repositoryId
    ? 'SELECT * FROM release_publish_tasks WHERE repository_id = ? ORDER BY started_at DESC'
    : 'SELECT * FROM release_publish_tasks ORDER BY started_at DESC'
  const rows = repositoryId ? db.prepare(sql).all(repositoryId) : db.prepare(sql).all()

  return rows.map((row) => mapReleasePublishTaskRow<TPlan, TRepository>(row as Record<string, unknown>))
}

export function getReleasePublishTask<TPlan extends object = Record<string, unknown>, TRepository extends object = Record<string, unknown>>(
  db: DatabaseLike,
  taskId: string
): ReleasePublishTaskSnapshot<TPlan, TRepository> | null {
  const row = db.prepare('SELECT * FROM release_publish_tasks WHERE id = ?').get(taskId)
  return row ? mapReleasePublishTaskRow<TPlan, TRepository>(row as Record<string, unknown>) : null
}
