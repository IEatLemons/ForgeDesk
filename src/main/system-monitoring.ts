import { execFile } from 'node:child_process'
import { getServers } from 'node:dns'
import { readFile } from 'node:fs/promises'
import { arch, cpus, freemem, homedir, hostname, loadavg, networkInterfaces, platform, release, totalmem, uptime } from 'node:os'
import { join } from 'node:path'

export type SystemMonitorStatus = 'healthy' | 'warning' | 'critical'

export type SystemMonitorDiskVolume = {
  filesystem: string
  mount: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

export type SystemMonitorMemoryInfo = {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

export type SystemMonitorCpuInfo = {
  model: string
  coreCount: number
  speedMhz: number
  loadAverage: number[]
  loadPercent: number
}

export type SystemMonitorAppInfo = {
  version: string
  isPackaged: boolean
  isDevelopmentBuild: boolean
  isDevServer: boolean
  appPath: string
  projectRoot: string
  processId: number
  uptimeSeconds: number
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
  v8Version: string
}

export type SystemMonitorSystemInfo = {
  platform: NodeJS.Platform
  release: string
  arch: string
  hostname: string
  uptimeSeconds: number
}

export type SystemMonitorNetworkInterface = {
  name: string
  address: string
  family: string
  mac: string
  cidr: string
  internal: boolean
}

export type SystemMonitorProxyEndpoint = {
  enabled: boolean
  host: string
  port: number
}

export type SystemMonitorProxyInfo = {
  available: boolean
  enabled: boolean
  source: 'macos' | 'environment' | 'none'
  http: SystemMonitorProxyEndpoint
  https: SystemMonitorProxyEndpoint
  socks: SystemMonitorProxyEndpoint
  pac: {
    enabled: boolean
    url: string
  }
  bypass: string[]
  error: string
}

export type SystemMonitorDefaultRoute = {
  gateway: string
  interface: string
  error: string
}

export type SystemMonitorClashProxyGroup = {
  name: string
  type: string
  now: string
}

export type SystemMonitorClashInfo = {
  detected: boolean
  running: boolean
  apiAvailable: boolean
  status: 'connected' | 'auth-required' | 'not-running' | 'unknown'
  name: string
  controllerUrl: string
  configPath: string
  secretConfigured: boolean
  version: string
  mode: string
  allowLan: boolean
  mixedPort: number
  httpPort: number
  socksPort: number
  redirPort: number
  tproxyPort: number
  activeProxyGroups: SystemMonitorClashProxyGroup[]
  connectionCount: number
  downloadTotalBytes: number
  uploadTotalBytes: number
  downloadSpeedBytes: number
  uploadSpeedBytes: number
  message: string
  error: string
}

export type SystemMonitorNetworkInfo = {
  interfaces: SystemMonitorNetworkInterface[]
  dnsServers: string[]
  proxy: SystemMonitorProxyInfo
  route: SystemMonitorDefaultRoute
  clash: SystemMonitorClashInfo
}

export type SystemMonitorSnapshot = {
  checkedAt: string
  status: SystemMonitorStatus
  statusMessage: string
  system: SystemMonitorSystemInfo
  cpu: SystemMonitorCpuInfo
  memory: SystemMonitorMemoryInfo
  disks: SystemMonitorDiskVolume[]
  diskError: string
  network: SystemMonitorNetworkInfo
  app: SystemMonitorAppInfo
}

export type SystemMonitorAppContext = Pick<
  SystemMonitorAppInfo,
  'version' | 'isPackaged' | 'isDevelopmentBuild' | 'isDevServer' | 'appPath' | 'projectRoot'
>

export type ExecFileRunner = (
  file: string,
  args: readonly string[],
  callback: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void
) => void

export type DiskVolumeResult = {
  volumes: SystemMonitorDiskVolume[]
  error: string
}

type CommandResult = {
  stdout: string
  stderr: string
  error: string
}

type ClashConfig = {
  path: string
  externalController: string
  secret: string
  mode: string
  allowLan: boolean
  mixedPort: number
  httpPort: number
  socksPort: number
  redirPort: number
  tproxyPort: number
}

export const systemMonitorWarningThreshold = 75
export const systemMonitorCriticalThreshold = 90

function toBytesFromKilobytes(value: number): number {
  return value * 1024
}

function toFiniteNumber(value: string): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseCapacityPercent(value: string): number | null {
  const normalized = value.trim().replace(/%$/, '')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function createDefaultExecFileRunner(): ExecFileRunner {
  return (file, args, callback) => {
    execFile(file, [...args], { maxBuffer: 1024 * 1024 }, callback)
  }
}

function createEndpoint(enabled = false, host = '', port = 0): SystemMonitorProxyEndpoint {
  return { enabled, host, port }
}

function createEmptyProxyInfo(error = ''): SystemMonitorProxyInfo {
  return {
    available: false,
    bypass: [],
    enabled: false,
    error,
    http: createEndpoint(),
    https: createEndpoint(),
    pac: { enabled: false, url: '' },
    socks: createEndpoint(),
    source: 'none'
  }
}

function createEmptyClashInfo(message = '未检测到 ClashX Meta 控制接口'): SystemMonitorClashInfo {
  return {
    activeProxyGroups: [],
    allowLan: false,
    apiAvailable: false,
    configPath: '',
    connectionCount: 0,
    controllerUrl: '',
    detected: false,
    downloadSpeedBytes: 0,
    downloadTotalBytes: 0,
    error: '',
    httpPort: 0,
    message,
    mixedPort: 0,
    mode: '',
    name: 'ClashX Meta',
    redirPort: 0,
    running: false,
    secretConfigured: false,
    socksPort: 0,
    status: 'not-running',
    tproxyPort: 0,
    uploadSpeedBytes: 0,
    uploadTotalBytes: 0,
    version: ''
  }
}

function toBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function parseNumberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function stripInlineComment(value: string): string {
  let quote: string | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]

    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
    }

    if (char === '#' && !quote) {
      return value.slice(0, index).trim()
    }
  }

  return value.trim()
}

