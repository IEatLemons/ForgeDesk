import { useCallback, useEffect, useState } from 'react'
import { createWorkspaceHistory, globalPage, projectPage, restoreHistory, validRoute, visitRoute, workspaceLocationKey, type AppRoute, type ProjectRoute } from './workspace-navigation'

export function useWorkspaceNavigation(projectWindowId: string | null) {
  const [history, setHistory] = useState(() => {
    const initial = createWorkspaceHistory(projectWindowId ? projectPage(projectWindowId) : globalPage('workbench'))
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(workspaceLocationKey) ?? '{}')
      if (stored && typeof stored === 'object') initial.locations = Object.fromEntries(Object.entries(stored).filter(([id, route]) => validRoute(route) && route.scope === 'project' && route.projectId === id)) as Record<string, ProjectRoute>
      if (projectWindowId && initial.locations[projectWindowId]) initial.entries = [initial.locations[projectWindowId]]
    } catch { /* Navigation preferences must never prevent startup. */ }
    return initial
  })
  useEffect(() => { try { localStorage.setItem(workspaceLocationKey, JSON.stringify(history.locations)) } catch { /* best effort */ } }, [history.locations])
  const route = history.entries[history.index]
  const go = useCallback((next: AppRoute) => { if (validRoute(next)) setHistory(current => visitRoute(current, next)) }, [])
  const back = useCallback(() => setHistory(current => restoreHistory(current, current.index - 1)), [])
  const forward = useCallback(() => setHistory(current => restoreHistory(current, current.index + 1)), [])
  const openProject = useCallback((id: string) => setHistory(current => visitRoute(current, current.locations[id] ?? projectPage(id))), [])
  let origin: AppRoute | undefined
  for (let index = history.index - 1; index >= 0; index--) {
    const candidate = history.entries[index]
    if (candidate.scope === 'global' && route.scope === 'global' && candidate.area === route.area) continue
    if (candidate.scope === 'project' && route.scope === 'project' && candidate.projectId === route.projectId) continue
    origin = candidate; break
  }
  function returnToOrigin(): void {
    if (!origin) return back()
    const index = history.entries.lastIndexOf(origin, history.index - 1)
    setHistory(current => restoreHistory(current, index))
  }
  return { route, go, back, forward, openProject, origin, returnToOrigin, canBack: history.index > 0, canForward: history.index + 1 < history.entries.length }
}
