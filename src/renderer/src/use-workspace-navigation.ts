import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForgeDeskStore } from './store'
import { repositoryLandingId } from './repository-workspace-view'
import { createWorkspaceHistory, normalizeWorkspaceRoute, globalPage, projectPage, restoreHistory, validRoute, visitRoute, workspaceLocationKey, type AppRoute, type ProjectRoute } from './workspace-navigation'

export function useWorkspaceNavigation(projectWindowId: string | null) {
  const [history, setHistory] = useState(() => {
    const initial = createWorkspaceHistory(projectWindowId ? projectPage(projectWindowId) : globalPage('projects'))
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(workspaceLocationKey) ?? '{}')
      if (stored && typeof stored === 'object') initial.locations = Object.fromEntries(Object.entries(stored).filter(([id, route]) => validRoute(route) && route.scope === 'project' && route.projectId === id)) as Record<string, ProjectRoute>
      if (projectWindowId && initial.locations[projectWindowId]) initial.entries = [initial.locations[projectWindowId]]
    } catch { /* Navigation preferences must never prevent startup. */ }
    return initial
  })
  useEffect(() => { try { localStorage.setItem(workspaceLocationKey, JSON.stringify(history.locations)) } catch { /* best effort */ } }, [history.locations])
  const location = history.entries[history.index]
  // Subscribe to the landing identity only: directory Git checks must not cause
  // the application root to rerender for every workspace-status update.
  const repositoryId = useForgeDeskStore(state => repositoryLandingId(location, state.repositories))
  const route = useMemo(() => location.scope === 'project' && repositoryId ? { ...location, repositoryId, view: location.view ?? 'history' } : location, [location, repositoryId])
  const go = useCallback((next: AppRoute) => { const normalized = normalizeWorkspaceRoute(next); if (validRoute(normalized)) setHistory(current => visitRoute(current, normalized)) }, [])
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
