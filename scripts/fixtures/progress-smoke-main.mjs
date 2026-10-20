import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const [root,smokeDirectory,url] = process.argv.slice(2)
app.setPath('userData',join(smokeDirectory,'profile'))
const require = createRequire(join(root,'package.json'))
const Database = require('better-sqlite3')
const db = new Database(join(smokeDirectory,'qa.db'))
db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY); INSERT INTO projects VALUES('qa-project'); PRAGMA journal_mode=WAL;")
const { ProjectProgressService } = await import(pathToFileURL(join(smokeDirectory,'project-progress.mjs')).href)
const service = new ProjectProgressService(()=>db,()=>new Date(),()=>{
  for(const window of BrowserWindow.getAllWindows())window.webContents.send('project-progress:updated')
})
ipcMain.handle('project-progress:snapshot',(_event,query)=>service.getSnapshot(query))
ipcMain.handle('project-progress:history',(_event,query)=>service.getHistory(query))
ipcMain.handle('project-progress:command',(_event,command)=>service.command(command))
ipcMain.handle('project-progress:migration:preview',(_event,input)=>service.previewMigration(input.legacyRaw,[]))
ipcMain.handle('project-progress:migration:activate',async (_event,input)=>{
  const backup = join(smokeDirectory,'before-migration.db')
  await db.backup(backup)
  return service.activateMigration(input.batchId,input.inputHash,input.legacyRaw,[],backup)
})
ipcMain.handle('managed-tasks:list',()=>[])
ipcMain.handle('project-progress:ai',()=>{throw new Error('隔离验收不会启动真实 AI')})
await app.whenReady()
const window = new BrowserWindow({title:'ForgeDesk · 原生进度验收',width:1280,height:900,webPreferences:{preload:join(root,'out/preload/index.mjs'),sandbox:false,contextIsolation:true}})
await window.loadURL(url)
app.on('window-all-closed',()=>app.quit())
app.on('will-quit',()=>db.close())
