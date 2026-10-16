import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Drawer, Empty, Space, Tag, Typography, message } from 'antd'
import type { ProjectDeploymentTarget } from './data'
import type { ProjectRuntimeLog, ProjectRuntimeSnapshot } from '../../shared/project-runtime'

export function ProjectRuntimePanel({ projectId, visible, onConfigure }: { projectId: string; visible: boolean; onConfigure: () => void }): JSX.Element {
  const [targets, setTargets] = useState<ProjectDeploymentTarget[]>([])
  const [snapshots, setSnapshots] = useState<ProjectRuntimeSnapshot[]>([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [log, setLog] = useState<ProjectRuntimeLog | null>(null)
  const [documentVisible, setDocumentVisible] = useState(()=>document.visibilityState!=='hidden')
  const revision=useRef(0)
  useEffect(()=>{const changed=()=>setDocumentVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed)},[])
  useEffect(() => {
    revision.current++
    if (!visible || !documentVisible) return
    let disposed = false, checking = false
    setTargets([]); setSnapshots([]); setError('')
    async function load(check: boolean) {
      if (checking) return
      checking = true; setBusy(true)
      try {
        const [all, cached] = await Promise.all([window.forgeDesk.listProjectDeploymentTargets(projectId), window.forgeDesk.readProjectRuntime(projectId)])
        if (disposed) return
        const own = all.filter(target => ['ssh-pm2', 'docker-compose'].includes(target.provider))
        setTargets(own); setSnapshots(cached); setError('')
        if (check) {
          const updated = await Promise.all(own.filter(target => target.config.extra.runtimeMonitoring === 'true').map(target => window.forgeDesk.refreshProjectRuntime({ projectId, targetId: target.id })))
          if (!disposed) setSnapshots(cached.map(value => updated.find(item => item.targetId === value.targetId) ?? value))
        }
      } catch (error) { if (!disposed) setError(error instanceof Error ? error.message : String(error)) }
      finally { checking = false; if (!disposed) setBusy(false) }
    }
    void load(true)
    const timer = setInterval(() => void load(true), 30_000)
    return () => { disposed = true; clearInterval(timer) }
  }, [projectId, visible, documentVisible])
  async function refresh() {
    const current=revision.current
    setBusy(true)
    try { await Promise.all(targets.filter(target => target.config.extra.runtimeMonitoring === 'true').map(target => window.forgeDesk.refreshProjectRuntime({ projectId, targetId: target.id }))); const next=await window.forgeDesk.readProjectRuntime(projectId);if(current===revision.current){setSnapshots(next);setError('')} }
    catch (error) { if(current===revision.current)setError(String(error)) } finally { if(current===revision.current)setBusy(false) }
  }
  return <Card title="自有服务器 · 只读运行状态" extra={<Space><Button onClick={onConfigure}>目标与监控配置</Button><Button loading={busy} onClick={() => void refresh()}>刷新</Button></Space>}>
    <Typography.Paragraph type="secondary">PM2 进程与 Compose 容器的当前状态，不是上一次部署结果。仅在本页可见时检查。</Typography.Paragraph>
    {error ? <Alert type="error" showIcon message="运行检查读取失败" description={error} /> : null}
    {!targets.length ? <Empty description="未配置自有服务器部署目标"><Button onClick={onConfigure}>配置 SSH / PM2 或远程 Compose</Button></Empty> : targets.map(target => {
      const snapshot = snapshots.find(item => item.targetId === target.id)
      const stale = !snapshot?.checkedAt || Date.now() - Date.parse(snapshot.checkedAt) > 90_000
      const labels = { running: '进程／容器运行中', stopped: '已停止', degraded: '健康检查异常', unknown: '未知' }
      return <Card size="small" key={target.id} title={target.displayName || target.config.appName || target.config.composeService} style={{ marginTop: 12 }}><Space wrap><Tag>{target.provider}</Tag><Tag color={!snapshot?.error && !stale && snapshot?.state === 'running' ? 'green' : 'default'}>{labels[snapshot?.state ?? 'unknown']}</Tag>{stale ? <Tag color="warning">未检查／已过期</Tag> : null}<Typography.Text type="secondary">检查时间：{snapshot?.checkedAt ? new Date(snapshot.checkedAt).toLocaleString() : '尚未检查'}</Typography.Text><Tag>健康：{({ healthy: '通过', unhealthy: '失败', unknown: '未知', 'not-configured': '未配置' })[snapshot?.health ?? 'unknown']}</Tag></Space>{snapshot?.error ? <Alert type={snapshot.enabled ? 'warning' : 'info'} message={snapshot.error} style={{ marginTop: 8 }} /> : null}<ul>{snapshot?.units.map(unit => <li key={unit.id}>{unit.name} · {unit.detail}</li>)}</ul><Button disabled={!snapshot?.enabled} onClick={() => void window.forgeDesk.readProjectRuntimeLogs({ projectId, targetId: target.id }).then(setLog).catch(error => message.error(String(error)))}>读取最近日志（最多 200 行）</Button></Card>
    })}
    <Drawer open={!!log} onClose={() => setLog(null)} title="目标最近日志" width="min(850px, 100vw)"><Alert showIcon type="info" message="日志已限制大小并过滤常见凭据字段；不会返回进程环境变量。" /><Typography.Text type="secondary">{log?.checkedAt}{log?.truncated ? ' · 仅最近片段' : ''}</Typography.Text><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{log?.text || '暂无日志'}</pre></Drawer>
  </Card>
}
