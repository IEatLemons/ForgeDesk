import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PUSH_ALL_REMOTES_VALUE,
  canCommitSelection,
  canPushSelection,
  createPushRemoteOptions,
  getCurrentBranchName,
  getPushableTargets,
  hasProjectCommittableChanges,
  hasProjectPushableTargets,
  mergeRepositoryWorkspaceStatus,
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
    assert.deepEqual(resolveSelectedPushRemoteNames('backup', repository.remotes), ['backup'])
  })

  it('enables push for selected remotes only when that selection has outgoing commits', () => {
    assert.equal(canPushSelection('origin', repository.pushTargets), false)
    assert.equal(canPushSelection('backup', repository.pushTargets), true)
    assert.equal(canPushSelection(PUSH_ALL_REMOTES_VALUE, repository.pushTargets), true)
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
})
