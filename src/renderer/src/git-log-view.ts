export type GraphCommitInput = {
  hash: string
  parentHashes: string[]
}

export type GitGraphRow<TCommit extends GraphCommitInput = GraphCommitInput> = TCommit & {
  graphLanes: string[]
  graphLaneIndex: number
  graphParentLaneIndexes: number[]
  graphParentEdges: GraphParentEdge[]
  graphTopLaneIndexes: number[]
  graphBottomLaneIndexes: number[]
}

export type GraphParentEdge = {
  fromLaneIndex: number
  toLaneIndex: number
}

export const gitGraphLaneWidth = 16
export const gitGraphColumnMinWidth = 152
export const workingTreeCommitHash = '__FORGEDESK_WORKING_TREE__'
export const gitLogRefreshPreferenceStorageKey = 'forgedesk.gitLogRefreshPreferences'
export const gitLogRefreshPreferenceChangedEvent = 'forgedesk:git-log-refresh-preferences-changed'
export const currentBranchRefColor = '#722ed1'
export const graphLaneFallbackColors = ['#1677ff', '#13c2c2', '#722ed1', '#fa8c16', '#52c41a', '#eb2f96', '#2f54eb']
export const gitLogRefreshIntervalBounds = {
  minSeconds: 10,
  maxSeconds: 600
}
const gitGraphColumnPadding = 56

export type GitLogRefreshPreferences = {
  autoRefreshEnabled: boolean
  intervalSeconds: number
}

export type BranchColoredGitGraphRow<TCommit extends GraphCommitInput = GraphCommitInput> = GitGraphRow<TCommit> & {
  graphLaneColors: string[]
}

export const defaultGitLogRefreshPreferences: GitLogRefreshPreferences = {
  autoRefreshEnabled: false,
  intervalSeconds: 30
}

function clampGitLogRefreshInterval(seconds: number): number {
  return Math.min(gitLogRefreshIntervalBounds.maxSeconds, Math.max(gitLogRefreshIntervalBounds.minSeconds, Math.round(seconds)))
}

export function normalizeGitLogRefreshPreferences(input: unknown): GitLogRefreshPreferences {
  const candidate = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}
  const intervalSeconds = Number(candidate.intervalSeconds)

  return {
    autoRefreshEnabled: candidate.autoRefreshEnabled === true,
    intervalSeconds: Number.isFinite(intervalSeconds)
      ? clampGitLogRefreshInterval(intervalSeconds)
      : defaultGitLogRefreshPreferences.intervalSeconds
  }
}

export type WorkspaceStatusInput = {
  files?: unknown[]
}

export type WorkspaceStatusFileInput = {
  indexStatus: string
  worktreeStatus: string
  conflict?: boolean
}

export type WorkingTreeCommitOptions = {
  currentBranch?: string
  headHash?: string
}

export function getWorkspaceFileChangeStatus(file: WorkspaceStatusFileInput): string {
  if (file.conflict) {
    return 'U'
  }

  const indexStatus = file.indexStatus.trim()
  const worktreeStatus = file.worktreeStatus.trim()

  if (indexStatus === '?' || worktreeStatus === '?') {
    return '?'
  }

  return worktreeStatus || indexStatus || 'M'
}

export function isWorkingTreeCommit(commit: { hash: string }): boolean {
  return commit.hash === workingTreeCommitHash
}

function getCommitRefs(commit: GraphCommitInput): string[] {
  const refs = (commit as { refs?: unknown }).refs

  return Array.isArray(refs) ? refs.filter((ref): ref is string => typeof ref === 'string') : []
}

function matchesCurrentHeadRef(ref: string, currentBranch: string): boolean {
  const normalizedRef = ref.trim()

  if (normalizedRef === 'HEAD') {
    return true
  }

  if (!currentBranch) {
    return normalizedRef.startsWith('HEAD -> ')
  }

  return normalizedRef === `HEAD -> ${currentBranch}` || normalizedRef === currentBranch || normalizedRef === `refs/heads/${currentBranch}`
}

export function getWorkingTreeParentHashes<TCommit extends GraphCommitInput>(
  commits: TCommit[],
  options: WorkingTreeCommitOptions = {}
): string[] {
  const headHash = options.headHash?.trim()

  if (headHash && commits.some((commit) => commit.hash === headHash)) {
    return [headHash]
  }

  const currentBranch = options.currentBranch?.trim() ?? ''
  const headCommit = commits.find((commit) => getCommitRefs(commit).some((ref) => matchesCurrentHeadRef(ref, currentBranch)))

  if (headCommit) {
    return [headCommit.hash]
  }

  if (currentBranch || headHash) {
    return []
  }

  return commits[0]?.hash ? [commits[0].hash] : []
}

