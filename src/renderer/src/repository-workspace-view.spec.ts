import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createWorkspaceHistory, projectPage, restoreHistory, visitRoute } from './workspace-navigation.js'
import type { Repository } from './data'
import { getRepositoryDirectoryRows, getRepositoryView, resolveRepositoryLanding, REPOSITORY_VIEWS } from './repository-workspace-view.js'

function repository(id: string, input: Partial<Repository> = {}): Repository {
  return { id, name: id, localPath: `/workspace/${id}`, parentRepositoryId: '', repositoryKind: 'root', relativePath: '', currentBranch: 'main', available: true, ...input } as Repository
}

describe('repository workspace presentation', () => {
  it('opens the only project-owned repository directly, including its unavailable warning', () => {
    const route = projectPage('p', 'repositories'), only = repository('r', { projectId: 'p' })
    assert.deepEqual(resolveRepositoryLanding(route, [only, repository('foreign', { projectId: 'other' })]), { ...route, repositoryId: 'r', view: 'history' })
    assert.equal(resolveRepositoryLanding(route, [{ ...only, available: false }]).scope, 'project')
    assert.deepEqual(resolveRepositoryLanding({ ...route, view: 'branches' }, [only]), { ...route, repositoryId: 'r', view: 'branches' })
  })
  it('retains empty and multi-repository directories, explicit selections and list visits', () => {
    const route = projectPage('p', 'repositories'), only = repository('r', { projectId: 'p' })
    assert.equal(resolveRepositoryLanding(route, []), route)
    assert.equal(resolveRepositoryLanding(route, [only, repository('child', { projectId: 'p', parentRepositoryId: 'r' })]), route)
    const directory = { ...route, view: 'directory' }, selected = { ...route, repositoryId: 'explicit' }
    assert.equal(resolveRepositoryLanding(directory, [only]), directory)
    assert.equal(resolveRepositoryLanding(selected, [only]), selected)
    const tasks = projectPage('p', 'tasks')
    assert.equal(resolveRepositoryLanding(tasks, [only]), tasks)
  })
  it('handles late scans and browser back/forward without redirect loops or extra entries', () => {
    const only = repository('r', { projectId: 'p' }), entry = projectPage('p', 'repositories')
    let history = visitRoute(createWorkspaceHistory(projectPage('p')), entry)
    assert.equal(resolveRepositoryLanding(history.entries[history.index], []), entry)
    assert.equal((resolveRepositoryLanding(history.entries[history.index], [only]) as ReturnType<typeof projectPage>).repositoryId, 'r')
    assert.equal(history.entries.length, 2)
    history = visitRoute(history, { ...entry, view: 'directory' })
    assert.equal((resolveRepositoryLanding(history.entries[history.index], [only]) as ReturnType<typeof projectPage>).repositoryId, undefined)
    history = restoreHistory(history, 1)
    assert.equal((resolveRepositoryLanding(history.entries[history.index], [only]) as ReturnType<typeof projectPage>).repositoryId, 'r')
    history = restoreHistory(history, 2)
    assert.equal(resolveRepositoryLanding(history.entries[history.index], [only]).view, 'directory')
  })
  it('defaults to the commit tree and keeps all existing Git views reachable', () => {
    assert.equal(getRepositoryView(), 'history')
    assert.equal(getRepositoryView('unknown'), 'history')
    assert.deepEqual(REPOSITORY_VIEWS.map(item => item.key), ['history','changes','branches','alignment'])
    for (const view of REPOSITORY_VIEWS) assert.equal(getRepositoryView(view.key), view.key)
  })
  it('keeps root, nested and unavailable repositories in their hierarchy', () => {
    const root = repository('root')
    const child = repository('child', { parentRepositoryId: 'root', relativePath: 'deps/child', repositoryKind: 'submodule', available: false })
    assert.deepEqual(getRepositoryDirectoryRows([child,root], '').map(item => [item.repository.id,item.depth]), [['root',0],['child',1]])
    assert.equal(getRepositoryDirectoryRows([child,root], '')[1].repository.available, false)
  })
  it('searches names, local paths and branches without losing repository identity', () => {
    const repos = [repository('api', { currentBranch:'Feature/Cleanup' }),repository('web')]
    for (const query of [' API ', '/workspace/API', 'cleanup']) assert.deepEqual(getRepositoryDirectoryRows(repos, query).map(item=>item.repository.id), ['api'])
    assert.deepEqual(getRepositoryDirectoryRows(repos, 'missing'), [])
    assert.equal(getRepositoryDirectoryRows(repos, 'api')[0].repository, repos[0])
  })
})
