import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { cpus, homedir } from 'node:os'
import type Database from 'better-sqlite3'

export type ResourceDatabase = Database.Database

export type ResourceProcess = {
  identityKey: string
  instanceKey: string
  pid: number
  parentPid: number
  appName: string
  processName: string
  user: string
  cpuPercent: number
  memoryBytes: number
  privateMemoryBytes: number
  virtualMemoryBytes: number
  threadCount: number
  portCount: number
  pageIns: number
  state: string
  elapsedSeconds: number
  executablePath: string
  bundlePath: string
  command: string
  networkReceivedBytes: number
  networkSentBytes: number
}

export type ResourceHistoryPoint = {
  capturedAt: string
  cpuPercent: number
  memoryUsagePercent: number
  memoryUsedBytes: number
  swapUsedBytes: number
  storageUsagePercent: number
  networkInBytes?: number
  networkOutBytes?: number
}

export type ProcessHistoryPoint = {
  capturedAt: string
  cpuAverage: number
  cpuPeak: number
  memoryAverageBytes: number
  memoryPeakBytes: number
  sampleCount: number
  networkInBytes: number
  networkOutBytes: number
}

export type ProcessAnalysis = {
  identityKey: string
  appName: string
  processName: string
  executablePath: string
  averageCpuPercent: number
  peakCpuPercent: number
  averageMemoryBytes: number
  peakMemoryBytes: number
  sampleCount: number
  aboveThresholdSeconds: number
  firstSeenAt: string
  lastSeenAt: string
  networkReceivedBytes: number
  networkSentBytes: number
}

export type ResourceRetentionStatus = {
  rawDays: number
  fiveMinuteDays: number
  sampleIntervalSeconds: number
  rawSampleCount: number
  rollupSampleCount: number
  oldestRawAt: string
  databaseBytesEstimate: number
}

export type StorageRoot = {
  id: string
  path: string
  label: string
  enabled: boolean
  source: 'manual' | 'project' | 'category'
  createdAt: string
  lastScannedAt: string
}

export type CleanupRisk = 'low' | 'confirm' | 'high' | 'protected'
export type CleanupCategory = 'large-file' | 'stale-file' | 'duplicate-candidate' | 'download' | 'cache' | 'log' | 'development' | 'docker' | 'trash' | 'protected'

export type StorageScanItem = {
  id: string
  scanId: string
  rootId: string
  path: string
  name: string
  sizeBytes: number
  modifiedAt: string
  accessedAt: string
  extension: string
  category: CleanupCategory
  risk: CleanupRisk
  reason: string
  duplicateKey: string
  verifiedHash: string
  isDirectory: boolean
}

export type StorageScanRun = {
  id: string
  mode: 'quick' | 'deep'
  status: 'running' | 'paused' | 'completed' | 'failed'
  startedAt: string
  finishedAt: string
  filesScanned: number
  directoriesScanned: number
  bytesScanned: number
  reclaimableBytes: number
  errorCount: number
  errors: string[]
}

export type CleanupPolicy = {
  key: CleanupCategory
  label: string
  description: string
  enabled: boolean
  risk: CleanupRisk
  thresholdBytes: number
  staleDays: number
  requiresCategoryAuthorization: boolean
}

export type CleanupAuditRecord = {
  id: string
  action: 'scan' | 'verify' | 'ignore' | 'trash' | 'command' | 'terminate' | 'force-terminate' | 'export'
  target: string
  status: 'success' | 'failed' | 'blocked'
  detail: string
  reclaimedBytes: number
  createdAt: string
}

export type ExternalCleanupPreview = { key: 'docker-images' | 'docker-containers' | 'docker-build-cache'; label: string; command: string; estimatedBytes: number; risk: 'high'; enabled: boolean }

export type StorageOverview = {
  roots: StorageRoot[]
  latestRun: StorageScanRun | null
  items: StorageScanItem[]
  policies: CleanupPolicy[]
  totalReclaimableBytes: number
  categoryBytes: Record<string, number>
  directories: StorageDirectoryEntry[]
  trend: StorageTrendPoint[]
}

export type StorageDirectoryEntry = {
  path: string
  name: string
  rootId: string
  sizeBytes: number
  growthBytes: number
  parentPath: string
  fileCount: number
  directoryCount: number
  childDirectoryCount: number
  depth: number
  rootPercent: number
}
export type StorageDirectorySortBy = 'name' | 'sizeBytes' | 'growthBytes' | 'fileCount' | 'directoryCount' | 'childDirectoryCount' | 'depth'
export type StorageDirectoryQuery = {
  scanId?: string
  rootId?: string
  parentPath?: string
  search?: string
  limit?: number
  offset?: number
  sortBy?: StorageDirectorySortBy
  sortOrder?: 'asc' | 'desc'
}
export type StorageDirectoryList = { scanId: string; total: number; directories: StorageDirectoryEntry[] }
export type StorageTrendPoint = { capturedAt: string; scannedBytes: number; reclaimableBytes: number }

export type StorageScanProgress = {
  scanId: string
  status: StorageScanRun['status']
  currentPath: string
  filesScanned: number
  directoriesScanned: number
  bytesScanned: number
  reclaimableBytes: number
  errorCount: number
}

type ExecResult = { stdout: string; stderr: string; error: string }
type CpuTotals = { idle: number; total: number }

const rawRetentionMs = 7 * 86400_000
const fiveMinuteRetentionMs = 365 * 86400_000
const sampleIntervalMs = 15_000
const processLimit = 50
const largeFileBytes = 1024 ** 3
const staleFileBytes = 500 * 1024 ** 2
const staleAgeMs = 90 * 86400_000
const protectedProcessNames = new Set(['kernel_task', 'launchd', 'WindowServer', 'loginwindow', 'syslogd', 'powerd'])

let previousCpuTotals: CpuTotals | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function booleanValue(value: unknown): boolean {
  return numberValue(value) === 1 || value === true
}

function runFile(file: string, args: string[], timeout = 10_000): Promise<ExecResult> {
  return new Promise((resolveResult) => {
    execFile(file, args, { maxBuffer: 16 * 1024 * 1024, timeout }, (error, stdout, stderr) => {
      resolveResult({
        error: error ? String(stderr || error.message).trim() : '',
        stderr: String(stderr ?? ''),
        stdout: String(stdout ?? '')
      })
    })
  })
}

function parseSize(value: string): number {
  const match = value.trim().match(/^([\d.]+)([BKMGT])?\+?$/i)
  if (!match) return 0
  const multipliers: Record<string, number> = { B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }
  return Number(match[1]) * multipliers[(match[2] || 'B').toUpperCase()]
}

function parseNetworkBytes(value: unknown): number {
  const normalized = String(value ?? '').trim().replace(/,/g, '')
  if (!normalized) return 0
  const direct = Number(normalized)
  if (Number.isFinite(direct)) return Math.max(0, direct)
  const match = normalized.match(/^([\d.]+)\s*(B|K|M|G|T|P)(?:i?B)?$/i)
  if (!match) return 0
  const multipliers: Record<string, number> = { B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }
  return Math.max(0, Number(match[1]) * multipliers[match[2].toUpperCase()])
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim())
      value = ''
    } else {
      value += character
    }
  }
  values.push(value.trim())
  return values
}

export function parseNettopProcessOutput(output: string): Map<number, { networkReceivedBytes: number; networkSentBytes: number }> {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const headerIndex = lines.findIndex((line) => {
    const columns = parseCsvLine(line).map((column) => column.toLowerCase())
    return columns.includes('bytes_in') && columns.includes('bytes_out')
  })
  if (headerIndex < 0) return new Map()

  const header = parseCsvLine(lines[headerIndex]).map((column) => column.toLowerCase())
  const pidIndex = header.indexOf('pid') >= 0 ? header.indexOf('pid') : header.indexOf('epid')
  const inIndex = header.indexOf('bytes_in')
  const outIndex = header.indexOf('bytes_out')
  const usage = new Map<number, { networkReceivedBytes: number; networkSentBytes: number }>()
  for (const line of lines.slice(headerIndex + 1)) {
    const values = parseCsvLine(line)
    const embeddedPid = values[0]?.match(/\.(\d+)$/)?.[1]
    const explicitPid = pidIndex >= 0 ? parseNetworkBytes(values[pidIndex]) : 0
    const pid = Math.round(explicitPid || parseNetworkBytes(embeddedPid))
    if (pid <= 0) continue
    usage.set(pid, {
      networkReceivedBytes: parseNetworkBytes(values[inIndex]),
      networkSentBytes: parseNetworkBytes(values[outIndex])
    })
  }
  return usage
}

