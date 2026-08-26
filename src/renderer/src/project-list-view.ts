import type { Project, ProjectGroup, Repository } from './data'

export type ProjectListGroupFilter = 'all' | 'favorites' | 'ungrouped' | `group:${string}`

export type ProjectListGroupFilterOption = {
  key: ProjectListGroupFilter
  label: string
  projectCount: number
}

type ProjectRepositoryScopeSource = Pick<Repository, 'id' | 'projectId' | 'localPath' | 'parentRepositoryId' | 'relativePath'>

function normalizeProjectPath(value: string): string {
  const normalized = value.trim().replaceAll('\\', '/')

  if (!normalized) {
    return ''
  }

  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

function isRepositoryInsideProject(projectPath: string, repositoryPath: string): boolean {
  const normalizedProjectPath = normalizeProjectPath(projectPath)
  const normalizedRepositoryPath = normalizeProjectPath(repositoryPath)

  if (!normalizedProjectPath || !normalizedRepositoryPath || normalizedProjectPath === normalizedRepositoryPath) {
    return false
  }

  return normalizedRepositoryPath.startsWith(`${normalizedProjectPath}/`)
}

export function sortProjectsForDisplay(projects: Project[]): Project[] {
  return [...projects].sort((left, right) => {
    const favoriteDifference = Number(right.isFavorite) - Number(left.isFavorite)

    if (favoriteDifference !== 0) {
      return favoriteDifference
    }

    const createdAtDifference = right.createdAt.localeCompare(left.createdAt)
    return createdAtDifference !== 0 ? createdAtDifference : right.id.localeCompare(left.id)
  })
}

export function sortProjectsByGroupForDisplay(projects: Project[], groups: ProjectGroup[]): Project[] {
  const groupRanks = new Map(groups.map((group, index) => [group.id, index]))

  return sortProjectsForDisplay(projects).sort(
    (left, right) => (groupRanks.get(left.groupId ?? '') ?? Number.MAX_SAFE_INTEGER) - (groupRanks.get(right.groupId ?? '') ?? Number.MAX_SAFE_INTEGER)
  )
}

export function createProjectListGroupFilterOptions(
  projects: Project[],
  groups: ProjectGroup[]
): ProjectListGroupFilterOption[] {
  return [
    { key: 'all', label: '全部', projectCount: projects.length },
    { key: 'favorites', label: '已收藏', projectCount: projects.filter((project) => project.isFavorite).length },
    { key: 'ungrouped', label: '未分组', projectCount: projects.filter((project) => !project.groupId).length },
    ...groups.map((group) => ({
      key: `group:${group.id}` as ProjectListGroupFilter,
      label: group.name,
      projectCount: projects.filter((project) => project.groupId === group.id).length
    }))
  ]
}

export function filterProjectsByGroup(projects: Project[], filter: ProjectListGroupFilter): Project[] {
  if (filter === 'all') {
    return projects
  }

  if (filter === 'favorites') {
    return projects.filter((project) => project.isFavorite)
  }

  if (filter === 'ungrouped') {
    return projects.filter((project) => !project.groupId)
  }

  const groupId = filter.slice('group:'.length)
  return projects.filter((project) => project.groupId === groupId)
}

export function getProjectRepositoriesForDisplay<T extends ProjectRepositoryScopeSource>(
  project: Pick<Project, 'id' | 'workspacePath'>,
  repositories: T[]
): T[] {
  const projectPath = normalizeProjectPath(project.workspacePath)
  const relatedRepositories = repositories.filter(
    (repository) => repository.projectId === project.id || isRepositoryInsideProject(projectPath, repository.localPath)
  )
  const rootRepository = relatedRepositories.find((repository) => normalizeProjectPath(repository.localPath) === projectPath)
  const fallbackParentRepositoryId = rootRepository?.id ?? projectPath
  const relatedRepositoryIds = new Set(relatedRepositories.map((repository) => repository.id))

  return relatedRepositories.map((repository) => {
    const nestedInWorkspace = isRepositoryInsideProject(projectPath, repository.localPath)
    const parentIsRelated = repository.parentRepositoryId && relatedRepositoryIds.has(repository.parentRepositoryId)

    if (!nestedInWorkspace || parentIsRelated || repository.id === rootRepository?.id) {
      return repository
    }

    return {
      ...repository,
      parentRepositoryId: fallbackParentRepositoryId,
      relativePath: normalizeProjectPath(repository.localPath).slice(`${projectPath}/`.length) || repository.relativePath
    }
  }) as T[]
}
