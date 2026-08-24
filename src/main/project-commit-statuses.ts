export type ManualCommitTestStatus = 'passed' | 'failed'

export type CommitLifecycleStatus = 'pending-test' | 'testing' | 'test-passed' | 'test-failed' | 'online'

export type CommitLifecycleSource = 'pending-test' | 'testing-branch' | 'manual-test-result' | 'main'

export type CommitLifecycle = {
  status: CommitLifecycleStatus
  source: CommitLifecycleSource
  editable: boolean
}

export type ProjectCommitStatusConfig = {
  projectId: string
  testBranchName: string
}

export type RepositoryCommitTestStatus = {
  repositoryId: string
  commitHash: string
  status: ManualCommitTestStatus
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

const defaultTestBranchName = 'develop'

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function normalizeLifecycleBranchName(branchName: string): string {
  const value = branchName.trim().replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^/]+\//, '')

  if (!value) {
    throw new Error('请输入测试分支短名')
  }

  return value
}

export function matchesLifecycleBranchRef(ref: string, branchName: string): boolean {
  if (ref === `refs/heads/${branchName}`) {
    return true
  }

  const remoteMatch = ref.match(/^refs\/remotes\/[^/]+\/(.+)$/)
  return remoteMatch?.[1] === branchName
}

function assertProjectExists(db: DatabaseLike, projectId: string): string {
  const normalizedProjectId = projectId.trim()
  const project = normalizedProjectId ? db.prepare('SELECT id FROM projects WHERE id = ?').get(normalizedProjectId) : undefined

  if (!project) {
    throw new Error('项目不存在')
  }

  return normalizedProjectId
}

function mapConfigRow(row: Record<string, unknown>): ProjectCommitStatusConfig {
  return {
    projectId: String(row.project_id),
    testBranchName: String(row.test_branch_name || defaultTestBranchName)
  }
}

function mapTestStatusRow(row: Record<string, unknown>): RepositoryCommitTestStatus {
  return {
    repositoryId: String(row.repository_id),
    commitHash: String(row.commit_hash),
    status: row.status === 'failed' ? 'failed' : 'passed',
    updatedAt: String(row.updated_at ?? '')
  }
}

export function migrateProjectCommitStatusTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_commit_status_configs (
      project_id TEXT PRIMARY KEY,
      test_branch_name TEXT NOT NULL DEFAULT 'develop',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repository_commit_test_statuses (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(repository_id, commit_hash),
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );
  `)
}

function ensureProjectConfig(db: DatabaseLike, projectId: string): void {
  const existing = db.prepare('SELECT project_id FROM project_commit_status_configs WHERE project_id = ?').get(projectId)

  if (existing) {
    return
  }

  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO project_commit_status_configs (project_id, test_branch_name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(projectId, defaultTestBranchName, now, now)
}

export function getProjectCommitStatusConfig(db: DatabaseLike, projectId: string): ProjectCommitStatusConfig {
  const normalizedProjectId = assertProjectExists(db, projectId)
  ensureProjectConfig(db, normalizedProjectId)
  const row = db.prepare('SELECT * FROM project_commit_status_configs WHERE project_id = ?').get(normalizedProjectId) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error('测试分支配置读取失败')
  }

  return mapConfigRow(row)
}

export function saveProjectCommitStatusConfig(db: DatabaseLike, input: ProjectCommitStatusConfig): ProjectCommitStatusConfig {
  const projectId = assertProjectExists(db, input.projectId)
  const testBranchName = normalizeLifecycleBranchName(input.testBranchName)
  const now = new Date().toISOString()
  ensureProjectConfig(db, projectId)
  db.prepare('UPDATE project_commit_status_configs SET test_branch_name = ?, updated_at = ? WHERE project_id = ?').run(testBranchName, now, projectId)
  return getProjectCommitStatusConfig(db, projectId)
}

export function listRepositoryCommitTestStatuses(db: DatabaseLike, repositoryId: string, commitHashes: string[]): Map<string, RepositoryCommitTestStatus> {
  const uniqueHashes = Array.from(new Set(commitHashes.filter(Boolean)))

  if (!uniqueHashes.length) {
    return new Map()
  }

  const placeholders = uniqueHashes.map(() => '?').join(', ')
  const rows = db.prepare(`SELECT * FROM repository_commit_test_statuses WHERE repository_id = ? AND commit_hash IN (${placeholders})`).all(repositoryId, ...uniqueHashes) as Array<Record<string, unknown>>
  return new Map(rows.map((row) => {
    const status = mapTestStatusRow(row)
    return [status.commitHash, status]
  }))
}

export function saveRepositoryCommitTestStatus(db: DatabaseLike, input: { repositoryId: string; commitHash: string; status: ManualCommitTestStatus }): RepositoryCommitTestStatus {
  const repositoryId = input.repositoryId.trim()
  const commitHash = input.commitHash.trim()

  if (!repositoryId || !commitHash) {
    throw new Error('提交状态参数无效')
  }

  if (input.status !== 'passed' && input.status !== 'failed') {
    throw new Error('测试状态无效')
  }

  const now = new Date().toISOString()
  const existing = db.prepare('SELECT id FROM repository_commit_test_statuses WHERE repository_id = ? AND commit_hash = ?').get(repositoryId, commitHash) as { id?: string } | undefined

  if (existing?.id) {
    db.prepare('UPDATE repository_commit_test_statuses SET status = ?, updated_at = ? WHERE id = ?').run(input.status, now, existing.id)
  } else {
    db.prepare('INSERT INTO repository_commit_test_statuses (id, repository_id, commit_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(createId('commit-test-status'), repositoryId, commitHash, input.status, now, now)
  }

  const row = db.prepare('SELECT * FROM repository_commit_test_statuses WHERE repository_id = ? AND commit_hash = ?').get(repositoryId, commitHash) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error('测试状态保存失败')
  }

  return mapTestStatusRow(row)
}

export function resolveCommitLifecycle(input: { inMain: boolean; inTestBranch: boolean; manualStatus?: ManualCommitTestStatus }): CommitLifecycle {
  if (input.inMain) {
    return { status: 'online', source: 'main', editable: false }
  }

  if (!input.inTestBranch) {
    return { status: 'pending-test', source: 'pending-test', editable: false }
  }

  if (input.manualStatus === 'passed') {
    return { status: 'test-passed', source: 'manual-test-result', editable: true }
  }

  if (input.manualStatus === 'failed') {
    return { status: 'test-failed', source: 'manual-test-result', editable: true }
  }

  return { status: 'testing', source: 'testing-branch', editable: true }
}

export function assertCommitLifecycleEditable(lifecycle: CommitLifecycle, testBranchName: string): void {
  if (lifecycle.editable) {
    return
  }

  if (lifecycle.status === 'online') {
    throw new Error('已上线的提交不可修改状态')
  }

  throw new Error(`提交尚未合入测试分支 ${testBranchName}，不能标记测试结果`)
}
