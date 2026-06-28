import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_TERMINAL_REMOTE_GROUP_ID,
  buildTerminalRemoteSshCommand,
  deleteTerminalRemoteGroup,
  listTerminalRemoteGroups,
  listTerminalRemoteHosts,
  migrateTerminalRemoteShortcutTables,
  saveTerminalRemoteGroup,
  saveTerminalRemoteHost
} from './terminal-remote-shortcuts.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function sortGroups(groups: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...groups].sort((left, right) => {
    const byOrder = Number(left.sort_order) - Number(right.sort_order)
    return byOrder || String(left.name).localeCompare(String(right.name))
  })
}

function createDatabase(): TestDatabase {
  const groups: Array<Record<string, unknown>> = []
  const hosts: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    exec: (sql) => {
      if (sql.includes('INSERT OR IGNORE INTO terminal_remote_groups')) {
        const existing = groups.find((group) => group.id === DEFAULT_TERMINAL_REMOTE_GROUP_ID)

        if (!existing) {
          groups.push({
            id: DEFAULT_TERMINAL_REMOTE_GROUP_ID,
            name: '默认',
            sort_order: 0,
            created_at: 'migration',
            updated_at: 'migration'
          })
        }
      }
    },
    prepare: (sql: string) => {
      if (sql.includes('SELECT * FROM terminal_remote_groups ORDER BY')) {
        return {
          all: () => sortGroups(groups),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM terminal_remote_groups WHERE id = ?')) {
        return {
          all: () => [],
          get: (groupId) => groups.find((group) => group.id === groupId),
          run: () => undefined
        }
      }

      if (sql.includes('SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM terminal_remote_groups')) {
        return {
          all: () => [],
          get: () => ({ max_sort_order: groups.reduce((max, group) => Math.max(max, Number(group.sort_order)), 0) }),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO terminal_remote_groups')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, name, sortOrder, createdAt, updatedAt) => {
            groups.push({
              id,
              name,
              sort_order: sortOrder,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE terminal_remote_groups')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (name, updatedAt, groupId) => {
            const group = groups.find((item) => item.id === groupId)

            if (group) {
              group.name = name
              group.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('DELETE FROM terminal_remote_groups')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (groupId) => {
            const index = groups.findIndex((group) => group.id === groupId)

            if (index >= 0) {
              groups.splice(index, 1)
            }
          }
        }
      }

      if (sql.includes('terminal_remote_hosts hosts') && sql.includes('ORDER BY groups.sort_order ASC, hosts.name ASC')) {
        return {
          all: () =>
            [...hosts].sort((left, right) => {
              const leftGroup = groups.find((group) => group.id === left.group_id)
              const rightGroup = groups.find((group) => group.id === right.group_id)
              const byGroup = Number(leftGroup?.sort_order ?? 0) - Number(rightGroup?.sort_order ?? 0)
              return byGroup || String(left.name).localeCompare(String(right.name))
            }),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM terminal_remote_hosts WHERE id = ?')) {
        return {
          all: () => [],
          get: (hostId) => hosts.find((host) => host.id === hostId),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO terminal_remote_hosts')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, groupId, name, host, username, port, identityFile, notes, createdAt, updatedAt) => {
            hosts.push({
              id,
              group_id: groupId,
              name,
              host,
              username,
              port,
              identity_file: identityFile,
              notes,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE terminal_remote_hosts SET group_id = ?, updated_at = ? WHERE group_id = ?')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (groupId, updatedAt, oldGroupId) => {
            for (const host of hosts.filter((item) => item.group_id === oldGroupId)) {
              host.group_id = groupId
              host.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('UPDATE terminal_remote_hosts')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (groupId, name, host, username, port, identityFile, notes, updatedAt, hostId) => {
            const existing = hosts.find((item) => item.id === hostId)

            if (existing) {
              Object.assign(existing, {
                group_id: groupId,
                name,
                host,
                username,
                port,
                identity_file: identityFile,
                notes,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      if (sql.includes('DELETE FROM terminal_remote_hosts')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (hostId) => {
            const index = hosts.findIndex((host) => host.id === hostId)

            if (index >= 0) {
              hosts.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }
  migrateTerminalRemoteShortcutTables(db)
  return db
}

describe('terminal remote shortcuts', () => {
  it('migrates tables and creates the default group', () => {
    const db = createDatabase()
    const groups = listTerminalRemoteGroups(db)

    assert.deepEqual(
      groups.map((group) => ({ id: group.id, name: group.name })),
      [{ id: DEFAULT_TERMINAL_REMOTE_GROUP_ID, name: '默认' }]
    )
  })

  it('saves groups and hosts ordered by group and name', () => {
    const db = createDatabase()
    const production = saveTerminalRemoteGroup(db, { name: '生产' })
    const staging = saveTerminalRemoteGroup(db, { name: '测试' })

    saveTerminalRemoteHost(db, {
      groupId: production.id,
      name: 'API 02',
      host: 'api-02.example.com',
      username: 'deploy',
      port: 2222,
      identityFile: '~/.ssh/prod key',
      notes: 'second node'
    })
    saveTerminalRemoteHost(db, {
      groupId: production.id,
      name: 'API 01',
      host: 'api-01.example.com',
      username: 'deploy',
      port: 22,
      identityFile: '',
      notes: ''
    })
    saveTerminalRemoteHost(db, {
      groupId: staging.id,
      name: 'Web',
      host: 'web-staging.example.com',
      username: 'stone',
      port: 22,
      identityFile: '',
      notes: ''
    })

    assert.deepEqual(
      listTerminalRemoteGroups(db).map((group) => group.name),
      ['默认', '生产', '测试']
    )
    assert.deepEqual(
      listTerminalRemoteHosts(db).map((host) => `${host.groupId}:${host.name}`),
      [`${production.id}:API 01`, `${production.id}:API 02`, `${staging.id}:Web`]
    )
  })

  it('moves hosts to the default group when deleting a custom group', () => {
    const db = createDatabase()
    const production = saveTerminalRemoteGroup(db, { name: '生产' })
    const host = saveTerminalRemoteHost(db, {
      groupId: production.id,
      name: 'API',
      host: 'api.example.com',
      username: 'deploy',
      port: 22,
      identityFile: '',
      notes: ''
    })

    deleteTerminalRemoteGroup(db, production.id)

    assert.deepEqual(
      listTerminalRemoteGroups(db).map((group) => group.id),
      [DEFAULT_TERMINAL_REMOTE_GROUP_ID]
    )
    assert.deepEqual(
      listTerminalRemoteHosts(db).map((item) => ({ id: item.id, groupId: item.groupId })),
      [{ id: host.id, groupId: DEFAULT_TERMINAL_REMOTE_GROUP_ID }]
    )
  })

  it('builds a quoted ssh command without storing passwords', () => {
    const db = createDatabase()
    const host = saveTerminalRemoteHost(db, {
      groupId: DEFAULT_TERMINAL_REMOTE_GROUP_ID,
      name: 'Prod shell',
      host: 'prod.example.com',
      username: 'deploy',
      port: 2222,
      identityFile: "/Users/stone/.ssh/prod key's",
      notes: 'no password field here'
    })

    assert.equal(
      buildTerminalRemoteSshCommand(host),
      "ssh -i '/Users/stone/.ssh/prod key'\\''s' -p 2222 deploy@prod.example.com"
    )
    assert.equal('password' in host, false)
  })
})
