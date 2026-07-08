import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { getRedactedOaSettings, normalizeOaSettings, readOaSettingsFile, writeOaSettingsFile } from './oa-settings.js'

describe('oa settings', () => {
  it('returns Lark defaults when settings file is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-oa-settings-'))

    try {
      const settings = await readOaSettingsFile(directory)

      assert.equal(settings.enabled, false)
      assert.equal(settings.provider, 'lark')
      assert.equal(settings.larkAppId, '')
      assert.equal(settings.larkAppSecret, '')
      assert.equal(settings.docsHomeUrl, 'https://docs.feishu.cn')
      assert.equal(settings.enableDocumentBrowsing, true)
      assert.equal(settings.enableDocumentEditing, true)
      assert.equal(settings.enableAiDocumentDrafting, true)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists Lark credentials and redacts the app secret for renderer reads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-oa-settings-'))

    try {
      const saved = await writeOaSettingsFile(directory, {
        enabled: true,
        provider: 'lark',
        larkAppId: ' cli_aabbcc ',
        larkAppSecret: ' app-secret ',
        docsHomeUrl: 'https://docs.feishu.cn/wiki/space?from=test',
        enableDocumentBrowsing: true,
        enableDocumentEditing: false,
        enableAiDocumentDrafting: true
      })
      const raw = JSON.parse(await readFile(join(directory, 'oa-settings.json'), 'utf8')) as { larkAppSecret: string }

      assert.equal(raw.larkAppSecret, 'app-secret')
      assert.equal(saved.larkAppId, 'cli_aabbcc')
      assert.equal(saved.docsHomeUrl, 'https://docs.feishu.cn/wiki/space')
      assert.deepEqual(getRedactedOaSettings(saved), {
        enabled: true,
        provider: 'lark',
        larkAppId: 'cli_aabbcc',
        larkAppSecret: '',
        larkAppSecretConfigured: true,
        docsHomeUrl: 'https://docs.feishu.cn/wiki/space',
        enableDocumentBrowsing: true,
        enableDocumentEditing: false,
        enableAiDocumentDrafting: true
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects non-http Lark document URLs', () => {
    assert.throws(
      () =>
        normalizeOaSettings({
          docsHomeUrl: 'file:///tmp/docs'
        }),
      /有效的 Lark 文档 URL/
    )
  })
})
