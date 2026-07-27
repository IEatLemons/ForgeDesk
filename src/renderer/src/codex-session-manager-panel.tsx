import {
  CopyOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { Badge, Button, Empty, Input, Layout, Space, Statistic, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { CodexActivitySnapshot, CodexSessionRecord } from './data'
import { getErrorMessage } from './error-messages'
import { ModuleBackButton } from './module-navigation'

type CodexSessionManagerPanelProps = {
  onBack: () => void
  usesCustomTitleBar: boolean
}

const statusLabels: Record<CodexSessionRecord['status'], string> = {
  aborted: '已中止',
  completed: '已完成',
  idle: '空闲',
  running: '进行中'
}

function emptySnapshot(): CodexActivitySnapshot {
  return {
    aborted: 0,
    available: false,
    checkedAt: '',
    completed: 0,
    error: '',
    running: 0,
    sessions: [],
    source: ''
  }
}

function statusTone(status: CodexSessionRecord['status']): 'default' | 'processing' | 'success' | 'error' | 'warning' {
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

async function copyValue(value: string, successMessage: string): Promise<void> {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    message.success(successMessage)
  } catch (error) {
    message.error(getErrorMessage(error, '复制失败'))
  }
}

export function CodexSessionManagerPanel({ onBack, usesCustomTitleBar }: CodexSessionManagerPanelProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<CodexActivitySnapshot>(() => emptySnapshot())
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const shellClassName = `codex-session-shell${usesCustomTitleBar ? ' codex-session-shell-with-titlebar' : ''}`

  async function refresh(): Promise<void> {
    if (!window.forgeDesk) {
      setSnapshot({ ...emptySnapshot(), error: '请在 ForgeDesk 桌面应用中读取本机 Codex 会话。' })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      setSnapshot(await window.forgeDesk.getCodexActivitySnapshot())
    } catch (error) {
      setSnapshot({ ...emptySnapshot(), error: getErrorMessage(error, '读取 Codex 会话失败') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined)
    const intervalId = window.setInterval(() => {
      refresh().catch(() => undefined)
    }, 15000)
    return () => window.clearInterval(intervalId)
  }, [])

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return snapshot.sessions
    return snapshot.sessions.filter((session) => [session.title, session.cwd, session.lastMessage, session.id].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
  }, [query, snapshot.sessions])

  const selectedSession = snapshot.sessions.find((session) => session.id === selectedSessionId) ?? filteredSessions[0] ?? null

  useEffect(() => {
    if (selectedSession && selectedSession.id !== selectedSessionId) setSelectedSessionId(selectedSession.id)
    if (!selectedSession && selectedSessionId) setSelectedSessionId('')
  }, [selectedSession, selectedSessionId])

  return (
    <Layout className={shellClassName}>
      <aside className="codex-session-sidebar">
        <div className="module-back-row codex-session-back-row">
          <ModuleBackButton label="返回总览" onClick={onBack} />
        </div>
        <div className="codex-session-brand-row">
          <div>
            <Typography.Text className="codex-session-brand">Codex</Typography.Text>
            <Typography.Text className="codex-session-subtitle">系统会话管理</Typography.Text>
          </div>
          <HistoryOutlined className="codex-session-brand-icon" />
        </div>
        <div className="codex-session-stats">
          <div><strong>{snapshot.running}</strong><span>进行中</span></div>
          <div><strong>{snapshot.completed.toLocaleString()}</strong><span>已完成</span></div>
          <div><strong>{snapshot.sessions.length}</strong><span>会话</span></div>
        </div>
        <Input
          allowClear
          className="codex-session-search"
          prefix={<SearchOutlined />}
          placeholder="按标题、项目或路径搜索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="codex-session-list">
          {loading && snapshot.sessions.length === 0 ? (
            <div className="codex-session-list-empty">正在读取真实 Codex 会话…</div>
          ) : filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <button
                className={`codex-session-row${session.id === selectedSession?.id ? ' is-active' : ''}${session.status === 'running' ? ' is-running' : ''}`}
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
              >
                <span className="codex-session-row-heading">
                  <span className="codex-session-row-title">{session.title}</span>
                  <Badge status={statusTone(session.status)} text={statusLabels[session.status]} />
                </span>
                <span className="codex-session-row-path">{session.cwd || '未记录工作目录'}</span>
                <span className="codex-session-row-meta">
                  <span>{session.tasks} 个任务</span>
                  <span>{formatRelativeTime(session.updatedAt)}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="codex-session-list-empty">暂无匹配的 Codex 会话</div>
          )}
        </div>
      </aside>

      <main className="codex-session-main">
        <header className="codex-session-header">
          <div>
            <Typography.Title level={3}>Codex 会话管理</Typography.Title>
            <Typography.Text type="secondary">实时读取本机 Codex 会话记录，不混入 ForgeDesk 自己创建的 AI 对话。</Typography.Text>
          </div>
          <Space wrap>
            <Badge status={snapshot.available ? 'success' : 'error'} text={snapshot.available ? '已连接本机会话' : '会话目录不可用'} />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => refresh()}>刷新</Button>
          </Space>
        </header>

        {snapshot.error ? <div className="codex-session-alert">{snapshot.error}</div> : null}

        {selectedSession ? (
          <section className="codex-session-detail">
            <div className="codex-session-detail-heading">
              <div>
                <Space size={8} wrap>
                  <Tag color={selectedSession.status === 'running' ? 'processing' : undefined}>{statusLabels[selectedSession.status]}</Tag>
                  <Typography.Text type="secondary">最近活动 {formatRelativeTime(selectedSession.updatedAt)}</Typography.Text>
                </Space>
                <Typography.Title level={2}>{selectedSession.title}</Typography.Title>
                <Typography.Text type="secondary" title={selectedSession.cwd}>
                  <FolderOpenOutlined /> {selectedSession.cwd || '未记录工作目录'}
                </Typography.Text>
              </div>
              <Button icon={<CopyOutlined />} onClick={() => copyValue(selectedSession.filePath, '会话文件路径已复制')}>复制会话路径</Button>
            </div>

            <div className="codex-session-metrics">
              <Statistic title="任务数" value={selectedSession.tasks} />
              <Statistic title="已完成" value={selectedSession.completed} />
              <Statistic title="已中止" value={selectedSession.aborted} />
              <Statistic title="最后事件" value={selectedSession.lastEvent || '—'} />
            </div>

            <div className="codex-session-detail-grid">
              <div><span>会话 ID</span><strong>{selectedSession.id}</strong></div>
              <div><span>开始时间</span><strong>{formatDateTime(selectedSession.startedAt)}</strong></div>
              <div><span>更新时间</span><strong>{formatDateTime(selectedSession.updatedAt)}</strong></div>
              <div><span>日志文件</span><strong title={selectedSession.filePath}>{shortenPath(selectedSession.filePath)}</strong></div>
            </div>

            <div className="codex-session-last-message">
              <Typography.Text strong>最近消息</Typography.Text>
              <Typography.Paragraph ellipsis={{ rows: 5 }}>
                {selectedSession.lastMessage || '暂无可显示的用户消息。'}
              </Typography.Paragraph>
            </div>
          </section>
        ) : (
          <div className="codex-session-empty-stage">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={snapshot.available ? '选择一个 Codex 会话查看详情' : '尚未读取到本机 Codex 会话'} />
          </div>
        )}
      </main>
    </Layout>
  )
}
