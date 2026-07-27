import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deleteDataSourceConnection,
  listDataSourceConnections,
  migrateDataSourceTables,
  normalizeReadOnlySql,
  saveDataSourceConnection
} from './data-sources.js'

type TestDatabase = {
  migrations: string[]
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function createDatabase(): TestDatabase {
  const rows: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    migrations: [],
    exec: (sql) => {
      db.migrations.push(sql)
    },
    prepare: (sql: string) => {
      if (sql.includes('SELECT * FROM data_source_connections ORDER BY created_at ASC')) {
        return {
          all: () => [...rows].sort((left, right) => String(left.created_at).localeCompare(String(right.created_at))),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM data_source_connections WHERE id = ?')) {
        return {
          all: () => [],
          get: (id) => rows.find((row) => row.id === id),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO data_source_connections')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, kind, name, configJson, secretJson, createdAt, updatedAt) => {
            rows.push({
              id,
              kind,
              name,
              config_json: configJson,
              secret_json: secretJson,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE data_source_connections')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (kind, name, configJson, secretJson, updatedAt, id) => {
            const existing = rows.find((row) => row.id === id)

            if (existing) {
              existing.kind = kind
              existing.name = name
              existing.config_json = configJson
              existing.secret_json = secretJson
              existing.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('DELETE FROM data_source_connections')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id) => {
            const index = rows.findIndex((row) => row.id === id)

            if (index >= 0) {
              rows.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateDataSourceTables(db)
  return db
}

describe('data source connections', () => {
  it('migrates the data source table', () => {
    const db = createDatabase()

    assert.equal(db.migrations.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS data_source_connections')), true)
    assert.deepEqual(listDataSourceConnections(db), [])
  })

  it('stores database connections with redacted secrets', () => {
    const db = createDatabase()
    const record = saveDataSourceConnection(db, {
      kind: 'mysql',
      name: ' Local MySQL ',
      config: {
        host: ' 127.0.0.1 ',
        port: 3306,
        database: ' app ',
        username: ' root ',
        ssl: false
      },
      secret: {
        password: 'secret'
      }
    })

    assert.equal(record.name, 'Local MySQL')
    assert.equal(record.kind, 'mysql')
    assert.equal(record.config.host, '127.0.0.1')
    assert.equal(record.config.database, 'app')
    assert.equal(record.secretConfigured, true)
    assert.equal('password' in record, false)
  })

  it('keeps an existing secret when editing leaves the secret blank', () => {
    const db = createDatabase()
    const record = saveDataSourceConnection(db, {
      kind: 'postgresql',
      name: 'PG',
      config: {
        host: 'db.local',
        port: 5432,
        database: 'main',
        username: 'postgres'
      },
      secret: {
        password: 'keep-me'
      }
    })

    const updated = saveDataSourceConnection(db, {
      id: record.id,
      kind: 'postgresql',
      name: 'Renamed PG',
      config: {
        host: 'db.local',
        port: 5432,
        database: 'main',
        username: 'postgres'
      },
      secret: {
        password: ''
      }
    })

    assert.equal(updated.name, 'Renamed PG')
    assert.equal(updated.secretConfigured, true)
  })

  it('updates the display name without changing the connection identity or config', () => {
    const db = createDatabase()
    const record = saveDataSourceConnection(db, {
      kind: 'mysql',
      name: 'Production orders',
      config: {
        host: 'db.local',
        port: 3306,
        database: 'orders',
        username: 'reader',
        ssl: true
      },
      secret: {
        password: 'secret'
      }
    })

    const renamed = saveDataSourceConnection(db, {
      id: record.id,
      kind: 'mysql',
      name: 'Railway orders',
      config: record.config,
      secret: {}
    })

    assert.equal(renamed.id, record.id)
    assert.equal(renamed.name, 'Railway orders')
    assert.deepEqual(renamed.config, record.config)
  })

  it('validates required fields and deletes records', () => {
    const db = createDatabase()

    assert.throws(
      () =>
        saveDataSourceConnection(db, {
          kind: 'mysql',
          name: 'Broken',
          config: {
            host: '',
            database: 'app',
            username: 'root'
          }
        }),
      /请输入数据库主机/
    )

    const record = saveDataSourceConnection(db, {
      kind: 'redis',
      name: 'Redis',
      config: {
        host: '127.0.0.1',
        port: 6379
      },
      secret: {
        password: ''
      }
    })

    assert.equal(listDataSourceConnections(db).length, 1)
    assert.deepEqual(deleteDataSourceConnection(db, record.id), [])
  })
})

describe('read-only SQL guard', () => {
  it('accepts single read-only SQL statements', () => {
    assert.equal(normalizeReadOnlySql(' select * from users; '), 'select * from users')
    assert.equal(normalizeReadOnlySql('WITH rows AS (SELECT 1) SELECT * FROM rows'), 'WITH rows AS (SELECT 1) SELECT * FROM rows')
    assert.equal(normalizeReadOnlySql('SHOW TABLES'), 'SHOW TABLES')
    assert.equal(normalizeReadOnlySql('DESCRIBE users'), 'DESCRIBE users')
    assert.equal(normalizeReadOnlySql('EXPLAIN SELECT * FROM users'), 'EXPLAIN SELECT * FROM users')
  })

  it('rejects writes, management statements, and multiple statements', () => {
    assert.throws(() => normalizeReadOnlySql(''), /请输入 SQL/)
    assert.throws(() => normalizeReadOnlySql('UPDATE users SET name = "x"'), /只允许执行/)
    assert.throws(() => normalizeReadOnlySql('SELECT * FROM users; DELETE FROM users'), /单条只读/)
    assert.throws(() => normalizeReadOnlySql('WITH gone AS (DELETE FROM users RETURNING *) SELECT * FROM gone'), /写入或管理/)
    assert.throws(() => normalizeReadOnlySql('EXPLAIN ANALYZE SELECT * FROM users'), /写入或管理/)
    assert.throws(() => normalizeReadOnlySql('DROP TABLE users'), /只允许执行/)
  })
})
