import { createHash, randomUUID } from 'node:crypto'
import type {
  ExecutionStatus, MigrationIssue, ProgressCommand, ProgressCommandResult, ProgressEntity,
  ProgressEvent, ProgressExecution, ProgressMigration, ProgressPlanDraft, ProgressPlanItem,
  ProgressScopeKind, ProgressSnapshotQuery, ProgressStats, ProjectProgressSnapshot,
  ProjectWorkItem, WorkScopeFields, WorkStatus
} from '../shared/project-progress.js'
import { keyResultPercent, keyResultReached, type ProgressKeyResult, type KeyResultInput, type ProgressRelation, type ProgressHistoryQuery, type ProgressHistoryPage, type ProgressDeliveryStats } from '../shared/project-progress.js'

type Row = Record<string, unknown>
export type ProgressDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: any[]) => unknown[]
    get: (...params: any[]) => unknown
    run: (...params: any[]) => unknown
  }
}

export type LegacyProgressManagedTask = {
  id: string; title: string; description: string; source: string; projectId: string; repositoryId: string
  cwd: string; stage: string; runStatus: string; createdAt: string; updatedAt: string; finishedAt: string
  codexThreadId: string; branch: string; baseBranch: string; baselineSha: string; commitSha: string; targetBranch: string
  autoExecute: boolean; hasChanges: boolean
  subtasks: Array<{ id: string; title: string; description: string; acceptance: string; dependencyIds: string[]; order: number; stage: string; runStatus: string; codexThreadId: string; createdAt: string; updatedAt: string }>
  events: Array<{ stage: string; message: string; detail: string; createdAt: string }>
  bindings: Array<{ codexThreadId: string; role: string; nativeStatus: string }>
}