export async function listExternalCleanupPreviews(db: ResourceDatabase): Promise<ExternalCleanupPreview[]> {
  const dockerEnabled = listCleanupPolicies(db).find((policy) => policy.key === 'docker')?.enabled === true
  const previews: ExternalCleanupPreview[] = [
    { key: 'docker-images', label: 'Docker 悬空镜像', command: 'docker image prune -f', estimatedBytes: 0, risk: 'high', enabled: dockerEnabled },
    { key: 'docker-containers', label: 'Docker 已停止容器', command: 'docker container prune -f', estimatedBytes: 0, risk: 'high', enabled: dockerEnabled },
    { key: 'docker-build-cache', label: 'Docker 构建缓存', command: 'docker builder prune -f', estimatedBytes: 0, risk: 'high', enabled: dockerEnabled }
  ]
  if (!dockerEnabled) return previews
  const result = await runFile('docker', ['system', 'df', '--format', '{{json .}}'], 15_000)
  if (result.error) return previews
  for (const line of result.stdout.split(/\r?\n/)) {
    try {
      const row = JSON.parse(line) as Record<string, string>
      const reclaimable = parseSize(String(row.Reclaimable || '').split(/\s+/)[0])
      const type = String(row.Type || '').toLowerCase()
      const key = type.includes('image') ? 'docker-images' : type.includes('container') ? 'docker-containers' : type.includes('build') ? 'docker-build-cache' : ''
      const preview = previews.find((item) => item.key === key)
      if (preview) preview.estimatedBytes = reclaimable
    } catch { /* ignore malformed docker rows */ }
  }
  return previews
}

export async function executeExternalCleanup(db: ResourceDatabase, key: ExternalCleanupPreview['key']): Promise<CleanupAuditRecord> {
  const preview = (await listExternalCleanupPreviews(db)).find((item) => item.key === key)
  if (!preview?.enabled) throw new Error('请先授权 Docker 清理类别')
  const commands: Record<ExternalCleanupPreview['key'], string[]> = {
    'docker-images': ['image', 'prune', '-f'], 'docker-containers': ['container', 'prune', '-f'], 'docker-build-cache': ['builder', 'prune', '-f']
  }
  const result = await runFile('docker', commands[key], 120_000)
  if (result.error) return recordAudit(db, { action: 'command', target: preview.label, status: 'failed', detail: result.error, reclaimedBytes: 0 })
  return recordAudit(db, { action: 'command', target: preview.label, status: 'success', detail: `${preview.command}\n${result.stdout.trim()}`, reclaimedBytes: preview.estimatedBytes })
}

function parseElapsedSeconds(value: string): number {
  const parts = value.trim().split(/[-:]/).map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return 0
  if (value.includes('-')) return (parts[0] * 86400) + (parts[1] * 3600) + (parts[2] * 60) + (parts[3] || 0)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return (parts[0] || 0) * 60 + (parts[1] || 0)
}

function resolveProcessIdentity(command: string, processName: string): { identityKey: string; appName: string; executablePath: string; bundlePath: string } {
  const appMatch = command.match(/^(.*?\.app)(?:\/|$)/)
  const bundlePath = appMatch?.[1] ?? ''
  const executablePath = bundlePath
    ? command.slice(0, command.indexOf(' ', bundlePath.length) === -1 ? command.length : command.indexOf(' ', bundlePath.length))
    : command.split(/\s+/)[0] ?? ''
  const appName = bundlePath ? basename(bundlePath, '.app') : processName
  const identityKey = (bundlePath || executablePath || processName).toLowerCase()
  return { appName, bundlePath, executablePath, identityKey }
}

export function parsePsProcessOutput(output: string, capturedAt = new Date()): ResourceProcess[] {
  const processes: ResourceProcess[] = []

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/)
    if (!match) continue
    const pid = Number(match[1])
    const elapsedSeconds = parseElapsedSeconds(match[7])
    const command = match[9].trim()
    const processName = basename(command.split(/\s+/)[0] || command) || `PID ${pid}`
    const identity = resolveProcessIdentity(command, processName)
    const startedAt = new Date(capturedAt.getTime() - elapsedSeconds * 1000).toISOString().slice(0, 19)

    processes.push({
      ...identity,
      command,
      cpuPercent: numberValue(match[4]),
      elapsedSeconds,
      instanceKey: `${pid}:${startedAt}`,
      memoryBytes: Number(match[5]) * 1024,
      pageIns: 0,
      parentPid: Number(match[2]),
      pid,
      portCount: 0,
      privateMemoryBytes: Number(match[5]) * 1024,
      processName,
      state: match[8],
      threadCount: 0,
      user: match[3],
      virtualMemoryBytes: Number(match[6]) * 1024,
      networkReceivedBytes: 0,
      networkSentBytes: 0
    })
  }

  return processes
}

async function enrichProcessNetworkUsage(processes: ResourceProcess[]): Promise<void> {
  if (process.platform !== 'darwin' || processes.length === 0) return
  // Current macOS emits the process label (including PID) as the first CSV
  // field. Keep the selector list to columns supported across recent macOS
  // versions; invalid selectors make nettop exit with its usage text.
  const result = await runFile('/usr/bin/nettop', ['-P', '-n', '-x', '-L', '1', '-J', 'bytes_in,bytes_out'], 15_000)
  if (result.error) return
  const usage = parseNettopProcessOutput(result.stdout)
  for (const processInfo of processes) {
    const network = usage.get(processInfo.pid)
    if (!network) continue
    processInfo.networkReceivedBytes = network.networkReceivedBytes
    processInfo.networkSentBytes = network.networkSentBytes
  }
}

export function mergeTopProcessOutput(processes: ResourceProcess[], output: string): ResourceProcess[] {
  const byPid = new Map(processes.map((process) => [process.pid, process]))
  let headerSeen = false

  for (const line of output.split(/\r?\n/)) {
    if (/^PID\s+COMMAND/i.test(line.trim())) {
      headerSeen = true
      continue
    }
    if (!headerSeen || !/^\s*\d+\s+/.test(line)) continue
    const tokens = line.trim().split(/\s+/)
    if (tokens.length < 9) continue
    const pid = Number(tokens[0])
    const process = byPid.get(pid)
    if (!process) continue
    const user = tokens.pop() ?? process.user
    const time = tokens.pop() ?? ''
    const state = tokens.pop() ?? process.state
    const ports = tokens.pop() ?? '0'
    const threads = tokens.pop() ?? '0'
    const memory = tokens.pop() ?? '0'
    const cpu = tokens.pop() ?? '0'
    process.processName = tokens.slice(1).join(' ') || process.processName
    process.cpuPercent = numberValue(cpu)
    process.memoryBytes = parseSize(memory) || process.memoryBytes
    process.threadCount = numberValue(threads.replace(/[^\d]/g, ''))
    process.portCount = numberValue(ports.replace(/[^\d]/g, ''))
    process.state = state
    process.user = user
    if (time) process.elapsedSeconds = Math.max(process.elapsedSeconds, parseElapsedSeconds(time))
  }

  return processes
}

export async function collectResourceProcesses(): Promise<ResourceProcess[]> {
  const capturedAt = new Date()
  const ps = await runFile('/bin/ps', ['-ww', '-axo', 'pid=,ppid=,user=,%cpu=,rss=,vsz=,etime=,state=,command='])
  if (ps.error) throw new Error(ps.error)
  const processes = parsePsProcessOutput(ps.stdout, capturedAt)

  if (process.platform === 'darwin') {
    const top = await runFile('/usr/bin/top', ['-l', '1', '-n', '100', '-o', 'mem', '-stats', 'pid,command,cpu,mem,threads,ports,state,time,user'], 15_000)
    if (!top.error) mergeTopProcessOutput(processes, top.stdout)
  }

  await enrichProcessNetworkUsage(processes)

  const selected = new Map<number, ResourceProcess>()
  for (const process of [...processes].sort((left, right) => right.memoryBytes - left.memoryBytes).slice(0, processLimit / 2)) selected.set(process.pid, process)
  for (const process of [...processes].sort((left, right) => right.cpuPercent - left.cpuPercent).slice(0, processLimit / 2)) selected.set(process.pid, process)
  for (const process of [...processes].sort((left, right) => (right.networkReceivedBytes + right.networkSentBytes) - (left.networkReceivedBytes + left.networkSentBytes)).slice(0, Math.floor(processLimit / 4))) selected.set(process.pid, process)
  return [...selected.values()].sort((left, right) => right.memoryBytes - left.memoryBytes).slice(0, processLimit)
}

export function readCpuUsagePercent(): number {
  const totals = cpus().reduce<CpuTotals>((sum, cpu) => {
    const values = Object.values(cpu.times)
    sum.idle += cpu.times.idle
    sum.total += values.reduce((total, value) => total + value, 0)
    return sum
  }, { idle: 0, total: 0 })
  const previous = previousCpuTotals
  previousCpuTotals = totals
  if (!previous) return 0
  const totalDelta = totals.total - previous.total
  const idleDelta = totals.idle - previous.idle
  return totalDelta > 0 ? Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100)) : 0
}

