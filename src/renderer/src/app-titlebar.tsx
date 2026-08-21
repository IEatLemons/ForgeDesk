import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import ReactECharts from 'echarts-for-react'
import type { CodexProjectMonitorSnapshot, CodexSessionSummary, CodexSessionsSnapshot, CodexUncommittedAlert, SystemMonitorSnapshot } from './data'
import { formatCodexQuotaPercent, formatCodexResetAt, getCodexQuotaProgressMeta, selectCodexWeeklyQuotaWindow, sortCodexUncommittedAlerts } from './codex-titlebar-state'
import {
  SYSTEM_MONITOR_HARDWARE_LABELS,
  createSystemMonitorHardwareMetrics,
  formatSystemMonitorHistoryValue,
  getSystemMonitorHistoryValue,
  getSystemMonitorStatusMeta,
  readStoredSystemMonitorHistory,
  readStoredSystemMonitorOverviewHardwareKeys,
  rememberSystemMonitorSnapshot,
  systemMonitorOverviewHardwareChangedEvent,
  type SystemMonitorHardwareKey,
  type SystemMonitorHistoryPoint
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

function codexAlertProject(alert: CodexUncommittedAlert): string {
  return alert.projectName || alert.cwd.split(/[\\/]/).filter(Boolean).pop() || '未记录项目'
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

function getSystemMonitorChartColor(key: SystemMonitorHardwareKey): string {
  switch (key) {
    case 'cpu':
      return '#1677ff'
    case 'memory':
      return '#13c2c2'
    case 'storage':
      return '#faad14'
    case 'network':
      return '#52c41a'
  }
}

function formatSystemMonitorChartTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function createSystemMonitorPopoverChartOption(
  history: SystemMonitorHistoryPoint[],
  visibleMetrics: ReturnType<typeof createSystemMonitorHardwareMetrics>
): Record<string, unknown> {
  const visibleHistory = history.slice(-36)
  const visibleKeys = visibleMetrics.map((metric) => metric.key)
  const hasPercentMetric = visibleKeys.some((key) => key !== 'network')
  const hasNetworkMetric = visibleKeys.includes('network')
  const yAxis: Array<Record<string, unknown>> = [
    {
      axisLabel: { color: '#8c8c8c', formatter: (value: number) => `${Math.round(value)}%` },
      max: 100,
      min: 0,
      name: hasPercentMetric ? '使用率' : '',
      nameTextStyle: { color: '#8c8c8c', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(140, 140, 140, 0.16)' } },
      type: 'value'
    }
  ]

  if (hasNetworkMetric) {
    yAxis.push({
      axisLabel: { color: '#8c8c8c', formatter: (value: number) => formatSystemMonitorHistoryValue('network', value) },
      min: 0,
      name: '速率',
      nameTextStyle: { color: '#8c8c8c', fontSize: 10 },
      position: 'right',
      splitLine: { show: false },
      type: 'value'
    })
  }

  return {
    animation: false,
    color: visibleKeys.map(getSystemMonitorChartColor),
    grid: { bottom: 22, containLabel: true, left: 8, right: hasNetworkMetric ? 8 : 4, top: 32 },
    legend: {
      data: visibleKeys.map((key) => SYSTEM_MONITOR_HARDWARE_LABELS[key]),
      itemHeight: 8,
      itemWidth: 8,
      left: 0,
      textStyle: { color: '#667085', fontSize: 10 },
      top: 0
    },
    tooltip: {
      axisPointer: { type: 'line' },
      formatter: (params: Array<{ axisValue: string; data: number; seriesName: string; seriesIndex: number }>) => {
        const lines = params.map((item) => {
          const key = visibleKeys[item.seriesIndex]
          return `${item.seriesName}：${formatSystemMonitorHistoryValue(key, Number(item.data))}`
        })
        return `${params[0]?.axisValue ?? ''}<br/>${lines.join('<br/>')}`
      },
      trigger: 'axis'
    },
    xAxis: {
      axisLabel: { color: '#8c8c8c', fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: 'rgba(140, 140, 140, 0.24)' } },
      axisTick: { show: false },
      boundaryGap: false,
      data: visibleHistory.map((point) => formatSystemMonitorChartTime(point.checkedAt)),
      type: 'category'
    },
    yAxis,
    series: visibleKeys.map((key) => ({
      areaStyle: visibleKeys.length === 1 ? { opacity: 0.1 } : undefined,
      data: visibleHistory.map((point) => getSystemMonitorHistoryValue(point, key)),
      lineStyle: { width: 2 },
      name: SYSTEM_MONITOR_HARDWARE_LABELS[key],
      smooth: true,
      symbol: 'none',
      type: 'line',
      yAxisIndex: key === 'network' && hasPercentMetric ? 1 : 0
    }))
  }
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
  const [history, setHistory] = useState<SystemMonitorHistoryPoint[]>(() => readStoredSystemMonitorHistory())
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

        const nextHistory = rememberSystemMonitorSnapshot(nextSnapshot)
        setHistory(nextHistory)
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

    setHistory(readStoredSystemMonitorHistory())

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

      const nextHistory = rememberSystemMonitorSnapshot(nextSnapshot)
      setHistory(nextHistory)
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
            <>
              <div className="app-titlebar-system-popover-chart-heading">
                <strong>最近 36 次采样</strong>
                <span>{history.length > 1 ? '每分钟更新一次' : '历史采样正在积累'}</span>
              </div>
              {history.length > 1 ? (
                <ReactECharts
                  className="app-titlebar-system-popover-chart"
                  option={createSystemMonitorPopoverChartOption(history, visibleMetrics)}
                  notMerge
                  lazyUpdate
                />
              ) : (
                <div className="app-titlebar-system-popover-chart-empty">保持弹窗或电脑监控页面打开，即可看到历史曲线</div>
              )}
              <div className="app-titlebar-system-popover-metrics">
                {visibleMetrics.map((metric) => (
                  <div className="app-titlebar-system-popover-metric" key={metric.key}>
                    <span>{metric.label}</span>
                    <strong>{metric.displayValue}</strong>
                  </div>
                ))}
              </div>
            </>
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
  onOpenCodex,
  onOpenCodexMonitor,
  onOpenForgeProject
}: {
  appMode: AppMode
  onAppModeChange: (mode: AppMode) => void
  onOpenCodex: () => void
  onOpenCodexMonitor: () => void
  onOpenForgeProject: (projectId: string) => void
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
  // Keep the title-bar number and its running list on the same monitor
  // snapshot. Previously the number came from the project monitor while the
  // list came from a separate session poll, so their refreshes could race.
  const codexStatusSessions = codexMonitor?.sessions ?? codexActivity?.sessions ?? []
  const codexRunningCount = codexMonitor?.running ?? codexActivity?.running ?? 0
  const codexCompletedCount = codexMonitor?.completed ?? codexActivity?.completed ?? 0
  const runningCodexSessions = useMemo(() => codexStatusSessions.filter((session) => session.status === 'running').slice(0, 5), [codexStatusSessions])
  const uncommittedCodexAlerts = useMemo(() => sortCodexUncommittedAlerts(codexMonitor?.alerts ?? []), [codexMonitor?.alerts])
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

  const openCodexMonitor = (): void => {
    setCodexPopoverOpen(false)
    onOpenCodexMonitor()
  }

  function findAlertProject(alert: CodexUncommittedAlert): CodexProjectMonitorSnapshot['projects'][number] | null {
    return codexMonitor?.projects.find((project) => project.key === alert.codexKey) ?? null
  }

  function getAlertTitle(alert: CodexUncommittedAlert): string {
    const project = findAlertProject(alert)
    if (alert.sourceType === 'task') {
      return project?.tasks.find((task) => task.id === alert.sourceId)?.title || '已完成的 Codex 任务'
    }
    return project?.sessions.find((session) => session.id === alert.sourceId)?.title || '已完成的 Codex 会话'
  }

  function getAlertProjectName(alert: CodexUncommittedAlert): string {
    const project = findAlertProject(alert)
    return alert.projectName || project?.forgeProjectName || codexAlertProject(alert)
  }

  function openCodexAlert(alert: CodexUncommittedAlert): void {
    setCodexPopoverOpen(false)
    if (alert.projectId) {
      onOpenForgeProject(alert.projectId)
      return
    }
    onOpenCodexMonitor()
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
              <span>进行中 <strong>{codexRunningCount}</strong></span>
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
            ) : codexActivity?.available || codexMonitor?.available ? (
              <>
                <div className="app-titlebar-codex-popover-summary">
                  <span><strong>{codexRunningCount}</strong> 进行中</span>
                  <span className={codexMonitor?.uncommitted ? 'is-alert' : undefined}><strong>{codexMonitor?.uncommitted ?? 0}</strong> 未提交</span>
                  <span><strong>{codexCompletedCount.toLocaleString()}</strong> 已完成</span>
                  <span><strong>{codexStatusSessions.length}</strong> 会话</span>
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
                    <span>{weeklyQuota ? formatCodexResetAt(weeklyQuota.resetAt) : '下次重置：未知'}</span>
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
                <section className="app-titlebar-codex-popover-section is-alerts">
                  <div className="app-titlebar-codex-popover-section-title">
                    <span>最近完成但未提交</span>
                    <strong>{uncommittedCodexAlerts.length}</strong>
                  </div>
                  {uncommittedCodexAlerts.length > 0 ? (
                    <div className="app-titlebar-codex-alert-list">
                      {uncommittedCodexAlerts.map((alert) => (
                        <button
                          aria-label={`${getAlertTitle(alert)}，${alert.projectId ? '进入项目' : '打开 Codex 监控'}`}
                          className={`app-titlebar-codex-popover-session is-alert${alert.projectId ? '' : ' is-unlinked'}`}
                          key={alert.id}
                          title={alert.projectId ? '进入 ForgeDesk 项目详情' : '该任务未关联 ForgeDesk 项目，将打开 Codex 监控'}
                          type="button"
                          onClick={() => openCodexAlert(alert)}
                        >
                          <span className="app-titlebar-codex-popover-session-title">{getAlertTitle(alert)}</span>
                          <span className="app-titlebar-codex-popover-session-meta">
                            {alert.projectId ? `项目：${getAlertProjectName(alert)}` : '未关联 ForgeDesk 项目'} · {alert.sourceType === 'task' ? '内置任务' : '会话'} · {formatRelativeTime(alert.completedAt)}
                          </span>
                          <span className="app-titlebar-codex-popover-session-meta">
                            {alert.filesChanged} 个文件 · +{alert.additions} -{alert.deletions} · {alert.projectId ? '进入项目 ›' : '打开监控 ›'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : <div className="app-titlebar-codex-popover-empty">暂无刚完成但未提交的任务</div>}
                </section>
              </>
            ) : (
              <div className="app-titlebar-codex-popover-error">{codexRuntime?.message || codexActivityError || codexActivity?.error || '尚未读取到本机 Codex 会话'}</div>
            )}
            <button className="app-titlebar-codex-popover-footer" type="button" onClick={openCodexMonitor}>查看全部 Codex 监控 <span>›</span></button>
          </div>
        ) : null}
      </div>
      <div className="app-titlebar-actions">
        <AppModeSwitcher mode={appMode} onChange={onAppModeChange} />
      </div>
    </header>
  )
}
