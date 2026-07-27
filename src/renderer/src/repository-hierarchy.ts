import type { Repository } from './data'

export type RepositoryHierarchySource = Pick<
  Repository,
  | 'id'
  | 'name'
  | 'repositoryKind'
  | 'parentRepositoryId'
  | 'relativePath'
  | 'submoduleState'
  | 'available'
  | 'isDetached'
>

export type RepositoryHierarchyItem<T extends RepositoryHierarchySource = RepositoryHierarchySource> = {
  repository: T
  depth: number
}

export type RepositoryStateMeta = {
  label: string
  color: 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'default'
}

export function getRepositoryKindLabel(repository: Pick<Repository, 'repositoryKind' | 'parentRepositoryId'>): string {
  if (repository.repositoryKind === 'submodule') {
    return '子模块'
  }

  return repository.parentRepositoryId ? '子项目' : '主仓库'
}

export function sortRepositoriesHierarchically<T extends RepositoryHierarchySource>(repositories: T[]): RepositoryHierarchyItem<T>[] {
  const byParent = new Map<string, T[]>()
  const byId = new Map(repositories.map((repository) => [repository.id, repository]))

  for (const repository of repositories) {
    const parentId = repository.parentRepositoryId && byId.has(repository.parentRepositoryId) ? repository.parentRepositoryId : ''
    const children = byParent.get(parentId) ?? []
    children.push(repository)
    byParent.set(parentId, children)
  }

  for (const children of byParent.values()) {
    children.sort((left, right) => {
      if (left.repositoryKind !== right.repositoryKind) {
        return left.repositoryKind === 'root' ? -1 : 1
      }

      return (left.relativePath || left.name).localeCompare(right.relativePath || right.name)
    })
  }

  const result: RepositoryHierarchyItem<T>[] = []
  const visited = new Set<string>()

  function append(parentId: string, depth: number): void {
    for (const repository of byParent.get(parentId) ?? []) {
      if (visited.has(repository.id)) {
        continue
      }

      visited.add(repository.id)
      result.push({ repository, depth })
      append(repository.id, depth + 1)
    }
  }

  append('' , 0)

  for (const repository of repositories) {
    if (!visited.has(repository.id)) {
      visited.add(repository.id)
      result.push({ repository, depth: 0 })
      append(repository.id, 1)
    }
  }

  return result
}

export function getNestedProjectRepositories<T extends RepositoryHierarchySource>(repositories: T[]): RepositoryHierarchyItem<T>[] {
  return sortRepositoriesHierarchically(repositories).filter(({ repository }) => Boolean(repository.parentRepositoryId))
}

export function getRepositoryStateMeta(repository: Pick<Repository, 'repositoryKind' | 'submoduleState' | 'available' | 'isDetached'>): RepositoryStateMeta {
  if (!repository.available) {
    return { label: repository.submoduleState === 'uninitialized' ? '未初始化' : '不可用', color: 'red' }
  }

  if (repository.repositoryKind === 'submodule') {
    if (repository.submoduleState === 'conflicted') {
      return { label: '冲突', color: 'red' }
    }

    if (repository.submoduleState === 'changed') {
      return { label: '提交不一致', color: 'orange' }
    }

    if (repository.submoduleState === 'dirty') {
      return { label: '有改动', color: 'orange' }
    }

    if (repository.submoduleState === 'aligned') {
      return { label: '已对齐', color: 'green' }
    }
  }

  return repository.isDetached ? { label: 'Detached HEAD', color: 'cyan' } : { label: '可用', color: 'blue' }
}

export function getRepositoryDisplayLabel(repository: Pick<Repository, 'name' | 'relativePath' | 'repositoryKind' | 'parentRepositoryId'>, depth = 0): string {
  const indent = depth > 0 ? `${'　'.repeat(depth)}↳ ` : ''
  const kind = getRepositoryKindLabel(repository)
  const path = repository.relativePath && repository.relativePath !== '.' ? ` · ${repository.relativePath}` : ''
  return `${indent}${repository.name}（${kind}${path}）`
}

export function getProjectRepositoryStats(repositories: RepositoryHierarchySource[]): {
  total: number
  roots: number
  subprojects: number
  submodules: number
  unavailable: number
} {
  return {
    total: repositories.length,
    roots: repositories.filter((repository) => repository.repositoryKind === 'root' && !repository.parentRepositoryId).length,
    subprojects: repositories.filter((repository) => repository.repositoryKind === 'root' && Boolean(repository.parentRepositoryId)).length,
    submodules: repositories.filter((repository) => repository.repositoryKind === 'submodule').length,
    unavailable: repositories.filter((repository) => !repository.available).length
  }
}

export function createRepositorySelectOptions(repositories: Repository[]): Array<{ label: string; value: string; disabled?: boolean }> {
  return sortRepositoriesHierarchically(repositories).map(({ repository, depth }) => ({
    label: getRepositoryDisplayLabel(repository, depth),
    value: repository.id,
    disabled: !repository.available
  }))
}
