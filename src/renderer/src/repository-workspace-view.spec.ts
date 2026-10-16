import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Repository } from './data'
import { getRepositoryDirectoryRows, getRepositoryView, REPOSITORY_VIEWS } from './repository-workspace-view.js'

function repository(id: string, input: Partial<Repository> = {}): Repository {
  return { id, name: id, localPath: `/workspace/${id}`, parentRepositoryId: '', repositoryKind: 'root', relativePath: '', currentBranch: 'main', available: true, ...input } as Repository
}

describe('repository workspace presentation', () => {
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
