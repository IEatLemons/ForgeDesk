import { Alert, Button, Descriptions, Empty, Input, Modal, Progress, Segmented, Space, Spin, Switch, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, DownloadOutlined, FolderOpenOutlined, PauseOutlined, PlayCircleOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'
import type { CleanupAuditRecord, CleanupPolicy, ExternalCleanupPreview, ProcessAnalysis, ProcessHistoryPoint, ResourceHistoryPoint, ResourceProcess, ResourceRetentionStatus, StorageDirectoryEntry, StorageOverview, StorageScanItem, StorageScanProgress } from './data'
import { getErrorMessage } from './error-messages'
import { formatDurationSeconds, formatMemoryBytes } from './system-monitor-view'

type ResourceView = 'processes' | 'history' | 'storage' | 'cleanup'

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN')
}

function rangeFromDays(days: number): { from: string; to: string } {
  return { from: new Date(Date.now() - days * 86400_000).toISOString(), to: new Date().toISOString() }
}

function riskTag(risk: StorageScanItem['risk']): JSX.Element {
  const meta = risk === 'low' ? { color: 'green', label: '低风险' }
    : risk === 'confirm' ? { color: 'gold', label: '需确认' }
      : risk === 'high' ? { color: 'red', label: '高风险' } : { color: 'default', label: '受保护' }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function storageItemNameCell(name: unknown, row: StorageScanItem): JSX.Element {
  return (
    <div className="storage-item-name">
      <Typography.Text strong className="table-text" ellipsis={{ tooltip: row.name || row.path }}>{String(name || row.name || row.path)}</Typography.Text>
      <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: row.path }}>{row.path}</Typography.Text>
    </div>
  )
}

function aggregateProcesses(processes: ResourceProcess[]): ResourceProcess[] {
  const grouped = new Map<string, ResourceProcess>()
  for (const process of processes) {
    const key = process.bundlePath || process.identityKey
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, { ...process, identityKey: key, processName: process.appName })
      continue
    }
    current.cpuPercent += process.cpuPercent
    current.memoryBytes += process.memoryBytes
    current.privateMemoryBytes += process.privateMemoryBytes
    current.virtualMemoryBytes += process.virtualMemoryBytes
    current.threadCount += process.threadCount
    current.portCount += process.portCount
    current.pageIns += process.pageIns
  }
  return [...grouped.values()].sort((left, right) => right.memoryBytes - left.memoryBytes)
}

