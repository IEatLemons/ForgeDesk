import type { OaSettings } from './oa-settings.js'

export type LarkDocumentSourceKind = 'home' | 'drive-root' | 'folder' | 'document' | 'unknown'

export type LarkDocumentRecord = {
  id: string
  token: string
  name: string
  type: string
  url: string
  createdAt: string
  updatedAt: string
}

export type LarkDocumentList = {
  sourceKind: LarkDocumentSourceKind
  sourceUrl: string
  documents: LarkDocumentRecord[]
  nextPageToken: string
  hasMore: boolean
  unsupportedReason: string
}

export type LarkDocumentTaskRecord = {
  id: string
  title: string
  completed: boolean
  documentToken: string
  documentName: string
  documentUrl: string
}

export type LarkDocumentTaskList = {
  documentToken: string
  documentName: string
  documentUrl: string
  tasks: LarkDocumentTaskRecord[]
  unsupportedReason: string
}

type LarkDocsSource =
  | { kind: 'home'; url: string }
  | { kind: 'drive-root'; url: string }
  | { kind: 'folder'; url: string; token: string }
  | { kind: 'document'; url: string; token: string; documentType: string; name: string }
  | { kind: 'unknown'; url: string }

export type LarkFetch = (url: string | URL, init?: RequestInit) => Promise<Response>

