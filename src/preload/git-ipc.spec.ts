import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseGitIpcPayload } from './git-ipc.js'

describe('preload Git IPC payload parsing', () => {
  it('parses a JSON response while preserving the public result shape', () => {
    assert.deepEqual(parseGitIpcPayload<{ branch: string }>('repository:workspace-status', '{"branch":"main"}'), {
      branch: 'main'
    })
  })

  it('rejects non-string and malformed responses', () => {
    assert.throws(() => parseGitIpcPayload('repository:detail', { id: 'repo-1' }), /返回格式无效/)
    assert.throws(() => parseGitIpcPayload('repository:detail', '{bad json'), /返回数据损坏/)
  })
})
