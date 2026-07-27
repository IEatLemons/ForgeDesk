import type { OaSettings } from './oa-settings.js'

export type LarkBotTask = {
  recordId: string
  name: string
  status: string
  progress: string
  owner: string
  startAt: string
  dueAt: string
  note: string
  completed: boolean
}

export type LarkBotNotification = {
  id: string
  category: string
  title: string
  body: string
  createdAt: string
}

export type LarkBotRuntimeSettings = {
  monitorEnabled: boolean
  remindersEnabled: boolean
  pollIntervalSeconds: number
  reminderHour: number
  reminderMinute: number
  reminderDaysAhead: number
  notifyOnFirstSync: boolean
  fieldTask: string
  fieldStatus: string
  fieldProgress: string
  fieldOwner: string
  fieldStart: string
  fieldDue: string
  fieldNote: string
  completedStatuses: string
}

export type LarkBotDashboard = {
  settings: LarkBotRuntimeSettings
  connection: {
    apiBaseUrl: string
    appId: string
    appToken: string
    tableId: string
    chatId: string
  }
  stats: {
    total: number
    completed: number
    inProgress: number
    overdue: number
    dueSoon: number
  }
  state: {
    lastSyncAt: string
    lastSyncResult: Record<string, unknown> | null
    lastEventAt: string
    lastError: string
  }
  tasks: LarkBotTask[]
}

type LarkFetch = (url: string, init?: RequestInit) => Promise<Response>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value)
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRuntimeSettings(value: unknown): LarkBotRuntimeSettings {
  const item = asRecord(value)
  return {
    monitorEnabled: bool(item.monitor_enabled),
    remindersEnabled: bool(item.reminders_enabled),
    pollIntervalSeconds: number(item.poll_interval_seconds, 300),
    reminderHour: number(item.reminder_hour, 9),
    reminderMinute: number(item.reminder_minute, 0),
    reminderDaysAhead: number(item.reminder_days_ahead, 1),
    notifyOnFirstSync: bool(item.notify_on_first_sync),
    fieldTask: text(item.field_task),
    fieldStatus: text(item.field_status),
    fieldProgress: text(item.field_progress),
    fieldOwner: text(item.field_owner),
    fieldStart: text(item.field_start),
    fieldDue: text(item.field_due),
    fieldNote: text(item.field_note),
    completedStatuses: text(item.completed_statuses)
  }
}

function normalizeTask(value: unknown): LarkBotTask {
  const item = asRecord(value)
  return {
    recordId: text(item.record_id ?? item.recordId),
    name: text(item.name) || '未命名任务',
    status: text(item.status) || '未设置',
    progress: text(item.progress) || '未设置',
    owner: text(item.owner) || '未分配',
    startAt: text(item.start_at ?? item.startAt),
    dueAt: text(item.due_at ?? item.dueAt),
    note: text(item.note),
    completed: bool(item.completed)
  }
}

function normalizeNotification(value: unknown): LarkBotNotification {
  const item = asRecord(value)
  return {
    id: text(item.id),
    category: text(item.category) || 'unknown',
    title: text(item.title) || 'Lark 通知',
    body: text(item.body),
    createdAt: text(item.created_at ?? item.createdAt)
  }
}

function normalizeDashboard(value: unknown): LarkBotDashboard {
  const item = asRecord(value)
  const connection = asRecord(item.connection)
  const stats = asRecord(item.stats)
  const state = asRecord(item.state)
  const lastSyncResult = state.last_sync_result ?? state.lastSyncResult

  return {
    settings: normalizeRuntimeSettings(item.settings),
    connection: {
      apiBaseUrl: text(connection.api_base_url ?? connection.apiBaseUrl),
      appId: text(connection.app_id ?? connection.appId),
      appToken: text(connection.app_token ?? connection.appToken),
      tableId: text(connection.table_id ?? connection.tableId),
      chatId: text(connection.chat_id ?? connection.chatId)
    },
    stats: {
      total: number(stats.total),
      completed: number(stats.completed),
      inProgress: number(stats.in_progress ?? stats.inProgress),
      overdue: number(stats.overdue),
      dueSoon: number(stats.due_soon ?? stats.dueSoon)
    },
    state: {
      lastSyncAt: text(state.last_sync_at ?? state.lastSyncAt),
      lastSyncResult: lastSyncResult && typeof lastSyncResult === 'object' ? asRecord(lastSyncResult) : null,
      lastEventAt: text(state.last_event_at ?? state.lastEventAt),
      lastError: text(state.last_error ?? state.lastError)
    },
    tasks: asArray(item.tasks).map(normalizeTask)
  }
}

