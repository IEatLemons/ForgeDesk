import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectDirectorySummary } from '../../shared/project-directory'

const cache = new Map<string, ProjectDirectorySummary>()
export function useProjectDirectorySummaries(projectIds: string[], visible: boolean) {
  const key = JSON.stringify(projectIds)
  const [summaries, setSummaries] = useState(() => new Map(cache))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refreshRef = useRef<() => void>(() => {})
  const refresh = useCallback(() => refreshRef.current(), [])
  useEffect(() => {
    if (!visible) return
    const ids = JSON.parse(key) as string[]
    let disposed = false, flight = false, queued = false, debounce: ReturnType<typeof setTimeout> | undefined
    const active = () => !disposed && document.visibilityState !== 'hidden'
    async function read() {
      if (!active() || !ids.length) return
      if (flight) { queued = true; return }
      flight = true; setLoading(true)
      try {
        const values = await window.forgeDesk.readProjectDirectorySummaries({ projectIds: ids })
        if (!active()) return
        for (const value of values) {
          if (!ids.includes(value.projectId)) continue
          const previous = cache.get(value.projectId)
          cache.set(value.projectId, { ...value,
            operations: value.operations ?? previous?.operations ?? null,
            servers: value.serversError ? previous?.servers ?? [] : value.servers
          })
        }
        setSummaries(new Map(cache)); setError('')
      } catch (error) { if (active()) setError(error instanceof Error ? error.message : String(error)) }
      finally { flight = false; if (!disposed) setLoading(false); if (queued && active()) { queued = false; void read() } }
    }
    const schedule = () => { clearTimeout(debounce); debounce = setTimeout(() => void read(), 80) }
    setLoading(false)
    const unsubWorkspace = window.forgeDesk.onWorkspaceUpdated(schedule)
    refreshRef.current = () => void read()
    void read()
    const unsubProgress = window.forgeDesk.onProjectProgressUpdated(schedule)
    const unsubOperations = window.forgeDesk.onProjectOperationsUpdated(id => { if (ids.includes(id)) schedule() })
    const timer = setInterval(() => void read(), 60_000)
    document.addEventListener('visibilitychange', schedule)
    window.addEventListener('focus', schedule)
    window.addEventListener('project-services-changed', schedule)
    return () => { disposed = true; refreshRef.current = () => {}; clearInterval(timer); clearTimeout(debounce); unsubProgress(); unsubOperations(); unsubWorkspace(); document.removeEventListener('visibilitychange', schedule); window.removeEventListener('focus', schedule); window.removeEventListener('project-services-changed', schedule) }
  }, [key, visible])
  return { summaries, error, loading, refresh }
}
