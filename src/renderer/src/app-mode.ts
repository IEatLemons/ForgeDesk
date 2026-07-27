export type AppMode = 'simple' | 'full'

export type AppModeStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export const defaultAppMode: AppMode = 'simple'
export const appModeStorageKey = 'forgedesk:app-mode:v1'
export const appModeChangedEvent = 'forgedesk:app-mode-changed'

export function normalizeAppMode(input: unknown): AppMode {
  return input === 'full' || input === 'simple' ? input : defaultAppMode
}

function getBrowserStorage(): AppModeStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function dispatchAppModeChanged(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.dispatchEvent(new Event(appModeChangedEvent))
  } catch {
    // Preference sync is best-effort; the in-memory state still updates.
  }
}

export function readStoredAppMode(storage: AppModeStorage | null = getBrowserStorage()): AppMode {
  if (!storage) {
    return defaultAppMode
  }

  try {
    return normalizeAppMode(storage.getItem(appModeStorageKey))
  } catch {
    return defaultAppMode
  }
}

export function writeStoredAppMode(input: unknown, storage: AppModeStorage | null = getBrowserStorage()): AppMode {
  const mode = normalizeAppMode(input)

  if (storage) {
    try {
      storage.setItem(appModeStorageKey, mode)
      dispatchAppModeChanged()
    } catch {
      // The preference is non-critical; keep the in-memory value even if storage is unavailable.
    }
  }

  return mode
}

export function getAppModeLabel(mode: AppMode): string {
  return mode === 'full' ? '完整版' : '简洁版'
}

export function isFullAppMode(mode: AppMode): boolean {
  return mode === 'full'
}
