import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { setProjectArchived } from './project-archive.js'
import { ProjectProgressService } from './project-progress.js'

describe('project archiving', () => {
  it('is reversible and idempotent and never deletes associated business data', () => {
    const db = new DatabaseSync(':memory:')
    db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY, archived_at TEXT, updated_at TEXT); INSERT INTO projects VALUES('p',NULL,'initial')")
    const service = new ProjectProgressService(() => db as never)
    const id = service.command({ type: 'create', commandId: 'create', input: { projectId: 'p', title: '保留的工作' } }).entityId
    setProjectArchived(db, { id: 'p', archived: true }, '2026-10-16T00:00:00Z')
    setProjectArchived(db, { id: 'p', archived: true }, 'later')
    assert.equal((db.prepare('SELECT archived_at FROM projects').get() as { archived_at: string }).archived_at, '2026-10-16T00:00:00Z')
    assert.equal(service.getSnapshot().items.length, 0)
    assert.equal(service.getSnapshot({ includeArchivedProjects: true }).items.length, 1)
    assert.equal(service.getSnapshot({ projectId: 'p' }).items[0].id, id)
    service.command({ type: 'update', commandId: 'edit', id, expectedVersion: 1, patch: { title: '归档后仍可管理' } })
    setProjectArchived(db, { id: 'p', archived: false })
    assert.equal(service.getSnapshot().items[0].title, '归档后仍可管理')
    assert.throws(() => setProjectArchived(db, { id: 'missing', archived: true }), /不存在/)
    assert.throws(() => setProjectArchived(db, { id: 'p', archived: 'yes' } as never), /无效/)
    db.close()
  })
})
