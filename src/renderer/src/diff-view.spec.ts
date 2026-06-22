import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDiffResultLines, createSourceDiffLines } from './diff-view.js'

describe('diff view helpers', () => {
  it('builds a merged side-by-side result with additions and deletions highlighted on the right', () => {
    const sourceLines = createSourceDiffLines('alpha\nbeta\ngamma')
    const resultLines = createDiffResultLines({
      oldContent: 'alpha\nbeta\ngamma',
      newContent: 'alpha\nBETTER\ngamma\ndelta',
      patch: [
        '@@ -1,3 +1,4 @@',
        ' alpha',
        '-beta',
        '+BETTER',
        ' gamma',
        '+delta'
      ].join('\n')
    })

    assert.deepEqual(
      sourceLines.map((line) => ({ type: line.type, text: line.text, oldLineNumber: line.oldLineNumber })),
      [
        { type: 'context', text: 'alpha', oldLineNumber: 1 },
        { type: 'context', text: 'beta', oldLineNumber: 2 },
        { type: 'context', text: 'gamma', oldLineNumber: 3 }
      ]
    )
    assert.deepEqual(
      resultLines.map((line) => ({
        type: line.type,
        text: line.text,
        oldLineNumber: line.oldLineNumber,
        newLineNumber: line.newLineNumber
      })),
      [
        { type: 'context', text: 'alpha', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'delete', text: 'beta', oldLineNumber: 2, newLineNumber: undefined },
        { type: 'add', text: 'BETTER', oldLineNumber: undefined, newLineNumber: 2 },
        { type: 'context', text: 'gamma', oldLineNumber: 3, newLineNumber: 3 },
        { type: 'add', text: 'delta', oldLineNumber: undefined, newLineNumber: 4 }
      ]
    )
  })

  it('accepts escaped newline patch text from preview fixtures', () => {
    const resultLines = createDiffResultLines({
      oldContent: 'CFBundleVersion 42',
      newContent: 'CFBundleVersion 43',
      patch: '@@ -1,1 +1,1 @@\\n-CFBundleVersion 42\\n+CFBundleVersion 43'
    })

    assert.deepEqual(
      resultLines.map((line) => ({ type: line.type, text: line.text })),
      [
        { type: 'delete', text: 'CFBundleVersion 42' },
        { type: 'add', text: 'CFBundleVersion 43' }
      ]
    )
  })
})
