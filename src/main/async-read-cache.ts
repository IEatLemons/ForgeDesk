// A completed write invalidates both cached data and reads started before it.
// Old reads may finish for their original caller, but cannot repopulate the cache.
export class AsyncReadCache<T> {
  private entries = new Map<string, { expiresAt: number; value?: T; pending?: Promise<T> }>()
  constructor(private ttlMs: number, private now = () => Date.now()) {}
  invalidate(key: string): void { this.entries.delete(key) }
  get(key: string, read: () => Promise<T>): Promise<T> {
    const current = this.entries.get(key)
    if (current?.pending) return current.pending
    if (current && current.expiresAt > this.now() && 'value' in current) return Promise.resolve(current.value as T)
    const entry: { expiresAt: number; value?: T; pending?: Promise<T> } = { expiresAt: 0 }
    this.entries.set(key, entry)
    const pending = Promise.resolve().then(read).then(value => {
      if (this.entries.get(key) === entry) { entry.value = value; entry.expiresAt = this.now() + this.ttlMs; entry.pending = undefined }
      return value
    }, error => { if (this.entries.get(key) === entry) this.entries.delete(key); throw error })
    entry.pending = pending
    return pending
  }
}
