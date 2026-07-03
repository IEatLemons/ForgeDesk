import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_NAVIGATION_ITEMS } from './app-navigation.js'

describe('app navigation', () => {
  it('places Docker between services and tools while keeping terminal in the footer area', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.map((item) => item.key),
      ['overview', 'services', 'docker', 'tools', 'terminal', 'settings']
    )
  })
})
