import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { CodexSessionService, type CodexSessionStateThread } from './codex-sessions.js'

function response(role: string, content: unknown, timestamp = '2026-07-27T08:01:00.000Z'): string {
  return JSON.stringify({ timestamp, type: 'response_item', payload: { content, role } })
}

function event(type: string, timestamp = '2026-07-27T08:02:00.000Z', message = ''): string {
  return JSON.stringify({ timestamp, type: 'event_msg', payload: { message, type } })
}

function tokenCount(): string {
  return JSON.stringify({
    timestamp: '2026-07-27T08:03:03.000Z',
    type: 'event_msg',
    payload: {
      info: {
        last_token_usage: { cached_input_tokens: 40, input_tokens: 120, output_tokens: 30, reasoning_output_tokens: 10, total_tokens: 150 },
        model_context_window: 258400,
        total_token_usage: { input_tokens: 300, output_tokens: 60, total_tokens: 360 }
      },
      type: 'token_count'
    }
  })
}

function toolCall(): string {
  return JSON.stringify({
    timestamp: '2026-07-27T08:03:00.000Z',
    type: 'response_item',
    payload: { call_id: 'call-1', id: 'tool-1', input: '{"cmd":"pwd"}', name: 'exec', type: 'custom_tool_call' }
  })
}

function toolOutput(): string {
  return JSON.stringify({
    timestamp: '2026-07-27T08:03:01.000Z',
    type: 'response_item',
    payload: { call_id: 'call-1', output: [{ text: '/tmp/project' }], type: 'custom_tool_call_output' }
  })
}

function createStateRows(rows: Array<{ id: string; filePath: string; cwd: string; title: string; archived?: number }>): CodexSessionStateThread[] {
  return rows.map((row, index) => ({
    archived: row.archived ?? 0,
    created_at_ms: 1785139200000 + index,
    cwd: row.cwd,
    id: row.id,
    preview: row.title,
    rollout_path: row.filePath,
    title: row.title,
    updated_at_ms: 1785139200000 + index
  }))
}

