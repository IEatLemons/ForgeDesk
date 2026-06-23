import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_NAVIGATION_ITEMS } from './app-navigation.js'

describe('app navigation', () => {
  it('places services between projects and settings', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.map((item) => item.key),
      ['overview', 'services', 'settings']
    )
  })
})
