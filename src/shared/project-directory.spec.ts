import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { directoryTaskSummary, summaryTaskSelection } from './project-directory.js'
import type { ProjectWorkItem } from './project-progress'
function task(id: string, patch: Partial<ProjectWorkItem> = {}): ProjectWorkItem {
  return { id, projectId: 'p', parentId: null, trackingState: 'tracked', status: 'todo', priority: 'medium', blockers: [], dependencyIds: [], archivedAt: null, dueDate: null, ...patch } as ProjectWorkItem
}
describe('project card task counts', () => {
  it('does not double count parents, excludes archives, cancellations and inbox, and keeps urgency separate from overdue', () => {
    const items = [task('parent', { priority: 'high' }), task('child', { parentId: 'parent', priority: 'high' }), task('done', { parentId: 'parent', status: 'done' }), task('doing', { status: 'doing' }), task('review', { status: 'review', priority: 'high' }), task('late', { dueDate: '2026-11-05' }), task('archive', { priority: 'high', archivedAt: '2026-01-01' }), task('cancel', { priority: 'high', status: 'cancelled' }), task('inbox', { trackingState: 'inbox' })]
    const summary = directoryTaskSummary(items, true, '2026-11-06T01:00:00Z', 'Asia/Shanghai')
    assert.deepEqual(summary.counts, { todo: 2, doing: 1, review: 1, urgent: 2, overdue: 1, blocked: 0, awaitingParentAcceptance: 0 })
    assert.equal(directoryTaskSummary(items, false, '2026-11-06T01:00:00Z', 'Asia/Shanghai').counts, null)
    assert.equal(directoryTaskSummary([], true, '2026-11-06T01:00:00Z', 'Asia/Shanghai').counts?.todo, 0)
  })
  it('inherits explicit parent blockers, accepts completed archived dependencies and reports parent acceptance', () => {
    const items = [task('parent', { blockers: [{ resolvedAt: null }] as never }), task('child', { parentId: 'parent' }), task('dependency', { status: 'done', archivedAt: '2026-11-01' }), task('independent', { dependencyIds: ['dependency'] }), task('accept', { status: 'review' }), task('accepted-child', { parentId: 'accept', status: 'done' })]
    assert.deepEqual(summaryTaskSelection(items, 'blocked').map(item => item.id), ['child'])
    assert.deepEqual(summaryTaskSelection(items, 'awaitingParentAcceptance').map(item => item.id), ['accept'])
  })
  it('uses the snapshot timezone at the calendar boundary', () => {
    const items = [task('yesterday', { dueDate: '2026-11-05' })]
    assert.equal(directoryTaskSummary(items, true, '2026-11-05T17:00:00Z', 'Asia/Shanghai').counts?.overdue, 1)
    assert.equal(directoryTaskSummary(items, true, '2026-11-05T17:00:00Z', 'America/Los_Angeles').counts?.overdue, 0)
  })
})
