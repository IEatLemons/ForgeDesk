export type ProjectArchiveDatabase = {
  prepare: (sql: string) => { get: (...values: any[]) => unknown; run: (...values: any[]) => unknown }
}

/** Archiving is classification only. It must never remove bindings or stop jobs. */
export function setProjectArchived(db: ProjectArchiveDatabase, input: { id: string; archived: boolean }, now = new Date().toISOString()): void {
  if (!input || typeof input.id !== 'string' || !input.id.trim() || typeof input.archived !== 'boolean') throw new Error('无效的项目归档请求')
  const project = db.prepare('SELECT id, archived_at FROM projects WHERE id = ?').get(input.id) as { id: string; archived_at: string | null } | undefined
  if (!project) throw new Error('项目不存在')
  if (Boolean(project.archived_at) === input.archived) return
  db.prepare('UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ?').run(input.archived ? now : null, now, input.id)
}
