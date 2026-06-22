export type GitRemote = {
  name: string
  fetchUrl: string
  pushUrl: string
}

export type RemoteAlignmentStatus = 'aligned' | 'diverged' | 'missing-remote' | 'missing-branch' | 'unknown'

export type RemoteAlignmentBranchStatus = 'aligned' | 'diverged' | 'missing-branch' | 'unknown'

export type RemoteAlignmentRemote = {
  name: string
  url: string
  branchCount: number
}

export type RemoteAlignmentRemoteRef = {
  remoteName: string
  ref: string
  commit: string
  ahead: number
}

export type RemoteAlignmentBranch = {
  branchName: string
  remotes: RemoteAlignmentRemoteRef[]
  status: RemoteAlignmentBranchStatus
  uniqueCommitCount: number
}

export type RemoteAlignmentSummary = {
  status: RemoteAlignmentStatus
  remotes: RemoteAlignmentRemote[]
  remoteCount: number
  branchCount: number
  alignedBranchCount: number
  divergedBranchCount: number
  missingBranchCount: number
  currentBranchStatus: RemoteAlignmentBranchStatus | ''
  errorMessage: string
  branches: RemoteAlignmentBranch[]
}

type LegacyRemoteAlignmentBranch = {
  branchName?: string
  companyRef?: string
  githubRef?: string
  companyCommit?: string
  githubCommit?: string
  companyAhead?: number
  githubAhead?: number
  status?: RemoteAlignmentBranchStatus
}

type LegacyRemoteAlignmentSummary = {
  status?: unknown
  remotes?: unknown
  remoteCount?: unknown
  branchCount?: unknown
  alignedBranchCount?: unknown
  divergedBranchCount?: unknown
  missingBranchCount?: unknown
  currentBranchStatus?: unknown
  errorMessage?: unknown
  branches?: Array<RemoteAlignmentBranch | LegacyRemoteAlignmentBranch>
  companyRemoteName?: string
  companyRemoteUrl?: string
  githubRemoteName?: string
  githubRemoteUrl?: string
}

type SummarizeRemoteAlignmentInput = {
  remotes: GitRemote[]
  refsByRemote: Map<string, Map<string, string>>
  currentBranch: string
  defaultBranch: string
  countExclusiveCommits: (fromCommit: string, toCommit: string) => Promise<number>
}

function getRemoteUrl(remote: GitRemote | undefined): string {
  return remote?.fetchUrl || remote?.pushUrl || ''
}

function normalizeStatus(value: unknown): RemoteAlignmentStatus {
  return value === 'aligned' || value === 'diverged' || value === 'missing-remote' || value === 'missing-branch' || value === 'unknown'
    ? value
    : 'unknown'
}

function normalizeBranchStatus(value: unknown): RemoteAlignmentBranchStatus | '' {
  return value === 'aligned' || value === 'diverged' || value === 'missing-branch' || value === 'unknown' || value === '' ? value : ''
}

export function createEmptyRemoteAlignment(status: RemoteAlignmentStatus = 'unknown', errorMessage = ''): RemoteAlignmentSummary {
  return {
    status,
    remotes: [],
    remoteCount: 0,
    branchCount: 0,
    alignedBranchCount: 0,
    divergedBranchCount: 0,
    missingBranchCount: 0,
    currentBranchStatus: '',
    errorMessage,
    branches: []
  }
}

function sortAlignmentBranches(branches: RemoteAlignmentBranch[], currentBranch: string, defaultBranch: string): RemoteAlignmentBranch[] {
  return [...branches].sort((a, b) => {
    if (a.branchName === currentBranch) {
      return -1
    }

    if (b.branchName === currentBranch) {
      return 1
    }

    if (a.branchName === defaultBranch) {
      return -1
    }

    if (b.branchName === defaultBranch) {
      return 1
    }

    return a.branchName.localeCompare(b.branchName)
  })
}

function isMultiRemoteBranch(branch: RemoteAlignmentBranch | LegacyRemoteAlignmentBranch): branch is RemoteAlignmentBranch {
  return Array.isArray((branch as RemoteAlignmentBranch).remotes)
}

