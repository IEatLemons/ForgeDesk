import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { acceptDemoTask, createDemoData, isOverdue, summarizeTasks, tasksForPlan } from './data.js'
import {
  contextOrigin, createNavigation, currentRoute, enterProject, getPageLabel, getProjectGroup, GLOBAL_AREAS,
  globalRoute, moveHistory, navigate, PROJECT_GROUPS, projectRoute, routeFromHash, routeToHash,
  type PrototypeRoute
} from './navigation.js'

describe('architecture prototype navigation', () => {
  it('keeps only three daily global entries and three secondary entries', () => {
    assert.deepEqual(GLOBAL_AREAS.filter(item => item.placement === 'main').map(item => item.label), ['工作台', '项目', 'AI 工作台'])
    assert.deepEqual(GLOBAL_AREAS.filter(item => item.placement === 'footer').map(item => item.label), ['共享资源', '工具箱', '设置'])
    assert.equal(GLOBAL_AREAS.some(item => String(item.key) === 'tasks'), false)
  })

  it('groups project functions by progress, code, runtime and configuration', () => {
    assert.deepEqual(PROJECT_GROUPS.map(item => item.label), ['进度', '代码', '运行', '项目设置'])
    assert.equal(getProjectGroup('versions')?.key, 'progress')
    assert.equal(getProjectGroup('contributions')?.key, 'code')
    assert.equal(getProjectGroup('domains')?.key, 'runtime')
    assert.equal(getProjectGroup('overview'), undefined)
    assert.equal(PROJECT_GROUPS.flatMap(item => item.children).some(item => /看板|甘特|Codex|终端/.test(item.label)), false)
  })

  it('defaults each new project to its overview and remembers the exact previous location separately', () => {
    let state = enterProject(createNavigation(), 'forgedesk')
    assert.deepEqual(currentRoute(state), projectRoute('forgedesk'))
    state = navigate(state, { scope: 'project', projectId: 'forgedesk', page: 'tasks', entityId: 'FD-101', taskTab: 'execution' })
    state = enterProject(state, 'atlas')
    assert.deepEqual(currentRoute(state), projectRoute('atlas'))
    state = navigate(state, projectRoute('atlas', 'monitoring'))
    state = enterProject(state, 'forgedesk')
    assert.equal(currentRoute(state).entityId, 'FD-101')
    state = enterProject(state, 'atlas')
    assert.deepEqual(currentRoute(state), projectRoute('atlas', 'monitoring'))
  })

  it('returns from a task to the exact filtered AI conversation', () => {
    const conversation: PrototypeRoute = { scope: 'global', area: 'ai', page: 'conversations', entityId: 'session-navigation', projectFilter: 'forgedesk' }
    let state = navigate(createNavigation(), conversation)
    state = navigate(state, projectRoute('forgedesk', 'tasks', 'FD-101'))
    state = moveHistory(state, state.index - 1)
    assert.deepEqual(currentRoute(state), conversation)
    state = moveHistory(state, state.index + 1)
    assert.equal(currentRoute(state).entityId, 'FD-101')
  })

  it('preserves the return context through task detail tabs', () => {
    const conversation: PrototypeRoute = { scope: 'global', area: 'ai', page: 'conversations', entityId: 'session-navigation', projectFilter: 'forgedesk' }
    let state = navigate(createNavigation(), conversation)
    state = navigate(state, projectRoute('forgedesk', 'tasks', 'FD-101'))
    state = navigate(state, { ...projectRoute('forgedesk', 'tasks', 'FD-101'), taskTab: 'execution' })
    state = navigate(state, { ...projectRoute('forgedesk', 'tasks', 'FD-101'), taskTab: 'history' })
    assert.deepEqual(contextOrigin(state), conversation)
  })

  it('does not add duplicate entries and truncates future entries after a new navigation', () => {
    let state = createNavigation()
    assert.equal(navigate(state, globalRoute('workbench')), state)
    state = navigate(state, globalRoute('projects'))
    state = navigate(state, projectRoute('forgedesk'))
    state = moveHistory(state, 1)
    state = navigate(state, globalRoute('toolbox'))
    assert.equal(state.entries.length, 3)
    assert.deepEqual(currentRoute(state), globalRoute('toolbox'))
    assert.equal(moveHistory(state, -1), state)
    assert.equal(moveHistory(state, 99), state)
  })

  it('round-trips all directory locations including project and object context', () => {
    const routes: PrototypeRoute[] = [
      ...GLOBAL_AREAS.flatMap(area => area.children.length ? area.children.map(child => globalRoute(area.key, child.key)) : [globalRoute(area.key)]),
      projectRoute('项目 / 研发'),
      ...PROJECT_GROUPS.flatMap(group => group.children.map(child => projectRoute('forgedesk', child.key))),
      { scope: 'project', projectId: 'forgedesk', page: 'tasks', entityId: 'FD-101', taskTab: 'history' },
      { scope: 'global', area: 'ai', page: 'conversations', entityId: 's / 1', projectFilter: 'p / 2' },
      globalRoute('workbench', 'tasks')
    ]
    for (const route of routes) assert.equal(routeToHash(routeFromHash(routeToHash(route))!), routeToHash(route))
  })

  it('rejects cross-area, malformed or nonexistent routes rather than rendering arbitrary modules', () => {
    for (const hash of ['#garbage', '#/project//tasks', '#/project/%ZZ/tasks', '#/project/p/unknown', '#/project/p/tasks?tab=delete', '#/toolbox/tasks', '#/workbench/conversations', '#/settings', '#/projects/home/extra']) assert.equal(routeFromHash(hash), undefined, hash)
  })

  it('uses precise names and keeps cross-project tasks inside the workbench', () => {
    assert.equal(getPageLabel(projectRoute('p', 'contributions')), '提交分析')
    assert.equal(getPageLabel(globalRoute('workbench', 'tasks')), '跨项目待办')
    assert.equal(getPageLabel(projectRoute('p')), '项目概览')
  })
})

