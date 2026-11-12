import { app, BrowserWindow, dialog, ipcMain, Notification, powerMonitor, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises'
import type Database from 'better-sqlite3'
import type { TaskAttachment, TaskCommand, TaskHistoryQuery, TaskProject } from '../shared/task-workspace.js'
import { TaskWorkspaceService } from './task-workspace.js'
import { initializeTaskWorkspaceWithBackup } from './task-workspace-upgrade.js'

export function registerTaskWorkspace(getDatabase: () => Database.Database, listProjects: () => TaskProject[]) {
  let service: TaskWorkspaceService | null = null
  let initializing: Promise<void> | null = null
  const root = () => join(app.getPath('userData'), 'task-workspace')
  const changed = () => { for (const window of BrowserWindow.getAllWindows()) window.webContents.send('tasks:updated') }
  const get = () => service ??= new TaskWorkspaceService(getDatabase(), undefined, changed, listProjects)
  const pathFor = (attachment: TaskAttachment) => { if (!/^[a-f0-9-]+$/i.test(attachment.storageName)) throw new Error('附件路径无效'); return join(root(), 'attachments', attachment.storageName) }
  ipcMain.handle('tasks:initialize', async (_event, legacy: Record<string, string>) => {
    if (get().ready()) return
    if (!initializing) initializing = initializeTaskWorkspaceWithBackup(get(), root(), legacy, path => getDatabase().backup(path)).finally(() => { initializing = null })
    return initializing
  })
  ipcMain.handle('tasks:snapshot', () => get().snapshot())
  ipcMain.handle('tasks:command', async (_event, command: TaskCommand) => {
    const before = get().all<TaskAttachment>('attachment')
    const result = get().command(command)
    const after = new Set(get().all<TaskAttachment>('attachment').map(file => file.id))
    for (const file of before) if (!after.has(file.id)) await rm(pathFor(file), { force: true }).catch(error => console.warn('Task attachment cleanup failed', error))
    return result
  })
  ipcMain.handle('tasks:history', (_event, query?: TaskHistoryQuery) => get().history(query))
  ipcMain.handle('tasks:attachments:add', async (_event, taskId: string) => {
    get().get('task', taskId)
    const picked = await dialog.showOpenDialog({ title: '添加任务附件', properties: ['openFile', 'multiSelections'] })
    if (picked.canceled) return
    await mkdir(join(root(), 'attachments'), { recursive: true })
    for (const path of picked.filePaths) {
      const storageName = randomUUID(), target = join(root(), 'attachments', storageName)
      const size = (await stat(path)).size
      const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' } as Record<string, string>)[extname(path).toLowerCase()] ?? 'application/octet-stream'
      await copyFile(path, target)
      try { get().addAttachment({ taskId, name: basename(path), size, mime, storageName }) } catch (error) { await rm(target, { force: true }); throw error }
    }
  })
  ipcMain.handle('tasks:attachments:open', async (_event, id: string) => { const error = await shell.openPath(pathFor(get().get<TaskAttachment>('attachment', id))); if (error) throw new Error(error) })
  ipcMain.handle('tasks:attachments:read', async (_event, id: string) => {
    const file = get().get<TaskAttachment>('attachment', id)
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mime) || file.size > 20 * 1024 * 1024) return null
    return `data:${file.mime};base64,${(await readFile(pathFor(file))).toString('base64')}`
  })
  const check = () => {
    if (!Notification.isSupported() || !get().ready()) return
    for (const task of get().dueReminders()) {
      const notification = new Notification({ title: '任务到期提醒', body: task.title })
      notification.on('click', () => { for (const window of BrowserWindow.getAllWindows()) { window.show(); window.focus(); window.webContents.send('tasks:focus', task.id) } })
      notification.show()
      get().markReminderSent(task.id)
    }
  }
  app.whenReady().then(() => {
    const safeCheck = () => { try { check() } catch (error) { console.warn('Task reminder check failed', error) } }
    safeCheck()
    const timer = setInterval(safeCheck, 30_000); timer.unref()
    powerMonitor.on('resume', safeCheck)
    app.on('before-quit', () => { clearInterval(timer); powerMonitor.removeListener('resume', safeCheck) })
  })
  return { get, changed }
}
