type RepositoryRecordDatabase = {
  prepare: (sql: string) => {
    get: (...values: any[]) => unknown
    run: (...values: any[]) => unknown
  }
  transaction: (callback: () => void) => () => void
}

/** Remove only records missed by a rescan; never touch the repository on disk. */
export function removeUnavailableRepositoryRecord(db: RepositoryRecordDatabase, repositoryId: string): void {
  if (typeof repositoryId !== 'string' || !repositoryId.trim()) throw new Error('无效的仓库记录')

  db.transaction(() => {
    const repository = db.prepare(
      'SELECT project_id, parent_repository_id, available, active FROM repositories WHERE id = ?'
    ).get(repositoryId) as { project_id: string; parent_repository_id: string; available: number; active: number } | undefined

    if (!repository) throw new Error('仓库记录不存在')
    if (repository.available || repository.active) throw new Error('仅可移除重新扫描后未发现的仓库记录，请先重新扫描')

    // Keep nested repositories, attaching them to the nearest remaining parent.
    db.prepare(
      'UPDATE repositories SET parent_repository_id = ?, updated_at = ? WHERE project_id = ? AND parent_repository_id = ?'
    ).run(repository.parent_repository_id, new Date().toISOString(), repository.project_id, repositoryId)
    db.prepare('DELETE FROM repositories WHERE id = ?').run(repositoryId)
  })()
}
