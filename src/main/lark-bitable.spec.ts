import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteLarkBitableRecord, getLarkBitableSnapshot, parseLarkBitableSource, saveLarkBitableRecord } from './lark-bitable.js'
import type { OaSettings } from './oa-settings.js'

const settings: OaSettings = {
  enabled: true,
  provider: 'lark',
  larkAppId: 'cli_test',
  larkAppSecret: 'secret',
  docsHomeUrl: 'https://example.feishu.cn/base/TtTibZxeHas7kPsnEt1jHAA5peb?table=tblPlan',
  enableDocumentBrowsing: true,
  enableDocumentEditing: true,
  enableAiDocumentDrafting: false
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

test('parses a base app token and table id', () => {
  assert.deepEqual(parseLarkBitableSource(settings.docsHomeUrl), {
    appToken: 'TtTibZxeHas7kPsnEt1jHAA5peb',
    tableId: 'tblPlan',
    url: settings.docsHomeUrl
  })
  assert.equal(parseLarkBitableSource('https://docs.feishu.cn/docx/abc'), null)
})

test('loads tables, fields and records from a bitable link', async () => {
  const urls: string[] = []
  const fetcher = async (url: string | URL): Promise<Response> => {
    const value = String(url)
    urls.push(value)
    if (value.includes('/auth/')) return response({ code: 0, tenant_access_token: 'tenant-token' })
    if (value.includes('/fields')) return response({ code: 0, data: { items: [{ field_id: 'fldTitle', field_name: '标题', type: 1, is_primary: true }] } })
    if (value.includes('/records/search')) return response({ code: 0, data: { items: [{ record_id: 'rec1', fields: { 标题: '任务' }, created_time: 1_700_000_000 }] } })
    return response({ code: 0, data: { items: [{ table_id: 'tblPlan', name: '开发计划', revision: 3 }] } })
  }

  const snapshot = await getLarkBitableSnapshot(settings, '', fetcher)
  assert.equal(snapshot.appToken, 'TtTibZxeHas7kPsnEt1jHAA5peb')
  assert.equal(snapshot.selectedTableId, 'tblPlan')
  assert.equal(snapshot.tables[0].name, '开发计划')
  assert.equal(snapshot.fields[0].name, '标题')
  assert.deepEqual(snapshot.records[0].fields, { 标题: '任务' })
  assert.ok(urls.some((url) => url.endsWith('/records/search?page_size=500')))
})

test('creates, updates and deletes records', async () => {
  const methods: string[] = []
  const fetcher = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    if (String(url).includes('/auth/')) return response({ code: 0, tenant_access_token: 'tenant-token' })
    methods.push(init?.method || 'GET')
    return response({ code: 0, data: { record: { record_id: 'rec1', fields: { 标题: '任务' } } } })
  }

  await saveLarkBitableRecord(settings, { tableId: 'tblPlan', fields: { 标题: '任务' } }, fetcher)
  await saveLarkBitableRecord(settings, { tableId: 'tblPlan', recordId: 'rec1', fields: { 标题: '更新' } }, fetcher)
  await deleteLarkBitableRecord(settings, { tableId: 'tblPlan', recordId: 'rec1' }, fetcher)
  assert.deepEqual(methods, ['POST', 'PUT', 'DELETE'])
})
