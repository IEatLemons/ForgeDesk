import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createDeploymentFilterOptions,
  createDeploymentRows,
  createDeploymentStatusSummary,
  createDeploymentIssueSummary,
  createSystemLogEntry,
  createSystemLogSummary,
  canRunServiceDeploymentAction,
  deploymentAutoRefreshIntervalMs,
  filterDeploymentRows,
  getDeploymentRateLimitRetryMs,
  getNextDeploymentVisibleCount,
  getDeploymentProjectTagStyle,
  getVisibleDeploymentRows,
  getDeploymentStatusMeta,
  selectDeploymentRefreshServices,
  summarizeDeploymentRefreshErrors
} from './service-deployments-view.js'
import type { ProjectService, ServiceDeploymentSummary } from './data.js'

const baseService: ProjectService = {
  id: 'service-web',
  projectId: 'project-1',
  provider: 'vercel',
  connectionId: 'connection-1',
  repositoryId: 'repo-web',
  name: 'merchant-web',
  externalProjectId: 'prj_web',
  externalProjectName: 'merchant-web',
  externalProjectAlias: '',
  externalServiceId: '',
  defaultEnvironment: 'production',
  healthPath: '/',
  enabled: true,
  lastSyncedAt: '2026-06-29T00:00:00.000Z',
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  environments: [],
  domains: []
}

function deployment(input: Partial<ServiceDeploymentSummary> & Pick<ServiceDeploymentSummary, 'id' | 'state' | 'createdAt'>): ServiceDeploymentSummary {
  return {
    id: input.id,
    url: input.url ?? `${input.id}.vercel.app`,
    target: input.target ?? 'production',
    state: input.state,
    createdAt: input.createdAt,
    readyAt: input.readyAt ?? '',
    creator: input.creator ?? '',
    meta: input.meta ?? {},
    commitSha: input.commitSha ?? '',
    environmentId: input.environmentId,
    projectId: input.projectId,
    serviceId: input.serviceId,
    canRedeploy: input.canRedeploy,
    canRollback: input.canRollback,
    deploymentStopped: input.deploymentStopped
  }
}

