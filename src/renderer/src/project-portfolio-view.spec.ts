import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assessProject, portfolioMatches } from './project-portfolio-view.js'
import { buildProjectDirectoryRows } from './project-directory-model.js'
import { directoryTaskSummary, type ProjectDirectorySummary } from '../../shared/project-directory.js'
import { emptyServiceOperations } from '../../shared/project-operations.js'
import type { Project, ProjectService, ServiceDeploymentSummary } from './data'

const now = Date.parse('2026-11-06T10:00:00Z'), at = new Date(now).toISOString()
const row = buildProjectDirectoryRows([{ id: 'a', name: 'a', description: '', workspacePath: '/tmp/a', isFavorite: false } as Project], [])[0]
const deployment = (id: string, state = 'READY', target = 'production', createdAt = at) => ({ id, state, target, createdAt } as ServiceDeploymentSummary)
function fixture(): ProjectDirectorySummary {
  const state = emptyServiceOperations()
  for (const source of Object.values(state.sources)) source.updatedAt = at
  state.production = deployment('current')
  const service = { id: 's', name: '网站', provider: 'vercel', enabled: true, environments: [{ name: 'production' }], domains: [] } as unknown as ProjectService
  return { projectId: 'a', tasks: directoryTaskSummary([], true, at, 'Asia/Shanghai'), operations: { projectId: 'a', services: [service], deployments: { s: [state.production] }, states: { s: state } }, operationsError: '', servers: [], serversError: '' }
}

describe('owner project portfolio decisions', () => {
  it('keeps pending reads and unconfigured task tracking out of the healthy bucket', () => {
    assert.equal(assessProject(row, undefined, '', now).label, '信息待完善')
    const summary = fixture(); summary.tasks = directoryTaskSummary([], false, at, 'Asia/Shanghai')
    const result = assessProject(row, summary, '', now)
    assert.equal(result.attention, false); assert.equal(result.incomplete, true)
    assert.equal(result.concerns[0].route.scope, 'global')
  })
  it('does not require an online binding for a local development project', () => {
    const summary = fixture(); summary.operations!.services = []
    const result = assessProject(row, summary, '', now)
    assert.equal(result.incomplete, false); assert.equal(result.label, '暂无待处理项')
  })
  it('supports overlapping task attention and review filters without summing duplicate tasks', () => {
    const summary = fixture(); Object.assign(summary.tasks.counts!, { urgent: 3, overdue: 2, blocked: 1, awaitingParentCompletion: 1 })
    const result = assessProject(row, summary, '', now)
    assert.equal(result.rank, 3); assert.equal(portfolioMatches(result, 'attention'), true); assert.equal(portfolioMatches(result, 'review'), true)
    assert.ok(result.concerns.some(item => item.route.taskSummaryFilter === 'blocked'))
    assert.ok(result.concerns.some(item => item.route.taskSummaryFilter === 'awaitingParentCompletion'))
  })
  it('retains confirmed production while flagging only the latest failed release per environment', () => {
    const summary = fixture()
    summary.operations!.deployments.s = [deployment('old-failure', 'ERROR', 'production', '2026-10-01T00:00:00Z'), deployment('new-success')]
    assert.equal(assessProject(row, summary, '', now).attention, false)
    summary.operations!.deployments.s.push(deployment('new-failure', 'ERROR', 'preview', '2026-11-06T10:01:00Z'))
    const result = assessProject(row, summary, '', now)
    assert.equal(result.attention, true); assert.equal(summary.operations!.states.s.production?.id, 'current')
    assert.ok(result.concerns.some(item => item.route.scope === 'project' && item.route.serviceId === 's' && item.route.environmentName === 'preview'))
  })
  it('prioritizes live incidents above task reminders and exposes stopped production', () => {
    const summary = fixture(); summary.tasks.counts!.urgent = 1
    summary.operations!.states.s.production = deployment('stopped', 'STOPPED')
    const result = assessProject(row, summary, '', now)
    assert.equal(result.attention, true); assert.equal(result.priority, 0)
    assert.ok(result.concerns.some(item => item.label.includes('生产部署已停止')))
  })
  it('treats stale failed deployment data as uncertainty, not a fresh incident', () => {
    const summary = fixture(); const state = summary.operations!.states.s
    state.production = deployment('failed', 'ERROR'); state.sources.production.updatedAt = '2026-01-01T00:00:00Z'
    summary.operations!.deployments.s = [deployment('failed-preview', 'ERROR', 'preview')]; state.sources.deployments.updatedAt = ''
    const result = assessProject(row, summary, '', now)
    assert.equal(result.attention, false); assert.equal(result.incomplete, true)
  })
  it('separates current offline domains from expired domain checks', () => {
    const summary = fixture(); summary.operations!.services[0].domains = [{ id: 'd', domain: 'example.test', url: 'https://example.test', enabled: true, kind: 'manual', environmentName: 'production', lastStatus: 'offline', lastCheckedAt: at, lastError: '' }] as ProjectService['domains']
    assert.equal(assessProject(row, summary, '', now).attention, true)
    summary.operations!.services[0].domains[0].lastCheckedAt = '2026-01-01T00:00:00Z'
    const result = assessProject(row, summary, '', now)
    assert.equal(result.attention, false); assert.equal(result.incomplete, true)
  })
  it('marks authentication failures as missing evidence and ignores stopped integrations', () => {
    const summary = fixture(); summary.operations!.states.s.sources.domains.error = '认证失败'
    assert.equal(assessProject(row, summary, '', now).incomplete, true)
    summary.operations!.services[0].enabled = false
    assert.equal(assessProject(row, summary, '', now).incomplete, false)
  })
  it('separates stopped and expired servers, preserving the destination project', () => {
    const summary = fixture(); summary.servers = [{ targetId: 'host', name: '服务器', state: 'stopped', checkedAt: at, stale: false, error: '' }] as ProjectDirectorySummary['servers']
    assert.equal(assessProject(row, summary, '', now).attention, true)
    summary.servers[0].stale = true
    const result = assessProject(row, summary, '', now)
    assert.equal(result.attention, false); assert.equal(result.incomplete, true)
    assert.ok(result.concerns.every(item => item.route.scope === 'project' && item.route.projectId === 'a'))
  })
})
