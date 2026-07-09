export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskViewMode = 'list' | 'board' | 'gantt'
export type TaskDueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none'
export type TaskSortKey = 'updated' | 'due' | 'priority' | 'created'

export type TaskItem = {
  id: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  projectId: string | null
  startDate: string | null
  dueDate: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type TaskFilterState = {
  query: string
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  projectId: string
  due: TaskDueFilter
  tag: string
  sort: TaskSortKey
}

export type TaskStats = {
  total: number
  active: number
  todo: number
  doing: number
  done: number
  overdue: number
  dueToday: number
}

export type TaskTimelineSection = {
  key: 'overdue' | 'today' | 'week' | 'later' | 'none' | 'done'
  title: string
  tasks: TaskItem[]
}

export type TaskGanttRow = {
  task: TaskItem
  startDate: string
  endDate: string
  offsetDays: number
  durationDays: number
}

export type TaskGanttRange = {
  startDate: string
  endDate: string
  totalDays: number
  ticks: string[]
  rows: TaskGanttRow[]
}

export type TaskListStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export const taskListStorageKey = 'forgedesk.taskList.items.v1'
export const unassignedTaskProjectFilterValue = 'unassigned'

export const defaultTaskFilterState: TaskFilterState = {
  due: 'all',
  priority: 'all',
  projectId: 'all',
  query: '',
  sort: 'updated',
  status: 'all',
  tag: 'all'
}

const taskStatuses: TaskStatus[] = ['todo', 'doing', 'done']
const taskPriorities: TaskPriority[] = ['low', 'medium', 'high']
const priorityRank: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1
}

function createTaskId(now: Date): string {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `task-${now.getTime().toString(36)}-${randomPart}`
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'todo' || value === 'doing' || value === 'done'
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

function normalizeTextValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOptionalTextValue(value: unknown): string | null {
  const normalized = normalizeTextValue(value)
  return normalized || null
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? fallback : value
}

export function formatTaskLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }

  const parsed = new Date(`${trimmed}T00:00:00`)
  return Number.isNaN(parsed.getTime()) || formatTaskLocalDate(parsed) !== trimmed ? null : trimmed
}

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()
  const tags: string[] = []

  for (const item of input) {
    const tag = normalizeTextValue(item)

    if (!tag) {
      continue
    }

    const key = tag.toLocaleLowerCase()

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    tags.push(tag)
  }

  return tags
}

function getTaskListStorage(): TaskListStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function isTaskDueToday(task: TaskItem, today = new Date()): boolean {
  return task.status !== 'done' && task.dueDate === formatTaskLocalDate(today)
}

function isTaskDueThisWeek(task: TaskItem, today = new Date()): boolean {
  if (task.status === 'done' || !task.dueDate) {
    return false
  }

  const todayValue = formatTaskLocalDate(today)
  const weekEndValue = formatTaskLocalDate(addDays(today, 6))

  return task.dueDate >= todayValue && task.dueDate <= weekEndValue
}

export function isTaskOverdue(task: TaskItem, today = new Date()): boolean {
  return task.status !== 'done' && Boolean(task.dueDate && task.dueDate < formatTaskLocalDate(today))
}

function getDateDiffInDays(leftDate: string, rightDate: string): number {
  const left = new Date(`${leftDate}T00:00:00`)
  const right = new Date(`${rightDate}T00:00:00`)

  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) {
    return 0
  }

  return Math.round((right.getTime() - left.getTime()) / 86_400_000)
}

function getTaskCreatedDate(task: TaskItem): string {
  const createdAt = new Date(task.createdAt)
  return Number.isNaN(createdAt.getTime()) ? formatTaskLocalDate(new Date()) : formatTaskLocalDate(createdAt)
}

export function getTaskScheduleRange(task: TaskItem): { startDate: string; endDate: string } {
  const fallbackDate = task.dueDate ?? task.startDate ?? getTaskCreatedDate(task)
  const startDate = task.startDate ?? fallbackDate
  const endDate = task.dueDate ?? fallbackDate

  return endDate < startDate ? { startDate: endDate, endDate: startDate } : { startDate, endDate }
}

