import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { TaskBase, TaskCommand, TaskCommandResult, TaskWorkspaceSnapshot, WorkspaceTask, TaskList, TaskField, TaskEvent, TaskHistoryQuery, TaskAttachment, TaskDashboard, TaskWidget, TaskTemplate, TaskProject } from '../shared/task-workspace.js'
import { makeDefaultTaskDashboard, taskWidgetKinds } from '../shared/task-workspace.js'
import { nextTaskOccurrence, shiftTaskStart } from './task-recurrence.js'

const kinds = ['task', 'list', 'folder', 'group', 'field', 'person', 'view', 'dashboard', 'template', 'attachment', 'event'] as const
type Kind = typeof kinds[number]
type JsonRecord = TaskBase & Record<string, any>
const table = (kind: Kind) => { if (!kinds.includes(kind)) throw new Error('无效的任务记录类型'); return `task_workspace_${kind}` }
export function migrateTaskWorkspace(db: Database.Database): void {
  for (const kind of kinds) db.exec(`CREATE TABLE IF NOT EXISTS ${table(kind)} (id TEXT PRIMARY KEY, row_version INTEGER NOT NULL, data_json TEXT NOT NULL);`)
  db.exec(`CREATE TABLE IF NOT EXISTS task_workspace_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS task_workspace_commands (id TEXT PRIMARY KEY, hash TEXT NOT NULL, result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS task_workspace_recurrences (previous_id TEXT PRIMARY KEY, next_id TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_task_workspace_view_scope ON task_workspace_view(json_extract(data_json,'$.scope'));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_task_workspace_occurrence ON task_workspace_task(json_extract(data_json,'$.previousId')) WHERE json_extract(data_json,'$.previousId') IS NOT NULL;
    UPDATE task_workspace_task SET data_json=json_set(data_json,'$.projectIds',json('[]')) WHERE json_type(data_json,'$.projectIds') IS NULL;`)
}

