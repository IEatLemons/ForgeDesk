import { FolderOpenOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Drawer, Empty, List, Space, Spin, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { CodexProjectMonitorItem, CodexProjectMonitorSnapshot, CodexSessionDetail, CodexSessionSummary, CodexTaskMonitorSummary, CodexTaskRecord, CodexWorktree, Project } from './data'
import { getErrorMessage } from './error-messages'

type WorkActivity = {
  id: string
  source: 'session' | 'task'
  title: string
  sourceStatus: CodexSessionSummary['status'] | CodexTaskMonitorSummary['status']
  updatedAt: string
  branch: string
  worktree: CodexWorktree | null
  filesChanged: number
  errorMessage: string
}

type WorkActivityStatus = 'running' | 'ready-to-commit' | 'completed' | 'attention' | 'queued'

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function activityStatus(activity: WorkActivity): WorkActivityStatus {
  if (activity.sourceStatus === 'running') return 'running'
  if (activity.sourceStatus === 'aborted' || activity.sourceStatus === 'failed' || activity.sourceStatus === 'cancelled') return 'attention'
  if (activity.sourceStatus === 'idle') return 'queued'
  if (activity.worktree?.git.hasChanges || activity.filesChanged > 0) return 'ready-to-commit'
  return 'completed'
}

function activityStatusTag(activity: WorkActivity): JSX.Element {
  const status = activityStatus(activity)
  const meta: Record<WorkActivityStatus, { label: string; color: string }> = {
    running: { label: '正在执行', color: 'processing' },
    'ready-to-commit': { label: '待提交', color: 'gold' },
    completed: { label: '已完成', color: 'green' },
    attention: { label: activity.sourceStatus === 'cancelled' ? '已取消' : '需处理', color: 'orange' },
    queued: { label: '待处理', color: 'default' }
  }
  return <Tag color={meta[status].color}>{meta[status].label}</Tag>
}

function findWorktree(item: CodexProjectMonitorItem, cwd: string): CodexWorktree | null {
  return item.worktrees.find((worktree) => cwd === worktree.path || cwd.startsWith(`${worktree.path}/`)) ?? null
}

function buildActivities(item: CodexProjectMonitorItem, sessionsById: Map<string, CodexSessionSummary>): WorkActivity[] {
  const activities: WorkActivity[] = []
  const sessionIds = [...item.regularSessionIds, ...item.worktrees.flatMap((worktree) => worktree.sessionIds)]

  for (const sessionId of sessionIds) {
    const session = sessionsById.get(sessionId)
    if (!session) continue
    const worktree = findWorktree(item, session.cwd)
    activities.push({ id: session.id, source: 'session', title: session.title || '未命名 Codex 会话', sourceStatus: session.status, updatedAt: session.updatedAt, branch: worktree?.branch || '', worktree, filesChanged: 0, errorMessage: '' })
  }

  for (const task of item.tasks) {
    const worktree = findWorktree(item, task.cwd)
    activities.push({ id: task.id, source: 'task', title: task.title || '未命名 ForgeDesk 任务', sourceStatus: task.status, updatedAt: task.updatedAt, branch: task.branch || worktree?.branch || '', worktree, filesChanged: task.filesChanged, errorMessage: task.errorMessage })
  }

  const priority: Record<WorkActivityStatus, number> = { running: 0, attention: 1, 'ready-to-commit': 2, queued: 3, completed: 4 }
  return activities.sort((left, right) => priority[activityStatus(left)] - priority[activityStatus(right)] || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function CodexWorkPanel({ project, onOpenBinding }: { project: Project; onOpenBinding: () => void }): JSX.Element {
  const [snapshot, setSnapshot] = useState<CodexProjectMonitorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<CodexSessionDetail | null>(null)
  const [selectedTask, setSelectedTask] = useState<CodexTaskRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function refresh(): Promise<void> {
    if (!window.forgeDesk) return
    setLoading(true)
    try {
      setSnapshot(await window.forgeDesk.getCodexProjectMonitorSnapshot())
    } catch (error) {
      message.error(`读取 Codex 工作失败：${getErrorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15_000)
    return () => window.clearInterval(timer)
  }, [project.id])

  useEffect(() => {
    if (!window.forgeDesk) return undefined
    return window.forgeDesk.onCodexProjectMonitorUpdated((nextSnapshot) => setSnapshot(nextSnapshot))
  }, [])

  const items = useMemo(() => (snapshot?.projects ?? []).filter((item) => item.forgeProjectId === project.id), [project.id, snapshot])
  const sessionsById = useMemo(() => new Map((snapshot?.sessions ?? []).map((session) => [session.id, session])), [snapshot])
  const activitiesByProject = useMemo(() => new Map(items.map((item) => [item.key, buildActivities(item, sessionsById)])), [items, sessionsById])
  const running = items.reduce((total, item) => total + item.runningCount, 0)
  const completed = items.reduce((total, item) => total + item.completedCount, 0)
  const failed = items.reduce((total, item) => total + item.failedCount, 0)
  const changes = items.reduce((total, item) => total + item.worktrees.filter((worktree) => worktree.git.hasChanges).length, 0)

  async function openActivity(activity: WorkActivity): Promise<void> {
    if (!window.forgeDesk) return
    setDetailLoading(true)
    try {
      if (activity.source === 'session') {
        setSelectedTask(null)
        setSelectedSession(await window.forgeDesk.getCodexSession(activity.id))
      } else {
        const task = (await window.forgeDesk.listCodexTasks()).find((item) => item.id === activity.id) ?? null
        setSelectedSession(null)
        setSelectedTask(task)
        if (!task) message.warning('该 ForgeDesk Codex 任务已不存在')
      }
    } catch (error) {
      message.error(`读取 Codex 任务失败：${getErrorMessage(error)}`)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetails = (): void => { setSelectedSession(null); setSelectedTask(null) }

  return <div className="codex-work-panel">
    <div className="codex-work-toolbar">
      <div><Typography.Title level={4}>Codex 工作</Typography.Title><Typography.Text type="secondary">当前项目任务 · 最近同步 {snapshot ? formatTime(snapshot.checkedAt) : '—'}</Typography.Text></div>
      <Space size={8}><Button icon={<LinkOutlined />} onClick={onOpenBinding}>管理绑定</Button><Button icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>刷新</Button></Space>
    </div>
    <div className="codex-work-summary" aria-label="Codex 工作汇总">
      <span><b>{items.length}</b> 绑定项目</span><span><b>{running}</b> 正在执行</span><span><b>{completed}</b> 已完成</span><span><b>{failed}</b> 需处理</span><span><b>{changes}</b> 工作树待提交</span>
    </div>
    {loading && !snapshot ? <Spin /> : items.length ? <div className="codex-work-project-list">{items.map((item) => {
      const activities = activitiesByProject.get(item.key) ?? []
      const projectName = item.cwd.split(/[\\/]/).filter(Boolean).pop() || item.cwd
      return <section className="codex-work-project" key={item.key}>
        <header className="codex-work-project-heading"><Space size={8}><FolderOpenOutlined /><Typography.Text strong>{projectName}</Typography.Text><Typography.Text className="codex-work-project-path" type="secondary" ellipsis={{ tooltip: item.cwd }}>{item.cwd}</Typography.Text></Space><Space size={4}>{item.runningCount ? <Tag color="processing">{item.runningCount} 进行中</Tag> : null}<Tag>{activities.length} 个任务</Tag></Space></header>
        <List className="codex-work-task-list" size="small" dataSource={activities} locale={{ emptyText: <Typography.Text type="secondary">暂无任务</Typography.Text> }} renderItem={(activity) => <List.Item actions={[<Button key="detail" size="small" type="text" onClick={() => void openActivity(activity)}>详情</Button>]}><div className="codex-work-task-row"><div className="codex-work-task-main"><Typography.Text strong ellipsis={{ tooltip: activity.title }}>{activity.title}</Typography.Text><Typography.Text type="secondary">{formatTime(activity.updatedAt)}{activity.branch ? ` · ${activity.branch}` : ''}{activity.worktree?.git.hasChanges ? ` · ${activity.worktree.git.filesChanged} 个文件待提交` : ''}</Typography.Text>{activity.errorMessage ? <Typography.Text type="danger" ellipsis={{ tooltip: activity.errorMessage }}>{activity.errorMessage}</Typography.Text> : null}</div>{activityStatusTag(activity)}</div></List.Item>} />
      </section>
    })}</div> : <Empty description="当前 ForgeDesk 项目还没有绑定 Codex 项目" image={Empty.PRESENTED_IMAGE_SIMPLE}><Button type="primary" icon={<LinkOutlined />} onClick={onOpenBinding}>绑定 Codex 项目</Button></Empty>}
    <Drawer title={selectedSession?.title || selectedTask?.title || 'Codex 任务详情'} width={720} open={Boolean(selectedSession) || Boolean(selectedTask) || detailLoading} onClose={closeDetails}>
      {detailLoading ? <Spin /> : selectedSession ? <List size="small" dataSource={selectedSession.items} renderItem={(item) => <List.Item><Space direction="vertical" size={0}><Typography.Text strong>{item.kind === 'user' ? '用户请求' : item.kind === 'assistant' ? 'Codex 回复' : item.eventType || '执行事件'}</Typography.Text><Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{item.text || item.input || item.output || '—'}</Typography.Text><Typography.Text type="secondary">{formatTime(item.timestamp)}</Typography.Text></Space></List.Item>} /> : selectedTask ? <Space direction="vertical" style={{ width: '100%' }}><Space wrap>{activityStatusTag({ id: selectedTask.id, source: 'task', title: selectedTask.title, sourceStatus: selectedTask.status, updatedAt: selectedTask.updatedAt, branch: selectedTask.branch, worktree: null, filesChanged: selectedTask.filesChanged, errorMessage: selectedTask.errorMessage })}<Typography.Text type="secondary">{selectedTask.branch || '非 Git 目录'} · {formatTime(selectedTask.updatedAt)}</Typography.Text></Space>{selectedTask.messages.length ? <List size="small" dataSource={selectedTask.messages} renderItem={(item) => <List.Item><Space direction="vertical" size={0}><Typography.Text strong>{item.role === 'user' ? '用户请求' : item.role === 'assistant' ? 'Codex 回复' : item.eventType || '执行事件'}</Typography.Text><Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{item.content || '—'}</Typography.Text><Typography.Text type="secondary">{formatTime(item.createdAt)}</Typography.Text></Space></List.Item>} /> : <Empty description="暂无任务消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />}{selectedTask.runLog ? <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{selectedTask.runLog}</Typography.Paragraph> : null}</Space> : null}
    </Drawer>
  </div>
}
