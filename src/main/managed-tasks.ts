import { randomUUID } from 'node:crypto'

export type ManagedTaskStage =
  | 'created'
  | 'planning'
  | 'ready'
  | 'branching'
  | 'executing'
  | 'codex-complete'
  | 'completed-no-changes'
  | 'awaiting-review'
  | 'awaiting-commit'
  | 'awaiting-target'
  | 'merging'
  | 'merged'
  | 'pushing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'needs-attention'
  | 'unassigned'

export type ManagedTaskSource = 'forgedesk' | 'codex-import' | 'legacy'
export type ManagedTaskRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export type TaskSubtask = {
  id: string
  taskId: string
  title: string
  description: string
  acceptance: string
  dependencyIds: string[]
  order: number
  codexThreadId: string
  stage: ManagedTaskStage
  runStatus: ManagedTaskRunStatus
  createdAt: string
  updatedAt: string
}

export type TaskLifecycleEvent = {
  id: string
  taskId: string
  stage: ManagedTaskStage
  message: string
  detail: string
  createdAt: string
}

export type CodexThreadBinding = {
  taskId: string
  codexThreadId: string
  role: 'parent' | 'subtask' | 'imported'
  title: string
  cwd: string
  nativeStatus: string
  updatedAt: string
}

export type ManagedTask = {
  id: string
  title: string
  description: string
  source: ManagedTaskSource
  projectId: string
  repositoryId: string
  cwd: string
  codexThreadId: string
  stage: ManagedTaskStage
  runStatus: ManagedTaskRunStatus
  branch: string
  baseBranch: string
  baselineSha: string
  targetBranch: string
  commitSha: string
  hasChanges: boolean
  autoExecute: boolean
  createdAt: string
  updatedAt: string
  finishedAt: string
  subtasks: TaskSubtask[]
  events: TaskLifecycleEvent[]
  bindings: CodexThreadBinding[]
}

export type ManagedTaskCreateInput = {
  title: string
  description?: string
  projectId: string
  repositoryId: string
  cwd: string
  codexThreadId: string
  autoExecute?: boolean
}

export type ManagedTaskPlanItem = {
  title: string
  description?: string
  acceptance?: string
  dependencyIndexes?: number[]
}

export type ManagedTaskImportedThread = {
  id: string
  title: string
  cwd: string
  status: string
  updatedAt: string
}

export type ManagedTaskLegacyImport = {
  id: string
  title: string
  notes?: string
  status: 'todo' | 'doing' | 'done'
  projectId?: string | null
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
  subtasks?: Array<{ id?: string; title: string; done?: boolean; createdAt?: string; completedAt?: string | null }>
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: any[]) => unknown[]
    get: (...params: any[]) => unknown
    run: (...params: any[]) => unknown
  }
}

type Row = Record<string, unknown>

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function boolValue(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}

function stageValue(value: unknown): ManagedTaskStage {
  const stage = stringValue(value) as ManagedTaskStage
  return managedTaskStages.includes(stage) ? stage : 'created'
}

function statusValue(value: unknown): ManagedTaskRunStatus {
  const status = stringValue(value) as ManagedTaskRunStatus
  return ['idle', 'running', 'completed', 'failed', 'cancelled'].includes(status) ? status : 'idle'
}

function sourceValue(value: unknown): ManagedTaskSource {
  const source = stringValue(value) as ManagedTaskSource
  return ['forgedesk', 'codex-import', 'legacy'].includes(source) ? source : 'forgedesk'
}

