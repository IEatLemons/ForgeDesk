export type CodemagicRepositoryBindingInput = {
  repositoryId: string
  tokenId: string
  teamId?: string
  appId: string
  appName?: string
  workflowId: string
  workflowName?: string
  defaultBranch?: string
  labels?: string[]
}

export type CodemagicRepositoryBinding = {
  repositoryId: string
  tokenId: string
  teamId: string
  appId: string
  appName: string
  workflowId: string
  workflowName: string
  defaultBranch: string
  labels: string[]
  createdAt: string
  updatedAt: string
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

function nowIso(): string {
  return new Date().toISOString()
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRequiredText(value: unknown, message: string): string {
  const normalized = trimText(value)

  if (!normalized) {
    throw new Error(message)
  }

  return normalized
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(value.map(trimText).filter(Boolean)))
}

function parseLabelsJson(value: unknown): string[] {
  if (!value) {
    return []
  }

  try {
    return normalizeLabels(JSON.parse(String(value)))
  } catch {
    return []
  }
}

function mapBindingRow(row: Record<string, unknown>): CodemagicRepositoryBinding {
  return {
    repositoryId: String(row.repository_id),
    tokenId: String(row.token_id ?? ''),
    teamId: String(row.team_id ?? ''),
    appId: String(row.app_id ?? ''),
    appName: String(row.app_name ?? ''),
    workflowId: String(row.workflow_id ?? ''),
    workflowName: String(row.workflow_name ?? ''),
    defaultBranch: String(row.default_branch ?? ''),
    labels: parseLabelsJson(row.labels_json),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function assertRepositoryExists(db: DatabaseLike, repositoryId: string): string {
  const normalizedRepositoryId = normalizeRequiredText(repositoryId, '仓库不存在')
  const repository = db.prepare('SELECT id FROM repositories WHERE id = ?').get(normalizedRepositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  return normalizedRepositoryId
}

export function migrateCodemagicRepositoryBindingTable(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS codemagic_repository_bindings (
      repository_id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      team_id TEXT NOT NULL DEFAULT '',
      app_id TEXT NOT NULL,
      app_name TEXT NOT NULL DEFAULT '',
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL DEFAULT '',
      default_branch TEXT NOT NULL DEFAULT '',
      labels_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );
  `)
}

export function getCodemagicRepositoryBinding(db: DatabaseLike, repositoryId: string): CodemagicRepositoryBinding | null {
  const normalizedRepositoryId = assertRepositoryExists(db, repositoryId)
  const row = db.prepare('SELECT * FROM codemagic_repository_bindings WHERE repository_id = ?').get(normalizedRepositoryId) as Record<string, unknown> | undefined
  return row ? mapBindingRow(row) : null
}

export function listCodemagicRepositoryBindings(db: DatabaseLike, repositoryId?: string): CodemagicRepositoryBinding[] {
  const rows = repositoryId?.trim()
    ? db.prepare('SELECT * FROM codemagic_repository_bindings WHERE repository_id = ? ORDER BY updated_at DESC').all(repositoryId.trim())
    : db.prepare('SELECT * FROM codemagic_repository_bindings ORDER BY updated_at DESC').all()

  return (rows as Array<Record<string, unknown>>).map(mapBindingRow)
}

export function saveCodemagicRepositoryBinding(db: DatabaseLike, input: CodemagicRepositoryBindingInput): CodemagicRepositoryBinding {
  const repositoryId = assertRepositoryExists(db, input.repositoryId)
  const tokenId = normalizeRequiredText(input.tokenId, '请选择 Codemagic Token')
  const appId = normalizeRequiredText(input.appId, '请填写 Codemagic App ID')
  const workflowId = normalizeRequiredText(input.workflowId, '请填写 Codemagic Workflow ID')
  const existing = db.prepare('SELECT * FROM codemagic_repository_bindings WHERE repository_id = ?').get(repositoryId) as Record<string, unknown> | undefined
  const now = nowIso()

  db.prepare(
    `
    INSERT INTO codemagic_repository_bindings (
      repository_id, token_id, team_id, app_id, app_name, workflow_id, workflow_name,
      default_branch, labels_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository_id) DO UPDATE SET
      token_id = excluded.token_id,
      team_id = excluded.team_id,
      app_id = excluded.app_id,
      app_name = excluded.app_name,
      workflow_id = excluded.workflow_id,
      workflow_name = excluded.workflow_name,
      default_branch = excluded.default_branch,
      labels_json = excluded.labels_json,
      updated_at = excluded.updated_at
  `
  ).run(
    repositoryId,
    tokenId,
    trimText(input.teamId),
    appId,
    trimText(input.appName),
    workflowId,
    trimText(input.workflowName),
    trimText(input.defaultBranch),
    JSON.stringify(normalizeLabels(input.labels)),
    String(existing?.created_at ?? now),
    now
  )

  return getCodemagicRepositoryBinding(db, repositoryId) as CodemagicRepositoryBinding
}

export function deleteCodemagicRepositoryBinding(db: DatabaseLike, repositoryId: string): void {
  const normalizedRepositoryId = assertRepositoryExists(db, repositoryId)
  db.prepare('DELETE FROM codemagic_repository_bindings WHERE repository_id = ?').run(normalizedRepositoryId)
}
