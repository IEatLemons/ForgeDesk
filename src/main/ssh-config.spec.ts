import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { readSshConfigFile, writeSshConfigFile } from './ssh-config.js'

describe('ssh config file', () => {
  it('returns the fixed config path with empty content when the file does not exist', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ssh-config-'))

    try {
      const config = await readSshConfigFile(join(directory, '.ssh'))

      assert.equal(config.path, join(directory, '.ssh', 'config'))
      assert.equal(config.content, '')
      assert.equal(config.exists, false)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('creates the ssh directory and saves config content with private file permissions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ssh-config-'))
    const sshDirectory = join(directory, '.ssh')
    const content = [
      'Host github-work',
      '  HostName ssh.github.com',
      '  User git',
      '  Port 443',
      '  IdentityFile ~/.ssh/id_ed25519_work',
      ''
    ].join('\n')

    try {
      const config = await writeSshConfigFile(sshDirectory, content)
      const fileMode = (await stat(config.path)).mode & 0o777

      assert.equal(config.path, join(sshDirectory, 'config'))
      assert.equal(config.content, content)
      assert.equal(config.exists, true)
      assert.equal(await readFile(config.path, 'utf8'), content)
      assert.equal(fileMode, 0o600)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
