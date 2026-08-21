import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { ManagedTaskService, migrateManagedTaskTables } from './managed-tasks.js'

function createService(): ManagedTaskService {
  const database = new DatabaseSync(':memory:')
  migrateManagedTaskTables(database as never)
  return new ManagedTaskService(() => database as never, () => new Date('2026-08-18T00:00:00.000Z'))
}

describe('managed task service', () => {
  it('requires a project, repository, and native Codex thread before creating a managed task', () => {
    const service = createService()
    assert.throws(() => service.create({ title: '修复任务', projectId: '', repositoryId: 'repo', cwd: '/repo', codexThreadId: 'thread-1' }), /关联项目/)
    assert.throws(() => service.create({ title: '修复任务', projectId: 'project', repositoryId: '', cwd: '/repo', codexThreadId: 'thread-1' }), /关联仓库/)
    assert.throws(() => service.create({ title: '修复任务', projectId: 'project', repositoryId: 'repo', cwd: '/repo', codexThreadId: '' }), /Codex 线程/)
  })

  it('persists the plan, lifecycle, and a no-change completion without inventing a release', () => {
    const service = createService()
    const created = service.create({ title: '修复登录', projectId: 'project', repositoryId: 'repo', cwd: '/repo', codexThreadId: 'thread-1' })
    service.beginPlanning(created.id)
    const planned = service.setPlan(created.id, [{ title: '定位原因' }, { title: '补充回归测试', dependencyIndexes: [0] }])
    assert.equal(planned.stage, 'ready')
    assert.equal(planned.subtasks.length, 2)
    assert.deepEqual(planned.subtasks[1]?.dependencyIds, [planned.subtasks[0]?.id])
    const completed = service.completeExecution(created.id, false)
    assert.equal(completed.stage, 'completed-no-changes')
    assert.equal(completed.targetBranch, '')
    assert.equal(completed.events.at(-1)?.message, '未检测到代码变更，任务已完成')
  })

  it('deduplicates imported Codex threads and keeps unlinked work out of the release flow', () => {
    const service = createService()
    const first = service.importThread({ id: 'native-thread', title: '外部 Codex 任务', cwd: '/other', status: 'completed', updatedAt: '2026-08-18T00:00:00.000Z' })
    const second = service.importThread({ id: 'native-thread', title: '更新后的标题', cwd: '/other', status: 'completed', updatedAt: '2026-08-18T01:00:00.000Z' })
    assert.equal(first.id, second.id)
    assert.equal(first.stage, 'unassigned')
    assert.equal(service.list().length, 1)
  })

  it('imports an active native Codex session as an executing task when its repository is known', () => {
    const service = createService()
    const task = service.importThread({ id: 'native-running-thread', title: '正在执行的原生会话', cwd: '/repo', status: 'running', updatedAt: '2026-08-18T00:00:00.000Z' }, 'project', 'repo')

    assert.equal(task.stage, 'executing')
    assert.equal(task.runStatus, 'running')
    assert.equal(task.bindings[0]?.nativeStatus, 'running')
  })

  it('migrates legacy task ids, subtasks, and timestamps into the unified inbox', () => {
    const service = createService()
    const migrated = service.importLegacy({
      id: 'task-legacy-1', title: '旧任务', notes: '保留说明', status: 'doing', projectId: null,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
      subtasks: [{ id: 'subtask-legacy-1', title: '旧子任务', done: true, createdAt: '2026-08-01T01:00:00.000Z' }]
    })
    assert.equal(migrated.id, 'task-legacy-1')
    assert.equal(migrated.stage, 'unassigned')
    assert.equal(migrated.createdAt, '2026-08-01T00:00:00.000Z')
    assert.equal(migrated.subtasks[0]?.id, 'subtask-legacy-1')
    assert.equal(migrated.subtasks[0]?.runStatus, 'completed')
  })

  it('moves reviewed code through commit, merge and push stages with a selected delivery branch', () => {
    const service = createService()
    const task = service.create({ title: '发布变更', projectId: 'project', repositoryId: 'repo', cwd: '/repo', codexThreadId: 'thread-2' })
    service.completeExecution(task.id, true)
    service.approveReview(task.id)
    service.recordCommit(task.id, '1234567890abcdef')
    const merging = service.beginMerge(task.id, 'preview')
    assert.equal(merging.stage, 'merging')
    assert.equal(merging.targetBranch, 'preview')
    service.merged(task.id)
    service.beginPush(task.id)
    const completed = service.completePublish(task.id, 'pushed')
    assert.equal(completed.stage, 'completed')
    assert.equal(completed.runStatus, 'completed')
  })

  it('cancels running subtasks and does not let a stale native update restart the task', () => {
    const service = createService()
    const task = service.create({ title: '可终止任务', projectId: 'project', repositoryId: 'repo', cwd: '/repo', codexThreadId: 'thread-parent' })
    service.setPlan(task.id, [{ title: '执行改动' }])
    service.startExecution(task.id)
    service.startSubtask(task.id, service.get(task.id)?.subtasks[0]?.id || '', { id: 'thread-subtask', title: '执行改动', cwd: '/repo', status: 'running', updatedAt: '2026-08-18T00:00:00.000Z' })

    const cancelled = service.cancel(task.id)
    assert.equal(cancelled.stage, 'cancelled')
    assert.equal(cancelled.subtasks[0]?.runStatus, 'cancelled')
    assert.equal(service.updateBinding({ id: 'thread-subtask', title: '执行改动', cwd: '/repo', status: 'running', updatedAt: '2026-08-18T00:01:00.000Z' })?.stage, 'cancelled')
  })
})
