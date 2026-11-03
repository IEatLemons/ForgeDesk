import type { ProjectOperations, ProjectOperationsApi } from '../../shared/project-operations'

export type OperationsSnapshot = { data: ProjectOperations | null; loading: boolean; refreshing: boolean; error: string }

// A single cache per project is shared by all mounted views in this renderer.
export class ProjectOperationsStore {
  private snapshot: OperationsSnapshot = { data: null, loading: false, refreshing: false, error: '' }
  private listeners = new Set<() => void>()
  private readFlight: Promise<void> | null = null
  private refreshFlight: Promise<void> | null = null
  private revision = 0
  constructor(readonly projectId: string, private api: Pick<ProjectOperationsApi, 'readProjectOperations' | 'refreshProjectOperations'>) {}
  getSnapshot = (): OperationsSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(patch: Partial<OperationsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
  read = (): Promise<void> => {
    if (this.readFlight) return this.readFlight
    const revision = this.revision
    this.publish({ loading: !this.snapshot.data })
    this.readFlight = this.api.readProjectOperations(this.projectId).then(data => {
      if (revision === this.revision && data.projectId === this.projectId) this.publish({ data, error: '' })
    }).catch(error => { if (revision === this.revision) this.publish({ error: String(error) }) }).finally(() => {
      this.readFlight = null; this.publish({ loading: false })
    })
    return this.readFlight
  }
  refresh = (force = false): Promise<void> => {
    if (this.refreshFlight) return this.refreshFlight
    this.revision++
    this.publish({ refreshing: true })
    this.refreshFlight = this.api.refreshProjectOperations({ projectId: this.projectId, force }).then(data => {
      if (data.projectId === this.projectId) this.publish({ data, error: '' })
    }).catch(error => this.publish({ error: String(error) })).finally(() => {
      this.refreshFlight = null; this.publish({ refreshing: false })
    })
    return this.refreshFlight
  }
}
