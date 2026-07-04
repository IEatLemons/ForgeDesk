import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertMacReleaseAssetsComplete,
  createPublishPlan,
  getExpectedMacReleaseAssetNames,
  getReleaseTagName
} from './publish-mac-helpers.mjs'

describe('publish mac helpers', () => {
  it('creates a v-prefixed release tag from package version', () => {
    assert.equal(getReleaseTagName({ version: '1.0.2' }), 'v1.0.2')
  })

  it('stops releases from a dirty worktree by default', () => {
    assert.throws(
      () =>
        createPublishPlan({
          version: '1.0.2',
          headCommit: 'abc123',
          isDirty: true,
          localTagCommit: '',
          remoteTagCommit: '',
          allowDirtyRelease: false
        }),
      /工作区还有未提交的改动/
    )
  })

  it('creates and pushes the tag when it is missing locally and remotely', () => {
    const plan = createPublishPlan({
      version: '1.0.2',
      headCommit: 'abc123',
      isDirty: false,
      localTagCommit: '',
      remoteTagCommit: '',
      allowDirtyRelease: false
    })

    assert.equal(plan.tagName, 'v1.0.2')
    assert.equal(plan.shouldCreateLocalTag, true)
    assert.equal(plan.shouldPushTag, true)
  })

  it('pushes an existing local tag when the remote tag is missing', () => {
    const plan = createPublishPlan({
      version: '1.0.2',
      headCommit: 'abc123',
      isDirty: false,
      localTagCommit: 'abc123',
      remoteTagCommit: '',
      allowDirtyRelease: false
    })

    assert.equal(plan.shouldCreateLocalTag, false)
    assert.equal(plan.shouldPushTag, true)
  })

  it('rejects tags that point at a different commit', () => {
    assert.throws(
      () =>
        createPublishPlan({
          version: '1.0.2',
          headCommit: 'abc123',
          isDirty: false,
          localTagCommit: 'def456',
          remoteTagCommit: '',
          allowDirtyRelease: false
        }),
      /不是当前提交/
    )
  })

  it('expects updater metadata and every generated mac artifact in the release', () => {
    const assetNames = getExpectedMacReleaseAssetNames({
      version: '1.0.8',
      distFiles: [
        'ForgeDesk-1.0.8-arm64.dmg',
        'ForgeDesk-1.0.8-arm64.dmg.blockmap',
        'ForgeDesk-1.0.8-arm64.zip',
        'ForgeDesk-1.0.8-arm64.zip.blockmap',
        'latest-mac.yml',
        'builder-effective-config.yaml'
      ]
    })

    assert.deepEqual(assetNames, [
      'ForgeDesk-1.0.8-arm64.dmg',
      'ForgeDesk-1.0.8-arm64.dmg.blockmap',
      'ForgeDesk-1.0.8-arm64.zip',
      'ForgeDesk-1.0.8-arm64.zip.blockmap',
      'latest-mac.yml'
    ])
  })

  it('fails release validation when latest-mac.yml is missing remotely', () => {
    assert.throws(
      () =>
        assertMacReleaseAssetsComplete({
          tagName: 'v1.0.8',
          expectedAssetNames: [
            'ForgeDesk-1.0.8-arm64.dmg',
            'ForgeDesk-1.0.8-arm64.dmg.blockmap',
            'ForgeDesk-1.0.8-arm64.zip',
            'ForgeDesk-1.0.8-arm64.zip.blockmap',
            'latest-mac.yml'
          ],
          existingAssetNames: ['ForgeDesk-1.0.8-arm64.dmg.blockmap']
        }),
      /v1\.0\.8.*latest-mac\.yml/
    )
  })
})
