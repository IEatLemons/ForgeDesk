import { Alert, Badge, Button, Descriptions, Empty, Progress, Space, Spin, Switch, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ApiOutlined, ArrowLeftOutlined, DashboardOutlined, DesktopOutlined, GlobalOutlined, HddOutlined, ReloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SystemMonitorDiskVolume, SystemMonitorNetworkInterface, SystemMonitorSnapshot } from './data'
import { getErrorMessage } from './error-messages'
import {
  SYSTEM_MONITOR_HARDWARE_LABELS,
  createSystemMonitorHardwareMetrics,
  createSystemMonitorSummary,
  formatBytes,
  formatDurationSeconds,
  formatNetworkPort,
  formatPercent,
  formatProxyEndpoint,
  formatStorageBytes,
  formatSystemMonitorHistoryValue,
  getClashStatusMeta,
  getSystemMonitorHistoryValue,
  getSystemMonitorStatusMeta,
  readStoredSystemMonitorHistory,
  readStoredSystemMonitorOverviewHardwareKeys,
  rememberSystemMonitorSnapshot,
  writeStoredSystemMonitorOverviewHardwareKeys,
  type SystemMonitorHardwareKey,
  type SystemMonitorHistoryPoint
} from './system-monitor-view'

function getHardwareIcon(key: SystemMonitorHardwareKey): JSX.Element {
  switch (key) {
    case 'cpu':
      return <DashboardOutlined />
    case 'memory':
      return <DesktopOutlined />
    case 'storage':
      return <HddOutlined />
    case 'network':
      return <GlobalOutlined />
  }
}

function getHardwareChartColor(key: SystemMonitorHardwareKey): string {
  switch (key) {
    case 'cpu':
      return '#1677ff'
    case 'memory':
      return '#13c2c2'
    case 'storage':
      return '#faad14'
    case 'network':
      return '#52c41a'
  }
}

function formatHistoryTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function createHardwareHistoryChartOption(key: SystemMonitorHardwareKey, history: SystemMonitorHistoryPoint[]): Record<string, unknown> {
  const visibleHistory = history.slice(-80)
  const isNetworkMetric = key === 'network'
  const color = getHardwareChartColor(key)

  return {
    color: [color],
    grid: { bottom: 32, left: 48, right: 18, top: 18 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ data: number; name: string }>) => {
        const item = params[0]
        return item ? `${item.name}<br/>${SYSTEM_MONITOR_HARDWARE_LABELS[key]}：${formatSystemMonitorHistoryValue(key, Number(item.data))}` : ''
      }
    },
    xAxis: {
      axisTick: { show: false },
      boundaryGap: false,
      data: visibleHistory.map((point) => formatHistoryTime(point.checkedAt)),
      type: 'category'
    },
    yAxis: {
      axisLabel: {
        formatter: (value: number) => (isNetworkMetric ? formatBytes(value) : `${Math.round(value)}%`)
      },
      max: isNetworkMetric ? undefined : 100,
      min: 0,
      type: 'value'
    },
    series: [
      {
        areaStyle: { opacity: 0.12 },
        data: visibleHistory.map((point) => getSystemMonitorHistoryValue(point, key)),
        lineStyle: { width: 3 },
        smooth: true,
        symbol: 'none',
        type: 'line'
      }
    ]
  }
}

