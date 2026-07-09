import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_NAVIGATION_ITEMS } from './app-navigation.js'

describe('app navigation', () => {
  it('places tasks near projects while keeping terminal in the footer area', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.map((item) => item.key),
      ['overview', 'tasks', 'services', 'docker', 'tools', 'terminal', 'settings']
    )
  })
})
