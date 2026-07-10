import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listLarkDocuments, parseLarkDocsSource, type LarkFetch } from './lark-documents.js'
import type { OaSettings } from './oa-settings.js'

const readySettings: OaSettings = {
  enabled: true,
  provider: 'lark',
  larkAppId: 'cli_test',
  larkAppSecret: 'secret',
  docsHomeUrl: 'https://docs.feishu.cn',
  enableDocumentBrowsing: true,
  enableDocumentEditing: true,
  enableAiDocumentDrafting: true
}

function jsonResponse(value: unknown, ok = true): Response {
  return {
    ok,
    json: async () => value
  } as Response
}

describe('lark documents', () => {
  it('explains why the Feishu docs home cannot be enumerated', async () => {
    const result = await listLarkDocuments(readySettings)

    assert.equal(result.sourceKind, 'home')
    assert.equal(result.documents.length, 0)
    assert.match(result.unsupportedReason, /文件夹 token/)
  })

  it('turns a direct document URL into one visible document row', async () => {
    const result = await listLarkDocuments({
      ...readySettings,
      docsHomeUrl: 'https://docs.feishu.cn/docx/AbCdEfGh'
    })

    assert.equal(result.sourceKind, 'document')
    assert.deepEqual(result.documents, [
      {
        id: 'docx:AbCdEfGh',
        token: 'AbCdEfGh',
        name: '已保存的文档入口',
        type: 'docx',
        url: 'https://docs.feishu.cn/docx/AbCdEfGh',
        createdAt: '',
        updatedAt: ''
      }
    ])
  })

  it('lists files from a configured Drive folder URL', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher: LarkFetch = async (url, init) => {
      requests.push({ url: String(url), init })

      if (String(url).includes('/auth/v3/tenant_access_token/internal')) {
        return jsonResponse({ code: 0, tenant_access_token: 'tenant-token' })
      }

      return jsonResponse({
        code: 0,
        data: {
          files: [
            {
              token: 'doc-token',
              name: '项目周报',
              type: 'docx',
              url: 'https://docs.feishu.cn/docx/doc-token',
              created_time: '1717200000',
              modified_time: '1717286400'
            }
          ],
          has_more: false,
          next_page_token: ''
        }
      })
    }
    const result = await listLarkDocuments(
      {
        ...readySettings,
        docsHomeUrl: 'https://docs.feishu.cn/drive/folder/fld-token'
      },
      fetcher
    )

    assert.equal(requests.length, 2)
    assert.equal(JSON.parse(String(requests[0].init?.body)).app_id, 'cli_test')
    assert.equal(new URL(requests[1].url).searchParams.get('folder_token'), 'fld-token')
    assert.equal((requests[1].init?.headers as Record<string, string>).Authorization, 'Bearer tenant-token')
    assert.equal(result.sourceKind, 'folder')
    assert.equal(result.documents[0].name, '项目周报')
    assert.equal(result.documents[0].updatedAt, '2024-06-02T00:00:00.000Z')
  })

  it('lists the Drive root from a /drive/me URL without a folder token', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher: LarkFetch = async (url, init) => {
      requests.push({ url: String(url), init })

      if (String(url).includes('/auth/v3/tenant_access_token/internal')) {
        return jsonResponse({ code: 0, tenant_access_token: 'tenant-token' })
      }

      return jsonResponse({
        code: 0,
        data: {
          files: [
            {
              token: 'folder-token',
              name: '项目管理',
              type: 'folder'
            }
          ],
          has_more: false
        }
      })
    }
    const result = await listLarkDocuments(
      {
        ...readySettings,
        docsHomeUrl: 'https://mjpw70zc6m3j.jp.larksuite.com/drive/me/'
      },
      fetcher
    )

    const listUrl = new URL(requests[1].url)

    assert.equal(listUrl.searchParams.has('folder_token'), false)
    assert.equal(result.sourceKind, 'drive-root')
    assert.equal(result.documents[0].name, '项目管理')
    assert.equal(result.documents[0].type, 'folder')
    assert.equal(result.documents[0].url, 'https://mjpw70zc6m3j.jp.larksuite.com/drive/folder/folder-token')
  })

  it('parses folder tokens from query parameters', () => {
    assert.deepEqual(parseLarkDocsSource('https://docs.feishu.cn/?folder_token=fld-query'), {
      kind: 'folder',
      url: 'https://docs.feishu.cn/?folder_token=fld-query',
      token: 'fld-query'
    })
  })
})
