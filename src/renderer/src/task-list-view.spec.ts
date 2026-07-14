import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createTask,
  createTaskGanttRange,
  createTaskTimelineSections,
  defaultTaskFilterState,
  filterTaskItems,
  getTaskScheduleRange,
  getTaskStats,
  groupTasksByStatus,
  normalizeTaskList,
  readStoredTaskItems,
  taskListStorageKey,
  writeStoredTaskItems,
  type TaskItem,
  type TaskListStorage
} from './task-list-view.js'

function createMemoryStorage(): TaskListStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

function createFixtureTask(input: Partial<TaskItem>): TaskItem {
  return createTask(
    {
      id: input.id,
      title: input.title,
      status: input.status,
      priority: input.priority,
      projectId: input.projectId,
      startDate: input.startDate,
      dueDate: input.dueDate,
      subtasks: input.subtasks,
      tags: input.tags,
      notes: input.notes,
      createdAt: input.createdAt ?? '2026-07-08T01:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-07-08T02:00:00.000Z',
      completedAt: input.completedAt
    },
    new Date('2026-07-08T12:00:00')
  )
}

describe('task list view model', () => {
  it('normalizes stored task payloads and drops malformed rows', () => {
    const tasks = normalizeTaskList([
      {
        id: 'task-1',
        title: '  Prepare release  ',
        status: 'doing',
        priority: 'high',
        projectId: 'project-alpha',
        startDate: '2026-07-08',
        dueDate: '2026-07-09',
        subtasks: [
          { id: 'subtask-1', title: ' 打包产物 ', done: true, createdAt: '2026-07-07T01:00:00.000Z', completedAt: '2026-07-07T02:00:00.000Z' },
          { id: 'subtask-empty', title: '   ', done: false }
        ],
        tags: ['Release', 'release', ' QA '],
        createdAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z'
      },
      { id: '', title: 'missing id' },
      null
    ])

    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].title, 'Prepare release')
    assert.deepEqual(tasks[0].tags, ['Release', 'QA'])
    assert.equal(tasks[0].status, 'doing')
    assert.equal(tasks[0].priority, 'high')
    assert.equal(tasks[0].projectId, 'project-alpha')
    assert.equal(tasks[0].startDate, '2026-07-08')
    assert.deepEqual(tasks[0].subtasks, [
      {
        id: 'subtask-1',
        title: '打包产物',
        done: true,
        createdAt: '2026-07-07T01:00:00.000Z',
        completedAt: '2026-07-07T02:00:00.000Z'
      }
    ])
  })

  it('persists tasks through local storage safely', () => {
    const storage = createMemoryStorage()
    const task = createFixtureTask({ id: 'task-1', title: 'Write notes' })

    writeStoredTaskItems([task], storage)

    assert.ok(storage.values.get(taskListStorageKey))
    assert.deepEqual(readStoredTaskItems(storage), [task])
  })

  it('filters by search, status, priority, project, due date, and tags', () => {
    const today = new Date('2026-07-08T12:00:00')
    const tasks = [
      createFixtureTask({ id: 'task-overdue', title: 'Fix deploy', status: 'todo', priority: 'high', projectId: 'project-alpha', dueDate: '2026-07-07', tags: ['ops'] }),
      createFixtureTask({
        id: 'task-today',
        title: 'Review copy',
        status: 'doing',
        priority: 'medium',
        projectId: 'project-beta',
        dueDate: '2026-07-08',
        tags: ['docs'],
        subtasks: [{ id: 'subtask-copy', title: '发布校对清单', done: false, createdAt: '2026-07-08T01:00:00.000Z', completedAt: null }]
      }),
      createFixtureTask({ id: 'task-done', title: 'Archive branch', status: 'done', priority: 'low', dueDate: '2026-07-06', tags: ['ops'] })
    ]

    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, due: 'overdue' }, today).map((task) => task.id),
      ['task-overdue']
    )
    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, query: 'copy', status: 'doing', priority: 'medium', tag: 'docs' }, today).map((task) => task.id),
      ['task-today']
    )
    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, query: '校对清单' }, today).map((task) => task.id),
      ['task-today']
    )
    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, projectId: 'project-alpha' }, today).map((task) => task.id),
      ['task-overdue']
    )
    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, projectId: 'unassigned' }, today).map((task) => task.id),
      ['task-done']
    )
  })

  it('keeps active tasks ahead of completed tasks when sorting', () => {
    const tasks = [
      createFixtureTask({
        id: 'task-done',
        title: 'Archived release plan',
        status: 'done',
        priority: 'high',
        dueDate: '2026-07-07',
        updatedAt: '2026-07-10T10:00:00.000Z'
      }),
      createFixtureTask({
        id: 'task-doing',
        title: 'Publish production',
        status: 'doing',
        priority: 'low',
        dueDate: '2026-07-12',
        updatedAt: '2026-07-09T10:00:00.000Z'
      }),
      createFixtureTask({
        id: 'task-todo',
        title: 'Prepare handoff',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-07-09',
        updatedAt: '2026-07-08T10:00:00.000Z'
      })
    ]

    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, sort: 'updated' }).map((task) => task.id),
      ['task-doing', 'task-todo', 'task-done']
    )
    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, sort: 'due' }).map((task) => task.id),
      ['task-todo', 'task-doing', 'task-done']
    )
    assert.deepEqual(
      filterTaskItems(tasks, { ...defaultTaskFilterState, sort: 'priority' }).map((task) => task.id),
      ['task-todo', 'task-doing', 'task-done']
    )
  })

  it('builds stats, board groups, and timeline sections', () => {
    const today = new Date('2026-07-08T12:00:00')
    const tasks = [
      createFixtureTask({ id: 'task-overdue', title: 'Fix deploy', status: 'todo', dueDate: '2026-07-07' }),
      createFixtureTask({ id: 'task-today', title: 'Review copy', status: 'doing', dueDate: '2026-07-08' }),
      createFixtureTask({ id: 'task-later', title: 'Plan scope', status: 'todo', dueDate: '2026-07-20' }),
      createFixtureTask({ id: 'task-done', title: 'Archive branch', status: 'done', dueDate: '2026-07-06' })
    ]

    assert.deepEqual(getTaskStats(tasks, today), {
      active: 3,
      done: 1,
      dueToday: 1,
      overdue: 1,
      todo: 2,
      doing: 1,
      total: 4
    })
    assert.equal(groupTasksByStatus(tasks).todo.length, 2)
    assert.deepEqual(
      createTaskTimelineSections(tasks, today).map((section) => section.key),
      ['overdue', 'today', 'later', 'done']
    )
  })

  it('creates gantt rows from start and due dates', () => {
    const today = new Date('2026-07-08T12:00:00')
    const tasks = [
      createFixtureTask({ id: 'task-window', title: 'Build task window', status: 'doing', startDate: '2026-07-09', dueDate: '2026-07-11' }),
      createFixtureTask({ id: 'task-single', title: 'Single day', status: 'todo', dueDate: '2026-07-08' })
    ]
    const range = createTaskGanttRange(tasks, today)

    assert.equal(range.startDate, '2026-07-08')
    assert.equal(range.endDate, '2026-07-14')
    assert.equal(range.totalDays, 7)
    assert.deepEqual(getTaskScheduleRange(tasks[0]), { startDate: '2026-07-09', endDate: '2026-07-11' })
    assert.deepEqual(
      range.rows.map((row) => ({ id: row.task.id, offsetDays: row.offsetDays, durationDays: row.durationDays })),
      [
        { id: 'task-single', offsetDays: 0, durationDays: 1 },
        { id: 'task-window', offsetDays: 1, durationDays: 3 }
      ]
    )
  })
})