export function createTask(input: Partial<TaskItem> = {}, now = new Date()): TaskItem {
  const timestamp = now.toISOString()
  const status = isTaskStatus(input.status) ? input.status : 'todo'
  const completedAt = status === 'done' ? normalizeIsoDate(input.completedAt, timestamp) : null

  return {
    id: normalizeTextValue(input.id) || createTaskId(now),
    title: normalizeTextValue(input.title) || '未命名任务',
    notes: normalizeTextValue(input.notes),
    status,
    priority: isTaskPriority(input.priority) ? input.priority : 'medium',
    projectId: normalizeOptionalTextValue(input.projectId),
    startDate: normalizeDueDate(input.startDate),
    dueDate: normalizeDueDate(input.dueDate),
    tags: normalizeTags(input.tags),
    createdAt: normalizeIsoDate(input.createdAt, timestamp),
    updatedAt: normalizeIsoDate(input.updatedAt, timestamp),
    completedAt
  }
}

export function normalizeTaskList(input: unknown): TaskItem[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return []
      }

      const rawTask = item as Record<string, unknown>
      const id = normalizeTextValue(rawTask.id)

      if (!id) {
        return []
      }

      return [
        createTask({
          id,
          title: normalizeTextValue(rawTask.title),
          notes: normalizeTextValue(rawTask.notes),
          status: isTaskStatus(rawTask.status) ? rawTask.status : undefined,
          priority: isTaskPriority(rawTask.priority) ? rawTask.priority : undefined,
          projectId: normalizeOptionalTextValue(rawTask.projectId),
          startDate: normalizeDueDate(rawTask.startDate),
          dueDate: normalizeDueDate(rawTask.dueDate),
          tags: normalizeTags(rawTask.tags),
          createdAt: normalizeTextValue(rawTask.createdAt),
          updatedAt: normalizeTextValue(rawTask.updatedAt),
          completedAt: normalizeTextValue(rawTask.completedAt)
        })
      ]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function readStoredTaskItems(storage: TaskListStorage | null = getTaskListStorage()): TaskItem[] {
  if (!storage) {
    return []
  }

  try {
    const rawValue = storage.getItem(taskListStorageKey)
    return rawValue ? normalizeTaskList(JSON.parse(rawValue)) : []
  } catch {
    return []
  }
}

export function writeStoredTaskItems(tasks: TaskItem[], storage: TaskListStorage | null = getTaskListStorage()): void {
  if (!storage) {
    return
  }

  try {
    storage.setItem(taskListStorageKey, JSON.stringify(tasks))
  } catch {
    // Task storage is best-effort so the view stays usable in constrained browser contexts.
  }
}

export function getTaskStats(tasks: TaskItem[], today = new Date()): TaskStats {
  return tasks.reduce<TaskStats>(
    (stats, task) => {
      stats.total += 1
      stats.todo += task.status === 'todo' ? 1 : 0
      stats.doing += task.status === 'doing' ? 1 : 0
      stats.done += task.status === 'done' ? 1 : 0
      stats.active += task.status === 'done' ? 0 : 1
      stats.overdue += isTaskOverdue(task, today) ? 1 : 0
      stats.dueToday += isTaskDueToday(task, today) ? 1 : 0

      return stats
    },
    {
      active: 0,
      done: 0,
      dueToday: 0,
      overdue: 0,
      todo: 0,
      doing: 0,
      total: 0
    }
  )
}

