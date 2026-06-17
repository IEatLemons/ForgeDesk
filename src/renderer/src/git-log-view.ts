export type GraphCommitInput = {
  hash: string
  parentHashes: string[]
}

export type GitGraphRow<TCommit extends GraphCommitInput = GraphCommitInput> = TCommit & {
  graphLanes: string[]
  graphLaneIndex: number
  graphParentLaneIndexes: number[]
  graphTopLaneIndexes: number[]
  graphBottomLaneIndexes: number[]
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

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index)
}

function uniqueSortedIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)].sort((left, right) => left - right)
}

export function createGraphRows<TCommit extends GraphCommitInput>(commits: TCommit[]): Array<GitGraphRow<TCommit>> {
  const rows: Array<GitGraphRow<TCommit>> = []
  const lanes: string[] = []

  for (const commit of commits) {
    let laneIndex = lanes.indexOf(commit.hash)
    const entersFromAbove = laneIndex !== -1

    if (laneIndex === -1) {
      laneIndex = lanes.length
      lanes.push(commit.hash)
    }

    const lanesBefore = [...lanes]
    const lanesAfter = [...lanesBefore]
    const topLaneIndexes = entersFromAbove ? range(lanesBefore.length) : range(lanesBefore.length).filter((index) => index !== laneIndex)
    const parentLaneIndexes: number[] = []

    if (commit.parentHashes.length === 0) {
      lanesAfter.splice(laneIndex, 1)
    } else {
      const firstParentHash = commit.parentHashes[0]
      const existingFirstParentLane = lanesAfter.findIndex((laneHash, index) => laneHash === firstParentHash && index !== laneIndex)

      if (existingFirstParentLane >= 0) {
        parentLaneIndexes.push(existingFirstParentLane)
        lanesAfter.splice(laneIndex, 1)
      } else {
        parentLaneIndexes.push(laneIndex)
        lanesAfter[laneIndex] = firstParentHash
      }
    }

    for (const parentHash of commit.parentHashes.slice(1)) {
      const existingLane = lanesAfter.indexOf(parentHash)

      if (existingLane >= 0) {
        parentLaneIndexes.push(existingLane)
      } else {
        lanesAfter.push(parentHash)
        parentLaneIndexes.push(lanesAfter.length - 1)
      }
    }

    const laneCount = Math.max(lanesBefore.length, lanesAfter.length, laneIndex + 1, ...parentLaneIndexes.map((index) => index + 1))
    const graphLanes = Array.from({ length: laneCount }, (_, index) => lanesBefore[index] ?? lanesAfter[index] ?? `${commit.hash}:lane-${index}`)

    rows.push({
      ...commit,
      graphLanes,
      graphLaneIndex: laneIndex,
      graphParentLaneIndexes: uniqueSortedIndexes(parentLaneIndexes),
      graphTopLaneIndexes: uniqueSortedIndexes(topLaneIndexes),
      graphBottomLaneIndexes: uniqueSortedIndexes(range(lanesAfter.length))
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
