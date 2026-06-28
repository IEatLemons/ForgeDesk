import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export type TerminalPtyExit = {
  exitCode: number
  signal?: number
}

export type TerminalPtyDisposable = {
  dispose: () => void
}

export type TerminalPtyLike = {
  readonly pid: number
  onData: (listener: (data: string) => void) => TerminalPtyDisposable
  onExit: (listener: (event: TerminalPtyExit) => void) => TerminalPtyDisposable
  resize: (cols: number, rows: number) => void
  write: (data: string | Buffer) => void
  kill: () => void
}

export type TerminalPtyOptions = {
  name?: string
  cols?: number
  rows?: number
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export type TerminalPtyFactory = (file: string, args: string[], options: TerminalPtyOptions) => TerminalPtyLike

export type TerminalCreateInput = {
  cwd?: string
  title?: string
  reuseKey?: string
  cols?: number
  rows?: number
  startupCommand?: string
}

export type TerminalSession = {
  id: string
  title: string
  cwd: string
  shell: string
  pid: number
  reuseKey?: string
  exited: boolean
  exitCode?: number
  signal?: number
}

export type TerminalDataEvent = {
  sessionId: string
  data: string
}

export type TerminalExitEvent = {
  sessionId: string
  exitCode: number
  signal?: number
}

type TerminalServiceOptions = {
  env?: NodeJS.ProcessEnv
  homeDirectory?: string
  idFactory?: () => string
  onData?: (event: TerminalDataEvent) => void
  onExit?: (event: TerminalExitEvent) => void
  platform?: NodeJS.Platform
  ptyFactory?: TerminalPtyFactory
}

type TerminalRecord = {
  pty: TerminalPtyLike
  session: TerminalSession
  disposables: TerminalPtyDisposable[]
}

export function expandTerminalHomePath(path: string, homeDirectory: string): string {
  if (path === '~') {
    return homeDirectory
  }

  if (path.startsWith('~/')) {
    return join(homeDirectory, path.slice(2))
  }

  return path
}

export function normalizeTerminalCwd(cwd: string | undefined, homeDirectory = homedir()): string {
  const requestedPath = cwd?.trim() ? cwd.trim() : homeDirectory
  const normalized = resolve(expandTerminalHomePath(requestedPath, homeDirectory))

  if (!existsSync(normalized)) {
    throw new Error(`目录不存在：${normalized}`)
  }

  if (!statSync(normalized).isDirectory()) {
    throw new Error(`不是目录：${normalized}`)
  }

  return normalized
}

export function resolveTerminalShell({
  env = process.env,
  platform = process.platform
}: {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
} = {}): string {
  if (platform === 'win32') {
    return env.COMSPEC || 'cmd.exe'
  }

  return env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
}

function getTerminalShellArgs(platform: NodeJS.Platform): string[] {
  return platform === 'win32' ? [] : ['-l']
}

function createDefaultPtyFactory(): TerminalPtyFactory {
  return () => {
    throw new Error('未配置终端 PTY factory')
  }
}

function normalizeDimension(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}

export function mapTerminalPtyError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('posix_spawnp failed')) {
    return new Error('终端运行时初始化失败：node-pty spawn-helper 无法启动。请重新运行 native rebuild，或检查 node-pty 的 macOS spawn-helper 执行权限。')
  }

  return error instanceof Error ? error : new Error(message)
}

export class TerminalService {
  private readonly env: NodeJS.ProcessEnv
  private readonly homeDirectory: string
  private readonly idFactory: () => string
  private readonly onData?: (event: TerminalDataEvent) => void
  private readonly onExit?: (event: TerminalExitEvent) => void
  private readonly platform: NodeJS.Platform
  private readonly ptyFactory: TerminalPtyFactory
  private readonly reuseIndex = new Map<string, string>()
  private readonly sessions = new Map<string, TerminalRecord>()

  constructor(options: TerminalServiceOptions = {}) {
    this.env = options.env ?? process.env
    this.homeDirectory = options.homeDirectory ?? homedir()
    this.idFactory = options.idFactory ?? randomUUID
    this.onData = options.onData
    this.onExit = options.onExit
    this.platform = options.platform ?? process.platform
    this.ptyFactory = options.ptyFactory ?? createDefaultPtyFactory()
  }

  create(input: TerminalCreateInput = {}): TerminalSession {
    const cwd = normalizeTerminalCwd(input.cwd, this.homeDirectory)
    const reuseKey = input.reuseKey?.trim() || undefined
    const existingSessionId = reuseKey ? this.reuseIndex.get(reuseKey) : undefined
    const existing = existingSessionId ? this.sessions.get(existingSessionId) : undefined

    if (existing && !existing.session.exited) {
      if (input.title?.trim()) {
        existing.session = { ...existing.session, title: input.title.trim() }
      }

      return { ...existing.session }
    }

    if (existingSessionId && existing?.session.exited) {
      this.sessions.delete(existingSessionId)
    }

    const shell = resolveTerminalShell({ env: this.env, platform: this.platform })
    const id = this.idFactory()
    const cols = normalizeDimension(input.cols, 80)
    const rows = normalizeDimension(input.rows, 24)
    let pty: TerminalPtyLike

    try {
      pty = this.ptyFactory(shell, getTerminalShellArgs(this.platform), {
        cols,
        cwd,
        env: this.env,
        name: 'xterm-256color',
        rows
      })
    } catch (error) {
      throw mapTerminalPtyError(error)
    }
    const session: TerminalSession = {
      id,
      cwd,
      exited: false,
      pid: pty.pid,
      shell,
      title: input.title?.trim() || cwd.split(/[\\/]/).filter(Boolean).pop() || cwd
    }

    if (reuseKey) {
      session.reuseKey = reuseKey
      this.reuseIndex.set(reuseKey, id)
    }

    const record: TerminalRecord = {
      pty,
      session,
      disposables: []
    }

    record.disposables.push(
      pty.onData((data) => {
        this.onData?.({ sessionId: id, data })
      })
    )
    record.disposables.push(
      pty.onExit((event) => {
        const current = this.sessions.get(id)

        if (!current) {
          return
        }

        current.session = {
          ...current.session,
          exited: true,
          exitCode: event.exitCode,
          signal: event.signal
        }
        this.onExit?.({ sessionId: id, exitCode: event.exitCode, signal: event.signal })
      })
    )
    this.sessions.set(id, record)

    if (input.startupCommand) {
      pty.write(input.startupCommand)
    }

    return { ...session }
  }

  write(sessionId: string, data: string): void {
    const record = this.getRecord(sessionId)

    if (record.session.exited) {
      throw new Error('终端会话已结束')
    }

    record.pty.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const record = this.getRecord(sessionId)

    if (record.session.exited) {
      return
    }

    record.pty.resize(normalizeDimension(cols, 80), normalizeDimension(rows, 24))
  }

  close(sessionId: string): void {
    const record = this.getRecord(sessionId)

    for (const disposable of record.disposables) {
      disposable.dispose()
    }

    try {
      record.pty.kill()
    } catch {
      // Already-exited PTYs can reject a second kill; closing the ForgeDesk session should remain idempotent.
    }

    if (record.session.reuseKey) {
      this.reuseIndex.delete(record.session.reuseKey)
    }

    this.sessions.delete(sessionId)
  }

  getSession(sessionId: string): TerminalSession {
    return { ...this.getRecord(sessionId).session }
  }

  private getRecord(sessionId: string): TerminalRecord {
    const record = this.sessions.get(sessionId)

    if (!record) {
      throw new Error('终端会话不存在')
    }

    return record
  }
}
