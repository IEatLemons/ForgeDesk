import type { ProjectService, ServiceDeploymentSummary } from '../renderer/src/data'

export const operationsRefreshMs = 60_000
export const operationsStaleMs = 5 * 60_000
export const domainHealthStaleMs = 10 * 60_000
export type OperationsSource = 'deployments' | 'environments' | 'domains' | 'production'
export type OperationsSourceState = { updatedAt: string; error: string; retryAt: string }
export type ServiceOperationsState = {
  identity?: string
  sources: Record<OperationsSource, OperationsSourceState>
  production: ServiceDeploymentSummary | null
}
export type ProjectOperations = {
  projectId: string
  services: ProjectService[]
  deployments: Record<string, ServiceDeploymentSummary[]>
  states: Record<string, ServiceOperationsState>
}
export type ProjectOperationsApi = {
  readProjectOperations: (projectId: string) => Promise<ProjectOperations>
  refreshProjectOperations: (input: { projectId: string; force?: boolean }) => Promise<ProjectOperations>
  onProjectOperationsUpdated: (listener: (projectId: string) => void) => () => void
}

export function emptyServiceOperations(): ServiceOperationsState {
  const source = (): OperationsSourceState => ({ updatedAt: '', error: '', retryAt: '' })
  return { sources: { deployments: source(), environments: source(), domains: source(), production: source() }, production: null }
}

export function isOperationsStale(updatedAt: string | undefined, now = Date.now(), ttl = operationsStaleMs): boolean {
  const timestamp = Date.parse(updatedAt || '')
  return !Number.isFinite(timestamp) || now - timestamp > ttl
}
