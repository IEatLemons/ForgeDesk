import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { CodexActivityService } from './codex-activity.js'

function event(type: string): string {
  return JSON.stringify({ type: 'event_msg', payload: { type } })
}

function sessionMeta(id: string, cwd: string): string {
  return JSON.stringify({
    timestamp: '2026-07-27T08:00:00.000Z',
    type: 'session_meta',
    payload: { cwd, id }
  })
}

function userMessage(content: string): string {
  return JSON.stringify({
    timestamp: '2026-07-27T08:01:00.000Z',
    type: 'response_item',
    payload: { content: [{ text: content, type: 'input_text' }], role: 'user' }
  })
}

describe('codex activity service', () => {
  it('counts completed turns and only treats the latest unfinished turn as running', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-activity-'))

    try {
      await writeFile(join(directory, 'completed.jsonl'), [event('task_started'), event('task_complete'), event('thread_settings_applied')].join('\n'))
      await writeFile(join(directory, 'running.jsonl'), [event('task_started'), event('task_complete'), event('user_message')].join('\n'))
      await writeFile(join(directory, 'aborted.jsonl'), [event('task_started'), event('turn_aborted')].join('\n'))

      const service = new CodexActivityService({ sessionsDirectory: directory })
      const snapshot = await service.snapshot()

      assert.equal(snapshot.available, true)
      assert.equal(snapshot.running, 1)
      assert.equal(snapshot.completed, 2)
      assert.equal(snapshot.aborted, 1)
      assert.equal(snapshot.sessions.length, 3)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('exposes real session metadata and the latest user message', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-activity-'))

    try {
      await writeFile(join(directory, 'session.jsonl'), [
        sessionMeta('session-1', '/tmp/GlobalSearchIntelligence'),
        userMessage('修复搜索结果页'),
        event('task_started')
      ].join('\n'))

      const snapshot = await new CodexActivityService({ sessionsDirectory: directory }).snapshot()
      const session = snapshot.sessions[0]

      assert.equal(session?.id, 'session-1')
      assert.equal(session?.title, '修复搜索结果页')
      assert.equal(session?.cwd, '/tmp/GlobalSearchIntelligence')
      assert.equal(session?.status, 'running')
      assert.equal(session?.lastMessage, '修复搜索结果页')
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('removes Codex injected context from session titles and keeps the actual request', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-activity-'))

    try {
      await writeFile(join(directory, 'session.jsonl'), [
        sessionMeta('session-2', '/tmp/ForgeDesk'),
        userMessage([
          '<recommended_plugins>',
          'Here is a list of plugins that are available but not installed.',
          '</recommended_plugins>',
          '<environment_context>',
          '<cwd>/tmp/ForgeDesk</cwd>',
          '</environment_context>',
          '',
          '# Files mentioned by the user:',
          '',
          '## My request for Codex:',
          '看不到项目相关的信息'
        ].join('\n')),
        event('task_started')
      ].join('\n'))

      const snapshot = await new CodexActivityService({ sessionsDirectory: directory }).snapshot()
      const session = snapshot.sessions[0]

      assert.equal(session?.title, '看不到项目相关的信息')
      assert.equal(session?.lastMessage, '看不到项目相关的信息')
      assert.equal(session?.cwd, '/tmp/ForgeDesk')
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('reuses unchanged session inspections and refreshes changed files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-activity-'))

    try {
      const filePath = join(directory, 'task.jsonl')
      await writeFile(filePath, event('task_started'))
      const service = new CodexActivityService({ sessionsDirectory: directory })

      assert.equal((await service.snapshot()).running, 1)
      await writeFile(filePath, [event('task_started'), event('task_complete')].join('\n'))
      assert.equal((await service.snapshot()).running, 0)
      assert.equal((await service.snapshot()).completed, 1)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})
