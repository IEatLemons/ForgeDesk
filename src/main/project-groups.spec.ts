import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  deleteProjectGroup,
  listProjectGroups,
  migrateProjectGroupTables,
  reorderProjectGroups,
  saveProjectGroup,
  setProjectGroup
} from './project-groups.js'

function createDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready',
      owner TEXT NOT NULL DEFAULT '',
      workspace_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  migrateProjectGroupTables(db as any)
  return db
}

describe('project groups', () => {
  it('creates, assigns, reorders, and deletes groups without deleting projects', () => {
    const db = createDatabase()
    db.prepare('INSERT INTO projects (id, name, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('project-a', 'A', '/tmp/a', '2026-08-13', '2026-08-13')

    const first = saveProjectGroup(db as any, { name: '产品' })
    const second = saveProjectGroup(db as any, { name: '实验' })
    setProjectGroup(db as any, 'project-a', first.id)

    assert.equal(listProjectGroups(db as any).find((group) => group.id === first.id)?.projectCount, 1)
    assert.deepEqual(reorderProjectGroups(db as any, [second.id, first.id]).map((group) => group.id), [second.id, first.id])

    deleteProjectGroup(db as any, first.id)
    assert.equal(db.prepare('SELECT group_id FROM projects WHERE id = ?').get('project-a')?.group_id, null)
    assert.equal(listProjectGroups(db as any).some((group) => group.id === first.id), false)
  })
})
