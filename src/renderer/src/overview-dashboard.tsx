import { Alert, Button, Empty, Progress, Space, Spin, Statistic, Tag, Typography, message } from 'antd'
import { ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, DesktopOutlined, FolderOpenOutlined, GlobalOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SystemMonitorSnapshot } from './data'
import { getTaskStats, readStoredTaskItems, type TaskItem } from './task-list-view'
import { getErrorMessage } from './error-messages'
import {
  createSystemMonitorHardwareMetrics,
  getSystemMonitorStatusMeta,
  readStoredSystemMonitorHistory,
  readStoredSystemMonitorOverviewHardwareKeys,
  rememberSystemMonitorSnapshot,
  systemMonitorOverviewHardwareChangedEvent,
  type SystemMonitorHardwareKey
} from './system-monitor-view'

type OverviewNewsItem = { title: string; summary: string; category: string; source: string; url: string; publishedAt: string; relevance: string }
type OverviewNewsReport = { date: string; headline: string; digest: string; items: OverviewNewsItem[]; generatedAt: string }
type OverviewProjectItem = { projectId: string; projectName: string; status: 'healthy' | 'attention' | 'error' | 'empty'; summary: string; highlights: string[]; repositoryCount: number; changedRepositories: number; aheadRepositories: number; fetchFailures: string[] }
type OverviewProjectReport = { summary: string; projects: OverviewProjectItem[]; generatedAt: string }
type OverviewSnapshot = { newsHistory: OverviewNewsReport[]; projectReport: OverviewProjectReport | null }

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function taskDueLabel(task: TaskItem): string {
  if (!task.dueDate) return '无截止日期'
  return new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function OverviewDashboard({
  onOpenProjects,
  onOpenTasks,
  onOpenSystemMonitor,
  onOpenAiSettings
}: {
  onOpenProjects: () => void
  onOpenTasks: () => void
  onOpenSystemMonitor: () => void
  onOpenAiSettings: () => void
}): JSX.Element {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>({ newsHistory: [], projectReport: null })
  const [tasks, setTasks] = useState<TaskItem[]>(() => readStoredTaskItems())
  const [loadingSnapshot, setLoadingSnapshot] = useState(true)
  const [refreshingNews, setRefreshingNews] = useState(false)
  const [refreshingProjects, setRefreshingProjects] = useState(false)
  const [newsError, setNewsError] = useState('')
  const [projectError, setProjectError] = useState('')
  const [systemSnapshot, setSystemSnapshot] = useState<SystemMonitorSnapshot | null>(null)
  const [systemMonitorError, setSystemMonitorError] = useState('')
  const [systemHistoryCount, setSystemHistoryCount] = useState(() => readStoredSystemMonitorHistory().length)
  const [overviewHardwareKeys, setOverviewHardwareKeys] = useState<SystemMonitorHardwareKey[]>(() => readStoredSystemMonitorOverviewHardwareKeys())
  const autoRefreshStarted = useRef(false)
  const news = snapshot.newsHistory[0] ?? null
  const taskStats = useMemo(() => getTaskStats(tasks), [tasks])
  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== 'done').sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 5), [tasks])
  const taskCompletion = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0
  const systemHardwareMetrics = useMemo(() => (systemSnapshot ? createSystemMonitorHardwareMetrics(systemSnapshot) : []), [systemSnapshot])
  const selectedSystemHardwareMetrics = useMemo(() => systemHardwareMetrics.filter((metric) => overviewHardwareKeys.includes(metric.key)), [overviewHardwareKeys, systemHardwareMetrics])
  const systemStatusMeta = systemSnapshot ? getSystemMonitorStatusMeta(systemSnapshot.status) : null

  async function refreshNews(): Promise<void> {
    if (!window.forgeDesk) return
    setRefreshingNews(true)
    setNewsError('')
    try {
      const report = await window.forgeDesk.refreshOverviewNews()
      setSnapshot((current) => ({ ...current, newsHistory: [report, ...current.newsHistory.filter((item) => item.date !== report.date)] }))
    } catch (error) {
      setNewsError(getErrorMessage(error))
    } finally {
      setRefreshingNews(false)
    }
  }

  async function refreshProjects(): Promise<void> {
    if (!window.forgeDesk) return
    setRefreshingProjects(true)
    setProjectError('')
    try {
      const projectReport = await window.forgeDesk.refreshOverviewProjects()
      setSnapshot((current) => ({ ...current, projectReport }))
    } catch (error) {
      setProjectError(getErrorMessage(error))
    } finally {
      setRefreshingProjects(false)
    }
  }

  useEffect(() => {
    if (!window.forgeDesk) {
      setLoadingSnapshot(false)
      return
    }
    let mounted = true
    window.forgeDesk.getOverviewSnapshot().then((value) => {
      if (!mounted) return
      setSnapshot(value)
      setLoadingSnapshot(false)
      if (autoRefreshStarted.current) return
      autoRefreshStarted.current = true
      const today = new Date().toLocaleDateString('en-CA')
      if (!value.newsHistory.some((item) => item.date === today)) refreshNews().catch(() => undefined)
      refreshProjects().catch(() => undefined)
    }).catch((error) => {
      if (mounted) {
        setLoadingSnapshot(false)
        message.error(getErrorMessage(error))
      }
    })
    const syncTasks = (): void => setTasks(readStoredTaskItems())
    window.addEventListener('storage', syncTasks)
    window.addEventListener('focus', syncTasks)
    return () => {
      mounted = false
      window.removeEventListener('storage', syncTasks)
      window.removeEventListener('focus', syncTasks)
    }
  }, [])

  useEffect(() => {
    const syncOverviewHardware = (): void => {
      setOverviewHardwareKeys(readStoredSystemMonitorOverviewHardwareKeys())
      setSystemHistoryCount(readStoredSystemMonitorHistory().length)
    }

    window.addEventListener(systemMonitorOverviewHardwareChangedEvent, syncOverviewHardware)
    window.addEventListener('storage', syncOverviewHardware)

    return () => {
      window.removeEventListener(systemMonitorOverviewHardwareChangedEvent, syncOverviewHardware)
      window.removeEventListener('storage', syncOverviewHardware)
    }
  }, [])

  useEffect(() => {
    if (!window.forgeDesk) {
      return undefined
    }

    let mounted = true

    async function loadSystemMonitorSnapshot(): Promise<void> {
      try {
        const nextSnapshot = await window.forgeDesk?.getSystemMonitorSnapshot()

        if (!mounted || !nextSnapshot) {
          return
        }

        const nextHistory = rememberSystemMonitorSnapshot(nextSnapshot)
        setSystemSnapshot(nextSnapshot)
        setSystemHistoryCount(nextHistory.length)
        setSystemMonitorError('')
      } catch (error) {
        if (mounted) {
          setSystemMonitorError(getErrorMessage(error))
        }
      }
    }

    loadSystemMonitorSnapshot().catch(() => undefined)
    const intervalId = window.setInterval(() => {
      loadSystemMonitorSnapshot().catch(() => undefined)
    }, 60000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  if (loadingSnapshot) return <div className="loading-panel"><Spin /></div>

  return (
    <section className="workspace-section overview-dashboard">
      <div className="section-heading overview-hero">
        <div>
          <Typography.Text type="secondary">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</Typography.Text>
          <Typography.Title level={2}>早上好，这是今天的总览</Typography.Title>
          <Typography.Text type="secondary">生活、学习、工作和电脑状态分开看，需要关注的内容再放回这里。</Typography.Text>
        </div>
      </div>

      <div className="overview-metrics">
        <div className="overview-metric"><Statistic title="生活待办" value={taskStats.active} suffix={`/ ${taskStats.total}`} /><Progress percent={taskCompletion} size="small" /></div>
        <div className="overview-metric"><Statistic title="学习情报" value={news?.items.length ?? 0} /><Typography.Text type="secondary">{news ? `更新于 ${formatTime(news.generatedAt)}` : '等待首次生成'}</Typography.Text></div>
        <div className="overview-metric"><Statistic title="工作项目" value={snapshot.projectReport?.projects.length ?? 0} /><Typography.Text type="secondary">{refreshingProjects ? '正在自动更新…' : '已完成远端状态检查'}</Typography.Text></div>
        <div className="overview-metric">
          <Statistic
            title="电脑状态"
            value={systemStatusMeta?.label ?? '-'}
            prefix={<DesktopOutlined />}
            valueStyle={{ color: systemSnapshot?.status === 'critical' ? '#cf1322' : systemSnapshot?.status === 'warning' ? '#d48806' : undefined }}
          />
          <Typography.Text type="secondary">{selectedSystemHardwareMetrics.length} 项加入总览 · 历史 {systemHistoryCount} 条</Typography.Text>
        </div>
      </div>

      <div className="overview-grid">
        <article className="overview-card overview-news-card">
          <div className="overview-card-heading"><div><Typography.Title level={4}><GlobalOutlined /> 今日最新新闻</Typography.Title><Typography.Text type="secondary">AI 联网搜索、归类并沉淀近 30 天</Typography.Text></div><Button icon={<ReloadOutlined />} loading={refreshingNews} onClick={refreshNews}>重新搜索</Button></div>
          {newsError ? <Alert type="warning" showIcon message="新闻更新失败" description={newsError} action={<Button size="small" onClick={onOpenAiSettings}>检查 AI 设置</Button>} /> : null}
          {news ? <><div className="overview-digest"><Typography.Title level={5}>{news.headline}</Typography.Title><Typography.Paragraph>{news.digest}</Typography.Paragraph></div><div className="overview-news-list">{news.items.map((item) => <button className="overview-news-item" type="button" key={`${item.url}:${item.title}`} onClick={() => window.forgeDesk?.openExternalUrl(item.url)}><span className="overview-news-meta"><Tag color="blue">{item.category}</Tag><span>{item.source}</span><span>{item.publishedAt}</span></span><Typography.Text strong>{item.title}</Typography.Text><Typography.Text type="secondary">{item.summary}</Typography.Text>{item.relevance ? <span className="overview-relevance">与你相关：{item.relevance}</span> : null}</button>)}</div></> : refreshingNews ? <div className="overview-empty"><Spin /><Typography.Text type="secondary">AI 正在搜索并整理今天的新闻…</Typography.Text></div> : <Empty description="还没有今日新闻"><Button type="primary" onClick={refreshNews}>生成今日情报</Button></Empty>}
        </article>

        <aside className="overview-side-column">
          <article className="overview-card">
            <div className="overview-card-heading"><div><Typography.Title level={4}><FolderOpenOutlined /> 项目自动更新</Typography.Title><Typography.Text type="secondary">Fetch 所有远端后由 AI 汇总</Typography.Text></div><Button type="text" icon={<ReloadOutlined />} loading={refreshingProjects} onClick={refreshProjects} /></div>
            {projectError ? <Alert type="warning" showIcon message="项目更新未完成" description={projectError} action={<Button size="small" onClick={onOpenAiSettings}>AI 设置</Button>} /> : null}
            {snapshot.projectReport ? <><Typography.Paragraph className="overview-project-summary">{snapshot.projectReport.summary}</Typography.Paragraph><div className="overview-project-list">{snapshot.projectReport.projects.map((project) => <div className="overview-project-item" key={project.projectId}><span className={`overview-status overview-status-${project.status}`}>{project.status === 'healthy' ? <CheckCircleOutlined /> : <WarningOutlined />}</span><span><Typography.Text strong>{project.projectName}</Typography.Text><Typography.Text type="secondary">{project.summary}</Typography.Text><span className="overview-project-meta">{project.repositoryCount} 仓库 · {project.changedRepositories} 个未提交 · {project.aheadRepositories} 个待推送</span></span></div>)}</div><Button type="link" onClick={onOpenProjects}>查看所有项目 <ArrowRightOutlined /></Button></> : <div className="overview-empty"><Spin spinning={refreshingProjects} /><Typography.Text type="secondary">正在首次更新所有项目…</Typography.Text></div>}
          </article>

          <article className="overview-card overview-system-monitor-card">
            <div className="overview-card-heading">
              <div>
                <Typography.Title level={4}><DesktopOutlined /> 电脑监控总览</Typography.Title>
                <Typography.Text type="secondary">只显示你添加到总览的硬件项</Typography.Text>
              </div>
              <Button type="link" onClick={onOpenSystemMonitor}>配置 <ArrowRightOutlined /></Button>
            </div>
            {systemMonitorError ? <Alert type="warning" showIcon message="电脑监控暂不可用" description={systemMonitorError} /> : null}
            {!systemSnapshot && !systemMonitorError ? (
              <div className="overview-empty">
                <Spin />
                <Typography.Text type="secondary">正在读取电脑状态…</Typography.Text>
              </div>
            ) : null}
            {systemSnapshot && selectedSystemHardwareMetrics.length > 0 ? (
              <div className="overview-system-monitor-list">
                {selectedSystemHardwareMetrics.map((metric) => {
                  const metricStatusMeta = getSystemMonitorStatusMeta(metric.status)

                  return (
                    <button className="overview-system-monitor-item" type="button" key={metric.key} onClick={onOpenSystemMonitor}>
                      <span className="overview-system-monitor-row">
                        <Typography.Text strong>{metric.label}</Typography.Text>
                        <Tag color={metricStatusMeta.color}>{metricStatusMeta.label}</Tag>
                      </span>
                      <span className="overview-system-monitor-value">{metric.displayValue}</span>
                      {metric.unit === 'percent' ? <Progress percent={Math.round(metric.value)} size="small" status={metric.status === 'critical' ? 'exception' : metric.status === 'warning' ? 'active' : 'normal'} /> : null}
                      <Typography.Text type="secondary">{metric.detail}</Typography.Text>
                    </button>
                  )
                })}
              </div>
            ) : null}
            {systemSnapshot && selectedSystemHardwareMetrics.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有添加到总览的硬件">
                <Button type="primary" onClick={onOpenSystemMonitor}>选择硬件</Button>
              </Empty>
            ) : null}
          </article>

          <article className="overview-card">
            <div className="overview-card-heading"><div><Typography.Title level={4}><CheckCircleOutlined /> 任务总结</Typography.Title><Typography.Text type="secondary">{taskStats.doing} 项进行中，{taskStats.todo} 项待办</Typography.Text></div><Button type="link" onClick={onOpenTasks}>全部任务</Button></div>
            {taskStats.overdue > 0 ? <Alert type="error" showIcon message={`${taskStats.overdue} 项任务已逾期`} /> : null}
            <div className="overview-task-list">{activeTasks.map((task) => <div className="overview-task-item" key={task.id}><span className={`overview-task-priority priority-${task.priority}`} /><span><Typography.Text>{task.title}</Typography.Text><span><ClockCircleOutlined /> {taskDueLabel(task)}</span></span></div>)}</div>
            {activeTasks.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有未完成任务" /> : null}
          </article>
        </aside>
      </div>
    </section>
  )
}
