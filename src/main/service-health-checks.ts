import { checkServiceDomain, isMonitorableServiceDomain, listAllProjectServices, listProjectServices, recordServiceMonitorCheck, type ProjectServiceRecord, type ServiceProviderFetch } from './service-monitoring.js'
import { serviceHealthTimeoutMs, type ServiceHealthCheckScope } from '../shared/service-health.js'

type DatabaseLike = Parameters<typeof listProjectServices>[0]

// Manual checks and background sweeps share each domain's HTTP request and
// history write, including requests from different renderer windows.
export class ServiceHealthChecker {
  private flights = new Map<string, Promise<void>>()
  constructor(private updated: (projectIds: string[]) => void = () => undefined) {}

  async check(db: DatabaseLike, scope: ServiceHealthCheckScope = {}, fetcher: ServiceProviderFetch = fetch): Promise<ProjectServiceRecord[]> {
    const services = scope.projectId ? listProjectServices(db, scope.projectId) : listAllProjectServices(db)
    const selected = services.filter(service => !scope.serviceId || service.id === scope.serviceId)
    if (scope.serviceId && !selected.length) throw new Error('当前范围内未找到服务，请重新打开服务详情')
    if (!scope.projectId && !scope.serviceId && scope.environmentName) throw new Error('请指定要检查的项目或服务')
    const changedServices = new Set<string>()
    for (const service of selected) {
      if (!service.enabled) continue
      for (const domain of service.domains) {
        if (!isMonitorableServiceDomain(domain, service.provider) || scope.environmentName && domain.environmentName !== scope.environmentName) continue
        const key = `${service.id}:${domain.id}:${domain.url}`
        let flight = this.flights.get(key)
        if (!flight) {
          flight = (async () => {
            const result = await checkServiceDomain(domain, fetcher, serviceHealthTimeoutMs)
            recordServiceMonitorCheck(db, { projectId: scope.projectId || '', serviceId: service.id, domainId: domain.id, ...result })
          })().finally(() => this.flights.delete(key))
          this.flights.set(key, flight)
        }
        await flight
        changedServices.add(service.id)
      }
    }
    const projects = new Set<string>()
    for (const serviceId of changedServices) {
      for (const row of db.prepare('SELECT project_id FROM project_service_bindings WHERE service_id = ?').all(serviceId)) {
        projects.add(String((row as { project_id: string }).project_id))
      }
    }
    if (projects.size) this.updated([...projects])
    const current = scope.projectId ? listProjectServices(db, scope.projectId) : listAllProjectServices(db)
    return current.filter(service => !scope.serviceId || service.id === scope.serviceId)
  }
}
