import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  CodexProjectMonitorService,
  findAutomaticCodexProjectId,
  migrateCodexProjectMonitorTables,
  parseGitWorktreeList,
  saveCodexProjectLink,
  type CodexGitWorkspaceState,
  type MonitorProjectRecord
} from './codex-project-monitor.js'
import { migrateAiProjectResourceLinkTables, saveAiProjectResourceLink } from './ai-project-resource-links.js'
import type { CodexSessionsSnapshot } from './codex-sessions.js'

function createDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_id TEXT,
      workspace_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  migrateCodexProjectMonitorTables(db as any)
  migrateAiProjectResourceLinkTables(db as any)
  return db
}

function sessionSnapshot(): CodexSessionsSnapshot {
  const session = {
    archived: false,
    createdAt: '2026-08-13T08:00:00.000Z',
    cwd: '/tmp/workspace/packages/app',
    filePath: '/tmp/session.jsonl',
    id: 'session-1',
    lastEvent: 'task_complete',
    pinned: false,
    preview: '修复 App',
    projectKey: '/tmp/workspace/packages/app',
    projectName: 'app',
    status: 'completed' as const,
    title: '修复 App',
    updatedAt: '2026-08-13T08:05:00.000Z'
  }
  return {
    aborted: 0,
    available: true,
    checkedAt: '2026-08-13T08:05:00.000Z',
    completed: 1,
    error: '',
    projects: [{ cwd: session.cwd, key: session.projectKey, name: session.projectName, runningCount: 0, sessionCount: 1, updatedAt: session.updatedAt }],
    running: 0,
    sessions: [session],
    source: '/tmp/codex'
  }
}

function gitState(hasChanges: boolean): CodexGitWorkspaceState {
  return {
    additions: hasChanges ? 3 : 0,
    branch: 'main',
    checkedAt: '2026-08-13T08:06:00.000Z',
    cwd: '/tmp/workspace/packages/app',
    deletions: hasChanges ? 1 : 0,
    filesChanged: hasChanges ? 2 : 0,
    hasChanges,
    repositoryAvailable: true,
    repositoryRoot: '/tmp/workspace'
  }
}

