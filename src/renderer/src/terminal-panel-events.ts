export type TerminalOpenRequest = {
  cwd?: string
  directCommand?: {
    file: string
    args?: string[]
  }
  projectId?: string
  repositoryId?: string
  requestId?: number
  title?: string
  reuseKey?: string
  startupCommand?: string
}
