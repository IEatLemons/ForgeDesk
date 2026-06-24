import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

type AppUpdateSnapshot = {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string
  percent?: number
  error?: string
}

type UpdateInfoLike = {
  version?: string
}

type ProgressInfoLike = {
  percent?: number
}

let registered = false
let snapshot: AppUpdateSnapshot = {
  status: 'idle',
  currentVersion: app.getVersion()
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '更新检查失败'
}

function publishSnapshot(patch: Partial<AppUpdateSnapshot>): AppUpdateSnapshot {
  snapshot = {
    ...snapshot,
    ...patch,
    currentVersion: app.getVersion()
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('app:update:state', snapshot)
  }

  return snapshot
}

export function registerAppUpdateIpc(): void {
  if (registered) {
    return
  }

  registered = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    publishSnapshot({ status: 'checking', availableVersion: undefined, error: undefined, percent: undefined })
  })

  autoUpdater.on('update-available', (info: UpdateInfoLike) => {
    publishSnapshot({
      status: 'available',
      availableVersion: info.version,
      error: undefined,
      percent: undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    publishSnapshot({ status: 'not-available', availableVersion: undefined, error: undefined, percent: undefined })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfoLike) => {
    publishSnapshot({ status: 'downloading', percent: progress.percent ?? 0, error: undefined })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfoLike) => {
    publishSnapshot({
      status: 'downloaded',
      availableVersion: info.version ?? snapshot.availableVersion,
      percent: 100,
      error: undefined
    })
  })

  autoUpdater.on('error', (error: Error) => {
    publishSnapshot({ status: 'error', availableVersion: undefined, error: getErrorMessage(error), percent: undefined })
  })

  ipcMain.handle('app:update:get-state', () => snapshot)

  ipcMain.handle('app:update:check', async () => {
    if (!app.isPackaged && process.env.FORGEDESK_ALLOW_DEV_UPDATES !== '1') {
      return publishSnapshot({
        status: 'error',
        availableVersion: undefined,
        error: '开发模式不能直接检查更新，请打包安装后再试。',
        percent: undefined
      })
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      return publishSnapshot({ status: 'error', availableVersion: undefined, error: getErrorMessage(error), percent: undefined })
    }

    return snapshot
  })

  ipcMain.handle('app:update:install', () => {
    if (snapshot.status !== 'downloaded') {
      return publishSnapshot({
        status: 'error',
        availableVersion: undefined,
        error: '新版还没有下载完成。',
        percent: undefined
      })
    }

    autoUpdater.quitAndInstall(false, true)
    return snapshot
  })
}
