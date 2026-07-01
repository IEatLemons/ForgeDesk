import assert from 'node:assert/strict'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  createRsaPrivateKeyRecord,
  deleteRsaPrivateKeyRecord,
  listRsaPrivateKeyRecords,
  migrateRsaPrivateKeyTables,
  updateRsaPrivateKeyRecord
} from './rsa-private-keys.js'

type TestDatabase = {
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
    exec: () => undefined,
    prepare: (sql: string) => {
      if (sql.includes('SELECT * FROM rsa_private_keys ORDER BY created_at DESC')) {
        return {
          all: () => [...rows].sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM rsa_private_keys WHERE id = ?')) {
        return {
          all: () => [],
          get: (id) => rows.find((row) => row.id === id),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO rsa_private_keys')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id, name, notes, keySize, privateKeyPem, fingerprint, createdAt, updatedAt) => {
            rows.push({
              id,
              name,
              notes,
              key_size: keySize,
              private_key_pem: privateKeyPem,
              fingerprint,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE rsa_private_keys')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (name, notes, updatedAt, id) => {
            const existing = rows.find((row) => row.id === id)

            if (existing) {
              existing.name = name
              existing.notes = notes
              existing.updated_at = updatedAt
            }
          }
        }
      }

      if (sql.includes('DELETE FROM rsa_private_keys')) {
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

  migrateRsaPrivateKeyTables(db)
  return db
}

describe('RSA private key records', () => {
  it('migrates tables and lists an empty database', () => {
    const db = createDatabase()

    assert.deepEqual(listRsaPrivateKeyRecords(db), [])
  })

  it('generates and stores a valid RSA PKCS#8 private key record', () => {
    const db = createDatabase()
    const record = createRsaPrivateKeyRecord(db, {
      name: ' Payment webhook ',
      notes: ' Used by gateway ',
      keySize: 2048
    })

    const keyObject = createPrivateKey(record.privateKeyPem)
    const publicKeyObject = createPublicKey(record.publicKeyPem)

    assert.equal(record.name, 'Payment webhook')
    assert.equal(record.notes, 'Used by gateway')
    assert.equal(record.keySize, 2048)
    assert.equal(keyObject.asymmetricKeyType, 'rsa')
    assert.equal(publicKeyObject.asymmetricKeyType, 'rsa')
    assert.match(record.privateKeyPem, /^-----BEGIN PRIVATE KEY-----/)
    assert.match(record.privateKeyPem, /-----END PRIVATE KEY-----\n$/)
    assert.match(record.publicKeyPem, /^-----BEGIN PUBLIC KEY-----/)
    assert.match(record.publicKeyPem, /-----END PUBLIC KEY-----\n$/)
    assert.match(record.fingerprint, /^SHA256:[A-Za-z0-9_-]+$/)
    assert.equal(listRsaPrivateKeyRecords(db)[0].id, record.id)
  })

  it('updates name and notes without regenerating the private key', () => {
    const db = createDatabase()
    const record = createRsaPrivateKeyRecord(db, {
      name: 'Original',
      notes: '',
      keySize: 2048
    })

    const updated = updateRsaPrivateKeyRecord(db, {
      id: record.id,
      name: ' Renamed ',
      notes: ' Rotated in staging '
    })

    assert.equal(updated.id, record.id)
    assert.equal(updated.name, 'Renamed')
    assert.equal(updated.notes, 'Rotated in staging')
    assert.equal(updated.privateKeyPem, record.privateKeyPem)
    assert.equal(updated.fingerprint, record.fingerprint)
  })

  it('rejects blank names and unsupported key sizes', () => {
    const db = createDatabase()

    assert.throws(() => createRsaPrivateKeyRecord(db, { name: ' ', keySize: 2048 }), /请输入记录名称/)
    assert.throws(() => createRsaPrivateKeyRecord(db, { name: 'API', keySize: 1024 }), /RSA 位数只能选择 2048 或 4096/)
  })

  it('deletes generated records', () => {
    const db = createDatabase()
    const record = createRsaPrivateKeyRecord(db, {
      name: 'Temporary',
      keySize: 2048
    })

    assert.equal(listRsaPrivateKeyRecords(db).length, 1)

    const remaining = deleteRsaPrivateKeyRecord(db, record.id)

    assert.deepEqual(remaining, [])
  })

  it('reports missing records clearly', () => {
    const db = createDatabase()

    assert.throws(() => updateRsaPrivateKeyRecord(db, { id: 'missing', name: 'Name' }), /RSA 私钥记录不存在/)
  })
})
