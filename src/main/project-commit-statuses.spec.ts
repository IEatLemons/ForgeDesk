import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import Database from 'better-sqlite3'
import {
  assertCommitLifecycleEditable,
  getProjectCommitStatusConfig,
  listRepositoryCommitTestStatuses,
  matchesLifecycleBranchRef,
  migrateProjectCommitStatusTables,
  resolveCommitLifecycle,
  saveProjectCommitStatusConfig,
  saveRepositoryCommitTestStatus
} from './project-commit-statuses.js'

function createDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    CREATE TABLE repositories (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
    INSERT INTO projects (id) VALUES ('project-a');
    INSERT INTO repositories (id, project_id) VALUES ('repository-a', 'project-a');
  `)
  migrateProjectCommitStatusTables(db)
  return db
}

describe('project commit statuses', () => {
  it('uses develop by default and saves the configured test branch', () => {
    const db = createDatabase()
    assert.equal(getProjectCommitStatusConfig(db, 'project-a').testBranchName, 'develop')
    assert.equal(saveProjectCommitStatusConfig(db, { projectId: 'project-a', testBranchName: 'release/test' }).testBranchName, 'release/test')
  })

  it('persists one manual test result per repository and commit hash', () => {
    const db = createDatabase()
    saveRepositoryCommitTestStatus(db, { repositoryId: 'repository-a', commitHash: 'a'.repeat(40), status: 'passed' })
    saveRepositoryCommitTestStatus(db, { repositoryId: 'repository-a', commitHash: 'a'.repeat(40), status: 'failed' })
    const statuses = listRepositoryCommitTestStatuses(db, 'repository-a', ['a'.repeat(40)])
    assert.equal(statuses.size, 1)
    assert.equal(statuses.get('a'.repeat(40))?.status, 'failed')
  })

  it('gives main precedence over test results and only allows edits in testing', () => {
    assert.deepEqual(resolveCommitLifecycle({ inMain: false, inTestBranch: false }), { status: 'pending-test', source: 'pending-test', editable: false })
    assert.deepEqual(resolveCommitLifecycle({ inMain: false, inTestBranch: true }), { status: 'testing', source: 'testing-branch', editable: true })
    assert.deepEqual(resolveCommitLifecycle({ inMain: false, inTestBranch: true, manualStatus: 'passed' }), { status: 'test-passed', source: 'manual-test-result', editable: true })
    assert.deepEqual(resolveCommitLifecycle({ inMain: false, inTestBranch: true, manualStatus: 'failed' }), { status: 'test-failed', source: 'manual-test-result', editable: true })
    assert.deepEqual(resolveCommitLifecycle({ inMain: true, inTestBranch: true, manualStatus: 'failed' }), { status: 'online', source: 'main', editable: false })
    assert.throws(() => assertCommitLifecycleEditable(resolveCommitLifecycle({ inMain: true, inTestBranch: true }), 'develop'), /已上线/)
    assert.throws(() => assertCommitLifecycleEditable(resolveCommitLifecycle({ inMain: false, inTestBranch: false }), 'develop'), /尚未合入测试分支/)
  })

  it('matches local and remote refs for the configured test branch only', () => {
    assert.equal(matchesLifecycleBranchRef('refs/heads/develop', 'develop'), true)
    assert.equal(matchesLifecycleBranchRef('refs/remotes/origin/develop', 'develop'), true)
    assert.equal(matchesLifecycleBranchRef('refs/remotes/company/release/test', 'release/test'), true)
    assert.equal(matchesLifecycleBranchRef('refs/remotes/origin/main', 'develop'), false)
  })
})
