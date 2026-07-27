import {
  Alert,
  Button,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CloudOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { useEffect, useMemo, useState, type HTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react'
import { getErrorMessage } from './error-messages'
import {
  DATA_SOURCE_KIND_OPTIONS,
  createDataSourceConnectionFormValues,
  formatDataSourceSize,
  formatDataSourceValue,
  getDataSourceColumnWidth,
  getDataSourceKindLabel,
  isDatabaseDataSource,
  parseDataSourceConnectionUrl,
  resolveDataSourceDisplayName
} from './data-source-view'
import type {
  DataSourceConnection,
  DataSourceConnectionInput,
  DataSourceDatabaseTable,
  DataSourceKind,
  DataSourceRedisValuePreview,
  DataSourceS3ListResult,
  DataSourceS3Object,
  DataSourceS3ObjectPreview,
  DataSourceTabularResult
} from './data'

type DataSourceConnectionFormValues = {
  connectionUrl?: string
  kind: DataSourceKind
  name: string
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

type DataSourceTableRow = Record<string, unknown> & {
  __rowKey: string
}

type DatabaseTableListRow = DataSourceDatabaseTable & {
  __displayName: string
  __tableKey: string
}

type DataSourceCellSelection = {
  column: string
  value: unknown
  rowIndex: number
}

type DataSourceCellClickPayload = DataSourceCellSelection & {
  row: DataSourceTableRow
}

type ResizableHeaderCellProps = HTMLAttributes<HTMLTableCellElement> & {
  width?: number
  onResize?: (width: number) => void
}

function createDataSourceConnectionInput(values: DataSourceConnectionFormValues, id?: string): DataSourceConnectionInput {
  if (values.kind === 'mysql' || values.kind === 'postgresql') {
    return {
      id,
      kind: values.kind,
      name: values.name,
      config: {
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
        ssl: values.ssl
      },
      secret: {
        password: values.password
      }
    }
  }

  if (values.kind === 'redis') {
    return {
      id,
      kind: values.kind,
      name: values.name,
      config: {
        url: values.url,
        host: values.host,
        port: values.port,
        username: values.username,
        database: values.redisDatabase,
        tls: values.tls
      },
      secret: {
        password: values.password
      }
    }
  }

  return {
    id,
    kind: values.kind,
    name: values.name,
    config: {
      region: values.region,
      bucket: values.bucket,
      endpoint: values.endpoint,
      forcePathStyle: values.forcePathStyle,
      accessKeyId: values.accessKeyId
    },
    secret: {
      secretAccessKey: values.secretAccessKey,
      sessionToken: values.sessionToken
    }
  }
}

function createTableKey(table: DataSourceDatabaseTable): string {
  return JSON.stringify([table.schema, table.name])
}

function parseTableKey(value: string): { schema: string; table: string } {
  try {
    const parsed = JSON.parse(value) as unknown

    if (Array.isArray(parsed)) {
      return { schema: String(parsed[0] ?? ''), table: String(parsed[1] ?? '') }
    }
  } catch {
    // Fall through to the compact fallback for older local state.
  }

  const [schema, ...rest] = value.split('.')
  return { schema, table: rest.join('.') || value }
}

function formatDatabaseTableName(table: Pick<DataSourceDatabaseTable, 'schema' | 'name'>): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name
}

function formatDatabaseTableType(type: string): string {
  const normalizedType = type.trim().toLowerCase()

  if (normalizedType.includes('view')) {
    return '视图'
  }

  if (!normalizedType || normalizedType.includes('table')) {
    return '表'
  }

  return type
}

function createResultRows(result: DataSourceTabularResult | null): DataSourceTableRow[] {
  return (result?.rows ?? []).map((row, index) => ({ ...row, __rowKey: String(index) }))
}

function ResizableHeaderCell({ width, onResize, style, children, ...rest }: ResizableHeaderCellProps): JSX.Element {
  function startResize(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (!onResize) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = width ?? 160

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      onResize(Math.max(96, startWidth + moveEvent.clientX - startX))
    }
    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <th {...rest} style={{ ...style, width }}>
      <span className="data-source-column-header">{children}</span>
      {onResize ? (
        <button type="button" className="data-source-column-resize-handle" aria-label="调整列宽" onMouseDown={startResize} />
      ) : null}
    </th>
  )
}

function DataSourceGrid({
  result,
  emptyText,
  className = '',
  showMeta = true,
  onCellClick,
  selectedRowKey
}: {
  result: DataSourceTabularResult | null
  emptyText: string
  className?: string
  showMeta?: boolean
  onCellClick?: (payload: DataSourceCellClickPayload) => void
  selectedRowKey?: string
}): JSX.Element {
  const rows = useMemo(() => createResultRows(result), [result])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [selectedCell, setSelectedCell] = useState<DataSourceCellSelection | null>(null)

  useEffect(() => {
    if (!result) {
      setColumnWidths({})
      return
    }

    setColumnWidths((current) =>
      Object.fromEntries(result.columns.map((column) => [column, current[column] ?? getDataSourceColumnWidth(column, result.rows)]))
    )
  }, [result])

  const columns = useMemo<ColumnsType<DataSourceTableRow>>(
    () => [
      {
        title: '#',
        key: '__rowNumber',
        width: 52,
        fixed: 'left' as const,
        render: (_value: unknown, _row: DataSourceTableRow, rowIndex: number) => <span className="data-source-row-number">{rowIndex + 1}</span>
      },
      ...(result?.columns ?? []).map((column) => {
        const width = columnWidths[column] ?? getDataSourceColumnWidth(column, result?.rows ?? [])

        return {
          title: column,
          dataIndex: column,
          key: column,
          width,
          ellipsis: true,
          onHeaderCell: () => ({
            width,
            onResize: (nextWidth: number) => setColumnWidths((current) => ({ ...current, [column]: nextWidth }))
          }),
          render: (value: unknown, row: DataSourceTableRow, rowIndex: number) => {
            const text = formatDataSourceValue(value)

            return (
              <button
                type="button"
                className={value === null || value === undefined ? 'data-source-cell-button is-null' : 'data-source-cell-button'}
                title="点击查看完整值"
                onClick={() => {
                  const payload = { column, value, row, rowIndex }

                  if (onCellClick) {
                    onCellClick(payload)
                  } else {
                    setSelectedCell(payload)
                  }
                }}
              >
                <span className="data-source-cell-text">{text}</span>
              </button>
            )
          }
        }
      })
    ],
    [columnWidths, onCellClick, result]
  )
  const totalWidth = 52 + columns.reduce((total, column) => total + Number(column.width ?? 160), 0)

  if (!result) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
  }

  return (
    <div className={`data-source-grid-shell ${className}`.trim()}>
      {showMeta ? (
        <div className="data-source-grid-meta">
          <Space size={6} wrap>
            <Tag color="blue">返回 {result.rowCount} 行</Tag>
            <Tag>耗时 {result.durationMs}ms</Tag>
            {result.truncated ? <Tag color="gold">已按上限截断</Tag> : null}
          </Space>
          <Typography.Text type="secondary">点击单元格查看完整值 · 拖动表头边缘调整列宽</Typography.Text>
        </div>
      ) : null}
      <Table<DataSourceTableRow>
        className="data-source-grid-table"
        size="middle"
        tableLayout="fixed"
        rowKey="__rowKey"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: Math.max(720, totalWidth), y: 'calc(100dvh - 360px)' }}
        components={{ header: { cell: ResizableHeaderCell } }}
        rowClassName={(row) => (selectedRowKey && String(row.Key ?? '') === selectedRowKey ? 'data-source-grid-row-selected' : '')}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有返回数据" /> }}
      />
      <Modal
        title="单元格详情"
        open={Boolean(selectedCell)}
        width={720}
        footer={null}
        onCancel={() => setSelectedCell(null)}
      >
        {selectedCell ? (
          <Space direction="vertical" size={12} className="data-source-value-detail">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="列">{selectedCell.column}</Descriptions.Item>
              <Descriptions.Item label="行">第 {selectedCell.rowIndex + 1} 行</Descriptions.Item>
            </Descriptions>
            <pre className="data-source-value-block">{formatDataSourceValue(selectedCell.value, true)}</pre>
          </Space>
        ) : null}
      </Modal>
    </div>
  )
}

