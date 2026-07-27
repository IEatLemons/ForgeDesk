import type { Project, Repository } from './data'

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
