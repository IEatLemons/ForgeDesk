import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildBranchGroups,
  createWorkingTreeCommit,
  createGraphRows,
  getCommitAuthorDisplay,
  getCommitAuthorFilterValue,
  getGraphCellBottomLaneIndexes,
  getGitGraphColumnWidth,
  getWorkspaceFileChangeStatus,
  isWorkingTreeCommit,
  getRefColor,
  getRepositoryDefaultPushTarget,
  getNextVisibleCommitCount,
  getRefTone,
  prependWorkingTreeCommit,
  workingTreeCommitHash
} from './git-log-view.js'

describe('git log view helpers', () => {
  it('keeps merge parent lanes for SourceTree-style graph rendering', () => {
    const rows = createGraphRows([
      { hash: 'm1', parentHashes: ['a1', 'b1'] },
      { hash: 'a1', parentHashes: ['root'] },
      { hash: 'b1', parentHashes: ['root'] },
      { hash: 'root', parentHashes: [] }
    ])

    assert.equal(rows[0].graphLaneIndex, 0)
    assert.deepEqual(rows[0].graphParentLaneIndexes, [0, 1])
    assert.deepEqual(rows[0].graphParentEdges, [
      { fromLaneIndex: 0, toLaneIndex: 0 },
      { fromLaneIndex: 0, toLaneIndex: 1 }
    ])
    assert.ok(rows[0].graphLanes.length >= 1)
  })

  it('keeps side parent lanes visible when their commit row is still in the list', () => {
    const rows = createGraphRows([
      { hash: 'merge', parentHashes: ['main-parent', 'feature-parent'] },
      { hash: 'main-parent', parentHashes: ['root'] },
      { hash: 'feature-parent', parentHashes: ['root'] },
      { hash: 'root', parentHashes: [] }
    ])

    assert.deepEqual(rows[0].graphBottomLaneIndexes, [0, 1])
    assert.deepEqual(getGraphCellBottomLaneIndexes(rows[0]), [0])
    assert.deepEqual(rows[1].graphTopLaneIndexes, [0, 1])
    assert.deepEqual(rows[1].graphBottomLaneIndexes, [0, 1])
    assert.equal(rows[2].graphLaneIndex, 1)
    assert.deepEqual(rows[2].graphTopLaneIndexes, [0, 1])
    assert.deepEqual(rows[2].graphParentLaneIndexes, [0])
    assert.deepEqual(rows[2].graphParentEdges, [{ fromLaneIndex: 1, toLaneIndex: 0 }])
    assert.deepEqual(rows[2].graphBottomLaneIndexes, [0])
  })

  it('hides side parent lanes when that commit is not visible in the current rows', () => {
    const rows = createGraphRows([
      { hash: 'merge', parentHashes: ['main-parent', 'filtered-out-parent'] },
      { hash: 'main-parent', parentHashes: ['root'] },
      { hash: 'root', parentHashes: [] }
    ])

    assert.deepEqual(rows[0].graphBottomLaneIndexes, [0])
    assert.deepEqual(rows[0].graphParentEdges, [{ fromLaneIndex: 0, toLaneIndex: 0 }])
    assert.deepEqual(rows[1].graphTopLaneIndexes, [0])
    assert.equal(rows[1].graphTopLaneIndexes.includes(1), false)
  })

  it('does not shift passing lanes left when an earlier lane closes', () => {
    const rows = createGraphRows([
      { hash: 'merge', parentHashes: ['main-parent', 'feature-parent', 'passing-parent'] },
      { hash: 'main-parent', parentHashes: ['feature-parent'] },
      { hash: 'feature-parent', parentHashes: ['root'] },
      { hash: 'passing-parent', parentHashes: ['root'] },
      { hash: 'root', parentHashes: [] }
    ])

    assert.deepEqual(rows[0].graphBottomLaneIndexes, [0, 1, 2])
    assert.deepEqual(rows[1].graphTopLaneIndexes, [0, 1, 2])
    assert.deepEqual(rows[1].graphBottomLaneIndexes, [1, 2])
    assert.equal(rows[3].graphLaneIndex, 2)
    assert.deepEqual(rows[3].graphTopLaneIndexes, [1, 2])
  })

  it('reserves an independent graph column wide enough for branches and label spacing', () => {
    const compactRows = createGraphRows([{ hash: 'root', parentHashes: [] }])
    const wideRows = createGraphRows([
      { hash: 'merge', parentHashes: ['main-parent', 'feature-parent', 'passing-parent', 'release-parent', 'hotfix-parent', 'qa-parent', 'ios-parent', 'android-parent'] },
      { hash: 'main-parent', parentHashes: ['root'] },
      { hash: 'feature-parent', parentHashes: ['root'] },
      { hash: 'passing-parent', parentHashes: ['root'] },
      { hash: 'release-parent', parentHashes: ['root'] },
      { hash: 'hotfix-parent', parentHashes: ['root'] },
      { hash: 'qa-parent', parentHashes: ['root'] },
      { hash: 'ios-parent', parentHashes: ['root'] },
      { hash: 'android-parent', parentHashes: ['root'] },
      { hash: 'root', parentHashes: [] }
    ])

    assert.equal(getGitGraphColumnWidth(compactRows), 152)
    assert.ok(getGitGraphColumnWidth(wideRows) > getGitGraphColumnWidth(compactRows))
  })

  it('groups local and remote branches for the drawer and marks active/current branches', () => {
    const groups = buildBranchGroups({
      branches: ['main', 'feature/source-tree-log'],
      remoteBranches: ['origin/main', 'origin/feature/source-tree-log'],
      currentBranch: 'main',
      activeBranch: 'origin/main'
    })

    assert.deepEqual(
      groups.map((group) => group.title),
      ['本地分支', '远端分支']
    )
    assert.equal(groups[0].items[0].name, 'main')
    assert.equal(groups[0].items[0].isCurrent, true)
    assert.equal(groups[1].items[0].name, 'origin/main')
    assert.equal(groups[1].items[0].isActive, true)
  })

  it('uses SourceTree-like tones for refs', () => {
    assert.equal(getRefTone('tag: v1.0.0'), 'gold')
    assert.equal(getRefTone('origin/main'), 'cyan')
    assert.equal(getRefTone('main'), 'blue')
  })

  it('uses project branch tag colors by short branch name', () => {
    const branchTags = [
      { label: '主分支', branchName: 'main', color: '#f5222d' },
      { label: '开发分支', branchName: 'develop', color: '#1d39c4' }
    ]

    assert.equal(getRefColor('main', branchTags), '#f5222d')
    assert.equal(getRefColor('HEAD -> main', branchTags), '#f5222d')
    assert.equal(getRefColor('origin/main', branchTags), '#f5222d')
    assert.equal(getRefColor('company/main', branchTags), '#f5222d')
    assert.equal(getRefColor('origin/develop', branchTags), '#1d39c4')
    assert.equal(getRefColor('tag: v1.2.2', branchTags), 'gold')
    assert.equal(getRefColor('origin/feature/card-form', branchTags), 'cyan')
  })

  it('increments visible commit count and clamps to total commits', () => {
    assert.equal(getNextVisibleCommitCount({ current: 0, total: 185, batchSize: 60 }), 60)
    assert.equal(getNextVisibleCommitCount({ current: 60, total: 185, batchSize: 60 }), 120)
    assert.equal(getNextVisibleCommitCount({ current: 180, total: 185, batchSize: 60 }), 185)
    assert.equal(getNextVisibleCommitCount({ current: 185, total: 185, batchSize: 60 }), 185)
  })

  it('prepends a working tree commit when the repository has uncommitted files', () => {
    const commits = [
      { hash: 'head', parentHashes: ['root'], message: 'feat: latest' },
      { hash: 'root', parentHashes: [], message: 'chore: root' }
    ]
    const rows = createGraphRows(
      prependWorkingTreeCommit(commits, { files: [{ path: 'src/App.tsx' }, { path: 'README.md' }] }, ({ parentHashes, fileCount }) => ({
        hash: workingTreeCommitHash,
        parentHashes,
        message: `${fileCount} uncommitted files`
      }))
    )

    assert.equal(rows[0].hash, workingTreeCommitHash)
    assert.equal(rows[0].message, '2 uncommitted files')
    assert.deepEqual(rows[0].parentHashes, ['head'])
    assert.equal(isWorkingTreeCommit(rows[0]), true)
    assert.deepEqual(rows[0].graphParentEdges, [{ fromLaneIndex: 0, toLaneIndex: 0 }])
    assert.equal(rows[1].hash, 'head')
  })

  it('does not prepend a working tree commit when the workspace is clean', () => {
    const commits = [{ hash: 'head', parentHashes: [], message: 'feat: latest' }]
    const workingTreeCommit = createWorkingTreeCommit(commits, { files: [] }, ({ parentHashes, fileCount }) => ({
      hash: workingTreeCommitHash,
      parentHashes,
      message: `${fileCount} uncommitted files`
    }))

    assert.equal(workingTreeCommit, null)
    assert.deepEqual(prependWorkingTreeCommit(commits, { files: [] }, () => commits[0]), commits)
  })

  it('normalizes workspace file status labels for the working tree row', () => {
    assert.equal(getWorkspaceFileChangeStatus({ indexStatus: 'A', worktreeStatus: ' ', conflict: false }), 'A')
    assert.equal(getWorkspaceFileChangeStatus({ indexStatus: ' ', worktreeStatus: 'M', conflict: false }), 'M')
    assert.equal(getWorkspaceFileChangeStatus({ indexStatus: '?', worktreeStatus: '?', conflict: false }), '?')
    assert.equal(getWorkspaceFileChangeStatus({ indexStatus: 'U', worktreeStatus: 'U', conflict: true }), 'U')
  })

  it('renders mapped author name with the email on the second line', () => {
    const author = getCommitAuthorDisplay({
      authorName: 'nksqw98btv',
      authorEmail: 'nksqw98btv@users.noreply.github.com',
      authorDisplayName: 'Stone',
      authorDisplayEmail: 'nksqw98btv@users.noreply.github.com'
    })

    assert.deepEqual(author, {
      name: 'Stone',
      email: 'nksqw98btv@users.noreply.github.com',
      title: 'Stone · nksqw98btv@users.noreply.github.com'
    })
  })

  it('uses mapped author display text for filtering', () => {
    assert.equal(
      getCommitAuthorFilterValue({
        authorName: 'nksqw98btv',
        authorEmail: 'nksqw98btv@users.noreply.github.com',
        authorDisplayName: 'Stone',
        authorDisplayEmail: 'nksqw98btv@users.noreply.github.com'
      }),
      'Stone <nksqw98btv@users.noreply.github.com>'
    )
  })

  it('chooses a safe default push target from repository and workspace state', () => {
    assert.deepEqual(
      getRepositoryDefaultPushTarget(
        {
          currentBranch: 'main',
          remotes: [
            { name: 'origin' },
            { name: 'backup' }
          ]
        },
        'feature/card'
      ),
      { remote: 'origin', branch: 'feature/card' }
    )

    assert.deepEqual(getRepositoryDefaultPushTarget({ currentBranch: 'develop', remotes: [] }), { remote: 'origin', branch: 'develop' })
  })
})
