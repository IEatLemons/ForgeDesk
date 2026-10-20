import type { Project, Repository } from './data'
import { getProjectRepositoriesForDisplay } from './project-list-view.js'
import { getProjectRepositoryStats, sortRepositoriesHierarchically } from './repository-hierarchy.js'

export type ProjectDirectoryRow = {
  id: string
  project: Project
  repositories: Repository[]
  stats: ReturnType<typeof getProjectRepositoryStats>
  branches: Repository[]
  changed: number
  ahead: number
  pushable: number
  canPush: boolean
}

export function buildProjectDirectoryRows(projects: Project[], repositories: Repository[], previous: ProjectDirectoryRow[] = []): ProjectDirectoryRow[] {
  const index = new Map<string, Repository[]>()
  for (const repository of repositories) {
    const bucket = index.get(repository.projectId) ?? []
    bucket.push(repository)
    index.set(repository.projectId, bucket)
  }
  const oldRows = new Map(previous.map(row => [row.id, row]))
  return projects.map(project => {
    const scoped = index.get(project.id) ?? []
    const old = oldRows.get(project.id)
    // Keep raw inputs too: the hierarchy helper may synthesize parent links.
    if (old?.project === project && oldInputs.get(old)?.length === scoped.length && oldInputs.get(old)?.every((repository, i) => repository === scoped[i])) return old
    const related = getProjectRepositoriesForDisplay(project, scoped)
    const row: ProjectDirectoryRow = {
      id: project.id, project, repositories: related,
      stats: getProjectRepositoryStats(related),
      branches: sortRepositoriesHierarchically(related).map(item => item.repository).filter(repository => repository.currentBranch),
      changed: related.filter(repository => repository.hasChanges).length,
      ahead: related.filter(repository => repository.ahead > 0).length,
      pushable: related.filter(repository => repository.pushTargets.some(target => target.ahead > 0)).length,
      canPush: related.some(repository => repository.available && repository.remotes.length > 0)
    }
    oldInputs.set(row, scoped)
    return row
  })
}
const oldInputs = new WeakMap<ProjectDirectoryRow, Repository[]>()

export type RepositoryCheck = { state: 'checking' | 'ready' | 'error'; checkedAt?: number; attemptedAt: number; error?: string }
export type DirectoryAction = 'fetch' | 'commit' | 'merge' | 'push' | 'push-selected' | 'delete' | 'window'
export type DirectoryController = { run: (action: DirectoryAction, projectIds: string[]) => void }

// Read scheduling is separate from Git execution: hiding a page only drops
// queued checks, never cancels a user's operation or forgets its result.
export class DirectoryRefreshQueue<T> {
  private visible = new Set<string>()
  private queued = new Set<string>()
  private pending = new Set<string>()
  private listeners = new Set<() => void>()
  private checks: Record<string, RepositoryCheck> = {}
  private disposed = false
  constructor(private readonly read: (id: string) => Promise<T>, private readonly accept: (id: string, result: T) => boolean | void | Promise<boolean | void>, private readonly now: () => number = Date.now) {}
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  getSnapshot = (): Record<string, RepositoryCheck> => this.checks
  private publish(id: string, check: RepositoryCheck): void {
    this.checks = { ...this.checks, [id]: check }
    for (const listener of this.listeners) listener()
  }
  setVisible(ids: string[]): void {
    this.visible = new Set(ids)
    for (const id of this.queued) if (!this.visible.has(id)) this.queued.delete(id)
  }
  refresh(force = false): void {
    if (this.disposed) return
    for (const id of this.visible) {
      const check = this.checks[id]
      if (!this.pending.has(id) && (force || !check || this.now() - check.attemptedAt >= 30_000)) this.queued.add(id)
    }
    this.drain()
  }
  private drain(): void {
    while (!this.disposed && this.pending.size < 2 && this.queued.size) {
      const id = this.queued.values().next().value as string
      this.queued.delete(id)
      if (!this.visible.has(id)) continue
      this.pending.add(id)
      const checkedAt = this.checks[id]?.checkedAt
      const attemptedAt = this.now()
      this.publish(id, { state: 'checking', checkedAt, attemptedAt })
      void Promise.resolve().then(() => this.read(id)).then(async result => {
        if (this.disposed) return
        const accepted = await this.accept(id, result) !== false
        if (this.disposed) return
        this.publish(id, { state: 'ready', attemptedAt: accepted ? attemptedAt : 0, checkedAt: accepted ? this.now() : checkedAt })
      }).catch(error => {
        if (!this.disposed) this.publish(id, { state: 'error', checkedAt, attemptedAt, error: error instanceof Error ? error.message : '检查失败' })
      }).finally(() => { this.pending.delete(id); this.drain() })
    }
  }
  invalidate(ids: string[]): void {
    for (const id of ids) {
      const check = this.checks[id]
      if (check && !this.pending.has(id)) this.publish(id, { ...check, attemptedAt: 0 })
    }
  }
  dispose(): void { this.disposed = true; this.queued.clear(); this.listeners.clear() }
  resume(): void { this.disposed = false }
}
