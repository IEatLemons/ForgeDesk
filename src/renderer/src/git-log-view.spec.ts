import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildBranchGroups, createGraphRows, getNextVisibleCommitCount, getRefTone } from './git-log-view.js'

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
    assert.ok(rows[0].graphLanes.length >= 1)
  })

  it('keeps side parent lanes connected until their commit row is reached', () => {
    const rows = createGraphRows([
      { hash: 'merge', parentHashes: ['main-parent', 'feature-parent'] },
      { hash: 'main-parent', parentHashes: ['root'] },
      { hash: 'feature-parent', parentHashes: ['root'] },
      { hash: 'root', parentHashes: [] }
    ])

    assert.deepEqual(rows[0].graphBottomLaneIndexes, [0, 1])
    assert.deepEqual(rows[1].graphTopLaneIndexes, [0, 1])
    assert.deepEqual(rows[1].graphBottomLaneIndexes, [0, 1])
    assert.equal(rows[2].graphLaneIndex, 1)
    assert.deepEqual(rows[2].graphParentLaneIndexes, [0])
    assert.deepEqual(rows[2].graphBottomLaneIndexes, [0])
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

  it('increments visible commit count and clamps to total commits', () => {
    assert.equal(getNextVisibleCommitCount({ current: 0, total: 185, batchSize: 60 }), 60)
    assert.equal(getNextVisibleCommitCount({ current: 60, total: 185, batchSize: 60 }), 120)
    assert.equal(getNextVisibleCommitCount({ current: 180, total: 185, batchSize: 60 }), 185)
    assert.equal(getNextVisibleCommitCount({ current: 185, total: 185, batchSize: 60 }), 185)
  })
})
