export type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

export type AppUpdateState = {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string
  percent?: number
  error?: string
}

export type AppUpdatePrimaryAction = 'check' | 'install' | 'busy'

export type AppUpdateViewModel = {
  title: string
  description: string
  primaryAction: AppUpdatePrimaryAction
  primaryLabel: string
}

export function createAppUpdateViewModel(state: AppUpdateState): AppUpdateViewModel {
  const availableVersion = state.availableVersion?.trim()

  switch (state.status) {
    case 'checking':
      return {
        title: '正在检查更新',
        description: '正在连接 GitHub Releases。',
        primaryAction: 'busy',
        primaryLabel: '正在检查'
      }
    case 'available':
      return {
        title: `发现新版 ${availableVersion || ''}`.trim(),
        description: 'ForgeDesk 会在后台下载新版安装包。',
        primaryAction: 'busy',
        primaryLabel: '准备下载'
      }
    case 'downloading':
      return {
        title: availableVersion ? `正在下载 ${availableVersion}` : '正在下载新版',
        description: '下载完成后可以重启安装。',
        primaryAction: 'busy',
        primaryLabel: `下载中 ${Math.round(state.percent ?? 0)}%`
      }
    case 'downloaded':
      return {
        title: `新版 ${availableVersion || ''} 已下载`.trim(),
        description: '重启 ForgeDesk 后会完成安装。',
        primaryAction: 'install',
        primaryLabel: '重启安装'
      }
    case 'not-available':
      return {
        title: `当前版本 ${state.currentVersion}`,
        description: '已经是最新版本。',
        primaryAction: 'check',
        primaryLabel: '再次检查'
      }
    case 'error':
      return {
        title: '更新检查失败',
        description: state.error || '请稍后重试，或到 GitHub Releases 手动下载。',
        primaryAction: 'check',
        primaryLabel: '重新检查'
      }
    case 'idle':
    default:
      return {
        title: `当前版本 ${state.currentVersion}`,
        description: '可以手动检查 GitHub Releases 上的新版本。',
        primaryAction: 'check',
        primaryLabel: '检查更新'
      }
  }
}
