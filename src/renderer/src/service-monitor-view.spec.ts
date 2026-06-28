import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createServiceDetailSummary,
  createServiceProviderOverview,
  createServiceProviderSections,
  createRailwayProjectEnvironmentGroups,
  getServiceEnvironmentLogActions,
  getRailwayEnvironmentServiceTableScrollX,
  getMonitorableServiceDomains,
  getServiceProviderCapabilities,
  getProjectServiceStats
} from './service-monitor-view.js'
import type { ProjectService, ServiceConnection } from './data.js'

const service: ProjectService = {
  id: 'service-1',
  projectId: '',
  provider: 'vercel',
  connectionId: 'connection-1',
  repositoryId: '',
  name: 'uka-website',
  externalProjectId: 'prj_1',
  externalProjectName: '',
  externalProjectAlias: '',
  externalServiceId: '',
  defaultEnvironment: 'production',
  healthPath: '/',
  enabled: true,
  lastSyncedAt: '2026-06-23T00:00:00.000Z',
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
  environments: [
    {
      id: 'env-production',
      projectId: '',
      serviceId: 'service-1',
      provider: 'vercel',
      name: 'production',
      externalEnvironmentId: '',
      status: '',
      deploymentStatus: 'READY',
      latestDeploymentId: 'dep_1',
      latestDeploymentUrl: 'uka.vercel.app',
      latestCommit: 'abcdef123456',
      updatedAt: '2026-06-23T00:00:00.000Z'
    },
    {
      id: 'env-preview',
      projectId: '',
      serviceId: 'service-1',
      provider: 'vercel',
      name: 'preview',
      externalEnvironmentId: '',
      status: '',
      deploymentStatus: '',
      latestDeploymentId: '',
      latestDeploymentUrl: '',
      latestCommit: '',
      updatedAt: '2026-06-23T00:00:00.000Z'
    }
  ],
  domains: [
    {
      id: 'domain-custom',
      projectId: '',
      serviceId: 'service-1',
      environmentId: 'env-production',
      environmentName: 'production',
      domain: 'www.cardpie.pro',
      url: 'https://www.cardpie.pro/',
      kind: 'custom',
      enabled: true,
      lastStatus: 'online',
      lastStatusCode: 200,
      lastResponseMs: 86,
      lastCheckedAt: '2026-06-23T00:00:00.000Z',
      lastError: '',
      createdAt: '2026-06-23T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z'
    },
    {
      id: 'domain-generated',
      projectId: '',
      serviceId: 'service-1',
      environmentId: 'env-production',
      environmentName: 'production',
      domain: 'uka.vercel.app',
      url: 'https://uka.vercel.app/',
      kind: 'generated',
      enabled: true,
      lastStatus: 'unknown',
      lastStatusCode: 0,
      lastResponseMs: 0,
      lastCheckedAt: '',
      lastError: '',
      createdAt: '2026-06-23T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z'
    }
  ]
}

