import type { ProjectOperations } from './project-operations'
import type { ProjectRuntimeSnapshot } from './project-runtime'
import type { ProjectWorkItem } from './project-progress'

export const taskSummaryFilters = ['todo', 'doing', 'review', 'urgent', 'overdue', 'blocked', 'awaitingParentAcceptance'] as const
export type TaskSummaryFilter = typeof taskSummaryFilters[number]
export const taskSummaryLabels: Record<TaskSummaryFilter, string> = { todo: '待办', doing: '进行中', review: '待验收', urgent: '紧急', overdue: '逾期', blocked: '阻塞', awaitingParentAcceptance: '等待父任务验收' }
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
export function summaryTaskSelection(items: ProjectWorkItem[], filter?: TaskSummaryFilter, today = ''): ProjectWorkItem[] {
  const eligible = items.filter(item => !item.archivedAt && item.trackingState === 'tracked' && item.status !== 'cancelled')
  const byId = new Map(items.map(item => [item.id, item]))
  const children = new Map<string, ProjectWorkItem[]>()
  for (const item of eligible) if (item.parentId) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item])
  const roots = eligible.filter(item => !item.parentId)
  if (filter === 'awaitingParentAcceptance') return roots.filter(item => item.status !== 'done' && children.has(item.id) && children.get(item.id)!.every(child => child.status === 'done'))
  const leaves = roots.flatMap(root => children.get(root.id) ?? [root])
  return leaves.filter(item => {
    if (!filter) return true
    if (['todo', 'doing', 'review'].includes(filter)) return item.status === filter
    if (item.status === 'done') return false
    if (filter === 'urgent') return item.priority === 'high'
    if (filter === 'overdue') return !!item.dueDate && item.dueDate < today
    const parent = item.parentId ? byId.get(item.parentId) : undefined
    return [item, ...(parent ? [parent] : [])].some(work => work.blockers.some(blocker => !blocker.resolvedAt) || work.dependencyIds.some(id => byId.get(id)?.status !== 'done'))
  })
}

export function directoryTaskSummary(items: ProjectWorkItem[], active: boolean, asOf: string, timezone: string): DirectoryTaskSummary {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(asOf))
  const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
  return { active, counts: active ? Object.fromEntries(taskSummaryFilters.map(key => [key, summaryTaskSelection(items, key, today).length])) as Record<TaskSummaryFilter, number> : null, updatedAt: asOf, error: '' }
}