function unquote(value: string): string {
  const normalized = stripInlineComment(value)

  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    return normalized.slice(1, -1)
  }

  return normalized
}

function runCommand(execFileRunner: ExecFileRunner, file: string, args: readonly string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFileRunner(file, args, (error, stdout, stderr) => {
      resolve({
        error: error ? String(stderr || error.message || `${file} 执行失败`).trim() : '',
        stderr: String(stderr ?? ''),
        stdout: String(stdout ?? '')
      })
    })
  })
}

function createMemoryInfo(totalBytes: number, freeBytes: number): SystemMonitorMemoryInfo {
  const safeTotalBytes = Math.max(0, totalBytes)
  const safeFreeBytes = Math.max(0, Math.min(safeTotalBytes, freeBytes))
  const usedBytes = Math.max(0, safeTotalBytes - safeFreeBytes)
  const usagePercent = safeTotalBytes > 0 ? (usedBytes / safeTotalBytes) * 100 : 0

  return {
    freeBytes: safeFreeBytes,
    totalBytes: safeTotalBytes,
    usagePercent,
    usedBytes
  }
}

function createCpuInfo(): SystemMonitorCpuInfo {
  const cpuList = cpus()
  const coreCount = Math.max(cpuList.length, 1)
  const speedMhz = cpuList.length > 0 ? Math.round(cpuList.reduce((sum, cpu) => sum + cpu.speed, 0) / cpuList.length) : 0
  const loadAverage = loadavg().map((value) => Number(value.toFixed(2)))

  return {
    coreCount,
    loadAverage,
    loadPercent: Math.max(0, Math.min(100, (loadAverage[0] / coreCount) * 100)),
    model: cpuList[0]?.model ?? 'Unknown CPU',
    speedMhz
  }
}

function safeSystemUptimeSeconds(): number {
  try {
    return Math.round(uptime())
  } catch {
    return 0
  }
}

