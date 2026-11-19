import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readProjectDirectorySummaries } from './project-directory-summaries.js'
import { directoryTaskSummary } from '../shared/project-directory.js'
import { emptyServiceOperations, type ProjectOperations } from '../shared/project-operations.js'

describe('project directory batch reads', () => {
  it('deduplicates requested projects, ignores deleted ones and isolates sources and projects', () => {
    let taskReads = 0
    const rows = readProjectDirectorySummaries({ projectIds: ['a', 'b', 'a', 'deleted'] }, {
      projectExists: id => id !== 'deleted',
      tasks: ids => { taskReads++; return Object.fromEntries(ids.map(id => [id, directoryTaskSummary([], false, '2026-11-06T00:00:00Z', 'Asia/Shanghai')])) },
      operations: id => { if (id === 'a') throw Error('认证失败'); return { projectId: id, services: [], deployments: {}, states: {} } },
      servers: id => { if (id === 'b') throw Error('缓存读取失败'); return [] }
    })
    assert.equal(taskReads, 1); assert.deepEqual(rows.map(row => row.projectId), ['a', 'b'])
    assert.equal(rows[0].operationsError, '认证失败'); assert.equal(rows[0].tasks.counts, null)
    assert.ok(rows[1].operations); assert.equal(rows[1].serversError, '缓存读取失败')
  })
  it('retains a confirmed production rollback separately from the latest failed deployment', () => {
    const deployment = (id: string, state: string, createdAt: string, target = 'production') => ({ id, state, createdAt, target, url: '', readyAt: '', creator: '', meta: {}, commitSha: id })
    const production = deployment('rollback', 'READY', '2026-11-01T00:00:00Z')
    const state = { ...emptyServiceOperations(), production }
    const operations: ProjectOperations = { projectId: 'a', services: [], states: { s: state }, deployments: { s: [production, deployment('failed', 'ERROR', '2026-11-06T00:00:00Z'), deployment('build', 'BUILDING', '2026-11-05T00:00:00Z', 'preview')] } }
    const [row] = readProjectDirectorySummaries({ projectIds: ['a'] }, { projectExists: () => true, tasks: () => { throw Error('任务存储不可用') }, operations: () => operations, servers: () => [] })
    assert.equal(row.tasks.error, '任务存储不可用'); assert.equal(row.operations?.states.s.production?.id, 'rollback')
    assert.deepEqual(row.operations?.deployments.s.map(item => item.id), ['failed', 'build'])
    assert.equal(operations.deployments.s.length, 3)
    assert.throws(() => readProjectDirectorySummaries({ projectIds: [42] } as never, {} as never), /有效/)
  })
})
