export const PUSH_ALL_REMOTES_VALUE = '__all_push_remotes__'

type PushTargetLike = {
  remote: string
  branch: string
  ahead: number
  hasRemoteBranch?: boolean
}

type RepositoryLike = {
  currentBranch?: string
  hasChanges?: boolean
  ahead?: number
  pushTargets?: PushTargetLike[]
}

type RemoteLike = {
  name: string
}

type WorkspaceStatusLike = {
  branch?: string
  files?: unknown[]
  pushTargets?: PushTargetLike[]
}

export type PushRemoteOption = {
  label: string
  value: string
}

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
    hasChanges: (status.files ?? []).length > 0,
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

export function resolveSelectedPushRemoteNames(selectedRemote: string, remotes: RemoteLike[]): string[] {
  if (selectedRemote === PUSH_ALL_REMOTES_VALUE) {
    return Array.from(new Set(remotes.map((remote) => remote.name).filter(Boolean)))
  }

  return selectedRemote.trim() ? [selectedRemote.trim()] : []
}

export function canPushSelection(selectedRemote: string, pushTargets: PushTargetLike[] = []): boolean {
  const pushableTargets = getPushableTargets(pushTargets)

  if (selectedRemote === PUSH_ALL_REMOTES_VALUE) {
    return pushableTargets.length > 0
  }

  return pushableTargets.some((target) => target.remote === selectedRemote)
}

export function getCurrentBranchName(repository: RepositoryLike | null | undefined, status: WorkspaceStatusLike | null | undefined): string {
  return status?.branch || repository?.currentBranch || ''
}