describe('codex session service', () => {
  it('groups native threads by cwd and exposes the full conversation/tool stream', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-sessions-'))
    const firstPath = join(directory, 'first.jsonl')
    const secondPath = join(directory, 'second.jsonl')

    try {
      await writeFile(firstPath, [
        response('user', [{ type: 'input_text', text: '# Files mentioned by the user:\n## screenshot.png: /tmp/reference.png\n\n## My request for Codex:\n修复搜索页' }]),
        response('assistant', [{ type: 'output_text', text: '我会先检查搜索页。' }]),
        toolCall(),
        toolOutput(),
        JSON.stringify({ item: { id: 'live-agent', text: '实时回答', type: 'agent_message' }, timestamp: '2026-07-27T08:03:02.000Z', type: 'item.completed' }),
        tokenCount(),
        event('task_complete')
      ].join('\n'))
      await writeFile(secondPath, [response('user', [{ type: 'input_text', text: '检查登录流程' }]), event('task_started')].join('\n'))
      const stateRows = createStateRows([
        { cwd: '/tmp/ForgeDesk', filePath: firstPath, id: 'session-1', title: '修复搜索页' },
        { cwd: '/tmp/ForgeDesk', filePath: secondPath, id: 'session-2', title: '检查登录流程' }
      ])

      const service = new CodexSessionService({ readStateRows: async () => stateRows, sessionsDirectory: directory })
      const snapshot = await service.list()
      const detail = await service.get('session-1')

      assert.equal(snapshot.available, true)
      assert.equal(snapshot.projects.length, 1)
      assert.equal(snapshot.projects[0]?.sessionCount, 2)
      assert.equal(snapshot.sessions.find((session) => session.id === 'session-2')?.status, 'running')
      assert.equal('items' in (snapshot.sessions[0] ?? {}), false)
      assert.equal(detail.preview, '修复搜索页')
      assert.deepEqual(detail.items.filter((item) => item.kind === 'user' || item.kind === 'assistant').map((item) => item.text), ['修复搜索页', '我会先检查搜索页。', '实时回答'])
      assert.deepEqual(detail.items.find((item) => item.kind === 'user')?.images, ['/tmp/reference.png'])
      assert.equal(detail.items.find((item) => item.kind === 'tool-call')?.toolName, 'exec')
      assert.match(detail.items.find((item) => item.kind === 'tool-output')?.output ?? '', /\/tmp\/project/)
      assert.equal(detail.items.some((item) => item.kind === 'status' && item.eventType === 'task_complete'), true)
      assert.deepEqual(detail.items.find((item) => item.eventType === 'token_count')?.usage, {
        cachedInputTokens: 40,
        cacheWriteInputTokens: 0,
        contextWindow: 258400,
        cumulativeInputTokens: 300,
        cumulativeOutputTokens: 60,
        cumulativeTotalTokens: 360,
        inputTokens: 120,
        outputTokens: 30,
        reasoningOutputTokens: 10,
        totalTokens: 150
      })
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('resumes a native session with its id, cwd, and image arguments', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-resume-'))
    const filePath = join(directory, 'session.jsonl')
    const calls: Array<{ file: string; args: string[]; cwd: string }> = []

    class FakeProcess extends EventEmitter {
      stdout = new EventEmitter()
      stderr = new EventEmitter()
      kill(): boolean { return true }
    }

    try {
      await writeFile(filePath, [response('user', [{ type: 'input_text', text: '原始请求' }]), event('task_complete')].join('\n'))
      const stateRows = createStateRows([{ cwd: '/tmp/ForgeDesk', filePath, id: 'session-1', title: '原始请求' }])
      const service = new CodexSessionService({
        findCodexCommand: async () => '/usr/local/bin/codex',
        spawnCodex: (file, args, options) => {
          calls.push({ args, cwd: options.cwd, file })
          return new FakeProcess() as never
        },
        readStateRows: async () => stateRows,
        sessionsDirectory: directory
      })

      await service.sendMessage({ content: '继续检查', images: ['/tmp/reference.png'], sessionId: 'session-1' })
      assert.deepEqual(calls[0]?.args, ['exec', 'resume', '--json', '--skip-git-repo-check', '--image', '/tmp/reference.png', 'session-1', '继续检查'])
      assert.equal(calls[0]?.cwd, '/tmp/ForgeDesk')
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('keeps a long-running session running when its lifecycle event is outside the summary tail', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-summary-tail-'))
    const filePath = join(directory, 'session.jsonl')

    try {
      const toolOutput = JSON.stringify({
        timestamp: '2026-07-27T08:03:00.000Z',
        type: 'response_item',
        payload: { output: 'x'.repeat(300 * 1024), type: 'custom_tool_call_output' }
      })
      await writeFile(filePath, [event('task_started'), toolOutput].join('\n'))
      const stateRows = createStateRows([{ cwd: '/tmp/ForgeDesk', filePath, id: 'session-1', title: '长时间运行的任务' }])
      const service = new CodexSessionService({ readStateRows: async () => stateRows, sessionsDirectory: directory })

      const snapshot = await service.list()
      assert.equal(snapshot.running, 1)
      assert.equal(snapshot.sessions[0]?.status, 'running')
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('uses the native Codex pinned-thread state and sorts pinned sessions before recent sessions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-pinned-'))
    const firstPath = join(directory, 'first.jsonl')
    const secondPath = join(directory, 'second.jsonl')

    try {
      await writeFile(join(directory, '.codex-global-state.json'), JSON.stringify({ 'pinned-thread-ids': ['session-old'] }))
      await writeFile(firstPath, [response('user', [{ type: 'input_text', text: '旧会话' }]), event('task_complete', '2026-07-27T08:02:00.000Z')].join('\n'))
      await writeFile(secondPath, [response('user', [{ type: 'input_text', text: '新会话' }]), event('task_complete', '2026-07-27T08:04:00.000Z')].join('\n'))
      const stateRows = createStateRows([
        { cwd: '/tmp/ForgeDesk', filePath: firstPath, id: 'session-old', title: '旧会话' },
        { cwd: '/tmp/ForgeDesk', filePath: secondPath, id: 'session-new', title: '新会话' }
      ])
      const service = new CodexSessionService({
        codexHome: directory,
        readStateRows: async () => stateRows,
        sessionsDirectory: directory
      })

      assert.deepEqual((await service.list()).sessions.map((session) => session.id), ['session-old', 'session-new'])
      assert.equal((await service.get('session-old')).pinned, true)
      await service.togglePin('session-old')
      assert.equal((await service.get('session-old')).pinned, false)
      assert.deepEqual((await service.list()).sessions.map((session) => session.id), ['session-new', 'session-old'])
      await service.togglePin('session-old')
      assert.equal((await service.get('session-old')).pinned, true)
      assert.deepEqual(JSON.parse(await readFile(join(directory, '.codex-global-state.json'), 'utf8'))['pinned-thread-ids'], ['session-old'])
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})