export function SystemMonitorPanel({ onBack }: { onBack: () => void }): JSX.Element {
  const [snapshot, setSnapshot] = useState<SystemMonitorSnapshot | null>(null)
  const [history, setHistory] = useState<SystemMonitorHistoryPoint[]>(() => readStoredSystemMonitorHistory())
  const [overviewHardwareKeys, setOverviewHardwareKeys] = useState<SystemMonitorHardwareKey[]>(() => readStoredSystemMonitorOverviewHardwareKeys())
  const [activeHardwareKey, setActiveHardwareKey] = useState<SystemMonitorHardwareKey>('cpu')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  async function loadSnapshot(mode: 'initial' | 'manual' | 'auto' = 'manual'): Promise<void> {
    if (!window.forgeDesk) {
      setError('当前环境无法读取电脑监控信息')
      setLoading(false)
      return
    }

    if (mode === 'initial') {
      setLoading(true)
    }

    if (mode === 'manual') {
      setRefreshing(true)
    }

    try {
      const nextSnapshot = await window.forgeDesk.getSystemMonitorSnapshot()

      if (!mountedRef.current) {
        return
      }

      const nextHistory = rememberSystemMonitorSnapshot(nextSnapshot)

      setSnapshot(nextSnapshot)
      setHistory(nextHistory)
      setError('')
    } catch (loadError) {
      if (mountedRef.current) {
        setError(getErrorMessage(loadError))
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true
    loadSnapshot('initial').catch(() => undefined)

    const intervalId = window.setInterval(() => {
      loadSnapshot('auto').catch(() => undefined)
    }, 60000)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
    }
  }, [])

  function toggleOverviewHardware(key: SystemMonitorHardwareKey, checked: boolean): void {
    const nextKeys = checked ? [...overviewHardwareKeys, key] : overviewHardwareKeys.filter((item) => item !== key)
    const normalizedKeys = writeStoredSystemMonitorOverviewHardwareKeys(nextKeys)

    setOverviewHardwareKeys(normalizedKeys)
    message.success(checked ? `${SYSTEM_MONITOR_HARDWARE_LABELS[key]} 已添加到总览` : `${SYSTEM_MONITOR_HARDWARE_LABELS[key]} 已从总览移除`)
  }

  const summary = useMemo(() => (snapshot ? createSystemMonitorSummary(snapshot) : null), [snapshot])
  const hardwareMetrics = useMemo(() => (snapshot ? createSystemMonitorHardwareMetrics(snapshot) : []), [snapshot])
  const activeMetric = hardwareMetrics.find((metric) => metric.key === activeHardwareKey) ?? hardwareMetrics[0]
  const statusMeta = snapshot ? getSystemMonitorStatusMeta(snapshot.status) : null
  const clashStatusMeta = snapshot ? getClashStatusMeta(snapshot.network.clash.status) : null
  const activeInterfaces = snapshot?.network.interfaces.filter((item) => !item.internal) ?? []
  const historyChartOption = useMemo(() => createHardwareHistoryChartOption(activeHardwareKey, history), [activeHardwareKey, history])
  const storageColumns: ColumnsType<SystemMonitorDiskVolume> = [
    {
      title: '挂载点',
      dataIndex: 'mount',
      key: 'mount',
      width: 180,
      render: (mount) => <Typography.Text strong>{mount === '/' ? 'Macintosh HD' : mount}</Typography.Text>
    },
    {
      title: '文件系统',
      dataIndex: 'filesystem',
      key: 'filesystem',
      render: (filesystem) => (
        <Typography.Text className="table-text" ellipsis={{ tooltip: filesystem }}>
          {filesystem}
        </Typography.Text>
      )
    },
    {
      title: '总容量',
      dataIndex: 'totalBytes',
      key: 'totalBytes',
      width: 120,
      render: (value) => formatStorageBytes(value)
    },
    {
      title: '已用',
      dataIndex: 'usedBytes',
      key: 'usedBytes',
      width: 120,
      render: (value) => formatStorageBytes(value)
    },
    {
      title: '可用',
      dataIndex: 'availableBytes',
      key: 'availableBytes',
      width: 120,
      render: (value) => formatStorageBytes(value)
    },
    {
      title: '使用率',
      dataIndex: 'usagePercent',
      key: 'usagePercent',
      width: 190,
      render: (value) => <Progress percent={Math.round(value)} size="small" status={value >= 90 ? 'exception' : value >= 75 ? 'active' : 'normal'} />
    }
  ]
  const networkColumns: ColumnsType<SystemMonitorNetworkInterface> = [
    {
      title: '接口',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name, row) => (
        <Space size={6}>
          <Typography.Text strong>{name}</Typography.Text>
          {row.internal ? <Tag>本机</Tag> : <Tag color="blue">活动</Tag>}
        </Space>
      )
    },
    { title: '协议', dataIndex: 'family', key: 'family', width: 90 },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (address, row) => (
        <Typography.Text className="table-text" ellipsis={{ tooltip: row.cidr || address }}>
          {address}
        </Typography.Text>
      )
    },
    {
      title: 'MAC',
      dataIndex: 'mac',
      key: 'mac',
      width: 180,
      render: (mac) => <Typography.Text type="secondary">{mac || '-'}</Typography.Text>
    }
  ]

  function renderActiveHardwareDetail(): JSX.Element {
    if (!snapshot || !activeMetric) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无硬件详情" />
    }

    if (activeHardwareKey === 'cpu') {
      return (
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="型号">{snapshot.cpu.model}</Descriptions.Item>
          <Descriptions.Item label="核心数">{snapshot.cpu.coreCount} 核 · {snapshot.cpu.speedMhz} MHz</Descriptions.Item>
          <Descriptions.Item label="当前负载">{formatPercent(snapshot.cpu.loadPercent)}</Descriptions.Item>
          <Descriptions.Item label="负载均值">{snapshot.cpu.loadAverage.join(' / ')}</Descriptions.Item>
          <Descriptions.Item label="系统运行">{formatDurationSeconds(snapshot.system.uptimeSeconds)}</Descriptions.Item>
        </Descriptions>
      )
    }

    if (activeHardwareKey === 'memory') {
      return (
        <Space direction="vertical" size={12} className="system-monitor-detail-stack">
          <Progress percent={Math.round(snapshot.memory.usagePercent)} status={snapshot.memory.usagePercent >= 90 ? 'exception' : snapshot.memory.usagePercent >= 75 ? 'active' : 'normal'} />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="总量">{formatBytes(snapshot.memory.totalBytes)}</Descriptions.Item>
            <Descriptions.Item label="已用">{formatBytes(snapshot.memory.usedBytes)}</Descriptions.Item>
            <Descriptions.Item label="可用">{formatBytes(snapshot.memory.freeBytes)}</Descriptions.Item>
          </Descriptions>
        </Space>
      )
    }

    if (activeHardwareKey === 'storage') {
      return (
        <Space direction="vertical" size={12} className="system-monitor-detail-stack">
          {snapshot.diskError ? <Alert type="warning" showIcon message={snapshot.diskError} /> : null}
          <Typography.Text type="secondary">
            {summary?.primaryDisk ? `主磁盘可用 ${formatStorageBytes(summary.primaryDisk.availableBytes)}，最高使用率 ${formatPercent(summary.maxDiskUsagePercent)}` : '未读取到磁盘数据'}
          </Typography.Text>
          <Table
            rowKey={(volume) => `${volume.filesystem}:${volume.mount}`}
            size="small"
            columns={storageColumns}
            dataSource={snapshot.disks}
            pagination={false}
            scroll={{ x: 860 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无磁盘数据" /> }}
          />
        </Space>
      )
    }

    return (
      <Space direction="vertical" size={12} className="system-monitor-detail-stack">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="活动网卡">{activeInterfaces.map((item) => `${item.name} ${item.address}`).join(' / ') || '-'}</Descriptions.Item>
          <Descriptions.Item label="默认网关">{snapshot.network.route.gateway || snapshot.network.route.error || '-'}</Descriptions.Item>
          <Descriptions.Item label="出口接口">{snapshot.network.route.interface || '-'}</Descriptions.Item>
          <Descriptions.Item label="DNS">{snapshot.network.dnsServers.join(' / ') || '-'}</Descriptions.Item>
          <Descriptions.Item label="HTTP 代理">{formatProxyEndpoint(snapshot.network.proxy.http)}</Descriptions.Item>
          <Descriptions.Item label="HTTPS 代理">{formatProxyEndpoint(snapshot.network.proxy.https)}</Descriptions.Item>
          <Descriptions.Item label="SOCKS 代理">{formatProxyEndpoint(snapshot.network.proxy.socks)}</Descriptions.Item>
          <Descriptions.Item label="PAC">{snapshot.network.proxy.pac.enabled ? snapshot.network.proxy.pac.url || '已启用' : '未启用'}</Descriptions.Item>
        </Descriptions>
        {snapshot.network.proxy.error ? <Alert type="warning" showIcon message={snapshot.network.proxy.error} /> : null}

        <div className="system-monitor-subsection-heading">
          <Typography.Title level={5}><ApiOutlined /> ClashX Meta</Typography.Title>
          {clashStatusMeta ? <Tag color={clashStatusMeta.color}><Badge status={clashStatusMeta.badgeStatus} text={clashStatusMeta.label} /></Tag> : null}
        </div>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="状态">{snapshot.network.clash.message}</Descriptions.Item>
          <Descriptions.Item label="控制地址">{snapshot.network.clash.controllerUrl || '-'}</Descriptions.Item>
          <Descriptions.Item label="配置文件">
            <Typography.Text className="table-text" ellipsis={{ tooltip: snapshot.network.clash.configPath }}>
              {snapshot.network.clash.configPath || '-'}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="版本">{snapshot.network.clash.version || '-'}</Descriptions.Item>
          <Descriptions.Item label="模式">{snapshot.network.clash.mode || '-'}</Descriptions.Item>
          <Descriptions.Item label="端口">
            mixed {formatNetworkPort(snapshot.network.clash.mixedPort)} · http {formatNetworkPort(snapshot.network.clash.httpPort)} · socks {formatNetworkPort(snapshot.network.clash.socksPort)}
          </Descriptions.Item>
          <Descriptions.Item label="连接">{snapshot.network.clash.connectionCount}</Descriptions.Item>
          <Descriptions.Item label="流量">
            ↑ {formatBytes(snapshot.network.clash.uploadTotalBytes)} / ↓ {formatBytes(snapshot.network.clash.downloadTotalBytes)}
          </Descriptions.Item>
          <Descriptions.Item label="速度">
            ↑ {formatBytes(snapshot.network.clash.uploadSpeedBytes)}/s / ↓ {formatBytes(snapshot.network.clash.downloadSpeedBytes)}/s
          </Descriptions.Item>
        </Descriptions>
        {snapshot.network.clash.error ? <Alert type="warning" showIcon message={snapshot.network.clash.error} /> : null}
        {snapshot.network.clash.activeProxyGroups.length > 0 ? (
          <div className="system-monitor-proxy-groups">
            {snapshot.network.clash.activeProxyGroups.map((group) => (
              <Tag key={group.name}>{group.name}: {group.now}</Tag>
            ))}
          </div>
        ) : null}

        <Table
          rowKey={(row) => `${row.name}:${row.family}:${row.address}`}
          size="small"
          columns={networkColumns}
          dataSource={snapshot.network.interfaces}
          pagination={false}
          scroll={{ x: 720 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无网卡数据" /> }}
        />
      </Space>
    )
  }

  if (loading && !snapshot) {
    return (
      <div className="loading-panel">
        <Spin />
      </div>
    )
  }

  return (
    <section className="workspace-section system-monitor-panel">
      <div className="project-log-toolbar system-monitor-toolbar">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>电脑监控</Typography.Title>
          <Typography.Text type="secondary">CPU、内存、存储、网络独立查看历史和详情，按需加入总览。</Typography.Text>
        </Space>
        <Space wrap>
          {statusMeta && snapshot ? (
            <Tag color={statusMeta.color}>
              <Badge status={statusMeta.badgeStatus} text={snapshot.statusMessage} />
            </Tag>
          ) : null}
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回总览
          </Button>
          <Button type="primary" icon={<ReloadOutlined />} loading={refreshing} onClick={() => loadSnapshot('manual')}>
            刷新
          </Button>
        </Space>
      </div>

      {error ? <Alert type="warning" showIcon message="电脑监控暂不可用" description={error} /> : null}

      {snapshot ? (
        <Space direction="vertical" size={16} className="system-monitor-content">
          <div className="system-monitor-meta-row">
            <Typography.Text type="secondary">最后更新：{new Date(snapshot.checkedAt).toLocaleString()}</Typography.Text>
            <Typography.Text type="secondary">主机：{snapshot.system.hostname}</Typography.Text>
            <Typography.Text type="secondary">历史采样：{history.length} 条</Typography.Text>
          </div>

          <div className="system-monitor-hardware-grid">
            {hardwareMetrics.map((metric) => {
              const metricStatusMeta = getSystemMonitorStatusMeta(metric.status)
              const addedToOverview = overviewHardwareKeys.includes(metric.key)

              return (
                <div className={`system-monitor-hardware-card ${activeHardwareKey === metric.key ? 'is-active' : ''}`} key={metric.key}>
                  <button className="system-monitor-hardware-main" type="button" onClick={() => setActiveHardwareKey(metric.key)}>
                    <span className="system-monitor-hardware-heading">
                      <span>
                        {getHardwareIcon(metric.key)}
                        <Typography.Text strong>{metric.label}</Typography.Text>
                      </span>
                      <Tag color={metricStatusMeta.color}>{metricStatusMeta.label}</Tag>
                    </span>
                    <span className="system-monitor-hardware-value">{metric.displayValue}</span>
                    {metric.unit === 'percent' ? <Progress percent={Math.round(metric.value)} size="small" status={metric.status === 'critical' ? 'exception' : metric.status === 'warning' ? 'active' : 'normal'} /> : null}
                    <Typography.Text type="secondary">{metric.detail}</Typography.Text>
                  </button>
                  <div className="system-monitor-hardware-toggle">
                    <Typography.Text type="secondary">加入总览</Typography.Text>
                    <Switch size="small" checked={addedToOverview} onChange={(checked) => toggleOverviewHardware(metric.key, checked)} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="system-monitor-detail-grid">
            <div className="system-monitor-section system-monitor-history-section">
              <div className="system-monitor-section-heading">
                <div>
                  <Typography.Title level={4}>{activeMetric ? `${activeMetric.label} 历史` : '历史数据'}</Typography.Title>
                  <Typography.Text type="secondary">每分钟自动记录一次，展示最近 80 个采样点</Typography.Text>
                </div>
              </div>
              {history.length > 1 ? (
                <ReactECharts className="system-monitor-history-chart" option={historyChartOption} notMerge lazyUpdate />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="历史数据采样中，刷新或保持页面打开会继续记录" />
              )}
            </div>

            <div className="system-monitor-section">
              <div className="system-monitor-section-heading">
                <Typography.Title level={4}>
                  {activeMetric ? (
                    <span className="system-monitor-title-inline">
                      {getHardwareIcon(activeMetric.key)}
                      {activeMetric.label} 详情
                    </span>
                  ) : '硬件详情'}
                </Typography.Title>
                {activeMetric ? <Tag color={getSystemMonitorStatusMeta(activeMetric.status).color}>{activeMetric.description}</Tag> : null}
              </div>
              {renderActiveHardwareDetail()}
            </div>
          </div>

          <div className="system-monitor-detail-grid">
            <div className="system-monitor-section">
              <div className="system-monitor-section-heading">
                <Typography.Title level={4}>基础信息</Typography.Title>
              </div>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="操作系统">{snapshot.system.platform} {snapshot.system.release}</Descriptions.Item>
                <Descriptions.Item label="架构">{snapshot.system.arch}</Descriptions.Item>
                <Descriptions.Item label="CPU">{snapshot.cpu.model}</Descriptions.Item>
                <Descriptions.Item label="核心数">{snapshot.cpu.coreCount} 核 · {snapshot.cpu.speedMhz} MHz</Descriptions.Item>
                <Descriptions.Item label="内存总量">{formatBytes(snapshot.memory.totalBytes)}</Descriptions.Item>
              </Descriptions>
            </div>

            <div className="system-monitor-section">
              <div className="system-monitor-section-heading">
                <Typography.Title level={4}>运行环境</Typography.Title>
              </div>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="ForgeDesk">{snapshot.app.version}</Descriptions.Item>
                <Descriptions.Item label="运行模式">{snapshot.app.isPackaged ? '正式应用' : snapshot.app.isDevServer ? '开发服务' : '开发构建'}</Descriptions.Item>
                <Descriptions.Item label="进程 PID">{snapshot.app.processId}</Descriptions.Item>
                <Descriptions.Item label="Node">{snapshot.app.nodeVersion}</Descriptions.Item>
                <Descriptions.Item label="Electron">{snapshot.app.electronVersion || '-'}</Descriptions.Item>
                <Descriptions.Item label="Chrome">{snapshot.app.chromeVersion || '-'}</Descriptions.Item>
                <Descriptions.Item label="V8">{snapshot.app.v8Version || '-'}</Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无电脑监控信息" />
      )}
    </section>
  )
}
