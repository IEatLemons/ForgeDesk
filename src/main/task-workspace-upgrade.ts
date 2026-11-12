import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TaskWorkspaceService } from './task-workspace.js'

export async function initializeTaskWorkspaceWithBackup(service: TaskWorkspaceService, root: string, legacy: Record<string, string>, backup: (path: string) => Promise<unknown>): Promise<void> {
  if (service.ready()) return
  if (!legacy || typeof legacy !== 'object' || Object.entries(legacy).some(([key, value]) => !key.startsWith('forgedesk.taskList.items.v1') || typeof value !== 'string')) throw new Error('旧任务备份格式无效')
  const directory = join(root, 'backups', randomUUID())
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'legacy-local-storage.json'), JSON.stringify(legacy, null, 2), { flag: 'wx', mode: 0o600 })
  await backup(join(directory, 'forgedesk.db'))
  service.initialize(directory)
}
