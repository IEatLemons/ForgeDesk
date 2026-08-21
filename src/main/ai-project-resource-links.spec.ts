import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  deleteAiProjectResourceLink,
  listAiProjectResourceLinks,
  migrateAiProjectResourceLinkTables,
  migrateLegacyAiProjectResourceLinks,
  saveAiProjectResourceLink,
  saveAiProjectResourceLinks
} from './ai-project-resource-links.js'

function createDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    CREATE TABLE project_ai_bindings (project_id TEXT, provider_id TEXT, workspace_path TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE codex_project_links (codex_key TEXT PRIMARY KEY, cwd TEXT, project_id TEXT, updated_at TEXT);
  `)
  db.prepare('INSERT INTO projects (id) VALUES (?)').run('forge-a')
  db.prepare('INSERT INTO projects (id) VALUES (?)').run('forge-b')
  migrateAiProjectResourceLinkTables(db as any)
  return db
}

describe('AI project resource links', () => {
  it('binds multiple Codex resources to one ForgeDesk project and keeps each resource exclusive', () => {
    const db = createDatabase()
    saveAiProjectResourceLinks(db as any, { projectId: 'forge-a', providerId: 'codex', resourcePaths: ['/tmp/one', '/tmp/two'] })
    assert.equal(listAiProjectResourceLinks(db as any, { projectId: 'forge-a', providerId: 'codex' }).length, 2)
    saveAiProjectResourceLink(db as any, { projectId: 'forge-b', providerId: 'codex', resourcePath: '/tmp/one' })
    assert.equal(listAiProjectResourceLinks(db as any, { projectId: 'forge-a', providerId: 'codex' }).length, 1)
    assert.equal(listAiProjectResourceLinks(db as any, { projectId: 'forge-b', providerId: 'codex' })[0]?.resourcePath, '/tmp/one')
    deleteAiProjectResourceLink(db as any, { providerId: 'codex', resourcePath: '/tmp/two' })
    assert.equal(listAiProjectResourceLinks(db as any, { projectId: 'forge-a' }).length, 0)
  })

  it('migrates legacy project bindings once and lets explicit Codex mapping win', () => {
    const db = createDatabase()
    db.prepare('INSERT INTO project_ai_bindings VALUES (?, ?, ?, ?, ?)').run('forge-a', 'codex', '/tmp/project', 'old', 'old')
    db.prepare('INSERT INTO codex_project_links VALUES (?, ?, ?, ?)').run('/tmp/project', '/tmp/project', 'forge-b', 'new')
    migrateLegacyAiProjectResourceLinks(db as any)
    assert.equal(listAiProjectResourceLinks(db as any, { providerId: 'codex' })[0]?.projectId, 'forge-b')
    migrateLegacyAiProjectResourceLinks(db as any)
    assert.equal(listAiProjectResourceLinks(db as any, { providerId: 'codex' }).length, 1)
  })
})
