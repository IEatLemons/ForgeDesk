import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRepositoryTagSyncSnapshot, canPushTagToRemote, parseLocalTagRefs, parseRemoteTagRefs } from './git-tag-sync.js'

describe('repository tag synchronization', () => {
  it('resolves lightweight and annotated local and remote tags to commits', () => {
    assert.deepEqual(
      parseLocalTagRefs('v1.0.0\0\0lightweight\nv1.1.0\0peeled\0tag-object\n'),
      new Map([['v1.0.0', 'lightweight'], ['v1.1.0', 'peeled']])
    )
    assert.deepEqual(
      parseRemoteTagRefs('tag-object\trefs/tags/v1.1.0\npeeled\trefs/tags/v1.1.0^{}\nlightweight\trefs/tags/v1.0.0\n'),
      new Map([['v1.1.0', 'peeled'], ['v1.0.0', 'lightweight']])
    )
  })

  it('classifies synced, missing, diverged, remote-only and unavailable tags across every remote', () => {
    const snapshot = buildRepositoryTagSyncSnapshot({
      repositoryId: 'repo-1',
      localTags: new Map([['v1.0.0', 'a'], ['v1.1.0', 'b'], ['v1.2.0', 'c']]),
      remoteSources: [
        { remoteName: 'origin', tags: new Map([['v1.0.0', 'a'], ['v1.1.0', 'other'], ['v2.0.0', 'd']]) },
        { remoteName: 'deploy', tags: new Map(), error: '认证失败' }
      ],
      checkedAt: '2026-08-24T00:00:00.000Z'
    })

    const tag = (name: string) => snapshot.tags.find((item) => item.name === name)
    assert.equal(tag('v1.0.0')?.remotes[0]?.state, 'synced')
    assert.equal(tag('v1.1.0')?.remotes[0]?.state, 'diverged')
    assert.equal(tag('v1.2.0')?.remotes[0]?.state, 'missing')
    assert.equal(tag('v2.0.0')?.localCommit, '')
    assert.equal(tag('v2.0.0')?.remotes[0]?.state, 'remote-only')
    assert.equal(tag('v1.0.0')?.remotes[1]?.state, 'unavailable')
    assert.equal(canPushTagToRemote(tag('v1.2.0'), 'origin'), true)
    assert.equal(canPushTagToRemote(tag('v1.1.0'), 'origin'), false)
  })
})
