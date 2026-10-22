import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CodexProjectMonitorItem, CodexProjectMonitorSnapshot, CodexSessionSummary, CodexUncommittedAlert, CodexWorktree } from './data'
import { filterCodexMonitorSnapshot, getCodexSessionWorkspace } from './codex-session-view.js'

function session(id: string, cwd: string): CodexSessionSummary {
  return { id, cwd, projectKey: cwd, projectName: id, title: id, filePath: '', preview: '', lastEvent: '', status: 'completed', archived: false, pinned: false, createdAt: '', updatedAt: '' }
}

function project(key: string, forgeProjectId: string | null, overrides: Partial<CodexProjectMonitorItem> = {}): CodexProjectMonitorItem {
  return {
    providerId: 'codex', key, cwd: key, forgeProjectId, forgeProjectName: forgeProjectId || '', groupId: null, groupName: '', linkSource: 'auto',
    sessionCount: 1, runningCount: 0, completedCount: 1, failedCount: 0, sessions: [session(key, key)], tasks: [], worktrees: [], regularSessionIds: [key], regularTaskIds: [],
    git: { cwd: key, repositoryRoot: key, branch: 'main', repositoryAvailable: true, checkedAt: '', filesChanged: 0, hasChanges: false, additions: 0, deletions: 0 },
    status: 'completed', openAlert: null, ...overrides
  }
}

function alert(item: CodexProjectMonitorItem): CodexUncommittedAlert {
  return {
    id: `${item.providerId}:${item.key}`, providerId: item.providerId, codexKey: item.key, cwd: item.cwd, projectId: item.forgeProjectId,
    sourceType: 'session', sourceId: item.sessions[0]?.id || '', completionMarker: '', projectName: '', completedAt: '', detectedAt: '', branch: '',
    additions: 0, deletions: 0, filesChanged: 1, status: 'open', resolvedAt: null, notifiedAt: null
  }
}

function snapshot(items: CodexProjectMonitorItem[], cursorItems: CodexProjectMonitorItem[] = []): CodexProjectMonitorSnapshot {
  return {
    available: true, checkedAt: '', error: '', source: '', projects: items, groups: [], alerts: [...items, ...cursorItems].map(alert),
    running: 99, uncommitted: 99, unlinked: 99, completed: 99, failed: 99, sessions: items.flatMap((item) => item.sessions),
    cursor: { available: true, checkedAt: '', error: '', source: '', projects: cursorItems, alerts: cursorItems.map(alert), running: 99, uncommitted: 99, unlinked: 99, completed: 99, failed: 99 }
  }
}

function worktree(path: string, overrides: Partial<CodexWorktree> = {}): CodexWorktree {
  return { path, branch: 'feature/work', head: '1234567890abcdef', detached: false, isMain: false, git: project(path, null).git, sessionIds: [], taskIds: [], ...overrides }
}

describe('Codex project visibility', () => {
  const forgeProjects = [{ id: 'active', archivedAt: null }, { id: 'archived', archivedAt: '2026-10-21' }]

  it('hides archived project sessions, worktrees and alerts while keeping unlinked projects', () => {
    const active = project('/repo', 'active')
    const archivedWorktree = project('/codex/worktrees/123/repo', 'archived', { runningCount: 2, worktrees: [worktree('/codex/worktrees/123/repo')] })
    const unlinked = project('/unlinked', null)
    const cursor = project('/cursor', 'archived', { providerId: 'cursor', sessions: [], runningCount: 3 })
    const source = snapshot([active, archivedWorktree, unlinked], [cursor])
    const result = filterCodexMonitorSnapshot(source, forgeProjects, { showArchivedProjects: false })
    assert.deepEqual(result.projects.map((item) => item.key), ['/repo', '/unlinked'])
    assert.deepEqual(result.sessions.map((item) => item.id), ['/repo', '/unlinked'])
    assert.deepEqual(result.alerts.map((item) => item.codexKey), ['/repo', '/unlinked'])
    assert.equal(result.running, 0)
    assert.equal(result.completed, 2)
    assert.equal(result.unlinked, 1)
    assert.equal(result.uncommitted, 2)
    assert.equal(result.cursor?.projects.length, 0)
    assert.equal(result.cursor?.alerts.length, 0)
    assert.equal(source.projects.length, 3)
  })

  it('can reveal archived projects without changing conversation archive flags', () => {
    const archived = project('/archived', 'archived')
    archived.sessions[0].archived = true
    const result = filterCodexMonitorSnapshot(snapshot([archived]), forgeProjects, { showArchivedProjects: true })
    assert.equal(result.projects.length, 1)
    assert.equal(result.sessions[0]?.archived, true)
  })

  it('combines project and provider filters without leaking alerts across providers at the same path', () => {
    const codex = project('/repo', 'active')
    const cursor = project('/repo', 'active', { providerId: 'cursor', sessions: [], runningCount: 2 })
    const result = filterCodexMonitorSnapshot(snapshot([codex, project('/other', null)], [cursor]), forgeProjects, { projectId: 'active', providerId: 'cursor', showArchivedProjects: false })
    assert.equal(result.projects.length, 0)
    assert.equal(result.sessions.length, 0)
    assert.equal(result.cursor?.projects.length, 1)
    assert.equal(result.running, 2)
    assert.deepEqual(result.alerts.map((item) => item.providerId), ['cursor'])
  })
})

describe('Codex conversation workspace', () => {
  it('shows a linked worktree and its main repository, including detached HEAD', () => {
    const current = session('thread', '/codex/worktrees/123/repo/src')
    const linked = worktree('/codex/worktrees/123/repo', { detached: true, sessionIds: ['thread'] })
    const context = getCodexSessionWorkspace(current, [project(current.projectKey, 'active', { worktrees: [worktree('/repo', { isMain: true }), linked] })])
    assert.equal(context?.label, '独立工作树')
    assert.equal(context?.path, linked.path)
    assert.equal(context?.mainPath, '/repo')
    assert.equal(context?.branch, '分离 HEAD · 12345678')
    assert.equal(context?.worktree, linked)
  })

  it('uses the most specific worktree path and does not confuse sibling path prefixes', () => {
    const current = session('thread', '/repo/worktree/app')
    const item = project(current.projectKey, 'active', { worktrees: [worktree('/repo', { isMain: true }), worktree('/repo/work'), worktree('/repo/worktree')] })
    assert.equal(getCodexSessionWorkspace(current, [item])?.path, '/repo/worktree')
    assert.equal(getCodexSessionWorkspace(session('other', '/repo/worktree-other'), [{ ...item, key: '/repo/worktree-other' }])?.label, '主工作树')
  })

  it('matches Windows paths with mixed separators', () => {
    const current = session('thread', 'C:\\repo\\src')
    const item = project(current.projectKey, null, { worktrees: [worktree('C:/repo/', { isMain: true, branch: 'main' })] })
    assert.equal(getCodexSessionWorkspace(current, [item])?.label, '主工作树')
    assert.equal(getCodexSessionWorkspace(current, [item])?.branch, 'main')
  })

  it('does not invent worktree information when Git cannot inspect the directory', () => {
    const current = session('thread', '/removed')
    const item = project(current.projectKey, null)
    item.git = { ...item.git, repositoryAvailable: false, repositoryRoot: '', branch: '' }
    const context = getCodexSessionWorkspace(current, [item])
    assert.equal(context?.label, '工作目录不可用或非 Git 仓库')
    assert.equal(context?.worktree, null)
    assert.equal(context?.branch, '')
    assert.equal(context?.path, '/removed')
    assert.equal(getCodexSessionWorkspace(current, []), null)
  })
})
