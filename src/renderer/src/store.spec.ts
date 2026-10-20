import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { useForgeDeskStore as store } from './store.js'
import type { Project, Repository } from './data'

const project: Project = { id: 'p', name: 'p', description: '', status: 'ready', owner: '', workspacePath: '/tmp/p', createdAt: '', isFavorite: false }
const repo = { id: 'r', projectId: 'p', hasChanges: false, currentBranch: 'main', checkedOutCommit: 'a', ahead: 0, pushTargets: [] } as unknown as Repository
const snapshot = () => ({ projects: [structuredClone(project)], repositories: [structuredClone(repo)] })
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { resolve, promise } }

describe('workspace store read isolation', () => {
  beforeEach(() => {
    store.getState().applyWorkspace({ projects: [], repositories: [] })
    store.getState().applyWorkspace(snapshot())
    store.setState({ workspaceLoaded: true, loadingWorkspace: false })
  })
  it('deduplicates warm reads without hiding cached rows', async () => {
    const read = deferred<ReturnType<typeof snapshot>>()
    let reads = 0
    Object.assign(globalThis, { window: { forgeDesk: { listProjects: () => { reads++; return read.promise } } } })
    const first = store.getState().loadWorkspace(), second = store.getState().loadWorkspace()
    await Promise.resolve()
    assert.equal(first, second); assert.equal(reads, 1); assert.equal(store.getState().loadingWorkspace, false)
    assert.equal(store.getState().projects.length, 1)
    read.resolve(snapshot()); await first
  })
  it('does not let a late focus read undo a workspace broadcast', async () => {
    const read = deferred<ReturnType<typeof snapshot>>()
    Object.assign(globalThis, { window: { forgeDesk: { listProjects: () => read.promise } } })
    const pending = store.getState().loadWorkspace()
    store.getState().applyWorkspace({ projects: [], repositories: [] })
    read.resolve(snapshot()); await pending
    assert.equal(store.getState().projects.length, 0)
  })
  it('releases a failed read so a later refresh can recover', async () => {
    Object.assign(globalThis, { window: { forgeDesk: { listProjects: () => { throw new Error('offline') } } } })
    await assert.rejects(store.getState().loadWorkspace(), /offline/)
    Object.assign(globalThis, { window: { forgeDesk: { listProjects: async () => snapshot() } } })
    await store.getState().loadWorkspace()
    assert.equal(store.getState().loadingWorkspace, false)
    assert.equal(store.getState().projects.length, 1)
  })
  it('batches changes, skips no-ops and rejects a check started before a write', () => {
    let updates = 0
    const unsubscribe = store.subscribe(() => { updates++ })
    const started = store.getState().repositories[0]
    store.getState().applyRepositoryChecks([{ started, next: structuredClone(started) }])
    assert.equal(updates, 0)
    store.getState().updateRepository({ ...started, currentBranch: 'feature' })
    store.getState().applyRepositoryChecks([{ started, next: { ...started, hasChanges: true } }])
    assert.equal(updates, 1); assert.equal(store.getState().repositories[0].currentBranch, 'feature')
    unsubscribe()
  })
  it('preserves live status over unchanged cached metadata, until a real write', () => {
    const started = store.getState().repositories[0]
    store.getState().applyRepositoryChecks([{ started, next: { ...started, hasChanges: true } }])
    store.getState().applyWorkspace(snapshot())
    assert.equal(store.getState().repositories[0].hasChanges, true)
    store.getState().updateRepository({ ...started, checkedOutCommit: 'new' })
    store.getState().applyWorkspace(snapshot())
    assert.equal(store.getState().repositories[0].hasChanges, false)
  })
})
