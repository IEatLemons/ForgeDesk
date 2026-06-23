import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  clearSshPassphrase,
  createSshPassphraseAskpass,
  listSshPassphrasePaths,
  readSshPassphrases,
  saveSshPassphrase,
  withSshPassphraseAskpass
} from './ssh-passphrases.js'

function runAskpass(command: string, prompt: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, [prompt], { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }

      resolve(stdout)
    })
  })
}

describe('ssh private key passphrases', () => {
  it('persists passphrases by private key path and exposes only configured paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ssh-passphrases-'))
    const keyPath = join(directory, '.ssh', 'github-work')

    try {
      await saveSshPassphrase(directory, keyPath, 's3cr3t')

      assert.deepEqual(await listSshPassphrasePaths(directory), new Set([keyPath]))
      assert.deepEqual(await readSshPassphrases(directory), [{ path: keyPath, passphrase: 's3cr3t' }])

      await clearSshPassphrase(directory, keyPath)
      assert.deepEqual(await listSshPassphrasePaths(directory), new Set())
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('creates a temporary SSH_ASKPASS helper that answers matching key prompts and cleans itself up', async () => {
    const keyPath = join(tmpdir(), 'id_ed25519_work')
    const askpass = await createSshPassphraseAskpass([{ path: keyPath, passphrase: 's3cr3t' }])

    try {
      assert.equal(askpass.env.SSH_ASKPASS_REQUIRE, 'force')
      assert.equal(askpass.env.SSH_ASKPASS, askpass.path)
      assert.ok(askpass.env.DISPLAY)
      assert.equal(await runAskpass(askpass.path, `Enter passphrase for key '${keyPath}':`, { ...process.env, ...askpass.env }), 's3cr3t\n')
    } finally {
      await askpass.cleanup()
    }

    await assert.rejects(() => stat(askpass.directory))
  })

  it('wraps operations with askpass only when passphrases are configured', async () => {
    const keyPath = join(tmpdir(), 'id_ed25519_wrapped')
    const withoutAskpass = await withSshPassphraseAskpass([], async (env) => env.SSH_ASKPASS ?? '')

    assert.equal(withoutAskpass, '')

    const withAskpass = await withSshPassphraseAskpass([{ path: keyPath, passphrase: 'wrapped-secret' }], async (env) => {
      assert.ok(env.SSH_ASKPASS)
      return runAskpass(env.SSH_ASKPASS, `Enter passphrase for key '${keyPath}':`, { ...process.env, ...env })
    })

    assert.equal(withAskpass, 'wrapped-secret\n')
  })
})
