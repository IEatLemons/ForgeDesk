import type { Project, ProjectGitSummary, Repository } from './data'

type WorkspaceSnapshot = {
  projects: Project[]
  repositories: Repository[]
}

type WorkspaceSnapshotState = {
  projects?: Project[]
  repositories?: Repository[]
  selectedProjectId: string | null
  summaries: Record<string, ProjectGitSummary>
}

// Snapshots cross IPC as fresh objects. Reuse equal records so unrelated
// subscribers (and unchanged table rows) don't pay for every broadcast.
export function sameWorkspaceValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameWorkspaceValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]))
}

export function shareWorkspaceRecords<T extends { id: string }>(previous: T[] | undefined, incoming: T[]): T[] {
  if (!previous) return incoming
  const byId = new Map(previous.map(record => [record.id, record]))
  const next = incoming.map(record => {
    const old = byId.get(record.id)
    return old && sameWorkspaceValue(old, record) ? old : record
  })
  return previous.length === next.length && next.every((record, index) => record === previous[index]) ? previous : next
}

export type RepositoryReadOverlay = { base: Repository; next: Repository }
export function overlayRepositoryRead(incoming: Repository, overlay?: RepositoryReadOverlay): Repository {
  if (!overlay || !sameWorkspaceValue(incoming, overlay.base)) return incoming
  const { currentBranch, checkedOutCommit, hasChanges, ahead, pushTargets } = overlay.next
  return { ...incoming, currentBranch, checkedOutCommit, hasChanges, ahead, pushTargets }
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
    projects: shareWorkspaceRecords(state.projects, snapshot.projects),
    repositories: shareWorkspaceRecords(state.repositories, snapshot.repositories),
    selectedProjectId: getNextSelectedProjectId(state.selectedProjectId, snapshot.projects),
    summaries: Object.keys(summaries).length === Object.keys(state.summaries).length ? state.summaries : summaries
  }
}
