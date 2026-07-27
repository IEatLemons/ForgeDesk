import { randomUUID } from 'node:crypto'

export type DataSourceKind = 'mysql' | 'postgresql' | 'redis' | 's3'

export type DatabaseSourceKind = 'mysql' | 'postgresql'

export type DataSourceConfig = {
  host?: string
  port?: number
  database?: string
  username?: string
  ssl?: boolean
  url?: string
  tls?: boolean
  region?: string
  bucket?: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
}

export type DataSourceSecret = {
  password?: string
  secretAccessKey?: string
  sessionToken?: string
}

export type DataSourceConnectionInput = {
  id?: string
  kind: DataSourceKind
  name: string
  config: DataSourceConfig
  secret?: DataSourceSecret
}

export type DataSourceConnectionRecord = {
  id: string
  kind: DataSourceKind
  name: string
  config: DataSourceConfig
  secretConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type DataSourceConnectionSecretRecord = DataSourceConnectionRecord & {
  secret: DataSourceSecret
}

export type DataSourceConnectionTestResult = {
  ok: boolean
  message: string
  detail: string
}

export type DataSourceDatabaseTable = {
  schema: string
  name: string
  type: string
}

export type DataSourceTabularResult = {
  columns: string[]
  rows: Array<Record<string, unknown>>
  rowCount: number
  truncated: boolean
  durationMs: number
}

export type DataSourceRedisScanResult = {
  keys: string[]
  nextCursor: string
  scannedCount: number
}

export type DataSourceRedisValuePreview = {
  key: string
  type: string
  ttlSeconds: number
  size: number
  value: unknown
  rows: Array<Record<string, unknown>>
}

export type DataSourceS3Object = {
  key: string
  size: number
  lastModified: string
  etag: string
  storageClass: string
}

export type DataSourceS3ListResult = {
  bucket: string
  prefix: string
  objects: DataSourceS3Object[]
  nextContinuationToken: string
  truncated: boolean
}

export type DataSourceS3ObjectPreview = {
  bucket: string
  key: string
  size: number
  lastModified: string
  etag: string
  contentType: string
  isText: boolean
  content: string
  bytesRead: number
  truncated: boolean
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: any[]) => unknown[]
    get: (...params: any[]) => unknown
    run: (...params: any[]) => unknown
  }
}

type DataSourceConnectionRow = {
  id?: unknown
  kind?: unknown
  name?: unknown
  config_json?: unknown
  secret_json?: unknown
  created_at?: unknown
  updated_at?: unknown
}

const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_TABULAR_LIMIT = 100
const MAX_TABULAR_LIMIT = 500
const DEFAULT_REDIS_LIMIT = 100
const MAX_REDIS_LIMIT = 500
const DEFAULT_S3_LIMIT = 100
const MAX_S3_LIMIT = 1000
const S3_PREVIEW_BYTES = 256 * 1024

const readonlySqlStartPattern = /^(select|with|show|describe|desc|explain)\b/i
const blockedSqlKeywordPattern =
  /\b(insert|update|delete|drop|alter|truncate|create|replace|merge|call|copy|grant|revoke|vacuum|analyze|load|attach|detach|pragma)\b/i

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  return `data-source-${randomUUID()}`
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value !== 'string' || !value.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function normalizeKind(value: unknown): DataSourceKind {
  if (value === 'mysql' || value === 'postgresql' || value === 'redis' || value === 's3') {
    return value
  }

  throw new Error('请选择数据源类型')
}

function normalizePort(value: unknown, fallback: number): number {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback
}

function normalizeOptionalPort(value: unknown): number | undefined {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : undefined
}

function normalizeLimit(value: unknown, fallback: number, maximum: number): number {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback
  }

  return Math.min(Math.floor(numberValue), maximum)
}

function normalizeOffset(value: unknown): number {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : 0
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true'
}

