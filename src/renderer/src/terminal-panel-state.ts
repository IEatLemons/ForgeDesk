export type TerminalPanelSession = {
  id: string
  title: string
  cwd: string
  shell: string
  pid: number
  reuseKey?: string
  exited: boolean
  exitCode?: number
  signal?: number
}

export type TerminalPanelState = {
  tabs: TerminalPanelSession[]
  activeSessionId: string | null
}

export type TerminalReuseKind = 'project' | 'repository' | 'cwd'

export type TerminalRestoreCriteria = {
  defaultCwd?: string
  defaultReuseKey?: string
}

export type TerminalFocusCriteria = {
  cwd?: string
  reuseKey?: string
}

export function createTerminalPanelState(): TerminalPanelState {
  return {
    activeSessionId: null,
    tabs: []
  }
}

function findPreferredTerminalSession(sessions: TerminalPanelSession[], criteria: TerminalFocusCriteria = {}): TerminalPanelSession | null {
  const preferredByReuseKey = criteria.reuseKey
    ? sessions.find((session) => session.reuseKey === criteria.reuseKey && !session.exited) ??
      sessions.find((session) => session.reuseKey === criteria.reuseKey) ??
      null
    : null

  if (preferredByReuseKey) {
    return preferredByReuseKey
  }

  const preferredByCwd = criteria.cwd
    ? sessions.find((session) => session.cwd === criteria.cwd && !session.exited) ?? sessions.find((session) => session.cwd === criteria.cwd) ?? null
    : null

  return preferredByCwd ?? sessions.find((session) => !session.exited) ?? sessions[0] ?? null
}

export function createTerminalPanelStateFromSessions(sessions: TerminalPanelSession[], focusCriteria: TerminalFocusCriteria = {}): TerminalPanelState {
  const activeSession = findPreferredTerminalSession(sessions, focusCriteria)

  return {
    activeSessionId: activeSession?.id ?? null,
    tabs: sessions.map((session) => ({ ...session }))
  }
}

export function createTerminalReuseKey(kind: TerminalReuseKind, value: string): string {
  return `${kind}:${value}`
}

export function shouldRestoreTerminalPanelSession(session: Pick<TerminalPanelSession, 'cwd' | 'reuseKey'>, criteria: TerminalRestoreCriteria = {}): boolean {
  if (criteria.defaultReuseKey) {
    return session.reuseKey === criteria.defaultReuseKey || (!session.reuseKey && Boolean(criteria.defaultCwd) && session.cwd === criteria.defaultCwd)
  }

  return !criteria.defaultCwd || session.cwd === criteria.defaultCwd
}

export function filterRestorableTerminalPanelSessions<T extends Pick<TerminalPanelSession, 'cwd' | 'reuseKey'>>(
  sessions: T[],
  criteria: TerminalRestoreCriteria = {}
): T[] {
  return sessions.filter((session) => shouldRestoreTerminalPanelSession(session, criteria))
}

export function upsertTerminalTab(state: TerminalPanelState, session: TerminalPanelSession): TerminalPanelState {
  const existingIndex = state.tabs.findIndex((tab) => {
    if (session.reuseKey && tab.reuseKey) {
      return tab.reuseKey === session.reuseKey
    }

    return tab.id === session.id
  })

  if (existingIndex < 0) {
    return {
      activeSessionId: session.id,
      tabs: [...state.tabs, session]
    }
  }

  return {
    activeSessionId: session.id,
    tabs: state.tabs.map((tab, index) => (index === existingIndex ? { ...tab, ...session } : tab))
  }
}

export function closeTerminalTab(state: TerminalPanelState, sessionId: string): TerminalPanelState {
  const closingIndex = state.tabs.findIndex((tab) => tab.id === sessionId)

  if (closingIndex < 0) {
    return state
  }

  const tabs = state.tabs.filter((tab) => tab.id !== sessionId)

  if (tabs.length === 0) {
    return {
      activeSessionId: null,
      tabs
    }
  }

  const nextActiveSessionId =
    state.activeSessionId === sessionId
      ? tabs[Math.min(closingIndex, tabs.length - 1)]?.id ?? null
      : state.activeSessionId

  return {
    activeSessionId: nextActiveSessionId,
    tabs
  }
}

export function markTerminalTabExited(state: TerminalPanelState, sessionId: string, exitCode: number, signal?: number): TerminalPanelState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === sessionId ? { ...tab, exited: true, exitCode, signal } : tab))
  }
}