function ProcessWorkspace(): JSX.Element {
  const [processes, setProcesses] = useState<ResourceProcess[]>([])
  const [mode, setMode] = useState<'app' | 'process'>('app')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ResourceProcess | null>(null)
  const [history, setHistory] = useState<ProcessHistoryPoint[]>([])

  async function load(): Promise<void> {
    try { setProcesses(await window.forgeDesk.listCurrentResourceProcesses()) }
    catch (error) { message.error(getErrorMessage(error, '进程读取失败')) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load().catch(() => undefined)
    const timer = window.setInterval(() => load().catch(() => undefined), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selected) { setHistory([]); return }
    window.forgeDesk.listProcessResourceHistory(selected.identityKey, rangeFromDays(1)).then(setHistory).catch(() => setHistory([]))
  }, [selected])

  const rows = useMemo(() => {
    const source = mode === 'app' ? aggregateProcesses(processes) : processes
    const normalized = query.trim().toLowerCase()
    return normalized ? source.filter((item) => [item.appName, item.processName, item.user, item.command, String(item.pid)].some((value) => value.toLowerCase().includes(normalized))) : source
  }, [mode, processes, query])

  const columns: ColumnsType<ResourceProcess> = [
    { title: mode === 'app' ? 'App' : '进程', key: 'name', fixed: 'left', width: 280, render: (_, row) => {
      const name = mode === 'app' ? row.appName : row.processName
      return <Button type="link" className="resource-process-name-button" title={name} onClick={() => setSelected(row)}><span>{name}</span></Button>
    } },
    { title: '内存', dataIndex: 'memoryBytes', key: 'memoryBytes', width: 120, sorter: (a, b) => a.memoryBytes - b.memoryBytes, defaultSortOrder: 'descend', render: formatMemoryBytes },
    { title: 'CPU', dataIndex: 'cpuPercent', key: 'cpuPercent', width: 100, sorter: (a, b) => a.cpuPercent - b.cpuPercent, render: (value) => `${Number(value).toFixed(1)}%` },
    { title: '私有内存', dataIndex: 'privateMemoryBytes', key: 'privateMemoryBytes', width: 120, render: formatMemoryBytes },
    { title: '虚拟内存', dataIndex: 'virtualMemoryBytes', key: 'virtualMemoryBytes', width: 120, render: formatMemoryBytes },
    { title: '线程', dataIndex: 'threadCount', key: 'threadCount', width: 80 },
    { title: '端口', dataIndex: 'portCount', key: 'portCount', width: 80 },
    { title: 'PID', dataIndex: 'pid', key: 'pid', width: 90 },
    { title: '用户', dataIndex: 'user', key: 'user', width: 110 },
    { title: '状态', dataIndex: 'state', key: 'state', width: 100 },
    { title: '已运行', dataIndex: 'elapsedSeconds', key: 'elapsedSeconds', width: 120, render: formatDurationSeconds },
    { title: '操作', key: 'actions', fixed: 'right', width: 210, render: (_, row) => (
      <Space size={4}>
        <Button size="small" disabled={!row.executablePath} onClick={() => window.forgeDesk.revealResourceProcess(row.executablePath)}>Finder</Button>
        <Button size="small" danger disabled={mode === 'app'} onClick={() => Modal.confirm({ title: `退出 ${row.processName}？`, content: `将向 PID ${row.pid} 发送正常退出请求。`, okText: '退出', okButtonProps: { danger: true }, onOk: async () => { await window.forgeDesk.signalResourceProcess(row.pid, false); await load() } })}>退出</Button>
        <Button size="small" danger disabled={mode === 'app'} onClick={() => Modal.confirm({ title: `强制退出 ${row.processName}？`, content: '未保存的数据可能丢失，此操作需要再次确认。', okText: '强制退出', okButtonProps: { danger: true }, onOk: async () => { await window.forgeDesk.signalResourceProcess(row.pid, true); await load() } })}>强制</Button>
      </Space>
    ) }
  ]

  const chart = { tooltip: { trigger: 'axis' }, legend: { data: ['内存', 'CPU'] }, grid: { left: 56, right: 45, bottom: 32 }, xAxis: { type: 'category', data: history.map((point) => new Date(point.capturedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })) }, yAxis: [{ type: 'value', axisLabel: { formatter: (value: number) => formatMemoryBytes(value) } }, { type: 'value', axisLabel: { formatter: '{value}%' } }], series: [{ name: '内存', type: 'line', smooth: true, symbol: 'none', data: history.map((point) => point.memoryPeakBytes) }, { name: 'CPU', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, data: history.map((point) => point.cpuPeak) }] }

  return <Space direction="vertical" size={16} className="system-monitor-content">
    <div className="resource-workspace-toolbar">
      <Space wrap><Segmented value={mode} options={[{ label: '按 App', value: 'app' }, { label: '按进程', value: 'process' }]} onChange={(value) => setMode(value as 'app' | 'process')} /><Input allowClear prefix={<SearchOutlined />} placeholder="搜索 App、进程、PID、用户" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 300 }} /></Space>
      <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
    </div>
    <div className="system-monitor-section resource-process-table"><Table rowKey={(row) => mode === 'app' ? row.identityKey : row.instanceKey} tableLayout="fixed" loading={loading} size="small" columns={columns} dataSource={rows} pagination={{ pageSize: 25, showSizeChanger: true }} scroll={{ x: 1560 }} /></div>
    {selected ? <div className="system-monitor-section"><div className="system-monitor-section-heading"><div><Typography.Title level={4}>{selected.appName} 历史</Typography.Title><Typography.Text type="secondary">最近 24 小时峰值趋势 · {selected.executablePath || selected.command}</Typography.Text></div></div>{history.length ? <ReactECharts option={chart} style={{ height: 300 }} /> : <Empty description="后台采样正在积累历史" />}</div> : null}
  </Space>
}

