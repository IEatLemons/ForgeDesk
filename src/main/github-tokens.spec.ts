import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  getGithubTokenSecret,
  inspectGithubToken,
  parseGithubScopes,
  saveGithubToken,
  listGithubTokens,
  refreshGithubToken
} from './github-tokens.js'

function createFetch(scopes: string, login = 'stone'): typeof fetch {
  return async () => new Response(JSON.stringify({ login }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-oauth-scopes': scopes
    }
  })
}

describe('github tokens', () => {
  it('parses OAuth scope headers', () => {
    assert.deepEqual(parseGithubScopes('repo, workflow, read:org'), ['repo', 'workflow', 'read:org'])
    assert.deepEqual(parseGithubScopes(''), [])
  })

  it('inspects a GitHub token without exposing the secret in views', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-github-tokens-'))

    try {
      const saved = await saveGithubToken(
        directory,
        {
          name: 'Release token',
          token: 'github_pat_secret_1234'
        },
        createFetch('repo, workflow')
      )
      const raw = JSON.parse(await readFile(join(directory, 'github-tokens.json'), 'utf8')) as { tokens: Array<{ token: string }> }

      assert.equal(raw.tokens[0]?.token, 'github_pat_secret_1234')
      assert.equal(saved.length, 1)
      assert.equal(saved[0]?.name, 'Release token')
      assert.equal(saved[0]?.tokenConfigured, true)
      assert.equal(saved[0]?.tokenLastFour, '1234')
      assert.equal(saved[0]?.githubLogin, 'stone')
      assert.deepEqual(saved[0]?.scopes, ['repo', 'workflow'])
      assert.equal(Object.hasOwn(saved[0] ?? {}, 'token'), false)
      assert.equal(await getGithubTokenSecret(directory, saved[0]?.id ?? ''), 'github_pat_secret_1234')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps stored permissions when renaming without a new token', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-github-tokens-'))

    try {
      const saved = await saveGithubToken(directory, { name: 'Release token', token: 'github_pat_secret_1234' }, createFetch('repo'))
      const renamed = await saveGithubToken(directory, { id: saved[0]?.id, name: 'Renamed release token' })

      assert.equal(renamed[0]?.name, 'Renamed release token')
      assert.deepEqual(renamed[0]?.scopes, ['repo'])
      assert.equal(await getGithubTokenSecret(directory, renamed[0]?.id ?? ''), 'github_pat_secret_1234')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('refreshes the stored token permission scopes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-github-tokens-'))

    try {
      const saved = await saveGithubToken(directory, { name: 'Release token', token: 'github_pat_secret_1234' }, createFetch('repo'))
      const refreshed = await refreshGithubToken(directory, saved[0]?.id ?? '', createFetch('repo, workflow'))

      assert.deepEqual(refreshed[0]?.scopes, ['repo', 'workflow'])
      assert.deepEqual((await listGithubTokens(directory))[0]?.scopes, ['repo', 'workflow'])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('surfaces GitHub validation failures', async () => {
    await assert.rejects(
      () => inspectGithubToken('bad-token', async () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 })),
      /Bad credentials/
    )
  })
})
