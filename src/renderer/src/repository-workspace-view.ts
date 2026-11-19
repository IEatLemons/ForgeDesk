import type { Repository } from './data'
import type { AppRoute } from './workspace-navigation'
import { sortRepositoriesHierarchically } from './repository-hierarchy.js'

export const REPOSITORY_VIEWS = [
  { key: 'history', label: '提交树' },
  { key: 'changes', label: '变更' },
  { key: 'branches', label: '分支' },
  { key: 'alignment', label: '远端对齐' }
] as const

export type RepositoryView = typeof REPOSITORY_VIEWS[number]['key']

export function getRepositoryView(value?: string): RepositoryView {
  return REPOSITORY_VIEWS.find(view => view.key === value)?.key ?? 'history'
}

export function getRepositoryDirectoryRows(repositories: Repository[], query: string) {
  const term = query.trim().toLocaleLowerCase()
  return sortRepositoriesHierarchically(repositories).filter(({ repository }) => !term ||
    [repository.name, repository.localPath, repository.currentBranch].some(value => value.toLocaleLowerCase().includes(term)))
}

// Resolve the landing view without adding a redirect/history entry. An explicit
// directory visit (the header's back button) remains a directory even for one repo.
export function repositoryLandingId(route: AppRoute, repositories: Repository[]): string | undefined {
  if (route.scope !== 'project' || route.page !== 'repositories' || route.repositoryId || route.view === 'directory') return undefined
  let only: Repository | undefined
  for (const repository of repositories) {
    if (repository.projectId !== route.projectId) continue
    if (only) return undefined
    only = repository
  }
  return only?.id
}

export function resolveRepositoryLanding(route: AppRoute, repositories: Repository[]): AppRoute {
  const repositoryId = repositoryLandingId(route, repositories)
  return route.scope === 'project' && repositoryId ? { ...route, repositoryId, view: route.view ?? 'history' } : route
}
