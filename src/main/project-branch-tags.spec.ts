import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listProjectBranchTags, migrateProjectBranchTagTable, saveProjectBranchTag } from './project-branch-tags.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function createTestDatabase(): TestDatabase {
  const projects = new Set(['project-a'])
  const branchTags: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    exec: () => undefined,
    prepare: (sql: string) => {
      if (sql.includes('SELECT id FROM projects')) {
        return {
          all: () => [],
          get: (projectId) => (projects.has(String(projectId)) ? { id: projectId } : undefined),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT id FROM project_branch_tags WHERE project_id = ? LIMIT 1')) {
        return {
          all: () => [],
          get: (projectId) => branchTags.find((tag) => tag.project_id === projectId),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT id FROM project_branch_tags')) {
        return {
          all: () => [],
          get: (projectId, branchName) => branchTags.find((tag) => tag.project_id === projectId && tag.branch_name === branchName),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM project_branch_tags WHERE project_id = ? ORDER BY created_at ASC')) {
        return {
          all: (projectId) => branchTags.filter((tag) => tag.project_id === projectId).sort((left, right) => String(left.created_at).localeCompare(String(right.created_at))),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM project_branch_tags WHERE project_id = ? AND branch_name = ?')) {
        return {
          all: () => [],
          get: (projectId, branchName) => branchTags.find((tag) => tag.project_id === projectId && tag.branch_name === branchName),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM project_branch_tags WHERE project_id = ? AND id = ?')) {
        return {
          all: () => [],
          get: (projectId, tagId) => branchTags.find((tag) => tag.project_id === projectId && tag.id === tagId),
          run: () => undefined
        }
      }

      if (sql.includes('UPDATE project_branch_tags') && sql.includes('branch_name = ?')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (label, branchName, color, updatedAt, projectId, tagId) => {
            const existing = branchTags.find((tag) => tag.project_id === projectId && tag.id === tagId)

            if (existing) {
              existing.label = label
              existing.branch_name = branchName
              existing.color = color
              existing.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('UPDATE project_branch_tags')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (label, color, updatedAt, projectId, tagId) => {
            const existing = branchTags.find((tag) => tag.project_id === projectId && tag.id === tagId)

            if (existing) {
              existing.label = label
              existing.color = color
              existing.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('INSERT INTO project_branch_tags')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, projectId, label, branchName, color, createdAt, updatedAt) => {
            const existing = branchTags.find((tag) => tag.project_id === projectId && tag.branch_name === branchName)

            if (existing) {
              existing.label = label
              existing.color = color
              existing.updated_at = updatedAt
              return
            }

            branchTags.push({
              id,
              project_id: projectId,
              label,
              branch_name: branchName,
              color,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('DELETE FROM project_branch_tags')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId, tagId) => {
            const index = branchTags.findIndex((tag) => tag.project_id === projectId && tag.id === tagId)

            if (index >= 0) {
              branchTags.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateProjectBranchTagTable(db)
  return db
}

describe('project branch tags', () => {
  it('creates the editable main branch default for each project', () => {
    const db = createTestDatabase()
    const tags = listProjectBranchTags(db, 'project-a')

    assert.deepEqual(
      tags.map((tag) => ({ label: tag.label, branchName: tag.branchName, color: tag.color })),
      [{ label: '主分支', branchName: 'main', color: '#f5222d' }]
    )
  })

  it('updates an existing branch tag instead of inserting duplicates for the same project branch', () => {
    const db = createTestDatabase()
    const first = saveProjectBranchTag(db, {
      projectId: 'project-a',
      label: '主分支',
      branchName: 'main',
      color: '#f5222d'
    })
    const second = saveProjectBranchTag(db, {
      projectId: 'project-a',
      label: '主干',
      branchName: 'main',
      color: '#d32029'
    })
    saveProjectBranchTag(db, {
      projectId: 'project-a',
      label: '开发分支',
      branchName: 'develop',
      color: '#1d39c4'
    })

    const tags = listProjectBranchTags(db, 'project-a')

    assert.equal(first.id, second.id)
    assert.deepEqual(
      tags.map((tag) => ({ label: tag.label, branchName: tag.branchName, color: tag.color })),
      [
        { label: '主干', branchName: 'main', color: '#d32029' },
        { label: '开发分支', branchName: 'develop', color: '#1d39c4' }
      ]
    )
  })

  it('lets the default rule be edited to a different short branch name', () => {
    const db = createTestDatabase()
    const [mainTag] = listProjectBranchTags(db, 'project-a')

    saveProjectBranchTag(db, {
      id: mainTag.id,
      projectId: 'project-a',
      label: '主干',
      branchName: 'trunk',
      color: '#1d39c4'
    })

    const tags = listProjectBranchTags(db, 'project-a')

    assert.deepEqual(
      tags.map((tag) => ({ label: tag.label, branchName: tag.branchName, color: tag.color })),
      [{ label: '主干', branchName: 'trunk', color: '#1d39c4' }]
    )
  })
})
