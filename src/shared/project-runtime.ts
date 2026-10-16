export type RuntimeState = 'running' | 'stopped' | 'degraded' | 'unknown'
export type RuntimeHealth = 'healthy' | 'unhealthy' | 'not-configured' | 'unknown'
export type RuntimeUnit = { id: string; name: string; state: RuntimeState; detail: string }
export type ProjectRuntimeSnapshot = {
  targetId: string; projectId: string; enabled: boolean; state: RuntimeState; health: RuntimeHealth
  units: RuntimeUnit[]; checkedAt: string | null; stale: boolean; error: string | null
}
export type ProjectRuntimeLog = { targetId: string; checkedAt: string; text: string; truncated: boolean }
export const runtimeStaleAfterMs = 90_000
export const runtimeOutputLimit = 64 * 1024
