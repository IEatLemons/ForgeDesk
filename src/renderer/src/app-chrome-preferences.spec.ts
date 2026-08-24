import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  appChromePreferencesStorageKey,
  defaultAppChromePreferences,
  normalizeAppChromePreferences,
  readStoredAppChromePreferences,
  writeStoredAppChromePreferences
} from './app-chrome-preferences.js'

function createStorage(initial: Record<string, string> = {}): {
  values: Record<string, string>
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
} {
  const values = { ...initial }
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => { values[key] = value }
  }
}

describe('app chrome preferences', () => {
  it('uses the requested default placement', () => {
    assert.deepEqual(defaultAppChromePreferences, { appModeSwitcher: 'bottom', codexStatus: 'top' })
    assert.deepEqual(normalizeAppChromePreferences(undefined), defaultAppChromePreferences)
  })

  it('normalizes invalid or partial values safely', () => {
    assert.deepEqual(normalizeAppChromePreferences({ appModeSwitcher: 'top', codexStatus: 'invalid' }), { appModeSwitcher: 'top', codexStatus: 'top' })
  })

  it('persists and restores each control placement', () => {
    const storage = createStorage()
    const saved = writeStoredAppChromePreferences({ appModeSwitcher: 'hidden', codexStatus: 'bottom' }, storage)
    assert.deepEqual(saved, { appModeSwitcher: 'hidden', codexStatus: 'bottom' })
    assert.equal(storage.values[appChromePreferencesStorageKey], JSON.stringify(saved))
    assert.deepEqual(readStoredAppChromePreferences(storage), saved)
  })
})
