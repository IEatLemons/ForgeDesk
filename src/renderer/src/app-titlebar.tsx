import { useEffect, useMemo, useState } from 'react'
import type { SystemMonitorSnapshot } from './data'
import {
  createSystemMonitorHardwareMetrics,
  getSystemMonitorStatusMeta,
  readStoredSystemMonitorOverviewHardwareKeys,
  rememberSystemMonitorSnapshot,
  systemMonitorOverviewHardwareChangedEvent,
  type SystemMonitorHardwareKey
} from './system-monitor-view'

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

export function AppTitleBar({ onOpenSystemMonitor }: { onOpenSystemMonitor: () => void }): JSX.Element | null {
  const [enabled] = useState(isMacPlatform)
  const [snapshot, setSnapshot] = useState<SystemMonitorSnapshot | null>(null)
  const [overviewHardwareKeys, setOverviewHardwareKeys] = useState<SystemMonitorHardwareKey[]>(() => readStoredSystemMonitorOverviewHardwareKeys())
  const [error, setError] = useState('')
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
      <button className="app-titlebar-system-strip" type="button" onClick={onOpenSystemMonitor}>
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
    </header>
  )
}
