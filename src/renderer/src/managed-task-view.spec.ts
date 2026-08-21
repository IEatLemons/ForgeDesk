import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ManagedTask } from './data.js'
import { resolveManagedTaskCodexThreadId } from './managed-task-view.js'

function createTask(patch: Partial<ManagedTask> = {}): ManagedTask {
  return {
    autoExecute: false,
    baseBranch: '',
    baselineSha: '',
    bindings: [],
    branch: '',
    codexThreadId: 'parent-thread',
    commitSha: '',
    createdAt: '2026-08-19T00:00:00.000Z',
    cwd: '/workspace',
    description: '',
    events: [],
    finishedAt: '',
    hasChanges: false,
    id: 'managed-task-1',
    projectId: 'project-1',
    repositoryId: 'repository-1',
    runStatus: 'idle',
    source: 'forgedesk',
    stage: 'planning',
    subtasks: [],
    targetBranch: '',
    title: '测试任务',
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...patch
  }
}

describe('managed task Codex conversation selection', () => {
  it('opens a running subtask conversation before the parent planning thread', () => {
    const task = createTask({
      subtasks: [
        { acceptance: '', codexThreadId: 'older-thread', createdAt: '', dependencyIds: [], description: '', id: 'subtask-1', order: 0, runStatus: 'completed', stage: 'codex-complete', taskId: 'managed-task-1', title: '旧子任务', updatedAt: '2026-08-19T01:00:00.000Z' },
        { acceptance: '', codexThreadId: 'running-thread', createdAt: '', dependencyIds: [], description: '', id: 'subtask-2', order: 1, runStatus: 'running', stage: 'executing', taskId: 'managed-task-1', title: '执行中的子任务', updatedAt: '2026-08-19T00:30:00.000Z' }
      ]
    })

    assert.equal(resolveManagedTaskCodexThreadId(task), 'running-thread')
  })

  it('uses the newest completed subtask thread when nothing is running', () => {
    const task = createTask({
      bindings: [
        { codexThreadId: 'bound-thread', cwd: '/workspace', nativeStatus: 'completed', role: 'subtask', taskId: 'managed-task-1', title: '绑定子任务', updatedAt: '2026-08-19T02:00:00.000Z' }
      ],
      subtasks: [
        { acceptance: '', codexThreadId: 'older-thread', createdAt: '', dependencyIds: [], description: '', id: 'subtask-1', order: 0, runStatus: 'completed', stage: 'codex-complete', taskId: 'managed-task-1', title: '旧子任务', updatedAt: '2026-08-19T01:00:00.000Z' }
      ]
    })

    assert.equal(resolveManagedTaskCodexThreadId(task), 'bound-thread')
  })

  it('falls back to the parent thread for a task that has not been split yet', () => {
    assert.equal(resolveManagedTaskCodexThreadId(createTask()), 'parent-thread')
  })
})