export function createWorkingTreeCommit<TCommit extends GraphCommitInput>(
  commits: TCommit[],
  status: WorkspaceStatusInput | null | undefined,
  createCommit: (input: { parentHashes: string[]; fileCount: number }) => TCommit,
  options: WorkingTreeCommitOptions = {}
): TCommit | null {
  const fileCount = status?.files?.length ?? 0

  if (fileCount === 0) {
    return null
  }

  return createCommit({
    parentHashes: getWorkingTreeParentHashes(commits, options),
    fileCount
  })
}

export function prependWorkingTreeCommit<TCommit extends GraphCommitInput>(
  commits: TCommit[],
  status: WorkspaceStatusInput | null | undefined,
  createCommit: (input: { parentHashes: string[]; fileCount: number }) => TCommit,
  options: WorkingTreeCommitOptions = {}
): TCommit[] {
  const workingTreeCommit = createWorkingTreeCommit(commits, status, createCommit, options)

  return workingTreeCommit ? [workingTreeCommit, ...commits] : commits
}

export type BranchGroupItem = {
  name: string
  isActive: boolean
  isCurrent: boolean
}

export type BranchGroup = {
  key: 'local' | 'remote'
  title: string
  items: BranchGroupItem[]
}

export type RefTone = 'blue' | 'cyan' | 'gold' | 'default'

export type BranchTagColorRule = {
  label: string
  branchName: string
  color: string
}

export type RepositoryPushTargetInput = {
  currentBranch?: string
  remotes?: Array<{ name: string }>
}

export function getRepositoryDefaultPushTarget(repository: RepositoryPushTargetInput | null, statusBranch = ''): { remote: string; branch: string } {
  return {
    remote: repository?.remotes?.find((remote) => remote.name)?.name || 'origin',
    branch: statusBranch || repository?.currentBranch || ''
  }
}

export type CommitAuthorDisplayInput = {
  authorName: string
  authorEmail: string
  authorDisplayName?: string
  authorDisplayEmail?: string
}

export function getCommitAuthorDisplay(commit: CommitAuthorDisplayInput): {
  name: string
  email: string
  title: string
} {
  const name = commit.authorDisplayName?.trim() || commit.authorName.trim() || '未知提交人'
  const email = commit.authorDisplayEmail?.trim() || commit.authorEmail.trim()

  return {
    name,
    email,
    title: email ? `${name} · ${email}` : name
  }
}

export function getCommitAuthorFilterValue(commit: CommitAuthorDisplayInput): string {
  const author = getCommitAuthorDisplay(commit)
  return author.email ? `${author.name} <${author.email}>` : author.name
}

export function getNextVisibleCommitCount({
  current,
  total,
  batchSize
}: {
  current: number
  total: number
  batchSize: number
}): number {
  return Math.min(total, current + batchSize)
}

function getGraphLaneCount(row: GitGraphRow): number {
  const allLaneIndexes = [
    row.graphLaneIndex,
    ...row.graphParentLaneIndexes,
    ...row.graphTopLaneIndexes,
    ...row.graphBottomLaneIndexes,
    ...row.graphParentEdges.flatMap((edge) => [edge.fromLaneIndex, edge.toLaneIndex])
  ]

  return Math.max(row.graphLanes.length, ...allLaneIndexes.map((index) => index + 1), 1)
}

export function getGraphLaneColor(index: number): string {
  return graphLaneFallbackColors[index % graphLaneFallbackColors.length]
}

export function getGitGraphColumnWidth(rows: GitGraphRow[]): number {
  const maxLaneCount = rows.reduce((max, row) => Math.max(max, getGraphLaneCount(row)), 1)
  return Math.max(gitGraphColumnMinWidth, maxLaneCount * gitGraphLaneWidth + gitGraphColumnPadding)
}

export function getGraphCellBottomLaneIndexes(row: GitGraphRow): number[] {
  const lanesStartedBySideEdge = new Set(
    row.graphParentEdges
      .filter((edge) => edge.fromLaneIndex !== edge.toLaneIndex && !row.graphTopLaneIndexes.includes(edge.toLaneIndex))
      .map((edge) => edge.toLaneIndex)
  )

  return row.graphBottomLaneIndexes.filter((laneIndex) => !lanesStartedBySideEdge.has(laneIndex))
}

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index)
}

function uniqueSortedIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)].sort((left, right) => left - right)
}

type GraphLane = {
  hash: string
  visible: boolean
} | null

function cloneLanes(lanes: GraphLane[]): GraphLane[] {
  return lanes.map((lane) => (lane ? { ...lane } : null))
}

function getVisibleLaneIndexes(lanes: GraphLane[]): number[] {
  return lanes.flatMap((lane, index) => (lane?.visible ? [index] : []))
}

function findLaneIndex(lanes: GraphLane[], hash: string, excludedIndex?: number): number {
  return lanes.findIndex((lane, index) => lane?.hash === hash && index !== excludedIndex)
}

function placeLane(lanes: GraphLane[], hash: string, visible = true): number {
  const emptyLaneIndex = lanes.indexOf(null)

  if (emptyLaneIndex >= 0) {
    lanes[emptyLaneIndex] = { hash, visible }
    return emptyLaneIndex
  }

  lanes.push({ hash, visible })
  return lanes.length - 1
}

function compactTrailingEmptyLanes(lanes: GraphLane[]): void {
  while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
    lanes.pop()
  }
}

export function createGraphRows<TCommit extends GraphCommitInput>(commits: TCommit[]): Array<GitGraphRow<TCommit>> {
  const rows: Array<GitGraphRow<TCommit>> = []
  const lanes: GraphLane[] = []
  const visibleCommitHashes = new Set(commits.map((commit) => commit.hash))

  for (const commit of commits) {
    let laneIndex = findLaneIndex(lanes, commit.hash)
    const entersFromAbove = laneIndex !== -1
    const wasVisibleBefore = laneIndex >= 0 && lanes[laneIndex]?.visible === true

    if (laneIndex === -1) {
      laneIndex = placeLane(lanes, commit.hash)
    } else {
      lanes[laneIndex] = { hash: commit.hash, visible: true }
    }

    const lanesBefore = cloneLanes(lanes)
    const lanesAfter = cloneLanes(lanesBefore)
    const topLaneIndexes =
      entersFromAbove && wasVisibleBefore
        ? getVisibleLaneIndexes(lanesBefore)
        : getVisibleLaneIndexes(lanesBefore).filter((index) => index !== laneIndex)
    const parentLaneIndexes: number[] = []
    const parentEdges: GraphParentEdge[] = []

    if (commit.parentHashes.length === 0) {
      lanesAfter[laneIndex] = null
    } else {
      const firstParentHash = commit.parentHashes[0]
      const firstParentIsVisible = visibleCommitHashes.has(firstParentHash)
      const existingFirstParentLane = findLaneIndex(lanesAfter, firstParentHash, laneIndex)

      if (existingFirstParentLane >= 0) {
        parentLaneIndexes.push(existingFirstParentLane)
        parentEdges.push({ fromLaneIndex: laneIndex, toLaneIndex: existingFirstParentLane })
        lanesAfter[laneIndex] = null
      } else if (firstParentIsVisible) {
        parentLaneIndexes.push(laneIndex)
        parentEdges.push({ fromLaneIndex: laneIndex, toLaneIndex: laneIndex })
        lanesAfter[laneIndex] = { hash: firstParentHash, visible: true }
      } else {
        lanesAfter[laneIndex] = null
      }
    }

    for (const parentHash of commit.parentHashes.slice(1)) {
      const parentIsVisible = visibleCommitHashes.has(parentHash)
      const existingLane = findLaneIndex(lanesAfter, parentHash)

      if (!parentIsVisible && (existingLane < 0 || lanesAfter[existingLane]?.visible !== true)) {
        continue
      }

      const parentLaneIndex = existingLane >= 0 ? existingLane : placeLane(lanesAfter, parentHash, true)

      if (parentIsVisible && existingLane >= 0) {
        lanesAfter[existingLane] = { hash: parentHash, visible: true }
      }

      parentLaneIndexes.push(parentLaneIndex)
      parentEdges.push({ fromLaneIndex: laneIndex, toLaneIndex: parentLaneIndex })
    }

    compactTrailingEmptyLanes(lanesAfter)

    const laneCount = Math.max(lanesBefore.length, lanesAfter.length, laneIndex + 1, ...parentLaneIndexes.map((index) => index + 1))
    const graphLanes = Array.from({ length: laneCount }, (_, index) => lanesBefore[index]?.hash ?? lanesAfter[index]?.hash ?? `${commit.hash}:lane-${index}`)

    rows.push({
      ...commit,
      graphLanes,
      graphLaneIndex: laneIndex,
      graphParentLaneIndexes: uniqueSortedIndexes(parentLaneIndexes),
      graphParentEdges: parentEdges,
      graphTopLaneIndexes: uniqueSortedIndexes(topLaneIndexes),
      graphBottomLaneIndexes: uniqueSortedIndexes(getVisibleLaneIndexes(lanesAfter))
    })

    lanes.splice(0, lanes.length, ...lanesAfter)
  }

  return rows
}

