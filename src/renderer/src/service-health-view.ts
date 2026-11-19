import type { ProjectService } from './data'
import { getMonitorableServiceDomains } from './service-monitor-view.js'

export function getHealthCheckSummary(services: ProjectService[], environmentName?: string) {
  const records = services.flatMap(service => getMonitorableServiceDomains(service)
    .filter(domain => !environmentName || domain.environmentName === environmentName)
    .map(domain => ({ domain, enabled: service.enabled })))
  const checkable = records.filter(record => record.enabled)
  const timestamps = records.map(record => record.domain.lastCheckedAt).filter(value => Number.isFinite(Date.parse(value)))
  return {
    checkableCount: checkable.length,
    checkedCount: checkable.filter(record => Number.isFinite(Date.parse(record.domain.lastCheckedAt))).length,
    lastCheckedAt: timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] || ''
  }
}
