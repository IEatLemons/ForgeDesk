import type { ProjectOperations } from './project-operations'
import type { ProjectRuntimeSnapshot } from './project-runtime'
import { taskDateInZone, taskOverdue, type WorkspaceTask } from './task-workspace.js'

export const taskSummaryFilters = ['todo', 'doing', 'done', 'urgent', 'overdue', 'blocked', 'awaitingParentCompletion'] as const
export type TaskSummaryFilter = typeof taskSummaryFilters[number]
export const taskSummaryLabels: Record<TaskSummaryFilter, string> = { todo: '待办', doing: '已到开始时间', done: '已完成', urgent: '紧急', overdue: '逾期', blocked: '阻塞', awaitingParentCompletion: '待完成父任务' }
export type DirectoryTaskSummary = { active: boolean; counts: Record<TaskSummaryFilter, number> | null; updatedAt: string; error: string }
export type ProjectDirectorySummary = {
  projectId: string
  tasks: DirectoryTaskSummary
  operations: ProjectOperations | null
  operationsError: string
  servers: (ProjectRuntimeSnapshot & { name: string })[]
  serversError: string
}
export type ProjectDirectoryApi = {
  readProjectDirectorySummaries: (input: { projectIds: string[] }) => Promise<ProjectDirectorySummary[]>
}

// Summary badges and destination filters share the same membership rules.
export function summaryTaskSelection(items: WorkspaceTask[], filter?: TaskSummaryFilter, now = new Date(), context = items): WorkspaceTask[] {
  if (!filter) return items
  const byId = new Map(context.map(item => [item.id, item]))
  const children = new Map<string, WorkspaceTask[]>()
  for (const item of items) if (item.parentId) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item])
  if (filter === 'awaitingParentCompletion') return items.filter(item => !item.done && children.has(item.id) && children.get(item.id)!.every(child => child.done))
  const leaves = items.filter(item => !children.has(item.id))
  return leaves.filter(item => {
    if (filter === 'done') return item.done
    if (item.done) return false
    const started = !!item.startDate && (item.startDate.length === 10 ? item.startDate <= taskDateInZone(now.toISOString(), item.timezone) : Date.parse(item.startDate) <= now.getTime())
    if (filter === 'todo') return !started
    if (filter === 'doing') return started
    if (filter === 'urgent') return item.priority === 'high'
    if (filter === 'overdue') return taskOverdue(item, now)
    const visited = new Set<string>()
    let current: WorkspaceTask | undefined = item
    while (current && !visited.has(current.id)) {
      if (current.dependencyIds.some(id => !byId.get(id)?.done)) return true
      visited.add(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return false
  })
}

export function directoryTaskSummary(items: WorkspaceTask[], active: boolean, asOf: string, timezone: string, context = items): DirectoryTaskSummary {
  const tasks = items.map(item => ({ ...item, timezone: item.timezone || timezone }))
  return { active, counts: active ? Object.fromEntries(taskSummaryFilters.map(key => [key, summaryTaskSelection(tasks, key, new Date(asOf), context).length])) as Record<TaskSummaryFilter, number> : null, updatedAt: asOf, error: '' }
}
