import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_TITLEBAR_PRODUCT_NAME, createAppTitlebarBreadcrumbs } from './app-titlebar-breadcrumb.js'

describe('app titlebar breadcrumbs', () => {
  it('keeps the product name as the default location', () => {
    assert.deepEqual(createAppTitlebarBreadcrumbs({ activeKey: 'overview' }), [APP_TITLEBAR_PRODUCT_NAME])
  })

  it('shows the selected project as a compact project label', () => {
    assert.deepEqual(
      createAppTitlebarBreadcrumbs({
        activeKey: 'projects',
        projectLocation: { name: 'Unipie', tabLabel: 'Log 树' }
      }),
      [APP_TITLEBAR_PRODUCT_NAME, '项目：Unipie']
    )
  })

  it('uses the active module below settings and navigation labels elsewhere', () => {
    assert.deepEqual(
      createAppTitlebarBreadcrumbs({ activeKey: 'settings', settingsModuleTitle: '外观' }),
      [APP_TITLEBAR_PRODUCT_NAME, '设置', '外观']
    )
    assert.deepEqual(createAppTitlebarBreadcrumbs({ activeKey: 'ai-tools' }), [APP_TITLEBAR_PRODUCT_NAME, 'AI 工具'])
  })
})