function normalizeConfig(kind: DataSourceKind, config: DataSourceConfig = {}): DataSourceConfig {
  if (kind === 'mysql' || kind === 'postgresql') {
    const host = trimText(config.host)
    const database = trimText(config.database)
    const username = trimText(config.username)

    if (!host) {
      throw new Error('请输入数据库主机')
    }

    if (!database) {
      throw new Error('请输入数据库名称')
    }

    if (!username) {
      throw new Error('请输入数据库用户')
    }

    return {
      host,
      port: normalizePort(config.port, kind === 'mysql' ? 3306 : 5432),
      database,
      username,
      ssl: normalizeBoolean(config.ssl)
    }
  }

  if (kind === 'redis') {
    const url = trimText(config.url)
    const host = trimText(config.host)

    if (!url && !host) {
      throw new Error('请输入 Redis URL 或主机')
    }

    return {
      url,
      host,
      port: url ? normalizeOptionalPort(config.port) : normalizePort(config.port, 6379),
      username: trimText(config.username),
      database: trimText(config.database),
      tls: normalizeBoolean(config.tls)
    }
  }

  const region = trimText(config.region)
  const bucket = trimText(config.bucket)
  const accessKeyId = trimText(config.accessKeyId)

  if (!region) {
    throw new Error('请输入 S3 Region')
  }

  if (!bucket) {
    throw new Error('请输入 S3 Bucket')
  }

  if (!accessKeyId) {
    throw new Error('请输入 AWS Access Key ID')
  }

  return {
    region,
    bucket,
    endpoint: trimText(config.endpoint),
    forcePathStyle: normalizeBoolean(config.forcePathStyle),
    accessKeyId
  }
}

function normalizeSecret(kind: DataSourceKind, secret: DataSourceSecret = {}): DataSourceSecret {
  if (kind === 's3') {
    return {
      secretAccessKey: trimText(secret.secretAccessKey),
      sessionToken: trimText(secret.sessionToken)
    }
  }

  return {
    password: typeof secret.password === 'string' ? secret.password : ''
  }
}

function mergeSecret(kind: DataSourceKind, existing: DataSourceSecret | null, next: DataSourceSecret | undefined): DataSourceSecret {
  const normalizedNext = normalizeSecret(kind, next ?? {})

  if (kind === 's3') {
    return {
      secretAccessKey: normalizedNext.secretAccessKey || existing?.secretAccessKey || '',
      sessionToken: normalizedNext.sessionToken || existing?.sessionToken || ''
    }
  }

  return {
    password: normalizedNext.password || existing?.password || ''
  }
}

function hasSecret(kind: DataSourceKind, secret: DataSourceSecret): boolean {
  return kind === 's3' ? Boolean(secret.secretAccessKey) : Boolean(secret.password)
}

function mapConnectionRow(row: DataSourceConnectionRow, includeSecret = false): DataSourceConnectionRecord | DataSourceConnectionSecretRecord {
  const kind = normalizeKind(row.kind)
  const config = normalizeConfig(kind, parseJsonObject(row.config_json) as DataSourceConfig)
  const secret = normalizeSecret(kind, parseJsonObject(row.secret_json) as DataSourceSecret)
  const record: DataSourceConnectionRecord = {
    id: String(row.id ?? ''),
    kind,
    name: String(row.name ?? ''),
    config,
    secretConfigured: hasSecret(kind, secret),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }

  return includeSecret ? { ...record, secret } : record
}

function getConnectionSecret(db: DatabaseLike, id: string): DataSourceConnectionSecretRecord | null {
  const row = db.prepare('SELECT * FROM data_source_connections WHERE id = ?').get(id) as DataSourceConnectionRow | undefined

  return row ? (mapConnectionRow(row, true) as DataSourceConnectionSecretRecord) : null
}

function requireConnection(db: DatabaseLike, id: string): DataSourceConnectionSecretRecord {
  const connection = getConnectionSecret(db, id)

  if (!connection) {
    throw new Error('数据源连接不存在')
  }

  return connection
}

