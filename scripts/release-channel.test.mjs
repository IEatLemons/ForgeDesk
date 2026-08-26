import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getReleaseChannel } from './release-channel.mjs'

describe('release channel', () => {
  it('identifies stable GitHub releases', () => {
    assert.equal(getReleaseChannel('v1.2.3'), 'stable')
    assert.equal(getReleaseChannel('v1.2.3+build.7'), 'stable')
  })

  it('identifies prerelease GitHub releases', () => {
    assert.equal(getReleaseChannel('v1.2.3-beta.2'), 'prerelease')
    assert.equal(getReleaseChannel('v1.2.3-rc.1+build.7'), 'prerelease')
  })

  it('rejects malformed release tags', () => {
    assert.throws(() => getReleaseChannel('release-1.2.3'), /Invalid release tag/)
  })
})
