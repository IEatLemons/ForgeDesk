import { Alert, Button, Descriptions, Empty, Space, Spin, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import type { SystemMonitorSnapshot } from './data'
import { getErrorMessage } from './error-messages'
import { ModuleBackButton } from './module-navigation'
import { formatDurationSeconds, formatMemoryBytes } from './system-monitor-view'

export function SystemInfoPanel({ onBack }: { onBack: () => void }): JSX.Element {
  const [snapshot, setSnapshot] = useState<SystemMonitorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  async function loadSnapshot(initial = false): Promise<void> {
    if (!window.forgeDesk) {
      setError('当前环境无法读取系统信息')
      setLoading(false)
      return
    }

    initial ? setLoading(true) : setRefreshing(true)

    try {
      const nextSnapshot = await window.forgeDesk.getSystemMonitorSnapshot()

      if (mountedRef.current) {
        setSnapshot(nextSnapshot)
        setError('')
      }
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
    loadSnapshot(true).catch(() => undefined)

    return () => {
      mountedRef.current = false
    }
  }, [])

  if (loading && !snapshot) {
    return <div className="loading-panel"><Spin /></div>
  }

  return (
    <section className="workspace-section system-monitor-panel">
      <div className="module-back-row">
        <ModuleBackButton label="返回总览" onClick={onBack} />
      </div>
      <div className="project-log-toolbar system-monitor-toolbar">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>系统信息</Typography.Title>
          <Typography.Text type="secondary">查看电脑基础配置与 ForgeDesk 运行环境。</Typography.Text>
        </Space>
        <Space>
          <Button type="primary" icon={<ReloadOutlined />} loading={refreshing} onClick={() => loadSnapshot(false)}>刷新</Button>
        </Space>
      </div>

      {error ? <Alert type="warning" showIcon message="系统信息暂不可用" description={error} /> : null}

      {snapshot ? (
        <Space direction="vertical" size={16} className="system-monitor-content">
          <div className="system-monitor-meta-row">
            <Typography.Text type="secondary">最后更新：{new Date(snapshot.checkedAt).toLocaleString()}</Typography.Text>
            <Typography.Text type="secondary">主机：{snapshot.system.hostname}</Typography.Text>
          </div>
          <div className="system-monitor-detail-grid">
            <div className="system-monitor-section">
              <div className="system-monitor-section-heading"><Typography.Title level={4}>基础信息</Typography.Title></div>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="操作系统">{snapshot.system.platform} {snapshot.system.release}</Descriptions.Item>
                <Descriptions.Item label="架构">{snapshot.system.arch}</Descriptions.Item>
                <Descriptions.Item label="CPU">{snapshot.cpu.model}</Descriptions.Item>
                <Descriptions.Item label="核心数">{snapshot.cpu.coreCount} 核 · {snapshot.cpu.speedMhz} MHz</Descriptions.Item>
                <Descriptions.Item label="物理内存">{formatMemoryBytes(snapshot.memory.totalBytes)}</Descriptions.Item>
                <Descriptions.Item label="系统运行">{formatDurationSeconds(snapshot.system.uptimeSeconds)}</Descriptions.Item>
              </Descriptions>
            </div>
            <div className="system-monitor-section">
              <div className="system-monitor-section-heading"><Typography.Title level={4}>运行环境</Typography.Title></div>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="ForgeDesk">{snapshot.app.version}</Descriptions.Item>
                <Descriptions.Item label="运行模式">{snapshot.app.isPackaged ? '正式应用' : snapshot.app.isDevServer ? '开发服务' : '开发构建'}</Descriptions.Item>
                <Descriptions.Item label="进程 PID">{snapshot.app.processId}</Descriptions.Item>
                <Descriptions.Item label="进程运行">{formatDurationSeconds(snapshot.app.uptimeSeconds)}</Descriptions.Item>
                <Descriptions.Item label="Node">{snapshot.app.nodeVersion}</Descriptions.Item>
                <Descriptions.Item label="Electron">{snapshot.app.electronVersion || '-'}</Descriptions.Item>
                <Descriptions.Item label="Chrome">{snapshot.app.chromeVersion || '-'}</Descriptions.Item>
                <Descriptions.Item label="V8">{snapshot.app.v8Version || '-'}</Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Space>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无系统信息" />}
    </section>
  )
}