function dependencyIds(value: unknown): string[] {
  try {
    const parsed = JSON.parse(stringValue(value)) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export const managedTaskStages: ManagedTaskStage[] = [
  'created', 'planning', 'ready', 'branching', 'executing', 'codex-complete', 'completed-no-changes',
  'awaiting-review', 'awaiting-commit', 'awaiting-target', 'merging', 'merged', 'pushing', 'completed',
  'failed', 'cancelled', 'needs-attention', 'unassigned'
]

export const managedTaskStageLabels: Record<ManagedTaskStage, string> = {
  created: '已创建', planning: 'Codex 分析中', ready: '待确认执行', branching: '创建分支中', executing: '执行中',
  'codex-complete': 'Codex 已完成', 'completed-no-changes': '已完成（无代码变更）', 'awaiting-review': '待审核',
  'awaiting-commit': '待提交', 'awaiting-target': '待选择发布分支', merging: '合并中', merged: '已合并',
  pushing: '推送中', completed: '已完成', failed: '执行失败', cancelled: '已取消', 'needs-attention': '需处理', unassigned: '待关联项目'
}

export function migrateManagedTaskTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS managed_tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'forgedesk',
      project_id TEXT NOT NULL DEFAULT '', repository_id TEXT NOT NULL DEFAULT '', cwd TEXT NOT NULL DEFAULT '',
      codex_thread_id TEXT NOT NULL DEFAULT '', stage TEXT NOT NULL DEFAULT 'created', run_status TEXT NOT NULL DEFAULT 'idle',
      branch TEXT NOT NULL DEFAULT '', base_branch TEXT NOT NULL DEFAULT '', baseline_sha TEXT NOT NULL DEFAULT '',
      target_branch TEXT NOT NULL DEFAULT '', commit_sha TEXT NOT NULL DEFAULT '', has_changes INTEGER NOT NULL DEFAULT 0,
      auto_execute INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_tasks_codex_thread ON managed_tasks(codex_thread_id) WHERE codex_thread_id <> '';
    CREATE INDEX IF NOT EXISTS idx_managed_tasks_project_updated ON managed_tasks(project_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS managed_task_subtasks (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', acceptance TEXT NOT NULL DEFAULT '',
      dependency_ids TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0, codex_thread_id TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'ready', run_status TEXT NOT NULL DEFAULT 'idle', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES managed_tasks(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_subtasks_codex_thread ON managed_task_subtasks(codex_thread_id) WHERE codex_thread_id <> '';
    CREATE TABLE IF NOT EXISTS managed_task_events (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, stage TEXT NOT NULL, message TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES managed_tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_managed_task_events_task ON managed_task_events(task_id, created_at ASC);
    CREATE TABLE IF NOT EXISTS managed_task_thread_bindings (
      codex_thread_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, role TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', cwd TEXT NOT NULL DEFAULT '',
      native_status TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, FOREIGN KEY(task_id) REFERENCES managed_tasks(id) ON DELETE CASCADE
    );
  `)
}

function taskId(): string { return `managed-task-${randomUUID()}` }
function subtaskId(): string { return `managed-subtask-${randomUUID()}` }
function eventId(): string { return `managed-task-event-${randomUUID()}` }

export class ManagedTaskService {
  constructor(private readonly db: () => DatabaseLike, private readonly now: () => Date = () => new Date()) {}

  list(projectId?: string): ManagedTask[] {
    const database = this.db()
    // Keep the feature self-healing for existing user databases. This also
    // protects IPC callers during a renderer-only hot reload, before the next
    // full application restart has run the central migration sequence.
    migrateManagedTaskTables(database)
    const rows = (projectId
      ? database.prepare('SELECT * FROM managed_tasks WHERE project_id = ? ORDER BY updated_at DESC').all(projectId)
      : database.prepare('SELECT * FROM managed_tasks ORDER BY updated_at DESC').all()) as Row[]
    return rows.map((row) => this.mapTask(row))
  }

  get(id: string): ManagedTask | null {
    const database = this.db()
    migrateManagedTaskTables(database)
    const row = database.prepare('SELECT * FROM managed_tasks WHERE id = ?').get(id) as Row | undefined
    return row ? this.mapTask(row) : null
  }

  create(input: ManagedTaskCreateInput): ManagedTask {
    if (!input.title.trim()) throw new Error('请输入任务标题')
    if (!input.projectId.trim()) throw new Error('任务必须关联项目')
    if (!input.repositoryId.trim()) throw new Error('任务必须关联仓库')
    if (!input.codexThreadId.trim()) throw new Error('任务必须关联 Codex 线程')
    const timestamp = this.timestamp()
    const id = taskId()
    this.db().prepare(`INSERT INTO managed_tasks (id,title,description,source,project_id,repository_id,cwd,codex_thread_id,stage,run_status,auto_execute,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,'created','idle',?,?,?)`).run(id, input.title.trim(), input.description?.trim() ?? '', 'forgedesk', input.projectId.trim(), input.repositoryId.trim(), input.cwd.trim(), input.codexThreadId.trim(), input.autoExecute ? 1 : 0, timestamp, timestamp)
    this.bind(id, input.codexThreadId, 'parent', input.title, input.cwd, 'idle', timestamp)
    this.addEvent(id, 'created', '任务已创建，等待 Codex 分析', '')
    return this.require(id)
  }

  importThread(input: ManagedTaskImportedThread, projectId = '', repositoryId = ''): ManagedTask {
    const existing = this.db().prepare('SELECT id FROM managed_tasks WHERE codex_thread_id = ?').get(input.id) as Row | undefined
    if (existing) return this.require(stringValue(existing.id))
    const timestamp = this.timestamp()
    const id = taskId()
    const assigned = Boolean(projectId && repositoryId)
    const stage: ManagedTaskStage = assigned ? (input.status === 'running' ? 'executing' : 'needs-attention') : 'unassigned'
    const status: ManagedTaskRunStatus = input.status === 'running' ? 'running' : input.status === 'failed' ? 'failed' : input.status === 'cancelled' ? 'cancelled' : 'completed'
    this.db().prepare(`INSERT INTO managed_tasks (id,title,description,source,project_id,repository_id,cwd,codex_thread_id,stage,run_status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.title.trim() || 'Codex 对话', '', 'codex-import', projectId, repositoryId, input.cwd, input.id, stage, status, input.updatedAt || timestamp, timestamp)
    this.bind(id, input.id, 'imported', input.title, input.cwd, input.status, timestamp)
    this.addEvent(id, stage, assigned ? '已从 Codex 自动同步，等待确认归因或交付状态' : '发现未关联项目的 Codex 线程，请先关联项目', '')
    return this.require(id)
  }

  importLegacy(input: ManagedTaskLegacyImport, repositoryId = '', cwd = ''): ManagedTask {
    const existing = this.get(input.id)
    if (existing) return existing
    if (!input.id.trim() || !input.title.trim()) throw new Error('旧任务缺少必要信息')
    const timestamp = this.timestamp()
    const createdAt = input.createdAt?.trim() || timestamp
    const updatedAt = input.updatedAt?.trim() || createdAt
    const assigned = Boolean(input.projectId?.trim() && repositoryId.trim())
    const done = input.status === 'done'
    const stage: ManagedTaskStage = done ? 'completed-no-changes' : assigned ? 'needs-attention' : 'unassigned'
    const runStatus: ManagedTaskRunStatus = done ? 'completed' : 'idle'
    this.db().prepare(`INSERT INTO managed_tasks (id,title,description,source,project_id,repository_id,cwd,stage,run_status,created_at,updated_at,finished_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      input.id.trim(), input.title.trim(), input.notes?.trim() ?? '', 'legacy', input.projectId?.trim() ?? '', repositoryId.trim(), cwd.trim(), stage, runStatus,
      createdAt, updatedAt, done ? (input.completedAt?.trim() || updatedAt) : ''
    )
    for (const [index, subtask] of (input.subtasks ?? []).entries()) {
      const subtaskTimestamp = subtask.createdAt?.trim() || createdAt
      this.db().prepare(`INSERT INTO managed_task_subtasks (id,task_id,title,sort_order,stage,run_status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        subtask.id?.trim() || subtaskId(), input.id.trim(), subtask.title.trim() || `子任务 ${index + 1}`, index,
        subtask.done ? 'completed' : 'ready', subtask.done ? 'completed' : 'idle', subtaskTimestamp, subtask.completedAt?.trim() || updatedAt
      )
    }
    this.addEvent(input.id.trim(), stage, done ? '历史任务已迁入统一任务库（已完成）' : assigned ? '历史任务已迁入统一任务库，请重新关联 Codex 线程后执行' : '历史任务已迁入待关联收件箱，请先选择项目与仓库', '', updatedAt)
    return this.require(input.id.trim())
  }

  assign(id: string, projectId: string, repositoryId: string): ManagedTask {
    if (!projectId.trim() || !repositoryId.trim()) throw new Error('请选择项目与仓库')
    this.db().prepare('UPDATE managed_tasks SET project_id = ?, repository_id = ?, stage = ?, updated_at = ? WHERE id = ?').run(projectId, repositoryId, 'needs-attention', this.timestamp(), id)
    this.addEvent(id, 'needs-attention', '已关联项目与仓库，请确认任务状态', '')
    return this.require(id)
  }

  setPlan(id: string, plan: ManagedTaskPlanItem[]): ManagedTask {
    const task = this.require(id)
    if (task.stage !== 'planning' && task.stage !== 'created' && task.stage !== 'ready') throw new Error('当前状态不能更新执行计划')
    const database = this.db()
    database.prepare('DELETE FROM managed_task_subtasks WHERE task_id = ?').run(id)
    const timestamp = this.timestamp()
    const generatedIds = plan.map(() => subtaskId())
    for (const [index, item] of plan.entries()) {
      const title = item.title.trim()
      if (!title) continue
      const dependencies = (item.dependencyIndexes ?? []).map((dependency) => generatedIds[dependency]).filter(Boolean)
      database.prepare(`INSERT INTO managed_task_subtasks (id,task_id,title,description,acceptance,dependency_ids,sort_order,stage,run_status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,'ready','idle',?,?)`).run(generatedIds[index], id, title, item.description?.trim() ?? '', item.acceptance?.trim() ?? '', JSON.stringify(dependencies), index, timestamp, timestamp)
    }
    this.setStage(id, 'ready', 'Codex 已完成任务拆分，等待确认执行')
    return this.require(id)
  }

  beginPlanning(id: string): ManagedTask { this.setStage(id, 'planning', '正在由 Codex 分析并拆分任务'); return this.require(id) }

  beginBranch(id: string, input: { branch: string; baseBranch: string; baselineSha: string }): ManagedTask {
    if (!input.branch.trim() || !input.baseBranch.trim()) throw new Error('分支信息不完整')
    this.db().prepare('UPDATE managed_tasks SET branch = ?, base_branch = ?, baseline_sha = ?, updated_at = ? WHERE id = ?').run(input.branch, input.baseBranch, input.baselineSha, this.timestamp(), id)
    this.setStage(id, 'branching', `正在创建分支 ${input.branch}`, '')
    return this.require(id)
  }

  startExecution(id: string): ManagedTask { this.setStage(id, 'executing', 'Codex 正在执行任务'); return this.require(id) }

  startSubtask(id: string, subtaskIdValue: string, thread: ManagedTaskImportedThread): ManagedTask {
    const task = this.require(id)
    const subtask = task.subtasks.find((item) => item.id === subtaskIdValue)
    if (!subtask) throw new Error('子任务不存在')
    if (subtask.runStatus === 'completed') return task
    const timestamp = this.timestamp()
    this.db().prepare('UPDATE managed_task_subtasks SET codex_thread_id = ?, stage = ?, run_status = ?, updated_at = ? WHERE id = ? AND task_id = ?').run(thread.id, 'executing', 'running', timestamp, subtaskIdValue, id)
    this.bind(id, thread.id, 'subtask', thread.title, thread.cwd, thread.status || 'running', timestamp)
    this.addEvent(id, 'executing', `开始执行子任务：${subtask.title}`, `Codex thread: ${thread.id}`, timestamp)
    return this.require(id)
  }

  completeExecution(id: string, hasChanges: boolean, detail = ''): ManagedTask {
    this.db().prepare('UPDATE managed_tasks SET has_changes = ?, updated_at = ? WHERE id = ?').run(hasChanges ? 1 : 0, this.timestamp(), id)
    this.setStage(id, 'codex-complete', 'Codex 已完成执行', detail)
    this.setStage(id, hasChanges ? 'awaiting-review' : 'completed-no-changes', hasChanges ? '检测到代码变更，等待人工审核' : '未检测到代码变更，任务已完成')
    return this.require(id)
  }

  approveReview(id: string): ManagedTask { this.setStage(id, 'awaiting-commit', '审核已通过，正在检测提交'); return this.require(id) }

  recordCommit(id: string, commitSha: string): ManagedTask {
    if (!commitSha.trim()) throw new Error('未检测到有效提交')
    this.db().prepare('UPDATE managed_tasks SET commit_sha = ?, updated_at = ? WHERE id = ?').run(commitSha.trim(), this.timestamp(), id)
    this.setStage(id, 'awaiting-target', `已检测到提交 ${commitSha.slice(0, 12)}，请选择发布分支`)
    return this.require(id)
  }

  beginMerge(id: string, targetBranch: string): ManagedTask {
    if (!['develop', 'preview'].includes(targetBranch)) throw new Error('发布分支仅支持 develop 或 preview')
    this.db().prepare('UPDATE managed_tasks SET target_branch = ?, updated_at = ? WHERE id = ?').run(targetBranch, this.timestamp(), id)
    this.setStage(id, 'merging', `正在合并到 ${targetBranch}`)
    return this.require(id)
  }

  merged(id: string, detail = ''): ManagedTask { this.setStage(id, 'merged', '代码已合并，等待推送', detail); return this.require(id) }
  beginPush(id: string): ManagedTask { this.setStage(id, 'pushing', '正在推送目标分支'); return this.require(id) }
  completePublish(id: string, detail = ''): ManagedTask { this.setStage(id, 'completed', '已合并并推送，任务完成', detail, true); return this.require(id) }
  fail(id: string, message: string): ManagedTask { this.setStage(id, 'failed', message || '任务执行失败'); return this.require(id) }
  cancel(id: string): ManagedTask {
    const task = this.require(id)
    if (task.stage === 'cancelled') return task
    const timestamp = this.timestamp()
    this.db().prepare("UPDATE managed_task_subtasks SET stage = 'cancelled', run_status = 'cancelled', updated_at = ? WHERE task_id = ? AND run_status = 'running'").run(timestamp, id)
    this.setStage(id, 'cancelled', '任务已取消', '', true)
    return this.require(id)
  }

  updateBinding(thread: ManagedTaskImportedThread): ManagedTask | null {
    const row = this.db().prepare('SELECT task_id, role FROM managed_task_thread_bindings WHERE codex_thread_id = ?').get(thread.id) as Row | undefined
    if (!row) return null
    const id = stringValue(row.task_id)
    const role = stringValue(row.role)
    const timestamp = this.timestamp()
    this.db().prepare('UPDATE managed_task_thread_bindings SET title = ?, cwd = ?, native_status = ?, updated_at = ? WHERE codex_thread_id = ?').run(thread.title, thread.cwd, thread.status, timestamp, thread.id)
    if (role === 'subtask') {
      if (thread.status === 'running') this.db().prepare('UPDATE managed_task_subtasks SET stage = ?, run_status = ?, updated_at = ? WHERE codex_thread_id = ?').run('executing', 'running', timestamp, thread.id)
      if (['completed', 'idle'].includes(thread.status)) this.db().prepare('UPDATE managed_task_subtasks SET stage = ?, run_status = ?, updated_at = ? WHERE codex_thread_id = ?').run('codex-complete', 'completed', timestamp, thread.id)
      if (thread.status === 'failed') this.fail(id, 'Codex 子任务执行失败')
      if (thread.status === 'cancelled') this.cancel(id)
      return this.require(id)
    }
    const task = this.require(id)
    // A user-initiated cancellation is authoritative. App Server can briefly
    // continue to report a turn as running while the interrupt is propagating;
    // do not resurrect a task that has already been cancelled locally.
    if (task.stage === 'cancelled') return task
    if (thread.status === 'running' && task.stage !== 'executing') this.setStage(id, 'executing', 'Codex 线程正在执行')
    if (thread.status === 'failed') this.fail(id, 'Codex 线程执行失败')
    if (thread.status === 'cancelled') this.cancel(id)
    return this.require(id)
  }

  private setStage(id: string, stage: ManagedTaskStage, message: string, detail = '', finished = false): void {
    const timestamp = this.timestamp()
    const runStatus: ManagedTaskRunStatus = stage === 'executing' || stage === 'branching' || stage === 'merging' || stage === 'pushing' || stage === 'planning' ? 'running'
      : stage === 'failed' ? 'failed' : stage === 'cancelled' ? 'cancelled' : ['completed', 'completed-no-changes'].includes(stage) ? 'completed' : 'idle'
    this.db().prepare('UPDATE managed_tasks SET stage = ?, run_status = ?, updated_at = ?, finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ?').run(stage, runStatus, timestamp, finished ? 1 : 0, finished ? timestamp : '', id)
    this.addEvent(id, stage, message, detail, timestamp)
  }

  private bind(taskIdValue: string, threadId: string, role: CodexThreadBinding['role'], title: string, cwd: string, nativeStatus: string, timestamp: string): void {
    this.db().prepare(`INSERT INTO managed_task_thread_bindings (codex_thread_id,task_id,role,title,cwd,native_status,updated_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(codex_thread_id) DO UPDATE SET task_id=excluded.task_id, role=excluded.role, title=excluded.title, cwd=excluded.cwd, native_status=excluded.native_status, updated_at=excluded.updated_at`).run(threadId, taskIdValue, role, title, cwd, nativeStatus, timestamp)
  }

  private addEvent(taskIdValue: string, stage: ManagedTaskStage, message: string, detail: string, timestamp = this.timestamp()): void {
    this.db().prepare('INSERT INTO managed_task_events (id,task_id,stage,message,detail,created_at) VALUES (?,?,?,?,?,?)').run(eventId(), taskIdValue, stage, message, detail, timestamp)
  }

  private mapTask(row: Row): ManagedTask {
    const database = this.db(); const id = stringValue(row.id)
    const subtasks = (database.prepare('SELECT * FROM managed_task_subtasks WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC').all(id) as Row[]).map((item) => ({
      id: stringValue(item.id), taskId: id, title: stringValue(item.title), description: stringValue(item.description), acceptance: stringValue(item.acceptance), dependencyIds: dependencyIds(item.dependency_ids), order: Number(item.sort_order) || 0, codexThreadId: stringValue(item.codex_thread_id), stage: stageValue(item.stage), runStatus: statusValue(item.run_status), createdAt: stringValue(item.created_at), updatedAt: stringValue(item.updated_at)
    }))
    const events = (database.prepare('SELECT * FROM managed_task_events WHERE task_id = ? ORDER BY created_at ASC').all(id) as Row[]).map((item) => ({ id: stringValue(item.id), taskId: id, stage: stageValue(item.stage), message: stringValue(item.message), detail: stringValue(item.detail), createdAt: stringValue(item.created_at) }))
    const bindings = (database.prepare('SELECT * FROM managed_task_thread_bindings WHERE task_id = ? ORDER BY updated_at ASC').all(id) as Row[]).map((item) => ({ taskId: id, codexThreadId: stringValue(item.codex_thread_id), role: (stringValue(item.role) === 'subtask' ? 'subtask' : stringValue(item.role) === 'imported' ? 'imported' : 'parent') as CodexThreadBinding['role'], title: stringValue(item.title), cwd: stringValue(item.cwd), nativeStatus: stringValue(item.native_status), updatedAt: stringValue(item.updated_at) }))
    return { id, title: stringValue(row.title), description: stringValue(row.description), source: sourceValue(row.source), projectId: stringValue(row.project_id), repositoryId: stringValue(row.repository_id), cwd: stringValue(row.cwd), codexThreadId: stringValue(row.codex_thread_id), stage: stageValue(row.stage), runStatus: statusValue(row.run_status), branch: stringValue(row.branch), baseBranch: stringValue(row.base_branch), baselineSha: stringValue(row.baseline_sha), targetBranch: stringValue(row.target_branch), commitSha: stringValue(row.commit_sha), hasChanges: boolValue(row.has_changes), autoExecute: boolValue(row.auto_execute), createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at), finishedAt: stringValue(row.finished_at), subtasks, events, bindings }
  }

  private require(id: string): ManagedTask { const task = this.get(id); if (!task) throw new Error('任务不存在'); return task }
  private timestamp(): string { return this.now().toISOString() }
}
