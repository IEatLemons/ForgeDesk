import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultThemePreference,
  normalizeThemePreference,
  readStoredThemePreference,
  resolveThemePreference,
  themePreferenceStorageKey,
  writeStoredThemePreference,
  type ThemePreferenceStorage
} from './app-theme.js'

function createMemoryStorage(initialValue: string | null = null): ThemePreferenceStorage & { savedValue: string | null } {
  return {
    savedValue: initialValue,
    getItem(key) {
      assert.equal(key, themePreferenceStorageKey)
      return this.savedValue
    },
    setItem(key, value) {
      assert.equal(key, themePreferenceStorageKey)
      this.savedValue = value
    }
  }
}

describe('app theme preferences', () => {
  it('normalizes unknown preferences to system mode', () => {
    assert.equal(defaultThemePreference, 'system')
    assert.equal(normalizeThemePreference('system'), 'system')
    assert.equal(normalizeThemePreference('light'), 'light')
    assert.equal(normalizeThemePreference('dark'), 'dark')
    assert.equal(normalizeThemePreference('blue'), 'system')
    assert.equal(normalizeThemePreference(null), 'system')
  })

  it('resolves system preference from the current OS theme', () => {
    assert.equal(resolveThemePreference('system', 'light'), 'light')
    assert.equal(resolveThemePreference('system', 'dark'), 'dark')
    assert.equal(resolveThemePreference('light', 'dark'), 'light')
    assert.equal(resolveThemePreference('dark', 'light'), 'dark')
  })

  it('reads and writes the stored theme preference safely', () => {
    const storage = createMemoryStorage('dark')

    assert.equal(readStoredThemePreference(storage), 'dark')
    assert.equal(writeStoredThemePreference('light', storage), 'light')
    assert.equal(storage.savedValue, 'light')
    assert.equal(writeStoredThemePreference('not-a-theme', storage), 'system')
    assert.equal(storage.savedValue, 'system')
  })

  it('falls back to system mode when storage is unavailable or corrupt', () => {
    const invalidStorage = createMemoryStorage('sepia')
    const throwingStorage: ThemePreferenceStorage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      }
    }

    assert.equal(readStoredThemePreference(null), 'system')
    assert.equal(readStoredThemePreference(invalidStorage), 'system')
    assert.equal(readStoredThemePreference(throwingStorage), 'system')
    assert.equal(writeStoredThemePreference('dark', throwingStorage), 'dark')
  })
})
