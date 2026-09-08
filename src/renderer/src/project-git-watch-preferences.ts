export type ProjectGitWatchStorage = Pick<Storage, 'getItem' | 'setItem'>

export const projectGitWatchPreferenceStorageKey = 'forgedesk:project-git-watch-enabled:v1'
export const defaultProjectGitWatchEnabled = true

function getBrowserStorage(): ProjectGitWatchStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readStoredProjectGitWatchEnabled(storage: ProjectGitWatchStorage | null = getBrowserStorage()): boolean {
  if (!storage) return defaultProjectGitWatchEnabled

  try {
    const value = storage.getItem(projectGitWatchPreferenceStorageKey)
    return value === null ? defaultProjectGitWatchEnabled : value === 'true'
  } catch {
    return defaultProjectGitWatchEnabled
  }
}

export function writeStoredProjectGitWatchEnabled(
  enabled: boolean,
  storage: ProjectGitWatchStorage | null = getBrowserStorage()
): boolean {
  try {
    storage?.setItem(projectGitWatchPreferenceStorageKey, String(enabled))
  } catch {
    // Keep the current-window setting even when browser storage is unavailable.
  }

  return enabled
}
