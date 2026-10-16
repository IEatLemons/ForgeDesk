import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createWorkspaceHistory, directoryParents, GLOBAL_DIRECTORY, globalPage, legacyRoute, PROJECT_DIRECTORY, projectPage, restoreHistory, validRoute, visitRoute } from './workspace-navigation.js'
import { APP_NAVIGATION_ITEMS } from './app-navigation.js'

describe('production workspace navigation', () => {
  it('has three primary entries and a single project directory', () => {
    assert.deepEqual(GLOBAL_DIRECTORY.filter(item=>!item.footer).map(item=>item.key), ['workbench','projects','ai'])
    assert.deepEqual(directoryParents(PROJECT_DIRECTORY,'repositories'), ['code'])
    assert.deepEqual(directoryParents(PROJECT_DIRECTORY,'tasks'), ['progress'])
    for (const page of ['password','rsa','excel','env-diff','cli-environment','docs','news','system-monitor','system-info']) assert.ok(validRoute(globalPage('toolbox',page)))
  })
  it('preserves object positioning, per-project locations, back/forward and truncates forward history', () => {
    let history = createWorkspaceHistory()
    const task = {...projectPage('p','tasks'), entityId:'task-1',view:'board'}
    history=visitRoute(history,task);history=visitRoute(history,{...globalPage('ai','sessions'),entityId:'thread-1'});history=visitRoute(history,projectPage('other'))
    assert.deepEqual(history.locations.p,task)
    history=restoreHistory(history,1);assert.deepEqual(history.entries[history.index],task)
    history=restoreHistory(history,2);assert.equal(history.entries[history.index].entityId,'thread-1')
    history=visitRoute(restoreHistory(history,1),globalPage('toolbox','rsa'));assert.equal(history.entries.length,3)
    assert.equal(visitRoute(history,history.entries[history.index]),history)
  })
  it('maps legacy navigation and rejects malformed preferences', () => {
    assert.deepEqual(legacyRoute('tasks'), globalPage('workbench','tasks'))
    assert.deepEqual(legacyRoute('projects','p'),projectPage('p'))
    assert.equal(validRoute({scope:'project',projectId:'p',page:'progress'}),false)
    assert.equal(validRoute({scope:'project',projectId:'',page:'tasks'}),false)
    assert.equal(validRoute({scope:'global',area:'unknown',page:'list'}),false)
    assert.equal(validRoute({...projectPage('p'),entityId:{secret:1}}),false)
    for(const item of APP_NAVIGATION_ITEMS)assert.ok(validRoute(legacyRoute(item.key)),`${item.key} must have a production destination`)
  })
})
