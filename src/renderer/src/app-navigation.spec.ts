import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  APP_NAVIGATION_ITEMS,
  APP_NAVIGATION_SECTIONS,
  getNavigationItemsForMode,
  getNavigationSectionsForMode,
  isNavigationKeyVisible
} from './app-navigation.js'

describe('app navigation', () => {
  it('organizes the workspace around life, study, work, and computer areas', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.map((item) => item.key),
      ['overview', 'settings', 'tasks', 'docs', 'projects', 'services', 'data-sources', 'docker', 'tools', 'system-monitor', 'system-info', 'codex-sessions', 'ai-chat', 'terminal']
    )
    assert.deepEqual(
      APP_NAVIGATION_SECTIONS.filter((section) => section.placement === 'main').map((section) => section.key),
      ['home', 'system', 'life', 'study', 'work', 'computer']
    )
  })

  it('keeps settings near the top in the system area', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.filter((item) => item.section === 'system').map((item) => item.key),
      ['settings']
    )
    assert.equal(APP_NAVIGATION_SECTIONS.find((section) => section.key === 'system')?.placement, 'main')
  })

  it('keeps AI chat beside the computer tools', () => {
    assert.deepEqual(
      APP_NAVIGATION_ITEMS.filter((item) => item.section === 'computer').map((item) => item.key),
      ['system-monitor', 'system-info', 'codex-sessions', 'ai-chat', 'terminal']
    )
  })

  it('exposes only projects in simple mode', () => {
    assert.deepEqual(getNavigationItemsForMode('simple').map((item) => item.key), ['projects'])
    assert.deepEqual(getNavigationSectionsForMode('simple').map((section) => section.key), ['work'])
    assert.equal(isNavigationKeyVisible('simple', 'projects'), true)
    assert.equal(isNavigationKeyVisible('simple', 'settings'), false)
  })

  it('keeps the complete navigation in full mode', () => {
    assert.deepEqual(
      getNavigationItemsForMode('full').map((item) => item.key),
      APP_NAVIGATION_ITEMS.map((item) => item.key)
    )
    assert.deepEqual(
      getNavigationSectionsForMode('full').map((section) => section.key),
      APP_NAVIGATION_SECTIONS.map((section) => section.key)
    )
  })
})
