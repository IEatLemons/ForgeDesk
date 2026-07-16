import type { SystemMonitorClashInfo, SystemMonitorDiskVolume, SystemMonitorProxyEndpoint, SystemMonitorSnapshot, SystemMonitorStatus } from './data'

type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning'

export type SystemMonitorStatusMeta = {
  label: string
  color: string
  badgeStatus: BadgeStatus
}

export type SystemMonitorSummary = {
  maxDiskUsagePercent: number
  primaryDisk: SystemMonitorDiskVolume | null
}

export type SystemMonitorHardwareKey = 'cpu' | 'memory' | 'storage' | 'network'

export type SystemMonitorHardwareMetric = {
  key: SystemMonitorHardwareKey
  label: string
  description: string
  value: number
  displayValue: string
  detail: string
  status: SystemMonitorStatus
  unit: 'percent' | 'bytes-per-second'
}

export type SystemMonitorHistoryPoint = {
  checkedAt: string
  hostname: string
  cpuLoadPercent: number
  memoryUsagePercent: number
  storageUsagePercent: number
  networkSpeedBytes: number
}

export const systemMonitorHistoryStorageKey = 'forgedesk.systemMonitor.history'
export const systemMonitorOverviewHardwareStorageKey = 'forgedesk.systemMonitor.overviewHardware'
export const systemMonitorOverviewHardwareChangedEvent = 'forgedesk:system-monitor-overview-hardware-changed'
export const defaultSystemMonitorOverviewHardwareKeys: SystemMonitorHardwareKey[] = ['cpu', 'memory', 'storage']

export const SYSTEM_MONITOR_HARDWARE_LABELS: Record<SystemMonitorHardwareKey, string> = {
  cpu: 'CPU',
  memory: '内存',
  network: '网络',
  storage: '存储'
}

const hardwareKeys: SystemMonitorHardwareKey[] = ['cpu', 'memory', 'storage', 'network']
const systemMonitorHistoryLimit = 288
const usageWarningThreshold = 75
const usageCriticalThreshold = 90

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const precision = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unitIndex]}`
}

export function formatStorageBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let unitIndex = 0

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000
    unitIndex += 1
  }

  const precision = unitIndex >= 3 ? 2 : size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unitIndex]}`
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%'
  }

  return `${Math.round(Math.max(0, value))}%`
}

export function formatDurationSeconds(value: number): string {
  const seconds = Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
  }

  if (minutes > 0) {
    return `${minutes} 分钟`
  }

  return `${seconds} 秒`
}

export function getSystemMonitorStatusMeta(status: SystemMonitorStatus): SystemMonitorStatusMeta {
  switch (status) {
    case 'critical':
      return { badgeStatus: 'error', color: 'red', label: '严重' }
    case 'warning':
      return { badgeStatus: 'warning', color: 'gold', label: '警告' }
    default:
      return { badgeStatus: 'success', color: 'green', label: '正常' }
  }
}

export function getClashStatusMeta(status: SystemMonitorClashInfo['status']): SystemMonitorStatusMeta {
  switch (status) {
    case 'connected':
      return { badgeStatus: 'success', color: 'green', label: '已连接' }
    case 'auth-required':
      return { badgeStatus: 'warning', color: 'gold', label: '需要密钥' }
    case 'not-running':
      return { badgeStatus: 'default', color: 'default', label: '未连接' }
    default:
      return { badgeStatus: 'warning', color: 'gold', label: '未知' }
  }
}

export function formatProxyEndpoint(endpoint: SystemMonitorProxyEndpoint): string {
  if (!endpoint.enabled) {
    return '未启用'
  }

  return endpoint.port > 0 ? `${endpoint.host}:${endpoint.port}` : endpoint.host || '已启用'
}

export function formatNetworkPort(value: number): string {
  return value > 0 ? String(value) : '-'
}

export function createSystemMonitorSummary(snapshot: SystemMonitorSnapshot): SystemMonitorSummary {
  const primaryDisk = snapshot.disks.find((disk) => disk.mount === '/') ?? snapshot.disks[0] ?? null
  const maxDiskUsagePercent = snapshot.disks.reduce((max, disk) => Math.max(max, disk.usagePercent), 0)

  return {
    maxDiskUsagePercent,
    primaryDisk
  }
}

function getUsageStatus(value: number): SystemMonitorStatus {
  if (value >= usageCriticalThreshold) {
    return 'critical'
  }

  if (value >= usageWarningThreshold) {
    return 'warning'
  }

  return 'healthy'
}

function toFinitePercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isSystemMonitorHardwareKey(value: unknown): value is SystemMonitorHardwareKey {
  return typeof value === 'string' && hardwareKeys.includes(value as SystemMonitorHardwareKey)
}

function isSystemMonitorHistoryPoint(value: unknown): value is SystemMonitorHistoryPoint {
  if (!value || typeof value !== 'object') {
    return false
  }

  const point = value as Partial<SystemMonitorHistoryPoint>
  return (
    typeof point.checkedAt === 'string' &&
    typeof point.hostname === 'string' &&
    typeof point.cpuLoadPercent === 'number' &&
    typeof point.memoryUsagePercent === 'number' &&
    typeof point.storageUsagePercent === 'number' &&
    typeof point.networkSpeedBytes === 'number'
  )
}

export function normalizeSystemMonitorOverviewHardwareKeys(value: unknown): SystemMonitorHardwareKey[] {
  if (!Array.isArray(value)) {
    return [...defaultSystemMonitorOverviewHardwareKeys]
  }

  const keys = value.filter(isSystemMonitorHardwareKey)
  return [...new Set(keys)]
}

export function readStoredSystemMonitorOverviewHardwareKeys(): SystemMonitorHardwareKey[] {
  const storage = getBrowserStorage()
  const stored = storage?.getItem(systemMonitorOverviewHardwareStorageKey)

  if (!stored) {
    return [...defaultSystemMonitorOverviewHardwareKeys]
  }

  try {
    return normalizeSystemMonitorOverviewHardwareKeys(JSON.parse(stored))
  } catch {
    return [...defaultSystemMonitorOverviewHardwareKeys]
  }
}

export function writeStoredSystemMonitorOverviewHardwareKeys(keys: SystemMonitorHardwareKey[]): SystemMonitorHardwareKey[] {
  const nextKeys = normalizeSystemMonitorOverviewHardwareKeys(keys)
  const storage = getBrowserStorage()

  storage?.setItem(systemMonitorOverviewHardwareStorageKey, JSON.stringify(nextKeys))

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(systemMonitorOverviewHardwareChangedEvent, { detail: nextKeys }))
  }

  return nextKeys
}

export function normalizeSystemMonitorHistory(value: unknown): SystemMonitorHistoryPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isSystemMonitorHistoryPoint)
    .map((point) => ({
      checkedAt: point.checkedAt,
      cpuLoadPercent: toFinitePercent(point.cpuLoadPercent),
      hostname: point.hostname,
      memoryUsagePercent: toFinitePercent(point.memoryUsagePercent),
      networkSpeedBytes: Math.max(0, Number.isFinite(point.networkSpeedBytes) ? point.networkSpeedBytes : 0),
      storageUsagePercent: toFinitePercent(point.storageUsagePercent)
    }))
    .sort((left, right) => new Date(left.checkedAt).getTime() - new Date(right.checkedAt).getTime())
    .slice(-systemMonitorHistoryLimit)
}

export function readStoredSystemMonitorHistory(): SystemMonitorHistoryPoint[] {
  const storage = getBrowserStorage()
  const stored = storage?.getItem(systemMonitorHistoryStorageKey)

  if (!stored) {
    return []
  }

  try {
    return normalizeSystemMonitorHistory(JSON.parse(stored))
  } catch {
    return []
  }
}

export function writeStoredSystemMonitorHistory(history: SystemMonitorHistoryPoint[]): SystemMonitorHistoryPoint[] {
  const nextHistory = normalizeSystemMonitorHistory(history)
  const storage = getBrowserStorage()

  storage?.setItem(systemMonitorHistoryStorageKey, JSON.stringify(nextHistory))

  return nextHistory
}

