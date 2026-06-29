import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ensureNodePtySpawnHelperPermissions,
  getNodePtySpawnHelperPath,
  resolveNodePtyPackageJsonPath
} from './node-pty-factory.js'

describe('node pty factory helpers', () => {
  it('maps packaged asar paths to app.asar.unpacked', () => {
    assert.equal(
      resolveNodePtyPackageJsonPath(
        '/Applications/ForgeDesk.app/Contents/Resources/app.asar/node_modules/node-pty/package.json'
      ),
      '/Applications/ForgeDesk.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/package.json'
    )
  })

  it('repairs macOS spawn-helper permissions when execute bits are missing', () => {
    const packagePath = '/tmp/node_modules/node-pty/package.json'
    const helperPath = getNodePtySpawnHelperPath(packagePath, 'arm64')
    const chmods: Array<{ path: string; mode: number }> = []

    const repairedPath = ensureNodePtySpawnHelperPermissions({
      arch: 'arm64',
      fs: {
        chmodSync: (path, mode) => chmods.push({ path, mode }),
        existsSync: (path) => path === helperPath,
        statSync: () => ({ mode: 0o100644 })
      },
      nodePtyPackagePath: packagePath,
      platform: 'darwin'
    })

    assert.equal(repairedPath, helperPath)
    assert.deepEqual(chmods, [{ path: helperPath, mode: 0o100755 }])
  })

  it('does not mutate packaged app bundles when spawn-helper permissions are missing', () => {
    const packagePath =
      '/Applications/ForgeDesk.app/Contents/Resources/app.asar/node_modules/node-pty/package.json'
    const helperPath =
      '/Applications/ForgeDesk.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper'
    const chmods: Array<{ path: string; mode: number }> = []

    assert.throws(
      () =>
        ensureNodePtySpawnHelperPermissions({
          arch: 'arm64',
          fs: {
            chmodSync: (path, mode) => chmods.push({ path, mode }),
            existsSync: (path) => path === helperPath,
            statSync: () => ({ mode: 0o100644 })
          },
          nodePtyPackagePath: packagePath,
          platform: 'darwin'
        }),
      /重新打包应用/
    )
    assert.deepEqual(chmods, [])
  })

  it('accepts executable spawn-helper permissions inside packaged app bundles', () => {
    const packagePath =
      '/Applications/ForgeDesk.app/Contents/Resources/app.asar/node_modules/node-pty/package.json'
    const helperPath =
      '/Applications/ForgeDesk.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper'

    const repairedPath = ensureNodePtySpawnHelperPermissions({
      arch: 'arm64',
      fs: {
        chmodSync: () => assert.fail('packaged app bundles should not be mutated at runtime'),
        existsSync: (path) => path === helperPath,
        statSync: () => ({ mode: 0o100755 })
      },
      nodePtyPackagePath: packagePath,
      platform: 'darwin'
    })

    assert.equal(repairedPath, helperPath)
  })

  it('skips safely outside macOS or when the helper is absent', () => {
    const fs = {
      chmodSync: () => assert.fail('chmod should not run'),
      existsSync: () => false,
      statSync: () => {
        assert.fail('stat should not run')
      }
    }

    assert.equal(
      ensureNodePtySpawnHelperPermissions({
        fs,
        nodePtyPackagePath: '/tmp/node_modules/node-pty/package.json',
        platform: 'linux'
      }),
      null
    )
    assert.equal(
      ensureNodePtySpawnHelperPermissions({
        fs,
        nodePtyPackagePath: '/tmp/node_modules/node-pty/package.json',
        platform: 'darwin'
      }),
      null
    )
  })
})
