import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  closeProjectSettingsModule,
  createInitialProjectSettingsView,
  getProjectSettingsModulesForCategory,
  openProjectSettingsModule,
  PROJECT_SETTINGS_CATEGORIES,
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
      ['basic', 'people', 'branches', 'git', 'services', 'release', 'cloudflare', 'plane']
    )
  })

  it('groups every project settings module once by business scope', () => {
    assert.deepEqual(
      PROJECT_SETTINGS_CATEGORIES.map((category) => ({
        key: category.key,
        title: category.title,
        modules: category.moduleKeys
      })),
      [
        { key: 'project', title: '项目与成员', modules: ['basic', 'people'] },
        { key: 'git', title: 'Git 与仓库', modules: ['git', 'branches'] },
        { key: 'delivery', title: '服务与发布', modules: ['services', 'release', 'cloudflare'] },
        { key: 'collaboration', title: '协作与集成', modules: ['plane'] }
      ]
    )

    const groupedKeys = PROJECT_SETTINGS_CATEGORIES.flatMap((category) => category.moduleKeys)

    assert.equal(new Set(groupedKeys).size, PROJECT_SETTINGS_MODULES.length)
    assert.deepEqual([...groupedKeys].sort(), PROJECT_SETTINGS_MODULES.map((module) => module.key).sort())
    assert.deepEqual(getProjectSettingsModulesForCategory('git').map((module) => module.key), ['git', 'branches'])
  })

  it('opens a single settings module and returns to the list', () => {
    const detail = openProjectSettingsModule('people')

    assert.equal(detail.mode, 'detail')
    assert.equal(detail.activeModuleKey, 'people')
    assert.deepEqual(closeProjectSettingsModule(), createInitialProjectSettingsView())
  })
})
