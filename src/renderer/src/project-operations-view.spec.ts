import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deploymentLabel, domainHealth, operationsEnvironmentOrder, operationsUrl } from './project-operations-view.js'
import { isOperationsStale } from '../../shared/project-operations.js'
import type { ProjectServiceDomain } from './data.js'

describe('operations state presentation', () => {
  it('puts production before preview and custom environments without mutating source arrays', () => {
    const input = [{ name: 'staging' }, { name: 'preview' }, { name: 'production' }]
    assert.deepEqual(operationsEnvironmentOrder(input).map(item => item.name), ['production', 'preview', 'staging'])
    assert.equal(input[0].name, 'staging')
  })
  it('separates Ready from online health and treats missing, invalid and stale checks as unknown', () => {
    const now = Date.now()
    const domain = { enabled: true, lastStatus: 'online', lastError: '', lastCheckedAt: new Date(now).toISOString() } as ProjectServiceDomain
    assert.equal(deploymentLabel('READY').label, '部署就绪')
    assert.equal(domainHealth(domain, now).label, '在线')
    assert.equal(domainHealth(domain, now + 600_001).label, '检查已过期')
    assert.equal(domainHealth({ ...domain, lastCheckedAt: '' }, now).label, '尚未检查')
    assert.equal(domainHealth({ ...domain, lastCheckedAt: 'invalid' }, now).color, 'default')
    assert.equal(domainHealth({ ...domain, lastStatus: 'offline' }, now).label, '离线')
    assert.equal(domainHealth({ ...domain, enabled: false }, now).label, '未启用检查')
    assert.ok(isOperationsStale('invalid', now)); assert.ok(isOperationsStale('', now))
    assert.equal(isOperationsStale(new Date(now - 299_000).toISOString(), now), false)
  })
  it('opens only ordinary HTTP addresses without embedded credentials', () => {
    assert.equal(operationsUrl('web.vercel.app'), 'https://web.vercel.app/')
    for (const value of ['javascript:alert(1)', 'file:///tmp/a', 'https://token@example.com', 'https://[', '']) assert.equal(operationsUrl(value), undefined)
  })
})