function readNetworkInterfaces(): SystemMonitorNetworkInterface[] {
  return Object.entries(networkInterfaces())
    .flatMap(([name, entries]) =>
      (entries ?? []).map((entry) => ({
        address: entry.address,
        cidr: entry.cidr ?? '',
        family: String(entry.family),
        internal: entry.internal,
        mac: entry.mac,
        name
      }))
    )
    .filter((entry) => entry.address && (entry.family === 'IPv4' || entry.family === 'IPv6'))
    .sort((left, right) => Number(left.internal) - Number(right.internal) || left.name.localeCompare(right.name) || left.address.localeCompare(right.address))
}

export function parseRouteOutput(output: string): SystemMonitorDefaultRoute {
  const gateway = output.match(/^\s*gateway:\s*(.+)$/m)?.[1]?.trim() ?? ''
  const routeInterface = output.match(/^\s*interface:\s*(.+)$/m)?.[1]?.trim() ?? ''

  return {
    error: gateway || routeInterface ? '' : '未识别默认网关',
    gateway,
    interface: routeInterface
  }
}

export function parseNetstatRouteOutput(output: string): SystemMonitorDefaultRoute {
  const line = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith('default '))

  if (!line) {
    return { error: '未识别默认网关', gateway: '', interface: '' }
  }

  const columns = line.split(/\s+/)

  return {
    error: columns[1] || columns[3] ? '' : '未识别默认网关',
    gateway: columns[1] ?? '',
    interface: columns[3] ?? ''
  }
}

export async function readDefaultRoute(execFileRunner: ExecFileRunner, currentPlatform = platform()): Promise<SystemMonitorDefaultRoute> {
  if (currentPlatform !== 'darwin') {
    return { error: '当前平台暂不支持默认网关采集', gateway: '', interface: '' }
  }

  const result = await runCommand(execFileRunner, 'route', ['-n', 'get', 'default'])

  if (!result.error) {
    return parseRouteOutput(result.stdout)
  }

  const fallback = await runCommand(execFileRunner, 'netstat', ['-rn', '-f', 'inet'])

  if (fallback.error) {
    return { error: result.error || fallback.error, gateway: '', interface: '' }
  }

  return parseNetstatRouteOutput(fallback.stdout)
}

export function parseScutilProxyOutput(output: string): SystemMonitorProxyInfo {
  const readValue = (key: string): string => output.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? ''
  const http = createEndpoint(toBoolean(readValue('HTTPEnable')), readValue('HTTPProxy'), parseNumberValue(readValue('HTTPPort')))
  const https = createEndpoint(toBoolean(readValue('HTTPSEnable')), readValue('HTTPSProxy'), parseNumberValue(readValue('HTTPSPort')))
  const socks = createEndpoint(toBoolean(readValue('SOCKSEnable')), readValue('SOCKSProxy'), parseNumberValue(readValue('SOCKSPort')))
  const pac = {
    enabled: toBoolean(readValue('ProxyAutoConfigEnable')),
    url: readValue('ProxyAutoConfigURLString')
  }
  const enabled = http.enabled || https.enabled || socks.enabled || pac.enabled

  return {
    available: true,
    bypass: [],
    enabled,
    error: '',
    http,
    https,
    pac,
    socks,
    source: 'macos'
  }
}

function readEnvironmentProxyInfo(): SystemMonitorProxyInfo {
  const httpUrl = process.env.HTTP_PROXY || process.env.http_proxy || ''
  const httpsUrl = process.env.HTTPS_PROXY || process.env.https_proxy || ''
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || ''

  const parseProxyUrl = (value: string): SystemMonitorProxyEndpoint => {
    if (!value) {
      return createEndpoint()
    }

    try {
      const url = new URL(value)
      return createEndpoint(true, url.hostname, parseNumberValue(url.port || (url.protocol === 'https:' ? 443 : 80)))
    } catch {
      return createEndpoint(true, value, 0)
    }
  }

  const http = parseProxyUrl(httpUrl)
  const https = parseProxyUrl(httpsUrl)
  const enabled = http.enabled || https.enabled

  return {
    available: enabled,
    bypass: noProxy ? noProxy.split(',').map((item) => item.trim()).filter(Boolean) : [],
    enabled,
    error: '',
    http,
    https,
    pac: { enabled: false, url: '' },
    socks: createEndpoint(),
    source: enabled ? 'environment' : 'none'
  }
}

