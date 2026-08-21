import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getLastGitIpcDiagnostic, serializeGitIpcPayload } from './git-ipc.js'

describe('Git IPC payloads', () => {
  it('serializes Git results as a JSON string and records its size', () => {
    const payload = serializeGitIpcPayload('repository:workspace-status', {
      branch: 'main',
      pushTargets: [{ remote: 'origin', branch: 'main', ahead: 2, hasRemoteBranch: true }]
    })

    assert.equal(typeof payload, 'string')
    assert.deepEqual(JSON.parse(payload), {
      branch: 'main',
      pushTargets: [{ remote: 'origin', branch: 'main', ahead: 2, hasRemoteBranch: true }]
    })
    assert.deepEqual(getLastGitIpcDiagnostic(), {
      channel: 'repository:workspace-status',
      bytes: Buffer.byteLength(payload, 'utf8'),
      recordedAt: getLastGitIpcDiagnostic()?.recordedAt
    })
  })

  it('normalizes BigInt values without allowing native values across IPC', () => {
    const payload = serializeGitIpcPayload('project:summary', { totalCommits: 4888n })

    assert.deepEqual(JSON.parse(payload), { totalCommits: '4888' })
  })

  it('rejects cyclic results before Electron attempts to serialize them', () => {
    const value: { self?: unknown } = {}
    value.self = value

    assert.throws(
      () => serializeGitIpcPayload('repository:detail', value),
      /Git IPC 数据无法序列化/
    )
    assert.equal(getLastGitIpcDiagnostic()?.channel, 'repository:detail')
    assert.equal(getLastGitIpcDiagnostic()?.bytes, 0)
  })
})
