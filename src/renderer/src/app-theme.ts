export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export type ThemePreferenceStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export const defaultThemePreference: ThemePreference = 'system'
export const themePreferenceStorageKey = 'forgedesk:theme-preference:v1'
export const themePreferenceChangedEvent = 'forgedesk:theme-preference-changed'

export function normalizeThemePreference(input: unknown): ThemePreference {
  return input === 'light' || input === 'dark' || input === 'system' ? input : defaultThemePreference
}

export function resolveThemePreference(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference
}

function getBrowserStorage(): ThemePreferenceStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function dispatchThemePreferenceChanged(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.dispatchEvent(new Event(themePreferenceChangedEvent))
  } catch {
    // Preference sync is best-effort; the in-memory state still updates.
  }
}

export function readStoredThemePreference(storage: ThemePreferenceStorage | null = getBrowserStorage()): ThemePreference {
  if (!storage) {
    return defaultThemePreference
  }

  try {
    return normalizeThemePreference(storage.getItem(themePreferenceStorageKey))
  } catch {
    return defaultThemePreference
  }
}

export function writeStoredThemePreference(input: unknown, storage: ThemePreferenceStorage | null = getBrowserStorage()): ThemePreference {
  const preference = normalizeThemePreference(input)

  if (storage) {
    try {
      storage.setItem(themePreferenceStorageKey, preference)
      dispatchThemePreferenceChanged()
    } catch {
      // The preference is non-critical; keep the in-memory value even if storage is unavailable.
    }
  }

  return preference
}

export function getSystemThemePreference(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function subscribeSystemThemePreference(onChange: (theme: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = (event: MediaQueryListEvent): void => {
    onChange(event.matches ? 'dark' : 'light')
  }

  mediaQuery.addEventListener('change', handleChange)

  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}