function requireDatabaseConnection(db: DatabaseLike, id: string): DataSourceConnectionSecretRecord & { kind: DatabaseSourceKind } {
  const connection = requireConnection(db, id)

  if (connection.kind !== 'mysql' && connection.kind !== 'postgresql') {
    throw new Error('请选择 MySQL 或 PostgreSQL 数据源')
  }

  return connection as DataSourceConnectionSecretRecord & { kind: DatabaseSourceKind }
}

export function migrateDataSourceTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_source_connections (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      secret_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_data_source_connections_kind ON data_source_connections(kind);
  `)
}

export function listDataSourceConnections(db: DatabaseLike): DataSourceConnectionRecord[] {
  return db
    .prepare('SELECT * FROM data_source_connections ORDER BY created_at ASC')
    .all()
    .map((row) => mapConnectionRow(row as DataSourceConnectionRow) as DataSourceConnectionRecord)
}

export function saveDataSourceConnection(db: DatabaseLike, input: DataSourceConnectionInput): DataSourceConnectionRecord {
  const kind = normalizeKind(input.kind)
  const name = trimText(input.name)

  if (!name) {
    throw new Error('请输入连接名称')
  }

  const existing = input.id ? getConnectionSecret(db, input.id) : null
  const id = existing?.id ?? input.id ?? createId()
  const config = normalizeConfig(kind, input.config)
  const secret = mergeSecret(kind, existing?.secret ?? null, input.secret)
  const now = nowIso()

  if (existing) {
    db.prepare(
      `
      UPDATE data_source_connections
      SET kind = ?, name = ?, config_json = ?, secret_json = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(kind, name, JSON.stringify(config), JSON.stringify(secret), now, id)
  } else {
    db.prepare(
      `
      INSERT INTO data_source_connections (id, kind, name, config_json, secret_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, kind, name, JSON.stringify(config), JSON.stringify(secret), now, now)
  }

  const row = db.prepare('SELECT * FROM data_source_connections WHERE id = ?').get(id) as DataSourceConnectionRow | undefined

  if (!row) {
    throw new Error('数据源连接保存失败')
  }

  return mapConnectionRow(row) as DataSourceConnectionRecord
}

export function deleteDataSourceConnection(db: DatabaseLike, id: string): DataSourceConnectionRecord[] {
  const existing = getConnectionSecret(db, id)

  if (!existing) {
    throw new Error('数据源连接不存在')
  }

  db.prepare('DELETE FROM data_source_connections WHERE id = ?').run(id)

  return listDataSourceConnections(db)
}

export function normalizeReadOnlySql(sql: string): string {
  const trimmed = sql.trim()

  if (!trimmed) {
    throw new Error('请输入 SQL 查询')
  }

  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '').trim()

  if (!withoutTrailingSemicolon || withoutTrailingSemicolon.includes(';')) {
    throw new Error('只允许执行单条只读 SQL')
  }

  if (!readonlySqlStartPattern.test(withoutTrailingSemicolon)) {
    throw new Error('只允许执行 SELECT、WITH、SHOW、DESCRIBE、DESC 或 EXPLAIN 查询')
  }

  if (blockedSqlKeywordPattern.test(withoutTrailingSemicolon)) {
    throw new Error('SQL 查询包含写入或管理语句')
  }

  return withoutTrailingSemicolon
}

function isSelectableSql(sql: string): boolean {
  return /^(select|with)\b/i.test(sql)
}

function toPlainRows(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return { ...(row as Record<string, unknown>) }
    }

    return { value: row }
  })
}

function getRowColumns(rows: Array<Record<string, unknown>>, fallback: string[] = []): string[] {
  const columns = new Set<string>(fallback)

  for (const row of rows) {
    Object.keys(row).forEach((key) => columns.add(key))
  }

  return Array.from(columns)
}

function quoteMysqlIdentifier(value: string): string {
  return `\`${value.replace(/`/g, '``')}\``
}

function quotePostgresIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function quoteDatabaseTable(kind: DatabaseSourceKind, table: DataSourceDatabaseTable): string {
  if (kind === 'mysql') {
    return `${quoteMysqlIdentifier(table.schema)}.${quoteMysqlIdentifier(table.name)}`
  }

  return `${quotePostgresIdentifier(table.schema)}.${quotePostgresIdentifier(table.name)}`
}

