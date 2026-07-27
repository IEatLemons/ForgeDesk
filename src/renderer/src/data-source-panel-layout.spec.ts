import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  formatDataSourceSize,
  formatDataSourceValue,
  getDataSourceColumnWidth,
  getDataSourceKindLabel,
  isDatabaseDataSource,
  parseDataSourceConnectionUrl,
  resolveDataSourceDisplayName
} from './data-source-view.js'

describe('data source panel helpers', () => {
  it('labels supported data source kinds', () => {
    assert.equal(getDataSourceKindLabel('mysql'), 'MySQL')
    assert.equal(getDataSourceKindLabel('postgresql'), 'PostgreSQL')
    assert.equal(getDataSourceKindLabel('redis'), 'Redis')
    assert.equal(getDataSourceKindLabel('s3'), 'AWS S3')
    assert.equal(isDatabaseDataSource('mysql'), true)
    assert.equal(isDatabaseDataSource('redis'), false)
  })

  it('formats object sizes with stable units', () => {
    assert.equal(formatDataSourceSize(0), '0 B')
    assert.equal(formatDataSourceSize(512), '512 B')
    assert.equal(formatDataSourceSize(2048), '2.0 KB')
    assert.equal(formatDataSourceSize(3 * 1024 * 1024), '3.0 MB')
  })

  it('formats complete cell values and preserves manually chosen display names', () => {
    assert.equal(formatDataSourceValue(null), 'NULL')
    assert.equal(formatDataSourceValue({ id: 1 }, true), '{\n  "id": 1\n}')
    assert.equal(resolveDataSourceDisplayName('  Production orders  ', 'MySQL app'), 'Production orders')
    assert.equal(resolveDataSourceDisplayName('', 'MySQL app'), 'MySQL app')
    assert.ok(getDataSourceColumnWidth('description', [{ description: 'a long description' }]) >= 120)
  })

  it('parses database connection URLs into form values', () => {
    const mysql = parseDataSourceConnectionUrl('mysql://root:p%40ss@db.example.com:3307/app?ssl=true')

    assert.equal(mysql.kind, 'mysql')
    assert.equal(mysql.host, 'db.example.com')
    assert.equal(mysql.port, 3307)
    assert.equal(mysql.database, 'app')
    assert.equal(mysql.username, 'root')
    assert.equal(mysql.password, 'p@ss')
    assert.equal(mysql.ssl, true)

    const postgres = parseDataSourceConnectionUrl('jdbc:postgresql://pg.example.com:5433/main?user=forge&password=secret&sslmode=require')

    assert.equal(postgres.kind, 'postgresql')
    assert.equal(postgres.host, 'pg.example.com')
    assert.equal(postgres.port, 5433)
    assert.equal(postgres.database, 'main')
    assert.equal(postgres.username, 'forge')
    assert.equal(postgres.password, 'secret')
    assert.equal(postgres.ssl, true)
  })

  it('parses Redis and S3 URLs without keeping Redis credentials in the URL field', () => {
    const redis = parseDataSourceConnectionUrl('rediss://default:s3cret@redis.example.com:6380/2')

    assert.equal(redis.kind, 'redis')
    assert.equal(redis.url, 'rediss://redis.example.com:6380/2')
    assert.equal(redis.host, 'redis.example.com')
    assert.equal(redis.port, 6380)
    assert.equal(redis.username, 'default')
    assert.equal(redis.password, 's3cret')
    assert.equal(redis.redisDatabase, '2')
    assert.equal(redis.tls, true)

    const redisWithQueryPassword = parseDataSourceConnectionUrl('redis://redis.example.com:6379/0?username=cache&password=query-secret&tls=true')

    assert.equal(redisWithQueryPassword.url, 'redis://redis.example.com:6379/0?tls=true')
    assert.equal(redisWithQueryPassword.username, 'cache')
    assert.equal(redisWithQueryPassword.password, 'query-secret')
    assert.equal(redisWithQueryPassword.tls, true)

    const s3 = parseDataSourceConnectionUrl('s3://AKIA123:secret@assets?region=ap-southeast-1&endpoint=https%3A%2F%2Fs3.example.com&forcePathStyle=true')

    assert.equal(s3.kind, 's3')
    assert.equal(s3.bucket, 'assets')
    assert.equal(s3.region, 'ap-southeast-1')
    assert.equal(s3.endpoint, 'https://s3.example.com')
    assert.equal(s3.forcePathStyle, true)
    assert.equal(s3.accessKeyId, 'AKIA123')
    assert.equal(s3.secretAccessKey, 'secret')
  })
})

describe('data source panel layout', () => {
  it('uses a full-screen data workspace with drawers and a resizable data grid', async () => {
    const [source, styles] = await Promise.all([
      readFile(join(process.cwd(), 'src/renderer/src/data-source-panel.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')
    ])

    assert.match(source, /tableLayout="fixed"/)
    assert.match(source, /label="显示名称"/)
    assert.match(source, /显示名称保持不变/)
    assert.match(source, /data-source-table-picker/)
    assert.match(source, /data-source-table-option/)
    assert.match(source, /data-source-grid-table/)
    assert.match(source, /__rowNumber/)
    assert.match(source, /selectedRowKey/)
    assert.match(source, /data-source-column-resize-handle/)
    assert.match(source, /data-source-cell-text/)
    assert.match(source, /window\.forgeDesk\.runDataSourceSql/)
    assert.match(source, /window\.forgeDesk\.previewRedisValue/)
    assert.match(source, /window\.forgeDesk\.previewS3Object/)
    assert.match(styles, /\.data-source-panel\s*\{[^}]*max-width: none/s)
    assert.match(styles, /\.data-source-grid-table \.ant-table-thead/s)
    assert.match(styles, /\.data-source-browser-tabs \.ant-tabs-tabpane-active\s*\{[^}]*display: flex/s)
    assert.match(styles, /\.data-source-browser-tabs \.ant-tabs-tabpane-hidden\s*\{[^}]*display: none/s)
    assert.match(styles, /\.data-source-cell-text\s*\{[^}]*text-overflow: ellipsis/s)
    assert.match(styles, /\.data-source-column-resize-handle\s*\{[^}]*cursor: col-resize/s)
    assert.match(styles, /\.data-source-row-number\s*\{[^}]*font-variant-numeric: tabular-nums/s)
    assert.match(styles, /\.data-source-table-picker-list\s*\{[^}]*flex-wrap: wrap/s)
    assert.match(styles, /\.data-source-table-option\.is-active\s*\{[^}]*var\(--primary-border-soft\)/s)
    assert.match(styles, /\.data-source-value-block\s*\{[^}]*overflow-wrap: anywhere/s)
    assert.doesNotMatch(source, /Drawer title="表目录"/)
    assert.doesNotMatch(styles, /grid-template-columns: minmax\(280px, 360px\)/)
  })
})
