import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  appendSystemMonitorHistoryPoint,
  createSystemMonitorHardwareMetrics,
  createSystemMonitorHistoryPoint,
  createSystemMonitorSummary,
  formatBytes,
  formatDurationSeconds,
  formatNetworkPort,
  formatPercent,
  formatProxyEndpoint,
  formatStorageBytes,
  formatSystemMonitorHistoryValue,
  getSystemMonitorHistoryValue,
  getClashStatusMeta,
  getSystemMonitorStatusMeta,
  normalizeSystemMonitorHistory,
  normalizeSystemMonitorOverviewHardwareKeys
} from './system-monitor-view.js'
import type { SystemMonitorSnapshot } from './data.js'

const snapshot: SystemMonitorSnapshot = {
  app: {
    appPath: '/Applications/ForgeDesk.app',
    chromeVersion: '130.0.0',
    electronVersion: '33.2.1',
    isDevelopmentBuild: false,
    isDevServer: false,
    isPackaged: true,
    nodeVersion: '22.10.2',
    processId: 1234,
    projectRoot: '/Users/stone/Dev/ForgeDesk',
    uptimeSeconds: 3600,
    v8Version: '13.0.0',
    version: '1.0.8'
  },
  checkedAt: '2026-07-15T08:00:00.000Z',
  cpu: {
    coreCount: 10,
    loadAverage: [2, 1.5, 1],
    loadPercent: 20,
    model: 'Apple M4',
    speedMhz: 3200
  },
  diskError: '',
  disks: [
    {
      availableBytes: 20 * 1024 ** 3,
      filesystem: '/dev/disk3s5',
      mount: '/',
      totalBytes: 100 * 1024 ** 3,
      usagePercent: 80,
      usedBytes: 80 * 1024 ** 3
    },
    {
      availableBytes: 5 * 1024 ** 3,
      filesystem: '/dev/disk3s1',
      mount: '/System/Volumes/Data',
      totalBytes: 100 * 1024 ** 3,
      usagePercent: 95,
      usedBytes: 95 * 1024 ** 3
    }
  ],
  memory: {
    freeBytes: 4 * 1024 ** 3,
    totalBytes: 16 * 1024 ** 3,
    usagePercent: 75,
    usedBytes: 12 * 1024 ** 3
  },
  network: {
    clash: {
      activeProxyGroups: [{ name: 'Proxy', now: 'Hong Kong 01', type: 'Selector' }],
      allowLan: false,
      apiAvailable: true,
      configPath: '/Users/stone/.config/clash.meta/config.yaml',
      connectionCount: 3,
      controllerUrl: 'http://127.0.0.1:9090',
      detected: true,
      downloadSpeedBytes: 1024,
      downloadTotalBytes: 2048,
      error: '',
      httpPort: 0,
      message: 'ClashX Meta 控制接口已连接',
      mixedPort: 7890,
      mode: 'rule',
      name: 'ClashX Meta',
      redirPort: 0,
      running: true,
      secretConfigured: false,
      socksPort: 7891,
      status: 'connected',
      tproxyPort: 0,
      uploadSpeedBytes: 512,
      uploadTotalBytes: 1024,
      version: '1.19.0'
    },
    dnsServers: ['192.168.31.1'],
    interfaces: [],
    proxy: {
      available: true,
      bypass: [],
      enabled: true,
      error: '',
      http: { enabled: true, host: '127.0.0.1', port: 7890 },
      https: { enabled: false, host: '', port: 0 },
      pac: { enabled: false, url: '' },
      socks: { enabled: true, host: '127.0.0.1', port: 7891 },
      source: 'macos'
    },
    route: {
      error: '',
      gateway: '192.168.31.1',
      interface: 'en0'
    }
  },
  status: 'warning',
  statusMessage: '资源使用接近阈值，建议留意后续变化。',
  system: {
    arch: 'arm64',
    hostname: 'forgebook',
    platform: 'darwin',
    release: '25.0.0',
    uptimeSeconds: 90061
  }
}

