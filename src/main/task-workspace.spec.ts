import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { TaskWorkspaceService, defaultTaskDashboard } from './task-workspace.js'
import { initializeTaskWorkspaceWithBackup } from './task-workspace-upgrade.js'
import { nextTaskOccurrence } from './task-recurrence.js'
import type { TaskCommand, WorkspaceTask, TaskField, TaskRecurrence } from '../shared/task-workspace.js'
import { aggregateTaskValues, matchesTaskFilters, newTaskWidget, scopeTaskItems, taskOverdue, taskWidgetKinds } from '../shared/task-workspace.js'

function fixture(now = '2026-11-10T08:00:00Z') {
  const db = new Database(':memory:'); let time = new Date(now), changes = 0
  const service = new TaskWorkspaceService(db, () => time, () => changes++)
  service.initialize('/test-backup')
  const command = (input: Omit<TaskCommand, 'commandId'> | Record<string, unknown>) => service.command({ ...input, commandId: randomUUID() } as TaskCommand).entityId
  const create = (title = '测试任务', patch: Partial<WorkspaceTask> = {}) => command({ type: 'save-task', input: { title, ...patch } })
  const task = (id: string) => service.get<WorkspaceTask>('task', id)
  const update = (id: string, patch: Partial<WorkspaceTask>) => command({ type: 'save-task', input: { id, ...patch }, expectedVersion: task(id).rowVersion })
  return { db, service, command, create, task, update, setTime: (value: string) => { time = new Date(value) }, changes: () => changes }
}
describe('independent task workspace', () => {
  it('summarizes linked tasks and dependencies across projects for directory cards', () => {
    const { db, service, create, update } = fixture()
    db.exec("CREATE TABLE projects (id TEXT PRIMARY KEY, archived_at TEXT); INSERT INTO projects (id) VALUES ('p1'), ('p2');")
    const dependency = create('前置任务', { projectIds: ['p2'] })
    create('阻塞任务', { projectIds: ['p1'], dependencyIds: [dependency], priority: 'high', dueDate: '2026-11-09' })
    const first = service.readDirectorySummaries(['p1', 'p2'])
    assert.equal(first.p1.counts?.todo, 1)
    assert.equal(first.p1.counts?.blocked, 1)
    assert.equal(first.p1.counts?.urgent, 1)
    assert.equal(first.p1.counts?.overdue, 1)
    assert.equal(first.p2.counts?.todo, 1)
    update(dependency, { done: true })
    const refreshed = service.readDirectorySummaries(['p1', 'p2'])
    assert.equal(refreshed.p1.counts?.blocked, 0)
    assert.equal(refreshed.p2.counts?.done, 1)
    db.close()
  })

  it('shares tasks across projects and removes only the deleted project association', () => {
    const { db, service, create, command, task } = fixture()
    db.exec("CREATE TABLE projects (id TEXT PRIMARY KEY, archived_at TEXT); INSERT INTO projects (id) VALUES ('p1'), ('p2');")
    const first = create('共享任务', { projectIds: ['p1', 'p2'] })
    const second = create('项目任务', { projectIds: ['p1'] })
    assert.equal(service.snapshot().tasks.filter(task => task.projectIds.includes('p1')).length, 2)
    assert.throws(() => create('无效任务', { projectIds: ['missing'] }), /项目不存在/)
    assert.throws(() => create('无效任务', { projectIds: ['p1', 'p1'] }), /项目无效或重复/)

    db.prepare("UPDATE projects SET archived_at='2026-11-10' WHERE id='p1'").run()
    const before = task(first)
    assert.deepEqual(before.projectIds, ['p1', 'p2'])
    const removeProject = () => {
      service.detachProject('p1')
      db.prepare("DELETE FROM projects WHERE id='p1'").run()
    }
    assert.throws(db.transaction(() => {
      removeProject()
      throw new Error('回滚')
    }), /回滚/)
    assert.deepEqual(task(first), before)

    db.transaction(removeProject)()
    assert.deepEqual(task(first).projectIds, ['p2'])
    assert.deepEqual(task(second).projectIds, [])
    assert.equal(task(first).rowVersion, before.rowVersion + 1)
    assert.ok(service.history({ entityId: first }).some(event => event.action === '解除项目关联'))
    assert.throws(() => command({ type: 'save-task', input: { id: first, title: '过时修改' }, expectedVersion: before.rowVersion }), /其他窗口修改/)
    db.close()
  })

  it('opens tasks saved before project links without changing their data or version', () => {
    const { db, create, task } = fixture()
    const id = create('既有任务')
    const before = task(id)
    db.prepare("UPDATE task_workspace_task SET data_json=json_remove(data_json,'$.projectIds') WHERE id=?").run(id)
    for (let i = 0; i < 2; i++) {
      const service = new TaskWorkspaceService(db)
      assert.deepEqual(service.get('task', id), before)
    }
    db.close()
  })

  it('starts empty with only a local self identity and saves command receipts atomically', () => {
    const { db, service } = fixture()
    assert.equal(service.snapshot().tasks.length, 0); assert.equal(service.snapshot().people[0].name, '我')
    const command = { type: 'save-task' as const, commandId: 'same', input: { title: '任务' } }
    assert.deepEqual(service.command(command), service.command(command)); assert.equal(service.snapshot().tasks.length, 1)
    assert.throws(() => service.command({ ...command, input: { title: 'changed' } }), /内容发生变化/)
    assert.throws(() => service.command({ type: 'save-task', commandId: 'bad', input: { title: ' ' } }), /名称/)
    assert.equal(db.prepare("SELECT count(*) n FROM task_workspace_commands WHERE id='bad'").get() && (db.prepare("SELECT count(*) n FROM task_workspace_commands WHERE id='bad'").get() as { n: number }).n, 0)
    db.close()
  })
  it('keeps multi-list groups independent and completion independent of children', () => {
    const { db, command, create, task, update, service } = fixture()
    const a = command({ type: 'save-list', input: { title: '清单 A' } }), b = command({ type: 'save-list', input: { title: '清单 B' } })
    const groupA = command({ type: 'save-group', input: { title: 'A 分组', scope: a } }), groupB = command({ type: 'save-group', input: { title: 'B 分组', scope: b } }), personal = command({ type: 'save-group', input: { title: '个人分组', scope: 'personal' } })
    const root = create('父任务', { personalGroupId: personal, links: [{ listId: a, groupId: groupA, order: 1 }, { listId: b, groupId: groupB, order: 2 }] }), child = create('子任务', { parentId: root })
    update(root, { done: true }); assert.equal(task(child).done, false); assert.ok(task(root).completedAt)
    update(root, { done: false }); assert.equal(task(root).completedAt, null)
    assert.equal(task(root).links[1].groupId, groupB); assert.equal(task(root).personalGroupId, personal)
    assert.throws(() => update(root, { parentId: child }), /循环/)
    assert.throws(() => update(root, { links: [{ listId: a, groupId: groupB, order: 0 }] }), /分组不属于/)
    assert.equal(scopeTaskItems(service.snapshot(), 'unknown-list').length, 0)
    db.close()
  })
  it('rejects dependency cycles, stale writes and rolls back a failed batch', () => {
    const { db, command, create, task, update } = fixture()
    const a = create('A'), b = create('B')
    update(b, { dependencyIds: [a] }); assert.throws(() => update(a, { dependencyIds: [b] }), /循环/)
    assert.throws(() => command({ type: 'save-task', input: { id: b, title: 'B2' }, expectedVersion: 1 }), /其他窗口/)
    assert.throws(() => command({ type: 'batch', tasks: [{ id: a, expectedVersion: task(a).rowVersion, patch: { title: 'changed' } }, { id: b, expectedVersion: task(b).rowVersion, patch: { dueDate: '2026-02-30' } }] }), /日期/)
    assert.equal(task(a).title, 'A')
    command({ type: 'batch', tasks: [a, b].map(id => ({ id, expectedVersion: task(id).rowVersion, delete: true })) })
    assert.throws(() => task(a), /不存在/); assert.throws(() => task(b), /不存在/)
    db.close()
  })
  it('validates all six field types and shares values across lists', () => {
    const { db, command, create, task, update, service } = fixture()
    const field = (type: TaskField['type'], options: TaskField['options'] = []) => command({ type: 'save-field', input: { title: type, type, options } })
    const single = field('single', [{ id: 'x', label: 'X', color: '#ff0000' }]), multi = field('multi', [{ id: 'y', label: 'Y', color: '#00ff00' }]), person = field('person'), number = field('number'), date = field('date'), text = field('text')
    const values = { [single]: 'x', [multi]: ['y'], [person]: ['self'], [number]: 42, [date]: '2026-11-11', [text]: '备注' }
    const id = create('字段任务', { values }); assert.deepEqual(task(id).values, values)
    assert.throws(() => update(id, { values: { [number]: 'abc' } }), /数值/)
    assert.throws(() => update(id, { values: { [single]: 'missing' } }), /选项/)
    assert.throws(() => command({ type: 'save-field', input: { id: number, type: 'text' }, expectedVersion: 1 }), /更改类型/)
    command({ type: 'save-field', input: { id: single, options: [] }, expectedVersion: service.get<TaskField>('field', single).rowVersion }); assert.equal(task(id).values[single], null)
    db.close()
  })
  it('retains tasks when lists are deleted and unparents children on task deletion', () => {
    const { db, command, create, task, service } = fixture()
    const list = command({ type: 'save-list', input: { title: '清单' } }), root = create('父', { links: [{ listId: list, groupId: null, order: 0 }] }), child = create('子', { parentId: root, dependencyIds: [root] })
    command({ type: 'delete', kind: 'list', id: list, expectedVersion: 1 }); assert.deepEqual(task(root).links, [])
    command({ type: 'delete', kind: 'task', id: root, expectedVersion: task(root).rowVersion }); assert.equal(task(child).parentId, null); assert.deepEqual(task(child).dependencyIds, [])
    assert.ok(service.history({ entityId: root }).some(event => event.action === '删除'))
    db.close()
  })
  it('generates one next recurrence on completion, preserves history and skips missed cycles', () => {
    const { db, service, create, update, setTime } = fixture()
    const id = create('每月任务', { startDate: '2026-01-29', dueDate: '2026-01-31', recurrence: { unit: 'month', interval: 1, anchor: '2026-01-31', timezone: 'Asia/Shanghai' } })
    update(id, { done: true }); const next = service.snapshot().tasks.find(task => task.previousId === id)!
    assert.equal(next.dueDate, '2026-11-30'); assert.equal(next.startDate, '2026-11-28'); assert.equal(next.done, false)
    update(id, { done: false }); update(id, { done: true }); assert.equal(service.snapshot().tasks.length, 2)
    setTime('2026-12-01T00:00:00Z'); update(next.id, { done: true }); assert.equal(service.snapshot().tasks.find(task => task.previousId === next.id)?.dueDate, '2026-12-31')
    db.close()
  })
  it('does not regenerate a deleted occurrence after reopening the original', () => {
    const { db, service, create, update, command } = fixture()
    const id = create('重复任务', { dueDate: '2026-11-10', recurrence: { unit: 'day', interval: 1, anchor: '2026-11-10', timezone: 'Asia/Shanghai' } })
    update(id, { done: true })
    const next = service.snapshot().tasks.find(task => task.previousId === id)!
    command({ type: 'delete', kind: 'task', id: next.id, expectedVersion: next.rowVersion })
    update(id, { done: false }); update(id, { done: true })
    assert.equal(service.snapshot().tasks.length, 1)
    db.close()
  })
  it('preserves default group names, hierarchy, dependencies and field reuse in local templates', () => {
    const { db, service, command, create, update } = fixture()
    const list = command({ type: 'save-list', input: { title: '模板源' } })
    db.prepare("UPDATE task_workspace_list SET data_json=json_remove(data_json,'$.defaultGroupTitle') WHERE id=?").run(list)
    const inbox = create('默认分组任务', { links: [{ listId: list, groupId: null, order: 0 }] })
    command({ type: 'save-list', input: { id: list, defaultGroupTitle: '  待安排  ' }, expectedVersion: 1 })
    assert.equal(service.snapshot().lists.find(item => item.id === list)?.defaultGroupTitle, '待安排')
    assert.equal(service.snapshot().tasks.find(item => item.id === inbox)?.links[0].groupId, null)
    assert.throws(() => command({ type: 'save-list', input: { id: list, defaultGroupTitle: ' ' }, expectedVersion: 2 }), /默认分组名称/)
    const group = command({ type: 'save-group', input: { title: '阶段一', scope: list } })
    const links = [{ listId: list, groupId: group, order: 0 }]
    const parent = create('模板父任务', { links }), child = create('模板子任务', { links, parentId: parent, dependencyIds: [parent] })
    const template = command({ type: 'save-template', listId: list, title: '测试模板' })
    const nextList = command({ type: 'apply-template', templateId: template, title: '新的清单' })
    assert.equal(service.snapshot().lists.find(item => item.id === nextList)?.defaultGroupTitle, '待安排')
    const copies = service.snapshot().tasks.filter(task => task.links.some(link => link.listId === nextList))
    assert.equal(copies.find(task => task.title === '默认分组任务')?.links[0].groupId, null)
    const copiedParent = copies.find(task => task.title === '模板父任务')!, copiedChild = copies.find(task => task.title === '模板子任务')!
    assert.equal(copiedChild.parentId, copiedParent.id); assert.deepEqual(copiedChild.dependencyIds, [copiedParent.id])
    assert.equal(copiedParent.source, 'template'); assert.notEqual(copiedParent.links[0].groupId, group)
    assert.equal(service.snapshot().groups.find(group => group.id === copiedParent.links[0].groupId)?.title, '阶段一')
    db.close()
  })
  it('fires reminders once, cancels completed reminders and uses task timezones', () => {
    const { db, service, create, update, setTime } = fixture('2026-11-10T00:59:00Z')
    const id = create('到期提醒', { dueDate: '2026-11-10', timezone: 'Asia/Shanghai', reminderMinutes: 0 })
    assert.equal(service.dueReminders().length, 0); setTime('2026-11-10T01:00:00Z'); assert.equal(service.dueReminders().length, 1)
    service.markReminderSent(id); assert.equal(service.dueReminders().length, 0)
    update(id, { dueDate: '2026-11-09' }); assert.equal(service.dueReminders().length, 1)
    update(id, { done: true }); assert.equal(service.dueReminders().length, 0)
    db.close()
  })
  it('persists every dashboard component and deduplicates aggregation and filters', () => {
    const { db, service, command, create, task } = fixture()
    const a = create('A', { done: true }), b = create('B', { dueDate: '2026-01-01' })
    const widgets = taskWidgetKinds.map(kind => newTaskWidget(kind, randomUUID()))
    const id = command({ type: 'save-dashboard', input: { ...defaultTaskDashboard('all'), widgets } })
    assert.equal(service.get<{ widgets: unknown[] }>('dashboard', id).widgets.length, taskWidgetKinds.length)
    assert.equal(aggregateTaskValues([task(a), task(a), task(b)], { aggregation: 'count', measure: 'id' }), 2)
    assert.equal(aggregateTaskValues([task(a), task(b)], { aggregation: 'ratio', measure: 'done' }), 50)
    assert.ok(matchesTaskFilters(task(a), [{ field: 'done', operator: 'eq', value: true }]))
    assert.ok(taskOverdue(task(b), new Date('2026-11-10')))
    const restarted = new TaskWorkspaceService(db); assert.equal(restarted.snapshot().dashboards.length, 1)
    db.close()
  })
})

