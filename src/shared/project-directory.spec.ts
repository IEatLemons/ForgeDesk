import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { directoryTaskSummary, summaryTaskSelection } from './project-directory.js'
import type { WorkspaceTask } from './task-workspace'

function task(id: string, patch: Partial<WorkspaceTask> = {}): WorkspaceTask {
  return { id, projectIds: ['p'], parentId: null, done: false, priority: 'medium', dependencyIds: [], startDate: null, dueDate: null, timezone: 'Asia/Shanghai', ...patch } as WorkspaceTask
}

describe('project card task counts', () => {
  it('counts leaf tasks, started dates, completion, urgency and overdue independently', () => {
    const items = [task('parent', { priority: 'high' }), task('child', { parentId: 'parent', priority: 'high' }), task('done', { parentId: 'parent', done: true }), task('doing', { startDate: '2026-11-05' }), task('late', { dueDate: '2026-11-05' })]
    const summary = directoryTaskSummary(items, true, '2026-11-06T01:00:00Z', 'Asia/Shanghai')
    assert.deepEqual(summary.counts, { todo: 2, doing: 1, done: 1, urgent: 1, overdue: 1, blocked: 0, awaitingParentCompletion: 0 })
    assert.equal(directoryTaskSummary(items, false, '2026-11-06T01:00:00Z', 'Asia/Shanghai').counts, null)
    assert.equal(directoryTaskSummary([], true, '2026-11-06T01:00:00Z', 'Asia/Shanghai').counts?.todo, 0)
  })

  it('inherits parent dependencies, uses cross-project completion and identifies unfinished parents', () => {
    const items = [task('parent', { dependencyIds: ['external'] }), task('child', { parentId: 'parent' }), task('independent', { dependencyIds: ['complete'] }), task('finish'), task('finished-child', { parentId: 'finish', done: true })]
    const context = [...items, task('external', { projectIds: ['other'] }), task('complete', { projectIds: ['other'], done: true })]
    assert.deepEqual(summaryTaskSelection(items, 'blocked', new Date(), context).map(item => item.id), ['child'])
    assert.deepEqual(summaryTaskSelection(items, 'awaitingParentCompletion').map(item => item.id), ['finish'])
    assert.deepEqual(summaryTaskSelection(items).map(item => item.id), items.map(item => item.id))
  })

  it('uses each task timezone at the calendar boundary', () => {
    const item = task('yesterday', { dueDate: '2026-11-05' })
    assert.equal(directoryTaskSummary([item], true, '2026-11-05T17:00:00Z', 'Asia/Shanghai').counts?.overdue, 1)
    assert.equal(directoryTaskSummary([{ ...item, timezone: 'America/Los_Angeles' }], true, '2026-11-05T17:00:00Z', 'Asia/Shanghai').counts?.overdue, 0)
  })
})
