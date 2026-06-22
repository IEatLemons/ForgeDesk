import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildGitAuthorLookup, resolveGitAuthorDisplay } from './git-author-mapping.js'

describe('git author mapping', () => {
  it('uses the mapped project person name while keeping the commit email visible', () => {
    const lookup = buildGitAuthorLookup([
      {
        id: 'person_1',
        displayName: 'Stone',
        identities: [
          { name: 'nksqw98btv', email: 'nksqw98btv@users.noreply.github.com' },
          { name: 'Stone', email: 'syj88668@gmail.com' }
        ]
      }
    ])

    assert.deepEqual(
      resolveGitAuthorDisplay(
        {
          authorName: 'nksqw98btv',
          authorEmail: 'nksqw98btv@users.noreply.github.com'
        },
        lookup
      ),
      {
        authorDisplayName: 'Stone',
        authorDisplayEmail: 'nksqw98btv@users.noreply.github.com',
        mappedPersonId: 'person_1'
      }
    )
  })

  it('falls back to the mapped person email when the commit has no email', () => {
    const lookup = buildGitAuthorLookup([
      {
        id: 'person_2',
        displayName: 'HengJing',
        identities: [
          { name: 'HengJing', email: '' },
          { name: 'HengJing', email: '982246809@qq.com' }
        ]
      }
    ])

    assert.deepEqual(resolveGitAuthorDisplay({ authorName: 'HengJing', authorEmail: '' }, lookup), {
      authorDisplayName: 'HengJing',
      authorDisplayEmail: '982246809@qq.com',
      mappedPersonId: 'person_2'
    })
  })
})
