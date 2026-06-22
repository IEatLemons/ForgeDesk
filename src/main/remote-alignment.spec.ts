import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createEmptyRemoteAlignment,
  parseRemoteAlignment,
  summarizeRemoteAlignment,
  type RemoteAlignmentRemoteRef
} from './remote-alignment.js'

const remotes = [
  { name: 'origin', fetchUrl: 'git@example.com:app.git', pushUrl: 'git@example.com:app.git' },
  { name: 'github', fetchUrl: 'git@github.com:org/app.git', pushUrl: 'git@github.com:org/app.git' },
  { name: 'backup', fetchUrl: 'git@example.com:backup.git', pushUrl: 'git@example.com:backup.git' }
]

function refsByRemote(input: Record<string, Record<string, string>>): Map<string, Map<string, string>> {
  return new Map(
    Object.entries(input).map(([remoteName, refs]) => [
      remoteName,
      new Map(Object.entries(refs))
    ])
  )
}

function buildSummary(input: {
  refs: Record<string, Record<string, string>>
  exclusiveCounts?: Record<string, number>
}) {
  return summarizeRemoteAlignment({
    remotes,
    refsByRemote: refsByRemote(input.refs),
    currentBranch: 'main',
    defaultBranch: 'main',
    countExclusiveCommits: async (fromCommit: string, toCommit: string) => input.exclusiveCounts?.[`${fromCommit}..${toCommit}`] ?? 0
  })
}

describe('remote alignment helpers', () => {
  it('requires at least two remotes for multi-remote alignment', async () => {
    const summary = await summarizeRemoteAlignment({
      remotes: [remotes[0]],
      refsByRemote: refsByRemote({ origin: { main: 'aaa111' } }),
      currentBranch: 'main',
      defaultBranch: 'main',
      countExclusiveCommits: async () => 0
    })

    assert.equal(summary.status, 'missing-remote')
    assert.equal(summary.remoteCount, 1)
    assert.match(summary.errorMessage, /至少需要 2 个远端/)
  })

  it('marks three remotes aligned when each branch points at the same commit', async () => {
    const summary = await buildSummary({
      refs: {
        origin: { main: 'aaa111', feature: 'bbb222' },
        github: { main: 'aaa111', feature: 'bbb222' },
        backup: { main: 'aaa111', feature: 'bbb222' }
      }
    })

    assert.equal(summary.status, 'aligned')
    assert.equal(summary.remoteCount, 3)
    assert.equal(summary.branchCount, 2)
    assert.equal(summary.alignedBranchCount, 2)
    assert.equal(summary.branches[0].branchName, 'main')
    assert.equal(summary.branches[0].remotes.length, 3)
  })

  it('marks a branch missing when any remote lacks that branch', async () => {
    const summary = await buildSummary({
      refs: {
        origin: { main: 'aaa111', release: 'ccc333' },
        github: { main: 'aaa111' },
        backup: { main: 'aaa111', release: 'ccc333' }
      }
    })

    const release = summary.branches.find((branch) => branch.branchName === 'release')

    assert.equal(summary.status, 'missing-branch')
    assert.equal(summary.missingBranchCount, 1)
    assert.equal(release?.status, 'missing-branch')
    assert.equal(release?.remotes.find((remote) => remote.remoteName === 'github')?.commit, '')
  })

  it('marks three remote commits diverged and calculates per-remote unique commits', async () => {
    const summary = await buildSummary({
      refs: {
        origin: { main: 'aaa111' },
        github: { main: 'bbb222' },
        backup: { main: 'ccc333' }
      },
      exclusiveCounts: {
        'bbb222..aaa111': 2,
        'ccc333..aaa111': 3,
        'aaa111..bbb222': 4,
        'ccc333..bbb222': 5,
        'aaa111..ccc333': 6,
        'bbb222..ccc333': 7
      }
    })

    const main = summary.branches[0]
    const origin = main.remotes.find((remote) => remote.remoteName === 'origin') as RemoteAlignmentRemoteRef
    const github = main.remotes.find((remote) => remote.remoteName === 'github') as RemoteAlignmentRemoteRef
    const backup = main.remotes.find((remote) => remote.remoteName === 'backup') as RemoteAlignmentRemoteRef

    assert.equal(summary.status, 'diverged')
    assert.equal(summary.divergedBranchCount, 1)
    assert.equal(main.status, 'diverged')
    assert.equal(main.uniqueCommitCount, 27)
    assert.equal(origin.ahead, 5)
    assert.equal(github.ahead, 9)
    assert.equal(backup.ahead, 13)
  })

  it('parses legacy dual-remote JSON into the multi-remote shape', () => {
    const parsed = parseRemoteAlignment({
      status: 'aligned',
      companyRemoteName: 'company',
      companyRemoteUrl: 'ssh://gitea/app.git',
      githubRemoteName: 'origin',
      githubRemoteUrl: 'git@github.com:org/app.git',
      branchCount: 1,
      alignedBranchCount: 1,
      divergedBranchCount: 0,
      missingBranchCount: 0,
      currentBranchStatus: 'aligned',
      errorMessage: '',
      branches: [
        {
          branchName: 'main',
          companyRef: 'company/main',
          githubRef: 'origin/main',
          companyCommit: 'aaa111',
          githubCommit: 'aaa111',
          companyAhead: 0,
          githubAhead: 0,
          status: 'aligned'
        }
      ]
    })

    assert.deepEqual(parsed.remotes.map((remote) => remote.name), ['company', 'origin'])
    assert.equal(parsed.remoteCount, 2)
    assert.deepEqual(parsed.branches[0].remotes.map((remote) => remote.ref), ['company/main', 'origin/main'])
  })

  it('creates an empty multi-remote summary by default', () => {
    const summary = createEmptyRemoteAlignment()

    assert.equal(summary.remoteCount, 0)
    assert.deepEqual(summary.remotes, [])
    assert.deepEqual(summary.branches, [])
  })
})