function HistoryWorkspace(): JSX.Element {
  const [days, setDays] = useState(7)
  const [history, setHistory] = useState<ResourceHistoryPoint[]>([])
  const [analysis, setAnalysis] = useState<ProcessAnalysis[]>([])
  const [retention, setRetention] = useState<ResourceRetentionStatus | null>(null)
  const [loginStart, setLoginStart] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([window.forgeDesk.listResourceHistory(rangeFromDays(days)), window.forgeDesk.listProcessAnalysis(rangeFromDays(days)), window.forgeDesk.getResourceRetentionStatus(), window.forgeDesk.getResourceMonitorSettings()])
      .then(([points, rows, status, settings]) => { setHistory(points); setAnalysis(rows); setRetention(status); setLoginStart(settings.loginStartEnabled) })
      .catch((error) => message.error(getErrorMessage(error, '历史读取失败'))).finally(() => setLoading(false))
  }, [days])

  const chart = { tooltip: { trigger: 'axis' }, legend: { data: ['CPU', '内存', '存储'] }, grid: { left: 48, right: 18, bottom: 32 }, xAxis: { type: 'category', data: history.map((point) => formatDate(point.capturedAt)) }, yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } }, series: [
    { name: 'CPU', type: 'line', symbol: 'none', smooth: true, data: history.map((point) => point.cpuPercent) },
    { name: '内存', type: 'line', symbol: 'none', smooth: true, data: history.map((point) => point.memoryUsagePercent) },
    { name: '存储', type: 'line', symbol: 'none', smooth: true, data: history.map((point) => point.storageUsagePercent) }
  ] }
  const columns: ColumnsType<ProcessAnalysis> = [
    { title: 'App / 进程', key: 'name', width: 260, render: (_, row) => <div className="resource-process-analysis-name"><Typography.Text strong ellipsis={{ tooltip: row.appName }}>{row.appName}</Typography.Text><Typography.Text type="secondary" ellipsis={{ tooltip: row.processName }}>{row.processName}</Typography.Text></div> },
    { title: '平均内存', dataIndex: 'averageMemoryBytes', key: 'averageMemoryBytes', width: 120, render: formatMemoryBytes },
    { title: '峰值内存', dataIndex: 'peakMemoryBytes', key: 'peakMemoryBytes', width: 120, sorter: (a, b) => a.peakMemoryBytes - b.peakMemoryBytes, defaultSortOrder: 'descend', render: formatMemoryBytes },
    { title: '平均 CPU', dataIndex: 'averageCpuPercent', key: 'averageCpuPercent', width: 100, render: (value) => `${Number(value).toFixed(1)}%` },
    { title: '峰值 CPU', dataIndex: 'peakCpuPercent', key: 'peakCpuPercent', width: 100, render: (value) => `${Number(value).toFixed(1)}%` },
    { title: '高占用时长', dataIndex: 'aboveThresholdSeconds', key: 'aboveThresholdSeconds', width: 130, render: formatDurationSeconds },
    { title: '样本', dataIndex: 'sampleCount', key: 'sampleCount', width: 90 },
    { title: '最近出现', dataIndex: 'lastSeenAt', key: 'lastSeenAt', width: 180, render: formatDate }
  ]

  return <Space direction="vertical" size={16} className="system-monitor-content">
    <div className="resource-workspace-toolbar"><Space wrap><Segmented value={days} options={[{ label: '24 小时', value: 1 }, { label: '7 天', value: 7 }, { label: '30 天', value: 30 }]} onChange={(value) => setDays(Number(value))} />{retention ? <Tag color="blue">15 秒原始 {retention.rawDays} 天 · 5 分钟聚合 {retention.fiveMinuteDays} 天 · 小时长期</Tag> : null}<Typography.Text type="secondary">登录后后台采样</Typography.Text><Switch checked={loginStart} onChange={async (checked) => { await window.forgeDesk.setResourceLoginStart(checked); setLoginStart(checked) }} /></Space><Space><Button icon={<DownloadOutlined />} onClick={() => window.forgeDesk.exportProcessAnalysis({ format: 'csv', range: rangeFromDays(days) })}>CSV</Button><Button onClick={() => window.forgeDesk.exportProcessAnalysis({ format: 'json', range: rangeFromDays(days) })}>JSON</Button></Space></div>
    {retention ? <div className="resource-retention-grid"><Descriptions bordered size="small" column={1}><Descriptions.Item label="原始进程样本">{retention.rawSampleCount.toLocaleString()}</Descriptions.Item><Descriptions.Item label="聚合样本">{retention.rollupSampleCount.toLocaleString()}</Descriptions.Item></Descriptions><Descriptions bordered size="small" column={1}><Descriptions.Item label="最早原始记录">{formatDate(retention.oldestRawAt)}</Descriptions.Item><Descriptions.Item label="预计数据体积">{formatMemoryBytes(retention.databaseBytesEstimate)}</Descriptions.Item></Descriptions></div> : null}
    <div className="system-monitor-section">{loading ? <Spin /> : history.length ? <ReactECharts option={chart} style={{ height: 320 }} /> : <Empty description="后台历史正在积累" />}</div>
    <div className="system-monitor-section resource-process-table"><div className="system-monitor-section-heading"><Typography.Title level={4}>高占用分析</Typography.Title><Typography.Text type="secondary">高占用：内存 ≥ 1 GB 或 CPU ≥ 80%</Typography.Text></div><Table rowKey="identityKey" tableLayout="fixed" size="small" columns={columns} dataSource={analysis} pagination={{ pageSize: 20 }} scroll={{ x: 1140 }} /></div>
  </Space>
}

