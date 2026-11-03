import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ProjectOperations } from '../../shared/project-operations.js'
import { ProjectOperationsStore } from './project-operations-store.js'

const snapshot = (projectId: string): ProjectOperations => ({ projectId, services: [], deployments: {}, states: {} })
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
describe('shared project operations cache', () => {
  it('coalesces reads and refreshes while notifying every subscriber', async () => {
    const read = deferred<ProjectOperations>(), refresh = deferred<ProjectOperations>()
    let reads = 0, refreshes = 0, notices = 0
    const store = new ProjectOperationsStore('a', { readProjectOperations: () => { reads++; return read.promise }, refreshProjectOperations: () => { refreshes++; return refresh.promise } })
    const unsubscribe = store.subscribe(() => notices++)
    const a = store.read(), b = store.read()
    assert.equal(a, b); assert.equal(reads, 1)
    read.resolve(snapshot('a')); await a
    const c = store.refresh(), d = store.refresh(true)
    assert.equal(c, d); assert.equal(refreshes, 1)
    assert.equal(store.getSnapshot().data?.projectId, 'a')
    refresh.resolve(snapshot('a')); await c
    assert.ok(notices >= 4); unsubscribe()
  })
  it('does not let an older cache read replace a completed refresh', async () => {
    const read = deferred<ProjectOperations>()
    const fresh = snapshot('a'); fresh.states.fresh = { sources: {} as never, production: null }
    const store = new ProjectOperationsStore('a', { readProjectOperations: () => read.promise, refreshProjectOperations: async () => fresh })
    const pending = store.read()
    await store.refresh()
    read.resolve(snapshot('a')); await pending
    assert.equal(store.getSnapshot().data, fresh)
  })
  it('keeps project caches isolated and retains previous data when refresh fails', async () => {
    const store = new ProjectOperationsStore('a', { readProjectOperations: async () => snapshot('a'), refreshProjectOperations: async () => { throw new Error('offline') } })
    await store.read(); await store.refresh()
    assert.equal(store.getSnapshot().data?.projectId, 'a')
    assert.match(store.getSnapshot().error, /offline/)
    const other = new ProjectOperationsStore('b', { readProjectOperations: async () => snapshot('a'), refreshProjectOperations: async () => snapshot('a') })
    await other.read(); await other.refresh()
    assert.equal(other.getSnapshot().data, null)
  })
})