const feishuApiBaseUrl = 'https://open.feishu.cn'
const larkApiBaseUrl = 'https://open.larksuite.com'
const feishuDocsBaseUrl = 'https://docs.feishu.cn'
const larkDocsBaseUrl = 'https://docs.larksuite.com'
const larkDocumentPathTypes = new Set(['doc', 'docx', 'sheet', 'sheets', 'bitable', 'base', 'mindnote', 'mindnotes', 'minutes', 'slides', 'wiki'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function getLarkApiBaseUrl(settings: Pick<OaSettings, 'docsHomeUrl'>): string {
  return settings.docsHomeUrl.includes('larksuite') ? larkApiBaseUrl : feishuApiBaseUrl
}

function getLarkDocsBaseUrl(settings: Pick<OaSettings, 'docsHomeUrl'>): string {
  try {
    return new URL(settings.docsHomeUrl).origin
  } catch {
    // Fall through to the provider default below.
  }

  return settings.docsHomeUrl.includes('larksuite') ? larkDocsBaseUrl : feishuDocsBaseUrl
}

function normalizeDocumentType(value: unknown): string {
  const type = textValue(value).toLowerCase()

  if (type === 'sheets') return 'sheet'
  if (type === 'bitable') return 'base'
  if (type === 'mindnotes') return 'mindnote'
  return type || 'docx'
}

function normalizeTimestamp(value: unknown): string {
  const raw = typeof value === 'number' ? value : Number(textValue(value))

  if (!Number.isFinite(raw) || raw <= 0) {
    return ''
  }

  const milliseconds = raw > 1_000_000_000_000 ? raw : raw * 1000
  return new Date(milliseconds).toISOString()
}

function buildDocumentUrl(settings: Pick<OaSettings, 'docsHomeUrl'>, type: string, token: string): string {
  const docsBaseUrl = getLarkDocsBaseUrl(settings)

  if (type === 'folder') {
    return `${docsBaseUrl}/drive/folder/${token}`
  }

  return `${docsBaseUrl}/${type}/${token}`
}

export function parseLarkDocsSource(input: string): LarkDocsSource {
  try {
    const url = new URL(input)
    const segments = url.pathname.split('/').filter(Boolean)
    const folderQueryToken = url.searchParams.get('folder_token') || url.searchParams.get('folderToken')
    const folderIndex = segments.findIndex((segment) => segment.toLowerCase() === 'folder')
    const normalizedSegments = segments.map((segment) => segment.toLowerCase())

    if (folderQueryToken) {
      return { kind: 'folder', url: url.toString(), token: folderQueryToken }
    }

    if (normalizedSegments[0] === 'drive' && (normalizedSegments[1] === 'me' || normalizedSegments[1] === 'my')) {
      return { kind: 'drive-root', url: url.toString() }
    }

    if (folderIndex >= 0 && segments[folderIndex + 1]) {
      return { kind: 'folder', url: url.toString(), token: segments[folderIndex + 1] }
    }

    for (const [index, segment] of segments.entries()) {
      const documentType = normalizeDocumentType(segment)

      if (larkDocumentPathTypes.has(segment.toLowerCase()) && segments[index + 1]) {
        return {
          kind: 'document',
          url: url.toString(),
          token: segments[index + 1],
          documentType,
          name: '已保存的文档入口'
        }
      }
    }

    if (segments.length === 0) {
      return { kind: 'home', url: url.toString() }
    }

    return { kind: 'unknown', url: url.toString() }
  } catch {
    return { kind: 'unknown', url: input }
  }
}

function createUnsupportedList(source: LarkDocsSource, reason: string): LarkDocumentList {
  return {
    sourceKind: source.kind,
    sourceUrl: source.url,
    documents: [],
    nextPageToken: '',
    hasMore: false,
    unsupportedReason: reason
  }
}

function createUnsupportedTaskList(document: LarkDocumentRecord, reason: string): LarkDocumentTaskList {
  return {
    documentToken: document.token,
    documentName: document.name,
    documentUrl: document.url,
    tasks: [],
    unsupportedReason: reason
  }
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return textValue(error) || '未知错误'
}

export function formatLarkDocumentAccessError(action: string, error: unknown): string {
  const detail = getErrorText(error)

  if (/scope|permission|forbidden|denied|unauthori[sz]ed|access denied|403|1770032|1061002/i.test(detail)) {
    return `${action}失败：Lark 应用没有文档读取权限。请在 Lark / 飞书开放平台的权限管理中开通云盘读取权限（drive:drive:readonly 或 drive:drive）和文档内容权限（space:document:retrieve），发布最新应用版本后再点击“重新读取”。原始错误：${detail}`
  }

  return `${action}失败：${detail}`
}

function normalizeLarkDocument(value: unknown, settings: OaSettings): LarkDocumentRecord | null {
  const record = asRecord(value)
  const token = textValue(record.token ?? record.file_token ?? record.obj_token ?? record.node_token)

  if (!token) {
    return null
  }

  const type = normalizeDocumentType(record.type ?? record.obj_type)
  const url = textValue(record.url) || buildDocumentUrl(settings, type, token)

  return {
    id: `${type}:${token}`,
    token,
    name: textValue(record.name ?? record.title) || '未命名文档',
    type,
    url,
    createdAt: normalizeTimestamp(record.created_time ?? record.create_time),
    updatedAt: normalizeTimestamp(record.modified_time ?? record.updated_time ?? record.edit_time)
  }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return asRecord(await response.json())
  } catch {
    return {}
  }
}

async function getTenantAccessToken(settings: OaSettings, fetcher: LarkFetch): Promise<string> {
  if (!settings.enabled || !settings.larkAppId || !settings.larkAppSecret) {
    throw new Error('请先在 OA 设置里启用 Lark 集成，并填写 App ID 和 App Secret')
  }

  const response = await fetcher(`${getLarkApiBaseUrl(settings)}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: settings.larkAppId,
      app_secret: settings.larkAppSecret
    })
  })
  const payload = await readJsonResponse(response)
  const code = Number(payload.code ?? 0)
  const token = textValue(payload.tenant_access_token ?? asRecord(payload.data).tenant_access_token)

  if (!response.ok || code !== 0 || !token) {
    throw new Error(textValue(payload.msg) || textValue(payload.message) || '获取 Lark tenant access token 失败')
  }

  return token
}

async function listDriveFiles(settings: OaSettings, source: Extract<LarkDocsSource, { kind: 'drive-root' | 'folder' }>, fetcher: LarkFetch): Promise<LarkDocumentList> {
  const tenantAccessToken = await getTenantAccessToken(settings, fetcher)
  const url = new URL(`${getLarkApiBaseUrl(settings)}/open-apis/drive/v1/files`)

  if (source.kind === 'folder') {
    url.searchParams.set('folder_token', source.token)
  }

  url.searchParams.set('page_size', '50')
  url.searchParams.set('order_by', 'EditedTime')
  url.searchParams.set('direction', 'DESC')

  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${tenantAccessToken}` }
  })
  const payload = await readJsonResponse(response)
  const code = Number(payload.code ?? 0)

  if (!response.ok || code !== 0) {
    throw new Error(textValue(payload.msg) || textValue(payload.message) || '读取 Lark 文件夹文档失败')
  }

  const data = asRecord(payload.data)
  const documents = asArray(data.files ?? data.items)
    .map((item) => normalizeLarkDocument(item, settings))
    .filter((item): item is LarkDocumentRecord => Boolean(item))

  return {
    sourceKind: source.kind,
    sourceUrl: source.url,
    documents,
    nextPageToken: textValue(data.next_page_token),
    hasMore: Boolean(data.has_more),
    unsupportedReason: ''
  }
}

function collectText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(collectText).join('')
  if (!isRecord(value)) return ''

  const content = textValue(value.content)
  if (content) return content

  for (const key of ['elements', 'text_run', 'text', 'todo', 'task']) {
    const nestedText = collectText(value[key])
    if (nestedText) return nestedText
  }

  return ''
}