function useStorageOverview(): { overview: StorageOverview | null; progress: StorageScanProgress | null; loading: boolean; refresh: () => Promise<void>; setOverview: (value: StorageOverview) => void } {
  const [overview, setOverview] = useState<StorageOverview | null>(null)
  const [progress, setProgress] = useState<StorageScanProgress | null>(null)
  const [loading, setLoading] = useState(true)
  async function refresh(): Promise<void> { try { setOverview(await window.forgeDesk.getStorageGovernanceOverview()) } finally { setLoading(false) } }
  useEffect(() => { refresh().catch(() => undefined); return window.forgeDesk.onStorageGovernanceProgress((event) => { setProgress(event); if (event.status === 'completed' || event.status === 'failed') refresh().catch(() => undefined) }) }, [])
  return { overview, progress, loading, refresh, setOverview }
}

type DirectoryNode = StorageDirectoryEntry & { children?: DirectoryNode[]; isPlaceholder?: boolean }

function createDirectoryPlaceholder(parent: StorageDirectoryEntry): DirectoryNode {
  return {
    path: `${parent.path}::loading`,
    name: '正在加载...',
    rootId: parent.rootId,
    parentPath: parent.path,
    sizeBytes: 0,
    growthBytes: 0,
    fileCount: 0,
    directoryCount: 0,
    childDirectoryCount: 0,
    depth: parent.depth + 1,
    rootPercent: 0,
    isPlaceholder: true
  }
}

function createDirectoryNode(entry: StorageDirectoryEntry, expandable: boolean): DirectoryNode {
  return {
    ...entry,
    children: expandable && entry.childDirectoryCount > 0 ? [createDirectoryPlaceholder(entry)] : undefined
  }
}

function replaceDirectoryChildren(nodes: DirectoryNode[], path: string, children: DirectoryNode[]): DirectoryNode[] {
  return nodes.map((node) => {
    if (node.path === path) {
      return { ...node, children: children.length ? children : undefined }
    }

    return node.children ? { ...node, children: replaceDirectoryChildren(node.children, path, children) } : node
  })
}

