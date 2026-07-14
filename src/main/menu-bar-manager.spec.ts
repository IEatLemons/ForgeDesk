import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createMenuBarPlatformSupport,
  defaultMenuBarManagerSettings,
  normalizeMenuBarManagerSettings,
  parseMenuBarHelperLine,
  resolveMenuBarHelperExecutablePath
} from './menu-bar-manager.js'

describe('menu bar manager', () => {
  it('normalizes menu bar settings with safe defaults', () => {
    const settings = normalizeMenuBarManagerSettings({
      enabled: true,
      showOnHover: true,
      autoRehideMs: 80,
      hiddenItemKeys: ['wifi', 'wifi', '', 'clock'],
      alwaysHiddenItemKeys: ['clock', 'battery'],
      hotkeys: {
        toggleHidden: {
          enabled: true,
          accelerator: ''
        }
      }
    })

    assert.equal(settings.enabled, true)
    assert.equal(settings.showOnHover, true)
    assert.equal(settings.autoRehideMs, 1000)
    assert.deepEqual(settings.hiddenItemKeys, ['wifi', 'clock'])
    assert.deepEqual(settings.alwaysHiddenItemKeys, ['battery'])
    assert.equal(settings.hotkeys.toggleHidden.accelerator, defaultMenuBarManagerSettings.hotkeys.toggleHidden.accelerator)
  })

  it('reports unsupported platforms and macOS versions', () => {
    assert.deepEqual(createMenuBarPlatformSupport('linux', '6.0.0'), {
      supported: false,
      platform: 'linux',
      macosMajorVersion: null,
      reason: 'unsupported-platform',
      message: '菜单栏整理只支持 macOS。'
    })

    assert.deepEqual(createMenuBarPlatformSupport('darwin', '22.6.0'), {
      supported: false,
      platform: 'darwin',
      macosMajorVersion: 13,
      reason: 'unsupported-version',
      message: '菜单栏整理需要 macOS 14 或更高版本。'
    })

    assert.equal(createMenuBarPlatformSupport('darwin', '23.0.0').supported, true)
  })

  it('resolves helper executable paths for development and packaged builds', () => {
    assert.equal(
      resolveMenuBarHelperExecutablePath({
        appPath: '/Users/stone/develop/stone/ForgeDesk',
        isPackaged: false,
        resourcesPath: '/Applications/ForgeDesk.app/Contents/Resources'
      }),
      '/Users/stone/develop/stone/ForgeDesk/resources/MenuBarHelper/ForgeDeskMenuBarHelper.app/Contents/MacOS/ForgeDeskMenuBarHelper'
    )

    assert.equal(
      resolveMenuBarHelperExecutablePath({
        appPath: '/Applications/ForgeDesk.app/Contents/Resources/app.asar',
        isPackaged: true,
        resourcesPath: '/Applications/ForgeDesk.app/Contents/Resources'
      }),
      '/Applications/ForgeDesk.app/Contents/Resources/MenuBarHelper/ForgeDeskMenuBarHelper.app/Contents/MacOS/ForgeDeskMenuBarHelper'
    )
  })

  it('parses helper JSON-RPC lines', () => {
    assert.deepEqual(parseMenuBarHelperLine('{"id":"1","result":{"ok":true}}'), {
      id: '1',
      result: {
        ok: true
      }
    })

    assert.deepEqual(parseMenuBarHelperLine('{"method":"ready","params":{"items":[]}}'), {
      method: 'ready',
      params: {
        items: []
      }
    })

    assert.throws(() => parseMenuBarHelperLine('{}'), /must include an id or method/)
  })
})
