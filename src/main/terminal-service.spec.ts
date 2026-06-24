import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import {
  TerminalService,
  mapTerminalPtyError,
  normalizeTerminalCwd,
  resolveTerminalShell,
  type TerminalPtyExit,
  type TerminalPtyFactory,
  type TerminalPtyLike
} from './terminal-service.js'

class FakePty implements TerminalPtyLike {
  readonly pid = 4321
  cols: number
  rows: number
  readonly writes: Array<string | Buffer> = []
  readonly resizes: Array<{ cols: number; rows: number }> = []
  killed = false
  private readonly dataListeners = new Set<(data: string) => void>()
  private readonly exitListeners = new Set<(event: TerminalPtyExit) => void>()

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
  }

  onData(listener: (data: string) => void): { dispose: () => void } {
    this.dataListeners.add(listener)
    return { dispose: () => this.dataListeners.delete(listener) }
  }

  onExit(listener: (event: TerminalPtyExit) => void): { dispose: () => void } {
    this.exitListeners.add(listener)
    return { dispose: () => this.exitListeners.delete(listener) }
  }

  resize(cols: number, rows: number): void {
    this.cols = cols
    this.rows = rows
    this.resizes.push({ cols, rows })
  }

  write(data: string | Buffer): void {
    this.writes.push(data)
  }

  kill(): void {
    this.killed = true
  }

  emitData(data: string): void {
    for (const listener of this.dataListeners) {
      listener(data)
    }
  }

  emitExit(event: TerminalPtyExit): void {
    for (const listener of this.exitListeners) {
      listener(event)
    }
  }
}

describe('terminal service', () => {
  it('normalizes empty, tilde, and explicit terminal directories', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forgedesk-terminal-home-'))

    try {
      assert.equal(normalizeTerminalCwd(undefined, home), home)
      assert.equal(normalizeTerminalCwd('', home), home)
      assert.equal(normalizeTerminalCwd('~', home), home)
      assert.equal(normalizeTerminalCwd('./src', resolve('.')), resolve('src'))
      assert.throws(() => normalizeTerminalCwd(join(home, 'missing'), home), /目录不存在/)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('resolves the default shell for each supported platform', () => {
    assert.equal(resolveTerminalShell({ platform: 'darwin', env: { SHELL: '/bin/zsh' } }), '/bin/zsh')
    assert.equal(resolveTerminalShell({ platform: 'linux', env: {} }), '/bin/bash')
    assert.equal(resolveTerminalShell({ platform: 'win32', env: { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' } }), 'C:\\Windows\\System32\\cmd.exe')
  })

  it('creates, reuses, writes, resizes, emits, exits, and closes pty sessions', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forgedesk-terminal-home-'))
    const spawned: Array<{ file: string; args: string[]; options: { cols?: number; rows?: number; cwd?: string; env?: NodeJS.ProcessEnv }; pty: FakePty }> = []
    const ptyFactory: TerminalPtyFactory = (file, args, options) => {
      const pty = new FakePty(options.cols ?? 80, options.rows ?? 24)
      spawned.push({ file, args, options, pty })
      return pty
    }
    const dataEvents: Array<{ sessionId: string; data: string }> = []
    const exitEvents: Array<{ sessionId: string; exitCode: number; signal?: number }> = []
    const service = new TerminalService({
      env: { SHELL: '/bin/zsh', PATH: '/usr/bin' },
      homeDirectory: home,
      idFactory: () => `term-${spawned.length + 1}`,
      onData: (event) => dataEvents.push(event),
      onExit: (event) => exitEvents.push(event),
      platform: 'darwin',
      ptyFactory
    })

    try {
      const session = service.create({ cols: 100, cwd: home, reuseKey: `cwd:${home}`, rows: 30, title: 'ForgeDesk' })

      assert.deepEqual(session, {
        id: 'term-1',
        cwd: home,
        exited: false,
        pid: 4321,
        reuseKey: `cwd:${home}`,
        shell: '/bin/zsh',
        title: 'ForgeDesk'
      })
      assert.equal(spawned[0]?.file, '/bin/zsh')
      assert.deepEqual(spawned[0]?.args, ['-l'])
      assert.equal(spawned[0]?.options.cwd, home)
      assert.equal(spawned[0]?.options.cols, 100)
      assert.equal(spawned[0]?.options.rows, 30)

      const reused = service.create({ cwd: home, reuseKey: `cwd:${home}` })
      assert.equal(reused.id, session.id)
      assert.equal(spawned.length, 1)

      service.write(session.id, 'git status\r')
      service.resize(session.id, 120, 40)
      spawned[0]?.pty.emitData('ready')
      spawned[0]?.pty.emitExit({ exitCode: 0 })

      assert.deepEqual(spawned[0]?.pty.writes, ['git status\r'])
      assert.deepEqual(spawned[0]?.pty.resizes, [{ cols: 120, rows: 40 }])
      assert.deepEqual(dataEvents, [{ sessionId: session.id, data: 'ready' }])
      assert.deepEqual(exitEvents, [{ sessionId: session.id, exitCode: 0, signal: undefined }])
      assert.throws(() => service.write(session.id, 'after exit'), /终端会话已结束/)

      service.close(session.id)
      assert.equal(spawned[0]?.pty.killed, true)
      assert.throws(() => service.resize(session.id, 80, 24), /终端会话不存在/)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('maps low-level node-pty spawn failures to a readable runtime error', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forgedesk-terminal-home-'))
    const service = new TerminalService({
      env: { SHELL: '/bin/zsh' },
      homeDirectory: home,
      platform: 'darwin',
      ptyFactory: () => {
        throw new Error('posix_spawnp failed.')
      }
    })

    try {
      assert.throws(() => service.create({ cwd: home }), /终端运行时初始化失败/)
      assert.match(mapTerminalPtyError(new Error('posix_spawnp failed.')).message, /spawn-helper/)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