function DataSourceKindIcon({ kind }: { kind: DataSourceKind }): JSX.Element {
  if (kind === 's3') {
    return <CloudOutlined />
  }

  if (kind === 'redis') {
    return <ThunderboltOutlined />
  }

  return <DatabaseOutlined />
}

function getDefaultDataSourcePort(kind: DataSourceKind): number | undefined {
  return kind === 'mysql' ? 3306 : kind === 'postgresql' ? 5432 : kind === 'redis' ? 6379 : undefined
}

function getDataSourceUrlPlaceholder(kind: DataSourceKind): string {
  if (kind === 'postgresql') {
    return 'postgresql://postgres:password@127.0.0.1:5432/postgres'
  }

  if (kind === 'redis') {
    return 'redis://:password@127.0.0.1:6379/0'
  }

  if (kind === 's3') {
    return 's3://bucket?region=us-east-1'
  }

  return 'mysql://root:password@127.0.0.1:3306/app'
}

function DatabaseTablePicker({
  tables,
  selectedTableKey,
  search,
  loading,
  onSearchChange,
  onRefresh,
  onSelect
}: {
  tables: DataSourceDatabaseTable[]
  selectedTableKey: string
  search: string
  loading: boolean
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onSelect: (table: DataSourceDatabaseTable) => void
}): JSX.Element {
  const rows = useMemo<DatabaseTableListRow[]>(
    () =>
      tables
        .map((table) => ({ ...table, __displayName: formatDatabaseTableName(table), __tableKey: createTableKey(table) }))
        .filter((table) => {
          const keyword = search.trim().toLowerCase()

          return !keyword || [table.__displayName, table.schema, table.name, table.type].some((value) => String(value).toLowerCase().includes(keyword))
        }),
    [search, tables]
  )

  return (
    <div className="data-source-table-picker">
      <div className="data-source-table-picker-header">
        <Space direction="vertical" size={2}>
          <Typography.Text strong>表列表</Typography.Text>
          <Typography.Text type="secondary">
            {loading ? '正在读取数据表...' : `共 ${tables.length} 张表`}
            {search.trim() && !loading ? `，匹配 ${rows.length} 张` : ''}
          </Typography.Text>
        </Space>
        <Space wrap>
          <Input
            className="data-source-table-picker-search"
            allowClear
            prefix={<SearchOutlined />}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索表名、schema 或类型"
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            刷新
          </Button>
        </Space>
      </div>
      <div className="data-source-table-picker-list" aria-label="数据表列表">
        {loading ? (
          <div className="data-source-table-picker-loading">
            <Spin size="small" />
          </div>
        ) : rows.length ? (
          rows.map((table) => (
            <button
              key={table.__tableKey}
              type="button"
              aria-pressed={table.__tableKey === selectedTableKey}
              className={`data-source-table-option${table.__tableKey === selectedTableKey ? ' is-active' : ''}`}
              title={table.__displayName}
              onClick={() => onSelect(table)}
            >
              <span className="data-source-table-option-copy">
                <span className="data-source-table-name">{table.name}</span>
                {table.schema ? <span className="data-source-table-schema">{table.schema}</span> : null}
              </span>
              <Tag>{formatDatabaseTableType(table.type)}</Tag>
            </button>
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有数据表" />
        )}
      </div>
    </div>
  )
}

function DatabaseDataSourceBrowser({ connection }: { connection: DataSourceConnection }): JSX.Element {
  const [tables, setTables] = useState<DataSourceDatabaseTable[]>([])
  const [selectedTableKey, setSelectedTableKey] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [preview, setPreview] = useState<DataSourceTabularResult | null>(null)
  const [sqlResult, setSqlResult] = useState<DataSourceTabularResult | null>(null)
  const [sql, setSql] = useState('SELECT * FROM ')
  const [limit, setLimit] = useState(100)
  const [offset, setOffset] = useState(0)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [runningSql, setRunningSql] = useState(false)

  async function loadTables(preferredKey = selectedTableKey): Promise<void> {
    setLoadingTables(true)

    try {
      const nextTables = await window.forgeDesk.listDatabaseTables(connection.id)
      const nextKey = nextTables.some((table) => createTableKey(table) === preferredKey) ? preferredKey : ''

      setTables(nextTables)
      setSelectedTableKey(nextKey)
      if (!nextKey) {
        setPreview(null)
      }
    } catch (error) {
      message.error(getErrorMessage(error, '读取数据表失败'))
    } finally {
      setLoadingTables(false)
    }
  }

  async function loadPreview(nextOffset = offset, tableKey = selectedTableKey): Promise<void> {
    if (!tableKey) {
      return
    }

    const table = parseTableKey(tableKey)

    setLoadingPreview(true)
    setOffset(nextOffset)

    try {
      setPreview(await window.forgeDesk.previewDatabaseTable(connection.id, { schema: table.schema, table: table.table, limit, offset: nextOffset }))
    } catch (error) {
      message.error(getErrorMessage(error, '读取表数据失败'))
    } finally {
      setLoadingPreview(false)
    }
  }

  function selectDatabaseTable(table: DataSourceDatabaseTable): void {
    const nextKey = createTableKey(table)

    setSelectedTableKey(nextKey)
    setOffset(0)
    if (nextKey === selectedTableKey) {
      void loadPreview(0, nextKey)
    }
  }

  async function runSql(): Promise<void> {
    setRunningSql(true)

    try {
      setSqlResult(await window.forgeDesk.runDataSourceSql(connection.id, { sql, limit }))
    } catch (error) {
      message.error(getErrorMessage(error, '执行 SQL 失败'))
    } finally {
      setRunningSql(false)
    }
  }

  useEffect(() => {
    setTables([])
    setPreview(null)
    setSqlResult(null)
    setSelectedTableKey('')
    setTableSearch('')
    setOffset(0)
    void loadTables('')
  }, [connection.id])

  useEffect(() => {
    if (!selectedTableKey) {
      setPreview(null)
      setOffset(0)
      return
    }

    setOffset(0)
    void loadPreview(0)
  }, [selectedTableKey, limit])

  const selectedTable = tables.find((table) => createTableKey(table) === selectedTableKey) ?? null

  return (
    <section className="data-source-browser data-source-browser-full-height">
      <Tabs
        className="data-source-browser-tabs"
        items={[
          {
            key: 'table',
            label: '数据表',
            children: (
              <div className="data-source-database-view">
                <DatabaseTablePicker
                  tables={tables}
                  selectedTableKey={selectedTableKey}
                  search={tableSearch}
                  loading={loadingTables}
                  onSearchChange={setTableSearch}
                  onRefresh={() => loadTables()}
                  onSelect={selectDatabaseTable}
                />
                <div className="data-source-view-toolbar">
                  <Space wrap>
                    {selectedTable ? <Tag color="blue">{formatDatabaseTableName(selectedTable)}</Tag> : <Typography.Text type="secondary">选择一张表开始查看</Typography.Text>}
                  </Space>
                  <Space wrap>
                    <Typography.Text type="secondary">每页</Typography.Text>
                    <InputNumber min={1} max={500} value={limit} onChange={(value) => setLimit(Number(value ?? 100))} />
                    <Button disabled={!selectedTableKey || loadingPreview} icon={<ReloadOutlined />} loading={loadingPreview} onClick={() => loadPreview(0)}>
                      刷新内容
                    </Button>
                    <Button disabled={!selectedTableKey || offset <= 0 || loadingPreview} onClick={() => loadPreview(Math.max(offset - limit, 0))}>
                      上一页
                    </Button>
                    <Button disabled={!selectedTableKey || !preview?.truncated || loadingPreview} onClick={() => loadPreview(offset + limit)}>
                      下一页
                    </Button>
                  </Space>
                </div>
                <Spin spinning={loadingPreview}>
                  <DataSourceGrid result={preview} emptyText="从上方表列表选择一张表查看数据" />
                </Spin>
              </div>
            )
          },
          {
            key: 'sql',
            label: 'SQL 查询',
            children: (
              <div className="data-source-sql-view">
                <Alert
                  type="info"
                  showIcon
                  message="只读 SQL"
                  description="允许 SELECT、WITH、SHOW、DESCRIBE、DESC、EXPLAIN；结果最多返回 500 行。"
                />
                <Input.TextArea className="data-source-sql-editor" value={sql} rows={7} onChange={(event) => setSql(event.target.value)} />
                <div className="data-source-view-toolbar">
                  <Space wrap>
                    <Typography.Text type="secondary">最多返回</Typography.Text>
                    <InputNumber min={1} max={500} value={limit} onChange={(value) => setLimit(Number(value ?? 100))} />
                    <Typography.Text type="secondary">行</Typography.Text>
                  </Space>
                  <Button type="primary" icon={<SearchOutlined />} loading={runningSql} onClick={runSql}>
                    执行查询
                  </Button>
                </div>
                <Spin spinning={runningSql}>
                  <DataSourceGrid result={sqlResult} emptyText="执行只读 SQL 后查看结果" />
                </Spin>
              </div>
            )
          }
        ]}
      />
    </section>
  )
}

function RedisDataSourceBrowser({ connection }: { connection: DataSourceConnection }): JSX.Element {
  const [pattern, setPattern] = useState('*')
  const [keys, setKeys] = useState<string[]>([])
  const [cursor, setCursor] = useState('0')
  const [selectedKey, setSelectedKey] = useState('')
  const [preview, setPreview] = useState<DataSourceRedisValuePreview | null>(null)
  const [valueDrawerOpen, setValueDrawerOpen] = useState(false)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [loadingValue, setLoadingValue] = useState(false)

  async function scanKeys(reset = true): Promise<void> {
    setLoadingKeys(true)

    try {
      const result = await window.forgeDesk.scanRedisKeys(connection.id, { pattern, cursor: reset ? '0' : cursor, limit: 100 })
      const nextKeys = reset ? result.keys : [...keys, ...result.keys]

      setKeys(Array.from(new Set(nextKeys)))
      setCursor(result.nextCursor)
    } catch (error) {
      message.error(getErrorMessage(error, '扫描 Redis key 失败'))
    } finally {
      setLoadingKeys(false)
    }
  }

  async function loadValue(key: string): Promise<void> {
    if (!key) {
      return
    }

    setSelectedKey(key)
    setValueDrawerOpen(true)
    setLoadingValue(true)

    try {
      setPreview(await window.forgeDesk.previewRedisValue(connection.id, { key, limit: 100 }))
    } catch (error) {
      message.error(getErrorMessage(error, '读取 Redis 值失败'))
    } finally {
      setLoadingValue(false)
    }
  }

  useEffect(() => {
    setKeys([])
    setCursor('0')
    setSelectedKey('')
    setPreview(null)
    setValueDrawerOpen(false)
    void scanKeys(true)
  }, [connection.id])

  const keyResult = useMemo<DataSourceTabularResult>(
    () => ({
      columns: ['Key'],
      rows: keys.map((key) => ({ Key: key })),
      rowCount: keys.length,
      truncated: cursor !== '0',
      durationMs: 0
    }),
    [cursor, keys]
  )
  const valueResult = useMemo<DataSourceTabularResult | null>(() => {
    if (!preview) {
      return null
    }

    return {
      columns: preview.rows.length ? Object.keys(preview.rows[0] ?? {}) : [],
      rows: preview.rows,
      rowCount: preview.rows.length,
      truncated: false,
      durationMs: 0
    }
  }, [preview])

  return (
    <section className="data-source-browser data-source-browser-full-height">
      <div className="data-source-view-toolbar data-source-redis-toolbar">
        <Space wrap>
          <Input className="data-source-search-input" value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="Key pattern，例如 user:*" />
          <Button type="primary" icon={<SearchOutlined />} loading={loadingKeys} onClick={() => scanKeys(true)}>
            扫描
          </Button>
          <Button disabled={cursor === '0' || loadingKeys} onClick={() => scanKeys(false)}>
            继续扫描
          </Button>
        </Space>
        <Typography.Text type="secondary">已加载 {keys.length} 个 Key</Typography.Text>
      </div>
      <DataSourceGrid
        result={keyResult}
        emptyText="输入 pattern 并扫描 Redis Key"
        selectedRowKey={selectedKey}
        onCellClick={({ row }) => loadValue(String(row.Key ?? ''))}
      />
      <Drawer
        title={selectedKey ? `Redis 值：${selectedKey}` : 'Redis 值'}
        placement="right"
        width={720}
        open={valueDrawerOpen}
        onClose={() => setValueDrawerOpen(false)}
      >
        <Spin spinning={loadingValue}>
          {preview ? (
            <Space direction="vertical" size={14} className="data-source-value-detail">
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="Key" span={2}>{selectedKey}</Descriptions.Item>
                <Descriptions.Item label="类型">{preview.type}</Descriptions.Item>
                <Descriptions.Item label="TTL">{preview.ttlSeconds}</Descriptions.Item>
                <Descriptions.Item label="大小">{preview.size}</Descriptions.Item>
                <Descriptions.Item label="概览">{formatDataSourceValue(preview.value)}</Descriptions.Item>
              </Descriptions>
              {valueResult?.columns.length ? (
                <DataSourceGrid result={valueResult} emptyText="没有结构化值" showMeta={false} />
              ) : (
                <pre className="data-source-value-block">{formatDataSourceValue(preview.value, true)}</pre>
              )}
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个 Key 查看值" />
          )}
        </Spin>
      </Drawer>
    </section>
  )
}

function S3DataSourceBrowser({ connection }: { connection: DataSourceConnection }): JSX.Element {
  const [prefix, setPrefix] = useState('')
  const [listResult, setListResult] = useState<DataSourceS3ListResult | null>(null)
  const [objects, setObjects] = useState<DataSourceS3Object[]>([])
  const [preview, setPreview] = useState<DataSourceS3ObjectPreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [loadingObjects, setLoadingObjects] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)

  async function loadObjects(reset = true): Promise<void> {
    setLoadingObjects(true)

    try {
      const result = await window.forgeDesk.listS3Objects(connection.id, {
        prefix,
        continuationToken: reset ? '' : listResult?.nextContinuationToken,
        limit: 100
      })

      setListResult(result)
      setObjects(reset ? result.objects : [...objects, ...result.objects])
    } catch (error) {
      message.error(getErrorMessage(error, '读取 S3 对象失败'))
    } finally {
      setLoadingObjects(false)
    }
  }

  async function loadPreview(key: string): Promise<void> {
    setPreviewOpen(true)
    setLoadingPreview(true)

    try {
      setPreview(await window.forgeDesk.previewS3Object(connection.id, { key }))
    } catch (error) {
      message.error(getErrorMessage(error, '预览 S3 对象失败'))
    } finally {
      setLoadingPreview(false)
    }
  }

  useEffect(() => {
    setObjects([])
    setListResult(null)
    setPreview(null)
    setPreviewOpen(false)
    void loadObjects(true)
  }, [connection.id])

  const objectResult = useMemo<DataSourceTabularResult>(
    () => ({
      columns: ['Object Key', '大小', '更新'],
      rows: objects.map((object) => ({ 'Object Key': object.key, 大小: formatDataSourceSize(object.size), 更新: object.lastModified, __objectKey: object.key })),
      rowCount: objects.length,
      truncated: Boolean(listResult?.truncated),
      durationMs: 0
    }),
    [listResult?.truncated, objects]
  )

  return (
    <section className="data-source-browser data-source-browser-full-height">
      <div className="data-source-view-toolbar">
        <Space wrap>
          <Input className="data-source-search-input" value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="Prefix，例如 logs/2026/" />
          <Button type="primary" icon={<SearchOutlined />} loading={loadingObjects} onClick={() => loadObjects(true)}>
            浏览
          </Button>
          <Button disabled={!listResult?.truncated || loadingObjects} onClick={() => loadObjects(false)}>
            继续加载
          </Button>
        </Space>
        <Typography.Text type="secondary">{objects.length} 个对象</Typography.Text>
      </div>
      <DataSourceGrid result={objectResult} emptyText="输入 Prefix 并浏览对象" onCellClick={({ row }) => loadPreview(String(row.__objectKey ?? ''))} />
      <Drawer title={preview?.key || '对象预览'} placement="right" width={720} open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <Spin spinning={loadingPreview}>
          {preview ? (
            <Space direction="vertical" size={14} className="data-source-value-detail">
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="Key" span={2}>{preview.key}</Descriptions.Item>
                <Descriptions.Item label="大小">{formatDataSourceSize(preview.size)}</Descriptions.Item>
                <Descriptions.Item label="类型">{preview.contentType || '-'}</Descriptions.Item>
                <Descriptions.Item label="ETag" span={2}>{preview.etag || '-'}</Descriptions.Item>
              </Descriptions>
              {preview.isText ? <pre className="data-source-value-block">{preview.content}</pre> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="二进制对象只显示元数据" />}
              {preview.truncated && preview.isText ? <Tag color="gold">只展示前 256KB</Tag> : null}
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个对象查看预览" />
          )}
        </Spin>
      </Drawer>
    </section>
  )
}

function ConnectionFormFields({ kind, editing }: { kind: DataSourceKind; editing: DataSourceConnection | null }): JSX.Element {
  if (kind === 's3') {
    return (
      <>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item name="region" label="Region" rules={[{ required: true, message: '请输入 Region' }]}>
              <Input placeholder="us-east-1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="bucket" label="Bucket" rules={[{ required: true, message: '请输入 Bucket' }]}>
              <Input placeholder="my-bucket" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="endpoint" label="Endpoint">
          <Input placeholder="兼容 S3 服务可填写，例如 https://s3.example.com" />
        </Form.Item>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item name="accessKeyId" label="Access Key ID" rules={[{ required: true, message: '请输入 Access Key ID' }]}>
              <Input placeholder="AKIA..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="secretAccessKey" label="Secret Access Key">
              <Input.Password placeholder={editing?.secretConfigured ? '已保存，留空不变' : 'AWS Secret Access Key'} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="sessionToken" label="Session Token">
          <Input.Password placeholder="临时凭证可填写，留空不使用" />
        </Form.Item>
        <Form.Item name="forcePathStyle" valuePropName="checked">
          <Checkbox>Path-style endpoint</Checkbox>
        </Form.Item>
      </>
    )
  }

  if (kind === 'redis') {
    return (
      <>
        <Form.Item name="url" label="Redis URL">
          <Input placeholder="redis://127.0.0.1:6379，可留空改用 host/port" />
        </Form.Item>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item name="host" label="Host">
              <Input placeholder="127.0.0.1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="port" label="Port">
              <InputNumber min={1} max={65535} className="data-source-full-input" placeholder="6379" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item name="username" label="Username">
              <Input placeholder="可留空" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="redisDatabase" label="Database">
              <Input placeholder="0" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="password" label="Password">
          <Input.Password placeholder={editing?.secretConfigured ? '已保存，留空不变' : 'Redis 密码，可留空'} />
        </Form.Item>
        <Form.Item name="tls" valuePropName="checked">
          <Checkbox>启用 TLS</Checkbox>
        </Form.Item>
      </>
    )
  }

  return (
    <>
      <Row gutter={[12, 0]}>
        <Col span={12}>
          <Form.Item name="host" label="Host" rules={[{ required: true, message: '请输入数据库主机' }]}>
            <Input placeholder="127.0.0.1" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="port" label="Port" rules={[{ required: true, message: '请输入端口' }]}>
            <InputNumber min={1} max={65535} className="data-source-full-input" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={[12, 0]}>
        <Col span={12}>
          <Form.Item name="database" label="Database" rules={[{ required: true, message: '请输入数据库名称' }]}>
            <Input placeholder={kind === 'mysql' ? 'app' : 'postgres'} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: '请输入数据库用户' }]}>
            <Input placeholder={kind === 'mysql' ? 'root' : 'postgres'} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="password" label="Password">
        <Input.Password placeholder={editing?.secretConfigured ? '已保存，留空不变' : '数据库密码，可留空'} />
      </Form.Item>
      <Form.Item name="ssl" valuePropName="checked">
        <Checkbox>启用 SSL/TLS</Checkbox>
      </Form.Item>
    </>
  )
}

