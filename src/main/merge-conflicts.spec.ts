import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractConflictSections, hasConflictMarkers } from './merge-conflicts.js'

describe('merge conflicts', () => {
  it('extracts one conflict section', () => {
    const content = ['before', '<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature', 'after'].join('\n')

    assert.equal(hasConflictMarkers(content), true)
    assert.deepEqual(extractConflictSections(content), [
      {
        index: 1,
        currentLabel: 'HEAD',
        incomingLabel: 'feature',
        currentContent: 'ours',
        incomingContent: 'theirs',
        rawContent: ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature'].join('\n')
      }
    ])
  })

  it('returns an empty list for normal text', () => {
    assert.equal(hasConflictMarkers('const value = 1\n'), false)
    assert.deepEqual(extractConflictSections('const value = 1\n'), [])
  })
})