describe('service monitor view helpers', () => {
  it('summarizes only monitorable domains for service detail views', () => {
    assert.deepEqual(getMonitorableServiceDomains(service).map((domain) => domain.domain), ['www.cardpie.pro'])
    assert.deepEqual(getProjectServiceStats([service]), {
      serviceCount: 1,
      domainCount: 1,
      online: 1,
      degraded: 0,
      offline: 0,
      unknown: 0
    })
    assert.deepEqual(createServiceDetailSummary(service), {
      environmentCount: 2,
      monitorableDomainCount: 1,
      generatedDomainCount: 1,
      online: 1,
      degraded: 0,
      offline: 0,
      unknown: 0
    })
  })

  it('treats Railway generated service domains as monitorable', () => {
    const railwayService: ProjectService = {
      ...service,
      provider: 'railway',
      environments: service.environments.map((environment) => ({ ...environment, provider: 'railway' })),
      domains: service.domains.map((domain) => ({ ...domain, kind: 'generated' }))
    }

    assert.deepEqual(getMonitorableServiceDomains(service).map((domain) => domain.domain), ['www.cardpie.pro'])
    assert.deepEqual(getMonitorableServiceDomains(railwayService).map((domain) => domain.domain).sort(), ['uka.vercel.app', 'www.cardpie.pro'])
    assert.equal(getProjectServiceStats([railwayService]).domainCount, 2)
  })

  it('marks Railway service detail controls as readonly', () => {
    assert.deepEqual(getServiceProviderCapabilities('railway'), {
      canListDeployments: true,
      canRunDeploymentActions: false,
      canReadEnvVars: true,
      canManageEnvVars: false,
      canReadRuntimeLogs: true,
      canManageDomains: false
    })
    assert.deepEqual(getServiceProviderCapabilities('vercel'), {
      canListDeployments: true,
      canRunDeploymentActions: true,
      canReadEnvVars: true,
      canManageEnvVars: true,
      canReadRuntimeLogs: true,
      canManageDomains: true
    })
  })

  it('builds Railway environment log actions from the synced environment scope', () => {
    const railwayService: ProjectService = {
      ...service,
      provider: 'railway',
      environments: [
        {
          ...service.environments[0],
          provider: 'railway',
          name: 'production',
          externalEnvironmentId: 'env_railway_1',
          latestDeploymentId: 'dep_railway_1'
        }
      ]
    }
    const unsyncedRailwayService: ProjectService = {
      ...railwayService,
      environments: [
        {
          ...railwayService.environments[0],
          externalEnvironmentId: '',
          latestDeploymentId: ''
        }
      ]
    }

    assert.deepEqual(getServiceEnvironmentLogActions(railwayService, 'production'), [
      { mode: 'build', label: '构建日志', compactLabel: '构建', disabled: false },
      { mode: 'runtime', label: '运行日志', compactLabel: '运行', disabled: false }
    ])
    assert.deepEqual(getServiceEnvironmentLogActions(unsyncedRailwayService, 'production'), [
      { mode: 'build', label: '构建日志', compactLabel: '构建', disabled: true },
      { mode: 'runtime', label: '运行日志', compactLabel: '运行', disabled: true }
    ])
  })

  it('keeps the Railway environment service table width inside the service center card', () => {
    assert.equal(getRailwayEnvironmentServiceTableScrollX(), 920)
    assert.ok(getRailwayEnvironmentServiceTableScrollX() <= 980)
  })

  it('splits services into stable platform sections', () => {
    const railwayService = { ...service, id: 'service-2', provider: 'railway' as const, name: 'api' }
    const sections = createServiceProviderSections([railwayService, service])

    assert.deepEqual(
      sections.map((section) => ({
        provider: section.provider,
        label: section.label,
        itemNames: section.items.map((item) => item.name)
      })),
      [
        { provider: 'vercel', label: 'Vercel', itemNames: ['uka-website'] },
        { provider: 'railway', label: 'Railway', itemNames: ['api'] }
      ]
    )
  })

  it('groups Railway services by project and environment', () => {
    const apiService: ProjectService = {
      ...service,
      id: 'service-api',
      provider: 'railway',
      name: 'api',
      externalProjectId: 'project-data-centent',
      externalProjectName: 'DataCentent',
      externalProjectAlias: '数据中心',
      environments: [
        { ...service.environments[0], id: 'env-prod-api', serviceId: 'service-api', provider: 'railway', name: 'production' },
        { ...service.environments[1], id: 'env-staging-api', serviceId: 'service-api', provider: 'railway', name: 'staging' }
      ]
    }
    const workerService: ProjectService = {
      ...service,
      id: 'service-worker',
      provider: 'railway',
      name: 'worker',
      externalProjectId: 'project-data-centent',
      externalProjectName: 'DataCentent',
      externalProjectAlias: '数据中心',
      environments: [{ ...service.environments[0], id: 'env-prod-worker', serviceId: 'service-worker', provider: 'railway', name: 'production' }]
    }
    const cardPieService: ProjectService = {
      ...service,
      id: 'service-cardpie',
      provider: 'railway',
      name: 'web',
      externalProjectId: 'project-cardpie',
      externalProjectName: 'CardPIE',
      environments: [{ ...service.environments[0], id: 'env-cardpie-prod', serviceId: 'service-cardpie', provider: 'railway', name: 'production' }]
    }

    const groups = createRailwayProjectEnvironmentGroups([workerService, cardPieService, apiService])

    assert.deepEqual(
      groups.map((project) => ({
        id: project.id,
        name: project.name,
        serviceCount: project.serviceCount,
        environments: project.environments.map((environment) => ({
          name: environment.name,
          serviceNames: environment.services.map((item) => item.name)
        }))
      })),
      [
        {
          id: 'project-data-centent',
          name: '数据中心',
          serviceCount: 2,
          environments: [
            { name: 'production', serviceNames: ['api', 'worker'] },
            { name: 'staging', serviceNames: ['api'] }
          ]
        },
        {
          id: 'project-cardpie',
          name: 'CardPIE',
          serviceCount: 1,
          environments: [{ name: 'production', serviceNames: ['web'] }]
        }
      ]
    )
  })

  it('creates platform entry summaries for the service center landing view', () => {
    const connections: ServiceConnection[] = [
      {
        id: 'connection-railway',
        projectId: '',
        provider: 'railway',
        name: 'Railway',
        token: '',
        tokenConfigured: false,
        teamId: '',
        workspaceId: '',
        railwayTokenType: 'workspace',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'connection-vercel',
        projectId: '',
        provider: 'vercel',
        name: 'Vercel',
        token: '',
        tokenConfigured: true,
        teamId: '',
        workspaceId: '',
        railwayTokenType: 'workspace',
        createdAt: '',
        updatedAt: ''
      }
    ]
    const railwayService = { ...service, id: 'service-2', provider: 'railway' as const, name: 'api' }

    assert.deepEqual(
      createServiceProviderOverview(connections, [service, railwayService]).map((entry) => ({
        provider: entry.provider,
        label: entry.label,
        connectionCount: entry.connectionCount,
        serviceCount: entry.serviceCount
      })),
      [
        { provider: 'vercel', label: 'Vercel', connectionCount: 1, serviceCount: 1 },
        { provider: 'railway', label: 'Railway', connectionCount: 1, serviceCount: 1 }
      ]
    )
  })
})
