export type TagSyncRemoteState = 'synced' | 'missing' | 'diverged' | 'remote-only' | 'absent' | 'unavailable'

export type RepositoryTagRemoteStatus = {
  remoteName: string
  state: TagSyncRemoteState
  commit: string
  error: string
}

export type RepositoryTagSyncTag = {
  name: string
  localCommit: string
  remotes: RepositoryTagRemoteStatus[]
}

export type RepositoryTagSyncSnapshot = {
  repositoryId: string
  checkedAt: string
  tags: RepositoryTagSyncTag[]
}

export type RepositoryTagPushBatchResult = {
  snapshot: RepositoryTagSyncSnapshot
  pushed: Array<{ tagName: string; remoteName: string }>
  failed: Array<{ tagNames: string[]; remoteName: string; error: string }>
}

export type RemoteTagSource = {
  remoteName: string
  tags: Map<string, string>
  error?: string
}

export function parseLocalTagRefs(output: string): Map<string, string> {
  const tags = new Map<string, string>()

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [name, peeledCommit, objectCommit] = line.split('\0')
    const normalizedName = name?.trim()
    const commit = peeledCommit?.trim() || objectCommit?.trim() || ''
    if (normalizedName && commit) tags.set(normalizedName, commit)
  }

  return tags
}

export function parseRemoteTagRefs(output: string): Map<string, string> {
  const tags = new Map<string, string>()

  for (const line of output.split(/\r?\n/)) {
    const [commit = '', ref = ''] = line.trim().split(/\s+/, 2)
    const match = ref.match(/^refs\/tags\/(.+?)(\^\{\})?$/)
    if (!match || !commit) continue

    const [, name, peeled] = match
    if (peeled || !tags.has(name)) tags.set(name, commit)
  }

  return tags
}

export function buildRepositoryTagSyncSnapshot(input: {
  repositoryId: string
  localTags: Map<string, string>
  remoteSources: RemoteTagSource[]
  checkedAt?: string
}): RepositoryTagSyncSnapshot {
  const tagNames = new Set(input.localTags.keys())
  input.remoteSources.forEach((source) => source.tags.forEach((_commit, name) => tagNames.add(name)))

  const tags = Array.from(tagNames)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name): RepositoryTagSyncTag => {
      const localCommit = input.localTags.get(name) || ''
      const remotes = input.remoteSources.map((source): RepositoryTagRemoteStatus => {
        if (source.error) return { remoteName: source.remoteName, state: 'unavailable', commit: '', error: source.error }
        const commit = source.tags.get(name) || ''
        if (!localCommit) return { remoteName: source.remoteName, state: commit ? 'remote-only' : 'absent', commit, error: '' }
        if (!commit) return { remoteName: source.remoteName, state: 'missing', commit: '', error: '' }
        return { remoteName: source.remoteName, state: commit === localCommit ? 'synced' : 'diverged', commit, error: '' }
      })
      return { name, localCommit, remotes }
    })

  return {
    repositoryId: input.repositoryId,
    checkedAt: input.checkedAt || new Date().toISOString(),
    tags
  }
}

export function canPushTagToRemote(tag: RepositoryTagSyncTag | undefined, remoteName: string): boolean {
  return Boolean(tag?.localCommit && tag.remotes.some((remote) => remote.remoteName === remoteName && remote.state === 'missing'))
}
