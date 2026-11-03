import type { ProjectService, ProjectServiceDomain, ServiceDeploymentSummary } from './data'
import { domainHealthStaleMs, isOperationsStale } from '../../shared/project-operations.js'

export function operationsServiceOrder(services: ProjectService[]): ProjectService[] {
  return [...services].sort((a, b) => Number(b.enabled) - Number(a.enabled) || Number(b.provider === 'vercel') - Number(a.provider === 'vercel') || a.name.localeCompare(b.name))
}
export function operationsEnvironmentOrder<T extends { name: string }>(environments: T[]): T[] {
  const rank = (name: string) => name === 'production' ? 0 : name === 'preview' ? 1 : 2
  return [...environments].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}
export function domainHealth(domain: ProjectServiceDomain, now = Date.now()): { label: string; color: string } {
  if (!domain.enabled) return { label: '未启用检查', color: 'default' }
  if (isOperationsStale(domain.lastCheckedAt, now, domainHealthStaleMs)) return { label: domain.lastCheckedAt ? '检查已过期' : '尚未检查', color: 'default' }
  if (domain.lastError && domain.lastStatus === 'online') return { label: '检查异常', color: 'orange' }
  return ({ online: { label: '在线', color: 'green' }, degraded: { label: '响应异常', color: 'orange' }, offline: { label: '离线', color: 'red' }, unknown: { label: '未知', color: 'default' } })[domain.lastStatus]
}
export function operationsUrl(value: string): string | undefined {
  if (!value.trim()) return undefined
  try { const url = new URL(value.includes('://') ? value : `https://${value}`); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
export function deploymentLabel(state: string): { label: string; color: string } {
  const key = state.toUpperCase()
  if (['READY', 'SUCCESS'].includes(key)) return { label: '部署就绪', color: 'green' }
  if (['BUILDING', 'INITIALIZING', 'DEPLOYING'].includes(key)) return { label: '构建 / 部署中', color: 'blue' }
  if (['QUEUED', 'PENDING'].includes(key)) return { label: '排队中', color: 'gold' }
  if (['ERROR', 'FAILED', 'CRASHED'].includes(key)) return { label: '部署失败', color: 'red' }
  if (['CANCELED', 'CANCELLED', 'REMOVED', 'STOPPED'].includes(key)) return { label: '已取消 / 停止', color: 'default' }
  return { label: state || '尚无部署', color: 'default' }
}
export function latestDeployment(deployments: ServiceDeploymentSummary[], environment?: string): ServiceDeploymentSummary | undefined {
  return deployments.filter(item => !environment || item.target === environment).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
}
