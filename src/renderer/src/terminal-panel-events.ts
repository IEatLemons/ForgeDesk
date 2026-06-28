export type TerminalOpenRequest = {
  cwd?: string
  projectId?: string
  repositoryId?: string
  requestId?: number
  title?: string
  reuseKey?: string
  startupCommand?: string
}