const entityTables: Record<ProgressScopeKind, string> = { goal: 'project_goals', milestone: 'project_milestones', version: 'project_versions' }
const activeRuns: ExecutionStatus[] = ['queued', 'running', 'waiting', 'cancelling', 'unknown']
const isActiveExecution = (run:ProgressExecution):boolean => run.phase !== 'context-imported' && activeRuns.includes(run.status)
const uid = (kind: string): string => `${kind}-${randomUUID()}`
const str = (value: unknown): string => typeof value === 'string' ? value : ''
const unique = (values: string[]): string[] => {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('标签或依赖必须是字符串数组')
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
const json = <T>(row: unknown): T => JSON.parse(String((row as Row).data_json)) as T
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((key) => (value as Row)[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical((value as Row)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
const fingerprint = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex')

function assertAcyclicDependencies(items:ProjectWorkItem[]):void {
  const map = new Map(items.map(item => [item.id,item]))
  const edges = new Map(items.map(item => [item.id,new Set(item.dependencyIds)]))
  for (const item of items) if (item.parentId) {
    if (item.status !== 'cancelled') edges.get(item.parentId)?.add(item.id)
    for (const id of map.get(item.parentId)?.dependencyIds ?? []) edges.get(item.id)!.add(id)
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  const visit = (id:string):void => {
    if (visiting.has(id)) throw new Error('任务依赖不能形成循环（包括父任务验收和继承依赖）')
    if (visited.has(id)) return
    visiting.add(id)
    for (const target of edges.get(id) ?? []) visit(target)
    visiting.delete(id); visited.add(id)
  }
  for (const id of map.keys()) visit(id)
}

function date(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('日期格式必须是有效的 YYYY-MM-DD')
  return value
}

export function progressToday(asOf: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(asOf))
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

export function isWorkBlocked(item: ProjectWorkItem, items: ProjectWorkItem[]): boolean {
  return blockedWithMap(item,new Map(items.map(item => [item.id,item])))
}
function blockedWithMap(item:ProjectWorkItem,items:Map<string,ProjectWorkItem>):boolean {
  const parent = item.parentId ? items.get(item.parentId) : null
  return [item,...(parent?[parent]:[])].some(work => work.blockers.some(blocker => !blocker.resolvedAt) || work.dependencyIds.some(id => items.get(id)?.status !== 'done'))
}

export function calculateProjectProgress(items: ProjectWorkItem[], asOf: string, timezone: string, scopeId?: string): ProgressStats {
  const today = progressToday(asOf, timezone)
  const byId = new Map(items.map(item => [item.id,item])), byParent = new Map<string,ProjectWorkItem[]>()
  for (const item of items) if (item.parentId && item.status !== 'cancelled') byParent.set(item.parentId,[...(byParent.get(item.parentId) ?? []),item])
  const roots = items.filter((item) => !item.parentId && item.trackingState === 'tracked' && item.status !== 'cancelled' && (!scopeId || [item.goalId, item.keyResultId, item.milestoneId, item.versionId].includes(scopeId)))
  const leaves = roots.flatMap((root) => {
    const children = byParent.get(root.id) ?? []
    return children.length ? children : [root]
  })
  const count = (status: WorkStatus): number => leaves.filter((item) => item.status === status).length
  return {
    total: leaves.length, done: count('done'), todo: count('todo'), doing: count('doing'), review: count('review'),
    blocked: leaves.filter((item) => item.status !== 'done' && blockedWithMap(item,byId)).length,
    overdue: leaves.filter((item) => item.status !== 'done' && item.dueDate && item.dueDate < today).length,
    dueToday: leaves.filter((item) => item.status !== 'done' && item.dueDate === today).length,
    rootTasks: roots.length,
    awaitingParentAcceptance: roots.filter((root) => root.status !== 'done' && (byParent.get(root.id)?.length ?? 0)>0 && byParent.get(root.id)!.every(item => item.status === 'done')).length,
    inbox: items.filter((item) => !item.parentId && item.trackingState === 'inbox' && !item.archivedAt).length,
    percent: leaves.length ? Math.round(count('done') / leaves.length * 100) : null
  }
}

export function calculateDeliveryProgress(entity: ProgressEntity, items: ProjectWorkItem[], results: ProgressKeyResult[], entities: ProgressEntity[], relations: ProgressRelation[]): ProgressDeliveryStats {
  const tasks=items.filter(item=>!item.parentId && item.trackingState==='tracked' && item[`${entity.kind}Id` as 'goalId'|'milestoneId'|'versionId']===entity.id && item.status!=='cancelled')
  const links=relations.filter(link=>link.sourceId===entity.id)
  const checkpoints=entity.kind==='milestone'?links.map(link=>results.find(result=>result.id===link.targetId)):entity.kind==='version'?links.map(link=>entities.find(target=>target.id===link.targetId)):[]
  const tasksAccepted=tasks.filter(task=>task.status==='done').length,checkpointsAccepted=checkpoints.filter(target=>target?.status==='achieved').length
  return {tasksTotal:tasks.length,tasksAccepted,checkpointsTotal:checkpoints.length,checkpointsAccepted,readyForAcceptance:tasks.length+checkpoints.length>0 && tasksAccepted===tasks.length && checkpointsAccepted===checkpoints.length}
}

export function migrateProjectProgressTables(db: ProgressDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_work_items (id TEXT PRIMARY KEY, project_id TEXT, parent_id TEXT, status TEXT NOT NULL, row_version INTEGER NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_progress_items_project ON project_work_items(project_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_progress_items_parent ON project_work_items(parent_id);
    CREATE TABLE IF NOT EXISTS work_item_tags (work_item_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(work_item_id,tag));
    CREATE TABLE IF NOT EXISTS work_item_dependencies (work_item_id TEXT NOT NULL, depends_on_id TEXT NOT NULL, PRIMARY KEY(work_item_id,depends_on_id));
    CREATE TABLE IF NOT EXISTS work_item_blockers (id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS work_item_acceptances (id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, decision TEXT NOT NULL, scope_revision INTEGER NOT NULL, occurred_at TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress_events (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, project_id TEXT, occurred_at TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_progress_events_entity ON progress_events(entity_id,occurred_at);
    CREATE TABLE IF NOT EXISTS progress_commands (command_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, result_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS work_item_source_links (source_system TEXT NOT NULL, source_scope TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, work_item_id TEXT NOT NULL, PRIMARY KEY(source_system,source_scope,source_type,source_id));
    CREATE INDEX IF NOT EXISTS idx_progress_source_item ON work_item_source_links(work_item_id);
    CREATE TABLE IF NOT EXISTS task_executions (id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, managed_task_id TEXT, data_json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_progress_execution_task ON task_executions(work_item_id);
    CREATE TABLE IF NOT EXISTS execution_thread_links (execution_id TEXT NOT NULL, provider TEXT NOT NULL, account_scope TEXT NOT NULL DEFAULT '', thread_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(execution_id,provider,account_scope,thread_id));
    CREATE TABLE IF NOT EXISTS task_plan_drafts (id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS work_item_artifacts (id TEXT PRIMARY KEY, work_item_id TEXT NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress_migration_batches (id TEXT PRIMARY KEY, input_hash TEXT NOT NULL, data_json TEXT NOT NULL, source_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress_migration_items (batch_id TEXT NOT NULL, source_key TEXT NOT NULL, work_item_id TEXT, data_json TEXT NOT NULL, PRIMARY KEY(batch_id,source_key));
    CREATE TABLE IF NOT EXISTS project_progress_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_key_results (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, goal_id TEXT NOT NULL, row_version INTEGER NOT NULL, data_json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_project_key_results_goal ON project_key_results(project_id,goal_id);
    CREATE TABLE IF NOT EXISTS progress_relations (kind TEXT NOT NULL, project_id TEXT NOT NULL, source_id TEXT NOT NULL, target_id TEXT NOT NULL, PRIMARY KEY(kind,source_id,target_id));
  `)
  for (const table of Object.values(entityTables)) db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, row_version INTEGER NOT NULL, data_json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_${table}_project ON ${table}(project_id);`)
}

export class ProjectProgressService {
  private readonly initialized = new WeakSet<object>()
  private transactionNumber = 0
  constructor(private readonly getDatabase: () => ProgressDatabase, private readonly now: () => Date = () => new Date(), private readonly changed: () => void = () => undefined) {}

  private db(): ProgressDatabase {
    const db = this.getDatabase()
    if (!this.initialized.has(db)) { migrateProjectProgressTables(db); this.initialized.add(db) }
    return db
  }
  private timestamp(): string { return this.now().toISOString() }
  private atomic<T>(action: () => T): T {
    const db = this.db(), name = `progress_${++this.transactionNumber}`
    db.exec(`SAVEPOINT ${name}`)
    try { const result = action(); db.exec(`RELEASE SAVEPOINT ${name}`); return result }
    catch (error) { db.exec(`ROLLBACK TO SAVEPOINT ${name}`); db.exec(`RELEASE SAVEPOINT ${name}`); throw error }
  }
  isActive(): boolean { return (this.db().prepare("SELECT value FROM project_progress_settings WHERE key='active'").get() as Row | undefined)?.value === '1' }
  private allItems(): ProjectWorkItem[] {
    const items = this.db().prepare('SELECT data_json FROM project_work_items ORDER BY updated_at DESC,id').all().map(row => Object.assign({keyResultId:null},json<ProjectWorkItem>(row)))
    const children = new Map<string,ProjectWorkItem[]>()
    for (const item of items) if (item.parentId) {const group=children.get(item.parentId)??[];group.push(item);children.set(item.parentId,group)}
    for (const group of children.values()) group.sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))
    const roots = items.filter(item=>!item.parentId), rootIds = new Set(roots.map(item=>item.id))
    return [...roots.flatMap(root=>[root,...(children.get(root.id)??[])]),...items.filter(item=>item.parentId&&!rootIds.has(item.parentId))]
  }
  getItem(id: string): ProjectWorkItem {
    const row = this.db().prepare('SELECT data_json FROM project_work_items WHERE id=?').get(id)
    if (!row) throw new Error('项目任务不存在')
    return Object.assign({keyResultId:null},json<ProjectWorkItem>(row))
  }
  private entities(): ProgressEntity[] { return Object.values(entityTables).flatMap((table) => this.db().prepare(`SELECT data_json FROM ${table}`).all().map((row) => {const entity=json<ProgressEntity>(row);return entity.kind==='goal'?{progressMode:'legacy_tasks' as const,...entity}:entity})) }
  private keyResults(): ProgressKeyResult[] { return this.db().prepare('SELECT data_json FROM project_key_results ORDER BY rowid').all().map(row=>json<ProgressKeyResult>(row)) }
  private relations(): ProgressRelation[] { return this.db().prepare('SELECT * FROM progress_relations').all().map(row=>{const value=row as Row;return {kind:value.kind as ProgressRelation['kind'],projectId:String(value.project_id),sourceId:String(value.source_id),targetId:String(value.target_id)}}) }
  private assertProject(id: string | null): void {
    if (id && !this.db().prepare('SELECT id FROM projects WHERE id=?').get(id)) throw new Error('项目不存在，请重新选择项目')
  }
  private assertVersion(item: { rowVersion: number }, expected: number): void {
    if (item.rowVersion !== expected) throw new Error('记录已被其他窗口修改，请刷新后重试')
  }
  private assertEditable(item: ProjectWorkItem): void {
    if (item.authority !== 'native') throw new Error('此任务由外部系统维护，不能直接覆盖来源字段')
    if (item.archivedAt) throw new Error('请先恢复归档任务')
  }
  private assertNoActiveRun(id: string): void {
    const parentId = this.getItem(id).parentId
    const family = [id, ...(parentId ? [parentId] : []), ...this.allItems().filter((item) => item.parentId === id).map((item) => item.id)]
    if (this.executions().some((run) => family.includes(run.workItemId) && isActiveExecution(run))) throw new Error('仍有活动或待核对的 AI 执行，请先停止或核对运行')
  }
  private validateItem(item: ProjectWorkItem): void {
    if (typeof item.title !== 'string' || !item.title.trim()) throw new Error('请输入任务标题')
    if ([item.description,item.acceptanceText,item.ownerRef].some(value => typeof value !== 'string')) throw new Error('说明、验收条件和负责人必须是文本')
    if (!['low','medium','high'].includes(item.priority)) throw new Error('无效优先级')
    item.startDate = date(item.startDate); item.dueDate = date(item.dueDate)
    if (item.startDate && item.dueDate && item.startDate > item.dueDate) throw new Error('结束日期不能早于开始日期')
    this.assertProject(item.projectId)
    if (item.trackingState === 'tracked' && !item.projectId) throw new Error('正式任务必须关联项目')
    if (item.parentId) {
      const parent = this.getItem(item.parentId)
      if (parent.parentId || parent.id === item.id) throw new Error('只支持一级子任务')
      if (parent.projectId !== item.projectId) throw new Error('子任务必须与父任务属于同一项目')
    }
    const entities = this.entities()
    for (const [kind,id] of [['goal',item.goalId],['milestone',item.milestoneId],['version',item.versionId]] as const) {
      if (id && !entities.some((entity) => entity.id === id && entity.kind === kind && entity.projectId === item.projectId)) throw new Error('目标、里程碑或版本不属于当前项目')
    }
    if (item.keyResultId && !this.keyResults().some(result=>result.id===item.keyResultId && result.projectId===item.projectId && result.goalId===item.goalId)) throw new Error('关键结果不属于当前项目或目标')
    if (item.parentId) {
      const parent=this.getItem(item.parentId)
      if (['goalId','keyResultId','milestoneId','versionId'].some(key=>item[key as keyof WorkScopeFields]!==parent[key as keyof WorkScopeFields])) throw new Error('子任务必须继承父任务归属')
    }
    this.validateDependencies(item)
  }
  private validateDependencies(item: ProjectWorkItem): void {
    const items = this.allItems().filter((work) => work.id !== item.id).concat(item), map = new Map(items.map((work) => [work.id,work]))
    for (const id of item.dependencyIds) {
      const target = map.get(id)
      const sameInbox = !item.projectId && item.trackingState === 'inbox' && target?.trackingState === 'inbox' && !target.projectId
      if (!target || target.id === item.id || (!item.projectId && !sameInbox) || target.projectId !== item.projectId || target.id === item.parentId || target.parentId === item.id) throw new Error('依赖必须是同项目中有效且非父子的其他任务')
    }
    assertAcyclicDependencies(items)
  }
  private persistItem(item: ProjectWorkItem): void {
    this.db().prepare('INSERT INTO project_work_items(id,project_id,parent_id,status,row_version,updated_at,data_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,parent_id=excluded.parent_id,status=excluded.status,row_version=excluded.row_version,updated_at=excluded.updated_at,data_json=excluded.data_json').run(item.id,item.projectId,item.parentId,item.status,item.rowVersion,item.updatedAt,JSON.stringify(item))
    this.db().prepare('DELETE FROM work_item_tags WHERE work_item_id=?').run(item.id)
    for (const tag of item.tags) this.db().prepare('INSERT INTO work_item_tags VALUES(?,?)').run(item.id,tag)
    this.db().prepare('DELETE FROM work_item_dependencies WHERE work_item_id=?').run(item.id)
    for (const id of item.dependencyIds) this.db().prepare('INSERT INTO work_item_dependencies VALUES(?,?)').run(item.id,id)
    for (const blocker of item.blockers) this.db().prepare('INSERT OR REPLACE INTO work_item_blockers VALUES(?,?,?)').run(blocker.id,item.id,JSON.stringify(blocker))
  }
  private event(entity: { id: string; projectId: string | null }, type: string, before: unknown, after: unknown, commandId: string, actorType: ProgressEvent['actorType'] = 'user', entityType: ProgressEvent['entityType'] = 'task'): void {
    const event: ProgressEvent = { id: uid('progress-event'), projectId: entity.projectId, entityId: entity.id, entityType, eventType: type, actorType, before, after, commandId, occurredAt: this.timestamp() }
    this.db().prepare('INSERT INTO progress_events VALUES(?,?,?,?,?)').run(event.id,event.entityId,event.projectId,event.occurredAt,JSON.stringify(event))
  }
  private newItem(input: { title: string; projectId?: string | null; parentId?: string | null } & Partial<ProjectWorkItem>): ProjectWorkItem {
    if (typeof input?.title !== 'string' || !input.title.trim()) throw new Error('请输入任务标题')
    const timestamp = this.timestamp(), parent = input.parentId ? this.getItem(input.parentId) : null
    return {
      id: uid('work-item'), projectId: parent?.projectId ?? input.projectId ?? null, parentId: parent?.id ?? null,
      sortOrder:parent?Math.max(-1,...this.allItems().filter(item=>item.parentId===parent.id).map(item=>item.sortOrder??0))+1:0,
      trackingState: (parent ? parent.trackingState : input.projectId ? 'tracked' : 'inbox'),
      goalId: parent ? parent.goalId : input.goalId ?? null, keyResultId: parent ? parent.keyResultId : input.keyResultId ?? null, milestoneId: parent ? parent.milestoneId : input.milestoneId ?? null, versionId: parent ? parent.versionId : input.versionId ?? null,
      title: input.title.trim(), description: input.description ?? '', acceptanceText: input.acceptanceText ?? '', status: 'todo', priority: input.priority ?? 'medium', ownerRef: input.ownerRef ?? '',
      startDate: input.startDate ?? null, dueDate: input.dueDate ?? null, tags: unique(input.tags ?? []), dependencyIds: [], blockers: [], origin: 'native', authority: 'native', completionBasis: null,
      startedAt: null, completedAt: null, cancelledAt: null, archivedAt: null, scopeRevision: 1, rowVersion: 1, createdAt: timestamp, updatedAt: timestamp
    }
  }

  command(command: ProgressCommand): ProgressCommandResult {
    if (!command || typeof command.commandId !== 'string' || !command.commandId.trim()) throw new Error('缺少命令 ID')
    const hash = fingerprint(command)
    const result = this.atomic(() => {
      const previous = this.db().prepare('SELECT * FROM progress_commands WHERE command_id=?').get(command.commandId) as Row | undefined
      if (previous) {
        if (previous.request_hash !== hash) throw new Error('相同命令 ID 的请求内容发生变化')
        return JSON.parse(String(previous.result_json)) as ProgressCommandResult
      }
      const result = this.executeCommand(command)
      this.db().prepare('INSERT INTO progress_commands VALUES(?,?,?)').run(command.commandId,hash,JSON.stringify(result))
      return result
    })
    this.changed(); return result
  }

  private executeCommand(command: ProgressCommand): ProgressCommandResult {
    if (command.type === 'save-entity') return { entityId: this.saveEntity(command) }
    if (command.type === 'save-key-result') return {entityId:this.saveKeyResult(command.input,command.expectedVersion,command.commandId)}
    if (command.type === 'measure-key-result' || command.type === 'transition-key-result') return {entityId:this.changeKeyResult(command)}
    if (command.type === 'set-progress-relations') return {entityId:this.setRelations(command)}
    if (command.type === 'upgrade-goal') return {entityId:this.upgradeGoal(command)}
    if (command.type === 'transition-entity') {
      if (!['accept','reopen','cancel','archive'].includes(command.action)) throw new Error('无效计划操作')
      const entity=this.entities().find(entity=>entity.id===command.id && entity.kind===command.kind)
      if (!entity) throw new Error('目标或计划不存在')
      const status=command.action==='accept'?(entity.kind==='version'?'closed':'achieved'):command.action==='cancel'?'cancelled':command.action==='archive'?'archived':entity.kind==='milestone'?'planned':'active'
      return {entityId:this.saveEntity({type:'save-entity',kind:entity.kind,commandId:command.commandId,expectedVersion:command.expectedVersion,input:{...entity,status}})}
    }
    if (command.type === 'apply-draft') return { entityId: this.applyDraft(command) }
    if (command.type === 'create') {
      const item = this.newItem(command.input)
      if (item.parentId) { const parent = this.getItem(item.parentId); this.assertEditable(parent); if (['done','cancelled'].includes(parent.status)) throw new Error('请先重新打开父任务再调整范围'); this.assertNoActiveRun(parent.id); parent.scopeRevision++; parent.rowVersion++; parent.updatedAt = this.timestamp(); this.persistItem(parent) }
      this.validateItem(item); this.persistItem(item); this.invalidateScopeAcceptance(item,command.commandId); this.event(item,'created',null,item,command.commandId)
      return { entityId: item.id }
    }
    const before = this.getItem(command.id), item = structuredClone(before)
    this.assertVersion(item,command.expectedVersion)
    if (!(command.type === 'transition' && command.action === 'unarchive')) this.assertEditable(item)
    if (command.type === 'save-draft') {
      const id = this.saveDraft(item,command.items,command.executionId ?? null)
      this.event(item,'plan-drafted',null,{draftId:id},command.commandId)
      return { entityId:id }
    }
    if (command.type === 'discard-draft') {
      const draft = this.drafts().find(draft => draft.id === command.draftId && draft.workItemId === item.id)
      if (!draft || draft.status !== 'draft' || draft.draftVersion !== command.draftVersion) throw new Error('草稿已变化，请刷新')
      draft.status = 'discarded'; draft.draftVersion++
      this.db().prepare('UPDATE task_plan_drafts SET data_json=? WHERE id=?').run(JSON.stringify(draft),draft.id)
      this.event(item,'plan-discarded',null,{draftId:draft.id},command.commandId)
      return {entityId:item.id}
    }
    if (command.type === 'update') {
      const keys = ['title','description','acceptanceText','priority','ownerRef','startDate','dueDate','tags'] as const
      for (const key of keys) if (command.patch[key] !== undefined) Object.assign(item,{ [key]: command.patch[key] })
      item.tags = unique(item.tags)
      if (item.acceptanceText !== before.acceptanceText || item.description !== before.description) {
        if (['done','cancelled'].includes(item.status)) throw new Error('请先重开任务再修改验收范围')
        this.assertNoActiveRun(item.id); item.scopeRevision++
      }
    } else if (command.type === 'move') {
      if (item.parentId) throw new Error('请移动整个父任务，子任务继承项目范围')
      if (['done','cancelled'].includes(item.status)) throw new Error('请先重开任务再调整归属与范围')
      this.assertNoActiveRun(item.id)
      const scope = { projectId:command.scope.projectId || null,goalId:command.scope.goalId || null,keyResultId:command.scope.keyResultId || null,milestoneId:command.scope.milestoneId || null,versionId:command.scope.versionId || null }
      Object.assign(item,scope,{ trackingState: scope.projectId ? 'tracked' : 'inbox',scopeRevision:item.scopeRevision+1 })
      this.persistItem(item)
      const children = this.allItems().filter(work => work.parentId === item.id)
      for (const child of children) {
        const old = structuredClone(child)
        Object.assign(child,scope,{ trackingState:item.trackingState,rowVersion:child.rowVersion+1,scopeRevision:child.scopeRevision+1,updatedAt:this.timestamp() })
        this.persistItem(child); this.event(child,'move',old,child,command.commandId)
      }
      for (const work of this.allItems()) this.validateItem(work)
    } else if (command.type === 'dependencies') {
      if (['done','cancelled'].includes(item.status)) throw new Error('请先重开任务再调整依赖')
      this.assertNoActiveRun(item.id)
      item.dependencyIds = unique(command.dependencyIds); item.scopeRevision++
    } else if (command.type === 'block') {
      if (!command.reason.trim()) throw new Error('请输入阻塞原因')
      if (['done','cancelled'].includes(item.status)) throw new Error('终态任务不能新增阻塞')
      item.blockers.push({ id: uid('blocker'), reason: command.reason.trim(), ownerRef: command.ownerRef ?? '', nextAction: command.nextAction ?? '', createdAt: this.timestamp(), resolvedAt: null, resolution: '' })
    } else if (command.type === 'unblock') {
      const blocker = item.blockers.find((block) => block.id === command.blockerId)
      if (!blocker || blocker.resolvedAt) throw new Error('阻塞记录不存在或已解除')
      blocker.resolvedAt = this.timestamp(); blocker.resolution = command.resolution
    } else if (command.type === 'transition') this.transition(item,command.action,command.reason ?? '',command.commandId)
    else throw new Error('无效的项目进度命令')
    item.rowVersion++; item.updatedAt = this.timestamp(); this.validateItem(item)
    // A project move must not strand incoming dependencies in another project.
    for (const work of this.allItems().filter((work) => work.dependencyIds.includes(item.id))) if (work.projectId !== item.projectId) throw new Error('请先处理其他任务对此任务的依赖，再移动项目')
    this.persistItem(item)
    if (command.type==='move' && before.status!=='done') this.invalidateScopeAcceptance(before,command.commandId)
    if (item.parentId && (item.scopeRevision !== before.scopeRevision || item.title !== before.title)) {
      const parent = this.getItem(item.parentId)
      parent.scopeRevision++; parent.rowVersion++; parent.updatedAt = this.timestamp(); this.persistItem(parent)
    }
    if (item.status !== 'done' && item.status !== 'cancelled') this.invalidateScopeAcceptance(item,command.commandId)
    this.event(item,command.type === 'transition' ? command.action : command.type,before,item,command.commandId)
    return { entityId: item.id }
  }

  private transition(item: ProjectWorkItem, action: string, reason: string, commandId: string): void {
    const terminal = ['done','cancelled'].includes(item.status), timestamp = this.timestamp()
    if (action === 'unarchive') { if (item.authority !== 'native') throw new Error('外部任务不能直接编辑'); item.archivedAt = null; return }
    if (action === 'archive') { if (!terminal) throw new Error('只能归档已完成或已取消的任务'); item.archivedAt = timestamp; return }
    if (item.parentId) {
      const parent = this.getItem(item.parentId)
      if (parent.archivedAt || ['done','cancelled'].includes(parent.status)) throw new Error('请先恢复并重开父任务，再调整节点状态')
    }
    if (action === 'reopen') {
      if (!terminal) throw new Error('仅终态任务可以重开')
      this.assertNoActiveRun(item.id)
      item.status = 'todo'; item.completedAt = null; item.cancelledAt = null; item.completionBasis = null; item.scopeRevision++
    } else {
      if (terminal) throw new Error('请先重新打开任务')
      if (action === 'start') { if (item.status !== 'todo') throw new Error('仅待办任务可以开始'); item.status = 'doing'; item.startedAt ??= timestamp }
      else if (action === 'review') item.status = 'review'
      else if (action === 'cancel') {
        this.assertNoActiveRun(item.id); item.status = 'cancelled'; item.cancelledAt = timestamp
        for (const child of this.allItems().filter((work) => work.parentId === item.id && !['done','cancelled'].includes(work.status))) {
          const before = structuredClone(child); child.status = 'cancelled'; child.cancelledAt = timestamp; child.rowVersion++; child.updatedAt = timestamp
          this.persistItem(child); this.event(child,'cancel',before,child,commandId)
        }
      } else if (action === 'accept') {
        this.assertNoActiveRun(item.id)
        if (this.allItems().some((work) => work.parentId === item.id && !['done','cancelled'].includes(work.status))) throw new Error('仍有未完成的子任务，请先完成或取消节点')
        if (isWorkBlocked(item,this.allItems())) throw new Error('仍有阻塞或未满足的依赖，请先处理')
        item.status = 'done'; item.completedAt = timestamp; item.completionBasis = 'manual_acceptance'
      } else throw new Error('无效状态操作')
    }
    if (action === 'accept' || action === 'reopen') this.db().prepare('INSERT INTO work_item_acceptances VALUES(?,?,?,?,?,?)').run(uid('acceptance'),item.id,action,item.scopeRevision,timestamp,JSON.stringify({ reason,actor: 'user',commandId }))
  }

  private saveEntity(command: Extract<ProgressCommand,{type:'save-entity'}>): string {
    const { input,kind } = command, table = entityTables[kind]
    if (!table || typeof input.title!=='string' || !input.title.trim()) throw new Error('请输入有效的目标或计划名称')
    if (!input.projectId) throw new Error('目标与计划必须关联项目')
    this.assertProject(input.projectId)
    const old = input.id ? this.entities().find((entity) => entity.id === input.id && entity.kind === kind) : undefined
    if (input.id && !old) throw new Error('目标或计划不存在')
    if (old) { this.assertVersion(old,command.expectedVersion ?? -1); if (old.projectId !== input.projectId) throw new Error('目标与计划不能跨项目移动') }
    const statuses = kind === 'goal' ? ['draft','active','achieved','cancelled'] : kind === 'milestone' ? ['planned','achieved','cancelled'] : ['planned','active','closed','archived','cancelled']
    const status = input.status ?? old?.status ?? (kind === 'goal' ? 'active' : 'planned')
    if (!statuses.includes(status)) throw new Error('无效计划状态')
    if (old && ['cancelled','archived'].includes(old.status) && ['achieved','closed'].includes(status)) throw new Error('请先显式重开目标或计划再验收')
    if (kind === 'version' && this.entities().some((entity) => entity.id !== old?.id && entity.kind === kind && entity.projectId === input.projectId && entity.title === input.title.trim())) throw new Error('项目内版本名称不能重复')
    const entity: ProgressEntity = { id: old?.id ?? uid(kind), kind, projectId: input.projectId, title: input.title.trim(), description: input.description ?? old?.description ?? '', criteriaText: input.criteriaText ?? old?.criteriaText ?? '', ownerRef: input.ownerRef ?? old?.ownerRef ?? '', targetDate: date(input.targetDate === undefined ? old?.targetDate : input.targetDate), status, completedAt: old?.completedAt ?? null, rowVersion: (old?.rowVersion ?? 0)+1, createdAt: old?.createdAt ?? this.timestamp(), updatedAt: this.timestamp(), ...(kind==='goal'?{progressMode:old?.progressMode??'key_results'}:{}) }
    if ([entity.description,entity.criteriaText,entity.ownerRef].some(value=>typeof value!=='string')) throw new Error('目标资料必须为文本')
    if (old && ['achieved','closed','archived','cancelled'].includes(old.status) && (entity.criteriaText!==old.criteriaText || entity.description!==old.description)) throw new Error('请先重开目标或计划再修改验收范围')
    if (['achieved','closed'].includes(status)) {
      this.assertEntityReady(entity)
      entity.completedAt ??= this.timestamp()
    } else if (status !== 'archived') entity.completedAt = null
    this.db().prepare(`INSERT INTO ${table} VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET row_version=excluded.row_version,data_json=excluded.data_json`).run(entity.id,entity.projectId,entity.rowVersion,JSON.stringify(entity))
    this.event(entity,'saved',old ?? null,entity,command.commandId,'user',kind)
    if (old && old.status!==entity.status && !['achieved','closed','archived'].includes(entity.status)) this.invalidateDelivery(entity.id,command.commandId)
    return entity.id
  }

  private assertEntityReady(entity: ProgressEntity): void {
    if (entity.kind==='goal' && entity.progressMode==='key_results') {
      const results=this.keyResults().filter(result=>result.goalId===entity.id && result.status!=='cancelled')
      if (!results.length || results.some(result=>result.status!=='achieved')) throw new Error('关键结果尚未定义或尚未全部验收')
      return
    }
    if (!calculateDeliveryProgress(entity,this.allItems(),this.keyResults(),this.entities(),this.relations()).readyForAcceptance) throw new Error('尚有未验收工作或检查点，或尚未关联任务／关键结果，不能确认达成')
  }
  private persistEntity(entity:ProgressEntity):void {
    this.db().prepare(`UPDATE ${entityTables[entity.kind]} SET row_version=?,data_json=? WHERE id=?`).run(entity.rowVersion,JSON.stringify(entity),entity.id)
  }
  private reopenEntity(entity:ProgressEntity,commandId:string):void {
    if (!['achieved','closed'].includes(entity.status)) return
    const before=structuredClone(entity)
    entity.status=entity.kind==='milestone'?'planned':'active';entity.completedAt=null;entity.rowVersion++;entity.updatedAt=this.timestamp()
    this.persistEntity(entity);this.event(entity,'scope-reopened',before,entity,commandId,'system',entity.kind)
    this.invalidateDelivery(entity.id,commandId)
  }
  private invalidateDelivery(targetId:string,commandId:string):void {
    for (const relation of this.relations().filter(link=>link.targetId===targetId)) {
      const entity=this.entities().find(entity=>entity.id===relation.sourceId)
      if (entity) this.reopenEntity(entity,commandId)
    }
  }
  private getKeyResult(id:string):ProgressKeyResult {
    const result=this.keyResults().find(result=>result.id===id)
    if (!result) throw new Error('关键结果不存在')
    return result
  }
  private editableGoal(id:string):ProgressEntity {
    const goal=this.entities().find(entity=>entity.id===id && entity.kind==='goal')
    if (!goal) throw new Error('目标不存在')
    this.assertProject(goal.projectId)
    if (goal.progressMode!=='key_results') throw new Error('请先预览并升级旧目标')
    if (['achieved','cancelled'].includes(goal.status)) throw new Error('请先重开目标再调整关键结果')
    return goal
  }
  private persistKeyResult(result:ProgressKeyResult):void {
    this.db().prepare('INSERT INTO project_key_results VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET row_version=excluded.row_version,data_json=excluded.data_json').run(result.id,result.projectId,result.goalId,result.rowVersion,JSON.stringify(result))
  }
  private saveKeyResult(input:KeyResultInput,expectedVersion:number|undefined,commandId:string):string {
    const goal=this.editableGoal(input.goalId)
    if (goal.projectId!==input.projectId) throw new Error('关键结果不属于当前项目或目标')
    const old=input.id?this.getKeyResult(input.id):undefined
    if (old) {
      this.assertVersion(old,expectedVersion??-1)
      if (old.goalId!==input.goalId || old.projectId!==input.projectId) throw new Error('关键结果不能跨目标移动')
      if (old.status!=='active') throw new Error('请先重开关键结果再修改')
      if (input.currentValue!==undefined && input.currentValue!==old.currentValue) throw new Error('请通过记录测量更新当前值')
    }
    const result:ProgressKeyResult={id:old?.id??uid('key-result'),projectId:input.projectId,goalId:input.goalId,title:input.title,measurement:input.measurement,criteriaText:input.criteriaText??old?.criteriaText??'',ownerRef:input.ownerRef??old?.ownerRef??'',targetDate:date(input.targetDate===undefined?old?.targetDate:input.targetDate),baselineValue:input.baselineValue??old?.baselineValue??null,currentValue:old?.currentValue??input.currentValue??input.baselineValue??null,targetValue:input.targetValue??old?.targetValue??null,direction:input.direction??old?.direction??'increase',unit:input.unit??old?.unit??'',status:'active',evidence:old?.evidence??'',completedAt:null,rowVersion:(old?.rowVersion??0)+1,createdAt:old?.createdAt??this.timestamp(),updatedAt:this.timestamp()}
    if ([result.title,result.criteriaText,result.ownerRef,result.unit].some(value=>typeof value!=='string') || !result.title.trim() || !result.criteriaText.trim()) throw new Error('请填写关键结果名称和验收条件')
    result.title=result.title.trim()
    if (!['numeric','deliverable'].includes(result.measurement)) throw new Error('无效衡量类型')
    if (!['increase','decrease'].includes(result.direction)) throw new Error('无效指标方向')
    if (result.measurement==='numeric' && (![result.baselineValue,result.currentValue,result.targetValue].every(value=>typeof value==='number' && Number.isFinite(value)) || (result.direction==='increase'?result.targetValue!<=result.baselineValue!:result.targetValue!>=result.baselineValue!))) throw new Error('数值必须有限，且目标值须符合上升／下降方向并不同于基线')
    if (result.measurement==='deliverable') {result.baselineValue=null;result.currentValue=null;result.targetValue=null}
    this.persistKeyResult(result);this.event(result,'key-result-saved',old??null,result,commandId,'user','key_result')
    return result.id
  }
  private changeKeyResult(command:Extract<ProgressCommand,{type:'measure-key-result'|'transition-key-result'}>):string {
    const result=this.getKeyResult(command.id),before=structuredClone(result)
    this.assertProject(result.projectId)
    this.assertVersion(result,command.expectedVersion)
    if (typeof command.evidence!=='string' || !command.evidence.trim()) throw new Error('请填写测量、验收或调整依据')
    if (command.type==='measure-key-result') {
      this.editableGoal(result.goalId)
      if (result.status!=='active' || result.measurement!=='numeric') throw new Error('请先重开数值型关键结果再记录测量')
      if (typeof command.value!=='number' || !Number.isFinite(command.value)) throw new Error('测量必须是有限数值')
      result.currentValue=command.value
    } else if (command.action==='reopen') {
      if (result.status==='active') throw new Error('关键结果已经进行中')
      result.status='active';result.completedAt=null
      const goal=this.entities().find(entity=>entity.id===result.goalId)
      if (goal?.status==='cancelled') throw new Error('请先重开目标')
      if (goal) this.reopenEntity(goal,command.commandId)
      this.invalidateDelivery(result.id,command.commandId)
    } else {
      this.editableGoal(result.goalId)
      if (result.status!=='active') throw new Error('请先重开关键结果')
      if (command.action==='accept') {
        if (result.measurement==='numeric' && !keyResultReached(result)) throw new Error('指标尚未达标，不能验收')
        result.status='achieved';result.completedAt=this.timestamp()
      } else if (command.action==='cancel') {result.status='cancelled';this.invalidateDelivery(result.id,command.commandId)}
      else throw new Error('无效关键结果操作')
    }
    result.evidence=command.evidence.trim();result.rowVersion++;result.updatedAt=this.timestamp();this.persistKeyResult(result)
    this.event(result,command.type==='measure-key-result'?'key-result-measured':`key-result-${command.action}`,before,result,command.commandId,'user','key_result')
    return result.id
  }
  private setRelations(command:Extract<ProgressCommand,{type:'set-progress-relations'}>):string {
    if (!['milestone_result','version_milestone'].includes(command.kind)) throw new Error('无效交付关系')
    const kind=command.kind==='milestone_result'?'milestone':'version'
    const entity=this.entities().find(entity=>entity.id===command.id && entity.kind===kind)
    if (!entity) throw new Error('计划不存在')
    this.assertProject(entity.projectId)
    this.assertVersion(entity,command.expectedVersion)
    if (!['active','planned'].includes(entity.status)) throw new Error('请先重开计划再调整范围')
    const ids=unique(command.targetIds),targets=command.kind==='milestone_result'?this.keyResults():this.entities().filter(entity=>entity.kind==='milestone')
    if (ids.some(id=>!targets.some(target=>target.id===id && target.projectId===entity.projectId))) throw new Error('关联对象不存在或不属于当前项目')
    const before=this.relations().filter(link=>link.sourceId===entity.id)
    this.db().prepare('DELETE FROM progress_relations WHERE source_id=? AND kind=?').run(entity.id,command.kind)
    for (const id of ids) this.db().prepare('INSERT INTO progress_relations VALUES(?,?,?,?)').run(command.kind,entity.projectId,entity.id,id)
    entity.rowVersion++;entity.updatedAt=this.timestamp();this.persistEntity(entity)
    this.event(entity,'relations-changed',before,this.relations().filter(link=>link.sourceId===entity.id),command.commandId,'user',entity.kind)
    this.invalidateDelivery(entity.id,command.commandId)
    return entity.id
  }
  private upgradeGoal(command:Extract<ProgressCommand,{type:'upgrade-goal'}>):string {
    const goal=this.entities().find(entity=>entity.id===command.id && entity.kind==='goal')
    if (!goal) throw new Error('目标不存在')
    this.assertProject(goal.projectId)
    this.assertVersion(goal,command.expectedVersion)
    if (goal.progressMode!=='legacy_tasks') throw new Error('目标已使用关键结果，无需重复升级')
    if (goal.status==='cancelled') throw new Error('请先重开目标')
    if (!Array.isArray(command.keyResults) || !command.keyResults.length) throw new Error('至少定义一个有效关键结果')
    const before=structuredClone(goal)
    goal.progressMode='key_results';goal.status=goal.status==='achieved'?'active':goal.status;goal.completedAt=null;goal.rowVersion++;goal.updatedAt=this.timestamp();this.persistEntity(goal)
    for (const input of command.keyResults) {
      if (input.id || input.goalId!==goal.id || input.projectId!==goal.projectId) throw new Error('升级结果必须是属于当前目标的新记录')
      this.saveKeyResult(input,undefined,command.commandId)
    }
    this.event(goal,'goal-upgraded',before,goal,command.commandId,'user','goal')
    return goal.id
  }

  getHistory(query:ProgressHistoryQuery):ProgressHistoryPage {
    if (!query?.object || typeof query.object.id!=='string') throw new Error('缺少历史对象')
    const {kind,id}=query.object
    const target=kind==='task'?this.getItem(id):kind==='key_result'?this.getKeyResult(id):this.entities().find(entity=>entity.id===id && entity.kind===kind)
    if (!target || (query.projectId!==undefined && target.projectId!==query.projectId)) throw new Error('历史对象不存在或不属于当前项目')
    const cursor=query.cursor===undefined?Number.MAX_SAFE_INTEGER:Number(query.cursor)
    if (!Number.isSafeInteger(cursor) || cursor<=0) throw new Error('无效历史游标')
    const limit=Math.max(1,Math.min(100,Number.isFinite(query.limit)?Math.floor(query.limit!):30))
    const rows=this.db().prepare('SELECT rowid AS sequence,data_json FROM progress_events WHERE entity_id=? AND rowid<? AND json_extract(data_json,\'$.entityType\')=? ORDER BY rowid DESC LIMIT ?').all(id,cursor,kind,limit+1) as Row[]
    return {events:rows.slice(0,limit).map(row=>json<ProgressEvent>(row)),nextCursor:rows.length>limit?String(rows[limit-1].sequence):null}
  }

  private invalidateScopeAcceptance(item: ProjectWorkItem, commandId: string): void {
    if (item.trackingState !== 'tracked') return
    for (const entity of this.entities().filter(entity => [item.goalId,item.milestoneId,item.versionId].includes(entity.id) && !(entity.kind==='goal' && entity.progressMode==='key_results'))) this.reopenEntity(entity,commandId)
  }
  private executions(): ProgressExecution[] { return this.db().prepare('SELECT data_json FROM task_executions ORDER BY rowid').all().map((row) => json<ProgressExecution>(row)) }
  private drafts(): ProgressPlanDraft[] { return this.db().prepare('SELECT data_json FROM task_plan_drafts').all().map((row) => json<ProgressPlanDraft>(row)) }
  private saveDraft(item: ProjectWorkItem, items: ProgressPlanItem[], executionId: string | null): string {
    if (item.parentId || ['done','cancelled'].includes(item.status)) throw new Error('请在非终态父任务上编辑计划')
    if (executionId && this.getExecution(executionId).workItemId !== item.id) throw new Error('计划执行记录不属于当前任务')
    if (!items.length || items.some((node) => !node.id || !node.title.trim()) || new Set(items.map((node) => node.id)).size !== items.length) throw new Error('计划节点需有唯一 ID 和标题')
    const ids = new Set(items.map((node) => node.id))
    for (const node of items) if (node.dependencyIds.some((id) => !ids.has(id) || id === node.id)) throw new Error('计划依赖必须引用其他有效节点')
    const visiting = new Set<string>(), visited = new Set<string>()
    const visit = (id: string): void => { if (visiting.has(id)) throw new Error('计划依赖不能形成循环'); if (visited.has(id)) return; visiting.add(id); for (const dep of items.find((node) => node.id === id)?.dependencyIds ?? []) visit(dep); visiting.delete(id); visited.add(id) }
    for (const id of ids) visit(id)
    for (const node of items) if (node.existingWorkItemId && this.getItem(node.existingWorkItemId).parentId !== item.id) throw new Error('计划引用的既有节点不属于当前任务')
    const draft: ProgressPlanDraft = { id: uid('plan'), workItemId: item.id, executionId, baseScopeRevision: item.scopeRevision, draftVersion: 1, items, status: 'draft', createdAt: this.timestamp(), appliedAt: null }
    this.db().prepare('INSERT INTO task_plan_drafts VALUES(?,?,?)').run(draft.id,item.id,JSON.stringify(draft))
    return draft.id
  }
  private applyDraft(command: Extract<ProgressCommand,{type:'apply-draft'}>): string {
    const draft = this.drafts().find((plan) => plan.id === command.draftId)
    if (!draft || draft.status !== 'draft' || draft.draftVersion !== command.draftVersion) throw new Error('计划已应用或已失效')
    const parent = this.getItem(draft.workItemId)
    this.assertVersion(parent,command.expectedVersion); this.assertEditable(parent); this.assertNoActiveRun(parent.id)
    if (parent.scopeRevision !== draft.baseScopeRevision || ['done','cancelled'].includes(parent.status)) throw new Error('任务范围已变化，请重新确认计划')
    const previous = this.allItems().filter((item) => item.parentId === parent.id)
    const previousById = new Map(previous.map(item => [item.id,structuredClone(item)])), parentBefore = structuredClone(parent)
    const mapped = new Map<string,string>()
    for (const node of draft.items) mapped.set(node.id,node.existingWorkItemId ?? uid('work-item'))
    if (new Set(mapped.values()).size !== mapped.size) throw new Error('一个既有节点不能重复映射')
    // Preserve removed work and its evidence as cancelled scope, never DELETE it.
    for (const item of previous.filter((work) => ![...mapped.values()].includes(work.id) && work.status !== 'cancelled')) {
      if (item.status === 'done') throw new Error('已验收节点不能被重新规划移除，请显式调整范围')
      const before = structuredClone(item); item.status = 'cancelled'; item.cancelledAt = this.timestamp(); item.rowVersion++; item.updatedAt = this.timestamp(); this.persistItem(item); this.event(item,'plan-removed',before,item,command.commandId)
    }
    for (const [index,node] of draft.items.entries()) {
      const before = node.existingWorkItemId ? this.getItem(node.existingWorkItemId) : null
      if (before?.status === 'cancelled') throw new Error('请先显式重开已取消节点再纳入计划')
      if (before?.status === 'done' && (node.description !== before.description || node.acceptanceText !== before.acceptanceText || canonical(node.dependencyIds.map(id => mapped.get(id))) !== canonical(before.dependencyIds))) throw new Error('请先重开已完成节点再修改范围')
      const item = before ? structuredClone(before) : this.newItem({ title: node.title, parentId: parent.id })
      item.id = mapped.get(node.id)!; item.title = node.title.trim(); item.description = node.description; item.acceptanceText = node.acceptanceText
      item.sortOrder = index
      const scopeChanged = before && (before.description !== node.description || before.acceptanceText !== node.acceptanceText || canonical(before.dependencyIds) !== canonical(node.dependencyIds.map(id => mapped.get(id))))
      item.dependencyIds = []; item.rowVersion += before ? 1 : 0; item.scopeRevision += scopeChanged ? 1 : 0; item.updatedAt = this.timestamp(); this.persistItem(item)
    }
    for (const node of draft.items) { const item = this.getItem(mapped.get(node.id)!); item.dependencyIds = node.dependencyIds.map((id) => mapped.get(id)!); this.validateItem(item); this.persistItem(item); this.event(item,'plan-applied',previousById.get(item.id) ?? null,item,command.commandId) }
    parent.scopeRevision++; parent.rowVersion++; parent.updatedAt = this.timestamp(); this.persistItem(parent)
    this.invalidateScopeAcceptance(parent,command.commandId); this.event(parent,'plan-applied',parentBefore,{...parent,draftId:draft.id},command.commandId)
    draft.status = 'applied'; draft.appliedAt = this.timestamp(); this.db().prepare('UPDATE task_plan_drafts SET data_json=? WHERE id=?').run(JSON.stringify(draft),draft.id)
    return parent.id
  }

  getSnapshot(query: ProgressSnapshotQuery = {}): ProjectProgressSnapshot {
    const asOf = query.asOf ?? this.timestamp(), timezone = query.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    progressToday(asOf,timezone)
    const archivedProjects = new Set(query.projectId || query.includeArchivedProjects ? [] : this.db().prepare('SELECT * FROM projects').all().filter(row => !!(row as Row).archived_at).map(row => String((row as Row).id)))
    const visibleProject = (id: string | null) => query.projectId ? id === query.projectId : !id || !archivedProjects.has(id)
    const items = this.allItems().filter((item) => visibleProject(item.projectId))
    const projectIds=new Set(this.db().prepare('SELECT id FROM projects').all().map(row=>String((row as Row).id)))
    const entities = this.entities().filter((entity) => projectIds.has(entity.projectId) && visibleProject(entity.projectId))
    const entityIds=new Set(entities.map(entity=>entity.id))
    const keyResults=this.keyResults().filter(result=>entityIds.has(result.goalId))
    const resultIds=new Set(keyResults.map(result=>result.id))
    const relations=this.relations().filter(link=>entityIds.has(link.sourceId) && (entityIds.has(link.targetId)||resultIds.has(link.targetId)))
    const today=progressToday(asOf,timezone)
    const keyResultStats=Object.fromEntries(keyResults.map(result=>[result.id,{percent:Math.round(keyResultPercent(result)),readyForAcceptance:result.status==='active' && keyResultReached(result),support:calculateProjectProgress(items,asOf,timezone,result.id)}]))
    const goalStats=Object.fromEntries(entities.filter(entity=>entity.kind==='goal').map(goal=>{
      const results=keyResults.filter(result=>result.goalId===goal.id && result.status!=='cancelled'),support=calculateProjectProgress(items,asOf,timezone,goal.id)
      return [goal.id,{total:results.length,achieved:results.filter(result=>result.status==='achieved').length,percent:goal.progressMode==='legacy_tasks'?support.percent:results.length?Math.round(results.reduce((sum,result)=>sum+keyResultPercent(result),0)/results.length):null,readyForAcceptance:goal.progressMode==='legacy_tasks'?support.rootTasks>0 && items.filter(item=>!item.parentId && item.goalId===goal.id && item.status!=='cancelled').every(item=>item.status==='done'):results.length>0 && results.every(result=>result.status==='achieved'),unfinishedTasks:items.filter(item=>!item.parentId && item.goalId===goal.id && !['done','cancelled'].includes(item.status)).length,overdue:results.filter(result=>result.status!=='achieved' && result.targetDate && result.targetDate<today).length,blocked:support.blocked}]
    }))
    const ids = new Set(items.map((item) => item.id))
    const migration = this.latestMigration()
    return {
      active: this.isActive(), items, entities, keyResults,relations,goalStats,keyResultStats,deliveryStats:Object.fromEntries(entities.filter(entity=>entity.kind!=='goal').map(entity=>[entity.id,calculateDeliveryProgress(entity,items,keyResults,entities,relations)])), executions: this.executions().filter((run) => ids.has(run.workItemId)), drafts: this.drafts().filter((draft) => ids.has(draft.workItemId)),
      events: this.db().prepare('SELECT data_json FROM progress_events ORDER BY occurred_at DESC,rowid DESC LIMIT 500').all().map((row) => json<ProgressEvent>(row)).filter((event) => visibleProject(event.projectId)),
      sourceLinks:this.db().prepare('SELECT * FROM work_item_source_links').all().map(row=>row as Row).filter(row=>ids.has(String(row.work_item_id))).map(row=>({sourceSystem:String(row.source_system),sourceScope:String(row.source_scope),sourceType:String(row.source_type),sourceId:String(row.source_id),workItemId:String(row.work_item_id)})),
      stats: calculateProjectProgress(items,asOf,timezone,query.scopeId), scopeStats: Object.fromEntries([...entities,...keyResults].map((entity) => [entity.id,calculateProjectProgress(items,asOf,timezone,entity.id)])), migration, asOf, timezone
    }
  }

  private source(system: string, type: string, id: string): string | null {
    return str((this.db().prepare("SELECT work_item_id FROM work_item_source_links WHERE source_system=? AND source_scope='local' AND source_type=? AND source_id=?").get(system,type,id) as Row | undefined)?.work_item_id) || null
  }
  private linkSource(system: string, type: string, id: string, workItemId: string): void {
    const previous = this.source(system,type,id)
    if (previous && previous !== workItemId) throw new Error('来源已关联其他业务任务，不能重复导入')
    this.db().prepare("INSERT OR IGNORE INTO work_item_source_links VALUES(?,'local',?,?,?)").run(system,type,id,workItemId)
  }
  private hasProject(id: unknown): id is string { return typeof id === 'string' && !!id && !!this.db().prepare('SELECT id FROM projects WHERE id=?').get(id) }

  private buildMigration(legacyRaw: string | null, managed: LegacyProgressManagedTask[]): {
    records: Array<{ item: ProjectWorkItem; sources: Array<[string,string,string]>; managed?: LegacyProgressManagedTask }>
    issues: MigrationIssue[]; legacyCount: number; duplicateCount: number
  } {
    const issues: MigrationIssue[] = [], records: Array<{ item: ProjectWorkItem; sources: Array<[string,string,string]>; managed?: LegacyProgressManagedTask }> = []
    let legacy: Row[] = []
    if (legacyRaw) {
      try {
        const parsed: unknown = JSON.parse(legacyRaw)
        if (!Array.isArray(parsed)) throw new Error('旧存储不是任务数组')
        legacy = parsed as Row[]
      } catch (error) { issues.push({ sourceId: 'legacy-storage', severity: 'error', message: `旧待办无法解析：${error instanceof Error ? error.message : String(error)}。原文将保留。` }) }
    }
    const readDate = (value: unknown, sourceId: string): string | null => {
      if (!value) return null
      try { return date(value) } catch {
        if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
          issues.push({ sourceId,severity: 'warning',message: '历史时间戳按当前时区转换为计划日期，原值保存在快照中' })
          return progressToday(value,Intl.DateTimeFormat().resolvedOptions().timeZone)
        }
        issues.push({ sourceId,severity:'error',message:'历史计划日期无效，请先核对源数据' }); return null
      }
    }
    const executed = (task: LegacyProgressManagedTask): boolean => !!task.branch || !!task.commitSha || task.events.some((event) => ['branching','merging','pushing'].includes(event.stage) || task.source !== 'codex-import' && event.stage === 'executing')
    const status = (task: LegacyProgressManagedTask): WorkStatus => ['codex-complete','awaiting-review','awaiting-commit','awaiting-target','merging','merged','pushing','completed','completed-no-changes'].includes(task.stage) ? 'review' : executed(task) || ['branching','executing'].includes(task.stage) ? 'doing' : 'todo'
    let duplicateCount = 0
    const used = new Set<string>(), legacyIds = new Set<string>()
    const importRoot = (old: Row | undefined, task: LegacyProgressManagedTask | undefined): void => {
      const sourceId = task?.id ?? str(old?.id)
      if (!sourceId.trim() || !(str(old?.title).trim() || task?.title.trim())) { issues.push({ sourceId,severity:'error',message:'历史任务缺少 ID 或标题' }); return }
      if (old && !['todo','doing','done'].includes(str(old.status))) { issues.push({ sourceId,severity:'error',message:'历史人工任务状态无效' }); return }
      if (old?.subtasks !== undefined && !Array.isArray(old.subtasks)) issues.push({sourceId,severity:'error',message:'历史子任务字段不是数组，不能静默丢弃'})
      const projectId = this.hasProject(task?.projectId || old?.projectId) ? str(task?.projectId || old?.projectId) : null
      const item = this.newItem({ title: str(old?.title).trim() || task?.title || '', projectId })
      item.id = (old ? this.source('legacy','task',str(old.id)) : null) ?? (task ? this.source('managed','task',task.id) : null) ?? item.id
      const laterManagedEdit = task && old && task.updatedAt > str(old.updatedAt) && executed(task)
      item.title = laterManagedEdit ? task.title : str(old?.title).trim() || task?.title || item.title
      item.description = laterManagedEdit ? task.description : str(old?.notes) || task?.description || ''
      item.origin = old || task?.source === 'legacy' ? 'legacy_todo' : 'managed_task'
      item.createdAt = str(old?.createdAt) || task?.createdAt || item.createdAt
      item.updatedAt = [str(old?.updatedAt),task?.updatedAt ?? '',item.createdAt].sort().at(-1)!
      item.priority = ['low','medium','high'].includes(str(old?.priority)) ? old!.priority as ProjectWorkItem['priority'] : 'medium'
      item.tags = Array.isArray(old?.tags) ? unique(old.tags.filter((tag): tag is string => typeof tag === 'string')) : []
      item.startDate = readDate(old?.startDate,sourceId); item.dueDate = readDate(old?.dueDate,sourceId)
      if (item.startDate && item.dueDate && item.startDate > item.dueDate) issues.push({ sourceId,severity:'error',message:'历史开始日期晚于结束日期' })
      const manualDone = old?.status === 'done' && !laterManagedEdit || !old && task?.source === 'legacy' && !executed(task) && task.events.some((event) => event.message.includes('历史任务') && event.message.includes('已完成'))
      item.status = manualDone ? 'done' : task ? status(task) : old?.status as WorkStatus || 'todo'
      item.completionBasis = manualDone ? 'legacy_user_marked' : null
      item.completedAt = manualDone ? str(old?.completedAt) || task?.finishedAt || item.updatedAt : null
      const candidate = task?.source === 'codex-import' && !executed(task) && !task.subtasks.length
      if (candidate) item.origin = 'ai_conversation'
      if (!projectId || candidate) item.trackingState = 'inbox'
      if (task && !candidate && (task.runStatus === 'running' || ['planning','branching','executing','merging','pushing'].includes(task.stage))) issues.push({ sourceId,severity:'error',message:'此任务仍有运行中的执行，请在历史 AI 入口核对或停止后重新预览' })
      if (task?.source === 'legacy' && !old) issues.push({ sourceId,severity:'warning',message:'缺少原始待办快照，历史日期、标签等无法恢复的字段保留为空，原托管记录完整保存' })
      if (task && ['completed','completed-no-changes'].includes(task.stage) && !manualDone) issues.push({ sourceId,severity:'warning',message:'旧 AI 自动完成保留为运行历史，业务状态调整为待验收' })
      if (old && task) duplicateCount++
      const sources: Array<[string,string,string]> = []
      if (old) sources.push(['legacy','task',str(old.id)])
      if (task) { sources.push(['managed','task',task.id]); used.add(task.id) }
      records.push({ item,sources,managed: task })
      const oldChildren = Array.isArray(old?.subtasks) ? old.subtasks.filter((child): child is Row => {
        const valid = !!child && typeof child === 'object' && !Array.isArray(child) && typeof child.id === 'string' && !!child.id
        if (!valid) issues.push({sourceId,severity:'error',message:'历史子任务缺少有效 ID 或记录已损坏'})
        return valid
      }) : []
      if (new Set(oldChildren.map(child => child.id)).size !== oldChildren.length) issues.push({sourceId,severity:'error',message:'历史子任务包含重复 ID'})
      const children: Array<{ old?: Row; managed?: LegacyProgressManagedTask['subtasks'][number]; id: string }> = oldChildren.map((child,index) => ({ old: child, managed: task?.subtasks.find((node) => node.id === str(child.id)), id: str(child.id) || `${sourceId}:node:${index}` }))
      for (const child of task?.subtasks ?? []) if (!children.some((node) => node.managed?.id === child.id)) children.push({ managed: child,id: child.id })
      const childIdMap = new Map<string,string>(), pending: Array<{ item: ProjectWorkItem; deps: string[] }> = []
      for (const [index,child] of children.entries()) {
        const node = { ...structuredClone(item), id: this.source(child.old ? 'legacy' : 'managed','subtask',child.id) ?? uid('work-item'), parentId: item.id,
          sortOrder: child.managed?.order ?? index,
          title: str(child.old?.title) || child.managed?.title || '', description: child.managed?.description ?? '', acceptanceText: child.managed?.acceptance ?? '',
          createdAt: str(child.old?.createdAt) || child.managed?.createdAt || item.createdAt, updatedAt: str(child.old?.updatedAt) || child.managed?.updatedAt || item.updatedAt,
          tags: [], startDate: null, dueDate: null, completionBasis: null, completedAt: null, archivedAt: null, blockers: [], dependencyIds: [] } as ProjectWorkItem
        const done = child.old?.done === true || manualDone && child.managed?.stage === 'completed'
        node.status = done ? 'done' : child.managed ? ['completed','codex-complete','completed-no-changes'].includes(child.managed.stage) ? 'review' : child.managed.runStatus === 'running' ? 'doing' : 'todo' : 'todo'
        node.completionBasis = done ? 'legacy_user_marked' : null; node.completedAt = done ? str(child.old?.completedAt) || node.updatedAt : null
        if (!node.title.trim()) issues.push({ sourceId: child.id,severity:'error',message:'历史子任务缺少标题' })
        if (manualDone && node.status !== 'done') issues.push({sourceId:child.id,severity:'warning',message:'历史父任务曾被人工标记完成，但此节点未勾选完成；保留原状态，请在迁移后重开父任务并核对节点验收'})
        childIdMap.set(child.id,node.id)
        if (child.managed) childIdMap.set(child.managed.id,node.id)
        const childSources: Array<[string,string,string]> = []
        if (child.old) childSources.push(['legacy','subtask',child.id])
        if (child.managed) childSources.push(['managed','subtask',child.managed.id])
        records.push({ item: node,sources: childSources })
        pending.push({ item: node,deps: child.managed?.dependencyIds ?? [] })
      }
      for (const node of pending) {
        for (const id of node.deps) if (!childIdMap.has(id)) issues.push({ sourceId,severity:'error',message:'历史子任务依赖指向缺失节点' })
        node.item.dependencyIds = node.deps.map((id) => childIdMap.get(id)).filter((id): id is string => !!id)
      }
    }
    for (const old of legacy) {
      if (!old || typeof old !== 'object' || Array.isArray(old)) { issues.push({ sourceId:'legacy',severity:'error',message:'旧待办包含无效记录' }); continue }
      const id = str(old.id)
      if (legacyIds.has(id)) { issues.push({ sourceId:id,severity:'error',message:'旧待办包含重复 ID' }); continue }
      legacyIds.add(id); importRoot(old,managed.find((task) => task.id === id && task.source === 'legacy'))
    }
    for (const task of managed) if (!used.has(task.id)) importRoot(undefined,task)
    const sourceOwners = new Map<string,string>()
    for (const record of records) for (const source of record.sources) {
      const key = JSON.stringify(source), owner = sourceOwners.get(key)
      if (owner && owner !== record.item.id) issues.push({sourceId:source[2],severity:'error',message:'同一来源 ID 被多个工作项引用，请核对重复子节点'})
      sourceOwners.set(key,record.item.id)
    }
    // Validate imported dependency graphs without writing or discarding source data.
    try { assertAcyclicDependencies(records.map(record => record.item)) } catch (error) { issues.push({ sourceId:'dependencies',severity:'error',message: (error as Error).message }) }
    return { records,issues,legacyCount: legacy.length,duplicateCount }
  }

  previewMigration(legacyRaw: string | null, managed: LegacyProgressManagedTask[]): ProgressMigration {
    if (this.isActive()) return this.latestMigration()!
    const built = this.buildMigration(legacyRaw,managed), inputHash = fingerprint({ legacyRaw,managed })
    const previous = this.db().prepare('SELECT data_json FROM progress_migration_batches WHERE input_hash=? ORDER BY rowid DESC LIMIT 1').get(inputHash)
    if (previous) return json<ProgressMigration>(previous)
    const batch: ProgressMigration = { id: uid('progress-migration'),inputHash,status:'prepared',legacyCount:built.legacyCount,managedCount:managed.length,workItemCount:built.records.length,duplicateCount:built.duplicateCount,reviewCount:built.records.filter((record) => record.item.status === 'review').length,issues:built.issues,createdAt:this.timestamp(),activatedAt:null,backupPath:null }
    this.db().prepare('INSERT INTO progress_migration_batches VALUES(?,?,?,?)').run(batch.id,inputHash,JSON.stringify(batch),JSON.stringify({ legacyRaw,managed }))
    return batch
  }

  activateMigration(batchId: string, inputHash: string, legacyRaw: string | null, managed: LegacyProgressManagedTask[], backupPath: string | null = null): ProgressMigration {
    const result = this.atomic(() => {
      const row = this.db().prepare('SELECT * FROM progress_migration_batches WHERE id=?').get(batchId) as Row | undefined
      if (!row) throw new Error('迁移预览不存在，请重新预览')
      const batch = json<ProgressMigration>(row)
      if (batch.inputHash !== inputHash) throw new Error('迁移指纹不匹配')
      if (batch.status === 'activated') return batch
      if (this.isActive()) throw new Error('原生任务已启用，不能再次覆盖历史迁移')
      if (fingerprint({ legacyRaw,managed }) !== inputHash) throw new Error('源任务已变化，请重新预览再启用')
      const built = this.buildMigration(legacyRaw,managed)
      if (built.issues.some((issue) => issue.severity === 'error')) throw new Error('迁移存在错误或活动执行，请先处理并重新预览')
      for (const record of built.records) {
        const previous = this.db().prepare('SELECT id FROM project_work_items WHERE id=?').get(record.item.id)
        if (!previous) {
          this.persistItem(record.item); this.event(record.item,'migrated',null,record.item,batch.id,'migration')
          if (record.item.completionBasis === 'legacy_user_marked') this.db().prepare('INSERT INTO work_item_acceptances VALUES(?,?,?,?,?,?)').run(uid('acceptance'),record.item.id,'legacy_user_complete',record.item.scopeRevision,record.item.completedAt ?? record.item.updatedAt,JSON.stringify({ source:record.sources,batchId:batch.id }))
        }
        for (const [system,type,id] of record.sources) {
          this.linkSource(system,type,id,record.item.id)
          this.db().prepare('INSERT OR REPLACE INTO progress_migration_items VALUES(?,?,?,?)').run(batch.id,`${system}:${type}:${id}`,record.item.id,JSON.stringify({ sources:record.sources,status:record.item.status,origin:record.item.origin }))
        }
        if (record.managed) this.importManagedHistory(record.item,record.managed,batch.id)
      }
      // Verify stored identity, hierarchy, fields and mappings before activating reads.
      for (const record of built.records) {
        const saved = this.getItem(record.item.id)
        if (canonical(saved) !== canonical(record.item)) throw new Error('迁移字段核对失败，已回滚且未切换读取')
        for (const [system,type,id] of record.sources) if (this.source(system,type,id) !== saved.id) throw new Error('迁移来源核对失败')
        if (saved.parentId && !this.getItem(saved.parentId)) throw new Error('迁移子任务核对失败')
        this.validateItem(saved)
      }
      batch.status = 'activated'; batch.activatedAt = this.timestamp(); batch.backupPath = backupPath
      this.db().prepare('UPDATE progress_migration_batches SET data_json=? WHERE id=?').run(JSON.stringify(batch),batch.id)
      this.db().prepare("INSERT OR REPLACE INTO project_progress_settings VALUES('active','1')").run()
      return batch
    })
    this.changed(); return result
  }

  private persistExecution(run: ProgressExecution): void {
    this.db().prepare('INSERT INTO task_executions VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET managed_task_id=excluded.managed_task_id,data_json=excluded.data_json').run(run.id,run.workItemId,run.managedTaskId,JSON.stringify(run))
    if (run.threadId) this.db().prepare("INSERT OR IGNORE INTO execution_thread_links VALUES(?,'codex','',?,'parent')").run(run.id,run.threadId)
  }
  private captureDelivery(run: ProgressExecution, task: LegacyProgressManagedTask): void {
    run.delivery = {branch:task.branch,baseBranch:task.baseBranch,baselineSha:task.baselineSha,commitSha:task.commitSha,targetBranch:task.targetBranch,events:task.events}
    run.threadLinks = task.bindings.filter(binding => !!binding.codexThreadId).map(binding => ({threadId:binding.codexThreadId,role:binding.role}))
    for (const binding of run.threadLinks) this.db().prepare("INSERT OR IGNORE INTO execution_thread_links VALUES(?,'codex','',?,?)").run(run.id,binding.threadId,binding.role)
  }
  private importManagedHistory(item: ProjectWorkItem, task: LegacyProgressManagedTask, batchId: string): void {
    if (this.executions().some((run) => run.managedTaskId === task.id)) return
    const run: ProgressExecution = { id:uid('execution'),workItemId:item.id,purpose:'implementation',provider:'codex',repositoryId:task.repositoryId,cwd:task.cwd,status:task.runStatus === 'failed' ? 'failed' : task.runStatus === 'cancelled' ? 'cancelled' : task.runStatus === 'completed' ? 'succeeded' : 'unknown',phase:task.stage,legacyStage:task.stage,attemptNo:1,commandId:batchId,managedTaskId:task.id,threadId:task.codexThreadId || null,providerTurnId:null,scopeRevision:item.scopeRevision,planSnapshot:task.subtasks,resultSummary:task.events.at(-1)?.message ?? '',errorMessage:task.runStatus === 'failed' ? task.events.at(-1)?.message ?? '' : '',startedAt:task.createdAt,finishedAt:task.finishedAt || null,lastObservedAt:task.updatedAt,historyCompleteness:'summary',createdAt:task.createdAt }
    // Unconfirmed imported sessions are context, not actionable coding runs.
    if (item.origin === 'ai_conversation') {run.phase = 'context-imported';run.status = 'unknown';run.resultSummary = '仅保存历史会话来源，没有创建或启动项目任务执行';run.finishedAt = null}
    else if (task.runStatus === 'idle' && !['failed','cancelled'].includes(task.stage)) run.status = 'succeeded'
    this.captureDelivery(run,task); this.persistExecution(run)
    for (const binding of task.bindings) if (binding.codexThreadId) this.db().prepare("INSERT OR IGNORE INTO execution_thread_links VALUES(?,'codex','',?,?)").run(run.id,binding.codexThreadId,binding.role)
    for (const [kind,reference] of [['branch',task.branch],['commit',task.commitSha],['baseline',task.baselineSha]] as const) if (reference) this.db().prepare('INSERT INTO work_item_artifacts VALUES(?,?,?,?,?)').run(uid('artifact'),item.id,kind,reference,JSON.stringify({ repositoryId:task.repositoryId,source:task.id,targetBranch:task.targetBranch,events:task.events }))
  }

  beginExecution(workItemId: string, purpose: ProgressExecution['purpose'], repositoryId: string, cwd: string, commandId: string): ProgressExecution {
    if (typeof commandId !== 'string' || !commandId.trim()) throw new Error('缺少执行命令 ID')
    const run = this.atomic(() => {
      const existing = this.executions().find((entry) => entry.commandId === commandId)
      if (existing) { if (existing.workItemId !== workItemId || existing.purpose !== purpose || existing.repositoryId !== repositoryId) throw new Error('执行命令 ID 已用于其他请求'); return existing }
      const item = this.getItem(workItemId); this.assertEditable(item)
      if (!item.projectId || item.trackingState !== 'tracked') throw new Error('请先关联项目并确认任务归属')
      if (['done','cancelled'].includes(item.status)) throw new Error('请先重开任务再执行')
      if (item.parentId) {
        const parent = this.getItem(item.parentId)
        if (parent.archivedAt || ['done','cancelled'].includes(parent.status)) throw new Error('请先恢复并重开父任务，再执行节点')
      }
      if (purpose === 'implementation' && isWorkBlocked(item,this.allItems())) throw new Error('任务仍有阻塞或未满足的依赖')
      if (purpose === 'planning' && item.parentId) throw new Error('请在父任务上规划节点')
      const children = this.allItems().filter(work => work.parentId === item.id && !['done','cancelled'].includes(work.status))
      if (purpose === 'implementation') {
        const pendingIds = new Set(children.map(work => work.id))
        if (children.some(work => work.blockers.some(blocker => !blocker.resolvedAt) || work.dependencyIds.some(id => !pendingIds.has(id) && this.getItem(id).status !== 'done'))) throw new Error('节点仍有外部依赖或阻塞，请先处理')
        if (!children.length && this.allItems().some(work => work.parentId === item.id && work.status === 'done')) throw new Error('节点均已完成，请进行父任务验收')
      }
      this.assertNoActiveRun(item.id)
      if (!repositoryId || !cwd) throw new Error('AI 编码需要明确的仓库和工作目录')
      if (purpose === 'implementation' && this.executions().some(run => run.purpose === 'implementation' && run.repositoryId === repositoryId && isActiveExecution(run))) throw new Error('此仓库已有执行或待核对结果，不能同时切换分支执行其他任务')
      const run: ProgressExecution = { id:uid('execution'),workItemId,purpose,provider:'codex',repositoryId,cwd,status:'queued',phase:'queued',legacyStage:'',attemptNo:this.executions().filter((entry) => entry.workItemId === workItemId && entry.purpose === purpose).length+1,commandId,managedTaskId:null,threadId:null,providerTurnId:null,scopeRevision:item.scopeRevision,planSnapshot:this.allItems().filter((work) => work.id === item.id || work.parentId === item.id),resultSummary:'等待 AI 启动',errorMessage:'',startedAt:null,finishedAt:null,lastObservedAt:this.timestamp(),historyCompleteness:'complete',createdAt:this.timestamp() }
      this.persistExecution(run); this.event(item,'execution-created',null,run,commandId,'user','execution'); return run
    })
    this.changed(); return run
  }
  getExecution(id: string): ProgressExecution {
    const run = this.executions().find((entry) => entry.id === id)
    if (!run) throw new Error('执行记录不存在')
    return run
  }
  recoverExecutions(): void {
    this.atomic(() => {
      for (const run of this.executions().filter(isActiveExecution)) {
        run.status = run.managedTaskId ? 'unknown' : 'failed'
        run.resultSummary = run.managedTaskId ? '应用已重启，需同步核对执行状态；不会自动重试或完成任务' : '启动尚未提交到执行器，应用重启后已终止，可安全重试'
        run.lastObservedAt = this.timestamp()
        if (run.status === 'failed') {run.finishedAt = run.lastObservedAt;run.errorMessage = run.resultSummary}
        this.persistExecution(run)
      }
    })
  }
  detachProject(projectId: string): void {
    this.atomic(() => {
      const items = this.allItems().filter(item => item.projectId === projectId)
      for (const root of items.filter(item => !item.parentId)) this.assertNoActiveRun(root.id)
      for (const item of items) {
        const before = structuredClone(item)
        item.projectId = null; item.trackingState = 'inbox'; item.goalId = null; item.keyResultId=null; item.milestoneId = null; item.versionId = null; item.rowVersion++; item.scopeRevision++; item.updatedAt = this.timestamp()
        this.persistItem(item); this.event(item,'project-removed',before,item,`detach-${projectId}`,'system')
      }
    })
    this.changed()
  }
  attachManagedExecution(executionId: string, task: LegacyProgressManagedTask): void {
    this.atomic(() => {
      const run = this.getExecution(executionId)
      if (run.managedTaskId && run.managedTaskId !== task.id) throw new Error('执行已绑定其他托管任务')
      run.managedTaskId = task.id; run.threadId = task.codexThreadId; run.lastObservedAt = task.updatedAt
      this.captureDelivery(run,task); this.linkSource('managed','task',task.id,run.workItemId); this.persistExecution(run)
    })
  }
  attachManagedNodes(task: LegacyProgressManagedTask, workItemIds: string[]): void {
    this.atomic(() => {
      task.subtasks.forEach((node,index) => {
        if (workItemIds[index]) this.linkSource('managed','subtask',node.id,workItemIds[index])
      })
    })
  }
  setExecutionResult(id: string, status: ExecutionStatus, message: string, turnId?: string): ProgressExecution {
    const result = this.atomic(() => {
      const run = this.getExecution(id)
      if (['succeeded','failed','cancelled'].includes(run.status)) return run
      const before = structuredClone(run)
      run.status = status; run.resultSummary = message; run.lastObservedAt = this.timestamp()
      if (run.phase === 'queued' || ['cancelling','unknown','failed','cancelled'].includes(status)) run.phase = status === 'running' && run.purpose === 'planning' ? 'planning' : status
      if (status === 'running') run.startedAt ??= run.lastObservedAt
      if (['succeeded','failed','cancelled'].includes(status)) run.finishedAt = run.lastObservedAt
      if (status === 'failed') run.errorMessage = message
      if (turnId) run.providerTurnId = turnId
      this.persistExecution(run); this.event(this.getItem(run.workItemId),'execution-state',before,run,run.commandId,'system','execution'); return run
    })
    this.changed(); return result
  }
  recordManagedUpdate(task: LegacyProgressManagedTask): void {
    const candidates = this.executions().filter((run) => run.managedTaskId === task.id)
    const run = candidates.at(-1)
    if (!run || task.updatedAt < run.lastObservedAt) return
    const before = structuredClone(run)
    this.atomic(() => {
      this.captureDelivery(run,task)
      if (run.phase === 'context-imported') {run.lastObservedAt = task.updatedAt;this.persistExecution(run);return}
      if (['succeeded','failed','cancelled'].includes(run.status)) { run.lastObservedAt = task.updatedAt; this.persistExecution(run); return }
      run.phase = task.stage; run.legacyStage = task.stage; run.lastObservedAt = task.updatedAt
      run.resultSummary = task.events.at(-1)?.message ?? task.stage
      const state: ExecutionStatus = task.stage === 'failed' ? 'failed' : task.stage === 'cancelled' ? task.bindings.some(binding => binding.nativeStatus === 'running') ? 'cancelling' : 'cancelled'
        : run.purpose === 'planning' ? task.stage === 'ready' ? 'succeeded' : 'running'
          : ['codex-complete','completed-no-changes','awaiting-review','awaiting-commit','awaiting-target','merged','completed'].includes(task.stage) ? 'succeeded' : 'running'
      run.status = state; if (state === 'running') run.startedAt ??= task.updatedAt
      if (['succeeded','failed','cancelled'].includes(state)) run.finishedAt = task.updatedAt
      if (state === 'failed') run.errorMessage = run.resultSummary
      this.persistExecution(run)
      for (const binding of task.bindings) if (binding.codexThreadId) this.db().prepare("INSERT OR IGNORE INTO execution_thread_links VALUES(?,'codex','',?,?)").run(run.id,binding.codexThreadId,binding.role)
      const item = this.getItem(run.workItemId)
      if (before.status !== run.status) this.event(item,'execution-state',before,run,run.commandId,'system','execution')
      if (run.purpose === 'implementation' && state === 'running' && item.status === 'todo') {
        const before = structuredClone(item); item.status = 'doing'; item.startedAt ??= task.updatedAt; item.rowVersion++; item.updatedAt = this.timestamp(); this.persistItem(item); this.event(item,'execution-started',before,item,run.commandId,'system')
      }
    })
    if (canonical(before) !== canonical(run)) this.changed()
  }
  createDraftFromAi(workItemId: string, executionId: string, text: string): ProgressPlanDraft {
    const run = this.getExecution(executionId)
    if (run.workItemId !== workItemId || run.purpose !== 'planning' || ['cancelling','cancelled','failed'].includes(run.status)) throw new Error('执行已失效，不能用迟到结果生成计划')
    if (run.scopeRevision !== this.getItem(workItemId).scopeRevision) throw new Error('任务范围已变化，请重新规划')
    const existing = this.drafts().find(draft => draft.executionId === executionId)
    if (existing) return existing
    const objectMatch = text.match(/\{[\s\S]*\}/)
    if (!objectMatch) throw new Error('AI 尚未返回 JSON 计划，可稍后重试或手动编辑草稿')
    const parsed = JSON.parse(objectMatch[0]) as { subtasks?: Array<{ title?: string; description?: string; acceptance?: string; dependencyIndexes?: number[] }> }
    if (!Array.isArray(parsed.subtasks) || !parsed.subtasks.length) throw new Error('AI 计划中没有可用节点')
    const ids = parsed.subtasks.map(() => uid('draft-node'))
    const items: ProgressPlanItem[] = parsed.subtasks.map((node,index) => ({ id:ids[index],title:str(node.title),description:str(node.description),acceptanceText:str(node.acceptance),dependencyIds:(node.dependencyIndexes ?? []).map((id) => ids[id] ?? 'missing') }))
    const id = this.atomic(() => this.saveDraft(this.getItem(workItemId),items,executionId))
    this.changed(); return this.drafts().find((draft) => draft.id === id)!
  }

  latestMigration(): ProgressMigration | null {
    const row = this.db().prepare('SELECT data_json FROM progress_migration_batches ORDER BY rowid DESC LIMIT 1').get()
    return row ? json<ProgressMigration>(row) : null
  }
}
