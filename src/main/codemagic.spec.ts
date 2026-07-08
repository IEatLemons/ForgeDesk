import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  getCodemagicTokenSecret,
  inspectCodemagicToken,
  listCodemagicApps,
  mapCodemagicBuild,
  saveCodemagicToken,
  startCodemagicBuild
} from './codemagic.js'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('codemagic adapter', () => {
  it('inspects and stores Codemagic tokens without exposing the secret', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codemagic-tokens-'))
    const fetchImpl: typeof fetch = async (input, init) => {
      assert.equal((init?.headers as Record<string, string>)['x-auth-token'], 'cm_secret_1234')
      const url = String(input)

      if (url.includes('/api/v3/user/teams')) {
        return jsonResponse({ data: [{ id: 'team-1', name: 'Team' }], current_page: 1, total_pages: 1, page_size: 1 })
      }

      if (url.includes('/api/v3/user/apps')) {
        return jsonResponse({ data: [{ id: 'app-1', name: 'Mobile', last_build_id: null }], current_page: 1, total_pages: 1, page_size: 1 })
      }

      return jsonResponse({ data: { id: 'user-1', permissions: {} } })
    }

    try {
      const saved = await saveCodemagicToken(directory, { name: 'Mobile builds', token: 'cm_secret_1234' }, fetchImpl)
      const raw = JSON.parse(await readFile(join(directory, 'codemagic-tokens.json'), 'utf8')) as { tokens: Array<{ token: string }> }

      assert.equal(raw.tokens[0]?.token, 'cm_secret_1234')
      assert.equal(saved[0]?.name, 'Mobile builds')
      assert.equal(saved[0]?.tokenLastFour, '1234')
      assert.equal(saved[0]?.tokenConfigured, true)
      assert.equal(saved[0]?.userId, 'user-1')
      assert.equal(saved[0]?.teamCount, 1)
      assert.equal(saved[0]?.appCount, 1)
      assert.equal(Object.hasOwn(saved[0] ?? {}, 'token'), false)
      assert.equal(await getCodemagicTokenSecret(directory, saved[0]?.id ?? ''), 'cm_secret_1234')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('surfaces Codemagic token validation failures', async () => {
    await assert.rejects(
      () => inspectCodemagicToken('bad-token', async () => jsonResponse({ detail: 'Invalid API token' }, 401)),
      /Invalid API token/
    )
  })

  it('paginates app lists and preserves team metadata', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input))
      assert.equal(url.pathname, '/api/v3/teams/team-1/apps')
      assert.equal(url.searchParams.get('name'), 'Mobile')

      if (url.searchParams.get('page') === '1') {
        return jsonResponse({
          data: [{ id: 'app-1', name: 'Mobile iOS', repository: { url: 'git@github.com:org/mobile.git' }, settings_source: 'yaml' }],
          current_page: 1,
          total_pages: 2,
          page_size: 100
        })
      }

      return jsonResponse({
        data: [{ id: 'app-2', name: 'Mobile Android', project_type: 'flutter-app' }],
        current_page: 2,
        total_pages: 2,
        page_size: 100
      })
    }

    const apps = await listCodemagicApps('token', { teamId: 'team-1', name: 'Mobile' }, fetchImpl)

    assert.deepEqual(apps.map((app) => app.id), ['app-1', 'app-2'])
    assert.equal(apps[0]?.teamId, 'team-1')
    assert.equal(apps[0]?.repositoryUrl, 'git@github.com:org/mobile.git')
  })

  it('starts builds with x-auth-token and branch/tag payloads', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      assert.equal(String(input), 'https://api.codemagic.io/builds')
      assert.equal(init?.method, 'POST')
      assert.equal((init?.headers as Record<string, string>)['x-auth-token'], 'token')
      assert.deepEqual(JSON.parse(String(init?.body)), {
        appId: 'app-1',
        workflowId: 'release',
        branch: 'main',
        labels: ['forgedesk']
      })

      return jsonResponse({ buildId: 'build-1' })
    }

    assert.deepEqual(await startCodemagicBuild('token', { appId: 'app-1', workflowId: 'release', branch: 'main', labels: ['forgedesk'] }, fetchImpl), {
      buildId: 'build-1'
    })
  })

  it('maps build artifacts and failed build status', () => {
    const build = mapCodemagicBuild({
      data: {
        id: 'build-1',
        app_id: 'app-1',
        workflow: { id: 'release', name: 'Release' },
        status: 'failed',
        branch: 'main',
        artifacts: [
          {
            name: 'app-release.aab',
            type: 'aab',
            size_in_bytes: 1234,
            short_lived_download_url: 'https://example.com/app-release.aab',
            version_code: '42',
            version_name: '2.0.0'
          }
        ]
      }
    })

    assert.equal(build.status, 'failed')
    assert.equal(build.workflowName, 'Release')
    assert.equal(build.artifacts[0]?.name, 'app-release.aab')
    assert.equal(build.artifacts[0]?.sizeInBytes, 1234)
    assert.equal(build.artifacts[0]?.versionCode, '42')
  })
})
