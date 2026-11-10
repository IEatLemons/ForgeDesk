import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readWorkspaceSidebarCollapsed, saveWorkspaceSidebarCollapsed, workspaceSidebarStorageKey } from './workspace-sidebar-preference.js'

describe('workspace sidebar preference', () => {
  it('starts expanded with missing, invalid or unavailable storage', () => {
    for (const value of [null, '', 'false', 'invalid', '{}']) {
      assert.equal(readWorkspaceSidebarCollapsed({ getItem: () => value, setItem: () => undefined }), false)
    }
    assert.equal(readWorkspaceSidebarCollapsed(null), false)
  })

  it('restores both collapsed and expanded states using the dedicated key', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    saveWorkspaceSidebarCollapsed(true, storage)
    assert.equal(values.get(workspaceSidebarStorageKey), 'true')
    assert.equal(readWorkspaceSidebarCollapsed(storage), true)
    saveWorkspaceSidebarCollapsed(false, storage)
    assert.equal(readWorkspaceSidebarCollapsed(storage), false)
  })

  it('tolerates failed reads and writes', () => {
    const storage = { getItem: (): string | null => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    assert.equal(readWorkspaceSidebarCollapsed(storage), false)
    assert.doesNotThrow(() => saveWorkspaceSidebarCollapsed(true, storage))
    assert.doesNotThrow(() => saveWorkspaceSidebarCollapsed(false, null))
  })
})
