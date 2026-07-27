import type { DataSourceConnection, DataSourceKind } from './data'

export const DATA_SOURCE_KIND_OPTIONS: Array<{ label: string; value: DataSourceKind }> = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'Redis', value: 'redis' },
  { label: 'AWS S3', value: 's3' }
]

export function getDataSourceKindLabel(kind: DataSourceKind): string {
  return DATA_SOURCE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind
}

export function isDatabaseDataSource(kind: DataSourceKind): boolean {
  return kind === 'mysql' || kind === 'postgresql'
}

export type ParsedDataSourceConnectionUrl = {
  kind: DataSourceKind
  name?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  ssl?: boolean
  url?: string
  tls?: boolean
  redisDatabase?: string
  region?: string
  bucket?: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

export function formatDataSourceSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function formatDataSourceValue(value: unknown, pretty = false): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, pretty ? 2 : 0)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

export function getDataSourceColumnWidth(column: string, rows: Array<Record<string, unknown>>): number {
  const sampledValues = rows.slice(0, 40).map((row) => formatDataSourceValue(row[column]))
  const longestValue = Math.max(column.length, ...sampledValues.map((value) => value.length))

  return Math.min(420, Math.max(120, Math.min(longestValue, 48) * 8 + 36))
}

export function resolveDataSourceDisplayName(currentName: string, parsedName?: string): string {
  return currentName.trim() || parsedName?.trim() || ''
}

