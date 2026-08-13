import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { CodexProjectMonitorSnapshot, CodexSessionSummary, CodexSessionsSnapshot, SystemMonitorSnapshot } from './data'
import { formatCodexQuotaPercent, getCodexQuotaProgressMeta, selectCodexWeeklyQuotaWindow } from './codex-titlebar-state'
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

function codexSessionProject(session: CodexSessionSummary): string {
  return session.projectName || session.cwd.split(/[\\/]/).filter(Boolean).pop() || '未记录项目'
}

function formatCodexResetAt(value: string): string {
  if (!value) return '重置时间未知'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '重置时间未知'
  return `重置：${new Date(timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
}

export function AppSystemMonitorStatus({
  appMode,
  onOpenSystemMonitor
}: {
  appMode: AppMode
  onOpenSystemMonitor: () => void
}): JSX.Element | null {
  const [enabled] = useState(isMacPlatform)
  const [snapshot, setSnapshot] = useState<SystemMonitorSnapshot | null>(null)
  const [overviewHardwareKeys, setOverviewHardwareKeys] = useState<SystemMonitorHardwareKey[]>(() => readStoredSystemMonitorOverviewHardwareKeys())
  const [error, setError] = useState('')
  const [systemPopoverOpen, setSystemPopoverOpen] = useState(false)
  const systemPopoverRef = useRef<HTMLDivElement>(null)
  const metrics = useMemo(() => (snapshot ? createSystemMonitorHardwareMetrics(snapshot) : []), [snapshot])
  const visibleMetrics = useMemo(() => metrics.filter((metric) => overviewHardwareKeys.includes(metric.key)).slice(0, 4), [metrics, overviewHardwareKeys])
  const statusMeta = snapshot ? getSystemMonitorStatusMeta(snapshot.status) : null
  const statusClass = getTitlebarStatusClass(snapshot?.status)

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
    <div className="app-status-bar-system-anchor" ref={systemPopoverRef}>
      <button
        aria-expanded={appMode === 'simple' ? systemPopoverOpen : undefined}
        aria-haspopup={appMode === 'simple' ? 'dialog' : undefined}
        className={`app-status-bar-system-strip${systemPopoverOpen && appMode === 'simple' ? ' is-open' : ''}`}
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
        <div className="app-status-bar-system-popover app-titlebar-system-popover" role="dialog" aria-label="电脑监控状态">
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
  )
}

export function AppTitleBar({
  appMode,
  onAppModeChange,
  onOpenCodex
}: {
  appMode: AppMode
  onAppModeChange: (mode: AppMode) => void
  onOpenCodex: () => void
}): JSX.Element | null {
  const [enabled] = useState(isMacPlatform)
  const [codexActivity, setCodexActivity] = useState<CodexSessionsSnapshot | null>(null)
  const [codexMonitor, setCodexMonitor] = useState<CodexProjectMonitorSnapshot | null>(null)
  const [codexActivityError, setCodexActivityError] = useState('')
  const [codexRuntime, setCodexRuntime] = useState<AiProviderRuntimeSnapshot | null>(null)
  const [codexQuota, setCodexQuota] = useState<QuotaSnapshot | null>(null)
  const [codexRuntimeError, setCodexRuntimeError] = useState('')
  const [codexRefreshPending, setCodexRefreshPending] = useState(false)
  const [codexPopoverOpen, setCodexPopoverOpen] = useState(false)
  const codexPopoverRef = useRef<HTMLDivElement>(null)
  const codexMountedRef = useRef(true)
  const runningCodexSessions = useMemo(() => codexActivity?.sessions.filter((session) => session.status === 'running').slice(0, 5) ?? [], [codexActivity])
  const weeklyQuota = useMemo(() => selectCodexWeeklyQuotaWindow(codexQuota), [codexQuota])
  const quotaProgress = useMemo(() => getCodexQuotaProgressMeta(weeklyQuota?.remainingPercent), [weeklyQuota])
  const codexNeedsLogin = Boolean(codexRuntime?.installed && !codexRuntime.authenticated)
  const codexButtonStyle = {
    '--codex-progress': `${quotaProgress.percent ?? 0}%`
  } as CSSProperties

  const openCodexWorkspace = (): void => {
    setCodexPopoverOpen(false)
    onOpenCodex()
  }

  async function loadCodexActivity(): Promise<void> {
    if (!window.forgeDesk) return

    try {
      const nextActivity = await window.forgeDesk.listCodexSessions()
      if (!codexMountedRef.current) return
      setCodexActivity(nextActivity)
      setCodexActivityError(nextActivity.available ? '' : '读取失败')
    } catch {
      if (codexMountedRef.current) setCodexActivityError('读取失败')
    }
  }

  async function loadCodexMonitor(): Promise<void> {
    if (!window.forgeDesk) return
    try {
      const nextMonitor = await window.forgeDesk.getCodexProjectMonitorSnapshot()
      if (codexMountedRef.current) setCodexMonitor(nextMonitor)
    } catch {
      // The Codex session status remains useful if the Git monitor is unavailable.
    }
  }

  async function loadCodexRuntime(forceRefresh = false): Promise<void> {
    if (!window.forgeDesk) return

    try {
      const providers = await window.forgeDesk.listAiProviders()
      const nextRuntime = providers.find((item) => item.id === 'codex') ?? null
      let nextQuota: QuotaSnapshot | null = null
      if (codexMountedRef.current) setCodexRuntimeError('')

      if (nextRuntime?.installed && nextRuntime.authenticated) {
        try {
          nextQuota = await window.forgeDesk.getAiProviderQuota({ providerId: 'codex', refresh: forceRefresh })
        } catch (error) {
          if (codexMountedRef.current) setCodexRuntimeError(error instanceof Error ? error.message : '读取周配额失败')
        }
      }

      if (!codexMountedRef.current) return
      setCodexRuntime(nextRuntime)
      setCodexQuota(nextQuota)
    } catch {
      if (codexMountedRef.current) setCodexRuntimeError('读取 Codex 状态失败')
    }
  }

  async function refreshCodexState(forceRefresh = true): Promise<void> {
    setCodexRefreshPending(true)
    try {
      await Promise.all([loadCodexActivity(), loadCodexMonitor(), loadCodexRuntime(forceRefresh)])
    } finally {
      if (codexMountedRef.current) setCodexRefreshPending(false)
    }
  }

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
    if (!enabled || !window.forgeDesk) {
      return undefined
    }

    loadCodexActivity().catch(() => undefined)
    loadCodexMonitor().catch(() => undefined)
    const intervalId = window.setInterval(() => {
      loadCodexActivity().catch(() => undefined)
      loadCodexMonitor().catch(() => undefined)
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !window.forgeDesk) return undefined
    const unsubscribeUpdated = window.forgeDesk.onCodexProjectMonitorUpdated((snapshot) => setCodexMonitor(snapshot))
    return () => unsubscribeUpdated()
  }, [enabled])

  useEffect(() => {
    codexMountedRef.current = true
    if (!enabled || !window.forgeDesk) {
      return () => {
        codexMountedRef.current = false
      }
    }

    loadCodexRuntime().catch(() => undefined)
    const intervalId = window.setInterval(() => {
      loadCodexRuntime().catch(() => undefined)
    }, 60000)

    return () => {
      codexMountedRef.current = false
      window.clearInterval(intervalId)
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
          aria-label={codexNeedsLogin ? 'Codex 已安装但尚未登录' : `Codex 本周剩余配额 ${formatCodexQuotaPercent(quotaProgress.percent)}`}
          className={`app-titlebar-codex is-quota-${quotaProgress.tone}${codexActivity?.running ? ' is-running' : ''}${codexPopoverOpen ? ' is-open' : ''}`}
          style={codexButtonStyle}
          type="button"
          title={codexNeedsLogin ? 'Codex 已安装，但尚未登录，请先登录' : `Codex 本周剩余配额：${formatCodexQuotaPercent(quotaProgress.percent)}`}
          onClick={() => setCodexPopoverOpen((open) => !open)}
        >
          <span className="app-titlebar-codex-mark">⌘</span>
          <span className="app-titlebar-codex-name">Codex</span>
          {codexNeedsLogin ? (
            <span className="app-titlebar-codex-unavailable">请登录</span>
          ) : codexRuntime && !codexRuntime.installed ? (
            <span className="app-titlebar-codex-unavailable">未安装</span>
          ) : codexRuntime ? (
            <span className="app-titlebar-codex-stats">
              <span>进行中 <strong>{codexMonitor?.running ?? codexActivity?.running ?? 0}</strong></span>
              {codexMonitor?.uncommitted ? <span className="app-titlebar-codex-alert-count">未提交 <strong>{codexMonitor.uncommitted}</strong></span> : null}
              <span>本周 <strong>{formatCodexQuotaPercent(quotaProgress.percent)}</strong></span>
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
                <span>{codexNeedsLogin ? '已安装 · 尚未登录' : codexRuntime?.installed ? '本机实时状态' : '正在检测本机状态'}</span>
              </div>
              <button className="app-titlebar-codex-popover-refresh" disabled={codexRefreshPending} type="button" onClick={() => void refreshCodexState(true)}>
                {codexRefreshPending ? '刷新中' : '刷新'}
              </button>
            </div>
            {codexNeedsLogin ? (
              <div className="app-titlebar-codex-login">
                <strong>请先登录 Codex</strong>
                <span>{codexRuntime?.message || '当前没有可用的 Codex 账号，登录后才能读取周配额。'}</span>
                <button type="button" onClick={openCodexWorkspace}>去 AI 工具</button>
              </div>
            ) : codexActivity?.available ? (
              <>
                <div className="app-titlebar-codex-popover-summary">
                  <span><strong>{codexMonitor?.running ?? codexActivity.running}</strong> 进行中</span>
                  <span className={codexMonitor?.uncommitted ? 'is-alert' : undefined}><strong>{codexMonitor?.uncommitted ?? 0}</strong> 未提交</span>
                  <span><strong>{codexActivity.completed.toLocaleString()}</strong> 已完成</span>
                  <span><strong>{codexActivity.sessions.length}</strong> 会话</span>
                </div>
                <div className={`app-titlebar-codex-quota is-${quotaProgress.tone}`}>
                  <div className="app-titlebar-codex-quota-heading">
                    <div>
                      <strong>本周剩余配额</strong>
                      <span>{weeklyQuota ? '当前 7 天窗口' : codexRuntimeError || '官方暂未返回 7 天配额'}</span>
                    </div>
                    <strong>{formatCodexQuotaPercent(quotaProgress.percent)}</strong>
                  </div>
                  <div className="app-titlebar-codex-quota-track" aria-hidden="true">
                    <span style={{ width: `${quotaProgress.percent ?? 0}%` }} />
                  </div>
                  <div className="app-titlebar-codex-quota-meta">
                    <span>{weeklyQuota?.usedPercent === null || weeklyQuota?.usedPercent === undefined ? '已用未知' : `已用 ${formatCodexQuotaPercent(weeklyQuota.usedPercent)}`}</span>
                    <span>{weeklyQuota ? formatCodexResetAt(weeklyQuota.resetAt) : '重置时间未知'}</span>
                  </div>
                </div>
                <section className="app-titlebar-codex-popover-section">
                  <div className="app-titlebar-codex-popover-section-title">进行中</div>
                  {runningCodexSessions.length > 0 ? runningCodexSessions.map((session) => (
                    <button className="app-titlebar-codex-popover-session is-running" key={session.id} type="button" onClick={openCodexWorkspace}>
                      <span className="app-titlebar-codex-popover-session-title">{session.title}</span>
                      <span className="app-titlebar-codex-popover-session-meta">项目：{codexSessionProject(session)} · {session.preview || '正在处理'}</span>
                    </button>
                  )) : <div className="app-titlebar-codex-popover-empty">当前没有正在运行的会话</div>}
                </section>
              </>
            ) : (
              <div className="app-titlebar-codex-popover-error">{codexRuntime?.message || codexActivityError || codexActivity?.error || '尚未读取到本机 Codex 会话'}</div>
            )}
            <button className="app-titlebar-codex-popover-footer" type="button" onClick={openCodexWorkspace}>查看全部会话 <span>›</span></button>
          </div>
        ) : null}
      </div>
      <div className="app-titlebar-actions">
        <AppModeSwitcher mode={appMode} onChange={onAppModeChange} />
      </div>
    </header>
  )
}