describe('architecture prototype data behavior', () => {
  it('creates isolated data per preview, with no shared mutable fixtures', () => {
    const first = createDemoData()
    const second = createDemoData()
    first.tasks[0].events.push('mutation')
    first.messages['session-navigation'].push({ role: 'user', content: 'test' })
    assert.equal(second.tasks[0].events.includes('mutation'), false)
    assert.equal(second.messages['session-navigation'].length, 2)
  })

  it('does not double-count child tasks in project or goal progress', () => {
    const data = createDemoData()
    const tasks = data.tasks.filter(item => item.projectId === 'forgedesk')
    assert.deepEqual(summarizeTasks(tasks), { total: 4, done: 1, review: 1, blocked: 1, overdue: 1, percent: 25 })
    const goal = data.plans.find(item => item.id === 'g-navigation')!
    assert.equal(summarizeTasks(tasksForPlan(data.tasks, goal)).total, 4)
    const milestone = data.plans.find(item => item.id === 'm-prototype')!
    assert.equal(summarizeTasks(tasksForPlan(data.tasks, milestone)).total, 2)
  })

  it('keeps AI completion separate from business acceptance', () => {
    const data = createDemoData()
    assert.match(data.sessions[0].status, /执行已结束/)
    assert.equal(data.tasks.find(item => item.id === data.sessions[0].taskId)?.status, 'review')
    const result = acceptDemoTask(data, 'FD-101')
    assert.equal(result.error, undefined)
    assert.equal(result.data.tasks.find(item => item.id === 'FD-101')?.status, 'done')
    assert.equal(data.tasks.find(item => item.id === 'FD-101')?.status, 'review')
    assert.equal(result.data.sessions, data.sessions)
  })

  it('prevents acceptance of blocked tasks and tasks with incomplete children', () => {
    const data = createDemoData()
    data.tasks.find(item => item.id === 'FD-101-1')!.status = 'doing'
    assert.ok(acceptDemoTask(data, 'FD-101').error)
    data.tasks.find(item => item.id === 'FD-101-1')!.status = 'cancelled'
    assert.equal(acceptDemoTask(data, 'FD-101').error, undefined)
    data.tasks.find(item => item.id === 'FD-101')!.blocked = '等待授权'
    assert.ok(acceptDemoTask(data, 'FD-101').error)
    assert.ok(acceptDemoTask(data, 'FD-104').error)
    assert.ok(acceptDemoTask(data, 'missing').error)
  })

  it('supports projects with no repository, online service or AI configuration', () => {
    const data = createDemoData()
    assert.equal(data.projects.find(item => item.id === 'idea')?.repository, undefined)
    assert.equal(data.deployments.some(item => item.projectId === 'idea'), false)
    assert.deepEqual(summarizeTasks([]), { total: 0, done: 0, review: 0, blocked: 0, overdue: 0, percent: 0 })
    assert.ok(data.tasks.some(item => !item.projectId))
    assert.equal(data.sessions.find(item => item.tool === '通用助手')?.taskId, undefined)
  })

  it('does not mark completed or cancelled items overdue', () => {
    const task = createDemoData().tasks.find(item => item.id === 'FD-103')!
    assert.equal(isOverdue(task), true)
    assert.equal(isOverdue({ ...task, status: 'done' }), false)
    assert.equal(isOverdue({ ...task, status: 'cancelled' }), false)
  })

  it('does not leak tasks across project boundaries even with a reused plan id', () => {
    const data = createDemoData()
    data.tasks.push({ ...data.tasks[0], id: 'cross-project', projectId: 'atlas' })
    assert.equal(tasksForPlan(data.tasks, data.plans[0]).some(item => item.id === 'cross-project'), false)
  })
})

describe('prototype isolation boundary', () => {
  const root = resolve(process.cwd(), 'src/renderer/src/architecture-prototype')
  const productionImports = /(?:from\s*|import\s*)['"](?:\.\.\/|@\/|[^'"]*(?:store|preload|project-progress-panel|App)['"])/
  it('uses an independent HTML entry and never mounts the production app', () => {
    const html = readFileSync(resolve(root, '../../architecture.html'), 'utf8')
    assert.match(html, /architecture-prototype\/entry\.tsx/)
    assert.doesNotMatch(html, /src\/main\.tsx/)
    const entry = readFileSync(resolve(root, 'entry.tsx'), 'utf8')
    assert.doesNotMatch(entry, /\.\/App|\.\.\/app-theme|localStorage/)
    const config = readFileSync(resolve(process.cwd(), 'vite.prototype.config.ts'), 'utf8')
    assert.doesNotMatch(config, /from ['"]electron-vite|preload:/)
  })

  it('has no bridge, storage, network or process calls in the prototype module graph', () => {
    for (const file of ['entry.tsx', 'prototype-app.tsx', 'context.tsx', 'ui.tsx', 'workspace-pages.tsx', 'progress-pages.tsx', 'data.ts', 'navigation.ts']) {
      const source = readFileSync(resolve(root, file), 'utf8')
      assert.doesNotMatch(source, /(?:window\.)?forgeDesk\s*[.(]|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\blocalStorage\s*[.[]|\bsessionStorage\s*[.[]|\bchild_process\b|\bnode:fs\b/, file)
      assert.doesNotMatch(source, productionImports, file)
    }
  })
})