describe('service deployments view model', () => {
  it('creates Vercel-style deployment rows sorted by newest deployment', () => {
    const rows = createDeploymentRows(
      [
        baseService,
        {
          ...baseService,
          id: 'service-admin',
          repositoryId: 'repo-admin',
          name: 'admin-web',
          externalProjectName: 'admin-web',
          defaultEnvironment: 'preview'
        }
      ],
      {
        'service-web': [
          deployment({
            id: 'dep_old',
            state: 'READY',
            target: 'production',
            createdAt: '2026-06-29T01:00:00.000Z',
            readyAt: '2026-06-29T01:00:05.000Z',
            commitSha: 'abcdef1234567890',
            creator: 'stone',
            meta: {
              githubCommitMessage: 'fix: align merchant validation',
              githubCommitRef: 'main',
              githubCommitRepo: 'merchant-web',
              githubCommitAuthorName: 'Stone'
            }
          })
        ],
        'service-admin': [
          deployment({
            id: 'dep_new',
            state: 'BUILDING',
            target: 'preview',
            createdAt: '2026-06-29T02:00:00.000Z',
            commitSha: '1234567890abcdef',
            meta: {
              githubCommitMessage: 'feat: admin metrics panel',
              githubCommitRef: 'develop',
              githubCommitRepo: 'admin-web'
            }
          })
        ]
      }
    )

    assert.deepEqual(
      rows.map((row) => ({
        key: row.key,
        serviceName: row.serviceName,
        commitMessage: row.commitMessage,
        repositoryName: row.repositoryName,
        branchName: row.branchName,
        shortCommit: row.shortCommit,
        readyDurationLabel: row.readyDurationLabel,
        statusMeta: row.statusMeta
      })),
      [
        {
          key: 'service-admin:dep_new',
          serviceName: 'admin-web',
          commitMessage: 'feat: admin metrics panel',
          repositoryName: 'admin-web',
          branchName: 'develop',
          shortCommit: '1234567',
          readyDurationLabel: '',
          statusMeta: { label: 'Building', color: 'blue', badgeStatus: 'processing' }
        },
        {
          key: 'service-web:dep_old',
          serviceName: 'merchant-web',
          commitMessage: 'fix: align merchant validation',
          repositoryName: 'merchant-web',
          branchName: 'main',
          shortCommit: 'abcdef1',
          readyDurationLabel: '5s',
          statusMeta: { label: 'Ready', color: 'green', badgeStatus: 'success' }
        }
      ]
    )
  })

  it('enables Railway deployment actions from deployment capabilities and state', () => {
    const readyDeployment = deployment({
      id: 'railway_ready',
      state: 'SUCCESS',
      createdAt: '2026-06-29T00:00:00.000Z',
      canRedeploy: true,
      canRollback: true,
      deploymentStopped: false
    })
    const stoppedDeployment = deployment({
      id: 'railway_stopped',
      state: 'SUCCESS',
      createdAt: '2026-06-29T00:01:00.000Z',
      canRollback: false,
      deploymentStopped: true
    })
    const buildingDeployment = deployment({
      id: 'railway_building',
      state: 'BUILDING',
      createdAt: '2026-06-29T00:02:00.000Z'
    })

    assert.equal(canRunServiceDeploymentAction('railway', readyDeployment, 'redeploy'), true)
    assert.equal(canRunServiceDeploymentAction('railway', readyDeployment, 'restart'), true)
    assert.equal(canRunServiceDeploymentAction('railway', readyDeployment, 'stop'), true)
    assert.equal(canRunServiceDeploymentAction('railway', readyDeployment, 'rollback'), true)
    assert.equal(canRunServiceDeploymentAction('railway', readyDeployment, 'cancel'), false)
    assert.equal(canRunServiceDeploymentAction('railway', stoppedDeployment, 'stop'), false)
    assert.equal(canRunServiceDeploymentAction('railway', stoppedDeployment, 'restart'), false)
    assert.equal(canRunServiceDeploymentAction('railway', stoppedDeployment, 'rollback'), false)
    assert.equal(canRunServiceDeploymentAction('railway', buildingDeployment, 'cancel'), true)
    assert.equal(canRunServiceDeploymentAction('railway', buildingDeployment, 'promote'), false)
  })

  it('filters deployment rows by environment, repository, branch, author, status, query and date', () => {
    const rows = createDeploymentRows([baseService], {
      'service-web': [
        deployment({
          id: 'dep_prod',
          state: 'READY',
          target: 'production',
          createdAt: '2026-06-29T01:00:00.000Z',
          creator: 'stone',
          meta: {
            githubCommitMessage: 'fix: production checkout',
            githubCommitRef: 'main',
            githubCommitRepo: 'merchant-web',
            githubCommitAuthorName: 'Stone'
          }
        }),
        deployment({
          id: 'dep_preview',
          state: 'ERROR',
          target: 'preview',
          createdAt: '2026-06-28T01:00:00.000Z',
          creator: 'alex',
          meta: {
            githubCommitMessage: 'feat: preview search',
            githubCommitRef: 'develop',
            githubCommitRepo: 'merchant-web',
            githubCommitAuthorName: 'Alex'
          }
        })
      ]
    })

    const filtered = filterDeploymentRows(rows, {
      environments: ['production'],
      repositories: ['merchant-web'],
      branches: ['main'],
      authors: ['Stone'],
      statuses: ['READY'],
      query: 'checkout',
      dateRange: ['2026-06-29T00:00:00.000Z', '2026-06-29T23:59:59.999Z']
    })

    assert.deepEqual(filtered.map((row) => row.deploymentId), ['dep_prod'])
  })

  it('creates stable filter options and status summaries', () => {
    const rows = createDeploymentRows([baseService], {
      'service-web': [
        deployment({
          id: 'dep_ready',
          state: 'READY',
          target: 'production',
          createdAt: '2026-06-29T01:00:00.000Z',
          creator: 'stone',
          meta: { githubCommitRef: 'main', githubCommitRepo: 'merchant-web', githubCommitAuthorName: 'Stone' }
        }),
        deployment({
          id: 'dep_error',
          state: 'ERROR',
          target: 'preview',
          createdAt: '2026-06-29T02:00:00.000Z',
          creator: 'alex',
          meta: { githubCommitRef: 'develop', githubCommitRepo: 'admin-web', githubCommitAuthorName: 'Alex' }
        })
      ]
    })

    assert.deepEqual(createDeploymentFilterOptions(rows), {
      authors: ['Alex', 'Stone'],
      environments: ['preview', 'production'],
      repositories: ['admin-web', 'merchant-web'],
      branches: ['develop', 'main'],
      statuses: ['ERROR', 'READY']
    })
    assert.deepEqual(createDeploymentStatusSummary(rows), {
      total: 2,
      ready: 1,
      building: 0,
      error: 1,
      queued: 0,
      canceled: 0,
      other: 0
    })
    assert.deepEqual(getDeploymentStatusMeta('QUEUED'), { label: 'Queued', color: 'gold', badgeStatus: 'warning' })
  })

  it('creates stable project tag colors from project names', () => {
    const unipieStyle = getDeploymentProjectTagStyle('UniPIE')
    const unipieStyleAgain = getDeploymentProjectTagStyle('UniPIE')
    const ukaStyle = getDeploymentProjectTagStyle('uka')

    assert.deepEqual(unipieStyleAgain, unipieStyle)
    assert.notDeepEqual(ukaStyle, unipieStyle)
    assert.ok(unipieStyle.color.startsWith('#'))
    assert.ok(unipieStyle.backgroundColor.startsWith('#'))
    assert.ok(unipieStyle.borderColor.startsWith('#'))
  })

  it('limits deployment rows to an expandable visible batch', () => {
    const rows = createDeploymentRows([baseService], {
      'service-web': [
        deployment({ id: 'dep_3', state: 'READY', createdAt: '2026-06-29T03:00:00.000Z' }),
        deployment({ id: 'dep_2', state: 'READY', createdAt: '2026-06-29T02:00:00.000Z' }),
        deployment({ id: 'dep_1', state: 'READY', createdAt: '2026-06-29T01:00:00.000Z' })
      ]
    })

    assert.deepEqual(
      getVisibleDeploymentRows(rows, 2).map((row) => row.deploymentId),
      ['dep_3', 'dep_2']
    )
    assert.equal(getNextDeploymentVisibleCount(60, 419), 120)
    assert.equal(getNextDeploymentVisibleCount(400, 419), 419)
    assert.equal(getNextDeploymentVisibleCount(0, 419), 60)
  })

  it('summarizes deployment rate limit errors and retry delays', () => {
    const retryMessage = '读取 Railway 部署失败：429 Too Many Requests Rate limit exceeded, please try again in 1394.866 seconds.'

    assert.equal(getDeploymentRateLimitRetryMs(retryMessage), 1_394_866)
    assert.equal(
      summarizeDeploymentRefreshErrors(
        [
          { provider: 'railway', serviceName: 'Redis', message: retryMessage },
          { provider: 'railway', serviceName: 'Postgres', message: retryMessage },
          { provider: 'vercel', serviceName: 'web', message: 'Vercel token expired' }
        ],
        { railway: 18, vercel: 1 }
      ),
      'Railway 部署读取触发平台限流，已使用本地缓存并暂停刷新，约 24 分钟后再试。（影响 18 个服务）\nweb: Vercel token expired'
    )
  })

  it('groups repeated deployment authorization errors into a compact issue summary', () => {
    const errors = [
      {
        provider: 'vercel' as const,
        serviceName: 'konwkit-demo',
        message:
          '读取 Vercel 部署历史失败：403 Forbidden {"error":{"code":"forbidden","message":"Not authorized: Trying to access resource under scope \\"alfajayucans-projects\\"."}}'
      },
      {
        provider: 'vercel' as const,
        serviceName: 'uni-pie-website',
        message:
          '读取 Vercel 部署历史失败：403 Forbidden {"error":{"code":"forbidden","message":"Not authorized: Trying to access resource under scope \\"alfajayucans-projects\\"."}}'
      },
      {
        provider: 'vercel' as const,
        serviceName: 'uni-pie-admin',
        message:
          '读取 Vercel 部署历史失败：403 Forbidden {"error":{"code":"forbidden","message":"Not authorized: Trying to access resource under scope \\"alfajayucans-projects\\"."}}'
      }
    ]

    assert.deepEqual(createDeploymentIssueSummary(errors, { vercel: 7 }), {
      issueCount: 3,
      level: 'error',
      title: '部分部署暂不可用',
      message: 'Vercel 部署读取权限异常，影响 7 个服务；请检查 Token scope 或重新授权。',
      detail: summarizeDeploymentRefreshErrors(errors, { vercel: 7 })
    })
  })

  it('keeps rate-limit deployment issues compact while preserving retry details', () => {
    const retryMessage = '读取 Railway 部署失败：429 Too Many Requests Rate limit exceeded, please try again in 1394.866 seconds.'
    const summary = createDeploymentIssueSummary(
      [
        { provider: 'railway', serviceName: 'Redis', message: retryMessage },
        { provider: 'railway', serviceName: 'Postgres', message: retryMessage }
      ],
      { railway: 18 }
    )

    assert.equal(summary.issueCount, 2)
    assert.equal(summary.level, 'warning')
    assert.equal(summary.title, '部分部署暂不可用')
    assert.equal(summary.message, 'Railway 部署读取触发平台限流，已使用本地缓存并暂停刷新，约 24 分钟后再试。（影响 18 个服务）')
    assert.equal(summary.detail, summary.message)
  })

  it('creates session system log entries and status summaries', () => {
    const first = createSystemLogEntry(
      {
        level: 'info',
        source: '服务中心',
        title: '开始刷新部署',
        message: '准备刷新 3 个服务'
      },
      { id: 'log-1', time: '2026-07-05T10:00:00.000Z' }
    )
    const second = createSystemLogEntry(
      {
        level: 'error',
        source: '服务中心',
        title: '部分部署暂不可用',
        message: 'Vercel 部署读取权限异常，影响 7 个服务'
      },
      { id: 'log-2', time: '2026-07-05T10:00:10.000Z' }
    )

    assert.deepEqual(first, {
      id: 'log-1',
      time: '2026-07-05T10:00:00.000Z',
      level: 'info',
      source: '服务中心',
      title: '开始刷新部署',
      message: '准备刷新 3 个服务'
    })
    assert.deepEqual(createSystemLogSummary([second, first]), {
      total: 2,
      success: 0,
      info: 1,
      warning: 0,
      error: 1,
      issueCount: 1,
      latest: second
    })
    assert.deepEqual(createSystemLogSummary([]), {
      total: 0,
      success: 0,
      info: 0,
      warning: 0,
      error: 0,
      issueCount: 0,
      latest: null
    })
  })

  it('selects deployment refresh services in provider batches', () => {
    const railwayServices = Array.from({ length: 5 }, (_, index) => ({
      id: `railway-${index + 1}`,
      provider: 'railway' as const
    }))
    const services = [{ id: 'vercel-1', provider: 'vercel' as const }, ...railwayServices]

    const plan = selectDeploymentRefreshServices(services, { railway: 1 }, { railway: 2 })

    assert.deepEqual(
      plan.services.map((service) => service.id),
      ['vercel-1', 'railway-2', 'railway-3']
    )
    assert.equal(plan.nextCursorByProvider.railway, 3)
  })

  it('keeps automatic deployment refreshes conservative for provider rate limits', () => {
    assert.equal(deploymentAutoRefreshIntervalMs, 300_000)
  })
})