describe('Codex project monitor', () => {
  it('parses named and detached Git worktrees', () => {
    assert.deepEqual(parseGitWorktreeList([
      'worktree /tmp/repo',
      'HEAD abcdef',
      'branch refs/heads/main',
      '',
      'worktree /tmp/codex-worktree',
      'HEAD 123456',
      'detached',
      ''
    ].join('\n')), [
      { path: '/tmp/repo', head: 'abcdef', branch: 'main', detached: false },
      { path: '/tmp/codex-worktree', head: '123456', branch: '', detached: true }
    ])
  })

  it('chooses the most specific automatic project match', () => {
    const projects: MonitorProjectRecord[] = [
      { groupId: null, id: 'root', name: 'Root', workspacePath: '/tmp/workspace' },
      { groupId: null, id: 'nested', name: 'Nested', repositoryPaths: ['/tmp/workspace/packages/app'], workspacePath: '/tmp/unrelated' }
    ]
    assert.equal(findAutomaticCodexProjectId('/tmp/workspace/packages/app/src', projects), 'nested')
  })

  it('aggregates native sessions and built-in tasks from the same workspace', async () => {
    const db = createDatabase()
    const task = {
      accountId: '',
      additions: 0,
      branch: 'main',
      createdAt: '2026-08-13T08:01:00.000Z',
      cwd: '/tmp/workspace/packages/app',
      deletions: 0,
      environment: {
        additions: 0,
        branch: 'main',
        checkedAt: '2026-08-13T08:06:00.000Z',
        cwd: '/tmp/workspace/packages/app',
        deletions: 0,
        filesChanged: 0,
        hasChanges: false,
        repositoryAvailable: true
      },
      errorMessage: '',
      filesChanged: 0,
      finishedAt: '2026-08-13T08:06:00.000Z',
      id: 'task-1',
      messages: [],
      model: '',
      projectId: 'project-a',
      runLog: '',
      status: 'succeeded' as const,
      title: '内置任务',
      updatedAt: '2026-08-13T08:06:00.000Z'
    }
    db.prepare('INSERT INTO projects (id, name, group_id, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('project-a', 'ForgeDesk', null, '/tmp/workspace', '2026-08-13', '2026-08-13')
    const service = new CodexProjectMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [{ groupId: null, id: 'project-a', name: 'ForgeDesk', workspacePath: '/tmp/workspace' }],
      listSessions: async () => sessionSnapshot(),
      listTasks: () => [task],
      inspectGit: async () => gitState(false)
    })

    const snapshot = await service.snapshot()
    assert.equal(snapshot.projects.length, 1)
    assert.equal(snapshot.projects[0]?.sessionCount, 1)
    assert.equal(snapshot.projects[0]?.tasks.length, 1)
    assert.equal(snapshot.projects[0]?.completedCount, 2)
  })

  it('marks aborted execution as attention even when the workspace is clean', async () => {
    const db = createDatabase()
    db.prepare('INSERT INTO projects (id, name, group_id, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('project-a', 'ForgeDesk', null, '/tmp/workspace', '2026-08-13', '2026-08-13')
    const completed = sessionSnapshot().sessions[0]
    const service = new CodexProjectMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [{ groupId: null, id: 'project-a', name: 'ForgeDesk', workspacePath: '/tmp/workspace' }],
      listSessions: async () => ({ ...sessionSnapshot(), aborted: 1, completed: 0, sessions: [{ ...completed, lastEvent: 'turn_aborted', status: 'aborted' }] }),
      listTasks: () => [],
      inspectGit: async () => gitState(false)
    })

    const snapshot = await service.snapshot()
    assert.equal(snapshot.projects[0]?.status, 'attention')
  })

  it('creates one alert for dirty completed work and resolves it after commit', async () => {
    const db = createDatabase()
    db.prepare('INSERT INTO projects (id, name, group_id, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('project-a', 'ForgeDesk', null, '/tmp/workspace', '2026-08-13', '2026-08-13')
    const alerts: string[] = []
    let dirty = true
    const service = new CodexProjectMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [{ groupId: null, id: 'project-a', name: 'ForgeDesk', workspacePath: '/tmp/workspace' }],
      listSessions: async () => sessionSnapshot(),
      listTasks: () => [],
      inspectGit: async () => gitState(dirty),
      onAlert: (alert) => alerts.push(alert.id)
    })

    const first = await service.snapshot()
    const second = await service.snapshot()
    assert.equal(first.uncommitted, 1)
    assert.equal(second.uncommitted, 1)
    assert.equal(alerts.length, 1)

    dirty = false
    const clean = await service.snapshot()
    assert.equal(clean.uncommitted, 0)
    assert.equal(clean.projects[0]?.openAlert, null)
  })

  it('lets a manual unlinked mapping override automatic matching', async () => {
    const db = createDatabase()
    db.prepare('INSERT INTO projects (id, name, group_id, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('project-a', 'ForgeDesk', null, '/tmp/workspace', '2026-08-13', '2026-08-13')
    saveCodexProjectLink(db as any, { cwd: '/tmp/workspace/packages/app', projectId: null })
    const service = new CodexProjectMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [{ groupId: null, id: 'project-a', name: 'ForgeDesk', workspacePath: '/tmp/workspace' }],
      listSessions: async () => sessionSnapshot(),
      listTasks: () => [],
      inspectGit: async () => ({ ...gitState(false), repositoryAvailable: false })
    })

    const snapshot = await service.snapshot()
    assert.equal(snapshot.projects[0]?.forgeProjectId, null)
    assert.equal(snapshot.projects[0]?.linkSource, 'unlinked')
  })

  it('keeps a manually bound non-Git path visible before its first Codex session', async () => {
    const db = createDatabase()
    db.prepare('INSERT INTO projects (id, name, group_id, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('project-a', 'ForgeDesk', null, '/tmp/workspace', '2026-08-13', '2026-08-13')
    saveAiProjectResourceLink(db as any, { providerId: 'codex', projectId: 'project-a', resourcePath: '/tmp/manual-only' })
    const service = new CodexProjectMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [{ groupId: null, id: 'project-a', name: 'ForgeDesk', workspacePath: '/tmp/workspace' }],
      listSessions: async () => ({ ...sessionSnapshot(), available: false, projects: [], sessions: [] }),
      listTasks: () => [],
      inspectGit: async () => ({ ...gitState(false), cwd: '/tmp/manual-only', repositoryAvailable: false })
    })

    const snapshot = await service.snapshot()
    assert.equal(snapshot.available, true)
    assert.equal(snapshot.projects[0]?.cwd, '/tmp/manual-only')
    assert.equal(snapshot.projects[0]?.forgeProjectId, 'project-a')
    assert.equal(snapshot.projects[0]?.worktrees.length, 0)
  })

  it('discovers every native Codex CWD without a ForgeDesk-project filter', async () => {
    const db = createDatabase()
    const base = sessionSnapshot().sessions[0]
    const sessions = Array.from({ length: 55 }, (_, index) => ({
      ...base,
      cwd: `/tmp/codex-project-${index}`,
      id: `session-${index}`,
      projectKey: `/tmp/codex-project-${index}`,
      projectName: `codex-project-${index}`,
      status: index === 0 ? ('running' as const) : ('completed' as const),
      title: `任务 ${index}`
    }))
    const service = new CodexProjectMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [],
      listSessions: async () => ({ ...sessionSnapshot(), projects: [], sessions }),
      listTasks: () => [],
      inspectGit: async (cwd) => ({ ...gitState(false), cwd, repositoryAvailable: false }),
      inspectWorktrees: async () => []
    })

    const snapshot = await service.snapshot()
    assert.equal(snapshot.projects.length, 55)
    assert.equal(snapshot.unlinked, 55)
    assert.equal(snapshot.running, 1)
  })

  it('inherits a bound worktree owner unless the exact Codex path is bound', async () => {
    const db = createDatabase()
    for (const [id, name] of [['project-a', 'A'], ['project-b', 'B']]) {
      db.prepare('INSERT INTO projects (id, name, group_id, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, null, '/tmp/workspace', '2026-08-13', '2026-08-13')
    }
    saveAiProjectResourceLink(db as any, { providerId: 'codex', projectId: 'project-b', resourcePath: '/tmp/workspace/worktree-b' })
    const baseOptions = {
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [
        { groupId: null, id: 'project-a', name: 'A', workspacePath: '/tmp/a' },
        { groupId: null, id: 'project-b', name: 'B', workspacePath: '/tmp/b' }
      ],
      listSessions: async () => ({ ...sessionSnapshot(), sessions: [{ ...sessionSnapshot().sessions[0], cwd: '/tmp/workspace/worktree-a', projectKey: '/tmp/workspace/worktree-a' }] }),
      listTasks: () => [],
      inspectGit: async () => ({ ...gitState(false), cwd: '/tmp/workspace/worktree-a' }),
      inspectWorktrees: async () => [
        { path: '/tmp/workspace/worktree-a', branch: 'main', head: 'aaa', detached: false, isMain: true, git: gitState(false), sessionIds: [], taskIds: [] },
        { path: '/tmp/workspace/worktree-b', branch: 'feature', head: 'bbb', detached: false, isMain: false, git: gitState(false), sessionIds: [], taskIds: [] }
      ]
    }
    const inherited = await new CodexProjectMonitorService(baseOptions).snapshot()
    assert.equal(inherited.projects[0]?.forgeProjectId, 'project-b')

    saveAiProjectResourceLink(db as any, { providerId: 'codex', projectId: 'project-a', resourcePath: '/tmp/workspace/worktree-a' })
    const exact = await new CodexProjectMonitorService(baseOptions).snapshot()
    assert.equal(exact.projects[0]?.forgeProjectId, 'project-a')
    assert.deepEqual(exact.projects[0]?.worktrees[0]?.sessionIds, ['session-1'])
  })
})
