import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  appModeStorageKey,
  defaultAppMode,
  getAppModeLabel,
  normalizeAppMode,
  readStoredAppMode,
  writeStoredAppMode
} from './app-mode.js'

function createStorage(initial: Record<string, string> = {}): {
  storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }
  values: Record<string, string>
} {
  const values = { ...initial }
  return {
    values,
    storage: {
      getItem: (key) => values[key] ?? null,
      setItem: (key, value) => {
        values[key] = value
      }
    }
  }
}

describe('app mode preference', () => {
  it('defaults to simple mode and normalizes invalid values', () => {
    assert.equal(defaultAppMode, 'simple')
    assert.equal(normalizeAppMode(undefined), 'simple')
    assert.equal(normalizeAppMode('invalid'), 'simple')
    assert.equal(normalizeAppMode('full'), 'full')
  })

  it('reads and writes the persisted mode', () => {
    const { storage, values } = createStorage()

    assert.equal(readStoredAppMode(storage), 'simple')
    assert.equal(writeStoredAppMode('full', storage), 'full')
    assert.equal(values[appModeStorageKey], 'full')
    assert.equal(readStoredAppMode(storage), 'full')
  })

  it('exposes stable Chinese labels', () => {
    assert.equal(getAppModeLabel('simple'), '简洁版')
    assert.equal(getAppModeLabel('full'), '完整版')
  })
})
