import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getLarkBotDashboard,
  listLarkBotNotifications,
  listLarkBotTasks,
  saveLarkBotSettings,
  sendLarkBotTestMessage,
  type LarkBotRuntimeSettings
} from './lark-bot-service.js'
import type { OaSettings } from './oa-settings.js'

const settings: OaSettings = {
  enabled: true,
  provider: 'lark',
  larkAppId: 'cli_test',
  larkAppSecret: 'secret',
  docsHomeUrl: 'https://example.feishu.cn/base/app',
  larkBotUrl: 'http://127.0.0.1:8000/',
  larkBotAdminToken: 'admin-token',
  enableDocumentBrowsing: true,
  enableDocumentEditing: true,
  enableAiDocumentDrafting: false
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

test('reads and normalizes the Lark Bot Service contract', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
    requests.push({ url, init })
    if (url.endsWith('/dashboard')) {
      return response({
        settings: { monitor_enabled: true, reminders_enabled: false, poll_interval_seconds: 300 },
        connection: { chat_id: '••••••••' },
        stats: { total: 3, completed: 1, in_progress: 2, overdue: 1, due_soon: 1 },
        state: { last_sync_at: '2026-07-23T01:00:00Z', last_sync_result: { updated: 1 } },
        tasks: [{ record_id: 'rec1', name: '任务', status: '进行中', progress: '50%', owner: 'Stone', completed: false }]
      })
    }
    if (url.includes('/tasks')) return response({ items: [{ record_id: 'rec1', name: '任务' }] })
    if (url.includes('/notifications')) return response({ items: [{ id: 'n1', category: 'change', title: '任务变更', body: '内容', created_at: '2026-07-23T01:00:00Z' }] })
    if (url.endsWith('/settings')) return response({ settings: { monitor_enabled: false, reminders_enabled: true } })
    return response({ sent: true })
  }

  const dashboard = await getLarkBotDashboard(settings, fetcher)
  const tasks = await listLarkBotTasks(settings, { q: '任务' }, fetcher)
  const notifications = await listLarkBotNotifications(settings, fetcher)

  assert.equal(dashboard.stats.total, 3)
  assert.equal(dashboard.settings.monitorEnabled, true)
  assert.equal(dashboard.tasks[0].name, '任务')
  assert.equal(tasks[0].recordId, 'rec1')
  assert.equal(notifications[0].category, 'change')
  assert.equal(requests[0].init?.headers instanceof Object, true)
  assert.equal((requests[0].init?.headers as Record<string, string>)['X-Admin-Token'], 'admin-token')
  assert.equal(requests.some((request) => request.url === 'http://127.0.0.1:8000/admin/api/tasks?q=%E4%BB%BB%E5%8A%A1'), true)
})

test('maps runtime settings and sends test messages', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
    requests.push({ url, init })
    if (url.endsWith('/settings')) return response({ settings: { monitor_enabled: true, field_task: '任务' } })
    return response({ sent: true })
  }

  const next: LarkBotRuntimeSettings = await saveLarkBotSettings(settings, { monitorEnabled: true, pollIntervalSeconds: 600, fieldTask: '任务名称' }, fetcher)
  await sendLarkBotTestMessage(settings, fetcher)

  assert.equal(next.monitorEnabled, true)
  assert.equal(next.pollIntervalSeconds, 300)
  const body = JSON.parse(String(requests[0].init?.body)) as Record<string, unknown>
  assert.deepEqual(body, { monitor_enabled: true, poll_interval_seconds: 600, field_task: '任务名称' })
  assert.equal(requests[1].url.endsWith('/test-message'), true)
})
