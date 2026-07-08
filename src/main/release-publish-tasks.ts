export type ReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
export type ReleasePublishProvider = 'github' | 'codemagic'

export type ReleasePublishArtifact = {
  name: string
  type: string
  sizeInBytes: number
  downloadUrl: string
  versionCode?: string
  versionName?: string
}

export type ReleasePublishTaskSnapshot<TPlan extends object = Record<string, unknown>, TRepository extends object = Record<string, unknown>> = {
  id: string
  repositoryId: string
  repositoryName: string
  provider: ReleasePublishProvider
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
  externalBuildId?: string
  externalBuildUrl?: string
  externalStatus?: string
  externalWorkflow?: string
  externalBranch?: string
  externalTag?: string
  artifacts: ReleasePublishArtifact[]
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

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
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
  const provider = String(row.provider || 'github') === 'codemagic' ? 'codemagic' : 'github'

  return {
    id: String(row.id),
    repositoryId: String(row.repository_id),
    repositoryName: String(row.repository_name ?? ''),
    provider,
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
    externalBuildId: optionalString(row.external_build_id),
    externalBuildUrl: optionalString(row.external_build_url),
    externalStatus: optionalString(row.external_status),
    externalWorkflow: optionalString(row.external_workflow),
    externalBranch: optionalString(row.external_branch),
    externalTag: optionalString(row.external_tag),
    artifacts: parseJsonArray<ReleasePublishArtifact>(row.artifacts_json),
    plan: parseOptionalJsonObject<TPlan>(row.plan_json),
    repository: parseOptionalJsonObject<TRepository>(row.repository_json)
  }
}

function addColumnIfMissing(db: DatabaseLike, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>

  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
  }
}

export function migrateReleasePublishTaskTable(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS release_publish_tasks (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      repository_name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'github',
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
      external_build_id TEXT,
      external_build_url TEXT,
      external_status TEXT,
      external_workflow TEXT,
      external_branch TEXT,
      external_tag TEXT,
      artifacts_json TEXT NOT NULL DEFAULT '[]',
      plan_json TEXT,
      repository_json TEXT
    );
  `)
  addColumnIfMissing(db, 'release_publish_tasks', 'provider', "TEXT NOT NULL DEFAULT 'github'")
  addColumnIfMissing(db, 'release_publish_tasks', 'external_build_id', 'TEXT')
  addColumnIfMissing(db, 'release_publish_tasks', 'external_build_url', 'TEXT')
  addColumnIfMissing(db, 'release_publish_tasks', 'external_status', 'TEXT')
  addColumnIfMissing(db, 'release_publish_tasks', 'external_workflow', 'TEXT')
  addColumnIfMissing(db, 'release_publish_tasks', 'external_branch', 'TEXT')
  addColumnIfMissing(db, 'release_publish_tasks', 'external_tag', 'TEXT')
  addColumnIfMissing(db, 'release_publish_tasks', 'artifacts_json', "TEXT NOT NULL DEFAULT '[]'")
}

export function saveReleasePublishTask<TPlan extends object, TRepository extends object>(
  db: DatabaseLike,
  task: ReleasePublishTaskSnapshot<TPlan, TRepository>
): void {
  db.prepare(
    `
    INSERT INTO release_publish_tasks (
      id, repository_id, repository_name, provider, version, tag_name, release_title, selected_script,
      status, phase, phase_index, phase_total, hint, last_output_at, process_pid,
      started_at, updated_at, finished_at, log, stdout, stderr, exit_code, error,
      external_build_id, external_build_url, external_status, external_workflow, external_branch,
      external_tag, artifacts_json, plan_json, repository_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      repository_id = excluded.repository_id,
      repository_name = excluded.repository_name,
      provider = excluded.provider,
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
      external_build_id = excluded.external_build_id,
      external_build_url = excluded.external_build_url,
      external_status = excluded.external_status,
      external_workflow = excluded.external_workflow,
      external_branch = excluded.external_branch,
      external_tag = excluded.external_tag,
      artifacts_json = excluded.artifacts_json,
      plan_json = excluded.plan_json,
      repository_json = excluded.repository_json
  `
  ).run(
    task.id,
    task.repositoryId,
    task.repositoryName,
    task.provider,
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
    task.externalBuildId ?? null,
    task.externalBuildUrl ?? null,
    task.externalStatus ?? null,
    task.externalWorkflow ?? null,
    task.externalBranch ?? null,
    task.externalTag ?? null,
    JSON.stringify(task.artifacts ?? []),
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
