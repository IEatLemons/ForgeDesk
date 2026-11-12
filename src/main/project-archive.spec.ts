import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setProjectArchived } from './project-archive.js'
import Database from 'better-sqlite3'
import { TaskWorkspaceService } from './task-workspace.js'

describe('project archiving', () => {
  it('is reversible and idempotent and never deletes associated business data', () => {
    const db = new Database(':memory:')
    db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY, archived_at TEXT, updated_at TEXT); INSERT INTO projects VALUES('p',NULL,'initial')")
    const service = new TaskWorkspaceService(db)
    service.initialize('/test-backup')
    const id = service.command({ type: 'save-task', commandId: 'create', input: { title: '独立的任务' } }).entityId
    setProjectArchived(db, { id: 'p', archived: true }, '2026-10-16T00:00:00Z')
    setProjectArchived(db, { id: 'p', archived: true }, 'later')
    assert.equal((db.prepare('SELECT archived_at FROM projects').get() as { archived_at: string }).archived_at, '2026-10-16T00:00:00Z')
    assert.equal(service.snapshot().tasks.length, 1)
    assert.equal(service.snapshot().tasks[0].id, id)
    service.command({ type: 'save-task', commandId: 'edit', expectedVersion: 1, input: { id, title: '归档后仍可管理' } })
    setProjectArchived(db, { id: 'p', archived: false })
    assert.equal(service.snapshot().tasks[0].title, '归档后仍可管理')
    assert.throws(() => setProjectArchived(db, { id: 'missing', archived: true }), /不存在/)
    assert.throws(() => setProjectArchived(db, { id: 'p', archived: 'yes' } as never), /无效/)
    db.close()
  })
})
