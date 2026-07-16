import type { OaSettings } from './oa-settings.js'
import type { LarkFetch } from './lark-documents.js'

export type LarkBitableTable = {
  id: string
  name: string
  revision: number
}

export type LarkBitableField = {
  id: string
  name: string
  type: number
  uiType: string
  isPrimary: boolean
  property: Record<string, unknown>
}

export type LarkBitableRecord = {
  id: string
  fields: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type LarkBitableSnapshot = {
  supported: boolean
  sourceUrl: string
  appToken: string
  selectedTableId: string
  tables: LarkBitableTable[]
  fields: LarkBitableField[]
  records: LarkBitableRecord[]
  unsupportedReason: string
}

type BitableSource = {
  appToken: string
  tableId: string
  url: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function timestamp(value: unknown): string {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw) || raw <= 0) return ''
  return new Date(raw > 1_000_000_000_000 ? raw : raw * 1000).toISOString()
}

function apiBaseUrl(settings: Pick<OaSettings, 'docsHomeUrl'>): string {
  return settings.docsHomeUrl.includes('larksuite') ? 'https://open.larksuite.com' : 'https://open.feishu.cn'
}

export function parseLarkBitableSource(input: string): BitableSource | null {
  try {
    const url = new URL(input)
    const segments = url.pathname.split('/').filter(Boolean)
    const baseIndex = segments.findIndex((segment) => ['base', 'bitable'].includes(segment.toLowerCase()))
    const appToken = baseIndex >= 0 ? text(segments[baseIndex + 1]) : ''
    if (!appToken) return null

    return {
      appToken,
      tableId: text(url.searchParams.get('table')),
      url: url.toString()
    }
  } catch {
    return null
  }
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    return asRecord(await response.json())
  } catch {
    return {}
  }
}

async function tenantToken(settings: OaSettings, fetcher: LarkFetch): Promise<string> {
  if (!settings.enabled || !settings.larkAppId || !settings.larkAppSecret) {
    throw new Error('请先启用 Lark 集成并保存 App ID 和 App Secret')
  }

  const response = await fetcher(`${apiBaseUrl(settings)}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: settings.larkAppId, app_secret: settings.larkAppSecret })
  })
  const payload = await readPayload(response)
  const token = text(payload.tenant_access_token ?? asRecord(payload.data).tenant_access_token)
  if (!response.ok || Number(payload.code ?? 0) !== 0 || !token) {
    throw new Error(text(payload.msg ?? payload.message) || '获取 Lark tenant access token 失败')
  }
  return token
}

async function request(
  settings: OaSettings,
  path: string,
  fetcher: LarkFetch,
  init: RequestInit = {},
  accessToken?: string
): Promise<Record<string, unknown>> {
  const token = accessToken || await tenantToken(settings, fetcher)
  const response = await fetcher(`${apiBaseUrl(settings)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      ...init.headers
    }
  })
  const payload = await readPayload(response)
  if (!response.ok || Number(payload.code ?? 0) !== 0) {
    const detail = text(payload.msg ?? payload.message) || `HTTP ${response.status}`
    throw new Error(`读取或更新 Lark 多维表格失败：${detail}`)
  }
  return asRecord(payload.data)
}

function normalizeTable(value: unknown): LarkBitableTable | null {
  const item = asRecord(value)
  const id = text(item.table_id ?? item.id)
  if (!id) return null
  return { id, name: text(item.name) || '未命名数据表', revision: Number(item.revision ?? item.rev ?? 0) }
}

function normalizeField(value: unknown): LarkBitableField | null {
  const item = asRecord(value)
  const id = text(item.field_id ?? item.id)
  if (!id) return null
  return {
    id,
    name: text(item.field_name ?? item.name) || '未命名字段',
    type: Number(item.type ?? 0),
    uiType: text(item.ui_type ?? item.field_ui_type),
    isPrimary: Boolean(item.is_primary),
    property: asRecord(item.property)
  }
}

function normalizeRecord(value: unknown): LarkBitableRecord | null {
  const item = asRecord(value)
  const id = text(item.record_id ?? item.id)
  if (!id) return null
  return {
    id,
    fields: asRecord(item.fields),
    createdAt: timestamp(item.created_time),
    updatedAt: timestamp(item.last_modified_time ?? item.modified_time)
  }
}