function parseLegacyRemoteAlignment(parsed: LegacyRemoteAlignmentSummary): RemoteAlignmentSummary {
  const companyRemoteName = parsed.companyRemoteName || 'company'
  const githubRemoteName = parsed.githubRemoteName || ''
  const remotes = [
    { name: companyRemoteName, url: parsed.companyRemoteUrl || '', branchCount: 0 },
    { name: githubRemoteName, url: parsed.githubRemoteUrl || '', branchCount: 0 }
  ].filter((remote) => remote.name)
  const branches = (parsed.branches ?? []).map((branch): RemoteAlignmentBranch => {
    if (isMultiRemoteBranch(branch)) {
      return branch
    }

    const companyAhead = Number(branch.companyAhead ?? 0)
    const githubAhead = Number(branch.githubAhead ?? 0)

    return {
      branchName: branch.branchName || '',
      remotes: [
        {
          remoteName: companyRemoteName,
          ref: branch.companyRef || (branch.branchName ? `${companyRemoteName}/${branch.branchName}` : ''),
          commit: branch.companyCommit || '',
          ahead: companyAhead
        },
        {
          remoteName: githubRemoteName,
          ref: branch.githubRef || (branch.branchName && githubRemoteName ? `${githubRemoteName}/${branch.branchName}` : ''),
          commit: branch.githubCommit || '',
          ahead: githubAhead
        }
      ].filter((remote) => remote.remoteName),
      status: normalizeBranchStatus(branch.status) || 'unknown',
      uniqueCommitCount: companyAhead + githubAhead
    }
  })

  return {
    ...createEmptyRemoteAlignment(normalizeStatus(parsed.status), String(parsed.errorMessage || '')),
    remotes,
    remoteCount: Number(parsed.remoteCount ?? remotes.length),
    branchCount: Number(parsed.branchCount ?? branches.length),
    alignedBranchCount: Number(parsed.alignedBranchCount ?? branches.filter((branch) => branch.status === 'aligned').length),
    divergedBranchCount: Number(parsed.divergedBranchCount ?? branches.filter((branch) => branch.status === 'diverged').length),
    missingBranchCount: Number(parsed.missingBranchCount ?? branches.filter((branch) => branch.status === 'missing-branch').length),
    currentBranchStatus: normalizeBranchStatus(parsed.currentBranchStatus),
    branches
  }
}

export function parseRemoteAlignment(value: unknown): RemoteAlignmentSummary {
  if (!value) {
    return createEmptyRemoteAlignment()
  }

  try {
    const parsed = (typeof value === 'string' ? JSON.parse(value) : value) as LegacyRemoteAlignmentSummary

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createEmptyRemoteAlignment()
    }

    if ('companyRemoteName' in parsed || 'githubRemoteName' in parsed) {
      return parseLegacyRemoteAlignment(parsed)
    }

    const remotes = Array.isArray(parsed.remotes) ? (parsed.remotes as RemoteAlignmentRemote[]) : []
    const branches = Array.isArray(parsed.branches) ? parsed.branches.filter(isMultiRemoteBranch) : []

    return {
      ...createEmptyRemoteAlignment(normalizeStatus(parsed.status), String(parsed.errorMessage || '')),
      status: normalizeStatus(parsed.status),
      remotes,
      remoteCount: Number(parsed.remoteCount ?? remotes.length),
      branchCount: Number(parsed.branchCount ?? branches.length),
      alignedBranchCount: Number(parsed.alignedBranchCount ?? branches.filter((branch) => branch.status === 'aligned').length),
      divergedBranchCount: Number(parsed.divergedBranchCount ?? branches.filter((branch) => branch.status === 'diverged').length),
      missingBranchCount: Number(parsed.missingBranchCount ?? branches.filter((branch) => branch.status === 'missing-branch').length),
      currentBranchStatus: normalizeBranchStatus(parsed.currentBranchStatus),
      errorMessage: String(parsed.errorMessage || ''),
      branches
    }
  } catch {
    return createEmptyRemoteAlignment()
  }
}

