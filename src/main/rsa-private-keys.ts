import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto'

type RsaPrivateKeyStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

type RsaPrivateKeyDatabase = {
  exec: (sql: string) => unknown
  prepare: (sql: string) => RsaPrivateKeyStatement
}

export type RsaPrivateKeySize = 2048 | 4096

export type RsaPrivateKeyRecord = {
  id: string
  name: string
  notes: string
  keySize: RsaPrivateKeySize
  privateKeyPem: string
  publicKeyPem: string
  fingerprint: string
  createdAt: string
  updatedAt: string
}

export type RsaPrivateKeyCreateInput = {
  name: string
  notes?: string
  keySize?: number
}

export type RsaPrivateKeyUpdateInput = {
  id: string
  name: string
  notes?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function createRsaPrivateKeyId(): string {
  return `rsa-key-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function normalizeRequiredText(value: string | undefined, errorMessage: string): string {
  const normalized = value?.trim() ?? ''

  if (!normalized) {
    throw new Error(errorMessage)
  }

  return normalized
}

function normalizeOptionalText(value: string | undefined): string {
  return value?.trim() ?? ''
}

function normalizeKeySize(value: number | undefined): RsaPrivateKeySize {
  const keySize = value ?? 2048

  if (keySize !== 2048 && keySize !== 4096) {
    throw new Error('RSA 位数只能选择 2048 或 4096')
  }

  return keySize
}

function mapRsaPrivateKeyRow(row: Record<string, unknown>): RsaPrivateKeyRecord {
  const privateKeyPem = String(row.private_key_pem ?? '')

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    notes: String(row.notes ?? ''),
    keySize: normalizeKeySize(Number(row.key_size ?? 2048)),
    privateKeyPem,
    publicKeyPem: createRsaPublicKeyPem(privateKeyPem),
    fingerprint: String(row.fingerprint ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function getRsaPrivateKeyRecord(db: RsaPrivateKeyDatabase, id: string): RsaPrivateKeyRecord | null {
  const row = db.prepare('SELECT * FROM rsa_private_keys WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? mapRsaPrivateKeyRow(row) : null
}

function generatePrivateKeyPem(keySize: RsaPrivateKeySize): string {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: keySize,
    publicExponent: 0x10001
  })

  const exported = privateKey.export({ type: 'pkcs8', format: 'pem' })
  return typeof exported === 'string' ? exported : exported.toString('utf8')
}

export function createRsaPrivateKeyFingerprint(privateKeyPem: string): string {
  const publicKeyDer = createPublicKey(privateKeyPem).export({ type: 'spki', format: 'der' })
  const digest = createHash('sha256').update(publicKeyDer).digest('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `SHA256:${digest}`
}

export function createRsaPublicKeyPem(privateKeyPem: string): string {
  const exported = createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' })
  return typeof exported === 'string' ? exported : exported.toString('utf8')
}

export function migrateRsaPrivateKeyTables(db: RsaPrivateKeyDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rsa_private_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      key_size INTEGER NOT NULL,
      private_key_pem TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

export function listRsaPrivateKeyRecords(db: RsaPrivateKeyDatabase): RsaPrivateKeyRecord[] {
  return (db.prepare('SELECT * FROM rsa_private_keys ORDER BY created_at DESC').all() as Array<Record<string, unknown>>).map(mapRsaPrivateKeyRow)
}

export function createRsaPrivateKeyRecord(db: RsaPrivateKeyDatabase, input: RsaPrivateKeyCreateInput): RsaPrivateKeyRecord {
  const name = normalizeRequiredText(input.name, '请输入记录名称')
  const notes = normalizeOptionalText(input.notes)
  const keySize = normalizeKeySize(input.keySize)
  const privateKeyPem = generatePrivateKeyPem(keySize)
  const fingerprint = createRsaPrivateKeyFingerprint(privateKeyPem)
  const id = createRsaPrivateKeyId()
  const now = nowIso()

  db.prepare(
    `
    INSERT INTO rsa_private_keys (id, name, notes, key_size, private_key_pem, fingerprint, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, name, notes, keySize, privateKeyPem, fingerprint, now, now)

  return getRsaPrivateKeyRecord(db, id) as RsaPrivateKeyRecord
}

export function updateRsaPrivateKeyRecord(db: RsaPrivateKeyDatabase, input: RsaPrivateKeyUpdateInput): RsaPrivateKeyRecord {
  const existing = getRsaPrivateKeyRecord(db, input.id)

  if (!existing) {
    throw new Error('RSA 私钥记录不存在')
  }

  const name = normalizeRequiredText(input.name, '请输入记录名称')
  const notes = normalizeOptionalText(input.notes)

  db.prepare('UPDATE rsa_private_keys SET name = ?, notes = ?, updated_at = ? WHERE id = ?').run(name, notes, nowIso(), existing.id)
  return getRsaPrivateKeyRecord(db, existing.id) as RsaPrivateKeyRecord
}

export function deleteRsaPrivateKeyRecord(db: RsaPrivateKeyDatabase, id: string): RsaPrivateKeyRecord[] {
  db.prepare('DELETE FROM rsa_private_keys WHERE id = ?').run(id)
  return listRsaPrivateKeyRecords(db)
}
