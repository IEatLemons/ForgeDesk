import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { serviceHealthIntervalMs, serviceHealthStartupDelayMs, serviceHealthTimeoutMs, type ServiceHealthCheckScope } from '../../shared/service-health'
import type { ProjectService } from './data'
import { getHealthCheckSummary } from './service-health-view'
import { getErrorMessage } from './error-messages'
import { domainHealthStaleMs, isOperationsStale } from '../../shared/project-operations'

export function ServiceHealthControls({ services, scope, onChecked, onConfigure }: {
  services: ProjectService[]
  scope: ServiceHealthCheckScope
  onChecked: (services: ProjectService[]) => void | Promise<void>
  onConfigure?: () => void
}): JSX.Element {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const revision = useRef(0)
  const scopeKey = `${scope.projectId || ''}:${scope.serviceId || ''}:${scope.environmentName || ''}`
  useEffect(() => { setChecking(false); setError(''); setResult(''); return () => { revision.current++ } }, [scopeKey])
  const summary = getHealthCheckSummary(services, scope.environmentName)
  async function check(): Promise<void> {
    if (checking) return
    const request = ++revision.current
    setChecking(true); setError(''); setResult('')
    try {
      const updated = await window.forgeDesk.checkServiceHealth(scope)
      if (request !== revision.current) return
      await onChecked(updated)
      if (request !== revision.current) return
      const next = getHealthCheckSummary(updated, scope.environmentName)
      setResult(`检查完成，当前范围 ${next.checkedCount} / ${next.checkableCount} 个域名已有检查结果。`)
    } catch (error) { if (request === revision.current) setError(getErrorMessage(error)) }
    finally { if (request === revision.current) setChecking(false) }
  }
  return <div className="service-health-controls" aria-label="域名健康检查控制">
    <Space wrap align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
      <Space direction="vertical" size={4}>
        <Typography.Text strong>自动检查：每 {serviceHealthIntervalMs / 60_000} 分钟</Typography.Text>
        <Typography.Text type="secondary">应用运行期间自动巡检，启动约 {serviceHealthStartupDelayMs / 1000} 秒后首次检查；每个域名最长等待 {serviceHealthTimeoutMs / 1000} 秒。</Typography.Text>
        <Typography.Text type={summary.lastCheckedAt && isOperationsStale(summary.lastCheckedAt, Date.now(), domainHealthStaleMs) ? 'warning' : undefined}>上次检查：{summary.lastCheckedAt ? new Date(summary.lastCheckedAt).toLocaleString() : '尚未检查'}{summary.lastCheckedAt && isOperationsStale(summary.lastCheckedAt, Date.now(), domainHealthStaleMs) ? '（已过期）' : ''}{summary.checkableCount ? ` · ${summary.checkedCount} / ${summary.checkableCount} 个域名已有结果` : ''}</Typography.Text>
        <Typography.Text type="secondary">时间为当前范围最近一次检查；各域名时间见下表。平台同步与域名健康检查分别执行。</Typography.Text>
      </Space>
      <Space wrap><Button type="primary" icon={<ReloadOutlined />} loading={checking} disabled={!summary.checkableCount} onClick={() => void check()}>{checking ? '检查中' : '立即检查'}</Button>{!summary.checkableCount && onConfigure ? <Button onClick={onConfigure}>配置监控</Button> : null}</Space>
    </Space>
    {!summary.checkableCount ? <Typography.Text type="secondary">当前范围没有启用的可监控域名。</Typography.Text> : null}
    {error ? <Alert type="error" showIcon message="健康检查未完成，保留上次结果" description={error} /> : null}
    {result ? <Typography.Text role="status">{result}</Typography.Text> : null}
  </div>
}
