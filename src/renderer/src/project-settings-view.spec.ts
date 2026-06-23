import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  closeProjectSettingsModule,
  createInitialProjectSettingsView,
  openProjectSettingsModule,
  PROJECT_SETTINGS_MODULES
} from './project-settings-view.js'

describe('project settings view helpers', () => {
  it('starts on the settings module list', () => {
    const view = createInitialProjectSettingsView()

    assert.equal(view.activeModuleKey, null)
    assert.equal(view.mode, 'list')
  })

  it('defines the project settings modules in the intended entry order', () => {
    assert.deepEqual(
      PROJECT_SETTINGS_MODULES.map((module) => module.key),
      ['basic', 'people', 'branches', 'repositories', 'remotes', 'services', 'commands']
    )
  })

  it('opens a single settings module and returns to the list', () => {
    const detail = openProjectSettingsModule('people')

    assert.equal(detail.mode, 'detail')
    assert.equal(detail.activeModuleKey, 'people')
    assert.deepEqual(closeProjectSettingsModule(), createInitialProjectSettingsView())
  })
})
