export type QuickBuildStage = { id: string; title: string; status: 'running' | 'succeeded' | 'failed'; elapsedMs: number; cacheHit?: boolean }
export type QuickBuildStartInput = { cwd?: string; force?: boolean }
export type QuickBuildRestartInput = { cwd?: string; taskId?: string }
export type QuickBuildTask = {
  id: string; command: string; cwd: string; status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  phase: string; hint: string; lastOutputAt: string; processPid?: number
  startedAt: string; updatedAt: string; finishedAt?: string
  log: string; stdout: string; stderr: string; exitCode: number | null; signal?: string; error?: string
  architecture?: string; artifactPath?: string; reportPath?: string; elapsedMs?: number; reused?: boolean; stages?: QuickBuildStage[]
}
export const QUICK_BUILD_EVENT_PREFIX = '@@FORGEDESK_BUILD@@'

export function parseQuickBuildEvent(line: string): { stage?: QuickBuildStage; artifactPath?: string; reportPath?: string; architecture?: string; elapsedMs?: number; reused?: boolean } | null {
  if (!line.startsWith(QUICK_BUILD_EVENT_PREFIX) || line.length > 16384) return null
  try {
    const event = JSON.parse(line.slice(QUICK_BUILD_EVENT_PREFIX.length))
    if (!event || typeof event !== 'object') return null
    if (event.stage) {
      const stage = event.stage
      if (typeof stage.id !== 'string' || typeof stage.title !== 'string' || !['running', 'succeeded', 'failed'].includes(stage.status) || !Number.isFinite(stage.elapsedMs) || stage.elapsedMs < 0) return null
      return { stage: { id: stage.id.slice(0, 80), title: stage.title.slice(0, 160), status: stage.status, elapsedMs: stage.elapsedMs, cacheHit: stage.cacheHit === true } }
    }
    if (typeof event.artifactPath === 'string' && typeof event.reportPath === 'string' && ['arm64', 'x64'].includes(event.architecture) && Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0) {
      return { artifactPath: event.artifactPath, reportPath: event.reportPath, architecture: event.architecture, elapsedMs: event.elapsedMs, reused: event.reused === true }
    }
  } catch { /* Ordinary build output is not a control message. */ }
  return null
}
