export type AppUpdateChannel = 'stable' | 'prerelease'

/**
 * Electron-updater must opt in before it considers GitHub prereleases. Keep
 * that opt-in tied to a prerelease app version, so a debugging build cannot
 * accidentally move stable installations onto a beta release.
 */
export function getAppUpdateChannel(version: string): AppUpdateChannel {
  const normalizedVersion = version.trim()
  return /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/.test(normalizedVersion) ? 'prerelease' : 'stable'
}

export function shouldAllowPrereleaseUpdates(version: string): boolean {
  return getAppUpdateChannel(version) === 'prerelease'
}
