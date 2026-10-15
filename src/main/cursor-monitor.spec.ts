import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it } from 'node:test'
import { migrateAiProjectResourceLinkTables } from './ai-project-resource-links.js'
import { migrateCodexProjectMonitorTables, type CodexGitWorkspaceState } from './codex-project-monitor.js'
import { CursorMonitorService, discoverCursorWorkspaces, type CursorAgentProcess } from './cursor-monitor.js'

function database(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, group_id TEXT, workspace_path TEXT, created_at TEXT, updated_at TEXT)')
  migrateCodexProjectMonitorTables(db as any)
  migrateAiProjectResourceLinkTables(db as any)
  return db
}

function git(cwd: string, dirty: boolean): CodexGitWorkspaceState {
  return { cwd, repositoryRoot: cwd, branch: 'main', additions: dirty ? 4 : 0, deletions: dirty ? 1 : 0, filesChanged: dirty ? 2 : 0, hasChanges: dirty, repositoryAvailable: true, checkedAt: '2026-09-17T00:00:00.000Z' }
}

describe('Cursor monitor', () => {
  it('discovers local workspaces and ignores remote folders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-cursor-'))
    await mkdir(join(root, 'local'))
    await mkdir(join(root, 'remote'))
    await writeFile(join(root, 'local', 'workspace.json'), JSON.stringify({ folder: 'file:///tmp/cursor%20project' }))
    await writeFile(join(root, 'remote', 'workspace.json'), JSON.stringify({ folder: 'vscode-remote://ssh-remote%2Bhost/workspace' }))
    const workspaces = await discoverCursorWorkspaces(root)
    assert.equal(workspaces.length, 1)
    assert.equal(workspaces[0]?.path, '/tmp/cursor project')
  })

  it('creates one alert when an Agent ends with dirty Git and resolves it after commit', async () => {
    const db = database()
    const cwd = '/tmp/cursor-project'
    db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)').run('project-1', 'Cursor 项目', null, cwd, 'now', 'now')
    let agents: CursorAgentProcess[] = [{ pid: 10, cwd, command: 'cursor-agent --print' }]
    let dirty = true
    const alerts: string[] = []
    const service = new CursorMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [{ id: 'project-1', name: 'Cursor 项目', workspacePath: cwd, groupId: null }],
      listWorkspaces: async () => [{ path: cwd, updatedAt: '2026-09-17T00:00:00.000Z', workspaceId: 'workspace-1' }],
      listAgents: async () => agents,
      inspectGit: async (path) => git(path, dirty),
      onAlert: (alert) => alerts.push(alert.id)
    })

    await service.snapshot()
    agents = []
    const ended = await service.snapshot()
    const repeated = await service.snapshot()
    assert.equal(ended.uncommitted, 1)
    assert.equal(repeated.uncommitted, 1)
    assert.equal(alerts.length, 1)
    dirty = false
    const clean = await service.snapshot()
    assert.equal(clean.uncommitted, 0)
  })

  it('prefers an explicit Cursor project binding over automatic matching', async () => {
    const db = database()
    const cwd = '/tmp/cursor/nested'
    db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)').run('auto', '自动项目', null, '/tmp/cursor', 'now', 'now')
    db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)').run('manual', '手动项目', null, '/tmp/elsewhere', 'now', 'now')
    db.prepare('INSERT INTO ai_project_resource_links VALUES (?, ?, ?, ?, ?, ?)').run('cursor', cwd, cwd, 'manual', 'now', 'now')
    const snapshot = await new CursorMonitorService({
      db: () => db as any,
      listGroups: () => [],
      listProjects: () => [
        { id: 'auto', name: '自动项目', workspacePath: '/tmp/cursor', groupId: null },
        { id: 'manual', name: '手动项目', workspacePath: '/tmp/elsewhere', groupId: null }
      ],
      listWorkspaces: async () => [{ path: cwd, updatedAt: 'now', workspaceId: 'workspace-1' }],
      listAgents: async () => [],
      inspectGit: async (path) => ({ ...git(path, false), repositoryAvailable: false })
    }).snapshot()
    assert.equal(snapshot.projects[0]?.forgeProjectId, 'manual')
  })
})
