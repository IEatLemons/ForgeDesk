export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskFieldType = 'single' | 'multi' | 'person' | 'number' | 'date' | 'text'
export type TaskValue = string | number | boolean | string[] | null
export type TaskBase = { id: string; rowVersion: number; createdAt: string; updatedAt: string }
export type TaskPerson = TaskBase & { name: string; color: string; avatar: string }
export type TaskProject = { id: string; name: string; archivedAt?: string | null }
export type TaskFolder = TaskBase & { title: string; order: number }
export const defaultTaskGroupTitle = '未分组'
export type TaskList = TaskBase & { title: string; defaultGroupTitle?: string; folderId: string | null; order: number; pinned: boolean; archived: boolean; fieldIds: string[]; ownerId: string }
export type TaskGroup = TaskBase & { title: string; scope: string; order: number }
export type TaskField = TaskBase & { title: string; type: TaskFieldType; options: { id: string; label: string; color: string }[] }
export type TaskLink = { listId: string; groupId: string | null; order: number }
export type TaskRecurrence = { unit: 'day' | 'week' | 'month' | 'year' | 'workday'; interval: number; anchor: string; timezone: string }
export type WorkspaceTask = TaskBase & {
  title: string; description: string; done: boolean; completedAt: string | null; order: number
  ownerId: string | null; creatorId: string; assignerId: string | null; priority: TaskPriority
  startDate: string | null; dueDate: string | null; timezone: string; parentId: string | null
  dependencyIds: string[]; milestone: boolean; starred: boolean; personalGroupId: string | null
  projectIds: string[]; links: TaskLink[]; values: Record<string, TaskValue>; recurrence: TaskRecurrence | null
  seriesId: string | null; previousId: string | null; source: 'local' | 'template' | 'repeat'
  reminderMinutes: number | null; reminderSentFor: string | null
}
export type TaskAttachment = TaskBase & { taskId: string; name: string; size: number; mime: string; storageName: string }
export type TaskEvent = TaskBase & { entityId: string; title: string; action: string; listIds: string[]; before: unknown; after: unknown }
export type TaskFilter = { field: string; operator: 'eq' | 'ne' | 'contains' | 'gt' | 'lt' | 'empty'; value: TaskValue }
export type TaskSort = { field: string; direction: 'asc' | 'desc' }
export type TaskViewKind = 'list' | 'board' | 'gantt' | 'dashboard' | 'activity'
export type TaskView = TaskBase & { scope: string; mode: TaskViewKind; groupBy: string; filters: TaskFilter[]; sorts: TaskSort[]; visibleFields: string[]; collapsed: string[]; completion: 'all' | 'active' | 'done' }
export const taskWidgetKinds = ['metric', 'bar', 'line', 'horizontal', 'area', 'pie', 'donut', 'combo', 'radar', 'scatter', 'funnel', 'wordcloud', 'table', 'board', 'calendar', 'gantt', 'gallery', 'pivot', 'text', 'button', 'ranking', 'progress', 'countdown', 'nps', 'slicer', 'layout'] as const
export type TaskWidgetKind = typeof taskWidgetKinds[number]
export const taskWidgetLabels: Record<TaskWidgetKind, string> = { metric: '指标卡', bar: '柱状图', line: '折线图', horizontal: '条形图', area: '面积图', pie: '饼图', donut: '环形图', combo: '组合图', radar: '雷达图', scatter: '散点图', funnel: '漏斗图', wordcloud: '词云', table: '表格', board: '看板', calendar: '日历', gantt: '甘特图', gallery: '画册', pivot: '透视表', text: '文本', button: '按钮', ranking: '排行榜', progress: '进度图', countdown: '倒计时', nps: 'NPS 图', slicer: '切片器', layout: '组合布局' }
export type TaskWidget = {
  id: string; kind: TaskWidgetKind; title: string; listId: string | null; dimension: string; measure: string
  aggregation: 'count' | 'distinct' | 'sum' | 'average' | 'max' | 'min' | 'ratio'
  filters: TaskFilter[]; sorts: TaskSort[]; includeSubtasks: boolean; color: string; width: number; height: number
  content: string; target: number; targetDate: string | null; action: { kind: 'task' | 'list' | 'dashboard'; id: string } | null
  children: TaskWidget[]; secondaryDimension?: string
}
export type TaskDashboard = TaskBase & { title: string; scope: string; theme: 'light' | 'dark' | 'blue'; filters: TaskFilter[]; widgets: TaskWidget[] }
export type TaskTemplate = TaskBase & { title: string; defaultGroupTitle?: string; groups: string[]; tasks: (Pick<WorkspaceTask, 'title' | 'description' | 'priority' | 'values'> & { groupTitle?: string; parentIndex?: number; dependencyIndexes?: number[] })[]; fieldIds: string[] }
export type TaskWorkspaceSnapshot = { tasks: WorkspaceTask[]; projects: TaskProject[]; lists: TaskList[]; folders: TaskFolder[]; groups: TaskGroup[]; fields: TaskField[]; people: TaskPerson[]; views: TaskView[]; dashboards: TaskDashboard[]; templates: TaskTemplate[]; attachments: TaskAttachment[]; selfId: string }
type Save<K extends string, T> = { type: K; input: Partial<Omit<T, keyof TaskBase>> & { id?: string }; expectedVersion?: number }
export type TaskCommand = { commandId: string } & (
  | Save<'save-task', WorkspaceTask> | Save<'save-list', TaskList> | Save<'save-folder', TaskFolder>
  | Save<'save-group', TaskGroup> | Save<'save-field', TaskField> | Save<'save-person', TaskPerson>
  | Save<'save-view', TaskView> | Save<'save-dashboard', TaskDashboard>
  | { type: 'delete'; kind: 'task' | 'list' | 'folder' | 'group' | 'field' | 'person' | 'dashboard' | 'template' | 'attachment'; id: string; expectedVersion: number }
  | { type: 'batch'; tasks: { id: string; expectedVersion: number; patch?: Partial<WorkspaceTask>; delete?: boolean }[] }
  | { type: 'copy-task'; id: string; expectedVersion: number }
  | { type: 'save-template'; listId: string; title: string }
  | { type: 'apply-template'; templateId: string; title: string; folderId?: string | null }
)
export type TaskCommandResult = { entityId: string }
export type TaskHistoryQuery = { entityId?: string; listId?: string; before?: string; limit?: number }
export type TaskWorkspaceApi = {
  initializeTaskWorkspace: (legacy: Record<string, string>) => Promise<void>
  getTaskWorkspace: () => Promise<TaskWorkspaceSnapshot>
  runTaskCommand: (command: TaskCommand) => Promise<TaskCommandResult>
  getTaskHistory: (query?: TaskHistoryQuery) => Promise<TaskEvent[]>
  addTaskAttachments: (taskId: string) => Promise<void>
  openTaskAttachment: (id: string) => Promise<void>
  readTaskAttachment: (id: string) => Promise<string | null>
  onTaskWorkspaceUpdated: (listener: () => void) => () => void
}