function StorageWorkspace(): JSX.Element {
  const { overview, progress, loading, refresh, setOverview } = useStorageOverview()
  const scanning = progress?.status === 'running' || progress?.status === 'paused'
  const [directoryRows, setDirectoryRows] = useState<DirectoryNode[]>([])
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [expandedDirectoryKeys, setExpandedDirectoryKeys] = useState<Array<string | number>>([])

  async function loadTopDirectories(search = directorySearch): Promise<void> {
    const latestRun = overview?.latestRun
    if (!latestRun || latestRun.mode !== 'deep') {
      setDirectoryRows([])
      setExpandedDirectoryKeys([])
      return
    }

    setDirectoryLoading(true)
    try {
      const result = await window.forgeDesk.listStorageDirectories({
        limit: 500,
        parentPath: search.trim() ? undefined : '',
        scanId: latestRun.id,
        search: search.trim() || undefined,
        sortBy: 'sizeBytes',
        sortOrder: 'desc'
      })
      const expandable = !search.trim()
      setDirectoryRows(result.directories.map((entry) => createDirectoryNode(entry, expandable)))
      setExpandedDirectoryKeys([])
    } catch (error) {
      message.error(getErrorMessage(error, '目录读取失败'))
    } finally {
      setDirectoryLoading(false)
    }
  }

  async function loadDirectoryChildren(row: DirectoryNode): Promise<void> {
    const latestRun = overview?.latestRun
    if (!latestRun || row.isPlaceholder || directorySearch.trim()) return
    const alreadyLoaded = row.children?.length && !row.children.some((child) => child.isPlaceholder)
    if (alreadyLoaded) return
    try {
      const result = await window.forgeDesk.listStorageDirectories({
        limit: 500,
        parentPath: row.path,
        rootId: row.rootId,
        scanId: latestRun.id,
        sortBy: 'sizeBytes',
        sortOrder: 'desc'
      })
      setDirectoryRows((current) => replaceDirectoryChildren(current, row.path, result.directories.map((entry) => createDirectoryNode(entry, true))))
    } catch (error) {
      message.error(getErrorMessage(error, '子目录读取失败'))
    }
  }

  useEffect(() => { loadTopDirectories().catch(() => undefined) }, [overview?.latestRun?.id, overview?.latestRun?.mode])

  const directoryColumns: ColumnsType<DirectoryNode> = [
    { title: '目录', dataIndex: 'name', key: 'name', fixed: 'left', width: 340, render: (name, row) => (
      <div className="storage-directory-name">
        <Typography.Text strong={!row.isPlaceholder} className="table-text" ellipsis={{ tooltip: row.path }}>{name || row.path}</Typography.Text>
        {!row.isPlaceholder ? <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: row.path }}>{row.path}</Typography.Text> : null}
      </div>
    ) },
    { title: '占用', dataIndex: 'sizeBytes', key: 'sizeBytes', width: 130, sorter: (a, b) => a.sizeBytes - b.sizeBytes, defaultSortOrder: 'descend', render: (value, row) => row.isPlaceholder ? '-' : formatMemoryBytes(value) },
    { title: '根目录占比', dataIndex: 'rootPercent', key: 'rootPercent', width: 150, sorter: (a, b) => a.rootPercent - b.rootPercent, render: (value, row) => row.isPlaceholder ? '-' : <Progress percent={Number(value.toFixed(1))} size="small" /> },
    { title: '文件数', dataIndex: 'fileCount', key: 'fileCount', width: 110, sorter: (a, b) => a.fileCount - b.fileCount, render: (value, row) => row.isPlaceholder ? '-' : Number(value).toLocaleString() },
    { title: '目录数', dataIndex: 'directoryCount', key: 'directoryCount', width: 110, sorter: (a, b) => a.directoryCount - b.directoryCount, render: (value, row) => row.isPlaceholder ? '-' : Number(value).toLocaleString() },
    { title: '直接子目录', dataIndex: 'childDirectoryCount', key: 'childDirectoryCount', width: 120, sorter: (a, b) => a.childDirectoryCount - b.childDirectoryCount, render: (value, row) => row.isPlaceholder ? '-' : Number(value).toLocaleString() },
    { title: '较上次增长', dataIndex: 'growthBytes', key: 'growthBytes', width: 140, sorter: (a, b) => a.growthBytes - b.growthBytes, render: (value, row) => row.isPlaceholder ? '-' : value > 0 ? <Typography.Text type="danger">+{formatMemoryBytes(value)}</Typography.Text> : value < 0 ? <Typography.Text type="success">-{formatMemoryBytes(Math.abs(value))}</Typography.Text> : '-' }
  ]
  async function addProjectRoots(): Promise<void> {
    const projects = (await window.forgeDesk.listProjects()).projects
    let next = overview
    for (const project of projects) {
      if (project.workspacePath) next = await window.forgeDesk.saveStorageGovernanceRoot({ path: project.workspacePath, label: `项目 · ${project.name}`, source: 'project' })
    }
    if (next) setOverview(next)
    message.success(`已授权 ${projects.filter((project) => project.workspacePath).length} 个项目目录`)
  }
  const columns: ColumnsType<StorageScanItem> = [
    { title: '文件 / 目录', dataIndex: 'name', key: 'name', fixed: 'left', width: 360, render: storageItemNameCell },
    { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', width: 120, sorter: (a, b) => a.sizeBytes - b.sizeBytes, defaultSortOrder: 'descend', render: formatMemoryBytes },
    { title: '分类', dataIndex: 'category', key: 'category', width: 150 },
    { title: '风险', dataIndex: 'risk', key: 'risk', width: 100, render: riskTag },
    { title: '原因', dataIndex: 'reason', key: 'reason', width: 260, render: (reason) => <Typography.Text className="table-text" ellipsis={{ tooltip: reason }}>{reason}</Typography.Text> },
    { title: '最后修改', dataIndex: 'modifiedAt', key: 'modifiedAt', width: 180, render: formatDate },
    { title: '重复校验', key: 'duplicate', width: 130, render: (_, row) => row.verifiedHash ? <Tag color="green">已校验</Tag> : row.duplicateKey ? <Button size="small" onClick={async () => { await window.forgeDesk.verifyStorageDuplicateGroup(row.id); await refresh() }}>校验哈希</Button> : '-' }
  ]
  const trendChart = { tooltip: { trigger: 'axis' }, legend: { data: ['已扫描', '可回收'] }, grid: { left: 64, right: 18, bottom: 32 }, xAxis: { type: 'category', data: (overview?.trend ?? []).map((point) => formatDate(point.capturedAt)) }, yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatMemoryBytes(value) } }, series: [{ name: '已扫描', type: 'line', symbol: 'none', smooth: true, data: (overview?.trend ?? []).map((point) => point.scannedBytes) }, { name: '可回收', type: 'line', symbol: 'none', smooth: true, data: (overview?.trend ?? []).map((point) => point.reclaimableBytes) }] }

  if (loading) return <Spin />
  return <Space direction="vertical" size={16} className="system-monitor-content">
    <div className="resource-workspace-toolbar"><div><Typography.Title level={4}>授权扫描目录</Typography.Title><Typography.Text type="secondary">不会跟随符号链接，不会越过这些目录执行清理。</Typography.Text></div><Space><Button onClick={() => addProjectRoots()}>授权项目目录</Button><Button icon={<FolderOpenOutlined />} onClick={async () => setOverview(await window.forgeDesk.selectStorageGovernanceRoots())}>添加目录</Button><Button icon={<ReloadOutlined />} onClick={() => refresh()}>刷新</Button></Space></div>
    <div className="storage-root-list">{overview?.roots.length ? overview.roots.map((root) => <div className="storage-root-item" key={root.id}><div><Typography.Text strong>{root.label}</Typography.Text><br /><Typography.Text type="secondary">{root.path} · 最近扫描 {formatDate(root.lastScannedAt)}</Typography.Text></div><Button danger type="text" icon={<DeleteOutlined />} onClick={async () => setOverview(await window.forgeDesk.deleteStorageGovernanceRoot(root.id))}>移除</Button></div>) : <Alert type="info" showIcon message="尚未授权扫描目录" description="添加你希望管理的目录；ForgeDesk 不会默认扫描整个磁盘。" />}</div>
    <div className="resource-workspace-toolbar"><Space><Button type="primary" icon={<PlayCircleOutlined />} disabled={!overview?.roots.length || scanning} onClick={() => window.forgeDesk.startStorageGovernanceScan('quick').then(() => refresh())}>每日快扫</Button><Button disabled={!overview?.roots.length || scanning} onClick={() => window.forgeDesk.startStorageGovernanceScan('deep').then(() => refresh())}>深度扫描</Button>{scanning && progress ? <Button icon={progress.status === 'paused' ? <PlayCircleOutlined /> : <PauseOutlined />} onClick={() => window.forgeDesk.pauseStorageGovernanceScan(progress.scanId, progress.status !== 'paused')}>{progress.status === 'paused' ? '继续' : '暂停'}</Button> : null}</Space>{overview?.latestRun ? <Typography.Text type="secondary">最近：{overview.latestRun.mode === 'deep' ? '深度' : '快速'}扫描 · {overview.latestRun.filesScanned.toLocaleString()} 文件 · {formatMemoryBytes(overview.latestRun.bytesScanned)}</Typography.Text> : null}</div>
    {scanning && progress ? <div className="system-monitor-section"><Progress percent={undefined} status="active" /><Typography.Text>{progress.status === 'paused' ? '已暂停' : '正在扫描'}：{progress.currentPath}</Typography.Text><br /><Typography.Text type="secondary">{progress.filesScanned.toLocaleString()} 文件 · {formatMemoryBytes(progress.bytesScanned)} · {progress.errorCount} 个权限或读取错误</Typography.Text></div> : null}
    <div className="system-monitor-detail-grid"><div className="system-monitor-section storage-directory-section"><div className="system-monitor-section-heading"><div><Typography.Title level={4}>目录占用与增长</Typography.Title><Typography.Text type="secondary">{overview?.latestRun?.mode === 'deep' ? `已载入 ${directoryRows.length.toLocaleString()} 个目录` : '完成深度扫描后显示完整目录树'}</Typography.Text></div><Space wrap><Input allowClear className="storage-directory-search" prefix={<SearchOutlined />} placeholder="搜索目录路径" value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} onPressEnter={() => loadTopDirectories()} style={{ width: 260 }} /><Button icon={<SearchOutlined />} onClick={() => loadTopDirectories()}>搜索</Button></Space></div><Table rowKey="path" tableLayout="fixed" loading={directoryLoading} size="small" columns={directoryColumns} dataSource={directoryRows} pagination={directorySearch.trim() ? { pageSize: 50 } : false} scroll={{ x: 1100, y: 380 }} expandable={{ expandedRowKeys: expandedDirectoryKeys, onExpand: (expanded, row) => { setExpandedDirectoryKeys((keys) => expanded ? [...new Set([...keys, row.path])] : keys.filter((key) => key !== row.path)); if (expanded) loadDirectoryChildren(row).catch(() => undefined) } }} locale={{ emptyText: <Empty description={overview?.latestRun?.mode === 'deep' ? '没有匹配目录' : '完成深度扫描后显示目录树'} /> }} /></div><div className="system-monitor-section"><div className="system-monitor-section-heading"><Typography.Title level={4}>容量变化趋势</Typography.Title></div>{(overview?.trend.length ?? 0) > 0 ? <ReactECharts option={trendChart} style={{ height: 360 }} /> : <Empty description="完成多次扫描后显示趋势" />}</div></div>
    <div className="system-monitor-section storage-candidate-table"><div className="system-monitor-section-heading"><div><Typography.Title level={4}>占用与治理候选</Typography.Title><Typography.Text type="secondary">预计可回收 {formatMemoryBytes(overview?.totalReclaimableBytes ?? 0)}</Typography.Text></div></div><Table rowKey="id" tableLayout="fixed" size="small" columns={columns} dataSource={overview?.items ?? []} pagination={{ pageSize: 25 }} scroll={{ x: 1300 }} /></div>
  </Space>
}