export function createSystemMonitorHardwareMetrics(snapshot: SystemMonitorSnapshot): SystemMonitorHardwareMetric[] {
  const summary = createSystemMonitorSummary(snapshot)
  const activeInterfaces = snapshot.network.interfaces.filter((item) => !item.internal)
  const networkSpeedBytes = snapshot.network.clash.downloadSpeedBytes + snapshot.network.clash.uploadSpeedBytes
  const storageUsagePercent = summary.maxDiskUsagePercent
  const primaryDiskDetail = summary.primaryDisk
    ? `${summary.primaryDisk.mount === '/' ? 'Macintosh HD' : summary.primaryDisk.mount} 可用 ${formatStorageBytes(summary.primaryDisk.availableBytes)}`
    : '未读取到磁盘数据'
  const routeDetail = snapshot.network.route.interface
    ? `出口 ${snapshot.network.route.interface}${snapshot.network.route.gateway ? ` · 网关 ${snapshot.network.route.gateway}` : ''}`
    : '未识别默认出口'

  return [
    {
      description: `${snapshot.cpu.coreCount} 核 · ${snapshot.cpu.model}`,
      detail: `1 分钟负载 ${snapshot.cpu.loadAverage[0] ?? 0} / ${snapshot.cpu.coreCount} 核`,
      displayValue: formatPercent(snapshot.cpu.loadPercent),
      key: 'cpu',
      label: SYSTEM_MONITOR_HARDWARE_LABELS.cpu,
      status: getUsageStatus(snapshot.cpu.loadPercent),
      unit: 'percent',
      value: toFinitePercent(snapshot.cpu.loadPercent)
    },
    {
      description: `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}`,
      detail: `剩余 ${formatBytes(snapshot.memory.freeBytes)}`,
      displayValue: formatPercent(snapshot.memory.usagePercent),
      key: 'memory',
      label: SYSTEM_MONITOR_HARDWARE_LABELS.memory,
      status: getUsageStatus(snapshot.memory.usagePercent),
      unit: 'percent',
      value: toFinitePercent(snapshot.memory.usagePercent)
    },
    {
      description: primaryDiskDetail,
      detail: snapshot.disks.length > 1 ? `${snapshot.disks.length} 个卷宗 · 最高使用 ${formatPercent(storageUsagePercent)}` : primaryDiskDetail,
      displayValue: snapshot.disks.length > 0 ? formatPercent(storageUsagePercent) : '-',
      key: 'storage',
      label: SYSTEM_MONITOR_HARDWARE_LABELS.storage,
      status: getUsageStatus(storageUsagePercent),
      unit: 'percent',
      value: toFinitePercent(storageUsagePercent)
    },
    {
      description: `${activeInterfaces.length} 个活动接口`,
      detail: routeDetail,
      displayValue: `${formatBytes(networkSpeedBytes)}/s`,
      key: 'network',
      label: SYSTEM_MONITOR_HARDWARE_LABELS.network,
      status: activeInterfaces.length > 0 ? 'healthy' : 'warning',
      unit: 'bytes-per-second',
      value: Math.max(0, networkSpeedBytes)
    }
  ]
}

export function createSystemMonitorHistoryPoint(snapshot: SystemMonitorSnapshot): SystemMonitorHistoryPoint {
  const summary = createSystemMonitorSummary(snapshot)

  return {
    checkedAt: snapshot.checkedAt,
    cpuLoadPercent: toFinitePercent(snapshot.cpu.loadPercent),
    hostname: snapshot.system.hostname,
    memoryUsagePercent: toFinitePercent(snapshot.memory.usagePercent),
    networkSpeedBytes: Math.max(0, snapshot.network.clash.downloadSpeedBytes + snapshot.network.clash.uploadSpeedBytes),
    storageUsagePercent: toFinitePercent(summary.maxDiskUsagePercent)
  }
}

export function appendSystemMonitorHistoryPoint(history: SystemMonitorHistoryPoint[], point: SystemMonitorHistoryPoint): SystemMonitorHistoryPoint[] {
  return normalizeSystemMonitorHistory([...history.filter((item) => item.checkedAt !== point.checkedAt), point])
}

export function rememberSystemMonitorSnapshot(snapshot: SystemMonitorSnapshot): SystemMonitorHistoryPoint[] {
  const nextHistory = appendSystemMonitorHistoryPoint(readStoredSystemMonitorHistory(), createSystemMonitorHistoryPoint(snapshot))
  return writeStoredSystemMonitorHistory(nextHistory)
}

export function getSystemMonitorHistoryValue(point: SystemMonitorHistoryPoint, key: SystemMonitorHardwareKey): number {
  switch (key) {
    case 'cpu':
      return point.cpuLoadPercent
    case 'memory':
      return point.memoryUsagePercent
    case 'storage':
      return point.storageUsagePercent
    case 'network':
      return point.networkSpeedBytes
  }
}

export function formatSystemMonitorHistoryValue(key: SystemMonitorHardwareKey, value: number): string {
  if (key === 'network') {
    return `${formatBytes(value)}/s`
  }

  return formatPercent(value)
}
