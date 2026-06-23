import type { Project, ProjectGitSummary, Repository } from './data'

type WorkspaceSnapshot = {
  projects: Project[]
  repositories: Repository[]
}

type WorkspaceSnapshotState = {
  selectedProjectId: string | null
  summaries: Record<string, ProjectGitSummary>
}

type WorkspaceSnapshotOptions = {
  dropProjectId?: string
}

function getNextSelectedProjectId(selectedProjectId: string | null, projects: Project[]): string | null {
  if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) {
    return selectedProjectId
  }

  return projects[0]?.id ?? null
}

export function applyWorkspaceSnapshot(
  state: WorkspaceSnapshotState,
  snapshot: WorkspaceSnapshot,
  options: WorkspaceSnapshotOptions = {}
): WorkspaceSnapshot & WorkspaceSnapshotState {
  const projectIds = new Set(snapshot.projects.map((project) => project.id))
  const summaries = Object.fromEntries(
    Object.entries(state.summaries).filter(([projectId]) => projectId !== options.dropProjectId && projectIds.has(projectId))
  ) as Record<string, ProjectGitSummary>

  return {
    projects: snapshot.projects,
    repositories: snapshot.repositories,
    selectedProjectId: getNextSelectedProjectId(state.selectedProjectId, snapshot.projects),
    summaries
  }
}
