import type { CodexProjectMonitorItem, Project } from './data'

export type CodexBindingRecommendation = {
  cwd: string
  reason: string
  score: number
}

function pathSegments(path: string): string[] {
  return path.split(/[\\/]/).map((segment) => segment.trim()).filter(Boolean)
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function displayDirectory(path: string): string {
  return pathSegments(path).at(-1) || path
}

/**
 * Finds safe, explainable suggestions for an unlinked Codex directory.
 * Exact path equality is strongest; otherwise matching the final project
 * directory is useful when the same repository is checked out elsewhere.
 */
export function getCodexBindingRecommendations(
  project: Pick<Project, 'name' | 'workspacePath'>,
  codexProjects: CodexProjectMonitorItem[]
): CodexBindingRecommendation[] {
  const workspacePath = normalized(project.workspacePath)
  const workspaceDirectory = normalized(displayDirectory(project.workspacePath))
  const projectName = normalized(project.name)

  return codexProjects
    .filter((item) => item.linkSource === 'unlinked')
    .map((item) => {
      const cwd = normalized(item.cwd)
      const directory = normalized(displayDirectory(item.cwd))

      if (workspacePath && cwd === workspacePath) {
        return { cwd: item.cwd, reason: '项目目录完全一致', score: 100 }
      }
      if (workspaceDirectory && directory === workspaceDirectory) {
        return { cwd: item.cwd, reason: `项目目录名“${displayDirectory(item.cwd)}”一致`, score: 90 }
      }
      if (projectName && directory === projectName) {
        return { cwd: item.cwd, reason: `Codex 目录名与项目名“${project.name}”一致`, score: 80 }
      }
      return null
    })
    .filter((item): item is CodexBindingRecommendation => item !== null)
    .sort((left, right) => right.score - left.score || left.cwd.localeCompare(right.cwd))
}
