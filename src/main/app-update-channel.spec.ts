import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getAppUpdateChannel, shouldAllowPrereleaseUpdates } from './app-update-channel.js'

describe('app update channel', () => {
  it('keeps normal releases on the stable update channel', () => {
    assert.equal(getAppUpdateChannel('1.2.3'), 'stable')
    assert.equal(shouldAllowPrereleaseUpdates('1.2.3+build.7'), false)
  })

  it('allows prerelease builds to receive prerelease updates', () => {
    assert.equal(getAppUpdateChannel('1.2.3-beta.2'), 'prerelease')
    assert.equal(shouldAllowPrereleaseUpdates('1.2.3-rc.1+build.7'), true)
  })
})
