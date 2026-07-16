import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_NAVIGATION_ITEMS, APP_NAVIGATION_SECTIONS } from './app-navigation.js'

describe('app navigation', () => {
  it('organizes the workspace around life, study, work, and computer areas', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.map((item) => item.key),
      ['overview', 'tasks', 'docs', 'projects', 'services', 'docker', 'tools', 'system-monitor', 'terminal', 'settings']
    )
    assert.deepEqual(
      APP_NAVIGATION_SECTIONS.filter((section) => section.placement === 'main').map((section) => section.key),
      ['home', 'life', 'study', 'work', 'computer']
    )
  })

  it('keeps settings in the footer system area', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.filter((item) => item.section === 'system').map((item) => item.key),
      ['settings']
    )
  })
})