export function migrateResourceGovernanceTables(db: ResourceDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_resource_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT, captured_at TEXT NOT NULL,
      cpu_percent REAL NOT NULL, memory_usage_percent REAL NOT NULL,
      memory_used_bytes INTEGER NOT NULL, swap_used_bytes INTEGER NOT NULL,
      storage_usage_percent REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resource_samples_time ON system_resource_samples(captured_at);
    CREATE TABLE IF NOT EXISTS system_process_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT, captured_at TEXT NOT NULL,
      identity_key TEXT NOT NULL, instance_key TEXT NOT NULL, pid INTEGER NOT NULL,
      parent_pid INTEGER NOT NULL, app_name TEXT NOT NULL, process_name TEXT NOT NULL,
      user_name TEXT NOT NULL, cpu_percent REAL NOT NULL, memory_bytes INTEGER NOT NULL,
      private_memory_bytes INTEGER NOT NULL, virtual_memory_bytes INTEGER NOT NULL,
      thread_count INTEGER NOT NULL, port_count INTEGER NOT NULL, page_ins INTEGER NOT NULL,
      process_state TEXT NOT NULL, elapsed_seconds INTEGER NOT NULL,
      executable_path TEXT NOT NULL, bundle_path TEXT NOT NULL, command_text TEXT NOT NULL,
      network_received_bytes INTEGER NOT NULL DEFAULT 0, network_sent_bytes INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_process_samples_identity_time ON system_process_samples(identity_key, captured_at);
    CREATE INDEX IF NOT EXISTS idx_process_samples_time ON system_process_samples(captured_at);
    CREATE TABLE IF NOT EXISTS system_process_rollups (
      bucket_at TEXT NOT NULL, bucket_seconds INTEGER NOT NULL, identity_key TEXT NOT NULL,
      app_name TEXT NOT NULL, process_name TEXT NOT NULL, executable_path TEXT NOT NULL,
      cpu_average REAL NOT NULL, cpu_peak REAL NOT NULL,
      memory_average_bytes INTEGER NOT NULL, memory_peak_bytes INTEGER NOT NULL,
      sample_count INTEGER NOT NULL,
      network_received_bytes INTEGER NOT NULL DEFAULT 0, network_sent_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(bucket_at, bucket_seconds, identity_key)
    );
    CREATE INDEX IF NOT EXISTS idx_process_rollups_identity_time ON system_process_rollups(identity_key, bucket_at);
    CREATE TABLE IF NOT EXISTS system_monitor_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1), sample_interval_seconds INTEGER NOT NULL DEFAULT 15,
      raw_retention_days INTEGER NOT NULL DEFAULT 7, five_minute_retention_days INTEGER NOT NULL DEFAULT 365,
      login_start_enabled INTEGER NOT NULL DEFAULT 1, last_retention_at TEXT NOT NULL DEFAULT '',
      last_quick_scan_at TEXT NOT NULL DEFAULT '', last_deep_scan_at TEXT NOT NULL DEFAULT ''
    );
    INSERT OR IGNORE INTO system_monitor_settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS storage_roots (
      id TEXT PRIMARY KEY, root_path TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL,
      created_at TEXT NOT NULL, last_scanned_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS storage_scan_runs (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL DEFAULT '', files_scanned INTEGER NOT NULL DEFAULT 0,
      directories_scanned INTEGER NOT NULL DEFAULT 0, bytes_scanned INTEGER NOT NULL DEFAULT 0,
      reclaimable_bytes INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS storage_scan_items (
      id TEXT PRIMARY KEY, scan_id TEXT NOT NULL, root_id TEXT NOT NULL, item_path TEXT NOT NULL,
      item_name TEXT NOT NULL, size_bytes INTEGER NOT NULL, modified_at TEXT NOT NULL,
      accessed_at TEXT NOT NULL, extension TEXT NOT NULL, category TEXT NOT NULL,
      risk TEXT NOT NULL, reason TEXT NOT NULL, duplicate_key TEXT NOT NULL DEFAULT '',
      verified_hash TEXT NOT NULL DEFAULT '', is_directory INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_storage_items_scan_size ON storage_scan_items(scan_id, size_bytes DESC);
    CREATE TABLE IF NOT EXISTS storage_directory_snapshots (
      scan_id TEXT NOT NULL, root_id TEXT NOT NULL, directory_path TEXT NOT NULL,
      parent_path TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0, directory_count INTEGER NOT NULL DEFAULT 0,
      child_directory_count INTEGER NOT NULL DEFAULT 0, depth INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(scan_id, directory_path)
    );
    CREATE INDEX IF NOT EXISTS idx_storage_directories_scan_size ON storage_directory_snapshots(scan_id, size_bytes DESC);
    CREATE INDEX IF NOT EXISTS idx_storage_directories_scan_parent ON storage_directory_snapshots(scan_id, root_id, parent_path, size_bytes DESC);
    CREATE INDEX IF NOT EXISTS idx_storage_directories_scan_path ON storage_directory_snapshots(scan_id, directory_path);
    CREATE TABLE IF NOT EXISTS cleanup_category_authorizations (
      category TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cleanup_audit (
      id TEXT PRIMARY KEY, action TEXT NOT NULL, target TEXT NOT NULL, status TEXT NOT NULL,
      detail TEXT NOT NULL, reclaimed_bytes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
  `)
  const columns = new Set((db.prepare('PRAGMA table_info(storage_directory_snapshots)').all() as Record<string, unknown>[])
    .map((row) => String(row.name)))
  const addColumn = (name: string, definition: string): void => {
    if (!columns.has(name)) db.exec(`ALTER TABLE storage_directory_snapshots ADD COLUMN ${name} ${definition}`)
  }
  addColumn('file_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('directory_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('child_directory_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('depth', 'INTEGER NOT NULL DEFAULT 0')
  const processSampleColumns = new Set((db.prepare('PRAGMA table_info(system_process_samples)').all() as Record<string, unknown>[])
    .map((row) => String(row.name)))
  const addProcessSampleColumn = (name: string, definition: string): void => {
    if (!processSampleColumns.has(name)) db.exec(`ALTER TABLE system_process_samples ADD COLUMN ${name} ${definition}`)
  }
  addProcessSampleColumn('network_received_bytes', 'INTEGER NOT NULL DEFAULT 0')
  addProcessSampleColumn('network_sent_bytes', 'INTEGER NOT NULL DEFAULT 0')
  const processRollupColumns = new Set((db.prepare('PRAGMA table_info(system_process_rollups)').all() as Record<string, unknown>[])
    .map((row) => String(row.name)))
  const addProcessRollupColumn = (name: string, definition: string): void => {
    if (!processRollupColumns.has(name)) db.exec(`ALTER TABLE system_process_rollups ADD COLUMN ${name} ${definition}`)
  }
  addProcessRollupColumn('network_received_bytes', 'INTEGER NOT NULL DEFAULT 0')
  addProcessRollupColumn('network_sent_bytes', 'INTEGER NOT NULL DEFAULT 0')
}

function recordAudit(db: ResourceDatabase, input: Omit<CleanupAuditRecord, 'id' | 'createdAt'>): CleanupAuditRecord {
  const record: CleanupAuditRecord = { ...input, createdAt: nowIso(), id: randomUUID() }
  db.prepare('INSERT INTO cleanup_audit(id, action, target, status, detail, reclaimed_bytes, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(record.id, record.action, record.target, record.status, record.detail, record.reclaimedBytes, record.createdAt)
  return record
}

export function recordResourceSample(db: ResourceDatabase, snapshot: {
  capturedAt: string; cpuPercent: number; memoryUsagePercent: number; memoryUsedBytes: number;
  swapUsedBytes: number; storageUsagePercent: number; processes: ResourceProcess[]
}): void {
  db.prepare('INSERT INTO system_resource_samples(captured_at, cpu_percent, memory_usage_percent, memory_used_bytes, swap_used_bytes, storage_usage_percent) VALUES(?, ?, ?, ?, ?, ?)')
    .run(snapshot.capturedAt, snapshot.cpuPercent, snapshot.memoryUsagePercent, snapshot.memoryUsedBytes, snapshot.swapUsedBytes, snapshot.storageUsagePercent)
  const statement = db.prepare(`INSERT INTO system_process_samples(
    captured_at, identity_key, instance_key, pid, parent_pid, app_name, process_name, user_name,
    cpu_percent, memory_bytes, private_memory_bytes, virtual_memory_bytes, thread_count, port_count,
    page_ins, process_state, elapsed_seconds, executable_path, bundle_path, command_text,
    network_received_bytes, network_sent_bytes
  ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const process of snapshot.processes) {
    statement.run(snapshot.capturedAt, process.identityKey, process.instanceKey, process.pid, process.parentPid,
      process.appName, process.processName, process.user, process.cpuPercent, process.memoryBytes,
      process.privateMemoryBytes, process.virtualMemoryBytes, process.threadCount, process.portCount,
      process.pageIns, process.state, process.elapsedSeconds, process.executablePath, process.bundlePath, process.command,
      process.networkReceivedBytes, process.networkSentBytes)
  }
}

export function runResourceRetention(db: ResourceDatabase, now = new Date()): void {
  const rawCutoff = new Date(now.getTime() - rawRetentionMs).toISOString()
  const rollupCutoff = new Date(now.getTime() - fiveMinuteRetentionMs).toISOString()
  db.exec(`
    INSERT OR REPLACE INTO system_process_rollups(
      bucket_at, bucket_seconds, identity_key, app_name, process_name, executable_path,
      cpu_average, cpu_peak, memory_average_bytes, memory_peak_bytes, sample_count,
      network_received_bytes, network_sent_bytes
    )
    WITH samples_with_previous AS (
      SELECT *,
        LAG(network_received_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_received_bytes,
        LAG(network_sent_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_sent_bytes
      FROM system_process_samples
    )
    SELECT strftime('%Y-%m-%dT%H:', captured_at) || printf('%02d:00.000Z', (CAST(strftime('%M', captured_at) AS INTEGER) / 5) * 5),
      300, identity_key, MAX(app_name), MAX(process_name), MAX(executable_path),
      AVG(cpu_percent), MAX(cpu_percent), CAST(AVG(memory_bytes) AS INTEGER), MAX(memory_bytes), COUNT(*),
      SUM(CASE WHEN network_received_bytes > previous_network_received_bytes THEN network_received_bytes - previous_network_received_bytes ELSE 0 END),
      SUM(CASE WHEN network_sent_bytes > previous_network_sent_bytes THEN network_sent_bytes - previous_network_sent_bytes ELSE 0 END)
    FROM samples_with_previous GROUP BY 1, identity_key;
    INSERT OR REPLACE INTO system_process_rollups(
      bucket_at, bucket_seconds, identity_key, app_name, process_name, executable_path,
      cpu_average, cpu_peak, memory_average_bytes, memory_peak_bytes, sample_count,
      network_received_bytes, network_sent_bytes
    )
    SELECT substr(bucket_at, 1, 13) || ':00:00.000Z', 3600, identity_key, MAX(app_name), MAX(process_name), MAX(executable_path),
      AVG(cpu_average), MAX(cpu_peak), CAST(AVG(memory_average_bytes) AS INTEGER), MAX(memory_peak_bytes), SUM(sample_count),
      SUM(network_received_bytes), SUM(network_sent_bytes)
    FROM system_process_rollups WHERE bucket_seconds = 300 GROUP BY 1, identity_key;
  `)
  db.prepare('DELETE FROM system_process_samples WHERE captured_at < ?').run(rawCutoff)
  db.prepare('DELETE FROM system_resource_samples WHERE captured_at < ?').run(rawCutoff)
  db.prepare('DELETE FROM system_process_rollups WHERE bucket_seconds = 300 AND bucket_at < ?').run(rollupCutoff)
  db.prepare('UPDATE system_monitor_settings SET last_retention_at = ? WHERE id = 1').run(now.toISOString())
}

function mapProcessRow(row: Record<string, unknown>): ResourceProcess {
  return {
    appName: String(row.app_name ?? ''), bundlePath: String(row.bundle_path ?? ''), command: String(row.command_text ?? ''),
    cpuPercent: numberValue(row.cpu_percent), elapsedSeconds: numberValue(row.elapsed_seconds), executablePath: String(row.executable_path ?? ''),
    identityKey: String(row.identity_key ?? ''), instanceKey: String(row.instance_key ?? ''), memoryBytes: numberValue(row.memory_bytes),
    pageIns: numberValue(row.page_ins), parentPid: numberValue(row.parent_pid), pid: numberValue(row.pid), portCount: numberValue(row.port_count),
    privateMemoryBytes: numberValue(row.private_memory_bytes), processName: String(row.process_name ?? ''), state: String(row.process_state ?? ''),
    threadCount: numberValue(row.thread_count), user: String(row.user_name ?? ''), virtualMemoryBytes: numberValue(row.virtual_memory_bytes),
    networkReceivedBytes: numberValue(row.network_received_bytes), networkSentBytes: numberValue(row.network_sent_bytes)
  }
}

export function listLatestProcesses(db: ResourceDatabase): ResourceProcess[] {
  const latest = db.prepare('SELECT MAX(captured_at) AS captured_at FROM system_process_samples').get() as Record<string, unknown> | undefined
  if (!latest?.captured_at) return []
  return (db.prepare('SELECT * FROM system_process_samples WHERE captured_at = ? ORDER BY memory_bytes DESC, cpu_percent DESC').all(latest.captured_at) as Record<string, unknown>[]).map(mapProcessRow)
}

export function listResourceHistory(db: ResourceDatabase, from: string, to: string): ResourceHistoryPoint[] {
  return (db.prepare(`WITH process_samples_with_previous AS (
      SELECT captured_at, network_received_bytes, network_sent_bytes,
        LAG(network_received_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_received_bytes,
        LAG(network_sent_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_sent_bytes
      FROM system_process_samples
    ), process_network AS (
      SELECT captured_at,
        SUM(CASE WHEN network_received_bytes > previous_network_received_bytes THEN network_received_bytes - previous_network_received_bytes ELSE 0 END) AS network_in_bytes,
        SUM(CASE WHEN network_sent_bytes > previous_network_sent_bytes THEN network_sent_bytes - previous_network_sent_bytes ELSE 0 END) AS network_out_bytes
      FROM process_samples_with_previous GROUP BY captured_at
    )
    SELECT resource.captured_at, resource.cpu_percent, resource.memory_usage_percent, resource.memory_used_bytes,
      resource.swap_used_bytes, resource.storage_usage_percent, COALESCE(process_network.network_in_bytes, 0) AS network_in_bytes,
      COALESCE(process_network.network_out_bytes, 0) AS network_out_bytes
    FROM system_resource_samples resource LEFT JOIN process_network ON process_network.captured_at = resource.captured_at
    WHERE resource.captured_at BETWEEN ? AND ? ORDER BY resource.captured_at`).all(from, to) as Record<string, unknown>[]).map((row) => ({
      capturedAt: String(row.captured_at), cpuPercent: numberValue(row.cpu_percent), memoryUsagePercent: numberValue(row.memory_usage_percent),
      memoryUsedBytes: numberValue(row.memory_used_bytes), storageUsagePercent: numberValue(row.storage_usage_percent), swapUsedBytes: numberValue(row.swap_used_bytes),
      networkInBytes: numberValue(row.network_in_bytes), networkOutBytes: numberValue(row.network_out_bytes)
    }))
}

export function importLegacyResourceHistory(db: ResourceDatabase, points: ResourceHistoryPoint[]): number {
  const insert = db.prepare(`INSERT INTO system_resource_samples(captured_at, cpu_percent, memory_usage_percent, memory_used_bytes, swap_used_bytes, storage_usage_percent)
    SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM system_resource_samples WHERE captured_at = ?)`)
  let imported = 0
  for (const point of points.slice(-288)) {
    const capturedAt = new Date(point.capturedAt).toISOString()
    const result = insert.run(capturedAt, Math.max(0, Math.min(100, numberValue(point.cpuPercent))), Math.max(0, Math.min(100, numberValue(point.memoryUsagePercent))),
      Math.max(0, numberValue(point.memoryUsedBytes)), Math.max(0, numberValue(point.swapUsedBytes)), Math.max(0, Math.min(100, numberValue(point.storageUsagePercent))), capturedAt)
    imported += Number(result.changes)
  }
  return imported
}

export function listProcessHistory(db: ResourceDatabase, identityKey: string, from: string, to: string): ProcessHistoryPoint[] {
  const raw = db.prepare(`WITH samples_with_previous AS (
      SELECT captured_at, cpu_percent, memory_bytes, network_received_bytes, network_sent_bytes,
        LAG(network_received_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_received_bytes,
        LAG(network_sent_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_sent_bytes
      FROM system_process_samples WHERE identity_key = ? AND captured_at BETWEEN ? AND ?
    )
    SELECT captured_at, AVG(cpu_percent) AS cpu_average, MAX(cpu_percent) AS cpu_peak,
      CAST(AVG(memory_bytes) AS INTEGER) AS memory_average_bytes, MAX(memory_bytes) AS memory_peak_bytes, COUNT(*) AS sample_count,
      SUM(CASE WHEN network_received_bytes > previous_network_received_bytes THEN network_received_bytes - previous_network_received_bytes ELSE 0 END) AS network_in_bytes,
      SUM(CASE WHEN network_sent_bytes > previous_network_sent_bytes THEN network_sent_bytes - previous_network_sent_bytes ELSE 0 END) AS network_out_bytes
    FROM samples_with_previous GROUP BY captured_at ORDER BY captured_at`).all(identityKey, from, to) as Record<string, unknown>[]
  const rows = raw.length > 0 ? raw : db.prepare(`SELECT bucket_at AS captured_at, cpu_average, cpu_peak, memory_average_bytes,
    memory_peak_bytes, sample_count, network_received_bytes AS network_in_bytes, network_sent_bytes AS network_out_bytes
    FROM system_process_rollups WHERE identity_key = ? AND bucket_at BETWEEN ? AND ?
    ORDER BY bucket_at`).all(identityKey, from, to) as Record<string, unknown>[]
  return rows.map((row) => ({ capturedAt: String(row.captured_at), cpuAverage: numberValue(row.cpu_average), cpuPeak: numberValue(row.cpu_peak),
    memoryAverageBytes: numberValue(row.memory_average_bytes), memoryPeakBytes: numberValue(row.memory_peak_bytes), sampleCount: numberValue(row.sample_count),
    networkInBytes: numberValue(row.network_in_bytes), networkOutBytes: numberValue(row.network_out_bytes) }))
}

export function listProcessAnalysis(db: ResourceDatabase, from: string, to: string): ProcessAnalysis[] {
  return (db.prepare(`WITH samples_with_previous AS (
      SELECT *,
        LAG(network_received_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_received_bytes,
        LAG(network_sent_bytes) OVER (PARTITION BY instance_key ORDER BY captured_at) AS previous_network_sent_bytes
      FROM system_process_samples WHERE captured_at BETWEEN ? AND ?
    )
    SELECT identity_key, MAX(app_name) app_name, MAX(process_name) process_name, MAX(executable_path) executable_path,
      AVG(cpu_percent) average_cpu, MAX(cpu_percent) peak_cpu, CAST(AVG(memory_bytes) AS INTEGER) average_memory,
      MAX(memory_bytes) peak_memory, COUNT(*) sample_count, MIN(captured_at) first_seen, MAX(captured_at) last_seen,
      SUM(CASE WHEN memory_bytes >= 1073741824 OR cpu_percent >= 80 THEN 15 ELSE 0 END) above_seconds,
      SUM(CASE WHEN network_received_bytes > previous_network_received_bytes THEN network_received_bytes - previous_network_received_bytes ELSE 0 END) network_received_bytes,
      SUM(CASE WHEN network_sent_bytes > previous_network_sent_bytes THEN network_sent_bytes - previous_network_sent_bytes ELSE 0 END) network_sent_bytes
    FROM samples_with_previous GROUP BY identity_key ORDER BY peak_memory DESC LIMIT 200`).all(from, to) as Record<string, unknown>[]).map((row) => ({
      identityKey: String(row.identity_key), appName: String(row.app_name), processName: String(row.process_name), executablePath: String(row.executable_path),
      averageCpuPercent: numberValue(row.average_cpu), peakCpuPercent: numberValue(row.peak_cpu), averageMemoryBytes: numberValue(row.average_memory),
      peakMemoryBytes: numberValue(row.peak_memory), sampleCount: numberValue(row.sample_count), aboveThresholdSeconds: numberValue(row.above_seconds),
      firstSeenAt: String(row.first_seen), lastSeenAt: String(row.last_seen), networkReceivedBytes: numberValue(row.network_received_bytes), networkSentBytes: numberValue(row.network_sent_bytes)
    }))
}

export function getResourceRetentionStatus(db: ResourceDatabase): ResourceRetentionStatus {
  const raw = db.prepare('SELECT COUNT(*) count, MIN(captured_at) oldest FROM system_process_samples').get() as Record<string, unknown>
  const rollup = db.prepare('SELECT COUNT(*) count FROM system_process_rollups').get() as Record<string, unknown>
  const rawCount = numberValue(raw.count)
  const rollupCount = numberValue(rollup.count)
  return { rawDays: 7, fiveMinuteDays: 365, sampleIntervalSeconds: 15, rawSampleCount: rawCount, rollupSampleCount: rollupCount,
    oldestRawAt: String(raw.oldest ?? ''), databaseBytesEstimate: rawCount * 360 + rollupCount * 180 }
}

export function listCleanupAudit(db: ResourceDatabase, limit = 200): CleanupAuditRecord[] {
  return (db.prepare('SELECT * FROM cleanup_audit ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), action: row.action as CleanupAuditRecord['action'], target: String(row.target), status: row.status as CleanupAuditRecord['status'],
    detail: String(row.detail), reclaimedBytes: numberValue(row.reclaimed_bytes), createdAt: String(row.created_at)
  }))
}

export async function signalResourceProcess(db: ResourceDatabase, pid: number, force: boolean): Promise<void> {
  const processInfo = (await collectResourceProcesses()).find((item) => item.pid === pid)
  if (!processInfo || pid <= 1 || protectedProcessNames.has(processInfo.processName) || processInfo.user !== process.env.USER) {
    recordAudit(db, { action: force ? 'force-terminate' : 'terminate', target: String(pid), status: 'blocked', detail: '系统关键进程、其他用户进程或已退出进程不可操作', reclaimedBytes: 0 })
    throw new Error('该进程不可由 ForgeDesk 结束')
  }
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
    recordAudit(db, { action: force ? 'force-terminate' : 'terminate', target: `${processInfo.appName} (${pid})`, status: 'success', detail: force ? '已强制结束' : '已请求正常退出', reclaimedBytes: 0 })
  } catch (error) {
    recordAudit(db, { action: force ? 'force-terminate' : 'terminate', target: `${processInfo.appName} (${pid})`, status: 'failed', detail: error instanceof Error ? error.message : String(error), reclaimedBytes: 0 })
    throw error
  }
}

const cleanupPolicies: CleanupPolicy[] = [
  { key: 'large-file', label: '大文件', description: '超过 1 GB 的文件', enabled: true, risk: 'confirm', thresholdBytes: largeFileBytes, staleDays: 0, requiresCategoryAuthorization: false },
  { key: 'stale-file', label: '长期未使用', description: '超过 500 MB 且 90 天未使用', enabled: true, risk: 'confirm', thresholdBytes: staleFileBytes, staleDays: 90, requiresCategoryAuthorization: false },
  { key: 'duplicate-candidate', label: '重复文件候选', description: '同尺寸文件，展开后按需完成哈希校验', enabled: true, risk: 'confirm', thresholdBytes: 10 * 1024 ** 2, staleDays: 0, requiresCategoryAuthorization: false },
  { key: 'download', label: '下载与安装包', description: '过期压缩包、安装包和磁盘镜像', enabled: false, risk: 'confirm', thresholdBytes: 0, staleDays: 30, requiresCategoryAuthorization: true },
  { key: 'cache', label: '缓存', description: '用户授权的应用与系统缓存', enabled: false, risk: 'low', thresholdBytes: 0, staleDays: 30, requiresCategoryAuthorization: true },
  { key: 'log', label: '日志', description: '用户授权的历史日志', enabled: false, risk: 'low', thresholdBytes: 0, staleDays: 30, requiresCategoryAuthorization: true },
  { key: 'development', label: '开发环境', description: 'node_modules、构建目录及开发工具缓存', enabled: false, risk: 'confirm', thresholdBytes: 0, staleDays: 30, requiresCategoryAuthorization: true },
  { key: 'docker', label: 'Docker', description: '构建缓存、悬空镜像和停止容器；永不包含卷', enabled: false, risk: 'high', thresholdBytes: 0, staleDays: 0, requiresCategoryAuthorization: true },
  { key: 'trash', label: '废纸篓', description: '仅统计，永久清空不由默认策略执行', enabled: false, risk: 'high', thresholdBytes: 0, staleDays: 30, requiresCategoryAuthorization: true },
  { key: 'protected', label: '系统保护目录', description: '只提示，不绕过系统权限执行删除', enabled: false, risk: 'protected', thresholdBytes: 0, staleDays: 0, requiresCategoryAuthorization: true }
]

function mapStorageRoot(row: Record<string, unknown>): StorageRoot {
  return { id: String(row.id), path: String(row.root_path), label: String(row.label), enabled: booleanValue(row.enabled),
    source: row.source as StorageRoot['source'], createdAt: String(row.created_at), lastScannedAt: String(row.last_scanned_at ?? '') }
}

function mapScanRun(row: Record<string, unknown>): StorageScanRun {
  let errors: string[] = []
  try { errors = JSON.parse(String(row.errors_json ?? '[]')) as string[] } catch { errors = [] }
  return { id: String(row.id), mode: row.mode as StorageScanRun['mode'], status: row.status as StorageScanRun['status'],
    startedAt: String(row.started_at), finishedAt: String(row.finished_at ?? ''), filesScanned: numberValue(row.files_scanned),
    directoriesScanned: numberValue(row.directories_scanned), bytesScanned: numberValue(row.bytes_scanned),
    reclaimableBytes: numberValue(row.reclaimable_bytes), errorCount: numberValue(row.error_count), errors }
}

function mapScanItem(row: Record<string, unknown>): StorageScanItem {
  return { id: String(row.id), scanId: String(row.scan_id), rootId: String(row.root_id), path: String(row.item_path), name: String(row.item_name),
    sizeBytes: numberValue(row.size_bytes), modifiedAt: String(row.modified_at), accessedAt: String(row.accessed_at), extension: String(row.extension),
    category: row.category as CleanupCategory, risk: row.risk as CleanupRisk, reason: String(row.reason), duplicateKey: String(row.duplicate_key ?? ''),
    verifiedHash: String(row.verified_hash ?? ''), isDirectory: booleanValue(row.is_directory) }
}

export function listStorageRoots(db: ResourceDatabase): StorageRoot[] {
  return (db.prepare('SELECT * FROM storage_roots ORDER BY created_at').all() as Record<string, unknown>[]).map(mapStorageRoot)
}

function validateRootPath(path: string): string {
  const normalized = resolve(path.trim())
  if (!path.trim() || !isAbsolute(normalized) || normalized === '/' || normalized === homedir()) throw new Error('请选择主目录下更具体的扫描目录，不能直接扫描整个根目录或主目录')
  return normalized
}

export function saveStorageRoot(db: ResourceDatabase, path: string, label = '', source: StorageRoot['source'] = 'manual'): StorageRoot[] {
  const normalized = validateRootPath(path)
  const existing = db.prepare('SELECT id FROM storage_roots WHERE root_path = ?').get(normalized) as Record<string, unknown> | undefined
  if (existing) {
    db.prepare('UPDATE storage_roots SET enabled = 1, label = ? WHERE id = ?').run(label.trim() || basename(normalized), existing.id)
  } else {
    db.prepare('INSERT INTO storage_roots(id, root_path, label, enabled, source, created_at, last_scanned_at) VALUES(?, ?, ?, 1, ?, ?, ?)')
      .run(randomUUID(), normalized, label.trim() || basename(normalized), source, nowIso(), '')
  }
  return listStorageRoots(db)
}

export function deleteStorageRoot(db: ResourceDatabase, rootId: string): StorageRoot[] {
  db.prepare('DELETE FROM storage_roots WHERE id = ?').run(rootId)
  return listStorageRoots(db)
}

export function setCleanupCategoryAuthorization(db: ResourceDatabase, category: CleanupCategory, enabled: boolean): CleanupPolicy[] {
  const policy = cleanupPolicies.find((item) => item.key === category)
  if (!policy?.requiresCategoryAuthorization) throw new Error('该策略不需要额外授权')
  db.prepare(`INSERT INTO cleanup_category_authorizations(category, enabled, updated_at) VALUES(?, ?, ?)
    ON CONFLICT(category) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`).run(category, enabled ? 1 : 0, nowIso())
  const categoryPaths: Partial<Record<CleanupCategory, string[]>> = {
    cache: [`${homedir()}/Library/Caches`, `${homedir()}/.cache`],
    development: [`${homedir()}/Library/Developer/Xcode/DerivedData`, `${homedir()}/Library/Developer/Xcode/Archives`, `${homedir()}/Library/Developer/CoreSimulator`, `${homedir()}/.gradle/caches`, `${homedir()}/.npm`],
    download: [`${homedir()}/Downloads`],
    log: [`${homedir()}/Library/Logs`],
    trash: [`${homedir()}/.Trash`]
  }
  for (const path of categoryPaths[category] ?? []) {
    if (!existsSync(path)) continue
    if (enabled) saveStorageRoot(db, path, `[${category}] ${basename(path)}`, 'category')
    else db.prepare("UPDATE storage_roots SET enabled = 0 WHERE source = 'category' AND label LIKE ?").run(`[${category}]%`)
  }
  return listCleanupPolicies(db)
}

export function listCleanupPolicies(db: ResourceDatabase): CleanupPolicy[] {
  const authorizations = new Map((db.prepare('SELECT category, enabled FROM cleanup_category_authorizations').all() as Record<string, unknown>[])
    .map((row) => [String(row.category), booleanValue(row.enabled)]))
  return cleanupPolicies.map((policy) => ({ ...policy, enabled: policy.requiresCategoryAuthorization ? authorizations.get(policy.key) === true : policy.enabled }))
}

function extensionOf(path: string): string {
  const name = basename(path)
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index).toLowerCase() : ''
}

function classifyStorageItem(path: string, sizeBytes: number, modifiedMs: number, accessedMs: number, duplicateKey: string): Pick<StorageScanItem, 'category' | 'risk' | 'reason'> | null {
  const lower = path.toLowerCase()
  const ageMs = Date.now() - Math.max(modifiedMs, accessedMs)
  const ext = extensionOf(path)
  if (lower.includes('/system/') || lower.startsWith('/private/var/')) return { category: 'protected', risk: 'protected', reason: '系统保护目录，只提供占用提示' }
  if (/(^|\/)(node_modules|deriveddata|coresimulator|\.gradle|\.next|dist|build)(\/|$)/i.test(path)) return { category: 'development', risk: 'confirm', reason: '可重新生成的开发依赖或构建产物' }
  if (lower.includes('/library/caches/') || lower.includes('/.cache/')) return { category: 'cache', risk: 'low', reason: '应用缓存，清理后可能需要重新下载或生成' }
  if (lower.includes('/library/logs/') || ext === '.log') return { category: 'log', risk: 'low', reason: '历史日志文件' }
  if (lower.includes('/.trash/')) return { category: 'trash', risk: 'high', reason: '废纸篓内容；默认不执行永久清空' }
  if (lower.includes('/downloads/') && ['.dmg', '.pkg', '.zip', '.tar', '.gz', '.7z'].includes(ext) && ageMs >= 30 * 86400_000) return { category: 'download', risk: 'confirm', reason: '下载目录中的过期安装包或压缩包' }
  if (sizeBytes >= largeFileBytes) return { category: 'large-file', risk: 'confirm', reason: '文件超过 1 GB' }
  if (sizeBytes >= staleFileBytes && ageMs >= staleAgeMs) return { category: 'stale-file', risk: 'confirm', reason: '文件超过 500 MB 且 90 天未使用' }
  if (duplicateKey && sizeBytes >= 10 * 1024 ** 2) return { category: 'duplicate-candidate', risk: 'confirm', reason: '存在相同尺寸文件，需哈希校验' }
  return null
}

type ActiveScan = { id: string; paused: boolean; cancelled: boolean }
const activeScans = new Map<string, ActiveScan>()

async function waitWhilePaused(scan: ActiveScan): Promise<void> {
  while (scan.paused && !scan.cancelled) await new Promise((resolveWait) => setTimeout(resolveWait, 200))
}

export function pauseStorageScan(scanId: string, paused: boolean): void {
  const scan = activeScans.get(scanId)
  if (!scan) throw new Error('扫描任务不存在或已经结束')
  scan.paused = paused
}

type DirectoryVisitTotals = {
  size: number
  fileCount: number
  directoryCount: number
  isDirectory: boolean
}

export async function startStorageScan(
  db: ResourceDatabase,
  mode: 'quick' | 'deep',
  onProgress?: (progress: StorageScanProgress) => void
): Promise<StorageScanRun> {
  if (activeScans.size > 0) throw new Error('已有存储扫描正在进行')
  const roots = listStorageRoots(db).filter((root) => root.enabled)
  if (roots.length === 0) throw new Error('请先添加至少一个扫描目录')
  const scan: ActiveScan = { id: randomUUID(), paused: false, cancelled: false }
  activeScans.set(scan.id, scan)
  const startedAt = nowIso()
  const stats = { filesScanned: 0, directoriesScanned: 0, bytesScanned: 0, reclaimableBytes: 0, errors: [] as string[] }
  db.prepare('INSERT INTO storage_scan_runs(id, mode, status, started_at) VALUES(?, ?, ?, ?)').run(scan.id, mode, 'running', startedAt)
  const sizePaths = new Map<number, string[]>()
  const candidates: Array<{ root: StorageRoot; path: string; size: number; modifiedAt: Date; accessedAt: Date; isDirectory: boolean }> = []
  const directoryRows: Array<{ rootId: string; path: string; parentPath: string; sizeBytes: number; fileCount: number; directoryCount: number; childDirectoryCount: number; depth: number }> = []
  const enabledPolicyKeys = new Set(listCleanupPolicies(db).filter((policy) => policy.enabled).map((policy) => policy.key))

  const emit = (currentPath: string, status: StorageScanRun['status'] = scan.paused ? 'paused' : 'running'): void => onProgress?.({
    scanId: scan.id, status, currentPath, filesScanned: stats.filesScanned, directoriesScanned: stats.directoriesScanned,
    bytesScanned: stats.bytesScanned, reclaimableBytes: stats.reclaimableBytes, errorCount: stats.errors.length
  })

  async function visit(root: StorageRoot, path: string, depth: number): Promise<DirectoryVisitTotals> {
    await waitWhilePaused(scan)
    if (scan.cancelled) return { size: 0, fileCount: 0, directoryCount: 0, isDirectory: false }
    let info
    try { info = await lstat(path) } catch (error) { stats.errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`); return { size: 0, fileCount: 0, directoryCount: 0, isDirectory: false } }
    if (info.isSymbolicLink()) return { size: 0, fileCount: 0, directoryCount: 0, isDirectory: false }
    if (!info.isDirectory()) {
      stats.filesScanned += 1
      stats.bytesScanned += info.size
      if (info.size >= 10 * 1024 ** 2) {
        const paths = sizePaths.get(info.size) ?? []
        paths.push(path); sizePaths.set(info.size, paths)
        candidates.push({ root, path, size: info.size, modifiedAt: info.mtime, accessedAt: info.atime, isDirectory: false })
      }
      if (stats.filesScanned % 250 === 0) emit(path)
      return { size: info.size, fileCount: 1, directoryCount: 0, isDirectory: false }
    }
    stats.directoriesScanned += 1
    const atomicBundle = depth > 0 && /\.(app|photoslibrary|xcodeproj|xcworkspace)$/i.test(path)
    const knownRegenerableDirectory = /(node_modules|deriveddata|coresimulator|\.gradle|\.next|dist|build)$/i.test(path)
    if (mode === 'quick' && (atomicBundle || (depth >= 2 && !knownRegenerableDirectory))) {
      candidates.push({ root, path, size: info.size, modifiedAt: info.mtime, accessedAt: info.atime, isDirectory: true })
      return { size: info.size, fileCount: 0, directoryCount: 0, isDirectory: true }
    }
    let entries
    try { entries = await readdir(path) } catch (error) {
      stats.errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
      if (mode === 'deep') directoryRows.push({ rootId: root.id, path, parentPath: depth === 0 ? '' : dirname(path), sizeBytes: 0, fileCount: 0, directoryCount: 0, childDirectoryCount: 0, depth })
      return { size: 0, fileCount: 0, directoryCount: 0, isDirectory: true }
    }
    let total = 0
    let fileCount = 0
    let directoryCount = 0
    let childDirectoryCount = 0
    for (const entry of entries) {
      const child = await visit(root, resolve(path, entry), depth + 1)
      total += child.size
      fileCount += child.fileCount
      if (child.isDirectory) {
        childDirectoryCount += 1
        directoryCount += 1 + child.directoryCount
      }
    }
    if (mode === 'deep') directoryRows.push({ rootId: root.id, path, parentPath: depth === 0 ? '' : dirname(path), sizeBytes: total, fileCount, directoryCount, childDirectoryCount, depth })
    if (root.source === 'category' && depth === 1 && total >= 10 * 1024 ** 2) {
      candidates.push({ root, path, size: total, modifiedAt: info.mtime, accessedAt: info.atime, isDirectory: true })
    }
    if (total >= staleFileBytes && knownRegenerableDirectory) {
      candidates.push({ root, path, size: total, modifiedAt: info.mtime, accessedAt: info.atime, isDirectory: true })
    }
    return { size: total, fileCount, directoryCount, isDirectory: true }
  }

  try {
    for (const root of roots) {
      await visit(root, root.path, 0)
      db.prepare('UPDATE storage_roots SET last_scanned_at = ? WHERE id = ?').run(nowIso(), root.id)
    }
    const insert = db.prepare(`INSERT INTO storage_scan_items(id, scan_id, root_id, item_path, item_name, size_bytes, modified_at,
      accessed_at, extension, category, risk, reason, duplicate_key, verified_hash, is_directory) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`)
    for (const candidate of candidates) {
      const duplicates = sizePaths.get(candidate.size) ?? []
      const duplicateKey = duplicates.length > 1 ? `size:${candidate.size}` : ''
      const classification = classifyStorageItem(candidate.path, candidate.size, candidate.modifiedAt.getTime(), candidate.accessedAt.getTime(), duplicateKey)
      if (!classification) continue
      if (!enabledPolicyKeys.has(classification.category)) continue
      insert.run(randomUUID(), scan.id, candidate.root.id, candidate.path, basename(candidate.path), candidate.size,
        candidate.modifiedAt.toISOString(), candidate.accessedAt.toISOString(), extensionOf(candidate.path), classification.category,
        classification.risk, classification.reason, duplicateKey, candidate.isDirectory ? 1 : 0)
      if (classification.risk !== 'protected') stats.reclaimableBytes += candidate.size
    }
    const insertDirectory = db.prepare(`INSERT OR REPLACE INTO storage_directory_snapshots(scan_id, root_id, directory_path, parent_path, size_bytes,
      file_count, directory_count, child_directory_count, depth) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const directory of directoryRows) {
      insertDirectory.run(scan.id, directory.rootId, directory.path, directory.parentPath, directory.sizeBytes,
        directory.fileCount, directory.directoryCount, directory.childDirectoryCount, directory.depth)
    }
    const finishedAt = nowIso()
    db.prepare(`UPDATE storage_scan_runs SET status = 'completed', finished_at = ?, files_scanned = ?, directories_scanned = ?,
      bytes_scanned = ?, reclaimable_bytes = ?, error_count = ?, errors_json = ? WHERE id = ?`).run(finishedAt, stats.filesScanned,
      stats.directoriesScanned, stats.bytesScanned, stats.reclaimableBytes, stats.errors.length, JSON.stringify(stats.errors.slice(0, 100)), scan.id)
    db.prepare(`UPDATE system_monitor_settings SET ${mode === 'deep' ? 'last_deep_scan_at' : 'last_quick_scan_at'} = ? WHERE id = 1`).run(finishedAt)
    recordAudit(db, { action: 'scan', target: roots.map((root) => root.path).join(', '), status: 'success', detail: `${mode === 'deep' ? '深度' : '快速'}扫描完成，发现 ${candidates.length} 个候选项`, reclaimedBytes: stats.reclaimableBytes })
    emit('', 'completed')
    return mapScanRun(db.prepare('SELECT * FROM storage_scan_runs WHERE id = ?').get(scan.id) as Record<string, unknown>)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    db.prepare(`UPDATE storage_scan_runs SET status = 'failed', finished_at = ?, error_count = ?, errors_json = ? WHERE id = ?`)
      .run(nowIso(), stats.errors.length + 1, JSON.stringify([...stats.errors, detail].slice(0, 100)), scan.id)
    recordAudit(db, { action: 'scan', target: roots.map((root) => root.path).join(', '), status: 'failed', detail, reclaimedBytes: 0 })
    throw error
  } finally {
    activeScans.delete(scan.id)
  }
}

function clampDirectoryQueryLimit(value: unknown): number {
  const limit = Math.trunc(numberValue(value))
  return Math.max(1, Math.min(500, limit || 200))
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function latestCompletedStorageScanId(db: ResourceDatabase): string {
  const row = db.prepare("SELECT id FROM storage_scan_runs WHERE status = 'completed' ORDER BY started_at DESC LIMIT 1").get() as Record<string, unknown> | undefined
  return row ? String(row.id) : ''
}

function previousCompletedStorageScanId(db: ResourceDatabase, scanId: string): string {
  const run = db.prepare('SELECT started_at FROM storage_scan_runs WHERE id = ?').get(scanId) as Record<string, unknown> | undefined
  if (!run) return ''
  const previous = db.prepare("SELECT id FROM storage_scan_runs WHERE status = 'completed' AND started_at < ? ORDER BY started_at DESC LIMIT 1").get(String(run.started_at)) as Record<string, unknown> | undefined
  return previous ? String(previous.id) : ''
}

function listRootDirectorySizes(db: ResourceDatabase, scanId: string): Map<string, number> {
  return new Map((db.prepare(`SELECT d.root_id, d.size_bytes FROM storage_directory_snapshots d
    INNER JOIN storage_roots r ON r.id = d.root_id
    WHERE d.scan_id = ? AND d.directory_path = r.root_path`).all(scanId) as Record<string, unknown>[])
    .map((row) => [String(row.root_id), numberValue(row.size_bytes)]))
}

function mapDirectoryEntry(row: Record<string, unknown>, rootSizes: Map<string, number>): StorageDirectoryEntry {
  const rootId = String(row.root_id)
  const sizeBytes = numberValue(row.size_bytes)
  const rootBytes = rootSizes.get(rootId) ?? 0
  return {
    path: String(row.directory_path),
    name: basename(String(row.directory_path)),
    rootId,
    parentPath: String(row.parent_path),
    sizeBytes,
    growthBytes: sizeBytes - numberValue(row.previous_size_bytes ?? row.size_bytes),
    fileCount: numberValue(row.file_count),
    directoryCount: numberValue(row.directory_count),
    childDirectoryCount: numberValue(row.child_directory_count),
    depth: numberValue(row.depth),
    rootPercent: rootBytes > 0 ? Math.max(0, Math.min(100, (sizeBytes / rootBytes) * 100)) : 0
  }
}

export function listStorageDirectories(db: ResourceDatabase, query: StorageDirectoryQuery = {}): StorageDirectoryList {
  const scanId = query.scanId?.trim() || latestCompletedStorageScanId(db)
  if (!scanId) return { scanId: '', total: 0, directories: [] }
  const scan = db.prepare('SELECT id FROM storage_scan_runs WHERE id = ? AND status = ?').get(scanId, 'completed') as Record<string, unknown> | undefined
  if (!scan) return { scanId, total: 0, directories: [] }
  const rootId = query.rootId?.trim() ?? ''
  if (rootId) {
    const root = db.prepare('SELECT id FROM storage_roots WHERE id = ? AND enabled = 1').get(rootId) as Record<string, unknown> | undefined
    if (!root) throw new Error('该扫描根目录未授权或不存在')
  }

  const search = query.search?.trim().toLowerCase() ?? ''
  const parentPath = query.parentPath?.trim()
  const whereClauses = [
    'd.scan_id = ?',
    'EXISTS (SELECT 1 FROM storage_roots r WHERE r.id = d.root_id AND r.enabled = 1)'
  ]
  const whereParams: Array<string | number> = [scanId]
  if (rootId) {
    whereClauses.push('d.root_id = ?')
    whereParams.push(rootId)
  }
  if (parentPath !== undefined && parentPath !== '') {
    whereClauses.push('d.parent_path = ?')
    whereParams.push(parentPath)
  } else if (!search) {
    whereClauses.push("d.parent_path = ''")
  }
  if (search) {
    whereClauses.push('LOWER(d.directory_path) LIKE ? ESCAPE ?')
    whereParams.push(`%${escapeLike(search)}%`, '\\')
  }

  const sortColumns: Record<StorageDirectorySortBy, string> = {
    childDirectoryCount: 'd.child_directory_count',
    depth: 'd.depth',
    directoryCount: 'd.directory_count',
    fileCount: 'd.file_count',
    growthBytes: '(d.size_bytes - COALESCE(p.size_bytes, d.size_bytes))',
    name: 'd.directory_path',
    sizeBytes: 'd.size_bytes'
  }
  const sortBy = query.sortBy && sortColumns[query.sortBy] ? query.sortBy : 'sizeBytes'
  const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const limit = clampDirectoryQueryLimit(query.limit)
  const offset = Math.max(0, Math.trunc(numberValue(query.offset)))
  const previousScanId = previousCompletedStorageScanId(db, scanId)
  const previousJoin = previousScanId ? ' LEFT JOIN storage_directory_snapshots p ON p.scan_id = ? AND p.directory_path = d.directory_path' : ''
  const selectParams: Array<string | number> = previousScanId ? [previousScanId, ...whereParams, limit, offset] : [...whereParams, limit, offset]
  const count = db.prepare(`SELECT COUNT(*) count FROM storage_directory_snapshots d WHERE ${whereClauses.join(' AND ')}`).get(...whereParams) as Record<string, unknown>
  const rows = db.prepare(`SELECT d.*, ${previousScanId ? 'COALESCE(p.size_bytes, d.size_bytes)' : 'd.size_bytes'} AS previous_size_bytes
    FROM storage_directory_snapshots d${previousJoin}
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${sortColumns[sortBy]} ${sortOrder}, d.directory_path ASC
    LIMIT ? OFFSET ?`).all(...selectParams) as Record<string, unknown>[]
  const rootSizes = listRootDirectorySizes(db, scanId)
  return { scanId, total: numberValue(count.count), directories: rows.map((row) => mapDirectoryEntry(row, rootSizes)) }
}

export function getStorageOverview(db: ResourceDatabase): StorageOverview {
  const latestRow = db.prepare('SELECT * FROM storage_scan_runs ORDER BY started_at DESC LIMIT 1').get() as Record<string, unknown> | undefined
  const latestRun = latestRow ? mapScanRun(latestRow) : null
  const items = latestRun ? (db.prepare('SELECT * FROM storage_scan_items WHERE scan_id = ? ORDER BY size_bytes DESC LIMIT 1000').all(latestRun.id) as Record<string, unknown>[]).map(mapScanItem) : []
  const categoryBytes: Record<string, number> = {}
  for (const item of items) categoryBytes[item.category] = (categoryBytes[item.category] ?? 0) + item.sizeBytes
  const directories = latestRun ? listStorageDirectories(db, { scanId: latestRun.id, limit: 200 }).directories : []
  const trend = (db.prepare("SELECT started_at, bytes_scanned, reclaimable_bytes FROM storage_scan_runs WHERE status = 'completed' ORDER BY started_at DESC LIMIT 30").all() as Record<string, unknown>[]).reverse().map((row) => ({
    capturedAt: String(row.started_at), scannedBytes: numberValue(row.bytes_scanned), reclaimableBytes: numberValue(row.reclaimable_bytes)
  }))
  return { roots: listStorageRoots(db), latestRun, items, policies: listCleanupPolicies(db),
    totalReclaimableBytes: items.filter((item) => item.risk !== 'protected').reduce((sum, item) => sum + item.sizeBytes, 0), categoryBytes, directories, trend }
}

function assertAuthorizedItem(db: ResourceDatabase, itemId: string): StorageScanItem {
  const row = db.prepare('SELECT * FROM storage_scan_items WHERE id = ?').get(itemId) as Record<string, unknown> | undefined
  if (!row) throw new Error('清理项不存在')
  const item = mapScanItem(row)
  const root = db.prepare('SELECT * FROM storage_roots WHERE id = ? AND enabled = 1').get(item.rootId) as Record<string, unknown> | undefined
  if (!root) throw new Error('该路径未被授权')
  const rootPath = String(root.root_path)
  const relativePath = relative(rootPath, resolve(item.path))
  if (relativePath.startsWith('..') || isAbsolute(relativePath) || item.risk === 'protected') throw new Error('清理路径越过授权目录或属于系统保护范围')
  return item
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}

export async function verifyDuplicateGroup(db: ResourceDatabase, itemId: string): Promise<StorageScanItem[]> {
  const item = assertAuthorizedItem(db, itemId)
  if (!item.duplicateKey || item.isDirectory) throw new Error('该项目不是可校验的重复文件候选')
  const rows = db.prepare('SELECT * FROM storage_scan_items WHERE scan_id = ? AND duplicate_key = ?').all(item.scanId, item.duplicateKey) as Record<string, unknown>[]
  const verified: StorageScanItem[] = []
  for (const row of rows) {
    const candidate = mapScanItem(row)
    try {
      const hash = await hashFile(candidate.path)
      db.prepare('UPDATE storage_scan_items SET verified_hash = ? WHERE id = ?').run(hash, candidate.id)
      verified.push({ ...candidate, verifiedHash: hash })
    } catch (error) {
      recordAudit(db, { action: 'verify', target: candidate.path, status: 'failed', detail: error instanceof Error ? error.message : String(error), reclaimedBytes: 0 })
    }
  }
  recordAudit(db, { action: 'verify', target: item.duplicateKey, status: 'success', detail: `已校验 ${verified.length} 个候选文件`, reclaimedBytes: 0 })
  return verified
}

export function previewCleanup(db: ResourceDatabase, itemIds: string[]): StorageScanItem[] {
  return [...new Set(itemIds)].map((id) => assertAuthorizedItem(db, id))
}

export async function executeCleanupToTrash(
  db: ResourceDatabase,
  itemIds: string[],
  trashItem: (path: string) => Promise<void>
): Promise<CleanupAuditRecord[]> {
  const items = previewCleanup(db, itemIds)
  const duplicateGroups = new Map<string, StorageScanItem[]>()
  for (const item of items.filter((candidate) => candidate.duplicateKey)) {
    const group = duplicateGroups.get(item.duplicateKey) ?? []
    group.push(item); duplicateGroups.set(item.duplicateKey, group)
  }
  for (const group of duplicateGroups.values()) {
    if (group.some((item) => !item.verifiedHash) || new Set(group.map((item) => item.verifiedHash)).size !== 1) throw new Error('重复文件必须完成哈希校验且至少保留一个副本')
    const allCopies = db.prepare('SELECT COUNT(*) count FROM storage_scan_items WHERE scan_id = ? AND duplicate_key = ? AND verified_hash = ?')
      .get(group[0].scanId, group[0].duplicateKey, group[0].verifiedHash) as Record<string, unknown>
    if (group.length >= numberValue(allCopies.count)) throw new Error('重复文件组必须至少保留一个副本')
  }
  const records: CleanupAuditRecord[] = []
  for (const item of items) {
    try {
      await trashItem(item.path)
      db.prepare('DELETE FROM storage_scan_items WHERE id = ?').run(item.id)
      records.push(recordAudit(db, { action: 'trash', target: item.path, status: 'success', detail: '已移到 macOS 废纸篓', reclaimedBytes: item.sizeBytes }))
    } catch (error) {
      records.push(recordAudit(db, { action: 'trash', target: item.path, status: 'failed', detail: error instanceof Error ? error.message : String(error), reclaimedBytes: 0 }))
    }
  }
  return records
}

export function exportProcessAnalysisCsv(rows: ProcessAnalysis[]): string {
  const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`
  const header = ['App', 'Process', 'Path', 'Average CPU %', 'Peak CPU %', 'Average Memory Bytes', 'Peak Memory Bytes', 'Received Bytes', 'Sent Bytes', 'Samples', 'Above Threshold Seconds', 'First Seen', 'Last Seen']
  return [header.map(escape).join(','), ...rows.map((row) => [row.appName, row.processName, row.executablePath, row.averageCpuPercent,
    row.peakCpuPercent, row.averageMemoryBytes, row.peakMemoryBytes, row.networkReceivedBytes, row.networkSentBytes,
    row.sampleCount, row.aboveThresholdSeconds, row.firstSeenAt, row.lastSeenAt].map(escape).join(','))].join('\n')
}

export class ResourceMonitorService {
  private timer: NodeJS.Timeout | null = null
  private retentionTimer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly getDatabase: () => ResourceDatabase,
    private readonly collectLightweightSnapshot: () => Promise<{ capturedAt: string; memoryUsagePercent: number; memoryUsedBytes: number; swapUsedBytes: number; storageUsagePercent: number }>
  ) {}

  async sample(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const [snapshot, processes] = await Promise.all([this.collectLightweightSnapshot(), collectResourceProcesses()])
      recordResourceSample(this.getDatabase(), { ...snapshot, cpuPercent: readCpuUsagePercent(), processes })
    } finally {
      this.running = false
    }
  }

  start(): void {
    if (this.timer) return
    readCpuUsagePercent()
    this.timer = setInterval(() => void this.sample().catch((error) => console.error('Resource sample failed', error)), sampleIntervalMs)
    this.timer.unref?.()
    setTimeout(() => void this.sample().catch((error) => console.error('Initial resource sample failed', error)), 2500).unref?.()
    this.retentionTimer = setInterval(() => runResourceRetention(this.getDatabase()), 86400_000)
    this.retentionTimer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.retentionTimer) clearInterval(this.retentionTimer)
    this.timer = null; this.retentionTimer = null
  }
}
