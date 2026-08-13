export type ProjectGitTaskLogFilter = {
  projectId: string
  action: 'all' | 'fetch' | 'push' | 'merge'
  status: 'all' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled' | 'interrupted'
}

export type ProjectGitTaskStatusMeta = {
  label: string
  color: string
  badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning'
}

export function getProjectGitTaskStatusMeta(status: ProjectGitTaskStatus): ProjectGitTaskStatusMeta {
  if (status === 'running') {
    return { label: '执行中', color: 'blue', badgeStatus: 'processing' }
  }

  if (status === 'success') {
    return { label: '成功', color: 'green', badgeStatus: 'success' }
  }

  if (status === 'skipped') {
    return { label: '跳过', color: 'default', badgeStatus: 'default' }
  }

  if (status === 'cancelled') {
    return { label: '已终止', color: 'orange', badgeStatus: 'warning' }
  }

  if (status === 'interrupted') {
    return { label: '已中断', color: 'orange', badgeStatus: 'warning' }
  }

  return { label: '失败', color: 'red', badgeStatus: 'error' }
}

export function filterProjectGitTaskLogs(logs: ProjectGitTaskLog[], filter: ProjectGitTaskLogFilter): ProjectGitTaskLog[] {
  return logs.filter((log) =>
    (filter.projectId === 'all' || log.projectId === filter.projectId) &&
    (filter.action === 'all' || log.action === filter.action) &&
    (filter.status === 'all' || log.status === filter.status)
  )
}

export function countRunningProjectGitTaskLogs(logs: ProjectGitTaskLog[]): number {
  return logs.filter((log) => log.status === 'running').length
}
