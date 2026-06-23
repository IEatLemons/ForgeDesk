import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, it } from 'node:test'
import { importSshKeyFile, normalizeSshKeyFileName, readSshKeyInventory } from './ssh-keys.js'

const privateKeyContent = [
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA=',
  '-----END OPENSSH PRIVATE KEY-----',
  ''
].join('\n')

const publicKeyContent = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey user@example.com\n'

describe('ssh key management', () => {
  it('lists private and public keys independently with pair status', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ssh-keys-'))
    const sshDirectory = join(directory, '.ssh')

    try {
      await mkdir(sshDirectory)
      await writeFile(join(sshDirectory, 'github-work'), privateKeyContent)
      await chmod(join(sshDirectory, 'github-work'), 0o644)
      await writeFile(join(sshDirectory, 'github-work.pub'), publicKeyContent)
      await writeFile(join(sshDirectory, 'orphan.pub'), 'ssh-ed25519 AAAAC3NzaOrphan orphan@example.com\n')
      await writeFile(join(sshDirectory, 'config'), 'Host github\n')

      const inventory = await readSshKeyInventory(
        sshDirectory,
        async (path) => `fingerprint:${basename(path)}`,
        new Set([join(sshDirectory, 'github-work')])
      )

      assert.deepEqual(
        inventory.sshPrivateKeys.map((key) => key.fileName),
        ['github-work']
      )
      assert.deepEqual(
        inventory.sshPublicKeys.map((key) => key.fileName),
        ['github-work.pub', 'orphan.pub']
      )
      assert.equal(inventory.sshPrivateKeys[0].hasPublicKey, true)
      assert.equal(inventory.sshPrivateKeys[0].publicKeyPath, join(sshDirectory, 'github-work.pub'))
      assert.equal(inventory.sshPrivateKeys[0].mode, '0644')
      assert.equal(inventory.sshPrivateKeys[0].needsPermissionFix, true)
      assert.equal(inventory.sshPrivateKeys[0].hasPassphrase, true)
      assert.equal(inventory.sshPublicKeys[0].pairedPrivateKeyPath, join(sshDirectory, 'github-work'))
      assert.equal(inventory.sshPublicKeys[1].pairedPrivateKeyPath, '')
      assert.equal(inventory.sshPublicKeys[0].fingerprint, 'fingerprint:github-work.pub')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('normalizes and rejects unsafe key file names', () => {
    assert.equal(normalizeSshKeyFileName('github-work', 'private'), 'github-work')
    assert.equal(normalizeSshKeyFileName('github-work', 'public'), 'github-work.pub')
    assert.throws(() => normalizeSshKeyFileName('../github-work', 'private'), /只能包含/)
    assert.throws(() => normalizeSshKeyFileName('config', 'private'), /保留文件/)
    assert.throws(() => normalizeSshKeyFileName('github-work.pub', 'private'), /私钥文件名不能以 .pub 结尾/)
  })

  it('imports private and public keys with managed permissions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ssh-keys-'))
    const sshDirectory = join(directory, '.ssh')
    const sourcePrivatePath = join(directory, 'source_private')
    const sourcePublicPath = join(directory, 'source_public.pub')

    try {
      await writeFile(sourcePrivatePath, privateKeyContent)
      await writeFile(sourcePublicPath, publicKeyContent)

      const privateKey = await importSshKeyFile(sshDirectory, { kind: 'private', sourcePath: sourcePrivatePath, fileName: 'github-work' })
      const publicKey = await importSshKeyFile(sshDirectory, { kind: 'public', sourcePath: sourcePublicPath, fileName: 'github-work' })

      assert.equal(privateKey.fileName, 'github-work')
      assert.equal(publicKey.fileName, 'github-work.pub')
      assert.equal(await readFile(privateKey.path, 'utf8'), privateKeyContent)
      assert.equal(await readFile(publicKey.path, 'utf8'), publicKeyContent)
      assert.equal((await stat(privateKey.path)).mode & 0o777, 0o600)
      assert.equal((await stat(publicKey.path)).mode & 0o777, 0o644)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
