export const PUSH_ALL_REMOTES_VALUE = '__all_push_remotes__'

type PushTargetLike = {
  remote: string
  branch: string
  ahead: number
  hasRemoteBranch?: boolean
}

type RepositoryLike = {
  currentBranch?: string
  checkedOutCommit?: string
  hasChanges?: boolean
  ahead?: number
  pushTargets?: PushTargetLike[]
}

type RemoteLike = {
  name: string
}

type WorkspaceStatusLike = {
  branch?: string
  headHash?: string
  files?: unknown[]
  pushTargets?: PushTargetLike[]
}

export type PushRemoteOption = {
  label: string
  value: string
}

export type SelectedPushRemote = string | string[]

export function getPushableTargets(pushTargets: PushTargetLike[] = []): PushTargetLike[] {
  return pushTargets.filter((target) => target.ahead > 0)
}

export function hasProjectCommittableChanges(repositories: RepositoryLike[]): boolean {
  return repositories.some((repository) => Boolean(repository.hasChanges))
}

export function hasProjectPushableTargets(repositories: RepositoryLike[]): boolean {
  return repositories.some((repository) => getPushableTargets(repository.pushTargets).length > 0)
}

export function mergeRepositoryWorkspaceStatus<T extends RepositoryLike>(repository: T, status: WorkspaceStatusLike): T {
  const pushTargets = status.pushTargets ?? repository.pushTargets ?? []

  return {
    ...repository,
    currentBranch: status.branch || repository.currentBranch,
    checkedOutCommit: status.headHash || repository.checkedOutCommit,
    hasChanges: (status.files ?? []).length > 0,
    pushTargets,
    ahead: Math.max(0, ...pushTargets.map((target) => target.ahead))
  }
}

export function mergeRepositoryPushTarget<T extends RepositoryLike>(
  repository: T,
  startedRepository: RepositoryLike,
  pushedTarget: PushTargetLike,
  targetBranch: string
): T {
  // A background push must not reset workspace edits, a new HEAD, or another
  // task's remote status by writing back the snapshot from when it started.
  if (
    pushedTarget.branch !== targetBranch ||
    pushedTarget.branch !== startedRepository.currentBranch ||
    repository.currentBranch !== startedRepository.currentBranch ||
    repository.checkedOutCommit !== startedRepository.checkedOutCommit
  ) {
    return repository
  }

  const pushTargets = (repository.pushTargets ?? []).map((target) =>
    target.remote === pushedTarget.remote && target.branch === pushedTarget.branch ? pushedTarget : target
  )

  return {
    ...repository,
    pushTargets,
    ahead: Math.max(0, ...pushTargets.map((target) => target.ahead))
  }
}

export function canCommitSelection(files: unknown[], selectedPaths: string[], commitMessage: string): boolean {
  return files.length > 0 && selectedPaths.length > 0 && commitMessage.trim().length > 0
}

export function createPushRemoteOptions(remotes: RemoteLike[], pushTargets: PushTargetLike[] = []): PushRemoteOption[] {
  const aheadByRemote = new Map(pushTargets.map((target) => [target.remote, target.ahead]))
  const remoteOptions = remotes
    .filter((remote) => remote.name)
    .map((remote) => {
      const ahead = aheadByRemote.get(remote.name) ?? 0
      return {
        label: ahead > 0 ? `${remote.name} (${ahead} 个未推送)` : remote.name,
        value: remote.name
      }
    })

  if (remoteOptions.length <= 1) {
    return remoteOptions
  }

  return [{ label: '所有远端', value: PUSH_ALL_REMOTES_VALUE }, ...remoteOptions]
}

export function getDefaultPushRemoteSelection(remotes: RemoteLike[]): string[] {
  const remoteNames = Array.from(new Set(remotes.map((remote) => remote.name.trim()).filter(Boolean)))
  return remoteNames.length > 1 ? [PUSH_ALL_REMOTES_VALUE] : remoteNames
}

export function normalizePushRemoteSelection(selectedRemote: SelectedPushRemote): string[] {
  const values = Array.isArray(selectedRemote) ? selectedRemote : [selectedRemote]
  const normalized = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
  return normalized.includes(PUSH_ALL_REMOTES_VALUE) ? [PUSH_ALL_REMOTES_VALUE] : normalized
}

export function resolveSelectedPushRemoteNames(selectedRemote: SelectedPushRemote, remotes: RemoteLike[]): string[] {
  const selectedValues = normalizePushRemoteSelection(selectedRemote)

  if (selectedValues.includes(PUSH_ALL_REMOTES_VALUE)) {
    return Array.from(new Set(remotes.map((remote) => remote.name).filter(Boolean)))
  }

  return selectedValues
}

export function canPushSelection(selectedRemote: SelectedPushRemote, pushTargets: PushTargetLike[] = []): boolean {
  const pushableTargets = getPushableTargets(pushTargets)

  if (normalizePushRemoteSelection(selectedRemote).includes(PUSH_ALL_REMOTES_VALUE)) {
    return pushableTargets.length > 0
  }

  const selectedNames = new Set(normalizePushRemoteSelection(selectedRemote))
  return pushableTargets.some((target) => selectedNames.has(target.remote))
}

export function canPushBranchSelection(
  selectedRemote: SelectedPushRemote,
  remotes: RemoteLike[],
  sourceBranch: string,
  targetBranch: string
): boolean {
  const remoteNames = resolveSelectedPushRemoteNames(selectedRemote, remotes)
  return remoteNames.length > 0 && remoteNames.every((name) => remotes.some((remote) => remote.name === name)) && Boolean(sourceBranch.trim() && targetBranch.trim())
}

export function canPushAllLocalRefsSelection(
  selectedRemote: SelectedPushRemote,
  remotes: RemoteLike[],
  localBranchCount: number
): boolean {
  const remoteNames = resolveSelectedPushRemoteNames(selectedRemote, remotes)
  return localBranchCount > 0 && remoteNames.length > 0 && remoteNames.every((name) => remotes.some((remote) => remote.name === name))
}

export function getCurrentBranchName(repository: RepositoryLike | null | undefined, status: WorkspaceStatusLike | null | undefined): string {
  return status?.branch || repository?.currentBranch || ''
}
