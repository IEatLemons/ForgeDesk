import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveDesktopPackaging } from './package-desktop.mjs'

describe('desktop packaging target resolution', () => {
  it('builds a universal macOS package on macOS hosts', () => {
    assert.deepEqual(resolveDesktopPackaging('darwin', 'arm64'), {
      platform: 'darwin', arch: 'arm64', builderArgs: ['--mac', '--universal'], universalMacHelper: true
    })
  })

  it('builds native Windows and Linux x64 packages', () => {
    assert.deepEqual(resolveDesktopPackaging('win32', 'x64').builderArgs, ['--win', '--x64'])
    assert.deepEqual(resolveDesktopPackaging('linux', 'x64').builderArgs, ['--linux', '--x64'])
  })

  it('rejects unsupported hosts', () => {
    assert.throws(() => resolveDesktopPackaging('linux', 'arm64'), /不支持/)
    assert.throws(() => resolveDesktopPackaging('freebsd', 'x64'), /不支持/)
  })
})
