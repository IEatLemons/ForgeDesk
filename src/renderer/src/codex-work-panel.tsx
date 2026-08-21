import { CheckCircleOutlined, ClockCircleOutlined, FolderOpenOutlined, LinkOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Card, Drawer, Empty, List, Space, Spin, Statistic, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { CodexProjectMonitorItem, CodexProjectMonitorSnapshot, CodexSessionDetail, CodexSessionSummary, CodexTaskMonitorSummary, CodexTaskRecord, Project } from './data'
import { getErrorMessage } from './error-messages'

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString('zh-CN')
}

function statusTag(status: CodexSessionSummary['status']): JSX.Element {
  if (status === 'running') return <Tag color="processing">进行中</Tag>
  if (status === 'completed') return <Tag color="green">已完成</Tag>
  if (status === 'aborted') return <Tag color="orange">已中止</Tag>
  return <Tag>空闲</Tag>
}

function taskStatusTag(status: CodexTaskMonitorSummary['status']): JSX.Element {
  if (status === 'running') return <Tag color="processing">进行中</Tag>
  if (status === 'succeeded') return <Tag color="green">已完成</Tag>
  if (status === 'failed' || status === 'cancelled') return <Tag color="orange">{status === 'failed' ? '失败' : '已取消'}</Tag>
  return <Tag>待处理</Tag>
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
  const running = items.reduce((total, item) => total + item.runningCount, 0)
  const completed = items.reduce((total, item) => total + item.completedCount, 0)
  const failed = items.reduce((total, item) => total + item.failedCount, 0)
  const changes = items.reduce((total, item) => total + item.worktrees.filter((worktree) => worktree.git.hasChanges).length, 0)

  async function openSession(sessionId: string): Promise<void> {
    if (!window.forgeDesk) return
    setDetailLoading(true)
    try {
      setSelectedTask(null)
      setSelectedSession(await window.forgeDesk.getCodexSession(sessionId))
    } catch (error) {
      message.error(`读取 Codex 会话失败：${getErrorMessage(error)}`)
    } finally {
      setDetailLoading(false)
    }
  }

  async function openTask(taskId: string): Promise<void> {
    if (!window.forgeDesk) return
    setDetailLoading(true)
    try {
      const task = (await window.forgeDesk.listCodexTasks()).find((item) => item.id === taskId) ?? null
      setSelectedSession(null)
      setSelectedTask(task)
      if (!task) message.warning('该 ForgeDesk Codex 任务已不存在')
    } catch (error) {
      message.error(`读取 Codex 任务失败：${getErrorMessage(error)}`)
    } finally {
      setDetailLoading(false)
    }
  }

  function sessionRows(sessionIds: string[]): JSX.Element | null {
    const sessions = sessionIds.map((id) => sessionsById.get(id)).filter((session): session is CodexSessionSummary => Boolean(session))
    if (!sessions.length) return null
    return <List size="small" dataSource={sessions} renderItem={(session) => <List.Item actions={[<Button key="open" size="small" onClick={() => void openSession(session.id)}>详情</Button>]}><Space direction="vertical" size={0}><Space wrap><Typography.Text strong>{session.title}</Typography.Text>{statusTag(session.status)}</Space><Typography.Text type="secondary">{formatTime(session.updatedAt)} · {session.preview || '暂无预览'}</Typography.Text></Space></List.Item>} />
  }

  function builtInTaskRows(item: CodexProjectMonitorItem, taskIds: string[]): JSX.Element | null {
    const tasks = item.tasks.filter((task) => taskIds.includes(task.id))
    if (!tasks.length) return null
    return <List size="small" dataSource={tasks} renderItem={(task) => <List.Item actions={[<Button key="open" size="small" onClick={() => void openTask(task.id)}>详情</Button>]}><Space direction="vertical" size={0}><Space wrap><Typography.Text strong>{task.title}</Typography.Text>{taskStatusTag(task.status)}</Space><Typography.Text type="secondary">{formatTime(task.updatedAt)} · {task.branch || '非 Git 目录'} · {task.filesChanged} 个文件，+{task.additions} / -{task.deletions}</Typography.Text>{task.errorMessage ? <Typography.Text type="danger">{task.errorMessage}</Typography.Text> : null}</Space></List.Item>} />
  }

  function activityRows(item: CodexProjectMonitorItem, sessionIds: string[], taskIds: string[]): JSX.Element {
    const sessionList = sessionRows(sessionIds)
    const taskList = builtInTaskRows(item, taskIds)
    return sessionList || taskList ? <>{sessionList}{taskList}</> : <Typography.Text type="secondary">暂无任务</Typography.Text>
  }

  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <div className="panel-title"><div><Typography.Title level={4}>Codex 工作</Typography.Title><Typography.Text type="secondary">项目、工作树和普通 Codex 任务会在此统一显示。</Typography.Text></div><Space><Button icon={<LinkOutlined />} onClick={onOpenBinding}>管理绑定</Button><Button icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>刷新</Button></Space></div>
    <Space wrap><Card size="small"><Statistic title="绑定项目" value={items.length} prefix={<FolderOpenOutlined />} /></Card><Card size="small"><Statistic title="进行中" value={running} prefix={<ClockCircleOutlined />} /></Card><Card size="small"><Statistic title="已完成" value={completed} prefix={<CheckCircleOutlined />} /></Card><Card size="small"><Statistic title="中止/异常" value={failed} prefix={<WarningOutlined />} /></Card><Card size="small"><Statistic title="未提交改动" value={changes} suffix="工作树" /></Card><Card size="small"><Statistic title="最近同步" value={snapshot ? formatTime(snapshot.checkedAt) : '—'} /></Card></Space>
    {loading && !snapshot ? <Spin /> : items.length ? items.map((item) => <Card key={item.key} title={<Space><FolderOpenOutlined />{item.cwd.split(/[\\/]/).filter(Boolean).pop() || item.cwd}</Space>} extra={<Space>{item.runningCount ? <Tag color="processing">{item.runningCount} 进行中</Tag> : null}<Tag>{item.sessionCount} 个会话</Tag></Space>}><Typography.Text type="secondary">{item.cwd}</Typography.Text><Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>{item.worktrees.map((worktree) => <Card key={worktree.path} size="small" type="inner" title={`${worktree.isMain ? '主检出' : '工作树'} · ${worktree.detached ? 'detached HEAD' : worktree.branch || '分支未知'}`} extra={worktree.git.hasChanges ? <Tag color="orange">{worktree.git.filesChanged} 个文件有改动</Tag> : <Tag color="green">工作区干净</Tag>}><Typography.Text type="secondary">{worktree.path} · {worktree.head ? worktree.head.slice(0, 12) : 'HEAD 未知'}</Typography.Text>{activityRows(item, worktree.sessionIds, worktree.taskIds)}</Card>)}<Card size="small" type="inner" title="常规任务"><Typography.Text type="secondary">未在工作树中运行的原生 Codex 会话和 ForgeDesk 任务</Typography.Text>{activityRows(item, item.regularSessionIds, item.regularTaskIds)}</Card></Space></Card>) : <Empty description="当前 ForgeDesk 项目还没有绑定 Codex 项目" image={Empty.PRESENTED_IMAGE_SIMPLE}><Button type="primary" icon={<LinkOutlined />} onClick={onOpenBinding}>绑定 Codex 项目</Button></Empty>}
    <Drawer title={selectedSession?.title || selectedTask?.title || 'Codex 任务详情'} width={720} open={Boolean(selectedSession) || Boolean(selectedTask) || detailLoading} onClose={() => { setSelectedSession(null); setSelectedTask(null) }}>{detailLoading ? <Spin /> : selectedSession ? <List size="small" dataSource={selectedSession.items} renderItem={(item) => <List.Item><Space direction="vertical" size={0}><Typography.Text strong>{item.kind === 'user' ? '用户请求' : item.kind === 'assistant' ? 'Codex 回复' : item.eventType || '执行事件'}</Typography.Text><Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{item.text || item.input || item.output || '—'}</Typography.Text><Typography.Text type="secondary">{formatTime(item.timestamp)}</Typography.Text></Space></List.Item>} /> : selectedTask ? <Space direction="vertical" style={{ width: '100%' }}><Space wrap>{taskStatusTag(selectedTask.status)}<Typography.Text type="secondary">{selectedTask.branch || '非 Git 目录'} · {formatTime(selectedTask.updatedAt)}</Typography.Text></Space>{selectedTask.messages.length ? <List size="small" dataSource={selectedTask.messages} renderItem={(item) => <List.Item><Space direction="vertical" size={0}><Typography.Text strong>{item.role === 'user' ? '用户请求' : item.role === 'assistant' ? 'Codex 回复' : item.eventType || '执行事件'}</Typography.Text><Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{item.content || '—'}</Typography.Text><Typography.Text type="secondary">{formatTime(item.createdAt)}</Typography.Text></Space></List.Item>} /> : <Empty description="暂无任务消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />}{selectedTask.runLog ? <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{selectedTask.runLog}</Typography.Paragraph> : null}</Space> : null}</Drawer>
  </Space>
}