function getDataSourceConnectionSummary(connection: DataSourceConnection): string {
  if (connection.kind === 's3') {
    return `${connection.config.region || '-'} / ${connection.config.bucket || '-'}`
  }

  if (connection.kind === 'redis') {
    return connection.config.url || `${connection.config.host || '-'}:${connection.config.port || '-'}`
  }

  return `${connection.config.host || '-'}:${connection.config.port || '-'} / ${connection.config.database || '-'}`
}

export function DataSourcePanel(): JSX.Element {
  const [connections, setConnections] = useState<DataSourceConnection[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState('')
  const [connectionsCollapsed, setConnectionsCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DataSourceConnection | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionForm] = Form.useForm<DataSourceConnectionFormValues>()
  const watchedKind = Form.useWatch('kind', connectionForm) ?? 'mysql'
  const activeConnection = connections.find((connection) => connection.id === activeConnectionId) ?? connections[0] ?? null

  async function loadConnections(preferredId = activeConnectionId): Promise<void> {
    setLoading(true)

    try {
      const nextConnections = await window.forgeDesk.listDataSourceConnections()
      const nextActiveId = nextConnections.some((connection) => connection.id === preferredId) ? preferredId : nextConnections[0]?.id ?? ''

      setConnections(nextConnections)
      setActiveConnectionId(nextActiveId)
    } catch (error) {
      message.error(getErrorMessage(error, '读取数据源连接失败'))
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal(kind: DataSourceKind = 'mysql'): void {
    setEditingConnection(null)
    connectionForm.setFieldsValue({ ...createDataSourceConnectionFormValues(), kind, port: getDefaultDataSourcePort(kind), connectionUrl: '' })
    setModalOpen(true)
  }

  function updateCreateKind(kind: DataSourceKind): void {
    if (editingConnection) {
      return
    }

    const currentName = connectionForm.getFieldValue('name')

    connectionForm.setFieldsValue({
      ...createDataSourceConnectionFormValues(),
      kind,
      name: currentName,
      connectionUrl: '',
      host: kind === 's3' ? undefined : '127.0.0.1',
      port: getDefaultDataSourcePort(kind)
    })
  }

  function openEditModal(connection: DataSourceConnection): void {
    setEditingConnection(connection)
    connectionForm.setFieldsValue({ ...createDataSourceConnectionFormValues(connection), connectionUrl: '' })
    setModalOpen(true)
  }

  function applyConnectionUrl(rawValue?: string): void {
    const connectionUrl = String(rawValue ?? connectionForm.getFieldValue('connectionUrl') ?? '').trim()

    if (!connectionUrl) {
      message.warning('请先粘贴完整连接 URL')
      return
    }

    try {
      const parsed = parseDataSourceConnectionUrl(connectionUrl)

      if (editingConnection && parsed.kind !== editingConnection.kind) {
        message.error(`当前正在编辑 ${getDataSourceKindLabel(editingConnection.kind)} 连接，不能套用 ${getDataSourceKindLabel(parsed.kind)} URL`)
        return
      }

      const currentName = String(connectionForm.getFieldValue('name') ?? '').trim()
      const parsedKind = editingConnection?.kind ?? parsed.kind
      const nextValues: DataSourceConnectionFormValues = {
        ...createDataSourceConnectionFormValues(),
        database: undefined,
        username: undefined,
        password: undefined,
        ssl: false,
        url: undefined,
        tls: false,
        redisDatabase: undefined,
        region: undefined,
        bucket: undefined,
        endpoint: undefined,
        forcePathStyle: false,
        accessKeyId: undefined,
        secretAccessKey: undefined,
        sessionToken: undefined,
        ...parsed,
        kind: parsedKind,
        name: resolveDataSourceDisplayName(currentName, parsed.name),
        connectionUrl,
        host: parsedKind === 's3' ? undefined : parsed.host ?? '127.0.0.1',
        port: parsed.port ?? getDefaultDataSourcePort(parsedKind)
      }

      connectionForm.setFieldsValue(nextValues)
      message.success(currentName ? '已解析连接 URL，显示名称保持不变' : '已解析连接 URL')
    } catch (error) {
      message.error(getErrorMessage(error, '解析连接 URL 失败'))
    }
  }

  async function saveConnection(): Promise<void> {
    const values = await connectionForm.validateFields()

    setSaving(true)

    try {
      const saved = await window.forgeDesk.saveDataSourceConnection(createDataSourceConnectionInput(values, editingConnection?.id))

      message.success('数据源连接已保存')
      setModalOpen(false)
      setEditingConnection(null)
      connectionForm.resetFields()
      await loadConnections(saved.id)
    } catch (error) {
      message.error(getErrorMessage(error, '保存数据源连接失败'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteConnection(connection: DataSourceConnection): Promise<void> {
    try {
      const remaining = await window.forgeDesk.deleteDataSourceConnection(connection.id)

      setConnections(remaining)
      setActiveConnectionId(remaining[0]?.id ?? '')
      message.success('数据源连接已删除')
    } catch (error) {
      message.error(getErrorMessage(error, '删除数据源连接失败'))
    }
  }

  async function testConnection(connection: DataSourceConnection): Promise<void> {
    setTesting(true)

    try {
      const result = await window.forgeDesk.testDataSourceConnection(connection.id)

      if (result.ok) {
        message.success(result.detail || result.message)
      } else {
        message.error(result.detail || result.message)
      }
    } catch (error) {
      message.error(getErrorMessage(error, '测试数据源连接失败'))
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    void loadConnections('')
  }, [])

  return (
    <section className="workspace-section data-source-panel">
      <div className="section-heading data-source-page-heading">
        <div>
          <Typography.Title level={2}>数据源</Typography.Title>
          <Typography.Text type="secondary">快速查看 MySQL、PostgreSQL、Redis 和 AWS S3 数据。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadConnections()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
            新增连接
          </Button>
        </Space>
      </div>

      <div className={connectionsCollapsed ? 'data-source-workspace is-connections-collapsed' : 'data-source-workspace'}>
        <aside className={connectionsCollapsed ? 'data-source-sidebar is-collapsed' : 'data-source-sidebar'}>
          <div className="data-source-sidebar-heading">
            {!connectionsCollapsed ? (
              <Space direction="vertical" size={2}>
                <Typography.Text strong>连接</Typography.Text>
                <Typography.Text type="secondary">{connections.length} 个数据源</Typography.Text>
              </Space>
            ) : null}
            <Button
              type="text"
              icon={connectionsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label={connectionsCollapsed ? '展开连接列表' : '收起连接列表'}
              title={connectionsCollapsed ? '展开连接列表' : '收起连接列表'}
              onClick={() => setConnectionsCollapsed((current) => !current)}
            />
          </div>
          {connections.length ? (
            <div className="data-source-connection-list">
              {connections.map((connection) => (
                <button
                  key={connection.id}
                  type="button"
                  className={`data-source-connection-item${activeConnection?.id === connection.id ? ' active' : ''}`}
                  aria-label={connection.name}
                  title={connectionsCollapsed ? connection.name : undefined}
                  onClick={() => setActiveConnectionId(connection.id)}
                >
                  <span className="data-source-connection-icon">
                    <DataSourceKindIcon kind={connection.kind} />
                  </span>
                  <span className="data-source-connection-copy">
                    <Typography.Text strong ellipsis>
                      {connection.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" ellipsis>
                      {getDataSourceKindLabel(connection.kind)} · {getDataSourceConnectionSummary(connection)}
                    </Typography.Text>
                  </span>
                  {connection.secretConfigured ? <Tag color="green">Secret</Tag> : <Tag>无密钥</Tag>}
                </button>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={connectionsCollapsed ? undefined : '还没有数据源连接'} />
          )}
        </aside>

        <main className="data-source-content">
          {loading && !connections.length ? (
            <div className="data-source-loading">
              <Spin />
            </div>
          ) : activeConnection ? (
            <>
              <div className="data-source-detail-heading">
                <div className="data-source-detail-copy">
                  <div className="data-source-detail-title-row">
                    <Typography.Title level={3}>{activeConnection.name}</Typography.Title>
                    <Tag color="blue">{getDataSourceKindLabel(activeConnection.kind)}</Tag>
                    <Tag>只读</Tag>
                  </div>
                  <Typography.Text type="secondary" ellipsis={{ tooltip: getDataSourceConnectionSummary(activeConnection) }}>
                    {getDataSourceConnectionSummary(activeConnection)}
                  </Typography.Text>
                </div>
                <Space wrap>
                  <Button icon={<ThunderboltOutlined />} loading={testing} onClick={() => testConnection(activeConnection)}>
                    测试连接
                  </Button>
                  <Button icon={<EditOutlined />} onClick={() => openEditModal(activeConnection)}>
                    编辑
                  </Button>
                  <Popconfirm title="删除这个数据源连接？" okText="删除" cancelText="取消" onConfirm={() => deleteConnection(activeConnection)}>
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              {isDatabaseDataSource(activeConnection.kind) ? (
                <DatabaseDataSourceBrowser connection={activeConnection} />
              ) : activeConnection.kind === 'redis' ? (
                <RedisDataSourceBrowser connection={activeConnection} />
              ) : (
                <S3DataSourceBrowser connection={activeConnection} />
              )}
            </>
          ) : (
            <div className="data-source-empty-action">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="新增一个连接后开始浏览数据" />
              <Space wrap>
                {DATA_SOURCE_KIND_OPTIONS.map((option) => (
                  <Button key={option.value} icon={<PlusOutlined />} onClick={() => openCreateModal(option.value)}>
                    {option.label}
                  </Button>
                ))}
              </Space>
            </div>
          )}
        </main>
      </div>

      <Modal
        title={editingConnection ? `编辑连接：${editingConnection.name}` : '新增数据源连接'}
        open={modalOpen}
        width={640}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={saveConnection}
        onCancel={() => {
          setModalOpen(false)
          setEditingConnection(null)
          connectionForm.resetFields()
        }}
      >
        <Form form={connectionForm} layout="vertical" initialValues={createDataSourceConnectionFormValues()}>
          <Form.Item label="完整 URL">
            <Space.Compact block>
              <Form.Item name="connectionUrl" noStyle>
                <Input
                  allowClear
                  autoComplete="off"
                  placeholder={getDataSourceUrlPlaceholder(watchedKind)}
                  onPaste={(event) => {
                    const pastedText = event.clipboardData.getData('text')

                    if (pastedText.trim()) {
                      window.setTimeout(() => applyConnectionUrl(pastedText), 0)
                    }
                  }}
                  onPressEnter={(event) => {
                    event.preventDefault()
                    applyConnectionUrl()
                  }}
                />
              </Form.Item>
              <Button icon={<LinkOutlined />} onClick={() => applyConnectionUrl()}>
                解析
              </Button>
            </Space.Compact>
          </Form.Item>
          <Row gutter={[12, 0]}>
            <Col span={12}>
              <Form.Item name="kind" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                <Select options={DATA_SOURCE_KIND_OPTIONS} disabled={Boolean(editingConnection)} onChange={updateCreateKind} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
                <Input placeholder="例如：生产订单库、Railway Redis" />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Paragraph type="secondary" className="data-source-name-help">
            显示名称只用于管理，不会改变真实连接地址或数据库配置。
          </Typography.Paragraph>
          <ConnectionFormFields kind={watchedKind} editing={editingConnection} />
        </Form>
      </Modal>
    </section>
  )
}