export function buildBranchGroups({
  branches,
  remoteBranches,
  currentBranch,
  activeBranch
}: {
  branches: string[]
  remoteBranches: string[]
  currentBranch: string
  activeBranch: string
}): BranchGroup[] {
  return [
    {
      key: 'local',
      title: '本地分支',
      items: branches.map((name) => ({
        name,
        isActive: activeBranch === name,
        isCurrent: currentBranch === name
      }))
    },
    {
      key: 'remote',
      title: '远端分支',
      items: remoteBranches.map((name) => ({
        name,
        isActive: activeBranch === name,
        isCurrent: currentBranch === name.replace(/^[^/]+\//, '')
      }))
    }
  ]
}

export function getRefTone(ref: string): RefTone {
  if (ref.startsWith('tag:')) {
    return 'gold'
  }

  if (ref.includes('/')) {
    return 'cyan'
  }

  return ref ? 'blue' : 'default'
}

export function getRefShortBranchName(ref: string): string {
  const value = ref.includes(' -> ') ? (ref.split(' -> ').pop() ?? ref) : ref

  return value.trim().replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '').replace(/^[^/]+\//, '')
}

export function getRefColor(ref: string, branchTags: BranchTagColorRule[] = [], currentBranch = ''): RefTone | string {
  if (ref.startsWith('tag:')) {
    return 'gold'
  }

  const shortName = getRefShortBranchName(ref)
  const branchTag = branchTags.find((tag) => tag.branchName === shortName)

  if (branchTag) {
    return branchTag.color
  }

  return currentBranch && shortName === currentBranch ? currentBranchRefColor : getRefTone(ref)
}

function getGraphRefColor(ref: string, branchTags: BranchTagColorRule[] = [], currentBranch = ''): string | null {
  const color = getRefColor(ref, branchTags, currentBranch)

  if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
    return color
  }

  if (color === 'blue') {
    return '#1677ff'
  }

  if (color === 'cyan') {
    return '#13c2c2'
  }

  if (color === 'gold') {
    return '#faad14'
  }

  return null
}

function getCommitGraphRefColor(commit: GraphCommitInput, branchTags: BranchTagColorRule[] = [], currentBranch = ''): string | null {
  const branchRefs = getCommitRefs(commit).filter((ref) => !ref.startsWith('tag:'))

  for (const ref of branchRefs) {
    const color = getGraphRefColor(ref, branchTags, currentBranch)

    if (color) {
      return color
    }
  }

  return null
}

export function applyBranchColorsToGraphRows<TCommit extends GraphCommitInput>(
  rows: Array<GitGraphRow<TCommit>>,
  branchTags: BranchTagColorRule[] = [],
  currentBranch = ''
): Array<BranchColoredGitGraphRow<TCommit>> {
  const refColorByHash = new Map(rows.map((row) => [row.hash, getCommitGraphRefColor(row, branchTags, currentBranch)] as const).filter(([, color]) => Boolean(color)))
  let carriedLaneColors: Array<string | undefined> = []

  return rows.map((row) => {
    const laneCount = getGraphLaneCount(row)
    const laneColors = carriedLaneColors.slice()
    const commitRefColor = refColorByHash.get(row.hash)

    if (commitRefColor) {
      laneColors[row.graphLaneIndex] = commitRefColor
    }

    row.graphLanes.forEach((hash, laneIndex) => {
      const laneRefColor = refColorByHash.get(hash)

      if (laneRefColor) {
        laneColors[laneIndex] = laneRefColor
      }
    })

    const graphLaneColors = range(laneCount).map((laneIndex) => laneColors[laneIndex] ?? getGraphLaneColor(laneIndex))
    const nextLaneColors: Array<string | undefined> = []

    for (const laneIndex of row.graphBottomLaneIndexes) {
      nextLaneColors[laneIndex] = laneColors[laneIndex]
    }

    carriedLaneColors = nextLaneColors

    return {
      ...row,
      graphLaneColors
    }
  })
}
