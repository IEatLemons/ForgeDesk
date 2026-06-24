import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerTerminalIpc } from './terminal-ipc.js'
import type { TerminalSession } from './terminal-service.js'

type RegisteredHandler = (_event: unknown, ...args: unknown[]) => unknown

class FakeIpcMain {
  readonly handlers = new Map<string, RegisteredHandler>()

  handle(channel: string, handler: RegisteredHandler): void {
    this.handlers.set(channel, handler)
  }
}

describe('terminal ipc', () => {
  it('registers terminal lifecycle handlers against the service', async () => {
    const session: TerminalSession = {
      id: 'term-1',
      cwd: '/Users/stone/ForgeDesk',
      exited: false,
      pid: 4321,
      reuseKey: 'cwd:/Users/stone/ForgeDesk',
      shell: '/bin/zsh',
      title: 'ForgeDesk'
    }
    const calls: string[] = []
    const service = {
      close: (sessionId: string) => calls.push(`close:${sessionId}`),
      create: (input: unknown) => {
        calls.push(`create:${JSON.stringify(input)}`)
        return session
      },
      resize: (sessionId: string, cols: number, rows: number) => calls.push(`resize:${sessionId}:${cols}x${rows}`),
      write: (sessionId: string, data: string) => calls.push(`write:${sessionId}:${data}`)
    }
    const ipcMain = new FakeIpcMain()

    registerTerminalIpc(ipcMain, service)

    assert.deepEqual(Array.from(ipcMain.handlers.keys()), ['terminal:create', 'terminal:write', 'terminal:resize', 'terminal:close'])
    assert.deepEqual(await ipcMain.handlers.get('terminal:create')?.({}, { cwd: session.cwd, reuseKey: session.reuseKey }), session)
    await ipcMain.handlers.get('terminal:write')?.({}, session.id, 'npm test\r')
    await ipcMain.handlers.get('terminal:resize')?.({}, session.id, 120, 34)
    await ipcMain.handlers.get('terminal:close')?.({}, session.id)

    assert.deepEqual(calls, [
      `create:{"cwd":"${session.cwd}","reuseKey":"${session.reuseKey}"}`,
      `write:${session.id}:npm test\r`,
      `resize:${session.id}:120x34`,
      `close:${session.id}`
    ])
  })
})
