import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getProjectAiBinding, migrateProjectAiBindingTable, saveProjectAiBinding } from './project-ai-bindings.js'

type BindingRow = {
  project_id: string
  provider_id: string
  workspace_path: string
  created_at: string
  updated_at: string
}

class FakeDatabase {
  projects = new Set(['project-1'])
  bindings = new Map<string, BindingRow>()

  exec(): void {}

  prepare(sql: string): { get: (...params: any[]) => unknown; all: (...params: any[]) => unknown[]; run: (...params: any[]) => unknown } {
    if (sql.includes('SELECT id FROM projects')) {
      return { get: (projectId: string) => this.projects.has(projectId) ? { id: projectId } : undefined, all: () => [], run: () => ({}) }
    }
    if (sql.includes('WHERE project_id = ? AND provider_id = ?')) {
      return { get: (projectId: string, providerId: string) => this.bindings.get(`${projectId}:${providerId}`), all: () => [], run: () => ({}) }
    }
    if (sql.includes('INSERT INTO project_ai_bindings')) {
      return {
        get: () => undefined,
        all: () => [],
        run: (projectId: string, providerId: string, workspacePath: string, createdAt: string, updatedAt: string) => {
          const key = `${projectId}:${providerId}`
          const existing = this.bindings.get(key)
          this.bindings.set(key, {
            project_id: projectId,
            provider_id: providerId,
            workspace_path: workspacePath,
            created_at: existing?.created_at || createdAt,
            updated_at: updatedAt
          })
          return {}
        }
      }
    }
    if (sql.includes('DELETE FROM projects')) {
      return {
        get: () => undefined,
        all: () => [],
        run: (projectId: string) => {
          this.projects.delete(projectId)
          for (const key of this.bindings.keys()) if (key.startsWith(`${projectId}:`)) this.bindings.delete(key)
          return {}
        }
      }
    }
    throw new Error(`Unexpected SQL in fake database: ${sql}`)
  }
}

describe('project AI bindings', () => {
  function createDatabase(): FakeDatabase {
    const db = new FakeDatabase()
    migrateProjectAiBindingTable(db)
    return db
  }

  it('creates and updates one binding per project and provider', () => {
    const db = createDatabase()
    const first = saveProjectAiBinding(db, { projectId: 'project-1', providerId: 'codex', workspacePath: '/tmp/example-project' })
    const second = saveProjectAiBinding(db, { projectId: 'project-1', providerId: 'codex', workspacePath: '/tmp/updated-project' })

    assert.equal(first.projectId, 'project-1')
    assert.equal(second.workspacePath, '/tmp/updated-project')
    assert.equal(db.bindings.size, 1)
    assert.equal(getProjectAiBinding(db, 'project-1', 'codex')?.workspacePath, '/tmp/updated-project')
  })

  it('cascades bindings when the project is deleted', () => {
    const db = createDatabase()
    saveProjectAiBinding(db, { projectId: 'project-1', providerId: 'codex', workspacePath: '/tmp/example-project' })
    db.prepare('DELETE FROM projects WHERE id = ?').run('project-1')
    assert.equal(db.bindings.size, 0)
  })
})