export async function readSystemProxy(execFileRunner: ExecFileRunner, currentPlatform = platform()): Promise<SystemMonitorProxyInfo> {
  if (currentPlatform === 'darwin') {
    const result = await runCommand(execFileRunner, 'scutil', ['--proxy'])

    if (!result.error) {
      return parseScutilProxyOutput(result.stdout)
    }

    return {
      ...readEnvironmentProxyInfo(),
      error: result.error
    }
  }

  return readEnvironmentProxyInfo()
}

export function parseClashConfig(content: string, path = ''): ClashConfig {
  const values = new Map<string, string>()

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/)

    if (match) {
      values.set(match[1], unquote(match[2]))
    }
  }

  return {
    allowLan: toBoolean(values.get('allow-lan') ?? ''),
    externalController: values.get('external-controller') ?? '',
    httpPort: parseNumberValue(values.get('port')),
    mixedPort: parseNumberValue(values.get('mixed-port')),
    mode: values.get('mode') ?? '',
    path,
    redirPort: parseNumberValue(values.get('redir-port')),
    secret: values.get('secret') ?? '',
    socksPort: parseNumberValue(values.get('socks-port')),
    tproxyPort: parseNumberValue(values.get('tproxy-port'))
  }
}

async function readFirstClashConfig(): Promise<ClashConfig | null> {
  const home = homedir()
  const candidates = [
    join(home, '.config', 'clash.meta', 'config.yaml'),
    join(home, '.config', 'clash.meta', 'config.yml'),
    join(home, '.config', 'clash', 'config.yaml'),
    join(home, '.config', 'clash', 'config.yml'),
    join(home, 'Library', 'Application Support', 'com.metacubex.ClashX.meta', 'config.yaml'),
    join(home, 'Library', 'Application Support', 'ClashX Meta', 'config.yaml'),
    join(home, 'Library', 'Application Support', 'ClashX', 'config.yaml')
  ]

  for (const path of candidates) {
    try {
      return parseClashConfig(await readFile(path, 'utf8'), path)
    } catch {
      // Try the next common ClashX Meta location.
    }
  }

  return null
}

export function normalizeClashControllerUrl(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    return ''
  }

  const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`

  try {
    const url = new URL(withProtocol)

    if (url.hostname === '0.0.0.0' || url.hostname === '::') {
      url.hostname = '127.0.0.1'
    }

    url.pathname = url.pathname.replace(/\/$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function createClashControllerCandidates(config: ClashConfig | null): string[] {
  return Array.from(
    new Set(
      [
        normalizeClashControllerUrl(config?.externalController ?? ''),
        'http://127.0.0.1:9090',
        'http://127.0.0.1:9097'
      ].filter(Boolean)
    )
  )
}

async function fetchJsonWithTimeout(url: string, secret: string, fetchImpl: typeof fetch): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 900)

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {})
      },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'HTTP 401' : `HTTP ${response.status}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function readRecordValue(record: unknown, key: string): unknown {
  return record && typeof record === 'object' ? (record as Record<string, unknown>)[key] : undefined
}

function normalizeClashConfigFromApi(value: unknown, fallback: ClashConfig | null): Partial<SystemMonitorClashInfo> {
  return {
    allowLan: Boolean(readRecordValue(value, 'allow-lan') ?? fallback?.allowLan ?? false),
    httpPort: parseNumberValue(readRecordValue(value, 'port') ?? fallback?.httpPort),
    mixedPort: parseNumberValue(readRecordValue(value, 'mixed-port') ?? fallback?.mixedPort),
    mode: String(readRecordValue(value, 'mode') ?? fallback?.mode ?? ''),
    redirPort: parseNumberValue(readRecordValue(value, 'redir-port') ?? fallback?.redirPort),
    socksPort: parseNumberValue(readRecordValue(value, 'socks-port') ?? fallback?.socksPort),
    tproxyPort: parseNumberValue(readRecordValue(value, 'tproxy-port') ?? fallback?.tproxyPort)
  }
}

