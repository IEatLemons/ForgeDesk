import type { ProjectService, ServiceDeploymentActionInput, ServiceDeploymentSummary } from './data'

type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning'

export type ServiceDeploymentAction = ServiceDeploymentActionInput['action']

export type DeploymentStatusMeta = {
  label: string
  color: string
  badgeStatus: BadgeStatus
}

export type DeploymentProjectTagStyle = {
  color: string
  backgroundColor: string
  borderColor: string
}

export type DeploymentDashboardRow = {
  key: string
  serviceId: string
  serviceName: string
  provider: ProjectService['provider']
  projectName: string
  repositoryId: string
  repositoryName: string
  branchName: string
  authorName: string
  deploymentId: string
  deploymentUrl: string
  environmentName: string
  state: string
  statusMeta: DeploymentStatusMeta
  commitMessage: string
  commitSha: string
  shortCommit: string
  creator: string
  createdAt: string
  readyAt: string
  readyDurationLabel: string
  sourceDeployment: ServiceDeploymentSummary
}

export type DeploymentDashboardFilters = {
  authors?: string[]
  environments?: string[]
  repositories?: string[]
  branches?: string[]
  statuses?: string[]
  query?: string
  dateRange?: [string, string] | null
}

export type DeploymentFilterOptions = {
  authors: string[]
  environments: string[]
  repositories: string[]
  branches: string[]
  statuses: string[]
}

export type DeploymentStatusSummary = {
  total: number
  ready: number
  building: number
  error: number
  queued: number
  canceled: number
  other: number
}

export type DeploymentRefreshError = {
  provider: ProjectService['provider']
  serviceName: string
  message: string
}

export type SystemLogLevel = 'success' | 'info' | 'warning' | 'error'

export type SystemLogEntry = {
  id: string
  time: string
  level: SystemLogLevel
  source: string
  title: string
  message: string
  meta?: Record<string, unknown>
}

export type SystemLogSummary = {
  total: number
  success: number
  info: number
  warning: number
  error: number
  issueCount: number
  latest: SystemLogEntry | null
}

export type DeploymentIssueSummary = {
  issueCount: number
  level: SystemLogLevel
  title: string
  message: string
  detail: string
}

export type DeploymentRefreshService = Pick<ProjectService, 'id' | 'provider'>

export type DeploymentRefreshCursor = Partial<Record<ProjectService['provider'], number>>

export const initialDeploymentVisibleCount = 60
export const deploymentVisibleBatchSize = 60
export const railwayDeploymentRefreshBatchSize = 4
export const deploymentAutoRefreshIntervalMs = 300_000
export const deploymentRateLimitFallbackMs = 60_000

export function isRailwayCancelableDeploymentState(state: string): boolean {
  return ['BUILDING', 'DEPLOYING', 'WAITING', 'QUEUED'].includes(state.trim().toUpperCase())
}

export function isRailwayRunningDeployment(deployment: Pick<ServiceDeploymentSummary, 'state' | 'deploymentStopped'>): boolean {
  return deployment.state.trim().toUpperCase() === 'SUCCESS' && deployment.deploymentStopped !== true
}

export function canRunServiceDeploymentAction(
  provider: ProjectService['provider'],
  deployment: Pick<ServiceDeploymentSummary, 'state' | 'canRedeploy' | 'canRollback' | 'deploymentStopped'>,
  action: ServiceDeploymentAction
): boolean {
  if (provider === 'vercel') {
    return action === 'cancel'
      ? ['BUILDING', 'DEPLOYING', 'INITIALIZING', 'QUEUED', 'PENDING'].includes(deployment.state.trim().toUpperCase())
      : ['redeploy', 'promote', 'rollback'].includes(action)
  }

  if (provider !== 'railway') {
    return false
  }

  if (action === 'redeploy') {
    return deployment.canRedeploy !== false
  }

  if (action === 'restart' || action === 'stop') {
    return isRailwayRunningDeployment(deployment)
  }

  if (action === 'rollback') {
    return deployment.canRollback === true
  }

  if (action === 'cancel') {
    return isRailwayCancelableDeploymentState(deployment.state)
  }

  return false
}