function decodeUrlPart(value: string): string {
  if (!value) {
    return ''
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getCaseInsensitiveParam(params: URLSearchParams, names: string[]): string {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()))

  for (const [key, value] of params.entries()) {
    if (normalizedNames.has(key.toLowerCase()) && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function parseBooleanParam(params: URLSearchParams, names: string[]): boolean | undefined {
  const value = getCaseInsensitiveParam(params, names).toLowerCase()

  if (!value) {
    return undefined
  }

  if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(value)) {
    return false
  }

  return true
}

function parseUrlDatabaseName(pathname: string): string {
  const rawPath = pathname.replace(/^\/+/, '')

  if (!rawPath) {
    return ''
  }

  return decodeUrlPart(rawPath.split('/')[0] ?? '')
}

function parseUrlPort(url: URL, fallback: number): number {
  const port = Number(url.port)

  return Number.isFinite(port) && port > 0 ? port : fallback
}

function getUrlKind(protocol: string): DataSourceKind | null {
  const normalizedProtocol = protocol.replace(/:$/, '').toLowerCase()
  const baseProtocol = normalizedProtocol.split('+')[0]

  if (baseProtocol === 'mysql' || normalizedProtocol === 'mysql2') {
    return 'mysql'
  }

  if (baseProtocol === 'postgres' || baseProtocol === 'postgresql') {
    return 'postgresql'
  }

  if (baseProtocol === 'redis' || baseProtocol === 'rediss') {
    return 'redis'
  }

  if (baseProtocol === 's3') {
    return 's3'
  }

  return null
}

function createParsedUrlName(kind: DataSourceKind, values: Pick<ParsedDataSourceConnectionUrl, 'host' | 'database' | 'bucket'>): string {
  const label = getDataSourceKindLabel(kind)

  if (kind === 's3') {
    return values.bucket ? `${label} ${values.bucket}` : label
  }

  if (kind === 'redis') {
    return values.host ? `${label} ${values.host}` : label
  }

  return values.database ? `${label} ${values.database}` : values.host ? `${label} ${values.host}` : label
}

function stripUrlCredentials(url: URL, sensitiveParamNames: string[] = []): string {
  const sanitizedUrl = new URL(url.toString())
  const normalizedSensitiveParams = new Set(sensitiveParamNames.map((name) => name.toLowerCase()))

  sanitizedUrl.username = ''
  sanitizedUrl.password = ''
  for (const key of Array.from(sanitizedUrl.searchParams.keys())) {
    if (normalizedSensitiveParams.has(key.toLowerCase())) {
      sanitizedUrl.searchParams.delete(key)
    }
  }

  return sanitizedUrl.toString()
}

function parseDatabaseConnectionUrl(url: URL, kind: 'mysql' | 'postgresql'): ParsedDataSourceConnectionUrl {
  const params = url.searchParams
  const database = parseUrlDatabaseName(url.pathname)
  const username = decodeUrlPart(url.username) || getCaseInsensitiveParam(params, ['user', 'username'])
  const password = decodeUrlPart(url.password) || getCaseInsensitiveParam(params, ['password', 'pass'])
  const ssl =
    parseBooleanParam(params, ['ssl', 'sslmode', 'ssl-mode', 'useSSL', 'requireSSL']) ??
    (kind === 'postgresql' && ['require', 'verify-ca', 'verify-full', 'prefer'].includes(getCaseInsensitiveParam(params, ['sslmode']).toLowerCase()))
  const values: ParsedDataSourceConnectionUrl = {
    kind,
    host: url.hostname,
    port: parseUrlPort(url, kind === 'mysql' ? 3306 : 5432),
    database,
    username,
    password,
    ssl: Boolean(ssl)
  }

  return {
    ...values,
    name: createParsedUrlName(kind, values)
  }
}

function parseRedisConnectionUrl(url: URL): ParsedDataSourceConnectionUrl {
  const params = url.searchParams
  const redisDatabase = parseUrlDatabaseName(url.pathname) || getCaseInsensitiveParam(params, ['db', 'database'])
  const tls = url.protocol.replace(/:$/, '').toLowerCase() === 'rediss' || Boolean(parseBooleanParam(params, ['tls', 'ssl']))
  const values: ParsedDataSourceConnectionUrl = {
    kind: 'redis',
    url: stripUrlCredentials(url, ['user', 'username', 'password', 'pass']),
    host: url.hostname,
    port: parseUrlPort(url, 6379),
    username: decodeUrlPart(url.username) || getCaseInsensitiveParam(params, ['user', 'username']),
    password: decodeUrlPart(url.password) || getCaseInsensitiveParam(params, ['password', 'pass']),
    redisDatabase,
    tls
  }

  return {
    ...values,
    name: createParsedUrlName('redis', values)
  }
}

function parseS3ConnectionUrl(url: URL): ParsedDataSourceConnectionUrl {
  const params = url.searchParams
  const bucket = decodeUrlPart(url.hostname || parseUrlDatabaseName(url.pathname))
  const values: ParsedDataSourceConnectionUrl = {
    kind: 's3',
    bucket,
    region: getCaseInsensitiveParam(params, ['region', 'awsRegion', 'aws_region']),
    endpoint: getCaseInsensitiveParam(params, ['endpoint', 'endpointUrl', 'endpoint_url']),
    forcePathStyle: Boolean(parseBooleanParam(params, ['forcePathStyle', 'force_path_style', 'pathStyle', 'path_style'])),
    accessKeyId: decodeUrlPart(url.username) || getCaseInsensitiveParam(params, ['accessKeyId', 'access_key_id', 'awsAccessKeyId', 'aws_access_key_id']),
    secretAccessKey: decodeUrlPart(url.password) || getCaseInsensitiveParam(params, ['secretAccessKey', 'secret_access_key', 'awsSecretAccessKey', 'aws_secret_access_key']),
    sessionToken: getCaseInsensitiveParam(params, ['sessionToken', 'session_token', 'awsSessionToken', 'aws_session_token'])
  }

  return {
    ...values,
    name: createParsedUrlName('s3', values)
  }
}

export function parseDataSourceConnectionUrl(rawValue: string): ParsedDataSourceConnectionUrl {
  const value = rawValue.trim()

  if (!value) {
    throw new Error('请粘贴完整连接 URL')
  }

  let url: URL

  try {
    url = new URL(value.replace(/^jdbc:/i, ''))
  } catch {
    throw new Error('无法解析连接 URL')
  }

  const kind = getUrlKind(url.protocol)

  if (!kind) {
    throw new Error('暂不支持这个连接 URL 类型')
  }

  if (kind === 'mysql' || kind === 'postgresql') {
    return parseDatabaseConnectionUrl(url, kind)
  }

  if (kind === 'redis') {
    return parseRedisConnectionUrl(url)
  }

  return parseS3ConnectionUrl(url)
}

export function createDataSourceConnectionFormValues(connection?: DataSourceConnection | null): {
  connectionUrl?: string
  kind: DataSourceKind
  name: string
  host?: string
  port?: number
  database?: string
  username?: string
  ssl?: boolean
  url?: string
  tls?: boolean
  redisDatabase?: string
  region?: string
  bucket?: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
} {
  if (!connection) {
    return {
      connectionUrl: '',
      kind: 'mysql',
      name: '',
      host: '127.0.0.1',
      port: 3306,
      database: '',
      username: '',
      ssl: false
    }
  }

  return {
    connectionUrl: '',
    kind: connection.kind,
    name: connection.name,
    host: connection.config.host,
    port: connection.config.port,
    database: isDatabaseDataSource(connection.kind) ? connection.config.database : undefined,
    username: connection.config.username,
    ssl: Boolean(connection.config.ssl),
    url: connection.config.url,
    tls: Boolean(connection.config.tls),
    redisDatabase: connection.kind === 'redis' ? connection.config.database : undefined,
    region: connection.config.region,
    bucket: connection.config.bucket,
    endpoint: connection.config.endpoint,
    forcePathStyle: Boolean(connection.config.forcePathStyle),
    accessKeyId: connection.config.accessKeyId
  }
}
