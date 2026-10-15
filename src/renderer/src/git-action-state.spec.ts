import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PUSH_ALL_REMOTES_VALUE,
  canCommitSelection,
  canPushAllLocalRefsSelection,
  canPushBranchSelection,
  canPushSelection,
  createPushRemoteOptions,
  getDefaultPushRemoteSelection,
  getCurrentBranchName,
  getPushableTargets,
  hasProjectCommittableChanges,
  hasProjectPushableTargets,
  mergeRepositoryPushTarget,
  mergeRepositoryWorkspaceStatus,
  normalizePushRemoteSelection,
  resolveSelectedPushRemoteNames
} from './git-action-state.js'

const repository = {
  ahead: 0,
  currentBranch: 'main',
  hasChanges: false,
  pushTargets: [
    { remote: 'origin', branch: 'main', ahead: 0, hasRemoteBranch: true },
    { remote: 'backup', branch: 'main', ahead: 3, hasRemoteBranch: true }
  ],
  remotes: [
    { name: 'origin', fetchUrl: 'git@example.com:app.git', pushUrl: 'git@example.com:app.git' },
    { name: 'backup', fetchUrl: 'git@example.com:backup.git', pushUrl: 'git@example.com:backup.git' }
  ]
}

describe('git action state helpers', () => {
  it('enables project commit only when at least one repository has committable changes', () => {
    assert.equal(hasProjectCommittableChanges([{ ...repository, hasChanges: false }]), false)
    assert.equal(hasProjectCommittableChanges([{ ...repository, hasChanges: true }]), true)
  })

  it('enables project push only when the current branch is ahead of at least one remote', () => {
    assert.equal(hasProjectPushableTargets([{ ...repository, pushTargets: [{ remote: 'origin', branch: 'main', ahead: 0, hasRemoteBranch: true }] }]), false)
    assert.equal(hasProjectPushableTargets([repository]), true)
  })

  it('checks commit selection from detected workspace files and the message', () => {
    assert.equal(canCommitSelection([{ path: 'src/App.tsx' }], [], 'feat: update'), false)
    assert.equal(canCommitSelection([{ path: 'src/App.tsx' }], ['src/App.tsx'], '   '), false)
    assert.equal(canCommitSelection([{ path: 'src/App.tsx' }], ['src/App.tsx'], 'feat: update'), true)
  })

  it('builds all-remotes push options and resolves selected remotes', () => {
    assert.deepEqual(getPushableTargets(repository.pushTargets).map((target) => target.remote), ['backup'])
    assert.deepEqual(createPushRemoteOptions(repository.remotes, repository.pushTargets).map((option) => option.value), [
      PUSH_ALL_REMOTES_VALUE,
      'origin',
      'backup'
    ])
    assert.deepEqual(resolveSelectedPushRemoteNames(PUSH_ALL_REMOTES_VALUE, repository.remotes), ['origin', 'backup'])
    assert.deepEqual(getDefaultPushRemoteSelection(repository.remotes), [PUSH_ALL_REMOTES_VALUE])
    assert.deepEqual(normalizePushRemoteSelection([PUSH_ALL_REMOTES_VALUE, 'origin']), [PUSH_ALL_REMOTES_VALUE])
    assert.deepEqual(resolveSelectedPushRemoteNames(['origin', 'backup'], repository.remotes), ['origin', 'backup'])
    assert.deepEqual(resolveSelectedPushRemoteNames('backup', repository.remotes), ['backup'])
  })

  it('enables push for selected remotes only when that selection has outgoing commits', () => {
    assert.equal(canPushSelection('origin', repository.pushTargets), false)
    assert.equal(canPushSelection('backup', repository.pushTargets), true)
    assert.equal(canPushSelection(PUSH_ALL_REMOTES_VALUE, repository.pushTargets), true)
  })

  it('allows an explicitly selected source and target branch without depending on the current branch ahead state', () => {
    assert.equal(canPushBranchSelection('origin', repository.remotes, 'feature/release', 'release/candidate'), true)
    assert.equal(canPushBranchSelection('origin', repository.remotes, '', 'release/candidate'), false)
    assert.equal(canPushBranchSelection('missing', repository.remotes, 'feature/release', 'release/candidate'), false)
  })

  it('enables all-local-ref push only when a real remote and local branch exist', () => {
    assert.equal(canPushAllLocalRefsSelection('origin', repository.remotes, 3), true)
    assert.equal(canPushAllLocalRefsSelection(PUSH_ALL_REMOTES_VALUE, repository.remotes, 3), true)
    assert.equal(canPushAllLocalRefsSelection('missing', repository.remotes, 3), false)
    assert.equal(canPushAllLocalRefsSelection('origin', repository.remotes, 0), false)
  })

  it('uses the freshly detected workspace branch before the repository fallback', () => {
    assert.equal(getCurrentBranchName({ currentBranch: 'main' }, { branch: 'feature/git-actions' }), 'feature/git-actions')
    assert.equal(getCurrentBranchName({ currentBranch: 'main' }, { branch: '' }), 'main')
  })

  it('merges fresh workspace files and push targets into repository action state', () => {
    const merged = mergeRepositoryWorkspaceStatus(repository, {
      branch: 'main',
      files: [{ path: 'Dockerfile' }, { path: 'apps/backend-go/.env.example' }],
      pushTargets: [{ remote: 'origin', branch: 'main', ahead: 1, hasRemoteBranch: true }]
    })

    assert.equal(merged.hasChanges, true)
    assert.equal(merged.ahead, 1)
    assert.deepEqual(merged.pushTargets, [{ remote: 'origin', branch: 'main', ahead: 1, hasRemoteBranch: true }])
    assert.equal(hasProjectCommittableChanges([merged]), true)
    assert.equal(hasProjectPushableTargets([merged]), true)
  })

  it('merges concurrent push results into the latest state without reverting another remote or workspace edits', () => {
    const started = {
      ...repository,
      checkedOutCommit: 'commit-1',
      ahead: 3,
      pushTargets: repository.pushTargets.map((target) => ({ ...target, ahead: 3 }))
    }

    // Both pushes began from the same snapshot; either may finish first.
    for (const remoteOrder of [['origin', 'backup'], ['backup', 'origin']]) {
      let current = { ...started, hasChanges: true }
      for (const remote of remoteOrder) {
        current = mergeRepositoryPushTarget(current, started, { remote, branch: 'main', ahead: 0, hasRemoteBranch: true }, 'main')
        assert.equal(current.hasChanges, true)
        assert.equal(current.checkedOutCommit, 'commit-1')
      }
      assert.deepEqual(current.pushTargets.map((target) => target.ahead), [0, 0])
      assert.equal(current.ahead, 0)
    }
  })

  it('does not mark new commits or a newly checked-out branch as pushed by an older task', () => {
    const started = { ...repository, checkedOutCommit: 'commit-1' }
    const pushedTarget = { remote: 'backup', branch: 'main', ahead: 0 }
    const withNewCommit = { ...started, checkedOutCommit: 'commit-2' }
    const withNewBranch = { ...started, currentBranch: 'feature' }

    assert.equal(mergeRepositoryPushTarget(withNewCommit, started, pushedTarget, 'main'), withNewCommit)
    assert.equal(mergeRepositoryPushTarget(withNewBranch, started, pushedTarget, 'main'), withNewBranch)
  })

  it('does not clear tracking status when pushing to a different branch or pushing a non-current source', () => {
    const pushedTarget = { remote: 'backup', branch: 'main', ahead: 0 }
    assert.equal(mergeRepositoryPushTarget(repository, repository, pushedTarget, 'release'), repository)
    assert.equal(mergeRepositoryPushTarget(repository, repository, { ...pushedTarget, branch: 'feature' }, 'feature'), repository)
  })
})
