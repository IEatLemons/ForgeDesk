import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { acquireSingleProcessFileLock } from './instance-lock.js'

describe('single process file lock', () => {
  it('allows one owner and releases only its own lock file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'forgedesk-instance-lock-'))
    const lockPath = join(directory, 'runtime', 'instance.lock')

    try {
      const release = acquireSingleProcessFileLock(lockPath, { pid: 1234 })
      assert.ok(release)
      assert.equal(readFileSync(lockPath, 'utf8'), '1234\n')
      assert.equal(acquireSingleProcessFileLock(lockPath, { isProcessAlive: () => true, pid: 5678 }), null)

      release()
      const nextRelease = acquireSingleProcessFileLock(lockPath, { pid: 5678 })
      assert.ok(nextRelease)
      nextRelease()
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('replaces a stale lock left by a crashed process', () => {
    const directory = mkdtempSync(join(tmpdir(), 'forgedesk-instance-lock-'))
    const lockPath = join(directory, 'instance.lock')

    try {
      writeFileSync(lockPath, '4321\n')
      const release = acquireSingleProcessFileLock(lockPath, { isProcessAlive: () => false, pid: 5678 })
      assert.ok(release)
      assert.equal(readFileSync(lockPath, 'utf8'), '5678\n')
      release()
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
