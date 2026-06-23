import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createServiceDetailSummary, getMonitorableServiceDomains, getProjectServiceStats } from './service-monitor-view.js'
import type { ProjectService } from './data.js'

const service: ProjectService = {
  id: 'service-1',
  projectId: '',
  provider: 'vercel',
  connectionId: 'connection-1',
  repositoryId: '',
  name: 'uka-website',
  externalProjectId: 'prj_1',
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
})
