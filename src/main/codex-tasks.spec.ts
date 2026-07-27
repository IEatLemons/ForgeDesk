import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  CodexTaskService,
  collectCodexTaskEnvironment,
  migrateCodexTaskTables
} from './codex-tasks.js'

class FakeStream extends EventEmitter {
  emitData(data: string): void {
    this.emit('data', data)
  }
}

class FakeCodexProcess extends EventEmitter {
  readonly stdout = new FakeStream()
  readonly stderr = new FakeStream()
  killed = false

  kill(): boolean {
    this.killed = true
    return true
  }

  close(code = 0): void {
    this.emit('close', code, null)
  }
}

function createDatabase(): any {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  migrateCodexTaskTables(db as any)
  return db
}

function createExecFileText() {
  return async (_file: string, args: string[]) => {
    if (args[0] === 'rev-parse') return { stdout: 'main\n', stderr: '' }
    if (args[0] === 'status') return { stdout: ' M src/main/codex-tasks.ts\n', stderr: '' }
    if (args[0] === 'diff') return { stdout: ' 2 files changed, 12 insertions(+), 3 deletions(-)\n', stderr: '' }
    return { stdout: '', stderr: '' }
  }
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

describe('codex task service', () => {
  it('migrates task tables and creates an idle task', () => {
    const db = createDatabase()
    const service = new CodexTaskService({ db: () => db })

    const task = service.create({ cwd: '/tmp', projectId: 'project-a', title: 'ForgeDesk Codex' })

    assert.equal(task.title, 'ForgeDesk Codex')
    assert.equal(task.projectId, 'project-a')
    assert.equal(task.status, 'idle')
    assert.deepEqual(service.list().map((item) => item.id), [task.id])
  })

  it('creates a new conversation title by default', () => {
    const db = createDatabase()
    const service = new CodexTaskService({ db: () => db })

    const task = service.create({ cwd: '/tmp' })

    assert.equal(task.title, '新对话')
  })

  it('renames a conversation and persists the updated title', () => {
    const db = createDatabase()
    const service = new CodexTaskService({ db: () => db })
    const task = service.create({ cwd: '/tmp', title: '旧名称' })

    const renamed = service.rename({ taskId: task.id, title: '  新名称  ' })

    assert.equal(renamed.title, '新名称')
    assert.equal(service.get(task.id)?.title, '新名称')
  })

  it('runs codex exec json, stores messages, and refreshes git environment', async () => {
    const db = createDatabase()
    const spawned: Array<{ file: string; args: string[]; cwd: string; process: FakeCodexProcess }> = []
    const events: string[] = []
    const service = new CodexTaskService({
      db: () => db,
      emit: (event) => events.push(`${event.type}:${event.task.status}`),
      execFileText: createExecFileText(),
      findCodexCommand: async () => '/Applications/ChatGPT.app/Contents/Resources/codex',
      spawnCodex: (file, args, options) => {
        const process = new FakeCodexProcess()
        spawned.push({ args, cwd: options.cwd, file, process })
        return process as any
      }
    })
    const task = service.create({ cwd: '/tmp/workspace', title: '新对话' })

    await service.sendMessage({ taskId: task.id, content: '修复 Codex 工作台' })

    assert.equal(spawned.length, 1)
    assert.equal(spawned[0]?.file, '/Applications/ChatGPT.app/Contents/Resources/codex')
    assert.deepEqual(spawned[0]?.args.slice(0, 5), ['exec', '--json', '-C', '/tmp/workspace', '--skip-git-repo-check'])
    assert.match(spawned[0]?.args[5] ?? '', /用户当前消息：\n修复 Codex 工作台/)
    assert.equal(spawned[0]?.cwd, '/tmp/workspace')

    spawned[0]?.process.stdout.emitData(JSON.stringify({ type: 'item_completed', item: { type: 'assistant_message', text: '已经完成。' } }) + '\n')
    spawned[0]?.process.close(0)
    await flushAsyncWork()

    const updated = service.get(task.id)
    assert.equal(updated?.status, 'succeeded')
    assert.equal(updated?.title, '修复 Codex 工作台')
    assert.deepEqual(updated?.messages.map((item) => `${item.role}:${item.content}`), ['user:修复 Codex 工作台', 'assistant:已经完成。'])
    assert.equal(updated?.branch, 'main')
    assert.equal(updated?.filesChanged, 2)
    assert.equal(updated?.additions, 12)
    assert.equal(updated?.deletions, 3)
    assert.match(updated?.runLog ?? '', /item_completed/)
    assert.equal(events.includes('running:running'), true)
    assert.equal(events.includes('output:running'), true)
    assert.equal(events.includes('succeeded:succeeded'), true)

    await service.sendMessage({ taskId: task.id, content: '刚刚我问了什么？' })

    assert.equal(spawned.length, 2)
    assert.match(spawned[1]?.args[5] ?? '', /对话历史/)
    assert.match(spawned[1]?.args[5] ?? '', /用户：\n修复 Codex 工作台/)
    assert.match(spawned[1]?.args[5] ?? '', /AI 编程助手：\n已经完成。/)
    assert.match(spawned[1]?.args[5] ?? '', /用户当前消息：\n刚刚我问了什么？/)
    spawned[1]?.process.close(0)
    await flushAsyncWork()
  })

  it('cancels a running task and kills the child process', async () => {
    const db = createDatabase()
    const spawned: { process?: FakeCodexProcess } = {}
    const service = new CodexTaskService({
      db: () => db,
      execFileText: createExecFileText(),
      findCodexCommand: async () => 'codex',
      spawnCodex: () => {
        const process = new FakeCodexProcess()
        spawned.process = process
        return process as any
      }
    })
    const task = service.create({ cwd: '/tmp/workspace' })

    await service.sendMessage({ taskId: task.id, content: '运行一个任务' })
    const cancelled = service.cancel(task.id)

    assert.equal(spawned.process?.killed, true)
    assert.equal(cancelled.status, 'cancelled')
    assert.equal(cancelled.errorMessage, '已取消 AI 编程助手对话')
  })

  it('passes image attachments to codex and stores them with the user message', async () => {
    const db = createDatabase()
    const spawned: Array<{ args: string[]; process: FakeCodexProcess }> = []
    const service = new CodexTaskService({
      db: () => db,
      execFileText: createExecFileText(),
      findCodexCommand: async () => 'codex',
      spawnCodex: (_file, args) => {
        const process = new FakeCodexProcess()
        spawned.push({ args, process })
        return process as any
      }
    })
    const task = service.create({ cwd: '/tmp/workspace' })

    await service.sendMessage({ taskId: task.id, content: '请看看这两张图', images: ['/tmp/a.png', '/tmp/b.jpg'] })

    assert.deepEqual(spawned[0]?.args.slice(5, 9), ['--image', '/tmp/a.png', '--image', '/tmp/b.jpg'])
    assert.deepEqual(service.get(task.id)?.messages[0]?.images, ['/tmp/a.png', '/tmp/b.jpg'])
    spawned[0]?.process.close(0)
    await flushAsyncWork()
  })

  it('returns an unavailable environment when git commands fail', async () => {
    const environment = await collectCodexTaskEnvironment('/tmp/missing', async () => {
      throw new Error('not a git repo')
    })

    assert.equal(environment.repositoryAvailable, false)
    assert.equal(environment.hasChanges, false)
    assert.equal(environment.branch, '')
  })
})
