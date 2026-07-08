import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  closeTerminalTab,
  createTerminalPanelState,
  createTerminalPanelStateFromSessions,
  createTerminalReuseKey,
  filterRestorableTerminalPanelSessions,
  markTerminalTabExited,
  upsertTerminalTab,
  type TerminalPanelSession
} from './terminal-panel-state.js'

const firstSession: TerminalPanelSession = {
  id: 'term-1',
  cwd: '/Users/stone/ForgeDesk',
  exited: false,
  pid: 1001,
  reuseKey: 'cwd:/Users/stone/ForgeDesk',
  shell: '/bin/zsh',
  title: 'ForgeDesk'
}

const secondSession: TerminalPanelSession = {
  id: 'term-2',
  cwd: '/Users/stone/ForgeDesk/src',
  exited: false,
  pid: 1002,
  reuseKey: 'cwd:/Users/stone/ForgeDesk/src',
  shell: '/bin/zsh',
  title: 'src'
}

describe('terminal panel state', () => {
  it('focuses an existing tab when reuse keys match', () => {
    let state = createTerminalPanelState()

    state = upsertTerminalTab(state, firstSession)
    state = upsertTerminalTab(state, secondSession)
    state = upsertTerminalTab(state, { ...firstSession, title: 'Project Terminal' })

    assert.equal(state.activeSessionId, firstSession.id)
    assert.deepEqual(
      state.tabs.map((tab) => tab.title),
      ['Project Terminal', 'src']
    )
  })

  it('chooses a nearby active tab when the current tab closes', () => {
    let state = createTerminalPanelState()
    state = upsertTerminalTab(state, firstSession)
    state = upsertTerminalTab(state, secondSession)

    state = closeTerminalTab(state, secondSession.id)

    assert.equal(state.activeSessionId, firstSession.id)
    assert.deepEqual(
      state.tabs.map((tab) => tab.id),
      [firstSession.id]
    )

    state = closeTerminalTab(state, firstSession.id)
    assert.equal(state.activeSessionId, null)
    assert.deepEqual(state.tabs, [])
  })

  it('marks tabs as exited without dropping scrollback state', () => {
    const state = markTerminalTabExited(upsertTerminalTab(createTerminalPanelState(), firstSession), firstSession.id, 130)

    assert.equal(state.tabs[0]?.exited, true)
    assert.equal(state.tabs[0]?.exitCode, 130)
    assert.equal(state.activeSessionId, firstSession.id)
  })

  it('creates stable reuse keys from terminal context', () => {
    assert.equal(createTerminalReuseKey('project', 'project-1'), 'project:project-1')
    assert.equal(createTerminalReuseKey('repository', 'repo-1'), 'repository:repo-1')
    assert.equal(createTerminalReuseKey('cwd', '/Users/stone/ForgeDesk'), 'cwd:/Users/stone/ForgeDesk')
  })

  it('restores panel state from existing sessions and prefers a running tab', () => {
    const state = createTerminalPanelStateFromSessions([{ ...firstSession, exited: true }, secondSession])

    assert.equal(state.activeSessionId, secondSession.id)
    assert.deepEqual(
      state.tabs.map((tab) => tab.id),
      [firstSession.id, secondSession.id]
    )
  })

  it('restores panel state with the requested reuse key active', () => {
    const projectSession = { ...firstSession, id: 'project-terminal', reuseKey: 'project:project-a' }
    const cliSession = { ...secondSession, id: 'cli-terminal', reuseKey: undefined }
    const state = createTerminalPanelStateFromSessions([cliSession, projectSession], { reuseKey: 'project:project-a' })

    assert.equal(state.activeSessionId, 'project-terminal')
    assert.deepEqual(
      state.tabs.map((tab) => tab.id),
      ['cli-terminal', 'project-terminal']
    )
  })

  it('falls back to the requested cwd when a restored session has no reuse key', () => {
    const projectSession = { ...firstSession, id: 'project-terminal', reuseKey: undefined, exited: true }
    const cliSession = { ...secondSession, id: 'cli-terminal', reuseKey: undefined, exited: true }
    const state = createTerminalPanelStateFromSessions([cliSession, projectSession], { cwd: firstSession.cwd })

    assert.equal(state.activeSessionId, 'project-terminal')
  })

  it('restores project terminal sessions by reuse key before falling back to legacy cwd-only sessions', () => {
    const projectSession = { ...firstSession, id: 'project-terminal', reuseKey: 'project:project-a' }
    const repositorySession = { ...firstSession, id: 'repository-terminal', reuseKey: 'repository:repo-a' }
    const legacySession = { ...firstSession, id: 'legacy-terminal', reuseKey: undefined }
    const otherSession = { ...secondSession, id: 'other-terminal', reuseKey: undefined }

    assert.deepEqual(
      filterRestorableTerminalPanelSessions([repositorySession, legacySession, otherSession, projectSession], {
        defaultCwd: firstSession.cwd,
        defaultReuseKey: 'project:project-a'
      }).map((session) => session.id),
      ['legacy-terminal', 'project-terminal']
    )
  })
})