async function withMysqlConnection<T>(connection: DataSourceConnectionSecretRecord, callback: (client: any) => Promise<T>): Promise<T> {
  const mysql = await import('mysql2/promise')
  const client = await mysql.createConnection({
    host: connection.config.host,
    port: connection.config.port,
    user: connection.config.username,
    password: connection.secret.password,
    database: connection.config.database,
    ssl: connection.config.ssl ? {} : undefined,
    connectTimeout: DEFAULT_TIMEOUT_MS
  })

  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

async function withPostgresConnection<T>(connection: DataSourceConnectionSecretRecord, callback: (client: any) => Promise<T>): Promise<T> {
  const { Client } = await import('pg')
  const client = new Client({
    host: connection.config.host,
    port: connection.config.port,
    user: connection.config.username,
    password: connection.secret.password,
    database: connection.config.database,
    ssl: connection.config.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
    query_timeout: DEFAULT_TIMEOUT_MS
  })

  await client.connect()

  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

async function withDatabaseConnection<T>(
  connection: DataSourceConnectionSecretRecord & { kind: DatabaseSourceKind },
  callback: (client: any) => Promise<T>
): Promise<T> {
  return connection.kind === 'mysql' ? withMysqlConnection(connection, callback) : withPostgresConnection(connection, callback)
}

export async function testDataSourceConnection(db: DatabaseLike, id: string): Promise<DataSourceConnectionTestResult> {
  const connection = requireConnection(db, id)

  try {
    if (connection.kind === 'mysql' || connection.kind === 'postgresql') {
      await withDatabaseConnection(connection as DataSourceConnectionSecretRecord & { kind: DatabaseSourceKind }, async (client) => {
        if (connection.kind === 'mysql') {
          await client.query('SELECT 1 AS ok')
        } else {
          await client.query('SELECT 1 AS ok')
        }
      })
    } else if (connection.kind === 'redis') {
      await withRedisClient(connection, async (client) => {
        await client.ping()
      })
    } else {
      const client = await createS3Client(connection)
      await client.send(await createS3ListCommand(connection.config.bucket ?? '', '', 1))
    }

    return { ok: true, message: '连接成功', detail: `${connection.name} 可以访问` }
  } catch (error) {
    return { ok: false, message: '连接失败', detail: error instanceof Error ? error.message : String(error) }
  }
}

export async function listDatabaseTables(db: DatabaseLike, id: string): Promise<DataSourceDatabaseTable[]> {
  const connection = requireDatabaseConnection(db, id)

  return withDatabaseConnection(connection, async (client) => {
    if (connection.kind === 'mysql') {
      const [rows] = await client.query(
        `
        SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name, TABLE_TYPE AS table_type
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME ASC
      `,
        [connection.config.database]
      )

      return toPlainRows(rows).map((row) => ({
        schema: String(row.table_schema ?? ''),
        name: String(row.table_name ?? ''),
        type: String(row.table_type ?? '')
      }))
    }

    const result = await client.query(
      `
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema ASC, table_name ASC
    `
    )

    return toPlainRows(result.rows).map((row) => ({
      schema: String(row.table_schema ?? ''),
      name: String(row.table_name ?? ''),
      type: String(row.table_type ?? '')
    }))
  })
}

function resolveKnownTable(tables: DataSourceDatabaseTable[], schema: string | undefined, name: string): DataSourceDatabaseTable {
  const normalizedSchema = trimText(schema)
  const normalizedName = trimText(name)

  if (!normalizedName) {
    throw new Error('请选择数据表')
  }

  const table = tables.find((item) => item.name === normalizedName && (!normalizedSchema || item.schema === normalizedSchema))

  if (!table) {
    throw new Error('数据表不存在或未在元数据中发现')
  }

  return table
}

export async function previewDatabaseTable(
  db: DatabaseLike,
  id: string,
  input: { schema?: string; table: string; limit?: number; offset?: number }
): Promise<DataSourceTabularResult> {
  const connection = requireDatabaseConnection(db, id)
  const limit = normalizeLimit(input.limit, DEFAULT_TABULAR_LIMIT, MAX_TABULAR_LIMIT)
  const offset = normalizeOffset(input.offset)
  const tables = await listDatabaseTables(db, id)
  const table = resolveKnownTable(tables, input.schema, input.table)
  const startedAt = Date.now()

  return withDatabaseConnection(connection, async (client) => {
    const tableName = quoteDatabaseTable(connection.kind, table)
    const sql = `SELECT * FROM ${tableName} LIMIT ${limit + 1} OFFSET ${offset}`
    const result = connection.kind === 'mysql' ? await client.query(sql) : await client.query(sql)
    const rows = connection.kind === 'mysql' ? toPlainRows(result[0]) : toPlainRows(result.rows)
    const visibleRows = rows.slice(0, limit)

    return {
      columns: getRowColumns(visibleRows),
      rows: visibleRows,
      rowCount: visibleRows.length,
      truncated: rows.length > limit,
      durationMs: Date.now() - startedAt
    }
  })
}

export async function runDataSourceSql(
  db: DatabaseLike,
  id: string,
  input: { sql: string; limit?: number }
): Promise<DataSourceTabularResult> {
  const connection = requireDatabaseConnection(db, id)
  const sql = normalizeReadOnlySql(input.sql)
  const limit = normalizeLimit(input.limit, DEFAULT_TABULAR_LIMIT, MAX_TABULAR_LIMIT)
  const startedAt = Date.now()

  return withDatabaseConnection(connection, async (client) => {
    const executableSql = isSelectableSql(sql) ? `SELECT * FROM (${sql}) AS forgedesk_readonly_query LIMIT ${limit + 1}` : sql
    const result = connection.kind === 'mysql' ? await client.query(executableSql) : await client.query(executableSql)
    const rows = connection.kind === 'mysql' ? toPlainRows(result[0]) : toPlainRows(result.rows)
    const visibleRows = rows.slice(0, limit)
    const fields = connection.kind === 'mysql' && Array.isArray(result[1]) ? result[1].map((field: { name?: string }) => String(field.name ?? '')).filter(Boolean) : []

    return {
      columns: getRowColumns(visibleRows, fields),
      rows: visibleRows,
      rowCount: visibleRows.length,
      truncated: rows.length > limit,
      durationMs: Date.now() - startedAt
    }
  })
}

function createRedisOptions(connection: DataSourceConnectionSecretRecord): Record<string, unknown> {
  const database = Number(connection.config.database)

  if (connection.config.url) {
    return {
      url: connection.config.url,
      username: connection.config.username || undefined,
      password: connection.secret.password || undefined,
      database: Number.isFinite(database) && database >= 0 ? database : undefined,
      socket: {
        connectTimeout: DEFAULT_TIMEOUT_MS
      }
    }
  }

  return {
    username: connection.config.username || undefined,
    password: connection.secret.password || undefined,
    database: Number.isFinite(database) && database >= 0 ? database : undefined,
    socket: {
      host: connection.config.host,
      port: connection.config.port,
      tls: connection.config.tls || undefined,
      connectTimeout: DEFAULT_TIMEOUT_MS
    }
  }
}

async function withRedisClient<T>(connection: DataSourceConnectionSecretRecord, callback: (client: any) => Promise<T>): Promise<T> {
  if (connection.kind !== 'redis') {
    throw new Error('请选择 Redis 数据源')
  }

  const { createClient } = await import('redis')
  const client = createClient(createRedisOptions(connection) as never)

  client.on?.('error', () => undefined)
  await client.connect()

  try {
    return await callback(client)
  } finally {
    await client.quit()
  }
}

function normalizeRedisScan(result: unknown): { cursor: string; keys: string[] } {
  if (Array.isArray(result)) {
    return { cursor: String(result[0] ?? '0'), keys: Array.isArray(result[1]) ? result[1].map(String) : [] }
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const keys = Array.isArray(record.keys) ? record.keys.map(String) : []

    return { cursor: String(record.cursor ?? '0'), keys }
  }

  return { cursor: '0', keys: [] }
}

export async function scanRedisKeys(
  db: DatabaseLike,
  id: string,
  input: { pattern?: string; cursor?: string; limit?: number } = {}
): Promise<DataSourceRedisScanResult> {
  const connection = requireConnection(db, id)
  const pattern = trimText(input.pattern) || '*'
  const limit = normalizeLimit(input.limit, DEFAULT_REDIS_LIMIT, MAX_REDIS_LIMIT)
  const cursor = trimText(input.cursor) || '0'

  return withRedisClient(connection, async (client) => {
    const result = normalizeRedisScan(await client.scan(cursor, { MATCH: pattern, COUNT: limit }))

    return {
      keys: result.keys.slice(0, limit),
      nextCursor: result.cursor,
      scannedCount: result.keys.length
    }
  })
}

export async function previewRedisValue(
  db: DatabaseLike,
  id: string,
  input: { key: string; limit?: number }
): Promise<DataSourceRedisValuePreview> {
  const connection = requireConnection(db, id)
  const key = trimText(input.key)
  const limit = normalizeLimit(input.limit, DEFAULT_REDIS_LIMIT, MAX_REDIS_LIMIT)

  if (!key) {
    throw new Error('请选择 Redis key')
  }

  return withRedisClient(connection, async (client) => {
    const type = String(await client.type(key))
    const ttlSeconds = Number(await client.ttl(key))
    const size = Number(await client.exists(key))
    let value: unknown = ''
    let rows: Array<Record<string, unknown>> = []

    if (type === 'string') {
      value = await client.get(key)
    } else if (type === 'hash') {
      const object = (await client.hGetAll(key)) as Record<string, unknown>
      rows = Object.entries(object)
        .slice(0, limit)
        .map(([field, fieldValue]) => ({ field, value: fieldValue }))
      value = `${Object.keys(object).length} fields`
    } else if (type === 'list') {
      rows = (await client.lRange(key, 0, limit - 1)).map((item: unknown, index: number) => ({ index, value: item }))
      value = `${rows.length} items`
    } else if (type === 'set') {
      rows = (await client.sMembers(key)).slice(0, limit).map((item: unknown) => ({ value: item }))
      value = `${rows.length} members`
    } else if (type === 'zset') {
      const items = await client.zRangeWithScores(key, 0, limit - 1)
      rows = items.map((item: { value: unknown; score: unknown }) => ({ value: item.value, score: item.score }))
      value = `${rows.length} members`
    } else if (type === 'stream') {
      const items = await client.xRange(key, '-', '+', { COUNT: limit })
      rows = items.map((item: { id?: string; message?: Record<string, unknown> }) => ({ id: item.id, ...(item.message ?? {}) }))
      value = `${rows.length} entries`
    } else {
      value = type === 'none' ? 'key 不存在' : `暂不支持预览 ${type}`
    }

    return { key, type, ttlSeconds, size, value, rows }
  })
}

async function importS3Sdk(): Promise<any> {
  return import('@aws-sdk/client-s3')
}

async function createS3Client(connection: DataSourceConnectionSecretRecord): Promise<any> {
  if (connection.kind !== 's3') {
    throw new Error('请选择 AWS S3 数据源')
  }

  const { S3Client } = await importS3Sdk()
  const credentials =
    connection.config.accessKeyId && connection.secret.secretAccessKey
      ? {
          accessKeyId: connection.config.accessKeyId,
          secretAccessKey: connection.secret.secretAccessKey,
          sessionToken: connection.secret.sessionToken || undefined
        }
      : undefined

  return new S3Client({
    region: connection.config.region,
    endpoint: connection.config.endpoint || undefined,
    forcePathStyle: connection.config.forcePathStyle || undefined,
    credentials,
    requestHandler: undefined
  })
}

async function createS3ListCommand(bucket: string, prefix: string, maxKeys: number, continuationToken = ''): Promise<any> {
  const { ListObjectsV2Command } = await importS3Sdk()

  return new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix || undefined,
    MaxKeys: maxKeys,
    ContinuationToken: continuationToken || undefined
  })
}

