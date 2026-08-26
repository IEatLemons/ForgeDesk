import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import Database from 'better-sqlite3'
import {
  assertCommitLifecycleEditable,
  getProjectCommitStatusConfig,
  listRepositoryCommitTestStatuses,
  matchesLifecycleRemoteBranchRef,
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
  it('uses origin/develop by default and saves the configured remotes and test branch', () => {
    const db = createDatabase()
    assert.deepEqual(getProjectCommitStatusConfig(db, 'project-a'), {
      projectId: 'project-a',
      testBranchName: 'develop',
      testRemoteName: 'origin',
      productionRemoteName: 'origin'
    })
    assert.deepEqual(saveProjectCommitStatusConfig(db, {
      projectId: 'project-a',
      testBranchName: 'release/test',
      testRemoteName: 'company',
      productionRemoteName: 'deploy'
    }), {
      projectId: 'project-a',
      testBranchName: 'release/test',
      testRemoteName: 'company',
      productionRemoteName: 'deploy'
    })
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
    assert.deepEqual(resolveCommitLifecycle({ inProductionRemote: false, inTestRemoteBranch: false }), { status: 'pending-test', source: 'pending-test', editable: false })
    assert.deepEqual(resolveCommitLifecycle({ inProductionRemote: false, inTestRemoteBranch: true }), { status: 'testing', source: 'testing-remote-branch', editable: true })
    assert.deepEqual(resolveCommitLifecycle({ inProductionRemote: false, inTestRemoteBranch: true, manualStatus: 'passed' }), { status: 'test-passed', source: 'manual-test-result', editable: true })
    assert.deepEqual(resolveCommitLifecycle({ inProductionRemote: false, inTestRemoteBranch: true, manualStatus: 'failed' }), { status: 'test-failed', source: 'manual-test-result', editable: true })
    assert.deepEqual(resolveCommitLifecycle({ inProductionRemote: true, inTestRemoteBranch: true, manualStatus: 'failed' }), { status: 'online', source: 'production-remote', editable: false })
    assert.throws(() => assertCommitLifecycleEditable(resolveCommitLifecycle({ inProductionRemote: true, inTestRemoteBranch: true }), 'origin', 'develop'), /已上线/)
    assert.throws(() => assertCommitLifecycleEditable(resolveCommitLifecycle({ inProductionRemote: false, inTestRemoteBranch: false }), 'origin', 'develop'), /尚未合入测试远端 origin\/develop/)
  })

  it('matches only the configured remote tracking ref', () => {
    assert.equal(matchesLifecycleRemoteBranchRef('refs/heads/develop', 'origin', 'develop'), false)
    assert.equal(matchesLifecycleRemoteBranchRef('refs/remotes/origin/develop', 'origin', 'develop'), true)
    assert.equal(matchesLifecycleRemoteBranchRef('refs/remotes/company/release/test', 'company', 'release/test'), true)
    assert.equal(matchesLifecycleRemoteBranchRef('refs/remotes/company/develop', 'origin', 'develop'), false)
    assert.equal(matchesLifecycleRemoteBranchRef('refs/remotes/origin/main', 'origin', 'develop'), false)
  })

  it('migrates legacy configuration rows to origin remotes', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE projects (id TEXT PRIMARY KEY);
      CREATE TABLE repositories (id TEXT PRIMARY KEY, project_id TEXT NOT NULL);
      CREATE TABLE project_commit_status_configs (
        project_id TEXT PRIMARY KEY,
        test_branch_name TEXT NOT NULL DEFAULT 'develop',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO projects (id) VALUES ('project-a');
      INSERT INTO project_commit_status_configs (project_id, test_branch_name, created_at, updated_at)
      VALUES ('project-a', 'staging', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `)
    migrateProjectCommitStatusTables(db)
    assert.deepEqual(getProjectCommitStatusConfig(db, 'project-a'), {
      projectId: 'project-a',
      testBranchName: 'staging',
      testRemoteName: 'origin',
      productionRemoteName: 'origin'
    })
  })
})
