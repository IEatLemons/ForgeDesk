import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapSqliteProjects, mapSqliteRepositories } from './cli-sqlite.js'

describe('forgedesk cli sqlite helpers', () => {
  it('maps sqlite json rows into CLI project rows', () => {
    assert.deepEqual(
      mapSqliteProjects('[{"id":"p1","name":"CardPIE","workspace_path":"/Users/stone/Dev/uka"}]'),
      [{ id: 'p1', name: 'CardPIE', workspacePath: '/Users/stone/Dev/uka' }]
    )
    assert.deepEqual(mapSqliteProjects(''), [])
  })

  it('maps sqlite json rows into CLI repository rows', () => {
    assert.deepEqual(
      mapSqliteRepositories('[{"id":"r1","name":"uka","project_id":"p1","local_path":"/Users/stone/Dev/uka","current_branch":"main"}]'),
      [{ id: 'r1', name: 'uka', projectId: 'p1', localPath: '/Users/stone/Dev/uka', currentBranch: 'main' }]
    )
    assert.deepEqual(mapSqliteRepositories('[]'), [])
  })
})