async function createS3GetCommand(bucket: string, key: string): Promise<any> {
  const { GetObjectCommand } = await importS3Sdk()

  return new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: `bytes=0-${S3_PREVIEW_BYTES - 1}`
  })
}

async function createS3HeadCommand(bucket: string, key: string): Promise<any> {
  const { HeadObjectCommand } = await importS3Sdk()

  return new HeadObjectCommand({
    Bucket: bucket,
    Key: key
  })
}

function requireS3Connection(db: DatabaseLike, id: string): DataSourceConnectionSecretRecord {
  const connection = requireConnection(db, id)

  if (connection.kind !== 's3') {
    throw new Error('请选择 AWS S3 数据源')
  }

  return connection
}

function isTextLikeObject(key: string, contentType: string): boolean {
  const normalizedType = contentType.toLowerCase()

  return (
    normalizedType.startsWith('text/') ||
    normalizedType.includes('json') ||
    normalizedType.includes('xml') ||
    normalizedType.includes('csv') ||
    /\.(txt|json|csv|xml|yaml|yml|log|md|sql)$/i.test(key)
  )
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0)
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === 'function') {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray())
  }

  const chunks: Buffer[] = []

  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export async function listS3Objects(
  db: DatabaseLike,
  id: string,
  input: { prefix?: string; continuationToken?: string; limit?: number } = {}
): Promise<DataSourceS3ListResult> {
  const connection = requireS3Connection(db, id)
  const bucket = connection.config.bucket ?? ''
  const prefix = trimText(input.prefix)
  const limit = normalizeLimit(input.limit, DEFAULT_S3_LIMIT, MAX_S3_LIMIT)
  const client = await createS3Client(connection)
  const result = await client.send(await createS3ListCommand(bucket, prefix, limit, trimText(input.continuationToken)))

  return {
    bucket,
    prefix,
    objects: (Array.isArray(result.Contents) ? result.Contents : []).map((object: Record<string, unknown>) => ({
      key: String(object.Key ?? ''),
      size: Number(object.Size ?? 0),
      lastModified: object.LastModified instanceof Date ? object.LastModified.toISOString() : String(object.LastModified ?? ''),
      etag: String(object.ETag ?? '').replace(/^"|"$/g, ''),
      storageClass: String(object.StorageClass ?? '')
    })),
    nextContinuationToken: String(result.NextContinuationToken ?? ''),
    truncated: Boolean(result.IsTruncated)
  }
}

export async function previewS3Object(
  db: DatabaseLike,
  id: string,
  input: { key: string }
): Promise<DataSourceS3ObjectPreview> {
  const connection = requireS3Connection(db, id)
  const bucket = connection.config.bucket ?? ''
  const key = trimText(input.key)

  if (!key) {
    throw new Error('请选择 S3 对象')
  }

  const client = await createS3Client(connection)
  const head = await client.send(await createS3HeadCommand(bucket, key))
  const contentType = String(head.ContentType ?? '')
  const size = Number(head.ContentLength ?? 0)
  const isText = isTextLikeObject(key, contentType)
  let content = ''
  let bytesRead = 0

  if (isText) {
    const object = await client.send(await createS3GetCommand(bucket, key))
    const buffer = await bodyToBuffer(object.Body)

    bytesRead = buffer.length
    content = buffer.toString('utf8')
  }

  return {
    bucket,
    key,
    size,
    lastModified: head.LastModified instanceof Date ? head.LastModified.toISOString() : String(head.LastModified ?? ''),
    etag: String(head.ETag ?? '').replace(/^"|"$/g, ''),
    contentType,
    isText,
    content,
    bytesRead,
    truncated: size > S3_PREVIEW_BYTES
  }
}
