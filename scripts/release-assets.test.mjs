import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getExpectedReleaseAssetNames, getMissingReleaseAssets } from './release-assets.mjs'

describe('release assets', () => {
  it('defines updater assets for every supported desktop platform', () => {
    assert.deepEqual(getExpectedReleaseAssetNames('1.2.3', 'mac'), [
      'ForgeDesk-1.2.3-universal.dmg', 'ForgeDesk-1.2.3-universal.dmg.blockmap',
      'ForgeDesk-1.2.3-universal.zip', 'ForgeDesk-1.2.3-universal.zip.blockmap', 'latest-mac.yml'
    ])
    assert.deepEqual(getExpectedReleaseAssetNames('1.2.3', 'win'), [
      'ForgeDesk-1.2.3-x64.exe', 'ForgeDesk-1.2.3-x64.exe.blockmap', 'latest.yml'
    ])
    assert.deepEqual(getExpectedReleaseAssetNames('1.2.3', 'linux'), [
      'ForgeDesk-1.2.3-x64.AppImage', 'ForgeDesk-1.2.3-x64.AppImage.blockmap', 'latest-linux.yml'
    ])
  })

  it('reports every missing asset', () => {
    assert.deepEqual(getMissingReleaseAssets({ version: '1.2.3', platform: 'win', directory: '/definitely-missing' }), [
      'ForgeDesk-1.2.3-x64.exe', 'ForgeDesk-1.2.3-x64.exe.blockmap', 'latest.yml'
    ])
  })
})
