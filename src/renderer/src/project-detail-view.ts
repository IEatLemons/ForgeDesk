import type { TerminalOpenRequest } from './terminal-panel-events.js'
import { createTerminalReuseKey } from './terminal-panel-state.js'

export type ProjectDetailTabKey = 'data' | 'log-tree' | 'remote-alignment' | 'service-monitor' | 'terminal'

export type ProjectDetailTab = { key: ProjectDetailTabKey; label: string }

export const PROJECT_DETAIL_TABS: ProjectDetailTab[] = [
  { key: 'data', label: '数据' },
  { key: 'log-tree', label: 'Log 树' },
  { key: 'remote-alignment', label: '多端对齐' },
  { key: 'service-monitor', label: '服务监控' },
  { key: 'terminal', label: '终端' }
]

export function createProjectDetailTabs(hasBoundServices: boolean): ProjectDetailTab[] {
  return PROJECT_DETAIL_TABS.filter((tab) => tab.key !== 'service-monitor' || hasBoundServices)
}

export function resolveProjectDetailTab(tab: ProjectDetailTabKey, hasBoundServices: boolean): ProjectDetailTabKey {
  return createProjectDetailTabs(hasBoundServices).some((item) => item.key === tab) ? tab : 'data'
}

export type RepositorySummarySource = {
  currentBranch: string
  latestCommit: string
  localPath: string
  name: string
}

export type RepositorySummaryField = {
  label: string
  value: string
  strong?: boolean
}

export type ProjectTerminalSource = {
  id: string
  name: string
  workspacePath: string
}

export type RepositoryTerminalSource = {
  id: string
  projectId?: string
  name: string
  localPath: string
}

export function shouldShowRepositorySummary(_tab: ProjectDetailTabKey, hasRepository: boolean): boolean {
  return hasRepository
}

export function createRepositorySummaryFields(repository: RepositorySummarySource, commitCount: number): RepositorySummaryField[] {
  return [
    {
      label: '当前分支',
      value: repository.currentBranch,
      strong: true
    },
    {
      label: '最近提交',
      value: repository.latestCommit
    },
    {
      label: '提交总数',
      value: String(commitCount),
      strong: true
    }
  ]
}

export function createProjectTerminalOpenRequest(project: ProjectTerminalSource): TerminalOpenRequest {
  return {
    cwd: project.workspacePath,
    projectId: project.id,
    reuseKey: createTerminalReuseKey('project', project.id),
    title: project.name
  }
}

export function createRepositoryTerminalOpenRequest(repository: RepositoryTerminalSource): TerminalOpenRequest {
  return {
    cwd: repository.localPath,
    projectId: repository.projectId,
    repositoryId: repository.id,
    reuseKey: createTerminalReuseKey('repository', repository.id),
    title: repository.name
  }
}

export function chooseTerminalShortcutProject<T extends ProjectTerminalSource>(projects: T[], selectedProjectId?: string | null): T | null {
  return projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null
}
