import type { CodexTaskRecord, CodexTaskRunStatus, Project } from './data'

export type AiChatContextKind = 'home' | 'project' | 'directory'

export type AiChatContextInput = {
  kind: AiChatContextKind
  id?: string
  path?: string
}

export type CodexTaskGroup = {
  key: string
  label: string
  tasks: CodexTaskRecord[]
}

export const codexTaskStatusLabels: Record<CodexTaskRunStatus, string> = {
  cancelled: '已取消',
  failed: '失败',
  idle: '就绪',
  running: '运行中',
  succeeded: '完成'
}

export function createAiChatReuseKey(context: AiChatContextInput): string {
  const stableValue = context.kind === 'project' && context.id
    ? context.id
    : context.path?.trim() || 'home'

  return `ai-chat:${context.kind}:${stableValue}`
}

export function createCodexTaskTitle(prompt: string): string {
  const normalized = prompt.trim().split(/\r?\n/).find(Boolean)?.replace(/\s+/g, ' ').trim() ?? ''
  return normalized ? normalized.slice(0, 64) : '新对话'
}

export function sortCodexTasks(tasks: CodexTaskRecord[]): CodexTaskRecord[] {
  return [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function upsertCodexTask(tasks: CodexTaskRecord[], task: CodexTaskRecord): CodexTaskRecord[] {
  const existingIndex = tasks.findIndex((item) => item.id === task.id)
  const nextTasks = existingIndex < 0
    ? [task, ...tasks]
    : tasks.map((item, index) => (index === existingIndex ? task : item))

  return sortCodexTasks(nextTasks)
}

export function removeCodexTask(tasks: CodexTaskRecord[], taskId: string): CodexTaskRecord[] {
  return tasks.filter((task) => task.id !== taskId)
}

export function groupCodexTasks(tasks: CodexTaskRecord[], projects: Project[]): CodexTaskGroup[] {
  const projectNames = new Map(projects.map((project) => [project.id, project.name]))
  const groups = new Map<string, CodexTaskGroup>()

  for (const task of sortCodexTasks(tasks)) {
    const key = task.projectId || 'local'
    const label = task.projectId ? projectNames.get(task.projectId) || '项目任务' : '本地'
    const group = groups.get(key) ?? { key, label, tasks: [] }

    group.tasks.push(task)
    groups.set(key, group)
  }

  return Array.from(groups.values())
}

export function getCodexTaskStatusTone(status: CodexTaskRunStatus): 'default' | 'processing' | 'success' | 'error' | 'warning' {
  if (status === 'running') return 'processing'
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'warning'
  return 'default'
}

export function formatCodexChangeStat(task: Pick<CodexTaskRecord, 'additions' | 'deletions' | 'filesChanged'>): string {
  if (task.filesChanged === 0 && task.additions === 0 && task.deletions === 0) {
    return '无变更'
  }

  return `${task.filesChanged} 个文件  +${task.additions} -${task.deletions}`
}
