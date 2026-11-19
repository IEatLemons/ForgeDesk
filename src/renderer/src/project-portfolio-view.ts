import type { ProjectDirectorySummary, TaskSummaryFilter } from '../../shared/project-directory'
import { isOperationsStale } from '../../shared/project-operations.js'
import { runtimeStaleAfterMs } from '../../shared/project-runtime.js'
import type { ProjectDirectoryRow } from './project-directory-model'
import { deploymentLabel, domainHealth, latestDeployment, operationsServiceOrder } from './project-operations-view.js'
import { getMonitorableServiceDomains } from './service-monitor-view.js'
import { globalPage, projectPage, type AppRoute } from './workspace-navigation.js'

export type PortfolioFilter = 'all' | 'attention' | 'review' | 'incomplete'
export type PortfolioConcern = { label: string; kind: 'attention' | 'review' | 'incomplete'; priority: number; route: AppRoute }
export type PortfolioAssessment = { concerns: PortfolioConcern[]; attention: boolean; review: boolean; incomplete: boolean; rank: number; priority: number; label: string }

// Portfolio decisions use the latest result per environment, never any old failed
// deployment in history. Missing/stale evidence is separate from a live incident.
export function assessProject(row: ProjectDirectoryRow, summary?: ProjectDirectorySummary, readError = '', now = Date.now()): PortfolioAssessment {
  const concerns: PortfolioConcern[] = []
  const add = (kind: PortfolioConcern['kind'], label: string, route: AppRoute, priority = kind === 'incomplete' ? 40 : kind === 'review' ? 30 : 20) => concerns.push({ kind, label, route, priority })
  const taskRoute = (filter: TaskSummaryFilter): AppRoute => ({ ...projectPage(row.id, 'tasks'), taskSummaryFilter: filter })
  if (readError || summary?.tasks.error) add('incomplete', '任务状态读取失败', projectPage(row.id, 'tasks'))
  else if (summary && !summary.tasks.active) add('incomplete', '任务进度尚未启用', globalPage('settings', 'migration'))
  else if (summary?.tasks.counts) {
    for (const [key, label] of [['blocked', '阻塞'], ['overdue', '逾期'], ['urgent', '紧急']] as const) if (summary.tasks.counts[key]) add('attention', `${summary.tasks.counts[key]} 项${label}`, taskRoute(key))
    if (summary.tasks.counts.review) add('review', `${summary.tasks.counts.review} 项待验收`, taskRoute('review'))
    if (summary.tasks.counts.awaitingParentAcceptance) add('review', `${summary.tasks.counts.awaitingParentAcceptance} 项父任务待验收`, taskRoute('awaitingParentAcceptance'))
  }
  if (row.stats.unavailable) add('incomplete', `${row.stats.unavailable} 个仓库无法读取`, projectPage(row.id, 'repositories'))
  if (readError || summary?.operationsError || summary?.serversError) add('incomplete', '运行摘要读取失败', projectPage(row.id, 'environments'))
  for (const service of operationsServiceOrder(summary?.operations?.services ?? []).filter(service => service.enabled)) {
    const state = summary!.operations!.states[service.id]
    const go = (page: 'environments' | 'deployments' | 'domains', environmentName = 'production'): AppRoute => ({ ...projectPage(row.id, page), serviceId: service.id, environmentName })
    const sourceError = Object.values(state?.sources ?? {}).some(source => source.error)
    if (sourceError) add('incomplete', `同步异常 · ${service.name}`, { ...projectPage(row.id, 'settings-runtime'), serviceId: service.id })
    const production = service.provider === 'vercel' ? state?.production : latestDeployment(summary!.operations!.deployments[service.id] ?? [], 'production')
    const updatedAt = service.provider === 'vercel' ? state?.sources.production.updatedAt : state?.sources.deployments.updatedAt
    if (!production) add('incomplete', `生产版本未确认 · ${service.name}`, go('deployments'))
    else if (isOperationsStale(updatedAt, now)) add('incomplete', `部署数据已过期 · ${service.name}`, go('environments'))
    else if (deploymentLabel(production.state).color === 'red') add('attention', `生产部署失败 · ${service.name}`, go('deployments'), 0)
    else if (['STOPPED', 'REMOVED', 'CANCELED', 'CANCELLED'].includes(production.state.toUpperCase())) add('attention', `生产部署已停止 · ${service.name}`, go('deployments'), 0)
    const deployments = summary!.operations!.deployments[service.id] ?? []
    const environments = new Set(deployments.map(deployment => deployment.target))
    for (const environment of environments) {
      const latest = latestDeployment(deployments, environment)
      if (latest?.id === production?.id || deploymentLabel(latest?.state ?? '').color !== 'red') continue
      if (!isOperationsStale(state?.sources.deployments.updatedAt, now)) add('attention', `${environment || '默认环境'} 最新部署失败 · ${service.name}`, go('deployments', environment), 10)
    }
    const domains = getMonitorableServiceDomains(service).filter(domain => domain.enabled)
    const unhealthy = domains.filter(domain => ['响应异常', '离线', '检查异常'].includes(domainHealth(domain, now).label))
    if (unhealthy.length) add('attention', `${unhealthy.length} 个域名异常 · ${service.name}`, go('domains', unhealthy[0].environmentName || 'production'), 0)
    if (domains.some(domain => !['在线', '响应异常', '离线', '检查异常'].includes(domainHealth(domain, now).label))) add('incomplete', `域名待检查／已过期 · ${service.name}`, go('domains'))
  }
  for (const server of summary?.servers ?? []) {
    const fresh = !server.stale && !server.error && !isOperationsStale(server.checkedAt ?? undefined, now, runtimeStaleAfterMs)
    if (!fresh || server.state === 'unknown') add('incomplete', `${server.name} 运行状态未知`, projectPage(row.id, 'environments'))
    else if (server.state !== 'running') add('attention', `${server.name} ${server.state === 'stopped' ? '已停止' : '健康异常'}`, projectPage(row.id, 'environments'), 0)
  }
  const attention = concerns.some(item => item.kind === 'attention'), review = concerns.some(item => item.kind === 'review'), incomplete = concerns.some(item => item.kind === 'incomplete') || !summary
  const rank = attention ? 3 : review ? 2 : incomplete ? 1 : 0
  return { concerns, attention, review, incomplete, rank, priority: Math.min(...concerns.map(item => item.priority), 50), label: attention ? '需要处理' : review ? '待验收' : incomplete ? '信息待完善' : '暂无待处理项' }
}

export function portfolioMatches(assessment: PortfolioAssessment, filter: PortfolioFilter): boolean {
  return filter === 'all' || assessment[filter]
}