export class TaskWorkspaceService {
  constructor(
    readonly db: Database.Database,
    private readonly now: () => Date = () => new Date(),
    private readonly changed: () => void = () => undefined,
    private readonly listProjects: () => TaskProject[] = () => []
  ) { migrateTaskWorkspace(db) }
  ready(): boolean { return !!this.db.prepare("SELECT 1 FROM task_workspace_settings WHERE key='initialized'").get() }
  private stamp(): string { return this.now().toISOString() }
  private base(id: string = randomUUID()): TaskBase { return { id, rowVersion: 1, createdAt: this.stamp(), updatedAt: this.stamp() } }
  all<T = JsonRecord>(kind: Kind): T[] { return this.db.prepare(`SELECT data_json FROM ${table(kind)} ORDER BY rowid`).all().map(row => JSON.parse((row as { data_json: string }).data_json)) }
  get<T = JsonRecord>(kind: Kind, id: string): T { const row = this.db.prepare(`SELECT data_json FROM ${table(kind)} WHERE id=?`).get(id) as { data_json: string } | undefined; if (!row) throw new Error('记录不存在，请刷新后重试'); return JSON.parse(row.data_json) }
  private put(kind: Kind, value: TaskBase): void { this.db.prepare(`INSERT INTO ${table(kind)} VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET row_version=excluded.row_version,data_json=excluded.data_json`).run(value.id, value.rowVersion, JSON.stringify(value)) }
  private remove(kind: Kind, id: string): void { this.db.prepare(`DELETE FROM ${table(kind)} WHERE id=?`).run(id) }
  private verify(record: TaskBase, expected: number | undefined): void { if (expected !== record.rowVersion) throw new Error('记录已被其他窗口修改，请刷新后重试') }
  private event(kind: Kind, action: string, before: JsonRecord | null, after: JsonRecord | null): void {
    const item = after ?? before!
    const listIds = kind === 'list' ? [item.id] : [...new Set([...(before?.links ?? []), ...(after?.links ?? [])].map((link: { listId: string }) => link.listId))]
    if (kind === 'group' && item.scope !== 'personal') listIds.push(item.scope)
    if (kind === 'field') for (const list of this.all<TaskList>('list')) if (list.fieldIds.includes(item.id)) listIds.push(list.id)
    this.put('event', { ...this.base(), entityId: item.id, title: item.title || item.name || '', action, listIds, before, after } as TaskEvent)
  }
  initialize(backupPath: string): void {
    if (this.ready()) return
    this.db.transaction(() => {
      // Only the task/retired progress tables are cleared. Sessions, Git and releases are separate tables.
      const oldTables = ['managed_task_thread_bindings', 'managed_task_events', 'managed_task_subtasks', 'managed_tasks', 'execution_thread_links', 'task_executions', 'task_plan_drafts', 'work_item_artifacts', 'work_item_source_links', 'work_item_acceptances', 'work_item_blockers', 'work_item_dependencies', 'work_item_tags', 'progress_migration_items', 'progress_migration_batches', 'progress_relations', 'project_key_results', 'project_work_items', 'project_goals', 'project_milestones', 'project_versions', 'progress_events', 'progress_commands', 'project_progress_settings']
      for (const name of oldTables) if (this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) this.db.exec(`DELETE FROM ${name}`)
      this.put('person', { ...this.base('self'), name: '我', color: '#8747ff', avatar: '' } as JsonRecord)
      this.db.prepare('INSERT INTO task_workspace_settings VALUES(?,?)').run('backup', backupPath)
      this.db.prepare('INSERT INTO task_workspace_settings VALUES(?,?)').run('initialized', this.stamp())
    })()
    this.changed()
  }
  snapshot(): TaskWorkspaceSnapshot {
    if (!this.ready()) throw new Error('任务工作区正在初始化，请稍后重试')
    return { tasks: this.all('task'), projects: this.listProjects(), lists: this.all('list'), folders: this.all('folder'), groups: this.all('group'), fields: this.all('field'), people: this.all('person'), views: this.all('view'), dashboards: this.all('dashboard'), templates: this.all('template'), attachments: this.all('attachment'), selfId: 'self' }
  }
  detachProject(projectId: string): void {
    // Run inside the project deletion transaction, before notifying other windows.
    const rows = this.db.prepare(`
      SELECT task.data_json FROM task_workspace_task task
      WHERE EXISTS (SELECT 1 FROM json_each(task.data_json, '$.projectIds') WHERE value = ?)
    `).all(projectId) as { data_json: string }[]
    for (const row of rows) {
      const before = JSON.parse(row.data_json) as WorkspaceTask
      const after = {
        ...before,
        projectIds: before.projectIds.filter(id => id !== projectId),
        rowVersion: before.rowVersion + 1,
        updatedAt: this.stamp()
      }
      this.put('task', after)
      this.event('task', '解除项目关联', before, after)
    }
  }
  history(query: TaskHistoryQuery = {}): TaskEvent[] {
    const limit = Math.max(1, Math.min(query.limit ?? 100, 500))
    return this.all<TaskEvent>('event').reverse().filter(event => (!query.entityId || event.entityId === query.entityId) && (!query.listId || event.listIds.includes(query.listId)) && (!query.before || `${event.createdAt}/${event.id}` < query.before)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, limit)
  }
  command(command: TaskCommand): TaskCommandResult {
    if (!this.ready()) throw new Error('任务工作区尚未初始化')
    if (!command || typeof command.commandId !== 'string' || !command.commandId.trim()) throw new Error('缺少命令 ID')
    const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex')
    const result = this.db.transaction(() => {
      const old = this.db.prepare('SELECT hash,result FROM task_workspace_commands WHERE id=?').get(command.commandId) as { hash: string; result: string } | undefined
      if (old) { if (old.hash !== hash) throw new Error('相同命令 ID 的内容发生变化'); return JSON.parse(old.result) as TaskCommandResult }
      const result = this.execute(command)
      this.db.prepare('INSERT INTO task_workspace_commands VALUES(?,?,?)').run(command.commandId, hash, JSON.stringify(result))
      return result
    })()
    this.changed()
    return result
  }
  private taskDefaults(): WorkspaceTask {
    return { ...this.base(), title: '', description: '', done: false, completedAt: null, order: this.all('task').length, ownerId: 'self', creatorId: 'self', assignerId: 'self', priority: 'medium', startDate: null, dueDate: null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, parentId: null, dependencyIds: [], milestone: false, starred: false, personalGroupId: null, projectIds: [], links: [], values: {}, recurrence: null, seriesId: null, previousId: null, source: 'local', reminderMinutes: null, reminderSentFor: null }
  }
  private defaults(kind: Kind): Record<string, unknown> {
    if (kind === 'task') return this.taskDefaults()
    if (kind === 'list') return { title: '', folderId: null, order: this.all('list').length, pinned: false, archived: false, fieldIds: [], ownerId: 'self' }
    if (kind === 'folder') return { title: '', order: this.all('folder').length }
    if (kind === 'group') return { title: '', scope: 'personal', order: this.all('group').length }
    if (kind === 'field') return { title: '', type: 'text', options: [] }
    if (kind === 'person') return { name: '', color: '#8747ff', avatar: '' }
    if (kind === 'view') return { scope: 'all', mode: 'list', groupBy: 'custom', filters: [], sorts: [], visibleFields: ['priority', 'ownerId', 'startDate', 'dueDate', 'projectIds'], collapsed: [], completion: 'all' }
    if (kind === 'dashboard') return { title: '仪表盘', scope: 'all', theme: 'light', filters: [], widgets: [] }
    return {}
  }
  private assertDate(value: unknown): void {
    if (value === null) return
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*Z)?$/.test(value) || !Number.isFinite(Date.parse(value)) || (value.length === 10 && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) throw new Error('日期格式无效')
  }
  private assertGraph(task: WorkspaceTask): void {
    const tasks = new Map(this.all<WorkspaceTask>('task').map(item => [item.id, item])); tasks.set(task.id, task)
    const walk = (id: string, path: Set<string>, edges: (item: WorkspaceTask) => string[]) => {
      if (path.has(id)) throw new Error('父子关系或前后置依赖不能形成循环')
      const item = tasks.get(id); if (!item) throw new Error('关联任务不存在')
      const next = new Set(path); next.add(id)
      for (const other of edges(item)) walk(other, next, edges)
    }
    walk(task.id, new Set(), item => item.parentId ? [item.parentId] : [])
    walk(task.id, new Set(), item => item.dependencyIds)
  }
  private validate(kind: Kind, record: JsonRecord, before: JsonRecord | null): void {
    if (['task', 'list', 'folder', 'group', 'field', 'dashboard'].includes(kind)) { if (typeof record.title !== 'string' || !record.title.trim()) throw new Error('请输入名称'); record.title = record.title.trim() }
    if (kind === 'person') { if (!record.name?.trim()) throw new Error('请输入姓名'); if (!/^#[0-9a-f]{6}$/i.test(record.color)) throw new Error('请选择有效颜色'); if (record.avatar && !/^data:image\/(png|jpeg|webp);base64,/.test(record.avatar)) throw new Error('头像必须是本地图片'); if (record.avatar.length > 2_000_000) throw new Error('头像过大') }
    if (kind === 'list') { if (record.folderId) this.get('folder', record.folderId); for (const id of record.fieldIds) this.get('field', id); this.get('person', record.ownerId) }
    if (kind === 'group' && record.scope !== 'personal') this.get('list', record.scope)
    if (kind === 'field') {
      if (!['single', 'multi', 'person', 'number', 'date', 'text'].includes(record.type)) throw new Error('不支持的字段类型')
      if (before && before.type !== record.type && this.all<WorkspaceTask>('task').some(task => task.values[record.id] != null)) throw new Error('已有任务值的字段不能直接更改类型')
      if (!Array.isArray(record.options) || record.options.some((option: any) => !option.id || !option.label?.trim() || !/^#[0-9a-f]{6}$/i.test(option.color)) || new Set(record.options.map((option: any) => option.id)).size !== record.options.length) throw new Error('字段选项无效')
    }
    if (kind === 'dashboard') {
      const visit = (widgets: TaskWidget[], depth = 0) => { if (depth > 4 || !Array.isArray(widgets) || widgets.length > 100) throw new Error('组件数量或嵌套层级过多'); for (const widget of widgets) { if (!taskWidgetKinds.includes(widget.kind) || !Number.isFinite(widget.width) || widget.width < 1 || widget.width > 12 || !Number.isFinite(widget.height) || widget.height < 120 || widget.height > 1200) throw new Error('组件配置无效'); visit(widget.children, depth + 1) } }; visit(record.widgets)
    }
    if (kind !== 'task') return
    const task = record as WorkspaceTask
    if (!['low', 'medium', 'high'].includes(task.priority) || typeof task.done !== 'boolean' || typeof task.description !== 'string' || !Number.isFinite(task.order)) throw new Error('任务字段无效')
    this.assertDate(task.startDate); this.assertDate(task.dueDate)
    try { new Intl.DateTimeFormat('en', { timeZone: task.timezone }) } catch { throw new Error('时区无效') }
    if (task.startDate && task.dueDate && task.startDate > task.dueDate) throw new Error('截止时间不能早于开始时间')
    for (const id of [task.ownerId, task.creatorId, task.assignerId]) if (id) this.get('person', id)
    if (!Array.isArray(task.projectIds) || task.projectIds.some(id => typeof id !== 'string' || !id) || new Set(task.projectIds).size !== task.projectIds.length) throw new Error('关联项目无效或重复')
    if (task.projectIds.length) {
      const projectExists = this.db.prepare('SELECT 1 FROM projects WHERE id = ?')
      if (task.projectIds.some(id => !projectExists.get(id))) throw new Error('关联项目不存在')
    }
    if (task.personalGroupId && this.get('group', task.personalGroupId).scope !== 'personal') throw new Error('个人分组无效')
    if (!Array.isArray(task.links) || new Set(task.links.map(link => link.listId)).size !== task.links.length) throw new Error('清单归属不能重复')
    for (const link of task.links) { const list = this.get<TaskList>('list', link.listId); if (list.archived && !before?.links.some((old: TaskLinkLike) => old.listId === link.listId)) throw new Error('不能添加到已归档清单'); if (link.groupId && this.get('group', link.groupId).scope !== link.listId) throw new Error('分组不属于该清单'); if (!Number.isFinite(link.order)) throw new Error('排列位置无效') }
    for (const [id, value] of Object.entries(task.values)) {
      const field = this.get<TaskField>('field', id)
      if (value === null) continue
      if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('请输入有效数值')
      if (['text', 'date', 'single'].includes(field.type) && typeof value !== 'string') throw new Error('字段值类型错误')
      if (field.type === 'date') this.assertDate(value)
      if (field.type === 'single' && !field.options.some(option => option.id === value)) throw new Error('选项不存在')
      if (field.type === 'multi' && (!Array.isArray(value) || value.some(option => !field.options.some(item => item.id === option)))) throw new Error('多选值无效')
      if (field.type === 'person') { if (!Array.isArray(value)) throw new Error('人员字段应为人员列表'); for (const personId of value) this.get('person', personId) }
    }
    if (!Array.isArray(task.dependencyIds) || new Set(task.dependencyIds).size !== task.dependencyIds.length) throw new Error('依赖任务无效')
    this.assertGraph(task)
    if (task.reminderMinutes !== null && (!Number.isFinite(task.reminderMinutes) || task.reminderMinutes < 0)) throw new Error('提醒时间无效')
    if (task.recurrence) {
      if (!task.dueDate) throw new Error('重复任务需要截止日期')
      if (!['day', 'week', 'month', 'year', 'workday'].includes(task.recurrence.unit)) throw new Error('重复频率无效')
      nextTaskOccurrence(task.recurrence, task.dueDate, this.now())
    }
    task.completedAt = task.done ? before?.completedAt || this.stamp() : null
    if (!before || before.dueDate !== task.dueDate || before.reminderMinutes !== task.reminderMinutes || before.done !== task.done) task.reminderSentFor = null
  }
  private save(kind: Kind, input: Record<string, any>, expected?: number): string {
    const before = input.id ? this.get(kind, input.id) : null
    if (before) this.verify(before, expected)
    const defaults = this.defaults(kind)
    const allowed = Object.keys(defaults).filter(key => !['id', 'rowVersion', 'createdAt', 'updatedAt', 'completedAt', 'reminderSentFor', 'previousId', 'seriesId', 'source'].includes(key))
    const patch = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)))
    const record = { ...defaults, ...(before ?? this.base()), ...patch, rowVersion: (before?.rowVersion ?? 0) + 1, updatedAt: this.stamp() } as JsonRecord
    this.validate(kind, record, before)
    this.put(kind, record); this.event(kind, before ? '修改' : '创建', before, record)
    if (kind === 'task' && record.done && !before?.done && record.recurrence) this.repeat(record as WorkspaceTask)
    if (kind === 'field' && before) {
      const ids = new Set(record.options.map((option: any) => option.id))
      for (const task of this.all<WorkspaceTask>('task')) if (task.values[record.id] != null) {
        const value = task.values[record.id]
        if (record.type === 'single' && !ids.has(value) || record.type === 'multi' && Array.isArray(value) && value.some(id => !ids.has(id))) this.save('task', { id: task.id, values: { ...task.values, [record.id]: record.type === 'multi' ? (value as string[]).filter(id => ids.has(id)) : null } }, task.rowVersion)
      }
    }
    return record.id
  }
  private repeat(task: WorkspaceTask): void {
    if (this.db.prepare('SELECT 1 FROM task_workspace_recurrences WHERE previous_id=?').get(task.id)) return
    if (this.all<WorkspaceTask>('task').some(item => item.previousId === task.id)) return
    const dueDate = nextTaskOccurrence(task.recurrence!, task.dueDate!, this.now())
    const next: WorkspaceTask = { ...task, ...this.base(), done: false, completedAt: null, dueDate, startDate: shiftTaskStart(task.startDate, task.dueDate!, dueDate), previousId: task.id, seriesId: task.seriesId ?? task.id, source: 'repeat', reminderSentFor: null }
    this.put('task', next)
    this.db.prepare('INSERT INTO task_workspace_recurrences VALUES(?,?)').run(task.id, next.id)
    this.event('task', '生成重复任务', null, next as JsonRecord)
  }
  private delete(kind: Kind, id: string, expected: number): void {
    const before = this.get(kind, id); this.verify(before, expected)
    if (kind === 'person' && id === 'self') throw new Error('不能删除自己的身份')
    for (const task of this.all<WorkspaceTask>('task')) {
      const patch: Partial<WorkspaceTask> = {}
      if (kind === 'task') { if (task.parentId === id) patch.parentId = null; if (task.dependencyIds.includes(id)) patch.dependencyIds = task.dependencyIds.filter(value => value !== id) }
      if (kind === 'list' && task.links.some(link => link.listId === id)) patch.links = task.links.filter(link => link.listId !== id)
      if (kind === 'group') { if (task.personalGroupId === id) patch.personalGroupId = null; if (task.links.some(link => link.groupId === id)) patch.links = task.links.map(link => link.groupId === id ? { ...link, groupId: null } : link) }
      if (kind === 'field' && id in task.values) { patch.values = { ...task.values }; delete patch.values[id] }
      if (kind === 'person') { if (task.ownerId === id) patch.ownerId = null; if (task.assignerId === id) patch.assignerId = null; if (task.creatorId === id) patch.creatorId = 'self'; for (const field of this.all<TaskField>('field').filter(field => field.type === 'person')) { const value = task.values[field.id]; if (Array.isArray(value) && value.includes(id)) patch.values = { ...(patch.values ?? task.values), [field.id]: value.filter(value => value !== id) } } }
      if (Object.keys(patch).length) this.save('task', { id: task.id, ...patch }, task.rowVersion)
    }
    for (const list of this.all<TaskList>('list')) { if (kind === 'folder' && list.folderId === id) this.save('list', { id: list.id, folderId: null }, list.rowVersion); if (kind === 'field' && list.fieldIds.includes(id)) this.save('list', { id: list.id, fieldIds: list.fieldIds.filter(value => value !== id) }, list.rowVersion); if (kind === 'person' && list.ownerId === id) this.save('list', { id: list.id, ownerId: 'self' }, list.rowVersion) }
    if (kind === 'list') for (const group of this.all('group').filter(group => group.scope === id)) this.remove('group', group.id)
    for (const view of this.all('view')) {
      if (kind === 'list' && view.scope === id) this.remove('view', view.id)
      else if (kind === 'field' && (view.visibleFields.includes(id) || view.groupBy === id || view.filters.some((filter: any) => filter.field === id) || view.sorts.some((sort: any) => sort.field === id))) this.save('view', { id: view.id, visibleFields: view.visibleFields.filter((field: string) => field !== id), groupBy: view.groupBy === id ? 'custom' : view.groupBy, filters: view.filters.filter((filter: any) => filter.field !== id), sorts: view.sorts.filter((sort: any) => sort.field !== id) }, view.rowVersion)
    }
    if (kind === 'list') for (const dashboard of this.all('dashboard').filter(dashboard => dashboard.scope === id)) this.remove('dashboard', dashboard.id)
    if (kind === 'task') for (const attachment of this.all<TaskAttachment>('attachment').filter(file => file.taskId === id)) this.remove('attachment', attachment.id)
    this.remove(kind, id); this.event(kind, '删除', before, null)
  }
  private execute(command: TaskCommand): TaskCommandResult {
    if (command.type.startsWith('save-') && 'input' in command) return { entityId: this.save(command.type.slice(5) as Kind, command.input, command.expectedVersion) }
    if (command.type === 'delete') { this.delete(command.kind, command.id, command.expectedVersion); return { entityId: command.id } }
    if (command.type === 'batch') {
      if (new Set(command.tasks.map(entry => entry.id)).size !== command.tasks.length) throw new Error('批量操作包含重复任务')
      for (const entry of command.tasks) this.verify(this.get('task', entry.id), entry.expectedVersion)
      for (const entry of command.tasks) { const current = this.get('task', entry.id); entry.delete ? this.delete('task', entry.id, current.rowVersion) : this.save('task', { ...entry.patch, id: entry.id }, current.rowVersion) }
      return { entityId: command.tasks[0]?.id ?? '' }
    }
    if (command.type === 'copy-task') { const task = this.get<WorkspaceTask>('task', command.id); this.verify(task, command.expectedVersion); const copy = { ...task, ...this.base(), title: `${task.title}（副本）`, done: false, completedAt: null, previousId: null, seriesId: null, recurrence: null, reminderSentFor: null }; this.put('task', copy); this.event('task', '复制', null, copy as JsonRecord); return { entityId: copy.id } }
    if (command.type === 'save-template') {
      const list = this.get<TaskList>('list', command.listId)
      const groups = this.all('group').filter(group => group.scope === list.id)
      const tasks = this.all<WorkspaceTask>('task').filter(task => task.links.some(link => link.listId === list.id))
      const template: TaskTemplate = { ...this.base(), title: command.title.trim() || list.title, groups: groups.map(group => group.title), fieldIds: list.fieldIds,
        tasks: tasks.map(task => ({ title: task.title, description: task.description, priority: task.priority, values: task.values,
          groupTitle: groups.find(group => group.id === task.links.find(link => link.listId === list.id)?.groupId)?.title,
          parentIndex: tasks.findIndex(item => item.id === task.parentId), dependencyIndexes: task.dependencyIds.map(id => tasks.findIndex(item => item.id === id)).filter(index => index >= 0) })) }
      this.put('template', template); return { entityId: template.id }
    }
    if (command.type === 'apply-template') {
      const template: Pick<TaskTemplate, 'groups' | 'tasks' | 'fieldIds'> = command.templateId === 'builtin-week' ? { groups: ['本周', '下周'], tasks: [{ title: '整理本周计划', description: '', priority: 'medium', values: {} }], fieldIds: [] } : command.templateId === 'builtin-project' ? { groups: ['待定', '计划', '执行'], tasks: [], fieldIds: [] } : this.get('template', command.templateId)
      const fieldIds = template.fieldIds.filter(id => this.all('field').some(field => field.id === id))
      const listId = this.save('list', { title: command.title, folderId: command.folderId ?? null, fieldIds })
      const groupIds = template.groups.map(title => this.save('group', { title, scope: listId }))
      const taskIds = template.tasks.map(item => {
        const id = this.save('task', { title: item.title, description: item.description, priority: item.priority,
          values: Object.fromEntries(Object.entries(item.values).filter(([id]) => fieldIds.includes(id))),
          links: [{ listId, groupId: groupIds[template.groups.indexOf(item.groupTitle ?? '')] ?? null, order: this.all('task').length }] })
        const task = this.get<WorkspaceTask>('task', id); task.source = 'template'; this.put('task', task); return id
      })
      template.tasks.forEach((item, index) => {
        const task = this.get<WorkspaceTask>('task', taskIds[index])
        const parentId = item.parentIndex != null && item.parentIndex >= 0 ? taskIds[item.parentIndex] : null
        const dependencyIds = (item.dependencyIndexes ?? []).map(index => taskIds[index]).filter(Boolean)
        if (parentId || dependencyIds.length) this.save('task', { id: task.id, parentId, dependencyIds }, task.rowVersion)
      })
      return { entityId: listId }
    }
    throw new Error('不支持的任务操作')
  }
  addAttachment(input: Omit<TaskAttachment, keyof TaskBase>): string { this.get('task', input.taskId); const value = { ...this.base(), ...input }; this.db.transaction(() => { this.put('attachment', value); this.event('task', `添加附件：${input.name}`, this.get('task', input.taskId), this.get('task', input.taskId)) })(); this.changed(); return value.id }
  dueReminders(): WorkspaceTask[] {
    if (!this.ready()) return []
    return this.all<WorkspaceTask>('task').filter(task => {
      if (task.done || !task.dueDate || task.reminderMinutes === null) return false
      const due = task.dueDate.length === 10 ? `${task.dueDate}T09:00:00` : task.dueDate
      // Calendar dates are interpreted in the task timezone, never the machine's UTC date.
      const local = task.dueDate.length === 10 ? this.calendarTimestamp(task.dueDate, task.timezone) : Date.parse(due)
      const key = `${task.dueDate}/${task.reminderMinutes}`
      return local - task.reminderMinutes * 60_000 <= this.now().getTime() && task.reminderSentFor !== key
    })
  }
  private calendarTimestamp(date: string, timezone: string): number {
    let timestamp = Date.parse(`${date}T09:00:00Z`)
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp))
      const get = (key: string) => parts.find(part => part.type === key)!.value
      const wall = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`)
      timestamp += Date.parse(`${date}T09:00:00Z`) - wall
    }
    return timestamp
  }
  markReminderSent(id: string): void { const task = this.get<WorkspaceTask>('task', id); task.reminderSentFor = `${task.dueDate}/${task.reminderMinutes}`; this.put('task', task) }
}
type TaskLinkLike = { listId: string }

export function defaultTaskDashboard(scope: string): Omit<TaskDashboard, keyof TaskBase> {
  return makeDefaultTaskDashboard(scope, randomUUID)
}