export const taskBuiltinFields = [
  ['priority', '优先级'], ['ownerId', '负责人'], ['startDate', '开始时间'], ['dueDate', '截止时间'],
  ['projectIds', '关联项目'],
  ['subtaskProgress', '子任务进度'], ['lists', '所属清单'], ['source', '任务来源'], ['creatorId', '创建人'], ['assignerId', '分配人'],
  ['starred', '关注'], ['createdAt', '创建时间'], ['completedAt', '完成时间'], ['updatedAt', '更新时间'], ['id', '任务 ID'],
   ['_durationDays', '计划时长（天）'], ['_elapsedDays', '完成耗时（天）']
] as const
export function taskDateInZone(value: string, timezone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)?.value).join('-')
}
export function taskOverdue(task: WorkspaceTask, now = new Date()): boolean {
  if (task.done || !task.dueDate) return false
  return task.dueDate.length === 10 ? task.dueDate < taskDateInZone(now.toISOString(), task.timezone) : Date.parse(task.dueDate) < now.getTime()
}
export function taskFieldValue(task: WorkspaceTask, field: string): TaskValue {
  if (field === '_overdue') return taskOverdue(task)
  if (field === '_durationDays') return task.startDate && task.dueDate ? Math.max(0, (Date.parse(task.dueDate) - Date.parse(task.startDate)) / 86400000) + (task.dueDate.length === 10 ? 1 : 0) : null
  if (field === '_elapsedDays') return task.completedAt ? Math.max(0, (Date.parse(task.completedAt) - Date.parse(task.createdAt)) / 86400000) : null
  if (field === 'lists') return task.links.map(link => link.listId)
  return (task.values[field] ?? (task as unknown as Record<string, TaskValue>)[field]) ?? null
}
export function scopeTaskItems(snapshot: TaskWorkspaceSnapshot, scope: string): WorkspaceTask[] {
  return snapshot.tasks.filter(task => scope === 'mine' ? task.ownerId === snapshot.selfId : scope === 'starred' ? task.starred : scope === 'created' ? task.creatorId === snapshot.selfId : scope === 'assigned' ? task.assignerId === snapshot.selfId && task.ownerId !== null : scope === 'done' ? task.done : ['all', 'activity'].includes(scope) ? true : task.links.some(link => link.listId === scope))
}
export function matchesTaskFilters(task: WorkspaceTask, filters: TaskFilter[]): boolean {
  return filters.every(filter => {
    const value = taskFieldValue(task, filter.field)
    let text = Array.isArray(value) ? value.join(',') : String(value ?? '')
    const expected = String(filter.value ?? '')
    if (['startDate', 'dueDate', 'createdAt', 'completedAt', 'updatedAt'].includes(filter.field) && /^\d{4}-\d{2}-\d{2}$/.test(expected) && typeof value === 'string' && value.length > 10) text = taskDateInZone(value, task.timezone)
    if (filter.operator === 'empty') return value === null || text === ''
    if (filter.operator === 'contains') return text.toLocaleLowerCase().includes(expected.toLocaleLowerCase())
    if (filter.operator === 'eq') return Array.isArray(value) ? value.includes(expected) : text === expected
    if (filter.operator === 'ne') return Array.isArray(value) ? !value.includes(expected) : text !== expected
    const a = typeof value === 'number' ? value : text, b = typeof value === 'number' ? Number(filter.value) : expected
    return filter.operator === 'gt' ? a > b : a < b
  })
}
export function sortWorkspaceTasks(tasks: WorkspaceTask[], sorts: TaskSort[], snapshot?: TaskWorkspaceSnapshot): WorkspaceTask[] {
  const valueFor = (task: WorkspaceTask, field: string): TaskValue => {
    if (field === 'priority') return { low: 1, medium: 2, high: 3 }[task.priority]
    const value = taskFieldValue(task, field)
    if (snapshot && field === 'projectIds') return task.projectIds.map(id => snapshot.projects.find(project => project.id === id)?.name ?? '').join('、')
    if (snapshot && ['ownerId', 'creatorId', 'assignerId'].includes(field)) return snapshot.people.find(person => person.id === value)?.name ?? ''
    const definition = snapshot?.fields.find(item => item.id === field)
    if (definition?.type === 'single') return definition.options.find(option => option.id === value)?.label ?? ''
    return value
  }
  return [...tasks].sort((a, b) => {
    for (const sort of sorts) {
      const left = valueFor(a, sort.field), right = valueFor(b, sort.field)
      const diff = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'zh-CN', { numeric: true })
      if (diff) return diff * (sort.direction === 'asc' ? 1 : -1)
    }
    return 0
  })
}
export function aggregateTaskValues(tasks: WorkspaceTask[], widget: Pick<TaskWidget, 'aggregation' | 'measure'>): number {
  const unique = [...new Map(tasks.map(task => [task.id, task])).values()]
  if (widget.aggregation === 'count') return unique.length
  if (widget.aggregation === 'distinct') return new Set(unique.map(task => JSON.stringify(taskFieldValue(task, widget.measure)))).size
  if (widget.aggregation === 'ratio') return unique.length ? unique.filter(task => Boolean(taskFieldValue(task, widget.measure))).length / unique.length * 100 : 0
  const values = unique.map(task => taskFieldValue(task, widget.measure)).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!values.length) return 0
  if (widget.aggregation === 'max') return Math.max(...values)
  if (widget.aggregation === 'min') return Math.min(...values)
  const total = values.reduce((sum, value) => sum + value, 0)
  return widget.aggregation === 'average' ? total / values.length : total
}
export function newTaskWidget(kind: TaskWidgetKind, id: string): TaskWidget {
  return { id, kind, title: taskWidgetLabels[kind], listId: null, dimension: 'ownerId', measure: 'id', aggregation: 'count', filters: [], sorts: [], includeSubtasks: true, color: '#5c7cfa', width: kind === 'metric' ? 3 : 6, height: kind === 'metric' ? 190 : 320, content: '', target: 100, targetDate: null, action: null, children: [] }
}
export function makeDefaultTaskDashboard(scope: string, id: () => string): Omit<TaskDashboard, keyof TaskBase> {
  const widgets = (['metric', 'metric', 'metric', 'metric', 'donut', 'donut', 'bar', 'horizontal', 'wordcloud', 'bar'] as TaskWidgetKind[]).map(kind => newTaskWidget(kind, id()))
  Object.assign(widgets[0], { title: '全部任务', color: '#30343b' })
  Object.assign(widgets[1], { title: '已完成', color: '#62c23d', filters: [{ field: 'done', operator: 'eq', value: true }] })
  Object.assign(widgets[2], { title: '未完成', color: '#facb42', filters: [{ field: 'done', operator: 'eq', value: false }] })
  Object.assign(widgets[3], { title: '已逾期', color: '#eb6b68', filters: [{ field: '_overdue', operator: 'eq', value: true }] })
  Object.assign(widgets[4], { title: '任务完成进度', dimension: 'done', color: '#96dcb0' })
  Object.assign(widgets[5], { title: '任务逾期率', dimension: '_overdue', color: '#f1aaa8' })
  widgets[6].title = '按负责人统计任务量'
  Object.assign(widgets[7], { title: '按负责人统计平均计划时长 / 天', aggregation: 'average', measure: '_durationDays' })
  widgets[8].title = '任务主题'
  Object.assign(widgets[9], { title: '按自定义分组统计任务量', dimension: '_group' })
  return { title: '仪表盘', scope, theme: 'light', filters: [], widgets }
}
