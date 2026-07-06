import type { TerminalOpenRequest } from './terminal-panel-events.js'
import { createTerminalReuseKey } from './terminal-panel-state.js'

export type ProjectDetailTabKey = 'data' | 'log-tree' | 'remote-alignment' | 'plane' | 'service-monitor' | 'terminal'

export type ProjectDetailTab = { key: ProjectDetailTabKey; label: string }

export type ProjectDetailTabAvailability = {
  hasBoundServices: boolean
  hasRemoteAlignment: boolean
  hasPlane: boolean
}

export type ProjectDetailRepositoryRemoteSource = {
  remoteCount?: number
  remotes?: Array<{ name?: string } | null> | null
  remoteUrl?: string | null
}

export const PROJECT_DETAIL_TABS: ProjectDetailTab[] = [
  { key: 'log-tree', label: 'Log 树' },
  { key: 'data', label: '数据' },
  { key: 'terminal', label: '终端' },
  { key: 'remote-alignment', label: '多端对齐' },
  { key: 'plane', label: 'Plane' },
  { key: 'service-monitor', label: '服务监控' }
]

export const DEFAULT_PROJECT_DETAIL_TAB: ProjectDetailTabKey = 'log-tree'

export function getRepositoryRemoteCount(repository: ProjectDetailRepositoryRemoteSource): number {
  const explicitRemoteCount =
    typeof repository.remoteCount === 'number' && Number.isFinite(repository.remoteCount) ? Math.max(0, repository.remoteCount) : 0
  const namedRemoteCount = repository.remotes?.filter((remote) => remote?.name).length ?? 0
  const legacyRemoteCount = repository.remoteUrl ? 1 : 0

  return Math.max(explicitRemoteCount, namedRemoteCount, legacyRemoteCount)
}

export function hasProjectRemoteAlignment(repositories: ProjectDetailRepositoryRemoteSource[]): boolean {
  return repositories.some((repository) => getRepositoryRemoteCount(repository) >= 2)
}

export function createProjectDetailTabs(availability: ProjectDetailTabAvailability): ProjectDetailTab[] {
  return PROJECT_DETAIL_TABS.filter((tab) => {
    if (tab.key === 'service-monitor') {
      return availability.hasBoundServices
    }

    if (tab.key === 'remote-alignment') {
      return availability.hasRemoteAlignment
    }

    if (tab.key === 'plane') {
      return availability.hasPlane
    }

    return true
  })
}

export function resolveProjectDetailTab(tab: ProjectDetailTabKey, availability: ProjectDetailTabAvailability): ProjectDetailTabKey {
  return createProjectDetailTabs(availability).some((item) => item.key === tab) ? tab : DEFAULT_PROJECT_DETAIL_TAB
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