function apiUrl(settings: Pick<OaSettings, 'larkBotUrl'>, path: string): string {
  const base = settings.larkBotUrl.trim().replace(/\/+$/, '')
  return `${base}${path}`
}

function requireConfigured(settings: Pick<OaSettings, 'larkBotUrl' | 'larkBotAdminToken'>): void {
  if (!settings.larkBotUrl || !settings.larkBotAdminToken) {
    throw new Error('请先在 OA / Lark 设置中填写 Lark Bot Service 地址和管理令牌')
  }
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    return asRecord(await response.json())
  } catch {
    return {}
  }
}

async function request(
  settings: Pick<OaSettings, 'larkBotUrl' | 'larkBotAdminToken'>,
  path: string,
  fetcher: LarkFetch,
  init: RequestInit = {}
): Promise<Record<string, unknown>> {
  requireConfigured(settings)
  const response = await fetcher(apiUrl(settings, path), {
    ...init,
    headers: {
      'X-Admin-Token': settings.larkBotAdminToken,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  })
  const payload = await readPayload(response)
  if (!response.ok) {
    const detail = text(payload.detail ?? payload.message ?? payload.error) || `HTTP ${response.status}`
    throw new Error(`Lark Bot Service 请求失败：${detail}`)
  }
  return payload
}

export async function getLarkBotDashboard(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<LarkBotDashboard> {
  return normalizeDashboard(await request(settings, '/admin/api/dashboard', fetcher))
}

export async function listLarkBotTasks(settings: OaSettings, query: { q?: string; status?: string } = {}, fetcher: LarkFetch = fetch): Promise<LarkBotTask[]> {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status) params.set('status', query.status)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const payload = await request(settings, `/admin/api/tasks${suffix}`, fetcher)
  return asArray(payload.items).map(normalizeTask)
}

export async function listLarkBotNotifications(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<LarkBotNotification[]> {
  const payload = await request(settings, '/admin/api/notifications', fetcher)
  return asArray(payload.items).map(normalizeNotification)
}

export async function getLarkBotSettings(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<LarkBotRuntimeSettings> {
  const payload = await request(settings, '/admin/api/settings', fetcher)
  return normalizeRuntimeSettings(payload.settings)
}

export async function saveLarkBotSettings(
  settings: OaSettings,
  input: Partial<LarkBotRuntimeSettings>,
  fetcher: LarkFetch = fetch
): Promise<LarkBotRuntimeSettings> {
  const payload = await request(settings, '/admin/api/settings', fetcher, {
    method: 'PUT',
    body: JSON.stringify({
      ...(input.monitorEnabled === undefined ? {} : { monitor_enabled: input.monitorEnabled }),
      ...(input.remindersEnabled === undefined ? {} : { reminders_enabled: input.remindersEnabled }),
      ...(input.pollIntervalSeconds === undefined ? {} : { poll_interval_seconds: input.pollIntervalSeconds }),
      ...(input.reminderHour === undefined ? {} : { reminder_hour: input.reminderHour }),
      ...(input.reminderMinute === undefined ? {} : { reminder_minute: input.reminderMinute }),
      ...(input.reminderDaysAhead === undefined ? {} : { reminder_days_ahead: input.reminderDaysAhead }),
      ...(input.notifyOnFirstSync === undefined ? {} : { notify_on_first_sync: input.notifyOnFirstSync }),
      ...(input.fieldTask === undefined ? {} : { field_task: input.fieldTask }),
      ...(input.fieldStatus === undefined ? {} : { field_status: input.fieldStatus }),
      ...(input.fieldProgress === undefined ? {} : { field_progress: input.fieldProgress }),
      ...(input.fieldOwner === undefined ? {} : { field_owner: input.fieldOwner }),
      ...(input.fieldStart === undefined ? {} : { field_start: input.fieldStart }),
      ...(input.fieldDue === undefined ? {} : { field_due: input.fieldDue }),
      ...(input.fieldNote === undefined ? {} : { field_note: input.fieldNote }),
      ...(input.completedStatuses === undefined ? {} : { completed_statuses: input.completedStatuses })
    })
  })
  return normalizeRuntimeSettings(payload.settings)
}

export async function syncLarkBot(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<Record<string, unknown>> {
  return request(settings, '/admin/api/sync', fetcher, { method: 'POST' })
}

export async function sendLarkBotTestMessage(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<void> {
  await request(settings, '/admin/api/test-message', fetcher, { method: 'POST' })
}

export async function sendLarkBotReminder(settings: OaSettings, fetcher: LarkFetch = fetch): Promise<void> {
  await request(settings, '/admin/api/reminder', fetcher, { method: 'POST' })
}
