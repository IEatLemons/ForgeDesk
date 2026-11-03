import { useEffect, useState } from 'react'
import { Alert, Card, Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ServiceMonitorCheck } from './data'
import { useWorkspaceVisible } from './workspace-visibility'

export function OperationsHealthHistory({ projectId, domainIds }: { projectId: string; domainIds: string[] }): JSX.Element {
  const [history, setHistory] = useState<ServiceMonitorCheck[]>([])
  const [error, setError] = useState('')
  const visible = useWorkspaceVisible()
  useEffect(() => {
    if (!visible) return
    let disposed = false
    const read = async () => {
      if (disposed || document.visibilityState === 'hidden') return
      try {
        const rows = await window.forgeDesk.listServiceMonitorHistory(projectId)
        if (!disposed) { setHistory(rows); setError('') }
      } catch (error) { if (!disposed) setError(String(error)) }
    }
    void read()
    const timer = window.setInterval(() => void read(), 60_000)
    const unsubscribe = window.forgeDesk.onProjectOperationsUpdated(id => { if (id === projectId) void read() })
    const changed = () => void read()
    document.addEventListener('visibilitychange', changed)
    return () => { disposed = true; window.clearInterval(timer); unsubscribe(); document.removeEventListener('visibilitychange', changed) }
  }, [projectId, visible])
  const cutoff = Date.now() - 30 * 24 * 60 * 60_000
  const rows = history.filter(row => domainIds.includes(row.domainId) && Date.parse(row.checkedAt) >= cutoff).sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt))
  return <Card title="30 天响应时间">{error ? <Alert showIcon type="warning" message="健康检查历史读取失败" description={error} /> : null}{rows.length ? <ReactECharts option={{ tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: rows.map(row => new Date(row.checkedAt).toLocaleString()) }, yAxis: { type: 'value', name: 'ms' }, series: [{ name: '域名响应时间', type: 'line', connectNulls: false, data: rows.map(row => row.status === 'offline' ? null : row.responseMs) }] }} style={{ height: 260 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无健康检查历史" />}</Card>
}
