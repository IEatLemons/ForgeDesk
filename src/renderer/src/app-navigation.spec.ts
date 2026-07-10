import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_NAVIGATION_ITEMS } from './app-navigation.js'

describe('app navigation', () => {
  it('places document access in the main area while keeping terminal in the footer area', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.map((item) => item.key),
      ['overview', 'tasks', 'docs', 'services', 'docker', 'tools', 'terminal', 'settings']
    )
  })
})
