import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { countRunningProjectGitTaskLogs, filterProjectGitTaskLogs, getProjectGitTaskStatusMeta } from './project-git-task-log-view.js'

function createTask(input: Partial<ProjectGitTaskLog>): ProjectGitTaskLog {
  return {
    id: input.id ?? 'task-1',
    projectId: input.projectId ?? 'project-1',
    projectName: input.projectName ?? 'ForgeDesk',
    action: input.action ?? 'push',
    status: input.status ?? 'success',
    startedAt: input.startedAt ?? '2026-08-13T01:00:00.000Z',
    finishedAt: input.finishedAt,
    summary: input.summary ?? '完成',
    repositoryResults: input.repositoryResults ?? []
  }
}

describe('project Git task log view helpers', () => {
  it('filters persisted logs by project, action and status', () => {
    const logs = [
      createTask({ id: 'push-running', projectId: 'project-1', action: 'push', status: 'running' }),
      createTask({ id: 'fetch-success', projectId: 'project-1', action: 'fetch', status: 'success' }),
      createTask({ id: 'merge-failed', projectId: 'project-2', action: 'merge', status: 'failed' })
    ]

    assert.deepEqual(
      filterProjectGitTaskLogs(logs, { projectId: 'project-1', action: 'push', status: 'running' }).map((task) => task.id),
      ['push-running']
    )
    assert.deepEqual(
      filterProjectGitTaskLogs(logs, { projectId: 'all', action: 'all', status: 'failed' }).map((task) => task.id),
      ['merge-failed']
    )
  })

  it('counts running logs for the global status bar', () => {
    assert.equal(countRunningProjectGitTaskLogs([
      createTask({ id: 'running', status: 'running' }),
      createTask({ id: 'success', status: 'success' })
    ]), 1)
  })

  it('maps every persisted status to a stable label and badge state', () => {
    assert.deepEqual(getProjectGitTaskStatusMeta('running'), { label: '执行中', color: 'blue', badgeStatus: 'processing' })
    assert.deepEqual(getProjectGitTaskStatusMeta('success'), { label: '成功', color: 'green', badgeStatus: 'success' })
    assert.deepEqual(getProjectGitTaskStatusMeta('failed'), { label: '失败', color: 'red', badgeStatus: 'error' })
    assert.deepEqual(getProjectGitTaskStatusMeta('skipped'), { label: '跳过', color: 'default', badgeStatus: 'default' })
    assert.deepEqual(getProjectGitTaskStatusMeta('cancelled'), { label: '已终止', color: 'orange', badgeStatus: 'warning' })
    assert.deepEqual(getProjectGitTaskStatusMeta('interrupted'), { label: '已中断', color: 'orange', badgeStatus: 'warning' })
  })
})
