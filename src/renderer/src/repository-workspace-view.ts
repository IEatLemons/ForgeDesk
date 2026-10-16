import type { Repository } from './data'
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