function CleanupWorkspace(): JSX.Element {
  const { overview, loading, refresh, setOverview } = useStorageOverview()
  const [selected, setSelected] = useState<React.Key[]>([])
  const [audit, setAudit] = useState<CleanupAuditRecord[]>([])
  const [externalPreviews, setExternalPreviews] = useState<ExternalCleanupPreview[]>([])
  useEffect(() => {
    window.forgeDesk.listStorageCleanupAudit().then(setAudit).catch(() => undefined)
    window.forgeDesk.listExternalCleanupPreviews().then(setExternalPreviews).catch(() => undefined)
  }, [overview?.policies.find((policy) => policy.key === 'docker')?.enabled])
  const selectedItems = (overview?.items ?? []).filter((item) => selected.includes(item.id))
  const selectedBytes = selectedItems.reduce((sum, item) => sum + item.sizeBytes, 0)

  async function clean(): Promise<void> {
    const preview = await window.forgeDesk.previewStorageCleanup(selected.map(String))
    Modal.confirm({ title: `将 ${preview.length} 项移到废纸篓？`, content: <Space direction="vertical"><Typography.Text>预计释放 {formatMemoryBytes(preview.reduce((sum, item) => sum + item.sizeBytes, 0))}</Typography.Text><Typography.Text type="secondary">普通文件不会永久删除，可从 macOS 废纸篓恢复。重复文件必须已完成哈希校验并保留至少一个副本。</Typography.Text></Space>, okText: '移到废纸篓', okButtonProps: { danger: true }, onOk: async () => { const records = await window.forgeDesk.executeStorageCleanup(selected.map(String)); setSelected([]); setAudit(await window.forgeDesk.listStorageCleanupAudit()); await refresh(); message.success(`已处理 ${records.filter((item) => item.status === 'success').length} 项`) } })
  }

  const policyColumns: ColumnsType<CleanupPolicy> = [
    { title: '策略', dataIndex: 'label', key: 'label', width: 180, render: (label, row) => <Space><SafetyCertificateOutlined /><Typography.Text strong>{label}</Typography.Text>{riskTag(row.risk)}</Space> },
    { title: '规则', dataIndex: 'description', key: 'description' },
    { title: '授权', key: 'enabled', width: 120, render: (_, row) => row.requiresCategoryAuthorization ? <Switch checked={row.enabled} onChange={async (checked) => setOverview(await window.forgeDesk.setCleanupCategoryAuthorization(row.key, checked))} /> : <Tag color="blue">内置</Tag> }
  ]
  const itemColumns: ColumnsType<StorageScanItem> = [
    { title: '候选项', dataIndex: 'name', key: 'name', width: 360, render: storageItemNameCell },
    { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', width: 120, render: formatMemoryBytes },
    { title: '分类', dataIndex: 'category', key: 'category', width: 150 },
    { title: '风险', dataIndex: 'risk', key: 'risk', width: 100, render: riskTag },
    { title: '说明', dataIndex: 'reason', key: 'reason', width: 260, render: (reason) => <Typography.Text className="table-text" ellipsis={{ tooltip: reason }}>{reason}</Typography.Text> }
  ]
  const auditColumns: ColumnsType<CleanupAuditRecord> = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: formatDate },
    { title: '动作', dataIndex: 'action', key: 'action', width: 120 }, { title: '目标', dataIndex: 'target', key: 'target', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (status) => <Tag color={status === 'success' ? 'green' : status === 'blocked' ? 'gold' : 'red'}>{status}</Tag> },
    { title: '详情', dataIndex: 'detail', key: 'detail' }, { title: '释放', dataIndex: 'reclaimedBytes', key: 'reclaimedBytes', width: 110, render: formatMemoryBytes }
  ]

  if (loading) return <Spin />
  return <Space direction="vertical" size={16} className="system-monitor-content">
    <Alert type="info" showIcon message="所有策略先预览，不自动删除" description="普通文件只移到 macOS 废纸篓；Docker 卷、系统保护目录和未经授权的路径不会进入默认清理。" />
    <div className="system-monitor-section"><div className="system-monitor-section-heading"><Typography.Title level={4}>分类授权与策略</Typography.Title></div><Table rowKey="key" size="small" columns={policyColumns} dataSource={overview?.policies ?? []} pagination={false} /></div>
    <div className="system-monitor-section"><div className="system-monitor-section-heading"><div><Typography.Title level={4}>Docker 专项清理</Typography.Title><Typography.Text type="secondary">永久操作，命令和影响范围会在执行前再次确认；Docker 卷始终排除。</Typography.Text></div></div><div className="storage-root-list">{externalPreviews.map((preview) => <div className="storage-root-item" key={preview.key}><div><Typography.Text strong>{preview.label}</Typography.Text> {riskTag('high')}<br /><Typography.Text code>{preview.command}</Typography.Text><Typography.Text type="secondary"> · 预计 {formatMemoryBytes(preview.estimatedBytes)}</Typography.Text></div><Button danger disabled={!preview.enabled} onClick={() => Modal.confirm({ title: `执行 ${preview.label}？`, content: <><Typography.Paragraph>将永久执行以下白名单命令，不包含 Docker 卷：</Typography.Paragraph><Typography.Text code>{preview.command}</Typography.Text></>, okText: '确认永久清理', okButtonProps: { danger: true }, onOk: async () => { const record = await window.forgeDesk.executeExternalCleanup(preview.key); setAudit(await window.forgeDesk.listStorageCleanupAudit()); setExternalPreviews(await window.forgeDesk.listExternalCleanupPreviews()); if (record.status === 'success') message.success('Docker 清理完成'); else message.error(record.detail) } })}>执行</Button></div>)}</div></div>
    <div className="system-monitor-section storage-candidate-table"><div className="resource-workspace-toolbar"><div><Typography.Title level={4}>清理预览</Typography.Title><Typography.Text type="secondary">已选 {selected.length} 项 · {formatMemoryBytes(selectedBytes)}</Typography.Text></div><Button type="primary" danger disabled={!selected.length} onClick={() => clean()}>预览并移到废纸篓</Button></div><Table rowKey="id" tableLayout="fixed" size="small" rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: (row) => ({ disabled: row.risk === 'protected' }) }} columns={itemColumns} dataSource={overview?.items ?? []} pagination={{ pageSize: 20 }} scroll={{ x: 1050 }} /></div>
    <div className="system-monitor-section"><div className="system-monitor-section-heading"><Typography.Title level={4}>操作审计</Typography.Title></div><Table rowKey="id" size="small" columns={auditColumns} dataSource={audit} pagination={{ pageSize: 15 }} scroll={{ x: 1000 }} /></div>
  </Space>
}

export function ResourceGovernancePanel({ view }: { view: ResourceView }): JSX.Element {
  if (view === 'processes') return <ProcessWorkspace />
  if (view === 'history') return <HistoryWorkspace />
  if (view === 'storage') return <StorageWorkspace />
  return <CleanupWorkspace />
}