async function createBranchRemoteRef({
  branchName,
  remote,
  refsByRemote,
  branchStatus,
  countExclusiveCommits
}: {
  branchName: string
  remote: GitRemote
  refsByRemote: Map<string, Map<string, string>>
  branchStatus: RemoteAlignmentBranchStatus
  countExclusiveCommits: (fromCommit: string, toCommit: string) => Promise<number>
}): Promise<RemoteAlignmentRemoteRef> {
  const remoteRefs = refsByRemote.get(remote.name) ?? new Map()
  const commit = remoteRefs.get(branchName) ?? ''

  if (!commit || branchStatus !== 'diverged') {
    return {
      remoteName: remote.name,
      ref: `${remote.name}/${branchName}`,
      commit,
      ahead: 0
    }
  }

  const otherCommits = new Set<string>()

  for (const [otherRemoteName, otherRefs] of refsByRemote) {
    if (otherRemoteName !== remote.name) {
      const otherCommit = otherRefs.get(branchName)

      if (otherCommit && otherCommit !== commit) {
        otherCommits.add(otherCommit)
      }
    }
  }

  const aheadCounts = await Promise.all(Array.from(otherCommits).map((otherCommit) => countExclusiveCommits(otherCommit, commit)))

  return {
    remoteName: remote.name,
    ref: `${remote.name}/${branchName}`,
    commit,
    ahead: aheadCounts.reduce((sum, count) => sum + count, 0)
  }
}

export async function summarizeRemoteAlignment({
  remotes,
  refsByRemote,
  currentBranch,
  defaultBranch,
  countExclusiveCommits
}: SummarizeRemoteAlignmentInput): Promise<RemoteAlignmentSummary> {
  const summaryRemotes = remotes.map((remote) => ({
    name: remote.name,
    url: getRemoteUrl(remote),
    branchCount: refsByRemote.get(remote.name)?.size ?? 0
  }))

  if (remotes.length < 2) {
    return {
      ...createEmptyRemoteAlignment('missing-remote', '多端对齐至少需要 2 个远端'),
      remotes: summaryRemotes,
      remoteCount: remotes.length
    }
  }

  const branchNames = Array.from(new Set(Array.from(refsByRemote.values()).flatMap((refs) => Array.from(refs.keys()))))

  if (branchNames.length === 0) {
    return {
      ...createEmptyRemoteAlignment('unknown', '没有本地远端引用，请先同步远端'),
      remotes: summaryRemotes,
      remoteCount: remotes.length
    }
  }

  const branches = await Promise.all(
    branchNames.map(async (branchName): Promise<RemoteAlignmentBranch> => {
      const commits = remotes.map((remote) => refsByRemote.get(remote.name)?.get(branchName) ?? '')
      const presentCommits = commits.filter(Boolean)
      const distinctCommits = new Set(presentCommits)
      const status: RemoteAlignmentBranchStatus =
        presentCommits.length !== remotes.length ? 'missing-branch' : distinctCommits.size === 1 ? 'aligned' : 'diverged'
      const remoteRefs = await Promise.all(
        remotes.map((remote) =>
          createBranchRemoteRef({
            branchName,
            remote,
            refsByRemote,
            branchStatus: status,
            countExclusiveCommits
          })
        )
      )

      return {
        branchName,
        remotes: remoteRefs,
        status,
        uniqueCommitCount: remoteRefs.reduce((sum, remote) => sum + remote.ahead, 0)
      }
    })
  )
  const sortedBranches = sortAlignmentBranches(branches, currentBranch, defaultBranch)
  const alignedBranchCount = sortedBranches.filter((branch) => branch.status === 'aligned').length
  const divergedBranchCount = sortedBranches.filter((branch) => branch.status === 'diverged').length
  const missingBranchCount = sortedBranches.filter((branch) => branch.status === 'missing-branch').length
  const status: RemoteAlignmentStatus = missingBranchCount > 0 ? 'missing-branch' : divergedBranchCount > 0 ? 'diverged' : 'aligned'

  return {
    status,
    remotes: summaryRemotes,
    remoteCount: remotes.length,
    branchCount: sortedBranches.length,
    alignedBranchCount,
    divergedBranchCount,
    missingBranchCount,
    currentBranchStatus: sortedBranches.find((branch) => branch.branchName === currentBranch)?.status ?? '',
    errorMessage: '',
    branches: sortedBranches
  }
}
