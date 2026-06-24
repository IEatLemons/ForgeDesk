import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ensureNodePtySpawnHelperPermissions, getNodePtySpawnHelperPath } from './node-pty-factory.js'

describe('node pty factory helpers', () => {
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