export function sortTaskItems(tasks: TaskItem[], sort: TaskSortKey): TaskItem[] {
  return [...tasks].sort((left, right) => {
    if (sort === 'due') {
      if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
        return left.dueDate.localeCompare(right.dueDate)
      }

      if (left.dueDate !== right.dueDate) {
        return left.dueDate ? -1 : 1
      }
    }

    if (sort === 'priority' && left.priority !== right.priority) {
      return priorityRank[right.priority] - priorityRank[left.priority]
    }

    if (sort === 'created') {
      return right.createdAt.localeCompare(left.createdAt)
    }

    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export function filterTaskItems(tasks: TaskItem[], filters: TaskFilterState, today = new Date()): TaskItem[] {
  const query = filters.query.trim().toLocaleLowerCase()
  const tagFilter = filters.tag === 'all' ? '' : filters.tag.toLocaleLowerCase()

  return sortTaskItems(
    tasks.filter((task) => {
      if (filters.status !== 'all' && task.status !== filters.status) {
        return false
      }

      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false
      }

      if (filters.projectId === unassignedTaskProjectFilterValue && task.projectId) {
        return false
      }

      if (filters.projectId !== 'all' && filters.projectId !== unassignedTaskProjectFilterValue && task.projectId !== filters.projectId) {
        return false
      }

      if (tagFilter && !task.tags.some((tag) => tag.toLocaleLowerCase() === tagFilter)) {
        return false
      }

      if (filters.due === 'overdue' && !isTaskOverdue(task, today)) {
        return false
      }

      if (filters.due === 'today' && !isTaskDueToday(task, today)) {
        return false
      }

      if (filters.due === 'week' && !isTaskDueThisWeek(task, today)) {
        return false
      }

      if (filters.due === 'none' && task.dueDate) {
        return false
      }

      if (!query) {
        return true
      }

      const searchableText = [task.title, task.notes, ...task.tags].join(' ').toLocaleLowerCase()
      return searchableText.includes(query)
    }),
    filters.sort
  )
}

export function groupTasksByStatus(tasks: TaskItem[]): Record<TaskStatus, TaskItem[]> {
  return {
    todo: tasks.filter((task) => task.status === 'todo'),
    doing: tasks.filter((task) => task.status === 'doing'),
    done: tasks.filter((task) => task.status === 'done')
  }
}

export function createTaskTimelineSections(tasks: TaskItem[], today = new Date()): TaskTimelineSection[] {
  const todayValue = formatTaskLocalDate(today)
  const weekEndValue = formatTaskLocalDate(addDays(today, 6))
  const sections: TaskTimelineSection[] = [
    { key: 'overdue', title: '已逾期', tasks: [] },
    { key: 'today', title: '今天', tasks: [] },
    { key: 'week', title: '未来 7 天', tasks: [] },
    { key: 'later', title: '更晚', tasks: [] },
    { key: 'none', title: '没有截止日期', tasks: [] },
    { key: 'done', title: '已完成', tasks: [] }
  ]
  const sectionByKey = new Map(sections.map((section) => [section.key, section]))

  for (const task of sortTaskItems(tasks, 'due')) {
    if (task.status === 'done') {
      sectionByKey.get('done')?.tasks.push(task)
    } else if (!task.dueDate) {
      sectionByKey.get('none')?.tasks.push(task)
    } else if (task.dueDate < todayValue) {
      sectionByKey.get('overdue')?.tasks.push(task)
    } else if (task.dueDate === todayValue) {
      sectionByKey.get('today')?.tasks.push(task)
    } else if (task.dueDate <= weekEndValue) {
      sectionByKey.get('week')?.tasks.push(task)
    } else {
      sectionByKey.get('later')?.tasks.push(task)
    }
  }

  return sections.filter((section) => section.tasks.length > 0)
}

export function getTaskTags(tasks: TaskItem[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.tags))].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

export function createTaskGanttRange(tasks: TaskItem[], today = new Date()): TaskGanttRange {
  const scheduledTasks = sortTaskItems(tasks, 'due')
  const fallbackStartDate = formatTaskLocalDate(today)
  const fallbackEndDate = formatTaskLocalDate(addDays(today, 6))
  const ranges = scheduledTasks.map(getTaskScheduleRange)
  const minStartDate = ranges.reduce((current, range) => (range.startDate < current ? range.startDate : current), ranges[0]?.startDate ?? fallbackStartDate)
  const maxEndDate = ranges.reduce((current, range) => (range.endDate > current ? range.endDate : current), ranges[0]?.endDate ?? fallbackEndDate)
  const startDate = minStartDate < fallbackStartDate ? minStartDate : fallbackStartDate
  const endDate = maxEndDate > fallbackEndDate ? maxEndDate : fallbackEndDate
  const totalDays = Math.max(getDateDiffInDays(startDate, endDate) + 1, 1)
  const tickStep = Math.max(Math.ceil(totalDays / 8), 1)
  const ticks: string[] = []

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += tickStep) {
    ticks.push(formatTaskLocalDate(addDays(new Date(`${startDate}T00:00:00`), dayIndex)))
  }

  if (ticks[ticks.length - 1] !== endDate) {
    ticks.push(endDate)
  }

  return {
    endDate,
    startDate,
    ticks,
    totalDays,
    rows: scheduledTasks.map((task) => {
      const range = getTaskScheduleRange(task)
      return {
        task,
        startDate: range.startDate,
        endDate: range.endDate,
        offsetDays: Math.max(getDateDiffInDays(startDate, range.startDate), 0),
        durationDays: Math.max(getDateDiffInDays(range.startDate, range.endDate) + 1, 1)
      }
    })
  }
}