function normalizeClashProxyGroups(value: unknown): SystemMonitorClashProxyGroup[] {
  const proxies = readRecordValue(value, 'proxies')

  if (!proxies || typeof proxies !== 'object') {
    return []
  }

  return Object.entries(proxies as Record<string, Record<string, unknown>>)
    .filter(([, proxy]) => ['Selector', 'URLTest', 'Fallback', 'LoadBalance', 'Relay'].includes(String(proxy.type ?? '')))
    .map(([name, proxy]) => ({
      name,
      now: String(proxy.now ?? ''),
      type: String(proxy.type ?? '')
    }))
    .filter((group) => group.now)
    .slice(0, 8)
}

function normalizeClashConnections(value: unknown): Partial<SystemMonitorClashInfo> {
  const connections = readRecordValue(value, 'connections')

  return {
    connectionCount: Array.isArray(connections) ? connections.length : parseNumberValue(readRecordValue(value, 'connectionCount')),
    downloadSpeedBytes: parseNumberValue(readRecordValue(value, 'downloadSpeed')),
    downloadTotalBytes: parseNumberValue(readRecordValue(value, 'downloadTotal')),
    uploadSpeedBytes: parseNumberValue(readRecordValue(value, 'uploadSpeed')),
    uploadTotalBytes: parseNumberValue(readRecordValue(value, 'uploadTotal'))
  }
}

