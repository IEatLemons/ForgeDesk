import { useEffect, useMemo, useRef, useState } from 'react'
import type { CodexSessionSummary, CodexSessionsSnapshot, SystemMonitorSnapshot } from './data'
import {
  createSystemMonitorHardwareMetrics,
  getSystemMonitorStatusMeta,
  readStoredSystemMonitorOverviewHardwareKeys,
  rememberSystemMonitorSnapshot,
  systemMonitorOverviewHardwareChangedEvent,
  type SystemMonitorHardwareKey
} from './system-monitor-view'
import type { AppMode } from './app-mode'
import { AppModeSwitcher } from './app-mode-switcher'

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
}

function getTitlebarStatusClass(status: SystemMonitorSnapshot['status'] | undefined): string {
  switch (status) {
    case 'critical':
      return 'is-critical'
    case 'warning':
      return 'is-warning'
    case 'healthy':
      return 'is-healthy'
    default:
      return 'is-loading'
  }
}

function formatCodexSessionTime(value: string): string {
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

function codexSessionProject(session: CodexSessionSummary): string {
  return session.projectName || session.cwd.split(/[\\/]/).filter(Boolean).pop() || '未记录项目'
}

function codexSessionStatusLabel(session: CodexSessionSummary): string {
  if (session.status === 'running') return '进行中'
  if (session.status === 'completed') return '已完成'
  if (session.status === 'aborted') return '已中止'
  return '空闲'
}

export function AppTitleBar({
  appMode,
  onAppModeChange,
  onOpenCodex,
  onOpenSystemMonitor
}: {
  appMode: AppMode
  onAppModeChange: (mode: AppMode) => void
  onOpenCodex: () => void
  onOpenSystemMonitor: () => void
}): JSX.Element | null {
  const [enabled] = useState(isMacPlatform)
  const [snapshot, setSnapshot] = useState<SystemMonitorSnapshot | null>(null)
  const [overviewHardwareKeys, setOverviewHardwareKeys] = useState<SystemMonitorHardwareKey[]>(() => readStoredSystemMonitorOverviewHardwareKeys())
  const [error, setError] = useState('')
  const [codexActivity, setCodexActivity] = useState<CodexSessionsSnapshot | null>(null)
  const [codexActivityError, setCodexActivityError] = useState('')
  const [codexPopoverOpen, setCodexPopoverOpen] = useState(false)
  const [systemPopoverOpen, setSystemPopoverOpen] = useState(false)
  const codexPopoverRef = useRef<HTMLDivElement>(null)
  const systemPopoverRef = useRef<HTMLDivElement>(null)
  const metrics = useMemo(() => (snapshot ? createSystemMonitorHardwareMetrics(snapshot) : []), [snapshot])
  const visibleMetrics = useMemo(() => metrics.filter((metric) => overviewHardwareKeys.includes(metric.key)).slice(0, 4), [metrics, overviewHardwareKeys])
  const runningCodexSessions = useMemo(() => codexActivity?.sessions.filter((session) => session.status === 'running').slice(0, 5) ?? [], [codexActivity])
  const recentCodexSessions = useMemo(() => codexActivity?.sessions.filter((session) => session.status !== 'running').slice(0, 5) ?? [], [codexActivity])
  const statusMeta = snapshot ? getSystemMonitorStatusMeta(snapshot.status) : null
  const statusClass = getTitlebarStatusClass(snapshot?.status)
  const openCodexSessionManager = (): void => {
    setCodexPopoverOpen(false)
    onOpenCodex()
  }

  useEffect(() => {
    if (!enabled || !window.forgeDesk) {
      return undefined
    }

    let mounted = true

    async function loadSnapshot(): Promise<void> {
      try {
        const nextSnapshot = await window.forgeDesk?.getSystemMonitorSnapshot()

        if (!mounted || !nextSnapshot) {
          return
        }

        rememberSystemMonitorSnapshot(nextSnapshot)
        setSnapshot(nextSnapshot)
        setError('')
      } catch {
        if (mounted) {
          setError('读取失败')
        }
      }
    }

    loadSnapshot().catch(() => undefined)
    const intervalId = window.setInterval(() => {
      loadSnapshot().catch(() => undefined)
    }, 60000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [enabled])

  useEffect(() => {
    if (!codexPopoverOpen) return undefined

    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (!codexPopoverRef.current?.contains(event.target as Node)) setCodexPopoverOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setCodexPopoverOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [codexPopoverOpen])

  useEffect(() => {
    if (!systemPopoverOpen) return undefined

    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (!systemPopoverRef.current?.contains(event.target as Node)) setSystemPopoverOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSystemPopoverOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [systemPopoverOpen])

  useEffect(() => {
    if (appMode !== 'simple') {
      setSystemPopoverOpen(false)
    }
  }, [appMode])

  async function refreshSystemSnapshot(): Promise<void> {
    try {
      const nextSnapshot = await window.forgeDesk?.getSystemMonitorSnapshot()

      if (!nextSnapshot) {
        return
      }

      rememberSystemMonitorSnapshot(nextSnapshot)
      setSnapshot(nextSnapshot)
      setError('')
    } catch {
      setError('读取失败')
    }
  }

  useEffect(() => {
    if (!enabled || !window.forgeDesk) {
      return undefined
    }

    let mounted = true

    async function loadCodexActivity(): Promise<void> {
      try {
        const nextActivity = await window.forgeDesk?.listCodexSessions()

        if (!mounted || !nextActivity) {
          return
        }

        setCodexActivity(nextActivity)
        setCodexActivityError(nextActivity.available ? '' : '读取失败')
      } catch {
        if (mounted) {
          setCodexActivityError('读取失败')
        }
      }
    }

    loadCodexActivity().catch(() => undefined)
    const intervalId = window.setInterval(() => {
      loadCodexActivity().catch(() => undefined)
    }, 15000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const syncHardwareKeys = (): void => setOverviewHardwareKeys(readStoredSystemMonitorOverviewHardwareKeys())

    window.addEventListener('storage', syncHardwareKeys)
    window.addEventListener(systemMonitorOverviewHardwareChangedEvent, syncHardwareKeys)

    return () => {
      window.removeEventListener('storage', syncHardwareKeys)
      window.removeEventListener(systemMonitorOverviewHardwareChangedEvent, syncHardwareKeys)
    }
  }, [enabled])

  if (!enabled) {
    return null
  }

  return (
    <header className="app-titlebar">
      <div className="app-titlebar-title">ForgeDesk</div>
      <div className="app-titlebar-codex-anchor" ref={codexPopoverRef}>
        <button
          aria-expanded={codexPopoverOpen}
          aria-haspopup="dialog"
          className={`app-titlebar-codex${codexActivity?.running ? ' is-running' : ''}${codexPopoverOpen ? ' is-open' : ''}`}
          type="button"
          title={codexActivity?.available ? `真实 Codex 会话：进行中 ${codexActivity.running}，已完成 ${codexActivity.completed}` : '正在读取真实 Codex 会话状态'}
          onClick={() => setCodexPopoverOpen((open) => !open)}
        >
          <span className="app-titlebar-codex-mark">⌘</span>
          <span className="app-titlebar-codex-name">Codex</span>
          {codexActivityError ? (
            <span className="app-titlebar-codex-unavailable">{codexActivity ? '未检测到' : '读取中'}</span>
          ) : codexActivity ? (
            <span className="app-titlebar-codex-stats">
              <span>进行中 <strong>{codexActivity.running}</strong></span>
              <span>已完成 <strong>{codexActivity.completed.toLocaleString()}</strong></span>
            </span>
          ) : (
            <span className="app-titlebar-codex-unavailable">读取中</span>
          )}
        </button>
        {codexPopoverOpen ? (
          <div className="app-titlebar-codex-popover" role="dialog" aria-label="Codex 状态">
            <div className="app-titlebar-codex-popover-header">
              <div>
                <strong>Codex</strong>
                <span>本机实时会话</span>
              </div>
              <button className="app-titlebar-codex-popover-refresh" type="button" onClick={() => window.forgeDesk?.listCodexSessions().then((nextActivity) => {
                setCodexActivity(nextActivity)
                setCodexActivityError(nextActivity.available ? '' : '读取失败')
              }).catch(() => setCodexActivityError('读取失败'))}>
                刷新
              </button>
            </div>
            {codexActivity?.available ? (
              <>
                <div className="app-titlebar-codex-popover-summary">
                  <span><strong>{codexActivity.running}</strong> 进行中</span>
                  <span><strong>{codexActivity.completed.toLocaleString()}</strong> 已完成</span>
                  <span><strong>{codexActivity.sessions.length}</strong> 会话</span>
                </div>
                <section className="app-titlebar-codex-popover-section">
                  <div className="app-titlebar-codex-popover-section-title">进行中</div>
                  {runningCodexSessions.length > 0 ? runningCodexSessions.map((session) => (
                    <button className="app-titlebar-codex-popover-session is-running" key={session.id} type="button" onClick={openCodexSessionManager}>
                      <span className="app-titlebar-codex-popover-session-title">{session.title}</span>
                      <span className="app-titlebar-codex-popover-session-meta">项目：{codexSessionProject(session)} · {session.preview || '正在处理'}</span>
                    </button>
                  )) : <div className="app-titlebar-codex-popover-empty">当前没有正在运行的会话</div>}
                </section>
                <section className="app-titlebar-codex-popover-section">
                  <div className="app-titlebar-codex-popover-section-title">最近</div>
                  {recentCodexSessions.length > 0 ? recentCodexSessions.map((session) => (
                    <button className="app-titlebar-codex-popover-session" key={session.id} type="button" onClick={openCodexSessionManager}>
                      <span className="app-titlebar-codex-popover-session-title">{session.title}</span>
                      <span className="app-titlebar-codex-popover-session-meta">{codexSessionStatusLabel(session)} · 项目：{codexSessionProject(session)} · {session.preview || formatCodexSessionTime(session.updatedAt)}</span>
                    </button>
                  )) : <div className="app-titlebar-codex-popover-empty">暂无最近会话</div>}
                </section>
              </>
            ) : (
              <div className="app-titlebar-codex-popover-error">{codexActivityError || codexActivity?.error || '尚未读取到本机 Codex 会话'}</div>
            )}
            <button className="app-titlebar-codex-popover-footer" type="button" onClick={openCodexSessionManager}>查看全部会话 <span>›</span></button>
          </div>
        ) : null}
      </div>
      <div className="app-titlebar-system-anchor" ref={systemPopoverRef}>
        <button
          aria-expanded={appMode === 'simple' ? systemPopoverOpen : undefined}
          aria-haspopup={appMode === 'simple' ? 'dialog' : undefined}
          className={`app-titlebar-system-strip${systemPopoverOpen && appMode === 'simple' ? ' is-open' : ''}`}
          type="button"
          onClick={() => appMode === 'simple' ? setSystemPopoverOpen((open) => !open) : onOpenSystemMonitor()}
        >
          <span className={`app-titlebar-status ${statusClass}`}>
            <span className="app-titlebar-status-dot" />
            电脑{error ? error : statusMeta?.label ?? '读取中'}
          </span>
          {visibleMetrics.length > 0 ? (
            <span className="app-titlebar-metrics">
              {visibleMetrics.map((metric) => (
                <span className="app-titlebar-metric" key={metric.key}>
                  <span>{metric.label}</span>
                  <strong>{metric.displayValue}</strong>
                </span>
              ))}
            </span>
          ) : (
            <span className="app-titlebar-empty">未选择硬件</span>
          )}
        </button>
        {appMode === 'simple' && systemPopoverOpen ? (
          <div className="app-titlebar-system-popover" role="dialog" aria-label="电脑监控状态">
            <div className="app-titlebar-system-popover-header">
              <div>
                <strong>电脑监控</strong>
                <span>{snapshot?.system.hostname || '本机实时状态'}</span>
              </div>
              <button className="app-titlebar-system-popover-refresh" type="button" onClick={() => refreshSystemSnapshot()}>
                刷新
              </button>
            </div>
            <div className="app-titlebar-system-popover-summary">
              <span className={`app-titlebar-system-popover-status ${statusClass}`}>
                <span className="app-titlebar-status-dot" />
                {error ? error : statusMeta?.label ?? '读取中'}
              </span>
              <span>{snapshot?.checkedAt ? new Date(snapshot.checkedAt).toLocaleTimeString('zh-CN') : '等待数据'}</span>
            </div>
            {visibleMetrics.length > 0 ? (
              <div className="app-titlebar-system-popover-metrics">
                {visibleMetrics.map((metric) => (
                  <div className="app-titlebar-system-popover-metric" key={metric.key}>
                    <div>
                      <strong>{metric.label}</strong>
                      <strong>{metric.displayValue}</strong>
                    </div>
                    <span>{metric.description}</span>
                    <span>{metric.detail}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="app-titlebar-system-popover-empty">正在读取电脑监控信息</div>
            )}
            {snapshot?.statusMessage ? <div className="app-titlebar-system-popover-message">{snapshot.statusMessage}</div> : null}
          </div>
        ) : null}
      </div>
      <div className="app-titlebar-actions">
        <AppModeSwitcher mode={appMode} onChange={onAppModeChange} />
      </div>
    </header>
  )
}
