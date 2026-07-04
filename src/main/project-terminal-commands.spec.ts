import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deleteProjectTerminalCommand,
  listProjectTerminalCommands,
  migrateProjectTerminalCommandTable,
  saveProjectTerminalCommand
} from './project-terminal-commands.js'

type TestDatabase = {
  migrations: string[]
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function sortCommands(commands: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...commands].sort((left, right) => {
    const byOrder = Number(left.sort_order) - Number(right.sort_order)
    const byCreatedAt = String(left.created_at).localeCompare(String(right.created_at))
    return byOrder || byCreatedAt || String(left.name).localeCompare(String(right.name))
  })
}

function createTestDatabase(): TestDatabase {
  const projects = new Set(['project-a'])
  const commands: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    migrations: [],
    exec: (sql) => {
      db.migrations.push(sql)
    },
    prepare: (sql: string) => {
      if (sql.includes('SELECT id FROM projects WHERE id = ?')) {
        return {
          all: () => [],
          get: (projectId) => (projects.has(String(projectId)) ? { id: projectId } : undefined),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM project_terminal_commands WHERE project_id = ? AND id = ?')) {
        return {
          all: () => [],
          get: (projectId, commandId) => commands.find((command) => command.project_id === projectId && command.id === commandId),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM project_terminal_commands WHERE project_id = ?')) {
        return {
          all: () => [],
          get: (projectId) => ({
            max_sort_order: commands
              .filter((command) => command.project_id === projectId)
              .reduce((max, command) => Math.max(max, Number(command.sort_order)), 0)
          }),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT *') && sql.includes('FROM project_terminal_commands') && sql.includes('ORDER BY sort_order ASC')) {
        return {
          all: (projectId) => sortCommands(commands.filter((command) => command.project_id === projectId)),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('UPDATE project_terminal_commands')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (name, commandText, updatedAt, projectId, commandId) => {
            const command = commands.find((item) => item.project_id === projectId && item.id === commandId)

            if (command) {
              command.name = name
              command.command = commandText
              command.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('INSERT INTO project_terminal_commands')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, projectId, name, commandText, sortOrder, createdAt, updatedAt) => {
            commands.push({
              id,
              project_id: projectId,
              name,
              command: commandText,
              sort_order: sortOrder,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('DELETE FROM project_terminal_commands')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId, commandId) => {
            const index = commands.findIndex((command) => command.project_id === projectId && command.id === commandId)

            if (index >= 0) {
              commands.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateProjectTerminalCommandTable(db)
  return db
}

describe('project terminal commands', () => {
  it('migrates the project terminal command table', () => {
    const db = createTestDatabase()

    assert.equal(db.migrations.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS project_terminal_commands')), true)
    assert.equal(db.migrations.some((sql) => sql.includes('FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE')), true)
  })

  it('rejects commands for missing projects', () => {
    const db = createTestDatabase()

    assert.throws(() => listProjectTerminalCommands(db, 'missing'), /项目不存在/)
    assert.throws(
      () =>
        saveProjectTerminalCommand(db, {
          projectId: 'missing',
          name: 'Dev',
          command: 'pnpm dev'
        }),
      /项目不存在/
    )
  })

  it('saves trimmed commands ordered by creation and updates an existing command', () => {
    const db = createTestDatabase()
    const first = saveProjectTerminalCommand(db, {
      projectId: 'project-a',
      name: ' Dev ',
      command: ' pnpm dev '
    })
    const second = saveProjectTerminalCommand(db, {
      projectId: 'project-a',
      name: ' Test ',
      command: ' pnpm test '
    })
    const updated = saveProjectTerminalCommand(db, {
      id: first.id,
      projectId: 'project-a',
      name: ' Build ',
      command: ' pnpm build '
    })

    assert.equal(first.sortOrder, 1)
    assert.equal(second.sortOrder, 2)
    assert.equal(updated.id, first.id)
    assert.deepEqual(
      listProjectTerminalCommands(db, 'project-a').map((command) => ({
        name: command.name,
        command: command.command,
        sortOrder: command.sortOrder
      })),
      [
        { name: 'Build', command: 'pnpm build', sortOrder: 1 },
        { name: 'Test', command: 'pnpm test', sortOrder: 2 }
      ]
    )
  })

  it('deletes a project command and returns the remaining commands', () => {
    const db = createTestDatabase()
    const first = saveProjectTerminalCommand(db, {
      projectId: 'project-a',
      name: 'Dev',
      command: 'pnpm dev'
    })
    saveProjectTerminalCommand(db, {
      projectId: 'project-a',
      name: 'Test',
      command: 'pnpm test'
    })

    const remaining = deleteProjectTerminalCommand(db, 'project-a', first.id)

    assert.deepEqual(
      remaining.map((command) => command.name),
      ['Test']
    )
  })
})
