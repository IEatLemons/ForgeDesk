import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  RobotOutlined,
  SyncOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { Button, Empty, Progress, Select, Space, Spin, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import type { CodexConversationItem, CodexProjectMonitorItem, CodexProjectMonitorSnapshot, CodexProjectRecord, CodexSessionDetail, CodexSessionSummary, CodexSessionsSnapshot, CodexTokenUsage, Project } from './data'

type CodexProjectGroup = {
  project: CodexProjectRecord
  sessions: CodexSessionSummary[]
}

type MonitorTone = 'running' | 'attention' | 'ready' | 'idle'

type CodexProjectMonitorProps = {
  snapshot: CodexSessionsSnapshot
  monitorSnapshot: CodexProjectMonitorSnapshot | null
  forgeProjects: Project[]
  projectGroups: CodexProjectGroup[]
  selectedProjectKey: string
  selectedSummary: CodexSessionSummary | null
  selectedDetail: CodexSessionDetail | null
  loading: boolean
  loadingDetail: boolean
  refreshing: boolean
  onSelectProject: (projectKey: string) => void
  onSelectSession: (sessionId: string) => void
  onRefresh: () => void
  onOpenConversation: () => void
  onLinkCodexProject: (cwd: string, projectId: string | null) => Promise<void>
  onOpenForgeProject?: (projectId: string) => void
}

function toneMeta(tone: MonitorTone): { label: string; color: string; icon: JSX.Element } {
  if (tone === 'running') return { label: '进行中', color: 'blue', icon: <SyncOutlined spin /> }
  if (tone === 'attention') return { label: '需关注', color: 'orange', icon: <WarningOutlined /> }
  if (tone === 'ready') return { label: '已完成', color: 'green', icon: <CheckCircleOutlined /> }
  return { label: '空闲', color: 'default', icon: <ClockCircleOutlined /> }
}

function projectTone(group: CodexProjectGroup): MonitorTone {
  if (group.project.runningCount > 0) return 'running'
  if (group.sessions.some((session) => session.status === 'aborted')) return 'attention'
  if (group.sessions.some((session) => session.status === 'completed')) return 'ready'
  return 'idle'
}

function formatUpdatedAt(value: string): string {
  if (!value) return '尚未更新'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '尚未更新' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatClock(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '—'
  const totalSeconds = Math.round(milliseconds / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function formatTokenCount(value: number): string {
  return value > 0 ? value.toLocaleString('en-US') : '未记录'
}

function timelineLabel(item: CodexConversationItem): string {
  if (item.kind === 'user') return '用户请求'
  if (item.kind === 'assistant') return 'Codex 回复'
  if (item.kind === 'tool-call') return `开始 ${item.toolName || '工具调用'}`
  if (item.kind === 'tool-output') return `完成 ${item.toolName || '工具调用'}`
  if (item.eventType === 'token_count') return 'Token 统计'
  const labels: Record<string, string> = {
    context_compacted: '上下文压缩',
    item_completed: '步骤完成',
    patch_apply_end: '补丁处理完成',
    task_complete: '任务完成',
    task_started: '任务开始',
    turn_aborted: '回合中止',
    web_search_end: '网络搜索完成'
  }
  return labels[item.eventType] || item.eventType || '运行事件'
}

function timelineDetail(item: CodexConversationItem): string {
  if (item.eventType === 'token_count' && item.usage) {
    return `本次 ${formatTokenCount(item.usage.totalTokens)} tokens · 输入 ${formatTokenCount(item.usage.inputTokens)} · 输出 ${formatTokenCount(item.usage.outputTokens)}`
  }
  const content = item.kind === 'tool-call' ? item.input : item.kind === 'tool-output' ? item.output : item.text
  const firstLine = content.trim().split(/\r?\n/)[0]?.trim() || ''
  if (!firstLine) return item.toolName || item.eventType || '无附加信息'
  return firstLine.length > 150 ? `${firstLine.slice(0, 149)}…` : firstLine
}

const sessionStatusLabels: Record<CodexSessionSummary['status'], string> = {
  aborted: '已中止',
  completed: '已完成',
  idle: '空闲',
  running: '进行中'
}

function itemTone(item: CodexConversationItem): string {
  if (item.kind === 'user') return 'user'
  if (item.kind === 'assistant') return 'assistant'
  if (item.kind === 'tool-call' || item.kind === 'tool-output') return 'tool'
  return 'status'
}

type CommunicationAnalysis = {
  items: CodexConversationItem[]
  userText: string
  start: string
  end: string
  durationMilliseconds: number
  firstResponseMilliseconds: number
  toolCalls: number
  toolNames: string[]
  logicSteps: string[]
  usage: CodexTokenUsage | null
}

function logicLabel(item: CodexConversationItem): string {
  if (item.kind === 'user') return '用户请求'
  if (item.kind === 'assistant') return 'Codex 回复'
  if (item.kind === 'tool-call') return `调用 ${item.toolName || '工具'}`
  if (item.kind === 'tool-output') return `${item.toolName || '工具'} 返回`
  if (item.eventType === 'token_count') return 'Token 统计'
  return timelineLabel(item)
}

function buildCommunicationAnalyses(items: CodexConversationItem[]): CommunicationAnalysis[] {
  const sortedItems = [...items].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
  const blocks: CodexConversationItem[][] = []
  let current: CodexConversationItem[] = []

  for (const item of sortedItems) {
    if (item.kind === 'user' && current.some((currentItem) => currentItem.kind === 'user')) {
      blocks.push(current)
      current = []
    }
    current.push(item)
  }
  if (current.length > 0) blocks.push(current)

  return blocks.map((block) => {
    const firstUser = block.find((item) => item.kind === 'user')
    const firstAssistant = block.find((item) => item.kind === 'assistant')
    const start = block[0]?.timestamp || ''
    const end = block[block.length - 1]?.timestamp || ''
    const startTimestamp = new Date(start).getTime()
    const endTimestamp = new Date(end).getTime()
    const toolNames = [...new Set(block.filter((item) => item.kind === 'tool-call' && item.toolName).map((item) => item.toolName))]
    const logicSteps = block.map(logicLabel).filter((label, index, values) => index === 0 || label !== values[index - 1])

    return {
      items: block,
      userText: firstUser?.text || '任务初始化 / 系统事件',
      start,
      end,
      durationMilliseconds: Number.isFinite(startTimestamp) && Number.isFinite(endTimestamp) ? Math.max(0, endTimestamp - startTimestamp) : 0,
      firstResponseMilliseconds: firstUser && firstAssistant ? Math.max(0, new Date(firstAssistant.timestamp).getTime() - new Date(firstUser.timestamp).getTime()) : 0,
      toolCalls: block.filter((item) => item.kind === 'tool-call').length,
      toolNames,
      logicSteps,
      usage: [...block].reverse().find((item) => item.usage)?.usage ?? null
    }
  })
}

export function CodexProjectMonitor({
  forgeProjects,
  monitorSnapshot,
  snapshot,
  projectGroups,
  selectedProjectKey,
  selectedSummary,
  selectedDetail,
  loading,
  loadingDetail,
  refreshing,
  onSelectProject,
  onSelectSession,
  onRefresh,
  onOpenConversation,
  onLinkCodexProject,
  onOpenForgeProject
}: CodexProjectMonitorProps): JSX.Element {
  const [monitorView, setMonitorView] = useState<'overview' | 'detail'>('overview')
  const [collapsedMonitorGroups, setCollapsedMonitorGroups] = useState<Set<string>>(new Set())
  const selectedGroup = projectGroups.find((group) => group.project.key === selectedProjectKey) ?? projectGroups[0] ?? null
  const monitorProjects = monitorSnapshot?.projects ?? []
  const selectedMonitorProject = monitorProjects.find((project) => project.key === selectedProjectKey) ?? null
  const monitorGroups = useMemo(() => {
    const groups = new Map<string, CodexProjectMonitorItem[]>()
    for (const project of monitorProjects) {
      const key = project.forgeProjectId ? '__bound__' : '__unlinked__'
      groups.set(key, [...(groups.get(key) ?? []), project])
    }
    return Array.from(groups.entries()).sort((left, right) => {
      if (left[0] === '__bound__') return -1
      if (right[0] === '__bound__') return 1
      if (left[0] === '__unlinked__') return 1
      if (right[0] === '__unlinked__') return -1
      return 0
    })
  }, [monitorProjects])
  const selectedTone = selectedGroup ? toneMeta(projectTone(selectedGroup)) : toneMeta('idle')
  const runningSessions = useMemo(() => snapshot.sessions.filter((session) => session.status === 'running').sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5), [snapshot.sessions])
  const attentionSessions = useMemo(() => snapshot.sessions.filter((session) => session.status === 'aborted').sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5), [snapshot.sessions])
  const completionRate = snapshot.sessions.length > 0 ? Math.round((snapshot.completed / snapshot.sessions.length) * 100) : 0
  const communications = useMemo(() => buildCommunicationAnalyses(selectedDetail?.items ?? []), [selectedDetail?.items])
  const taskAnalysis = useMemo(() => {
    const items = [...(selectedDetail?.items ?? [])].filter((item) => Number.isFinite(new Date(item.timestamp).getTime())).sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    const start = items[0]?.timestamp || selectedDetail?.createdAt || selectedSummary?.createdAt || ''
    const end = items[items.length - 1]?.timestamp || selectedDetail?.updatedAt || selectedSummary?.updatedAt || ''
    const startTimestamp = new Date(start).getTime()
    const endTimestamp = new Date(end).getTime()
    const firstUser = items.find((item) => item.kind === 'user')
    const firstAssistant = items.find((item) => item.kind === 'assistant')
    const firstResponseMilliseconds = firstUser && firstAssistant
      ? Math.max(0, new Date(firstAssistant.timestamp).getTime() - new Date(firstUser.timestamp).getTime())
      : 0
    const communicationDurations = communications.map((communication) => communication.durationMilliseconds).filter((duration) => duration > 0)
    const firstResponseDurations = communications.map((communication) => communication.firstResponseMilliseconds).filter((duration) => duration > 0)

    return {
      items: items.slice(-14),
      start,
      end,
      durationMilliseconds: Number.isFinite(startTimestamp) && Number.isFinite(endTimestamp) ? Math.max(0, endTimestamp - startTimestamp) : 0,
      firstResponseMilliseconds,
      averageCommunicationMilliseconds: communicationDurations.length > 0
        ? Math.round(communicationDurations.reduce((total, duration) => total + duration, 0) / communicationDurations.length)
        : 0,
      averageFirstResponseMilliseconds: firstResponseDurations.length > 0
        ? Math.round(firstResponseDurations.reduce((total, duration) => total + duration, 0) / firstResponseDurations.length)
        : 0,
      toolCalls: items.filter((item) => item.kind === 'tool-call').length,
      toolOutputs: items.filter((item) => item.kind === 'tool-output').length,
      assistantMessages: items.filter((item) => item.kind === 'assistant').length,
      statusEvents: items.filter((item) => item.kind === 'status' && item.eventType !== 'token_count').length,
      communicationCount: communications.length,
      usage: [...items].reverse().find((item) => item.usage)?.usage ?? null
    }
  }, [communications, selectedDetail, selectedSummary])

  function openProjectDetail(projectKey: string): void {
    onSelectProject(projectKey)
    setMonitorView('detail')
  }

  function openSessionDetail(session: CodexSessionSummary): void {
    onSelectProject(session.projectKey)
    onSelectSession(session.id)
    setMonitorView('detail')
  }

  function toggleMonitorGroup(groupKey: string): void {
    setCollapsedMonitorGroups((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  function renderMonitorProjectCard(project: CodexProjectMonitorItem): JSX.Element {
    const tone: MonitorTone = project.status === 'running' ? 'running' : project.status === 'attention' ? 'attention' : project.status === 'completed' ? 'ready' : 'idle'
    const meta = toneMeta(tone)
    const displayName = project.forgeProjectName || project.sessions[0]?.projectName || project.cwd.split(/[\\/]/).filter(Boolean).pop() || '未记录项目'
    const linkValue = project.linkSource === 'unlinked' ? '__unlinked__' : project.forgeProjectId || undefined

    return (
      <div className={`codex-monitor-project-card is-${tone}`} key={project.key} role="button" tabIndex={0} onClick={() => openProjectDetail(project.key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProjectDetail(project.key) } }}>
        <div className="codex-monitor-project-card-heading">
          <span className="codex-monitor-project-title"><span className="codex-monitor-project-icon"><FolderOpenOutlined /></span>{displayName}</span>
          <Tag color={project.openAlert ? 'orange' : meta.color} icon={project.openAlert ? <WarningOutlined /> : meta.icon}>{project.openAlert ? '未提交' : meta.label}</Tag>
        </div>
        <div className="codex-monitor-project-path" title={project.cwd}>{project.cwd || '未记录工作目录'}</div>
        <div className="codex-monitor-project-stats">
          <span><strong>{project.sessionCount}</strong> 会话</span>
          <span><strong>{project.worktrees.length}</strong> 工作树</span>
          <span><strong>{project.tasks.length}</strong> 内置任务</span>
          <span><strong>{project.runningCount}</strong> 进行中</span>
        </div>
        <div className="codex-monitor-project-monitor-meta">
          <span>{project.git.repositoryAvailable ? `${project.git.branch || 'detached'} · ${project.git.filesChanged} 个改动文件` : 'Git 状态无法检查'}</span>
          {project.openAlert ? <span className="is-alert">+{project.git.additions} -{project.git.deletions}</span> : null}
        </div>
        <div className="codex-monitor-project-link" onClick={(event) => event.stopPropagation()}>
          <Typography.Text type="secondary">ForgeDesk 项目</Typography.Text>
          <Select
            allowClear={false}
            options={[{ label: '未关联项目', value: '__unlinked__' }, ...forgeProjects.map((item) => ({ label: item.name, value: item.id }))]}
            size="small"
            value={linkValue}
            onChange={(value: string) => onLinkCodexProject(project.cwd, value === '__unlinked__' ? null : value).catch(() => undefined)}
          />
          {project.forgeProjectId && onOpenForgeProject ? <Button size="small" type="link" onClick={() => onOpenForgeProject(project.forgeProjectId as string)}>打开项目</Button> : null}
        </div>
        <div className="codex-monitor-project-action">查看项目 <ArrowRightOutlined /></div>
      </div>
    )
  }

  return (
    <main className="codex-monitor-main">
      <header className="codex-monitor-header">
        <div>
          <Typography.Text className="codex-monitor-eyebrow">CODEX / PROJECT MONITOR</Typography.Text>
          <Typography.Title level={2}>{monitorView === 'overview' ? '项目监控' : '项目详情'}</Typography.Title>
          <Typography.Text type="secondary">{monitorView === 'overview' ? '先看全部项目运行状态，点击项目后查看具体会话。' : '查看项目内的每个会话，以及每次沟通的执行和消耗。'}</Typography.Text>
        </div>
        <Space wrap>
          {monitorView === 'detail' ? <Button icon={<ArrowLeftOutlined />} onClick={() => setMonitorView('overview')}>返回总览</Button> : null}
          <Button icon={<SyncOutlined />} loading={refreshing} onClick={onRefresh}>刷新状态</Button>
          <Button type="primary" icon={<RobotOutlined />} onClick={onOpenConversation}>对话模式</Button>
        </Space>
      </header>

      {snapshot.error ? <div className="codex-monitor-alert"><ExclamationCircleOutlined /> {snapshot.error}</div> : null}

      <section className={`codex-monitor-hero is-${selectedTone.color}`}>
        <div className="codex-monitor-hero-status">
          <span className="codex-monitor-hero-icon">{monitorView === 'overview' ? <FolderOpenOutlined /> : selectedTone.icon}</span>
          <div>
            <Typography.Text type="secondary">{monitorView === 'overview' ? '监控范围' : '当前项目'}</Typography.Text>
            <Typography.Title level={3}>{monitorView === 'overview' ? '全部 Codex 项目' : selectedGroup?.project.name || '等待读取 Codex 项目'}</Typography.Title>
            <Typography.Text type="secondary" title={selectedGroup?.project.cwd}>{monitorView === 'overview' ? `${monitorSnapshot?.projects.length ?? snapshot.projects.length} 个项目 · ${snapshot.sessions.length} 个会话` : selectedGroup?.project.cwd || '尚未读取到本机会话目录'}</Typography.Text>
          </div>
        </div>
        <div className="codex-monitor-hero-meta">
          {monitorView === 'overview' ? <Tag color="blue" icon={<SyncOutlined />}>实时监控</Tag> : <Tag color={selectedTone.color} icon={selectedTone.icon}>{selectedTone.label}</Tag>}
          <Typography.Text type="secondary">更新于 {formatUpdatedAt(monitorView === 'overview' ? snapshot.checkedAt : selectedGroup?.project.updatedAt || snapshot.checkedAt)}</Typography.Text>
        </div>
      </section>

      {monitorView === 'overview' ? (
        <section className="codex-monitor-metrics">
          <div className="codex-monitor-metric"><span>项目</span><strong>{monitorSnapshot?.projects.length ?? snapshot.projects.length}</strong><small>已接入 Codex</small></div>
          <div className="codex-monitor-metric is-running"><span>进行中</span><strong>{monitorSnapshot?.running ?? snapshot.running}</strong><small>正在执行的会话/任务</small></div>
          <div className="codex-monitor-metric is-completed"><span>未提交</span><strong>{monitorSnapshot?.uncommitted ?? 0}</strong><small>执行结束后仍有改动</small></div>
          <div className="codex-monitor-metric is-attention"><span>未关联</span><strong>{monitorSnapshot?.unlinked ?? 0}</strong><small>等待绑定 ForgeDesk 项目</small></div>
        </section>
      ) : null}

      {monitorView === 'detail' && selectedSummary ? (
        <section className="codex-monitor-task-detail">
          <div className="codex-monitor-section-heading codex-monitor-task-heading">
            <div>
              <Typography.Title level={4}><ToolOutlined /> 任务执行详情</Typography.Title>
              <Typography.Text type="secondary" title={selectedSummary.title}>{selectedSummary.title}</Typography.Text>
            </div>
            <Space wrap>
              <Tag color={selectedSummary.status === 'running' ? 'processing' : selectedSummary.status === 'aborted' ? 'orange' : selectedSummary.status === 'completed' ? 'green' : undefined}>{sessionStatusLabels[selectedSummary.status]}</Tag>
              <Button size="small" icon={<RobotOutlined />} onClick={onOpenConversation}>打开完整对话</Button>
            </Space>
          </div>

          {loadingDetail ? (
            <div className="codex-monitor-task-loading"><Spin size="small" /><Typography.Text type="secondary">正在读取任务执行过程…</Typography.Text></div>
          ) : (
            <>
              <div className="codex-monitor-task-metrics">
                <div><span>总耗时</span><strong>{formatDuration(taskAnalysis.durationMilliseconds)}</strong><small>{formatClock(taskAnalysis.start)} – {formatClock(taskAnalysis.end)}</small></div>
                <div><span>平均沟通耗时</span><strong>{formatDuration(taskAnalysis.averageCommunicationMilliseconds)}</strong><small>按 {taskAnalysis.communicationCount} 轮沟通计算</small></div>
                <div><span>平均首次响应</span><strong>{formatDuration(taskAnalysis.averageFirstResponseMilliseconds)}</strong><small>每轮用户请求 → Codex 回复</small></div>
                <div><span>会话 Token</span><strong>{formatTokenCount(taskAnalysis.usage?.cumulativeTotalTokens || taskAnalysis.usage?.totalTokens || 0)}</strong><small>最近一次输入 {formatTokenCount(taskAnalysis.usage?.inputTokens ?? 0)} · 输出 {formatTokenCount(taskAnalysis.usage?.outputTokens ?? 0)}</small></div>
                <div><span>沟通次数</span><strong>{taskAnalysis.communicationCount}</strong><small>{taskAnalysis.assistantMessages} 次 Codex 回复</small></div>
                <div><span>工具调用</span><strong>{taskAnalysis.toolCalls}</strong><small>{taskAnalysis.statusEvents} 条状态事件</small></div>
              </div>
              <div className="codex-monitor-task-meta">
                <span><ClockCircleOutlined /> 开始于 {formatUpdatedAt(taskAnalysis.start || selectedSummary.createdAt)}</span>
                <span><SyncOutlined /> 最近更新 {formatUpdatedAt(selectedSummary.updatedAt)}</span>
                <span>最后事件：{selectedSummary.lastEvent || '未记录'}</span>
              </div>
              {selectedGroup && selectedGroup.sessions.length > 0 ? (
                <div className="codex-monitor-task-picker">
                  <div className="codex-monitor-task-picker-heading">
                    <div>
                      <Typography.Text strong>当前项目会话</Typography.Text>
                      <Typography.Text type="secondary">选择一个会话查看对应的沟通与耗时</Typography.Text>
                    </div>
                    <Tag>{selectedGroup.sessions.length} 个会话</Tag>
                  </div>
                  <div className="codex-monitor-task-picker-list">
                    {selectedGroup.sessions.map((session) => (
                      <button className={`codex-monitor-task-picker-item${session.id === selectedSummary.id ? ' is-selected' : ''}`} type="button" key={session.id} onClick={() => onSelectSession(session.id)}>
                        <span className={`codex-monitor-task-picker-dot is-${session.status}`} />
                        <span className="codex-monitor-task-picker-title">{session.title}</span>
                        <Tag color={session.status === 'running' ? 'processing' : session.status === 'aborted' ? 'orange' : session.status === 'completed' ? 'green' : undefined}>{sessionStatusLabels[session.status]}</Tag>
                        <Typography.Text type="secondary">{formatUpdatedAt(session.updatedAt)}</Typography.Text>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {communications.length > 0 ? (
                <div className="codex-monitor-communications">
                  <div className="codex-monitor-timeline-heading codex-monitor-communications-heading">
                    <div>
                      <Typography.Text strong>逐次沟通分析</Typography.Text>
                      <Typography.Text type="secondary">按用户请求分组，展开单轮查看 Token、时间和调用逻辑</Typography.Text>
                    </div>
                    <span className="codex-monitor-communications-summary">{communications.length} 轮 · 平均 {formatDuration(taskAnalysis.averageCommunicationMilliseconds)}</span>
                  </div>
                  <div className="codex-monitor-communication-list">
                    {communications.map((communication, index) => (
                      <details className="codex-monitor-communication" key={`${communication.start}:${index}`} open={index === communications.length - 1}>
                        <summary>
                          <span className="codex-monitor-communication-index">#{index + 1}</span>
                          <span className="codex-monitor-communication-title">{communication.userText}</span>
                          <span className="codex-monitor-communication-summary"><span>{formatDuration(communication.durationMilliseconds)}</span><span>{formatTokenCount(communication.usage?.totalTokens ?? 0)} tokens</span><span>{communication.toolCalls} 次调用</span></span>
                        </summary>
                        <div className="codex-monitor-communication-body">
                          <div className="codex-monitor-communication-metrics">
                            <div><span>时间</span><strong>{formatDuration(communication.durationMilliseconds)}</strong><small>{formatClock(communication.start)} – {formatClock(communication.end)}</small></div>
                            <div><span>首次响应</span><strong>{formatDuration(communication.firstResponseMilliseconds)}</strong><small>用户请求 → Codex 回复</small></div>
                            <div><span>Token</span><strong>{formatTokenCount(communication.usage?.totalTokens ?? 0)}</strong><small>输入 {formatTokenCount(communication.usage?.inputTokens ?? 0)} · 输出 {formatTokenCount(communication.usage?.outputTokens ?? 0)}</small></div>
                            <div><span>缓存输入</span><strong>{formatTokenCount(communication.usage?.cachedInputTokens ?? 0)}</strong><small>推理输出 {formatTokenCount(communication.usage?.reasoningOutputTokens ?? 0)}</small></div>
                          </div>
                          <div className="codex-monitor-communication-logic"><strong>调用逻辑</strong><span>{communication.logicSteps.join(' → ') || '未记录调用过程'}</span></div>
                          <div className="codex-monitor-communication-meta"><span>工具：{communication.toolNames.length > 0 ? communication.toolNames.join('、') : '未调用工具'}</span><span>过程事件：{communication.items.length} 条</span><span>结束于：{formatClock(communication.end)}</span></div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ) : null}
              {taskAnalysis.items.length > 0 ? (
                <details className="codex-monitor-timeline">
                  <summary className="codex-monitor-timeline-summary">
                    <span>最近执行过程</span>
                    <span>显示最近 {taskAnalysis.items.length} 条事件</span>
                  </summary>
                  <div className="codex-monitor-timeline-list">
                    {taskAnalysis.items.map((item) => (
                      <div className={`codex-monitor-timeline-item is-${itemTone(item)}`} key={item.id}>
                        <span className="codex-monitor-timeline-track"><span className="codex-monitor-timeline-dot" /></span>
                        <Typography.Text type="secondary" className="codex-monitor-timeline-time">{formatClock(item.timestamp)}</Typography.Text>
                        <div className="codex-monitor-timeline-content"><strong>{timelineLabel(item)}</strong><span>{timelineDetail(item)}</span></div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : (
                <div className="codex-monitor-task-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个任务暂时没有可显示的执行事件" /></div>
              )}
            </>
          )}
        </section>
      ) : null}
      {monitorView === 'detail' && !selectedSummary && selectedMonitorProject ? (
        <section className="codex-monitor-task-detail">
          <div className="codex-monitor-section-heading codex-monitor-task-heading">
            <div><Typography.Title level={4}><ToolOutlined /> 项目执行结果</Typography.Title><Typography.Text type="secondary" title={selectedMonitorProject.cwd}>{selectedMonitorProject.forgeProjectName || selectedMonitorProject.cwd}</Typography.Text></div>
            <Tag color={selectedMonitorProject.openAlert ? 'orange' : selectedMonitorProject.status === 'running' ? 'processing' : undefined}>{selectedMonitorProject.openAlert ? '未提交' : selectedMonitorProject.status}</Tag>
          </div>
          <div className="codex-monitor-task-meta">
            <span>工作目录：{selectedMonitorProject.cwd}</span>
            <span>分支：{selectedMonitorProject.git.branch || '无法检查'}</span>
            <span>工作树：{selectedMonitorProject.worktrees.length} 个 · 常规任务：{selectedMonitorProject.regularSessionIds.length} 个会话</span>
            <span>改动：{selectedMonitorProject.git.filesChanged} 个文件 · +{selectedMonitorProject.git.additions} -{selectedMonitorProject.git.deletions}</span>
          </div>
          {selectedMonitorProject.tasks.length > 0 ? (
            <div className="codex-monitor-task-picker-list">
              {selectedMonitorProject.tasks.map((task) => <div className="codex-monitor-task-picker-item" key={task.id}><span className={`codex-monitor-task-picker-dot is-${task.status === 'running' ? 'running' : task.status === 'succeeded' ? 'completed' : task.status === 'failed' || task.status === 'cancelled' ? 'aborted' : 'idle'}`} /><span className="codex-monitor-task-picker-title">{task.title}</span><Tag>{task.status}</Tag><Typography.Text type="secondary">{formatUpdatedAt(task.updatedAt)}</Typography.Text></div>)}
            </div>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个项目还没有内置 Codex 任务" />}
        </section>
      ) : monitorView === 'detail' && !selectedSummary ? <div className="codex-monitor-empty panel"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个项目还没有可分析的 Codex 会话" /></div> : null}

      {loading && projectGroups.length === 0 ? (
        <div className="codex-monitor-loading"><Spin /><Typography.Text type="secondary">正在读取 Codex 项目状态…</Typography.Text></div>
      ) : projectGroups.length === 0 ? (
        <div className="codex-monitor-empty panel"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={snapshot.available ? '还没有可监控的 Codex 项目' : '尚未读取到本机 Codex 会话'} /><Button type="primary" icon={<RobotOutlined />} onClick={onOpenConversation}>打开对话模式</Button></div>
      ) : (
        monitorView === 'overview' ? <div className="codex-monitor-layout">
          <section className="codex-monitor-project-section">
            <div className="codex-monitor-section-heading">
              <div><Typography.Title level={4}>项目状态</Typography.Title><Typography.Text type="secondary">点击项目查看它的会话运行概况</Typography.Text></div>
              <Typography.Text type="secondary">{projectGroups.length} 个项目</Typography.Text>
            </div>
            {monitorSnapshot ? monitorGroups.map(([groupKey, groupProjects]) => (
              <section className="codex-monitor-project-group" key={groupKey}>
                <div className="codex-monitor-section-heading">
                  <div><Typography.Title level={4}>{groupKey === '__unlinked__' ? '未关联项目' : '已绑定 ForgeDesk 项目'}</Typography.Title><Typography.Text type="secondary">{groupKey === '__unlinked__' ? '尚未绑定 ForgeDesk 项目 · ' : '可直接打开对应项目的 Codex 工作页 · '}{groupProjects.length} 个 Codex 项目</Typography.Text></div>
                  <Button
                    aria-label={collapsedMonitorGroups.has(groupKey) ? '展开分组' : '折叠分组'}
                    icon={collapsedMonitorGroups.has(groupKey) ? <ArrowRightOutlined /> : <DownOutlined />}
                    onClick={() => toggleMonitorGroup(groupKey)}
                    size="small"
                    type="text"
                  />
                  <Tag>{groupProjects.filter((project) => Boolean(project.openAlert)).length} 个待处理</Tag>
                </div>
                {!collapsedMonitorGroups.has(groupKey) ? <div className="codex-monitor-project-grid">
                  {groupProjects.map((project) => renderMonitorProjectCard(project))}
                </div> : null}
              </section>
            )) : <div className="codex-monitor-project-grid">
              {projectGroups.map((group) => {
                const tone = projectTone(group)
                const meta = toneMeta(tone)
                const completedCount = group.sessions.filter((session) => session.status === 'completed').length
                const attentionCount = group.sessions.filter((session) => session.status === 'aborted').length
                const progress = group.sessions.length > 0 ? Math.round((completedCount / group.sessions.length) * 100) : 0

                return (
                  <button className={`codex-monitor-project-card is-${tone}`} type="button" key={group.project.key} onClick={() => openProjectDetail(group.project.key)}>
                    <span className="codex-monitor-project-card-heading">
                      <span className="codex-monitor-project-title"><span className="codex-monitor-project-icon"><FolderOpenOutlined /></span>{group.project.name}</span>
                      <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>
                    </span>
                    <span className="codex-monitor-project-path">{group.project.cwd || '未记录工作目录'}</span>
                    <span className="codex-monitor-project-stats"><span><strong>{group.sessions.length}</strong> 会话</span><span><strong>{group.project.runningCount}</strong> 进行中</span><span><strong>{attentionCount}</strong> 需关注</span></span>
                    <span className="codex-monitor-project-progress"><Progress percent={progress} showInfo={false} size="small" status={attentionCount > 0 ? 'exception' : 'normal'} /><small>{completedCount} 个已完成 · 最近 {formatUpdatedAt(group.project.updatedAt)}</small></span>
                    <span className="codex-monitor-project-action">查看项目 <ArrowRightOutlined /></span>
                  </button>
                )
              })}
            </div>}
          </section>

          <aside className="codex-monitor-side">
            <section className="codex-monitor-side-card">
              <div className="codex-monitor-section-heading"><div><Typography.Title level={4}><SyncOutlined /> 当前执行</Typography.Title><Typography.Text type="secondary">正在运行的 Codex 会话</Typography.Text></div><Tag color="blue">{runningSessions.length}</Tag></div>
              {runningSessions.length > 0 ? <div className="codex-monitor-session-list">{runningSessions.map((session) => <button className={`codex-monitor-session-row${session.id === selectedSummary?.id ? ' is-selected' : ''}`} type="button" key={session.id} onClick={() => openSessionDetail(session)}><span className="codex-monitor-session-dot is-running" /><span><strong>{session.title}</strong><small>{session.projectName} · {formatUpdatedAt(session.updatedAt)}</small></span></button>)}</div> : <div className="codex-monitor-side-empty"><CheckCircleOutlined /><Typography.Text>当前没有正在执行的会话</Typography.Text></div>}
            </section>

            <section className="codex-monitor-side-card">
              <div className="codex-monitor-section-heading"><div><Typography.Title level={4}><ExclamationCircleOutlined /> 最近需关注</Typography.Title><Typography.Text type="secondary">中止或异常的会话</Typography.Text></div><Tag color={attentionSessions.length > 0 ? 'orange' : 'default'}>{attentionSessions.length}</Tag></div>
              {attentionSessions.length > 0 ? <div className="codex-monitor-session-list">{attentionSessions.map((session) => <button className={`codex-monitor-session-row${session.id === selectedSummary?.id ? ' is-selected' : ''}`} type="button" key={session.id} onClick={() => openSessionDetail(session)}><span className="codex-monitor-session-dot is-attention" /><span><strong>{session.title}</strong><small>{session.projectName} · {formatUpdatedAt(session.updatedAt)}</small></span></button>)}</div> : <div className="codex-monitor-side-empty"><CheckCircleOutlined /><Typography.Text>最近没有异常会话</Typography.Text></div>}
            </section>

            <section className="codex-monitor-side-card codex-monitor-progress-card">
              <div className="codex-monitor-section-heading"><div><Typography.Title level={4}><CheckCircleOutlined /> 完成情况</Typography.Title><Typography.Text type="secondary">当前读取到的全部会话</Typography.Text></div><strong>{completionRate}%</strong></div>
              <Progress percent={completionRate} showInfo={false} />
              <Typography.Text type="secondary">{snapshot.completed} 已完成 · {snapshot.sessions.length - snapshot.completed} 待处理</Typography.Text>
            </section>
          </aside>
        </div> : null
      )}
    </main>
  )
}

export type { CodexProjectGroup }
