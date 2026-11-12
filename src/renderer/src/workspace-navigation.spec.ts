import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createWorkspaceHistory, normalizeWorkspaceRoute, directoryParents, GLOBAL_DIRECTORY, globalPage, legacyRoute, PROJECT_DIRECTORY, projectPage, restoreHistory, validRoute, visitRoute } from './workspace-navigation.js'
import { APP_NAVIGATION_ITEMS } from './app-navigation.js'

describe('production workspace navigation', () => {
  it('has a direct overview and separate project and task entries', () => {
    const primary = GLOBAL_DIRECTORY.filter(item => !item.footer)
    assert.deepEqual(primary.map(item => item.label), ['概览', '项目', '任务', 'AI 工作台'])
    assert.equal(primary[0].children, undefined)
    assert.deepEqual(directoryParents(PROJECT_DIRECTORY,'repositories'), ['code'])
    assert.deepEqual(directoryParents(PROJECT_DIRECTORY,'tasks'), [])
    assert.ok(validRoute({ ...globalPage('tasks'), taskScope: 'mine' }))
    assert.ok(validRoute({ ...projectPage('p', 'tasks'), entityId: 'task-1' }))
    for (const page of ['password','rsa','excel','env-diff','cli-environment','docs','news','system-monitor','system-info']) assert.ok(validRoute(globalPage('toolbox',page)))
  })
  it('preserves object positioning, per-project locations, back/forward and truncates forward history', () => {
    let history = createWorkspaceHistory()
    const task = {...projectPage('p','repositories'), entityId:'repository-1',view:'history'}
    history=visitRoute(history,task);history=visitRoute(history,{...globalPage('ai','sessions'),entityId:'thread-1'});history=visitRoute(history,projectPage('other'))
    assert.deepEqual(history.locations.p,task)
    history=restoreHistory(history,1);assert.deepEqual(history.entries[history.index],task)
    history=restoreHistory(history,2);assert.equal(history.entries[history.index].entityId,'thread-1')
    history=visitRoute(restoreHistory(history,1),globalPage('toolbox','rsa'));assert.equal(history.entries.length,3)
    assert.equal(visitRoute(history,history.entries[history.index]),history)
  })
  it('maps legacy navigation and rejects malformed preferences', () => {
    assert.deepEqual(legacyRoute('tasks'), globalPage('tasks'))
    assert.deepEqual(legacyRoute('projects','p'),projectPage('p'))
    assert.equal(validRoute({scope:'project',projectId:'p',page:'progress'}),false)
    assert.equal(validRoute({scope:'project',projectId:'',page:'tasks'}),false)
    assert.equal(validRoute({scope:'global',area:'unknown',page:'list'}),false)
    assert.equal(validRoute({...projectPage('p'),entityId:{secret:1}}),false)
    for(const item of APP_NAVIGATION_ITEMS)assert.ok(validRoute(legacyRoute(item.key)),`${item.key} must have a production destination`)
  })
  it('retired progress links fall back while local tasks keep their own location', () => {
    for (const page of ['goals', 'milestones', 'versions'] as const) {
      const old = projectPage('p', page)
      assert.equal(validRoute(old), false)
      assert.deepEqual(normalizeWorkspaceRoute(old), projectPage('p'))
    }
    assert.deepEqual(normalizeWorkspaceRoute(globalPage('settings', 'migration')), globalPage('tasks'))
    const tasks = { ...globalPage('tasks'), taskScope: 'list-1', entityId: 'task-1' }
    assert.deepEqual(normalizeWorkspaceRoute({ ...tasks, ...globalPage('workbench', 'tasks') }), tasks)
    assert.ok(validRoute(tasks))
    const history = visitRoute(visitRoute(createWorkspaceHistory(), tasks), globalPage('ai', 'sessions'))
    assert.deepEqual(restoreHistory(history, 1).entries[1], tasks)
  })
})