let systemLogSequence = 0

const deploymentProjectTagPalette: DeploymentProjectTagStyle[] = [
  { color: '#0f766e', backgroundColor: '#ccfbf1', borderColor: '#5eead4' },
  { color: '#1d4ed8', backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  { color: '#7c2d12', backgroundColor: '#ffedd5', borderColor: '#fdba74' },
  { color: '#86198f', backgroundColor: '#fae8ff', borderColor: '#e879f9' },
  { color: '#166534', backgroundColor: '#dcfce7', borderColor: '#86efac' },
  { color: '#be123c', backgroundColor: '#ffe4e6', borderColor: '#fda4af' },
  { color: '#6d28d9', backgroundColor: '#ede9fe', borderColor: '#c4b5fd' },
  { color: '#0e7490', backgroundColor: '#cffafe', borderColor: '#67e8f9' },
  { color: '#854d0e', backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  { color: '#374151', backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }
]

export function getDeploymentProjectTagStyle(projectName: string): DeploymentProjectTagStyle {
  const normalizedName = projectName.trim().toLowerCase()

  if (!normalizedName) {
    return deploymentProjectTagPalette[deploymentProjectTagPalette.length - 1]
  }

  let hash = 0

  for (const character of normalizedName) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return deploymentProjectTagPalette[hash % deploymentProjectTagPalette.length]
}

function stringMeta(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = meta[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort(compareText)
}

function timestampValue(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function includesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase())
}

function getReadyDurationLabel(createdAt: string, readyAt: string): string {
  const started = timestampValue(createdAt)
  const ready = timestampValue(readyAt)

  if (!started || !ready || ready < started) {
    return ''
  }

  const seconds = Math.max(0, Math.round((ready - started) / 1000))

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`
}

export function getDeploymentStatusMeta(state: string): DeploymentStatusMeta {
  const normalized = state.trim().toUpperCase()
  const statusMap: Record<string, DeploymentStatusMeta> = {
    READY: { label: 'Ready', color: 'green', badgeStatus: 'success' },
    SUCCESS: { label: 'Ready', color: 'green', badgeStatus: 'success' },
    BUILDING: { label: 'Building', color: 'blue', badgeStatus: 'processing' },
    DEPLOYING: { label: 'Building', color: 'blue', badgeStatus: 'processing' },
    INITIALIZING: { label: 'Building', color: 'blue', badgeStatus: 'processing' },
    QUEUED: { label: 'Queued', color: 'gold', badgeStatus: 'warning' },
    PENDING: { label: 'Queued', color: 'gold', badgeStatus: 'warning' },
    ERROR: { label: 'Error', color: 'red', badgeStatus: 'error' },
    FAILED: { label: 'Error', color: 'red', badgeStatus: 'error' },
    CANCELED: { label: 'Canceled', color: 'default', badgeStatus: 'default' },
    CANCELLED: { label: 'Canceled', color: 'default', badgeStatus: 'default' }
  }

  return statusMap[normalized] ?? { label: normalized || 'Unknown', color: 'default', badgeStatus: 'default' }
}

export function createDeploymentRows(
  services: ProjectService[],
  deploymentsByServiceId: Record<string, ServiceDeploymentSummary[]>
): DeploymentDashboardRow[] {
  return services
    .flatMap((service) =>
      (deploymentsByServiceId[service.id] ?? []).map((deployment) => {
        const repositoryName =
          stringMeta(deployment.meta, 'githubCommitRepo', 'gitlabProjectName', 'bitbucketRepoName', 'repo') ||
          service.externalProjectAlias ||
          service.externalProjectName ||
          service.name
        const branchName = stringMeta(deployment.meta, 'githubCommitRef', 'gitlabCommitRef', 'bitbucketCommitRef', 'branch')
        const authorName =
          stringMeta(deployment.meta, 'githubCommitAuthorName', 'gitlabCommitAuthorName', 'bitbucketCommitAuthorName', 'author') ||
          deployment.creator
        const commitMessage =
          stringMeta(deployment.meta, 'githubCommitMessage', 'gitlabCommitMessage', 'bitbucketCommitMessage', 'message') ||
          `Deployment ${deployment.id}`
        const statusMeta = getDeploymentStatusMeta(deployment.state)

        return {
          key: `${service.id}:${deployment.id}`,
          serviceId: service.id,
          serviceName: service.name,
          provider: service.provider,
          projectName: service.externalProjectAlias || service.externalProjectName || service.name,
          repositoryId: service.repositoryId,
          repositoryName,
          branchName,
          authorName,
          deploymentId: deployment.id,
          deploymentUrl: deployment.url,
          environmentName: deployment.target || service.defaultEnvironment || 'production',
          state: deployment.state,
          statusMeta,
          commitMessage,
          commitSha: deployment.commitSha,
          shortCommit: deployment.commitSha ? deployment.commitSha.slice(0, 7) : '',
          creator: deployment.creator,
          createdAt: deployment.createdAt,
          readyAt: deployment.readyAt,
          readyDurationLabel: getReadyDurationLabel(deployment.createdAt, deployment.readyAt),
          sourceDeployment: deployment
        }
      })
    )
    .sort((left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt))
}

export function filterDeploymentRows(rows: DeploymentDashboardRow[], filters: DeploymentDashboardFilters): DeploymentDashboardRow[] {
  const authors = new Set(filters.authors ?? [])
  const environments = new Set(filters.environments ?? [])
  const repositories = new Set(filters.repositories ?? [])
  const branches = new Set(filters.branches ?? [])
  const statuses = new Set((filters.statuses ?? []).map((status) => status.toUpperCase()))
  const query = filters.query?.trim() ?? ''
  const rangeStart = filters.dateRange?.[0] ? timestampValue(filters.dateRange[0]) : 0
  const rangeEnd = filters.dateRange?.[1] ? timestampValue(filters.dateRange[1]) : 0

  return rows.filter((row) => {
    if (authors.size > 0 && !authors.has(row.authorName)) {
      return false
    }

    if (environments.size > 0 && !environments.has(row.environmentName)) {
      return false
    }

    if (repositories.size > 0 && !repositories.has(row.repositoryName)) {
      return false
    }

    if (branches.size > 0 && !branches.has(row.branchName)) {
      return false
    }

    if (statuses.size > 0 && !statuses.has(row.state.toUpperCase())) {
      return false
    }

    if (rangeStart || rangeEnd) {
      const created = timestampValue(row.createdAt)

      if (rangeStart && created < rangeStart) {
        return false
      }

      if (rangeEnd && created > rangeEnd) {
        return false
      }
    }

    if (!query) {
      return true
    }

    return [row.commitMessage, row.serviceName, row.projectName, row.repositoryName, row.branchName, row.deploymentId, row.shortCommit, row.authorName].some((value) =>
      includesText(value, query)
    )
  })
}

export function createDeploymentFilterOptions(rows: DeploymentDashboardRow[]): DeploymentFilterOptions {
  return {
    authors: uniqueSorted(rows.map((row) => row.authorName)),
    environments: uniqueSorted(rows.map((row) => row.environmentName)),
    repositories: uniqueSorted(rows.map((row) => row.repositoryName)),
    branches: uniqueSorted(rows.map((row) => row.branchName)),
    statuses: uniqueSorted(rows.map((row) => row.state))
  }
}

export function createDeploymentStatusSummary(rows: DeploymentDashboardRow[]): DeploymentStatusSummary {
  return rows.reduce<DeploymentStatusSummary>(
    (summary, row) => {
      const state = row.state.toUpperCase()

      summary.total += 1

      if (state === 'READY' || state === 'SUCCESS') {
        summary.ready += 1
      } else if (state === 'BUILDING' || state === 'DEPLOYING' || state === 'INITIALIZING') {
        summary.building += 1
      } else if (state === 'ERROR' || state === 'FAILED') {
        summary.error += 1
      } else if (state === 'QUEUED' || state === 'PENDING') {
        summary.queued += 1
      } else if (state === 'CANCELED' || state === 'CANCELLED') {
        summary.canceled += 1
      } else {
        summary.other += 1
      }

      return summary
    },
    { total: 0, ready: 0, building: 0, error: 0, queued: 0, canceled: 0, other: 0 }
  )
}

export function getVisibleDeploymentRows(rows: DeploymentDashboardRow[], visibleCount: number): DeploymentDashboardRow[] {
  const safeVisibleCount = Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : initialDeploymentVisibleCount

  return rows.slice(0, safeVisibleCount)
}

export function getNextDeploymentVisibleCount(currentVisibleCount: number, totalRows: number, batchSize = deploymentVisibleBatchSize): number {
  const safeCurrentCount = Number.isFinite(currentVisibleCount) && currentVisibleCount > 0 ? Math.floor(currentVisibleCount) : 0
  const safeBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : deploymentVisibleBatchSize
  const safeTotalRows = Number.isFinite(totalRows) && totalRows > 0 ? Math.floor(totalRows) : 0

  return Math.min(safeCurrentCount + safeBatchSize, safeTotalRows)
}

export function isDeploymentRateLimitMessage(message: string): boolean {
  return /(?:\b429\b|too many requests|rate[_\s-]?limit)/i.test(message)
}

export function getDeploymentRateLimitRetryMs(message: string): number {
  const match = /try again in\s+([\d.]+)\s+seconds?/i.exec(message)
  const seconds = match ? Number.parseFloat(match[1]) : 0

  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 0
}

export function createSystemLogEntry(
  input: Omit<SystemLogEntry, 'id' | 'time'>,
  options: Partial<Pick<SystemLogEntry, 'id' | 'time'>> = {}
): SystemLogEntry {
  const time = options.time ?? new Date().toISOString()
  const id = options.id ?? `${time}-${systemLogSequence}`

  systemLogSequence += 1

  return {
    id,
    time,
    ...input
  }
}

export function createSystemLogSummary(logs: SystemLogEntry[]): SystemLogSummary {
  return logs.reduce<SystemLogSummary>(
    (summary, log) => {
      summary.total += 1
      summary[log.level] += 1

      if (!summary.latest || timestampValue(log.time) > timestampValue(summary.latest.time)) {
        summary.latest = log
      }

      summary.issueCount = summary.error + summary.warning

      return summary
    },
    { total: 0, success: 0, info: 0, warning: 0, error: 0, issueCount: 0, latest: null }
  )
}

function formatRetryDelay(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))

  if (minutes < 60) {
    return `${minutes} 分钟`
  }

  return `${Math.ceil(minutes / 60)} 小时`
}

function getProviderLabel(provider: ProjectService['provider']): string {
  return provider === 'railway' ? 'Railway' : 'Vercel'
}

export function summarizeDeploymentRefreshErrors(
  errors: DeploymentRefreshError[],
  providerServiceCounts: Partial<Record<ProjectService['provider'], number>> = {}
): string {
  const rateLimitProviders = new Map<ProjectService['provider'], DeploymentRefreshError[]>()
  const otherErrors: DeploymentRefreshError[] = []

  for (const error of errors) {
    if (isDeploymentRateLimitMessage(error.message)) {
      rateLimitProviders.set(error.provider, [...(rateLimitProviders.get(error.provider) ?? []), error])
    } else {
      otherErrors.push(error)
    }
  }

  const messages: string[] = []

  for (const [provider, providerErrors] of rateLimitProviders) {
    const retryMs = Math.max(...providerErrors.map((error) => getDeploymentRateLimitRetryMs(error.message)), 0)
    const retryText = retryMs > 0 ? `，约 ${formatRetryDelay(retryMs)}后再试` : ''
    const affectedServices = providerServiceCounts[provider] ?? providerErrors.length

    messages.push(`${getProviderLabel(provider)} 部署读取触发平台限流，已使用本地缓存并暂停刷新${retryText}。（影响 ${affectedServices} 个服务）`)
  }

  const seenOtherErrors = new Set<string>()

  for (const error of otherErrors) {
    const message = `${error.serviceName}: ${error.message}`

    if (!seenOtherErrors.has(message)) {
      messages.push(message)
      seenOtherErrors.add(message)
    }
  }

  return messages.join('\n')
}

function isAuthorizationErrorMessage(message: string): boolean {
  return /(?:\b401\b|\b403\b|forbidden|unauthorized|not authorized|scope|token)/i.test(message)
}

export function createDeploymentIssueSummary(
  errors: DeploymentRefreshError[],
  providerServiceCounts: Partial<Record<ProjectService['provider'], number>> = {}
): DeploymentIssueSummary {
  if (errors.length === 0) {
    return {
      issueCount: 0,
      level: 'info',
      title: '',
      message: '',
      detail: ''
    }
  }

  const detail = summarizeDeploymentRefreshErrors(errors, providerServiceCounts)
  const hasRateLimit = errors.some((error) => isDeploymentRateLimitMessage(error.message))
  const nonRateLimitErrors = errors.filter((error) => !isDeploymentRateLimitMessage(error.message))
  const providersWithAuthErrors = new Set(
    nonRateLimitErrors.filter((error) => isAuthorizationErrorMessage(error.message)).map((error) => error.provider)
  )

  if (hasRateLimit && nonRateLimitErrors.length === 0) {
    return {
      issueCount: errors.length,
      level: 'warning',
      title: '部分部署暂不可用',
      message: detail,
      detail
    }
  }

  if (providersWithAuthErrors.size === 1 && nonRateLimitErrors.length === errors.length) {
    const provider = [...providersWithAuthErrors][0]
    const affectedServices = providerServiceCounts[provider] ?? errors.length

    return {
      issueCount: errors.length,
      level: 'error',
      title: '部分部署暂不可用',
      message: `${getProviderLabel(provider)} 部署读取权限异常，影响 ${affectedServices} 个服务；请检查 Token scope 或重新授权。`,
      detail
    }
  }

  return {
    issueCount: errors.length,
    level: hasRateLimit ? 'warning' : 'error',
    title: '部分部署暂不可用',
    message: `${errors.length} 项部署刷新异常，详情请查看系统日志。`,
    detail
  }
}

export function selectDeploymentRefreshServices<T extends DeploymentRefreshService>(
  services: T[],
  cursorByProvider: DeploymentRefreshCursor = {},
  batchSizeByProvider: Partial<Record<ProjectService['provider'], number>> = {}
): { services: T[]; nextCursorByProvider: DeploymentRefreshCursor } {
  const selectedByProvider = new Map<ProjectService['provider'], Set<T>>()
  const nextCursorByProvider: DeploymentRefreshCursor = {}
  const providers: ProjectService['provider'][] = ['vercel', 'railway']

  for (const provider of providers) {
    const providerServices = services.filter((service) => service.provider === provider)

    if (providerServices.length === 0) {
      continue
    }

    const rawBatchSize = batchSizeByProvider[provider]
    const batchSize = Number.isFinite(rawBatchSize) && rawBatchSize && rawBatchSize > 0 ? Math.floor(rawBatchSize) : providerServices.length

    if (batchSize >= providerServices.length) {
      selectedByProvider.set(provider, new Set(providerServices))
      nextCursorByProvider[provider] = 0
      continue
    }

    const startIndex = Math.max(0, Math.floor(cursorByProvider[provider] ?? 0)) % providerServices.length
    const providerSelection = Array.from({ length: batchSize }, (_, index) => providerServices[(startIndex + index) % providerServices.length])

    selectedByProvider.set(provider, new Set(providerSelection))
    nextCursorByProvider[provider] = (startIndex + batchSize) % providerServices.length
  }

  return {
    services: services.filter((service) => selectedByProvider.get(service.provider)?.has(service)),
    nextCursorByProvider
  }
}
