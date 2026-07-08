import type { ProjectService, ServiceProviderType } from './data'

export const serviceProviderOrder: ServiceProviderType[] = ['vercel', 'railway']

export const serviceProviderLabels: Record<ServiceProviderType, string> = {
  vercel: 'Vercel',
  railway: 'Railway'
}

export type ServiceProviderSection<T extends { provider: ServiceProviderType }> = {
  provider: ServiceProviderType
  label: string
  items: T[]
}

export type ServiceProviderOverviewEntry = {
  provider: ServiceProviderType
  label: string
  connectionCount: number
  serviceCount: number
}

export type RailwayEnvironmentServiceGroup = {
  id: string
  name: string
  services: ProjectService[]
}

export type RailwayProjectServiceGroup = {
  id: string
  name: string
  alias: string
  externalProjectId: string
  externalProjectName: string
  serviceCount: number
  environments: RailwayEnvironmentServiceGroup[]
}

export type ServiceProviderCapabilities = {
  canListDeployments: boolean
  canRunDeploymentActions: boolean
  canReadEnvVars: boolean
  canManageEnvVars: boolean
  canReadRuntimeLogs: boolean
  canManageDomains: boolean
}

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

export type ServiceLogMode = 'build' | 'runtime'

export type ServiceEnvironmentLogAction = {
  mode: ServiceLogMode
  label: string
  compactLabel: string
  disabled: boolean
}

const RAILWAY_ENVIRONMENT_SERVICE_TABLE_SCROLL_X = 920

export function getServiceProviderLabel(provider: ServiceProviderType): string {
  return serviceProviderLabels[provider]
}

export function getServiceProviderCapabilities(provider: ServiceProviderType): ServiceProviderCapabilities {
  return {
    canListDeployments: true,
    canRunDeploymentActions: provider === 'vercel' || provider === 'railway',
    canReadEnvVars: true,
    canManageEnvVars: provider === 'vercel',
    canReadRuntimeLogs: true,
    canManageDomains: provider === 'vercel'
  }
}

export function createServiceProviderSections<T extends { provider: ServiceProviderType }>(items: T[]): ServiceProviderSection<T>[] {
  return serviceProviderOrder.map((provider) => ({
    provider,
    label: getServiceProviderLabel(provider),
    items: items.filter((item) => item.provider === provider)
  }))
}

export function createServiceProviderOverview(
  connections: Array<{ provider: ServiceProviderType }>,
  services: Array<{ provider: ServiceProviderType }>
): ServiceProviderOverviewEntry[] {
  const connectionSections = createServiceProviderSections(connections)
  const serviceSections = createServiceProviderSections(services)

  return serviceProviderOrder.map((provider, index) => ({
    provider,
    label: getServiceProviderLabel(provider),
    connectionCount: connectionSections[index].items.length,
    serviceCount: serviceSections[index].items.length
  }))
}

function compareByName(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

export function createRailwayProjectEnvironmentGroups(services: ProjectService[]): RailwayProjectServiceGroup[] {
  const projectGroups = new Map<string, RailwayProjectServiceGroup>()

  for (const service of services.filter((item) => item.provider === 'railway')) {
    const projectId = service.externalProjectId || service.externalProjectName || 'unknown-project'
    const projectName = service.externalProjectAlias || service.externalProjectName || service.externalProjectId || '未同步项目'
    let projectGroup = projectGroups.get(projectId)

    if (!projectGroup) {
      projectGroup = {
        id: projectId,
        name: projectName,
        alias: service.externalProjectAlias,
        externalProjectId: service.externalProjectId,
        externalProjectName: service.externalProjectName,
        serviceCount: 0,
        environments: []
      }
      projectGroups.set(projectId, projectGroup)
    }

    projectGroup.serviceCount += 1

    const environments =
      service.environments.length > 0
        ? service.environments
        : [{ id: `${service.id}:unsynced`, name: '未同步', externalEnvironmentId: '', serviceId: service.id }]

    for (const environment of environments) {
      const environmentName = environment.name || environment.externalEnvironmentId || '未同步'
      const environmentId = environment.externalEnvironmentId || environment.id || environmentName
      let environmentGroup = projectGroup.environments.find((group) => group.id === environmentId || group.name === environmentName)

      if (!environmentGroup) {
        environmentGroup = {
          id: environmentId,
          name: environmentName,
          services: []
        }
        projectGroup.environments.push(environmentGroup)
      }

      if (!environmentGroup.services.some((item) => item.id === service.id)) {
        environmentGroup.services.push(service)
      }
    }
  }

  return Array.from(projectGroups.values()).map((projectGroup) => ({
    ...projectGroup,
    environments: projectGroup.environments
      .map((environmentGroup) => ({
        ...environmentGroup,
        services: [...environmentGroup.services].sort((left, right) => compareByName(left.name, right.name))
      }))
      .sort((left, right) => compareByName(left.name, right.name))
  }))
}

export function getServiceEnvironmentLogActions(service: ProjectService, environmentName: string): ServiceEnvironmentLogAction[] {
  const environment = service.environments.find((item) => item.name === environmentName)
  const hasLatestDeployment = Boolean(environment?.latestDeploymentId)
  const hasRuntimeScope = service.provider === 'railway' ? Boolean(environment?.externalEnvironmentId) : hasLatestDeployment
  const capabilities = getServiceProviderCapabilities(service.provider)

  return [
    { mode: 'build', label: '构建日志', compactLabel: '构建', disabled: !hasLatestDeployment },
    { mode: 'runtime', label: '运行日志', compactLabel: '运行', disabled: !capabilities.canReadRuntimeLogs || !hasRuntimeScope }
  ]
}

export function getRailwayEnvironmentServiceTableScrollX(): number {
  return RAILWAY_ENVIRONMENT_SERVICE_TABLE_SCROLL_X
}

export function getMonitorableServiceDomains(service: ProjectService): ProjectService['domains'] {
  return service.domains.filter((domain) => domain.enabled && (domain.kind === 'custom' || domain.kind === 'manual' || (service.provider === 'railway' && domain.kind === 'generated')))
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
