export type AppChromeControlPlacement = 'top' | 'bottom' | 'hidden'

export type AppChromePreferences = {
  appModeSwitcher: AppChromeControlPlacement
  codexStatus: AppChromeControlPlacement
}

export type AppChromePreferencesStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export const defaultAppChromePreferences: AppChromePreferences = {
  appModeSwitcher: 'bottom',
  codexStatus: 'top'
}

export const appChromePreferencesStorageKey = 'forgedesk:app-chrome-preferences:v1'
export const appChromePreferencesChangedEvent = 'forgedesk:app-chrome-preferences-changed'

export function normalizeAppChromeControlPlacement(input: unknown, fallback: AppChromeControlPlacement): AppChromeControlPlacement {
  return input === 'top' || input === 'bottom' || input === 'hidden' ? input : fallback
}

export function normalizeAppChromePreferences(input: unknown): AppChromePreferences {
  const value = input && typeof input === 'object' ? input as Partial<AppChromePreferences> : {}
  return {
    appModeSwitcher: normalizeAppChromeControlPlacement(value.appModeSwitcher, defaultAppChromePreferences.appModeSwitcher),
    codexStatus: normalizeAppChromeControlPlacement(value.codexStatus, defaultAppChromePreferences.codexStatus)
  }
}

function getBrowserStorage(): AppChromePreferencesStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function dispatchAppChromePreferencesChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(appChromePreferencesChangedEvent))
  } catch {
    // In-memory updates remain usable if an event cannot be dispatched.
  }
}

export function readStoredAppChromePreferences(storage: AppChromePreferencesStorage | null = getBrowserStorage()): AppChromePreferences {
  if (!storage) return defaultAppChromePreferences
  try {
    const raw = storage.getItem(appChromePreferencesStorageKey)
    return normalizeAppChromePreferences(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultAppChromePreferences
  }
}

export function writeStoredAppChromePreferences(input: unknown, storage: AppChromePreferencesStorage | null = getBrowserStorage()): AppChromePreferences {
  const preferences = normalizeAppChromePreferences(input)
  if (storage) {
    try {
      storage.setItem(appChromePreferencesStorageKey, JSON.stringify(preferences))
      dispatchAppChromePreferencesChanged()
    } catch {
      // The preference is non-critical; callers still receive a normalized value.
    }
  }
  return preferences
}