describe('task upgrade backup and recurrence edge cases', () => {
  it('backs up before deleting retired records, preserves other modules, and runs once', async () => {
    const root = await mkdtemp(join(tmpdir(), 'task-upgrade-')), db = new Database(':memory:')
    db.exec("CREATE TABLE managed_tasks(id TEXT); INSERT INTO managed_tasks VALUES('old'); CREATE TABLE projects(id TEXT); INSERT INTO projects VALUES('project'); CREATE TABLE codex_sessions(id TEXT); INSERT INTO codex_sessions VALUES('session'); CREATE TABLE release_tasks(id TEXT); INSERT INTO release_tasks VALUES('release');")
    const service = new TaskWorkspaceService(db), legacy = { 'forgedesk.taskList.items.v1': '[{"title":"历史任务"}]' }
    try {
      await assert.rejects(initializeTaskWorkspaceWithBackup(service, root, legacy, async () => { throw new Error('disk full') }), /disk full/)
      assert.equal((db.prepare('SELECT count(*) n FROM managed_tasks').get() as { n: number }).n, 1); assert.equal(service.ready(), false)
      await initializeTaskWorkspaceWithBackup(service, root, legacy, path => db.backup(path))
      assert.equal((db.prepare('SELECT count(*) n FROM managed_tasks').get() as { n: number }).n, 0)
      for (const table of ['projects', 'codex_sessions', 'release_tasks']) assert.equal((db.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n, 1)
      const folders = await readdir(join(root, 'backups')); let verified = false
      for (const folder of folders) { try { const backup = new Database(join(root, 'backups', folder, 'forgedesk.db'), { readonly: true }); assert.equal((backup.prepare('SELECT count(*) n FROM managed_tasks').get() as { n: number }).n, 1); backup.close(); assert.deepEqual(JSON.parse(await readFile(join(root, 'backups', folder, 'legacy-local-storage.json'), 'utf8')), legacy); verified = true } catch { /* failed backup attempt has no database */ } }
      assert.ok(verified)
      await initializeTaskWorkspaceWithBackup(service, root, legacy, async () => { throw new Error('must not back up twice') })
    } finally { db.close(); await rm(root, { recursive: true, force: true }) }
  })
  it('rolls back all cleanup when a table cannot be cleared', () => {
    const db = new Database(':memory:'); db.exec("CREATE TABLE managed_tasks(id TEXT); INSERT INTO managed_tasks VALUES('old'); CREATE TABLE project_goals(id TEXT); INSERT INTO project_goals VALUES('goal'); CREATE TRIGGER reject_goal BEFORE DELETE ON project_goals BEGIN SELECT RAISE(ABORT,'failure'); END;")
    const service = new TaskWorkspaceService(db); assert.throws(() => service.initialize('/backup'), /failure/); assert.equal(service.ready(), false); assert.equal((db.prepare('SELECT count(*) n FROM managed_tasks').get() as { n: number }).n, 1); db.close()
  })
  it('clamps monthly and yearly dates without losing the original anchor, and handles workdays and DST', () => {
    const monthly: TaskRecurrence = { unit: 'month', interval: 1, anchor: '2024-01-31', timezone: 'Asia/Shanghai' }
    assert.equal(nextTaskOccurrence(monthly, '2024-01-31', new Date('2024-02-01')), '2024-02-29')
    assert.equal(nextTaskOccurrence(monthly, '2024-02-29', new Date('2024-03-01')), '2024-03-31')
    assert.equal(nextTaskOccurrence({ ...monthly, unit: 'year', anchor: '2024-02-29' }, '2024-02-29', new Date('2025-01-01')), '2025-02-28')
    assert.equal(nextTaskOccurrence({ ...monthly, unit: 'workday', anchor: '2026-11-06' }, '2026-11-06', new Date('2026-11-06')), '2026-11-09')
    assert.equal(nextTaskOccurrence({ ...monthly, unit: 'day', anchor: '2026-03-07T14:00:00Z', timezone: 'America/New_York' }, '2026-03-07T14:00:00Z', new Date('2026-03-07T15:00:00Z')), '2026-03-08T13:00:00.000Z')
  })
})