function readCompleted(block: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  for (const value of [payload.done, payload.completed, asRecord(payload.style).done, asRecord(payload.style).completed, block.done]) {
    const result = booleanValue(value)
    if (result !== null) return result
  }

  return false
}

function normalizeTaskBlock(value: unknown, document: LarkDocumentRecord): LarkDocumentTaskRecord | null {
  if (!isRecord(value)) return null

  const blockType = value.block_type
  const todo = asRecord(value.todo)
  const task = asRecord(value.task)
  const payload = Object.keys(todo).length > 0 ? todo : task
  const isTodoBlock = blockType === 17 || blockType === 'todo' || blockType === 'task' || Object.keys(payload).length > 0

  if (!isTodoBlock) return null

  const title = collectText(payload) || collectText(value.text)
  if (!title) return null

  const blockId = textValue(value.block_id) || `${document.token}:${title}`
  return {
    id: blockId,
    title,
    completed: readCompleted(value, payload),
    documentToken: document.token,
    documentName: document.name,
    documentUrl: document.url
  }
}

async function listDocumentBlocks(settings: OaSettings, document: LarkDocumentRecord, fetcher: LarkFetch): Promise<LarkDocumentTaskList> {
  if (!['docx', 'doc'].includes(document.type)) {
    return createUnsupportedTaskList(document, '目前只支持读取新版文档（DOCX）中的任务 Block；表格、知识库和多维表格请从对应入口查看。')
  }

  const tenantAccessToken = await getTenantAccessToken(settings, fetcher)
  const tasks: LarkDocumentTaskRecord[] = []
  let pageToken = ''
  let hasMore = true

  while (hasMore) {
    const url = new URL(`${getLarkApiBaseUrl(settings)}/open-apis/docx/v1/documents/${encodeURIComponent(document.token)}/blocks`)
    url.searchParams.set('page_size', '500')
    url.searchParams.set('document_revision_id', '-1')
    if (pageToken) url.searchParams.set('page_token', pageToken)

    const response = await fetcher(url, { headers: { Authorization: `Bearer ${tenantAccessToken}` } })
    const payload = await readJsonResponse(response)
    const code = Number(payload.code ?? 0)

    if (!response.ok || code !== 0) {
      throw new Error(textValue(payload.msg) || textValue(payload.message) || '读取 Lark 文档任务失败')
    }

    const data = asRecord(payload.data)
    for (const item of asArray(data.items)) {
      const task = normalizeTaskBlock(item, document)
      if (task) tasks.push(task)
    }

    hasMore = Boolean(data.has_more)
    pageToken = textValue(data.page_token ?? data.next_page_token)

    if (hasMore && !pageToken) {
      break
    }
  }

  return {
    documentToken: document.token,
    documentName: document.name,
    documentUrl: document.url,
    tasks,
    unsupportedReason: ''
  }
}

export async function listLarkDocuments(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<LarkDocumentList> {
  const source = parseLarkDocsSource(settings.docsHomeUrl)

  if (!settings.enableDocumentBrowsing) {
    return createUnsupportedList(source, '快速浏览文档未启用，请先在 OA 设置里打开这个能力。')
  }

  if (source.kind === 'home') {
    return createUnsupportedList(source, '当前入口是飞书文档首页，不包含可枚举的文件夹 token。请把入口链接换成具体文件夹或单篇文档链接。')
  }

  if (source.kind === 'unknown') {
    return createUnsupportedList(source, '没有从当前入口链接识别到文件夹或文档 token。请粘贴具体文件夹或单篇文档链接。')
  }

  if (source.kind === 'document') {
    return {
      sourceKind: 'document',
      sourceUrl: source.url,
      documents: [
        {
          id: `${source.documentType}:${source.token}`,
          token: source.token,
          name: source.name,
          type: source.documentType,
          url: source.url,
          createdAt: '',
          updatedAt: ''
        }
      ],
      nextPageToken: '',
      hasMore: false,
      unsupportedReason: ''
    }
  }

  try {
    return await listDriveFiles(settings, source, fetcher)
  } catch (error) {
    return createUnsupportedList(source, formatLarkDocumentAccessError('读取 Lark 云盘文件', error))
  }
}

export async function getLarkDocumentTasks(
  settings: OaSettings,
  document: LarkDocumentRecord,
  fetcher: LarkFetch = fetch
): Promise<LarkDocumentTaskList> {
  if (!settings.enableDocumentBrowsing) {
    return createUnsupportedTaskList(document, '快速浏览文档未启用，请先在 OA 设置里打开这个能力。')
  }

  try {
    return await listDocumentBlocks(settings, document, fetcher)
  } catch (error) {
    return createUnsupportedTaskList(document, formatLarkDocumentAccessError('读取 Lark 文档任务', error))
  }
}
