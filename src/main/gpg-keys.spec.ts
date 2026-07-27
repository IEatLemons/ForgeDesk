import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createGpgImportPlan, parseGpgSecretKeys } from './gpg-keys.js'

describe('gpg key management', () => {
  it('parses secret keys from gpg colon output', () => {
    const output = [
      'sec:u:4096:1:0123456789ABCDEF:1704067200:1735689600::u:::scESC:::+:::23::0:',
      'fpr:::::::::0123456789ABCDEF0123456789ABCDEF01234567:',
      'uid:u::::1710000000::ABCDEF::Stone Example <stone@example.com>::::::::::0:',
      'ssb:u:4096:1:FEDCBA9876543210:1710000001::::::::e:::+:::23:',
      'fpr:::::::::FEDCBA9876543210FEDCBA9876543210FEDCBA98:',
      ''
    ].join('\n')

    assert.deepEqual(parseGpgSecretKeys(output), [
      {
        keyId: '0123456789ABCDEF',
        fingerprint: '0123456789ABCDEF0123456789ABCDEF01234567',
        algorithm: 'RSA',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2025-01-01T00:00:00.000Z',
        trust: 'u',
        capabilities: 'scESC',
        userIds: [{ uid: 'Stone Example <stone@example.com>', name: 'Stone Example', email: 'stone@example.com' }]
      }
    ])
  })

  it('finds key and ownertrust files from an imported bundle directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-gpg-import-'))

    try {
      await mkdir(join(directory, 'nested'))
      await writeFile(join(directory, 'stone_git_signing_private_key.asc'), '-----BEGIN PGP PRIVATE KEY BLOCK-----\n')
      await writeFile(join(directory, 'stone_git_signing_public_key.asc'), '-----BEGIN PGP PUBLIC KEY BLOCK-----\n')
      await writeFile(join(directory, 'nested', 'otrust.txt'), '0123456789ABCDEF0123456789ABCDEF01234567:6:\n')
      await writeFile(join(directory, 'README.md'), 'ignore me')

      assert.deepEqual(await createGpgImportPlan(directory), {
        keyFiles: [join(directory, 'stone_git_signing_private_key.asc'), join(directory, 'stone_git_signing_public_key.asc')],
        ownerTrustFiles: [join(directory, 'nested', 'otrust.txt')]
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