export async function readClashXMetaInfo(fetchImpl: typeof fetch = fetch): Promise<SystemMonitorClashInfo> {
  const config = await readFirstClashConfig()
  const candidates = createClashControllerCandidates(config)
  const baseInfo: SystemMonitorClashInfo = {
    ...createEmptyClashInfo(config ? '已检测到 ClashX Meta 配置，控制接口未连接' : '未检测到 ClashX Meta 配置或控制接口'),
    configPath: config?.path ?? '',
    controllerUrl: normalizeClashControllerUrl(config?.externalController ?? ''),
    detected: Boolean(config),
    httpPort: config?.httpPort ?? 0,
    mixedPort: config?.mixedPort ?? 0,
    mode: config?.mode ?? '',
    redirPort: config?.redirPort ?? 0,
    secretConfigured: Boolean(config?.secret),
    socksPort: config?.socksPort ?? 0,
    tproxyPort: config?.tproxyPort ?? 0
  }

  for (const controllerUrl of candidates) {
    try {
      const version = await fetchJsonWithTimeout(`${controllerUrl}/version`, config?.secret ?? '', fetchImpl)
      const [configs, proxies, connections] = await Promise.allSettled([
        fetchJsonWithTimeout(`${controllerUrl}/configs`, config?.secret ?? '', fetchImpl),
        fetchJsonWithTimeout(`${controllerUrl}/proxies`, config?.secret ?? '', fetchImpl),
        fetchJsonWithTimeout(`${controllerUrl}/connections`, config?.secret ?? '', fetchImpl)
      ])

      const configPatch = configs.status === 'fulfilled' ? normalizeClashConfigFromApi(configs.value, config) : normalizeClashConfigFromApi({}, config)
      const connectionPatch = connections.status === 'fulfilled' ? normalizeClashConnections(connections.value) : {}

      return {
        ...baseInfo,
        ...configPatch,
        ...connectionPatch,
        activeProxyGroups: proxies.status === 'fulfilled' ? normalizeClashProxyGroups(proxies.value) : [],
        apiAvailable: true,
        controllerUrl,
        detected: true,
        error: '',
        message: 'ClashX Meta 控制接口已连接',
        running: true,
        status: 'connected',
        version: String(readRecordValue(version, 'version') ?? '')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (message.includes('401')) {
        return {
          ...baseInfo,
          controllerUrl,
          detected: true,
          error: '控制接口需要密钥，未能读取运行数据',
          message: 'ClashX Meta 控制接口需要密钥',
          running: true,
          status: 'auth-required'
        }
      }
    }
  }

  return baseInfo
}

async function readNetworkInfo(
  execFileRunner: ExecFileRunner,
  options: { currentPlatform?: NodeJS.Platform; fetchImpl?: typeof fetch } = {}
): Promise<SystemMonitorNetworkInfo> {
  const currentPlatform = options.currentPlatform ?? platform()
  const [proxy, route, clash] = await Promise.all([
    readSystemProxy(execFileRunner, currentPlatform),
    readDefaultRoute(execFileRunner, currentPlatform),
    readClashXMetaInfo(options.fetchImpl)
  ])

  return {
    clash,
    dnsServers: getServers(),
    interfaces: readNetworkInterfaces(),
    proxy,
    route
  }
}

export function parseDfOutput(output: string): SystemMonitorDiskVolume[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): SystemMonitorDiskVolume | null => {
      const columns = line.split(/\s+/)

      if (columns.length < 6) {
        return null
      }

      const filesystem = columns.slice(0, columns.length - 5).join(' ')
      const totalKilobytes = toFiniteNumber(columns[columns.length - 5])
      const usedKilobytes = toFiniteNumber(columns[columns.length - 4])
      const availableKilobytes = toFiniteNumber(columns[columns.length - 3])
      const capacityPercent = parseCapacityPercent(columns[columns.length - 2])
      const mount = columns[columns.length - 1]

      if (!filesystem || !mount || totalKilobytes === null || usedKilobytes === null || availableKilobytes === null) {
        return null
      }

      const totalBytes = toBytesFromKilobytes(totalKilobytes)
      const usedBytes = toBytesFromKilobytes(usedKilobytes)
      const availableBytes = toBytesFromKilobytes(availableKilobytes)

      if (totalBytes <= 0 || usedBytes < 0 || availableBytes < 0) {
        return null
      }

      return {
        availableBytes,
        filesystem,
        mount,
        totalBytes,
        usagePercent: capacityPercent ?? (usedBytes / totalBytes) * 100,
        usedBytes
      }
    })
    .filter((volume): volume is SystemMonitorDiskVolume => Boolean(volume))
}

function isDisplayDiskFilesystem(volume: SystemMonitorDiskVolume): boolean {
  return volume.filesystem.startsWith('/dev/') && volume.totalBytes >= 1024 ** 3
}

function isMacSystemDataPair(left: SystemMonitorDiskVolume, right: SystemMonitorDiskVolume): boolean {
  const totalDelta = Math.abs(left.totalBytes - right.totalBytes)
  const availableDelta = Math.abs(left.availableBytes - right.availableBytes)

  return totalDelta < 1024 ** 2 && availableDelta < 1024 ** 2
}

function isInternalMacSystemMount(mount: string): boolean {
  return [
    '/System/Volumes/Data',
    '/System/Volumes/VM',
    '/System/Volumes/Preboot',
    '/System/Volumes/Update',
    '/System/Volumes/xarts',
    '/System/Volumes/iSCPreboot',
    '/System/Volumes/Hardware'
  ].includes(mount)
}

function withUserVisibleUsage(volume: SystemMonitorDiskVolume): SystemMonitorDiskVolume {
  const usedBytes = Math.max(0, volume.totalBytes - volume.availableBytes)

  return {
    ...volume,
    usagePercent: volume.totalBytes > 0 ? (usedBytes / volume.totalBytes) * 100 : 0,
    usedBytes
  }
}

