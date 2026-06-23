import type { ProjectService } from './data'

export type ProjectServiceStats = {
  serviceCount: number
  domainCount: number
  online: number
  degraded: number
  offline: number
  unknown: number
}

export type ServiceDetailSummary = Omit<ProjectServiceStats, 'serviceCount' | 'domainCount'> & {
  environmentCount: number
  monitorableDomainCount: number
  generatedDomainCount: number
}

export function getMonitorableServiceDomains(service: ProjectService): ProjectService['domains'] {
  return service.domains.filter((domain) => domain.enabled && (domain.kind === 'custom' || domain.kind === 'manual'))
}

export function getProjectServiceStats(services: ProjectService[]): ProjectServiceStats {
  return services.reduce(
    (stats, service) => {
      const monitorableDomains = getMonitorableServiceDomains(service)

      stats.serviceCount += 1
      stats.domainCount += monitorableDomains.length

      for (const domain of monitorableDomains) {
        stats[domain.lastStatus] += 1
      }

      return stats
    },
    { serviceCount: 0, domainCount: 0, online: 0, degraded: 0, offline: 0, unknown: 0 }
  )
}

export function createServiceDetailSummary(service: ProjectService): ServiceDetailSummary {
  const stats = getProjectServiceStats([service])

  return {
    environmentCount: service.environments.length,
    monitorableDomainCount: stats.domainCount,
    generatedDomainCount: service.domains.filter((domain) => domain.kind === 'generated').length,
    online: stats.online,
    degraded: stats.degraded,
    offline: stats.offline,
    unknown: stats.unknown
  }
}
