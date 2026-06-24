import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPublishPlan, getReleaseTagName } from './publish-mac-helpers.mjs'

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
})
