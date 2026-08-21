import {
  AudioOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  DashboardOutlined,
  FileImageOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  HistoryOutlined,
  MessageOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import { Badge, Button, Empty, Input, Layout, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd'
import type { ClipboardEvent as ReactClipboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CodexConversationItem, CodexProjectMonitorSnapshot, CodexSessionDetail, CodexSessionEvent, CodexSessionSummary, CodexSessionsSnapshot, CodexUncommittedAlert } from './data'
import { CodexProjectMonitor, type CodexProjectGroup } from './codex-project-monitor'
import { CodexSitesPanel } from './codex-sites-panel'
import { getErrorMessage } from './error-messages'
import { ModuleBackButton } from './module-navigation'
import { useForgeDeskStore } from './store'

type CodexSessionManagerPanelProps = {
  onBack: () => void
  usesCustomTitleBar: boolean
  onOpenForgeProject?: (projectId: string) => void
  focusAlert?: CodexUncommittedAlert | null
}

const statusLabels: Record<CodexSessionSummary['status'], string> = {
  aborted: '已中止',
  completed: '已完成',
  idle: '空闲',
  running: '进行中'
}

const eventLabels: Record<string, string> = {
  context_compacted: '上下文已压缩',
  item_completed: '步骤完成',
  patch_apply_end: '补丁处理完成',
  task_complete: '任务完成',
  task_started: '任务开始',
  turn_aborted: '回合已中止',
  web_search_end: '网络搜索完成'
}

function emptySnapshot(): CodexSessionsSnapshot {
  return {
    aborted: 0,
    available: false,
    checkedAt: '',
    completed: 0,
    error: '',
    projects: [],
    running: 0,
    sessions: [],
    source: ''
  }
}

function snapshotFromMonitor(snapshot: CodexProjectMonitorSnapshot): CodexSessionsSnapshot {
  return {
    aborted: snapshot.projects.reduce((total, project) => total + project.sessions.filter((session) => session.status === 'aborted').length, 0),
    available: snapshot.available,
    checkedAt: snapshot.checkedAt,
    completed: snapshot.projects.reduce((total, project) => total + project.sessions.filter((session) => session.status === 'completed').length, 0),
    error: snapshot.error,
    projects: snapshot.projects.map((project) => {
      const updatedAt = [...project.sessions.map((session) => session.updatedAt), ...project.tasks.map((task) => task.updatedAt)].sort().at(-1) || snapshot.checkedAt
      return {
        cwd: project.cwd,
        key: project.key,
        name: project.sessions[0]?.projectName || project.cwd.split(/[\\/]/).filter(Boolean).pop() || '未记录项目',
        runningCount: project.runningCount,
        sessionCount: project.sessionCount,
        updatedAt
      }
    }),
    running: snapshot.running,
    sessions: snapshot.sessions,
    source: snapshot.source
  }
}

function statusTone(status: CodexSessionSummary['status']): 'default' | 'processing' | 'success' | 'error' | 'warning' {
  if (status === 'running') return 'processing'
  if (status === 'completed') return 'success'
  if (status === 'aborted') return 'warning'
  return 'default'
}

function formatDateTime(value: string): string {
  if (!value) return '未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString()
}

function formatRelativeTime(value: string): string {
  if (!value) return '未知时间'
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return '未知时间'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function shortenPath(value: string, maxLength = 58): string {
  if (value.length <= maxLength) return value
  return `…${value.slice(-(maxLength - 1))}`
}

function itemLabel(item: CodexConversationItem): string {
  if (item.kind === 'tool-call') return item.toolName || '工具调用'
  if (item.kind === 'tool-output') return item.toolName ? `${item.toolName} 输出` : '工具输出'
  return eventLabels[item.eventType] || item.eventType || '运行事件'
}

function sortSessions(sessions: CodexSessionSummary[]): CodexSessionSummary[] {
  return [...sessions].sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt.localeCompare(left.updatedAt))
}

function updateSessionSnapshot(snapshot: CodexSessionsSnapshot, session: CodexSessionSummary): CodexSessionsSnapshot {
  const sessions = snapshot.sessions.some((item) => item.id === session.id)
    ? sortSessions(snapshot.sessions.map((item) => item.id === session.id ? session : item))
    : sortSessions([session, ...snapshot.sessions])
  const projects = snapshot.projects.map((project) => project.key === session.projectKey
    ? {
        ...project,
        runningCount: sessions.filter((item) => item.projectKey === project.key && item.status === 'running').length,
        sessionCount: sessions.filter((item) => item.projectKey === project.key).length,
        updatedAt: session.updatedAt > project.updatedAt ? session.updatedAt : project.updatedAt
      }
    : project)
  return { ...snapshot, sessions, projects }
}

type ConversationBlock =
  | { kind: 'message'; item: CodexConversationItem }
  | { kind: 'activity'; items: CodexConversationItem[] }

function appendConversationItem(items: CodexConversationItem[], item: CodexConversationItem): CodexConversationItem[] {
  if (items.some((currentItem) => currentItem.id === item.id)) return items

  const optimisticMessageIndex = items.findIndex((currentItem) =>
    (item.kind === 'user' || item.kind === 'assistant') &&
    currentItem.id.startsWith('optimistic:') &&
    currentItem.kind === item.kind &&
    currentItem.text === item.text
  )
  if (optimisticMessageIndex < 0) return [...items, item]
  return items.map((currentItem, index) => index === optimisticMessageIndex ? item : currentItem)
}

function groupConversationItems(items: CodexConversationItem[]): ConversationBlock[] {
  const blocks: ConversationBlock[] = []
  let activityItems: CodexConversationItem[] = []

  const flushActivity = (): void => {
    if (activityItems.length > 0) blocks.push({ kind: 'activity', items: activityItems })
    activityItems = []
  }

  for (const item of items) {
    if (item.kind === 'user' || item.kind === 'assistant') {
      flushActivity()
      blocks.push({ kind: 'message', item })
    } else {
      activityItems.push(item)
    }
  }
  flushActivity()
  return blocks
}

function renderInlineMarkdown(text: string): JSX.Element[] {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={`${part}:${index}`}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${part}:${index}`}>{part.slice(2, -2)}</strong>
    return <span key={`${part}:${index}`}>{part}</span>
  })
}

function ConversationRichText({ text }: { text: string }): JSX.Element {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: JSX.Element[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? ''
    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      blocks.push(<h4 key={`heading:${index}`}>{renderInlineMarkdown(heading[1])}</h4>)
      index += 1
      continue
    }

    const unordered = line.match(/^\s*[-*•]\s+(.+)$/)
    if (unordered) {
      const items: string[] = []
      while (index < lines.length) {
        const match = lines[index]?.match(/^\s*[-*•]\s+(.+)$/)
        if (!match) break
        items.push(match[1])
        index += 1
      }
      blocks.push(<ul key={`unordered:${index}`}>{items.map((item, itemIndex) => <li key={`${item}:${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}</ul>)
      continue
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (ordered) {
      const items: string[] = []
      while (index < lines.length) {
        const match = lines[index]?.match(/^\s*\d+[.)]\s+(.+)$/)
        if (!match) break
        items.push(match[1])
        index += 1
      }
      blocks.push(<ol key={`ordered:${index}`}>{items.map((item, itemIndex) => <li key={`${item}:${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}</ol>)
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index]?.trim() && !/^\s*[-*•]\s+/.test(lines[index] ?? '') && !/^\s*\d+[.)]\s+/.test(lines[index] ?? '') && !/^#{1,3}\s+/.test(lines[index] ?? '')) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push(<p key={`paragraph:${index}`}>{renderInlineMarkdown(paragraph.join('\n'))}</p>)
  }

  return <div className="codex-conversation-rich-text">{blocks}</div>
}

const IMAGE_ZOOM_MIN = 0.5
const IMAGE_ZOOM_MAX = 3
const IMAGE_ZOOM_STEP = 0.25
const CODEX_DEFAULT_MODEL_VALUE = '__codex_default_model__'

function ConversationImage({ path }: { path: string }): JSX.Element {
  const [source, setSource] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    if (path.startsWith('data:image/')) {
      setSource(path)
      return () => { active = false }
    }

    setSource('')
    const loadImage = async (): Promise<void> => {
      try {
        const data = await window.forgeDesk?.readImageData(path)
        if (active) setSource(data || '')
      } catch {
        if (active) setSource('')
      }
    }
    loadImage().catch(() => undefined)
    return () => { active = false }
  }, [path])

  useEffect(() => {
    if (!previewOpen) return undefined
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewOpen])

  function openPreview(): void {
    setZoom(1)
    setPreviewOpen(true)
  }

  function closePreview(): void {
    setPreviewOpen(false)
  }

  function changeZoom(delta: number): void {
    setZoom((current) => Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, Number((current + delta).toFixed(2)))))
  }

  if (!source) {
    return (
      <div className="codex-conversation-image-placeholder">
        <FileImageOutlined />
        <span>{path.split(/[\\/]/).pop() || '图片'}</span>
      </div>
    )
  }

  return (
    <>
      <button className="codex-conversation-image-button" type="button" onClick={openPreview} aria-label="点击放大查看图片">
        <img className="codex-conversation-image" src={source} alt="用户上传的图片缩略图" />
      </button>
      {previewOpen ? (
        <div className="codex-conversation-image-overlay" role="dialog" aria-modal="true" aria-label="图片预览" onMouseDown={closePreview}>
          <div className="codex-conversation-image-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="codex-conversation-image-toolbar">
              <span>图片预览 · {Math.round(zoom * 100)}%</span>
              <div className="codex-conversation-image-actions">
                <button type="button" onClick={() => changeZoom(-IMAGE_ZOOM_STEP)} disabled={zoom <= IMAGE_ZOOM_MIN} aria-label="缩小图片" title="缩小">
                  <ZoomOutOutlined />
                </button>
                <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="重置图片大小" title="重置">
                  100%
                </button>
                <button type="button" onClick={() => changeZoom(IMAGE_ZOOM_STEP)} disabled={zoom >= IMAGE_ZOOM_MAX} aria-label="放大图片" title="放大">
                  <ZoomInOutlined />
                </button>
                <button ref={closeButtonRef} type="button" onClick={closePreview} aria-label="关闭图片预览" title="关闭">
                  ×
                </button>
              </div>
            </div>
            <div className="codex-conversation-image-viewport">
              <img className="codex-conversation-image-preview" src={source} alt="用户上传的图片大图" style={{ transform: `scale(${zoom})` }} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ComposerImageAttachment({ path, onRemove }: { path: string; onRemove: () => void }): JSX.Element {
  const [source, setSource] = useState('')

  useEffect(() => {
    let active = true
    if (path.startsWith('data:image/')) {
      setSource(path)
      return () => { active = false }
    }

    setSource('')
    const loadImage = async (): Promise<void> => {
      try {
        const data = await window.forgeDesk?.readImageData(path)
        if (active) setSource(data || '')
      } catch {
        if (active) setSource('')
      }
    }
    loadImage().catch(() => undefined)
    return () => { active = false }
  }, [path])

  return (
    <div className="codex-session-attachment-preview" title={path}>
      {source ? <img src={source} alt="待发送的图片" /> : <FileImageOutlined />}
      <button type="button" aria-label="移除图片" onClick={onRemove}>
        <CloseOutlined />
      </button>
    </div>
  )
}

function ConversationItem({ item }: { item: CodexConversationItem }): JSX.Element {
  if (item.kind === 'tool-call' || item.kind === 'tool-output') {
    const body = item.kind === 'tool-call' ? item.input : item.output
    return (
      <details className={`codex-conversation-tool is-${item.kind}`}>
        <summary>
          <ToolOutlined />
          <span>{itemLabel(item)}</span>
          <Typography.Text type="secondary">{formatDateTime(item.timestamp)}</Typography.Text>
        </summary>
        {body ? <pre>{body}</pre> : <Typography.Text type="secondary">没有可显示的详细内容</Typography.Text>}
      </details>
    )
  }

  if (item.kind === 'status') {
    return (
      <div className="codex-conversation-status">
        {item.eventType === 'task_complete' ? <CheckCircleOutlined /> : item.eventType === 'turn_aborted' ? <CloseCircleOutlined /> : <CodeOutlined />}
        <span>{itemLabel(item)}</span>
        {item.text !== item.eventType ? <Typography.Text type="secondary">{item.text}</Typography.Text> : null}
        <Typography.Text type="secondary">{formatDateTime(item.timestamp)}</Typography.Text>
      </div>
    )
  }

  return (
    <article className={`codex-conversation-message is-${item.kind}`}>
      <div className="codex-conversation-avatar">{item.kind === 'user' ? '你' : 'AI'}</div>
      <div className="codex-conversation-message-body">
        <Typography.Text className="codex-conversation-role">{item.kind === 'user' ? '你' : 'Codex'}</Typography.Text>
        {item.images?.length > 0 ? <div className="codex-conversation-images">{item.images.map((path) => <ConversationImage key={path} path={path} />)}</div> : null}
        {item.text ? <ConversationRichText text={item.text} /> : null}
      </div>
    </article>
  )
}

function ConversationActivity({ items }: { items: CodexConversationItem[] }): JSX.Element {
  const toolCount = items.filter((item) => item.kind === 'tool-call' || item.kind === 'tool-output').length
  const statusCount = items.filter((item) => item.kind === 'status').length
  const firstTimestamp = items[0]?.timestamp
  const lastTimestamp = items[items.length - 1]?.timestamp
  const summary = toolCount > 0
    ? `工具执行过程 · ${Math.ceil(toolCount / 2)} 次`
    : `运行过程 · ${statusCount} 条`

  return (
    <details className="codex-conversation-activity">
      <summary>
        <ToolOutlined />
        <span>{summary}</span>
        <Typography.Text type="secondary">点击查看</Typography.Text>
        <Typography.Text type="secondary">{formatDateTime(firstTimestamp)}{lastTimestamp && lastTimestamp !== firstTimestamp ? ` – ${formatDateTime(lastTimestamp)}` : ''}</Typography.Text>
      </summary>
      <div className="codex-conversation-activity-items">
        {items.map((item) => <ConversationItem item={item} key={item.id} />)}
      </div>
    </details>
  )
}

export function CodexSessionManagerPanel({ focusAlert, onBack, onOpenForgeProject, usesCustomTitleBar }: CodexSessionManagerPanelProps): JSX.Element {
  const forgeProjects = useForgeDeskStore((state) => state.projects)
  const [snapshot, setSnapshot] = useState<CodexSessionsSnapshot>(() => emptySnapshot())
  const [monitorSnapshot, setMonitorSnapshot] = useState<CodexProjectMonitorSnapshot | null>(null)
  const [detail, setDetail] = useState<CodexSessionDetail | null>(null)
  const [selectedProjectKey, setSelectedProjectKey] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [imageAttachments, setImageAttachments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [configuredModel, setConfiguredModel] = useState('')
  const [selectedModel, setSelectedModel] = useState(CODEX_DEFAULT_MODEL_VALUE)
  const [viewMode, setViewMode] = useState<'monitor' | 'conversation'>('monitor')
  const [sitesOpen, setSitesOpen] = useState(false)
  const conversationRef = useRef<HTMLDivElement>(null)
  const shellClassName = `codex-session-shell${usesCustomTitleBar ? ' codex-session-shell-with-titlebar' : ''}`

  const filteredProjects = useMemo<CodexProjectGroup[]>(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return snapshot.projects.map((project) => {
      const sessions = snapshot.sessions.filter((session) => {
        if (session.projectKey !== project.key) return false
        if (!normalizedQuery) return true
        return [session.title, session.cwd, session.preview, session.id].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
          || project.name.toLocaleLowerCase().includes(normalizedQuery)
          || project.cwd.toLocaleLowerCase().includes(normalizedQuery)
      })
        return { project, sessions: sortSessions(sessions) }
    }).filter(({ sessions, project }) => !normalizedQuery || sessions.length > 0 || project.name.toLocaleLowerCase().includes(normalizedQuery) || project.cwd.toLocaleLowerCase().includes(normalizedQuery))
  }, [query, snapshot.projects, snapshot.sessions])

  const selectedProject = filteredProjects.find(({ project }) => project.key === selectedProjectKey)?.project ?? filteredProjects[0]?.project ?? null
  const selectedProjectSessions = filteredProjects.find(({ project }) => project.key === selectedProject?.key)?.sessions ?? []
  const selectedSummary = selectedProjectSessions.find((session) => session.id === selectedSessionId) ?? null
  const isRunning = detail ? detail.status === 'running' : selectedSummary?.status === 'running'
  const modelOptions = useMemo(() => [
    { label: '默认模型', value: CODEX_DEFAULT_MODEL_VALUE },
    ...(configuredModel ? [{ label: configuredModel, value: configuredModel }] : [])
  ], [configuredModel])

  async function refresh(): Promise<void> {
    if (!window.forgeDesk) {
      setSnapshot({ ...emptySnapshot(), error: '请在 ForgeDesk 桌面应用中读取本机 Codex 会话。' })
      setLoading(false)
      return
    }
    setRefreshing(true)
    try {
      const nextMonitorSnapshot = await window.forgeDesk.getCodexProjectMonitorSnapshot()
      const nextSnapshot = snapshotFromMonitor(nextMonitorSnapshot)
      setMonitorSnapshot(nextMonitorSnapshot)
      setSnapshot(nextSnapshot)
      setSelectedProjectKey((current) => current && nextSnapshot.projects.some((project) => project.key === current) ? current : nextSnapshot.projects[0]?.key || '')
      setSelectedSessionId((current) => current && nextSnapshot.sessions.some((session) => session.id === current) ? current : '')
    } catch (error) {
      setSnapshot({ ...emptySnapshot(), error: getErrorMessage(error, '读取 Codex 会话失败') })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadDetail(sessionId: string): Promise<void> {
    if (!window.forgeDesk || !sessionId) {
      setDetail(null)
      return
    }
    setLoadingDetail(true)
    try {
      setDetail(await window.forgeDesk.getCodexSession(sessionId))
    } catch (error) {
      setDetail(null)
      message.error(getErrorMessage(error, '读取 Codex 对话失败'))
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined)
    if (viewMode !== 'monitor') return undefined
    const intervalId = window.setInterval(() => refresh().catch(() => undefined), 15_000)
    return () => window.clearInterval(intervalId)
  }, [viewMode])

  useEffect(() => {
    let active = true
    const loadModel = async (): Promise<void> => {
      try {
        const settings = await window.forgeDesk?.getAiSettings()
        if (!active) return
        const model = settings?.model?.trim() || ''
        setConfiguredModel(model)
        setSelectedModel(model || CODEX_DEFAULT_MODEL_VALUE)
      } catch {
        if (active) setConfiguredModel('')
      }
    }
    loadModel().catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (selectedSummary && selectedSummary.id !== selectedSessionId) setSelectedSessionId(selectedSummary.id)
    if (selectedSummary && selectedSummary.projectKey !== selectedProjectKey) setSelectedProjectKey(selectedSummary.projectKey)
    if (!selectedSummary && selectedSessionId) setSelectedSessionId('')
  }, [selectedProjectKey, selectedSessionId, selectedSummary])

  useEffect(() => {
    if (selectedSessionId) loadDetail(selectedSessionId).catch(() => undefined)
    else setDetail(null)
  }, [selectedSessionId])

  useEffect(() => {
    if (!window.forgeDesk) return undefined
    const unsubscribeUpdated = window.forgeDesk.onCodexProjectMonitorUpdated((nextMonitorSnapshot) => {
      setMonitorSnapshot(nextMonitorSnapshot)
      setSnapshot(snapshotFromMonitor(nextMonitorSnapshot))
    })
    const unsubscribeFocus = window.forgeDesk.onCodexMonitorFocus((alert) => {
      setSelectedProjectKey(alert.codexKey)
      setViewMode('monitor')
    })
    return () => {
      unsubscribeUpdated()
      unsubscribeFocus()
    }
  }, [])

  useEffect(() => {
    if (!focusAlert) return
    setSelectedProjectKey(focusAlert.codexKey)
    setViewMode('monitor')
  }, [focusAlert])

  useEffect(() => {
    if (!window.forgeDesk) return undefined
    return window.forgeDesk.onCodexSessionEvent((event: CodexSessionEvent) => {
      if (event.session) setSnapshot((current) => updateSessionSnapshot(current, event.session as CodexSessionSummary))
      if (event.sessionId !== selectedSessionId) return
      const item = event.item
      if (item) {
        setDetail((current) => {
          if (!current) return current
          return { ...current, items: appendConversationItem(current.items, item) }
        })
      }
      if (event.type === 'running') setDetail((current) => current ? { ...current, status: 'running' } : current)
      if (event.type === 'completed' || event.type === 'failed' || event.type === 'cancelled') {
        setDetail((current) => current ? { ...current, status: event.type === 'completed' ? 'completed' : 'aborted' } : current)
        window.setTimeout(() => loadDetail(event.sessionId).catch(() => undefined), 120)
      }
      if (event.error) message.error(event.error)
    })
  }, [selectedSessionId])

  useEffect(() => {
    const conversation = conversationRef.current
    if (!conversation) return
    const frame = window.requestAnimationFrame(() => {
      conversation.scrollTo({ top: conversation.scrollHeight, behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [detail?.items.length, detail?.status, loadingDetail, selectedSessionId])

  async function sendMessage(): Promise<void> {
    const content = draft.trim()
    if (!window.forgeDesk || !selectedSessionId || (!content && imageAttachments.length === 0) || isRunning) return
    const sentContent = content || '请分析我上传的图片。'
    const optimisticItem: CodexConversationItem = {
      callId: '',
      eventType: 'user_message',
      images: [...imageAttachments],
      id: `optimistic:${selectedSessionId}:${Date.now()}`,
      input: '',
      kind: 'user',
      output: '',
      text: sentContent,
      timestamp: new Date().toISOString(),
      toolName: ''
    }
    setSending(true)
    setDetail((current) => current ? { ...current, status: 'running', items: appendConversationItem(current.items, optimisticItem) } : current)
    try {
      const nextDetail = await window.forgeDesk.sendCodexSessionMessage({
        content: sentContent,
        images: imageAttachments,
        model: selectedModel === CODEX_DEFAULT_MODEL_VALUE ? undefined : selectedModel,
        sessionId: selectedSessionId
      })
      setDetail((current) => {
        const nextItems = nextDetail.items.some((item) => item.kind === 'user' && item.text === sentContent)
          ? nextDetail.items
          : appendConversationItem(nextDetail.items, optimisticItem)
        return { ...nextDetail, items: nextItems }
      })
      setDraft('')
      setImageAttachments([])
    } catch (error) {
      setDetail((current) => current ? { ...current, status: 'aborted', items: current.items.filter((item) => item.id !== optimisticItem.id) } : current)
      message.error(getErrorMessage(error, '继续 Codex 会话失败'))
    } finally {
      setSending(false)
    }
  }

  async function cancelSession(): Promise<void> {
    if (!window.forgeDesk || !selectedSessionId || !isRunning) return
    try {
      setDetail(await window.forgeDesk.cancelCodexSession(selectedSessionId))
    } catch (error) {
      message.error(getErrorMessage(error, '停止 Codex 会话失败'))
    }
  }

  async function togglePinSession(session: CodexSessionSummary): Promise<void> {
    if (!window.forgeDesk) return
    try {
      const nextSession = await window.forgeDesk.toggleCodexSessionPin(session.id)
      setSnapshot((current) => updateSessionSnapshot(current, nextSession))
      setDetail((current) => current?.id === nextSession.id ? { ...current, pinned: nextSession.pinned } : current)
      message.success(nextSession.pinned ? '会话已置顶（已同步 Codex）' : '已取消置顶（已同步 Codex）')
    } catch (error) {
      message.error(getErrorMessage(error, '更新会话置顶状态失败'))
    }
  }

  async function selectImage(): Promise<void> {
    if (!window.forgeDesk || isRunning || sending) return
    try {
      const path = await window.forgeDesk.selectImage()
      if (path) setImageAttachments((current) => current.includes(path) ? current : [...current, path])
    } catch (error) {
      message.error(getErrorMessage(error, '选择图片失败'))
    }
  }

  async function handleComposerPaste(event: ReactClipboardEvent<HTMLTextAreaElement>): Promise<void> {
    if (isRunning || sending) return
    const textarea = event.currentTarget
    const pastedText = event.clipboardData.getData('text/plain')
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    event.preventDefault()

    let imagePath: string | null = null
    try {
      imagePath = await window.forgeDesk?.readClipboardImage() ?? null
    } catch {
      imagePath = null
    }

    if (imagePath) {
      const nextImagePath = imagePath
      setImageAttachments((current) => current.includes(nextImagePath) ? current : [...current, nextImagePath])
      message.success('已添加剪贴板图片')
      return
    }

    if (!pastedText) return
    setDraft((current) => `${current.slice(0, start)}${pastedText}${current.slice(end)}`)
    window.requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + pastedText.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  async function copyValue(value: string, successMessage: string): Promise<void> {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      message.success(successMessage)
    } catch (error) {
      message.error(getErrorMessage(error, '复制失败'))
    }
  }

  function openConversationMode(): void {
    if (!selectedSummary) {
      const fallbackSession = selectedProjectSessions[0]
      if (fallbackSession) setSelectedSessionId(fallbackSession.id)
    }
    setViewMode('conversation')
  }

  function openProjectMonitor(): void {
    setViewMode('monitor')
  }

  const renderProjectRail = (): JSX.Element => (
    <aside className="codex-session-projects">
      <div className="module-back-row codex-session-back-row">
        <ModuleBackButton label="返回总览" onClick={onBack} />
      </div>
      <div className="codex-session-brand-row">
        <div>
          <Typography.Text className="codex-session-brand">Codex</Typography.Text>
          <Typography.Text className="codex-session-subtitle">原生项目与会话</Typography.Text>
        </div>
        <HistoryOutlined className="codex-session-brand-icon" />
      </div>
      <div className="codex-session-project-heading">
        <Typography.Text type="secondary">项目</Typography.Text>
        <Typography.Text type="secondary">{snapshot.projects.length}</Typography.Text>
      </div>
      <div className="codex-session-project-list">
        {loading && snapshot.projects.length === 0 ? <div className="codex-session-list-empty"><Spin size="small" /></div> : filteredProjects.length > 0 ? filteredProjects.map(({ project, sessions }) => (
          <button className={`codex-session-project-row${viewMode === 'conversation' && project.key === selectedProject?.key ? ' is-active' : ''}`} key={project.key} type="button" onClick={() => { setSelectedProjectKey(project.key); setSelectedSessionId(sessions[0]?.id || '') }}>
            <span className="codex-session-project-row-title">{project.name}</span>
            <span className="codex-session-project-row-path" title={project.cwd}>{project.cwd || '未记录工作目录'}</span>
            <span className="codex-session-project-row-meta"><span>{project.sessionCount} 个会话</span>{project.runningCount > 0 ? <Badge status="processing" text={`${project.runningCount} 进行中`} /> : null}</span>
          </button>
        )) : <div className="codex-session-list-empty">暂无 Codex 项目</div>}
      </div>
    </aside>
  )

  return (
    <>
      <Layout className={`${shellClassName}${viewMode === 'monitor' ? ' is-monitor' : ''}`}>
      {viewMode === 'monitor' ? renderProjectRail() : <>
        {renderProjectRail()}

      <aside className="codex-session-sidebar">
        <div className="codex-session-sidebar-heading">
          <div>
            <Typography.Text strong>{selectedProject?.name || 'Codex 会话'}</Typography.Text>
            <Typography.Text type="secondary" title={selectedProject?.cwd}>{selectedProject?.cwd || '选择一个项目'}</Typography.Text>
          </div>
          <Tooltip title="刷新">
            <Button type="text" icon={<ReloadOutlined />} loading={refreshing} onClick={() => refresh()} />
          </Tooltip>
        </div>
        <Input allowClear className="codex-session-search" prefix={<SearchOutlined />} placeholder="搜索会话或项目" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="codex-session-list">
          {selectedProjectSessions.length > 0 ? selectedProjectSessions.map((session) => (
            <div className={`codex-session-row${session.id === selectedSummary?.id ? ' is-active' : ''}${session.status === 'running' ? ' is-running' : ''}`} key={session.id} role="button" tabIndex={0} onClick={() => setSelectedSessionId(session.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedSessionId(session.id) } }}>
              <span className="codex-session-row-heading"><span className="codex-session-row-title">{session.pinned ? <PushpinFilled className="codex-session-pin-icon" /> : null}{session.title}</span><span className="codex-session-row-actions"><Badge status={statusTone(session.status)} text={statusLabels[session.status]} /><Tooltip title={session.pinned ? '取消 Codex 原生置顶' : '使用 Codex 原生置顶'}><span className="codex-session-pin-button" role="button" tabIndex={0} aria-label={session.pinned ? `取消 Codex 原生置顶 ${session.title}` : `使用 Codex 原生置顶 ${session.title}`} onClick={(event) => { event.stopPropagation(); togglePinSession(session).catch(() => undefined) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); togglePinSession(session).catch(() => undefined) } }}>{session.pinned ? <PushpinFilled /> : <PushpinOutlined />}</span></Tooltip></span></span>
              <span className="codex-session-row-preview">{session.preview || '暂无用户消息'}</span>
              <span className="codex-session-row-meta"><span>{session.archived ? '已归档' : formatRelativeTime(session.updatedAt)}</span><span>{shortenPath(session.id, 18)}</span></span>
            </div>
          )) : <div className="codex-session-list-empty">暂无匹配会话</div>}
        </div>
      </aside>

      <main className="codex-session-main">
        <header className="codex-session-header">
          <div className="codex-session-main-heading">
            <MessageOutlined />
            <div>
              <Typography.Title level={3}>{detail?.title || selectedSummary?.title || 'Codex 会话'}</Typography.Title>
              <Typography.Text type="secondary" title={detail?.cwd || selectedSummary?.cwd}><FolderOpenOutlined /> {detail?.cwd || selectedSummary?.cwd || '未记录工作目录'}</Typography.Text>
            </div>
          </div>
          <Space wrap>
            <Button icon={<DashboardOutlined />} onClick={openProjectMonitor}>项目监控</Button>
            <Button icon={<GlobalOutlined />} onClick={() => setSitesOpen(true)}>Sites</Button>
            <Badge status={snapshot.available ? 'success' : 'error'} text={snapshot.available ? `已连接 · ${snapshot.running} 个进行中` : '会话目录不可用'} />
            {selectedSummary ? <Button icon={<CopyOutlined />} onClick={() => copyValue(selectedSummary.filePath, '会话路径已复制')}>复制路径</Button> : null}
          </Space>
        </header>

        {snapshot.error ? <div className="codex-session-alert">{snapshot.error}</div> : null}

        {detail ? (
          <>
            <div className="codex-session-conversation-toolbar">
              <Space size={8} wrap>
                <Tag color={detail.status === 'running' ? 'processing' : undefined}>{statusLabels[detail.status]}</Tag>
                <Typography.Text type="secondary">更新于 {formatRelativeTime(detail.updatedAt)}</Typography.Text>
                {detail.archived ? <Tag>已归档</Tag> : null}
              </Space>
              <Typography.Text type="secondary">{detail.items.length} 条可见记录</Typography.Text>
            </div>
            <div className="codex-session-conversation" ref={conversationRef}>
              {loadingDetail ? <div className="codex-session-loading"><Spin /></div> : detail.items.length > 0 ? groupConversationItems(detail.items).map((block, index) => block.kind === 'message'
                ? <ConversationItem item={block.item} key={block.item.id} />
                : <ConversationActivity items={block.items} key={`activity:${block.items[0]?.id || index}`} />
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个会话还没有可显示的对话内容" />}
            </div>
            {detail.archived ? <div className="codex-session-archived-note">这个会话已归档，可以查看内容，但不能在 ForgeDesk 中继续发送消息。</div> : (
              <footer className="codex-session-composer">
                <div className="codex-session-composer-body">
                  {imageAttachments.length > 0 ? <div className="codex-session-attachments">{imageAttachments.map((path) => <ComposerImageAttachment key={path} path={path} onRemove={() => setImageAttachments((current) => current.filter((item) => item !== path))} />)}</div> : null}
                  <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} disabled={isRunning || sending} placeholder="继续这个 Codex 会话…" value={draft} onChange={(event) => setDraft(event.target.value)} onPaste={(event) => { handleComposerPaste(event).catch(() => undefined) }} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); sendMessage().catch(() => undefined) } }} />
                  <div className="codex-session-composer-actions">
                    <div className="codex-session-composer-leading">
                      <Tooltip title="添加图片">
                        <Button type="text" icon={<PlusOutlined />} aria-label="添加图片" disabled={isRunning || sending} onClick={() => selectImage()} />
                      </Tooltip>
                      <Typography.Text type="secondary">Enter 发送 · Shift + Enter 换行</Typography.Text>
                    </div>
                    <div className="codex-session-composer-trailing">
                      <div className="codex-session-model-picker">
                        <ThunderboltOutlined />
                        <Select
                          aria-label="选择模型"
                          bordered={false}
                          className="codex-session-model-select"
                          disabled={isRunning || sending}
                          options={modelOptions}
                          onChange={(value: string) => setSelectedModel(value)}
                          value={selectedModel}
                        />
                      </div>
                      <Tooltip title="语音输入暂未接入">
                        <Button type="text" icon={<AudioOutlined />} aria-label="语音输入" disabled />
                      </Tooltip>
                      {isRunning ? <Button danger icon={<StopOutlined />} onClick={() => cancelSession()}>停止</Button> : <Button type="primary" shape="circle" icon={<SendOutlined />} disabled={(!draft.trim() && imageAttachments.length === 0) || sending} loading={sending} onClick={() => sendMessage()} />}
                    </div>
                  </div>
                </div>
              </footer>
            )}
          </>
        ) : (
          <div className="codex-session-empty-stage"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={snapshot.available ? '选择一个 Codex 会话查看完整内容' : '尚未读取到本机 Codex 会话'} /></div>
        )}
      </main>
      </>}
      {viewMode === 'monitor' ? (
        <CodexProjectMonitor
          forgeProjects={forgeProjects}
          monitorSnapshot={monitorSnapshot}
          snapshot={snapshot}
          projectGroups={filteredProjects}
          selectedProjectKey={selectedProject?.key || ''}
          selectedSummary={selectedSummary}
          selectedDetail={detail}
          loading={loading}
          loadingDetail={loadingDetail}
          refreshing={refreshing}
          onSelectProject={(projectKey) => { setSelectedProjectKey(projectKey); const group = filteredProjects.find((item) => item.project.key === projectKey); setSelectedSessionId(group?.sessions[0]?.id || '') }}
          onSelectSession={(sessionId) => {
            const session = snapshot.sessions.find((item) => item.id === sessionId)
            if (session) setSelectedProjectKey(session.projectKey)
            setSelectedSessionId(sessionId)
          }}
          onRefresh={() => refresh().catch(() => undefined)}
          onOpenConversation={openConversationMode}
          onLinkCodexProject={async (cwd, projectId) => {
            if (projectId) await window.forgeDesk.saveAiProjectResourceLink({ providerId: 'codex', projectId, resourcePath: cwd })
            else await window.forgeDesk.deleteAiProjectResourceLink({ providerId: 'codex', resourcePath: cwd })
            const nextMonitorSnapshot = await window.forgeDesk.getCodexProjectMonitorSnapshot()
            setMonitorSnapshot(nextMonitorSnapshot)
            setSnapshot(snapshotFromMonitor(nextMonitorSnapshot))
          }}
          onOpenForgeProject={onOpenForgeProject}
        />
      ) : null}
      </Layout>
      <CodexSitesPanel open={sitesOpen} onClose={() => setSitesOpen(false)} selectedSession={selectedSummary} sessionRunning={Boolean(isRunning)} />
    </>
  )
}
