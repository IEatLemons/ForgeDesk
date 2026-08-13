import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  clearProjectGitTasks,
  deleteProjectGitTask,
  listProjectGitTasks,
  migrateProjectGitTaskTable,
  pruneProjectGitTasks,
  recoverProjectGitTasks,
  saveProjectGitTask,
  type ProjectGitTaskLog
} from './project-git-task-logs.js'

function createDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY)')
  db.exec("INSERT INTO projects (id) VALUES ('project-1'), ('project-2')")
  migrateProjectGitTaskTable(db)
  return db
}

function createTask(input: Partial<ProjectGitTaskLog> = {}): ProjectGitTaskLog {
  return {
    id: input.id ?? 'git-task-1',
    projectId: input.projectId ?? 'project-1',
    projectName: input.projectName ?? 'ForgeDesk',
    action: input.action ?? 'push',
    status: input.status ?? 'running',
    startedAt: input.startedAt ?? '2026-08-13T01:00:00.000Z',
    finishedAt: input.finishedAt,
    summary: input.summary ?? '推送正在执行',
    repositoryResults: input.repositoryResults ?? []
  }
}

describe('project Git task log persistence', () => {
  it('migrates, upserts and restores repository results', () => {
    const db = createDatabase()

    saveProjectGitTask(db, createTask())
    saveProjectGitTask(db, createTask({
      status: 'success',
      finishedAt: '2026-08-13T01:01:00.000Z',
      summary: '推送完成',
      repositoryResults: [{
        repositoryId: 'repository-1',
        repositoryName: 'ForgeDesk',
        ok: true,
        message: 'main -> origin/main',
        stdout: 'Everything up-to-date'
      }]
    }))

    assert.deepEqual(listProjectGitTasks(db), [createTask({
      status: 'success',
      finishedAt: '2026-08-13T01:01:00.000Z',
      summary: '推送完成',
      repositoryResults: [{
        repositoryId: 'repository-1',
        repositoryName: 'ForgeDesk',
        ok: true,
        message: 'main -> origin/main',
        stdout: 'Everything up-to-date'
      }]
    })])

    db.close()
  })

  it('orders tasks newest first and supports project filtering', () => {
    const db = createDatabase()

    saveProjectGitTask(db, createTask({ id: 'older', startedAt: '2026-08-13T01:00:00.000Z' }))
    saveProjectGitTask(db, createTask({ id: 'newer', projectId: 'project-2', projectName: 'Other', startedAt: '2026-08-13T02:00:00.000Z' }))

    assert.deepEqual(listProjectGitTasks(db).map((task) => task.id), ['newer', 'older'])
    assert.deepEqual(listProjectGitTasks(db, 'project-2').map((task) => task.id), ['newer'])

    db.close()
  })

  it('marks running tasks as interrupted during recovery', () => {
    const db = createDatabase()
    saveProjectGitTask(db, createTask())

    recoverProjectGitTasks(db, new Date('2026-08-13T03:00:00.000Z'))

    const [task] = listProjectGitTasks(db)
    assert.equal(task.status, 'interrupted')
    assert.equal(task.finishedAt, '2026-08-13T03:00:00.000Z')
    assert.match(task.summary, /应用关闭时任务未完成/)

    db.close()
  })

  it('removes records older than the 30-day retention window', () => {
    const db = createDatabase()
    saveProjectGitTask(db, createTask({
      id: 'expired',
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T01:00:00.000Z'
    }))
    saveProjectGitTask(db, createTask({
      id: 'kept',
      startedAt: '2026-08-01T00:00:00.000Z',
      finishedAt: '2026-08-01T01:00:00.000Z'
    }))

    pruneProjectGitTasks(db, new Date('2026-08-13T00:00:00.000Z'))

    assert.deepEqual(listProjectGitTasks(db).map((task) => task.id), ['kept'])
    db.close()
  })

  it('deletes one task and clears all remaining tasks', () => {
    const db = createDatabase()
    saveProjectGitTask(db, createTask({ id: 'task-1' }))
    saveProjectGitTask(db, createTask({ id: 'task-2' }))

    deleteProjectGitTask(db, 'task-1')
    assert.deepEqual(listProjectGitTasks(db).map((task) => task.id), ['task-2'])

    clearProjectGitTasks(db)
    assert.deepEqual(listProjectGitTasks(db), [])
    db.close()
  })

  it('cascades task logs when the owning project is deleted', () => {
    const db = createDatabase()
    saveProjectGitTask(db, createTask({ id: 'project-1-task' }))
    saveProjectGitTask(db, createTask({ id: 'project-2-task', projectId: 'project-2' }))

    db.prepare('DELETE FROM projects WHERE id = ?').run('project-1')

    assert.deepEqual(listProjectGitTasks(db).map((task) => task.id), ['project-2-task'])
    db.close()
  })
})
