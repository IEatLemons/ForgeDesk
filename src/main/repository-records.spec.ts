import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { removeUnavailableRepositoryRecord } from './repository-records.js'

function database(filename = ':memory:') {
  const db = new DatabaseSync(filename)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY, project_id TEXT, parent_repository_id TEXT,
      available INTEGER, active INTEGER, local_path TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS git_commits (
      id TEXT PRIMARY KEY, repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE
    );
  `)
  return {
    db,
    prepare: (sql: string) => db.prepare(sql),
    transaction: (callback: () => void) => () => {
      db.exec('BEGIN')
      try { callback(); db.exec('COMMIT') } catch (error) { db.exec('ROLLBACK'); throw error }
    }
  }
}

describe('unavailable repository record removal', () => {
  it('persists removal and clears cached commits without touching local files or other repositories', () => {
    const directory = mkdtempSync(join(tmpdir(), 'forgedesk-repository-records-'))
    const localFile = join(directory, 'keep.txt')
    const filename = join(directory, 'workspace.sqlite')
    const connection = database(filename)
    try {
      writeFileSync(localFile, 'local contents')
      connection.db.prepare('INSERT INTO repositories VALUES (?, ?, ?, 0, 0, ?, ?)').run('missing', 'p', '', directory, 'initial')
      connection.db.exec("INSERT INTO repositories VALUES ('other', 'p', '', 1, 1, '', 'initial'); INSERT INTO git_commits VALUES ('cached', 'missing'), ('keep', 'other')")
      removeUnavailableRepositoryRecord(connection, 'missing')
      assert.equal(readFileSync(localFile, 'utf8'), 'local contents')
      assert.deepEqual(connection.db.prepare('SELECT id FROM git_commits').all().map(row => row.id), ['keep'])
      connection.db.close()
      const reopened = database(filename)
      try {
        assert.deepEqual(reopened.db.prepare('SELECT id FROM repositories').all().map(row => row.id), ['other'])
      } finally { reopened.db.close() }
    } finally {
      if (connection.db.isOpen) connection.db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('preserves descendants and their history when removing a missing parent', () => {
    const connection = database()
    try {
      connection.db.exec(`
        INSERT INTO repositories VALUES
          ('root', 'p', '', 1, 1, '', 'initial'),
          ('missing', 'p', 'root', 0, 0, '', 'initial'),
          ('child', 'p', 'missing', 0, 0, '', 'initial'),
          ('grandchild', 'p', 'child', 1, 1, '', 'initial');
        INSERT INTO git_commits VALUES ('keep', 'child');
      `)
      removeUnavailableRepositoryRecord(connection, 'missing')
      assert.equal(connection.db.prepare("SELECT parent_repository_id FROM repositories WHERE id = 'child'").get()?.parent_repository_id, 'root')
      assert.equal(connection.db.prepare("SELECT parent_repository_id FROM repositories WHERE id = 'grandchild'").get()?.parent_repository_id, 'child')
      assert.equal(connection.db.prepare('SELECT COUNT(*) AS count FROM git_commits').get()?.count, 1)
      removeUnavailableRepositoryRecord(connection, 'child')
      assert.equal(connection.db.prepare("SELECT parent_repository_id FROM repositories WHERE id = 'grandchild'").get()?.parent_repository_id, 'root')
    } finally { connection.db.close() }
  })

  it('rejects available repositories and unavailable submodules still found by scanning', () => {
    const connection = database()
    try {
      connection.db.exec(`INSERT INTO repositories VALUES
        ('available', 'p', '', 1, 1, '', 'initial'),
        ('uninitialized', 'p', '', 0, 1, '', 'initial'),
        ('rediscovered', 'p', '', 1, 0, '', 'initial')`)
      for (const id of ['available', 'uninitialized', 'rediscovered']) {
        assert.throws(() => removeUnavailableRepositoryRecord(connection, id), /仅可移除/)
      }
      assert.throws(() => removeUnavailableRepositoryRecord(connection, 'unknown'), /不存在/)
      assert.throws(() => removeUnavailableRepositoryRecord(connection, ''), /无效/)
      assert.equal(connection.db.prepare('SELECT COUNT(*) AS count FROM repositories').get()?.count, 3)
    } finally { connection.db.close() }
  })

  it('rolls back hierarchy changes if deletion fails', () => {
    const connection = database()
    try {
      connection.db.exec(`
        INSERT INTO repositories VALUES ('missing', 'p', '', 0, 0, '', 'initial'), ('child', 'p', 'missing', 0, 0, '', 'initial');
        CREATE TRIGGER reject_removal BEFORE DELETE ON repositories BEGIN SELECT RAISE(ABORT, 'blocked'); END;
      `)
      assert.throws(() => removeUnavailableRepositoryRecord(connection, 'missing'), /blocked/)
      assert.equal(connection.db.prepare("SELECT parent_repository_id FROM repositories WHERE id = 'child'").get()?.parent_repository_id, 'missing')
      assert.equal(connection.db.prepare('SELECT COUNT(*) AS count FROM repositories').get()?.count, 2)
    } finally { connection.db.close() }
  })
})