describe('system monitor view model', () => {
  it('formats bytes with stable units', () => {
    assert.equal(formatBytes(0), '0 B')
    assert.equal(formatBytes(1024), '1.0 KB')
    assert.equal(formatBytes(12 * 1024 ** 3), '12 GB')
    assert.equal(formatStorageBytes(245_110_267_904), '245.11 GB')
  })

  it('formats percentages and durations', () => {
    assert.equal(formatPercent(74.6), '75%')
    assert.equal(formatPercent(Number.NaN), '0%')
    assert.equal(formatDurationSeconds(45), '45 秒')
    assert.equal(formatDurationSeconds(3660), '1 小时 1 分钟')
    assert.equal(formatDurationSeconds(90061), '1 天 1 小时')
  })

  it('maps system status to readable meta', () => {
    assert.deepEqual(getSystemMonitorStatusMeta('healthy'), { badgeStatus: 'success', color: 'green', label: '正常' })
    assert.deepEqual(getSystemMonitorStatusMeta('warning'), { badgeStatus: 'warning', color: 'gold', label: '警告' })
    assert.deepEqual(getSystemMonitorStatusMeta('critical'), { badgeStatus: 'error', color: 'red', label: '严重' })
  })

  it('maps Clash status and formats proxy endpoints', () => {
    assert.deepEqual(getClashStatusMeta('connected'), { badgeStatus: 'success', color: 'green', label: '已连接' })
    assert.deepEqual(getClashStatusMeta('auth-required'), { badgeStatus: 'warning', color: 'gold', label: '需要密钥' })
    assert.equal(formatProxyEndpoint({ enabled: true, host: '127.0.0.1', port: 7890 }), '127.0.0.1:7890')
    assert.equal(formatProxyEndpoint({ enabled: false, host: '', port: 0 }), '未启用')
    assert.equal(formatNetworkPort(7890), '7890')
    assert.equal(formatNetworkPort(0), '-')
  })

  it('summarizes primary and max disk usage', () => {
    assert.deepEqual(createSystemMonitorSummary(snapshot), {
      maxDiskUsagePercent: 95,
      primaryDisk: snapshot.disks[0]
    })
  })

  it('creates independent hardware metrics for overview and drill-down views', () => {
    const metrics = createSystemMonitorHardwareMetrics(snapshot)

    assert.deepEqual(metrics.map((metric) => metric.key), ['cpu', 'memory', 'storage', 'network'])
    assert.equal(metrics.find((metric) => metric.key === 'cpu')?.displayValue, '20%')
    assert.equal(metrics.find((metric) => metric.key === 'memory')?.status, 'warning')
    assert.equal(metrics.find((metric) => metric.key === 'storage')?.status, 'critical')
    assert.equal(metrics.find((metric) => metric.key === 'network')?.displayValue, '1.5 KB/s')
  })

  it('stores bounded hardware history points by metric key', () => {
    const firstPoint = createSystemMonitorHistoryPoint(snapshot)
    const secondPoint = { ...firstPoint, checkedAt: '2026-07-15T08:01:00.000Z', cpuLoadPercent: 30 }
    const history = appendSystemMonitorHistoryPoint([firstPoint], secondPoint)

    assert.equal(history.length, 2)
    assert.equal(getSystemMonitorHistoryValue(secondPoint, 'cpu'), 30)
    assert.equal(formatSystemMonitorHistoryValue('network', secondPoint.networkSpeedBytes), '1.5 KB/s')
    assert.equal(
      normalizeSystemMonitorHistory(
        [...Array(300)].map((_, index) => ({
          ...firstPoint,
          checkedAt: new Date(Date.UTC(2026, 6, 15, 8, index, 0)).toISOString()
        }))
      ).length,
      288
    )
  })

  it('normalizes overview hardware preferences', () => {
    assert.deepEqual(normalizeSystemMonitorOverviewHardwareKeys(['cpu', 'nope', 'memory', 'cpu']), ['cpu', 'memory'])
    assert.deepEqual(normalizeSystemMonitorOverviewHardwareKeys(null), ['cpu', 'memory', 'storage'])
  })
})