export function normalizeDiskVolumesForDisplay(volumes: SystemMonitorDiskVolume[]): SystemMonitorDiskVolume[] {
  const displayVolumes = volumes.filter(isDisplayDiskFilesystem)
  const rootVolume = displayVolumes.find((volume) => volume.mount === '/')
  const dataVolume = displayVolumes.find((volume) => volume.mount === '/System/Volumes/Data')

  if (!rootVolume) {
    return displayVolumes.map(withUserVisibleUsage)
  }

  const primaryVolume = dataVolume && isMacSystemDataPair(rootVolume, dataVolume) ? withUserVisibleUsage(rootVolume) : rootVolume

  return [
    primaryVolume,
    ...displayVolumes
      .filter((volume) => volume.mount !== '/' && !isInternalMacSystemMount(volume.mount))
      .map(withUserVisibleUsage)
  ]
}

export async function readDiskVolumes(
  options: { execFileRunner?: ExecFileRunner; currentPlatform?: NodeJS.Platform } = {}
): Promise<DiskVolumeResult> {
  const currentPlatform = options.currentPlatform ?? platform()

  if (currentPlatform !== 'darwin' && currentPlatform !== 'linux') {
    return {
      error: '当前平台暂不支持磁盘空间采集',
      volumes: []
    }
  }

  const execFileRunner = options.execFileRunner ?? createDefaultExecFileRunner()

  return new Promise((resolve) => {
    execFileRunner('df', ['-kP'], (error, stdout, stderr) => {
      if (error) {
        resolve({
          error: String(stderr || error.message || '磁盘空间读取失败').trim(),
          volumes: []
        })
        return
      }

      resolve({
        error: '',
        volumes: normalizeDiskVolumesForDisplay(parseDfOutput(String(stdout)))
      })
    })
  })
}

export function resolveSystemMonitorStatus(
  memory: Pick<SystemMonitorMemoryInfo, 'usagePercent'>,
  disks: Array<Pick<SystemMonitorDiskVolume, 'usagePercent'>>
): SystemMonitorStatus {
  const maxDiskUsage = disks.reduce((max, disk) => Math.max(max, disk.usagePercent), 0)
  const maxUsage = Math.max(memory.usagePercent, maxDiskUsage)

  if (maxUsage >= systemMonitorCriticalThreshold) {
    return 'critical'
  }

  if (maxUsage >= systemMonitorWarningThreshold) {
    return 'warning'
  }

  return 'healthy'
}

export function getSystemMonitorStatusMessage(status: SystemMonitorStatus): string {
  switch (status) {
    case 'critical':
      return '资源使用率偏高，请关注内存或磁盘空间。'
    case 'warning':
      return '资源使用接近阈值，建议留意后续变化。'
    default:
      return '系统资源状态正常。'
  }
}

export async function collectSystemMonitorSnapshot(
  appContext: SystemMonitorAppContext,
  options: { execFileRunner?: ExecFileRunner; now?: Date; currentPlatform?: NodeJS.Platform; fetchImpl?: typeof fetch } = {}
): Promise<SystemMonitorSnapshot> {
  const execFileRunner = options.execFileRunner ?? createDefaultExecFileRunner()
  const memory = createMemoryInfo(totalmem(), freemem())
  const diskResult = await readDiskVolumes({
    currentPlatform: options.currentPlatform,
    execFileRunner
  })
  const network = await readNetworkInfo(execFileRunner, {
    currentPlatform: options.currentPlatform,
    fetchImpl: options.fetchImpl
  })
  const status = resolveSystemMonitorStatus(memory, diskResult.volumes)

  return {
    app: {
      ...appContext,
      chromeVersion: process.versions.chrome ?? '',
      electronVersion: process.versions.electron ?? '',
      nodeVersion: process.versions.node,
      processId: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      v8Version: process.versions.v8 ?? ''
    },
    checkedAt: (options.now ?? new Date()).toISOString(),
    cpu: createCpuInfo(),
    diskError: diskResult.error,
    disks: diskResult.volumes,
    memory,
    network,
    status,
    statusMessage: getSystemMonitorStatusMessage(status),
    system: {
      arch: arch(),
      hostname: hostname(),
      platform: platform(),
      release: release(),
      uptimeSeconds: safeSystemUptimeSeconds()
    }
  }
}