export async function getLarkBitableSnapshot(
  settings: OaSettings,
  requestedTableId = '',
  fetcher: LarkFetch = fetch
): Promise<LarkBitableSnapshot> {
  const source = parseLarkBitableSource(settings.docsHomeUrl)
  if (!source) {
    return {
      supported: false,
      sourceUrl: settings.docsHomeUrl,
      appToken: '',
      selectedTableId: '',
      tables: [],
      fields: [],
      records: [],
      unsupportedReason: '当前入口不是多维表格链接，请粘贴 /base/... 链接。'
    }
  }

  const token = await tenantToken(settings, fetcher)
  const tableData = await request(settings, `/open-apis/bitable/v1/apps/${encodeURIComponent(source.appToken)}/tables?page_size=100`, fetcher, {}, token)
  const tables = asArray(tableData.items).map(normalizeTable).filter((item): item is LarkBitableTable => Boolean(item))
  const selectedTableId = requestedTableId || source.tableId || tables[0]?.id || ''

  if (!selectedTableId) {
    return { supported: true, sourceUrl: source.url, appToken: source.appToken, selectedTableId: '', tables, fields: [], records: [], unsupportedReason: '该多维表格中没有数据表。' }
  }

  const encodedApp = encodeURIComponent(source.appToken)
  const encodedTable = encodeURIComponent(selectedTableId)
  const [fieldData, recordData] = await Promise.all([
    request(settings, `/open-apis/bitable/v1/apps/${encodedApp}/tables/${encodedTable}/fields?page_size=100`, fetcher, {}, token),
    request(settings, `/open-apis/bitable/v1/apps/${encodedApp}/tables/${encodedTable}/records/search?page_size=500`, fetcher, { method: 'POST', body: '{}' }, token)
  ])

  return {
    supported: true,
    sourceUrl: source.url,
    appToken: source.appToken,
    selectedTableId,
    tables,
    fields: asArray(fieldData.items).map(normalizeField).filter((item): item is LarkBitableField => Boolean(item)),
    records: asArray(recordData.items).map(normalizeRecord).filter((item): item is LarkBitableRecord => Boolean(item)),
    unsupportedReason: ''
  }
}

export async function saveLarkBitableRecord(
  settings: OaSettings,
  input: { tableId: string; recordId?: string; fields: Record<string, unknown> },
  fetcher: LarkFetch = fetch
): Promise<LarkBitableRecord> {
  if (!settings.enableDocumentEditing) throw new Error('请先在 OA 设置里启用“编辑文档”能力')
  const source = parseLarkBitableSource(settings.docsHomeUrl)
  if (!source) throw new Error('当前 OA 入口不是多维表格链接')
  if (!input.tableId) throw new Error('缺少数据表 ID')

  const suffix = input.recordId ? `/${encodeURIComponent(input.recordId)}` : ''
  const data = await request(
    settings,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(source.appToken)}/tables/${encodeURIComponent(input.tableId)}/records${suffix}`,
    fetcher,
    { method: input.recordId ? 'PUT' : 'POST', body: JSON.stringify({ fields: input.fields }) }
  )
  const record = normalizeRecord(data.record)
  if (!record) throw new Error('Lark 已保存记录，但没有返回有效记录')
  return record
}

export async function deleteLarkBitableRecord(
  settings: OaSettings,
  input: { tableId: string; recordId: string },
  fetcher: LarkFetch = fetch
): Promise<void> {
  if (!settings.enableDocumentEditing) throw new Error('请先在 OA 设置里启用“编辑文档”能力')
  const source = parseLarkBitableSource(settings.docsHomeUrl)
  if (!source) throw new Error('当前 OA 入口不是多维表格链接')
  if (!input.tableId || !input.recordId) throw new Error('缺少数据表或记录 ID')

  await request(
    settings,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(source.appToken)}/tables/${encodeURIComponent(input.tableId)}/records/${encodeURIComponent(input.recordId)}`,
    fetcher,
    { method: 'DELETE' }
  )
}
