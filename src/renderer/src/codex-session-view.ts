import type { CodexProjectMonitorItem, CodexProjectMonitorSnapshot, CodexSessionSummary, CodexWorktree, Project } from './data'

type MonitorFilters = {
  projectId?: string
  providerId?: string
  showArchivedProjects: boolean
}

export function filterCodexMonitorSnapshot(snapshot: CodexProjectMonitorSnapshot, forgeProjects: Pick<Project, 'id' | 'archivedAt'>[], filters: MonitorFilters): CodexProjectMonitorSnapshot {
  const archivedIds = new Set(forgeProjects.filter((project) => project.archivedAt).map((project) => project.id))
  const matches = (project: CodexProjectMonitorItem): boolean =>
    (!filters.projectId || project.forgeProjectId === filters.projectId)
    && (!filters.providerId || (project.providerId || 'codex') === filters.providerId)
    && (filters.showArchivedProjects || !project.forgeProjectId || !archivedIds.has(project.forgeProjectId))
  const projects = snapshot.projects.filter(matches)
  const cursorProjects = snapshot.cursor?.projects.filter(matches) ?? []
  const allProjects = [...projects, ...cursorProjects]
  const visibleAlert = (alert: CodexProjectMonitorSnapshot['alerts'][number]): boolean => allProjects.some((project) =>
    project.key === alert.codexKey && (project.providerId || 'codex') === (alert.providerId || 'codex'))
  const alerts = snapshot.alerts.filter(visibleAlert)
  const cursorAlerts = snapshot.cursor?.alerts.filter(visibleAlert) ?? []
  const sessionIds = new Set(projects.flatMap((project) => project.sessions.map((session) => session.id)))
  const totals = (items: CodexProjectMonitorItem[]) => ({
    running: items.reduce((sum, project) => sum + project.runningCount, 0),
    completed: items.reduce((sum, project) => sum + project.completedCount, 0),
    failed: items.reduce((sum, project) => sum + project.failedCount, 0),
    unlinked: items.filter((project) => !project.forgeProjectId).length
  })
  return {
    ...snapshot,
    ...totals(allProjects),
    projects,
    alerts,
    uncommitted: alerts.length,
    sessions: snapshot.sessions.filter((session) => sessionIds.has(session.id)),
    cursor: snapshot.cursor ? {
      ...snapshot.cursor,
      ...totals(cursorProjects),
      projects: cursorProjects,
      alerts: cursorAlerts,
      uncommitted: cursorAlerts.length
    } : undefined
  }
}

function normalizedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function containsPath(root: string, path: string): boolean {
  const normalizedRoot = normalizedPath(root)
  const normalized = normalizedPath(path)
  return Boolean(normalizedRoot && normalized) && (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`))
}

export type CodexSessionWorkspace = {
  project: CodexProjectMonitorItem
  worktree: CodexWorktree | null
  mainPath: string
  path: string
  label: string
  branch: string
}

export function getCodexSessionWorkspace(session: Pick<CodexSessionSummary, 'id' | 'cwd' | 'projectKey'>, projects: CodexProjectMonitorItem[]): CodexSessionWorkspace | null {
  const project = projects.find((project) => project.key === session.projectKey)
    ?? projects.find((project) => project.sessions.some((item) => item.id === session.id))
  if (!project) return null
  const worktree = project.worktrees.find((worktree) => worktree.sessionIds.includes(session.id))
    ?? [...project.worktrees].filter((worktree) => containsPath(worktree.path, session.cwd)).sort((left, right) => right.path.length - left.path.length)[0]
    ?? null
  return {
    project,
    worktree,
    path: worktree?.path || project.git.repositoryRoot || session.cwd,
    mainPath: project.worktrees.find((worktree) => worktree.isMain)?.path || '',
    label: worktree ? worktree.isMain ? '主工作树' : '独立工作树' : project.git.repositoryAvailable ? 'Git 工作目录' : '工作目录不可用或非 Git 仓库',
    branch: worktree?.detached ? `分离 HEAD${worktree.head ? ` · ${worktree.head.slice(0, 8)}` : ''}` : worktree?.branch || project.git.branch || ''
  }
}
