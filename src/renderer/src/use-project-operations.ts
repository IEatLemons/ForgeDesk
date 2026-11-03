import { useEffect, useSyncExternalStore } from 'react'
import { operationsRefreshMs } from '../../shared/project-operations'
import { ProjectOperationsStore } from './project-operations-store'
import { useWorkspaceVisible } from './workspace-visibility'

const stores = new Map<string, ProjectOperationsStore>()
function getStore(projectId: string): ProjectOperationsStore {
  let store = stores.get(projectId)
  if (!store) stores.set(projectId, store = new ProjectOperationsStore(projectId, window.forgeDesk))
  return store
}

export function useProjectOperations(projectId: string, autoRefresh = true) {
  const store = getStore(projectId)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const visible = useWorkspaceVisible()
  useEffect(() => {
    if (!visible) return
    let disposed = false
    const active = () => !disposed && document.visibilityState !== 'hidden'
    const load = async () => { if (!active()) return; await store.read(); if (active() && autoRefresh) await store.refresh() }
    void load()
    const changed = () => { if (active()) void load() }
    const servicesChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail === projectId && active()) void store.read().then(() => autoRefresh && active() ? store.refresh(true) : undefined)
    }
    const unsubscribe = window.forgeDesk.onProjectOperationsUpdated(id => { if (id === projectId && active()) void store.read() })
    const timer = window.setInterval(changed, operationsRefreshMs)
    document.addEventListener('visibilitychange', changed)
    window.addEventListener('project-services-changed', servicesChanged)
    return () => { disposed = true; window.clearInterval(timer); unsubscribe(); document.removeEventListener('visibilitychange', changed); window.removeEventListener('project-services-changed', servicesChanged) }
  }, [store, projectId, visible, autoRefresh])
  return { ...snapshot, refresh: store.refresh }
}
