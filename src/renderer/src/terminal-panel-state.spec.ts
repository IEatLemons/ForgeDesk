import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  closeTerminalTab,
  createTerminalPanelState,
  createTerminalReuseKey,
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
})
