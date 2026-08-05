import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

type AppUpdateSnapshot = {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string
  percent?: number
  error?: string
  releaseNotes?: string
  lastCheckedAt?: string
}

type UpdateInfoLike = {
  version?: string
  releaseNotes?: string | Array<{ version?: string; note?: string | null }> | null
}

type ProgressInfoLike = {
  percent?: number
}

let registered = false
let scheduled = false
let checkInFlight: Promise<AppUpdateSnapshot> | null = null
let updateQuitRequested = false
let snapshot: AppUpdateSnapshot = {
  status: 'idle',
  currentVersion: app.getVersion()
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '更新检查失败'
}

function normalizeReleaseNotes(releaseNotes: UpdateInfoLike['releaseNotes']): string | undefined {
  if (typeof releaseNotes === 'string') {
    return releaseNotes.trim() || undefined
  }

  if (!Array.isArray(releaseNotes)) {
    return undefined
  }

  const notes = releaseNotes
    .map((item) => {
      const note = item?.note?.trim()
      if (!note) {
        return ''
      }

      return item.version?.trim() ? `### ${item.version.trim()}\n${note}` : note
    })
    .filter(Boolean)

  return notes.length > 0 ? notes.join('\n\n') : undefined
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

async function checkForUpdates(): Promise<AppUpdateSnapshot> {
  if (checkInFlight) {
    return checkInFlight
  }

  if (snapshot.status === 'downloading' || snapshot.status === 'downloaded') {
    return snapshot
  }

  checkInFlight = (async () => {
    if (!app.isPackaged && process.env.FORGEDESK_ALLOW_DEV_UPDATES !== '1') {
      return publishSnapshot({
        status: 'error',
        availableVersion: undefined,
        releaseNotes: undefined,
        error: '开发模式不能直接检查更新，请打包安装后再试。',
        percent: undefined,
        lastCheckedAt: new Date().toISOString()
      })
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      return publishSnapshot({
        status: 'error',
        availableVersion: undefined,
        releaseNotes: undefined,
        error: getErrorMessage(error),
        percent: undefined,
        lastCheckedAt: new Date().toISOString()
      })
    }

    return publishSnapshot({ lastCheckedAt: new Date().toISOString() })
  })()

  try {
    return await checkInFlight
  } finally {
    checkInFlight = null
  }
}

function scheduleAutomaticChecks(): void {
  if (scheduled) {
    return
  }

  scheduled = true
  const initialDelay = setTimeout(() => {
    void checkForUpdates()
  }, 5_000)
  initialDelay.unref?.()

  const interval = setInterval(() => {
    void checkForUpdates()
  }, 60 * 60 * 1000)
  interval.unref?.()
}

export function isAppUpdateQuitRequested(): boolean {
  return updateQuitRequested
}

export function registerAppUpdateIpc(): void {
  if (registered) {
    return
  }

  registered = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    publishSnapshot({
      status: 'checking',
      availableVersion: undefined,
      releaseNotes: undefined,
      error: undefined,
      percent: undefined
    })
  })

  autoUpdater.on('update-available', (info: UpdateInfoLike) => {
    publishSnapshot({
      status: 'available',
      availableVersion: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      error: undefined,
      percent: undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    publishSnapshot({ status: 'not-available', availableVersion: undefined, releaseNotes: undefined, error: undefined, percent: undefined })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfoLike) => {
    publishSnapshot({ status: 'downloading', percent: progress.percent ?? 0, error: undefined })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfoLike) => {
    publishSnapshot({
      status: 'downloaded',
      availableVersion: info.version ?? snapshot.availableVersion,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? snapshot.releaseNotes,
      percent: 100,
      error: undefined
    })
  })

  autoUpdater.on('update-cancelled', () => {
    publishSnapshot({ status: 'available', error: undefined, percent: undefined })
  })

  autoUpdater.on('error', (error: Error) => {
    publishSnapshot({ status: 'error', availableVersion: undefined, releaseNotes: undefined, error: getErrorMessage(error), percent: undefined })
  })

  ipcMain.handle('app:update:get-state', () => snapshot)

  ipcMain.handle('app:update:check', () => checkForUpdates())

  ipcMain.handle('app:update:install', () => {
    if (snapshot.status !== 'downloaded') {
      return publishSnapshot({
        status: 'error',
        availableVersion: undefined,
        error: '新版还没有下载完成。',
        percent: undefined
      })
    }

    updateQuitRequested = true
    autoUpdater.quitAndInstall(false, true)
    return snapshot
  })

  app.whenReady().then(scheduleAutomaticChecks).catch((error) => {
    publishSnapshot({ status: 'error', error: getErrorMessage(error) })
  })
}
