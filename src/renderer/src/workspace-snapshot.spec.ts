import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyWorkspaceSnapshot, overlayRepositoryRead, shareWorkspaceRecords } from './workspace-snapshot.js'

const projectA = {
  id: 'project-a',
  name: 'Project A',
  description: '',
  status: 'ready' as const,
  owner: '',
  workspacePath: '/tmp/project-a',
  createdAt: '2026-06-23T00:00:00.000Z',
  isFavorite: false
}

const projectB = {
  ...projectA,
  id: 'project-b',
  name: 'Project B',
  workspacePath: '/tmp/project-b'
}

const repositoryA = {
  id: 'repo-a',
  projectId: 'project-a',
  name: 'repo-a',
  repositoryKind: 'root' as const,
  parentRepositoryId: '',
  relativePath: '.',
  submoduleName: '',
  submoduleUrl: '',
  expectedCommit: '',
  checkedOutCommit: '',
  isDetached: false,
  submoduleState: 'unknown' as const,
  available: true,
  scanError: '',
  active: true,
  localPath: '/tmp/project-a/repo-a',
  remoteUrl: '',
  remotes: [],
  remoteCount: 0,
  localBranchCount: 0,
  remoteBranchCount: 0,
  branches: [],
  remoteBranches: [],
  pushTargets: [],
  defaultBranch: '',
  currentBranch: '',
  latestCommit: '',
  hasChanges: false,
  ahead: 0,
  localUserName: '',
  localUserEmail: '',
  effectiveUserName: '',
  effectiveUserEmail: '',
  remoteAlignment: {
    status: 'unknown' as const,
    branchCount: 0,
    alignedBranchCount: 0,
    divergedBranchCount: 0,
    missingBranchCount: 0,
    currentBranchStatus: '' as const,
    errorMessage: '',
    remotes: [],
    remoteCount: 0,
    branches: []
  }
}

const repositoryB = {
  ...repositoryA,
  id: 'repo-b',
  projectId: 'project-b',
  name: 'repo-b',
  localPath: '/tmp/project-b/repo-b'
}

describe('workspace snapshot state helpers', () => {
  it('preserves a newer local check over an identical scan snapshot, not over a new operation', () => {
    const changed = { ...repositoryA, hasChanges: true }
    const overlay = { base: repositoryA, next: changed }
    assert.equal(overlayRepositoryRead(structuredClone(repositoryA), overlay).hasChanges, true)
    const switched = { ...repositoryA, currentBranch: 'feature' }
    assert.equal(overlayRepositoryRead(switched, overlay), switched)
  })
  it('reuses unchanged IPC records, arrays and summaries', () => {
    const state = { projects: [projectA, projectB], repositories: [repositoryA, repositoryB], selectedProjectId: projectA.id, summaries: {} }
    const result = applyWorkspaceSnapshot(state, JSON.parse(JSON.stringify(state)))
    assert.equal(result.projects, state.projects)
    assert.equal(result.repositories, state.repositories)
    assert.equal(result.summaries, state.summaries)
    const changed = shareWorkspaceRecords(state.repositories, [{ ...repositoryA, ahead: 2 }, structuredClone(repositoryB)])
    assert.notEqual(changed[0], repositoryA)
    assert.equal(changed[1], repositoryB)
  })
  it('updates the workspace snapshot after deleting the selected project', () => {
    const next = applyWorkspaceSnapshot(
      {
        selectedProjectId: 'project-a',
        summaries: { 'project-a': { projectId: 'project-a' } as any, 'project-b': { projectId: 'project-b' } as any }
      },
      {
        projects: [projectB],
        repositories: [repositoryB]
      },
      { dropProjectId: 'project-a' }
    )

    assert.deepEqual(next.projects, [projectB])
    assert.deepEqual(next.repositories, [repositoryB])
    assert.equal(next.selectedProjectId, 'project-b')
    assert.equal(next.summaries['project-a'], undefined)
  })

  it('keeps the current selection when the selected project still exists', () => {
    const next = applyWorkspaceSnapshot(
      {
        selectedProjectId: 'project-a',
        summaries: { 'project-a': { projectId: 'project-a' } as any }
      },
      {
        projects: [projectA, projectB],
        repositories: [repositoryA, repositoryB]
      }
    )

    assert.equal(next.selectedProjectId, 'project-a')
    assert.equal(next.summaries['project-a']?.projectId, 'project-a')
  })
})
