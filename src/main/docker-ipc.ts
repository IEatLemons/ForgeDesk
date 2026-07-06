import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import {
  createDockerCommandEnv,
  deleteDockerResourceNote,
  parseDockerEventLines,
  readDockerContainerDetail,
  readDockerSnapshot,
  saveDockerResourceNote,
  type DockerContainerDetail,
  type DockerDatabase,
  type DockerEventSummary,
  type DockerResourceNoteInput,
  type DockerResourceType,
  type DockerSnapshot
} from './docker.js'

export type DockerIpcMain = {
  handle: (channel: string, listener: (event: unknown, ...args: any[]) => unknown) => void
}

export type DockerWindow = {
  webContents: {
    send: (channel: string, event: unknown) => void
  }
}

export type DockerIpcService = {
  getSnapshot: () => Promise<DockerSnapshot>
  getContainerDetail: (containerId: string) => Promise<DockerContainerDetail>
  saveResourceNote: (input: DockerResourceNoteInput) => Promise<DockerSnapshot>
  deleteResourceNote: (resourceType: DockerResourceType, resourceKey: string) => Promise<DockerSnapshot>
  startWatch: () => void
  stopWatch: () => void
}

export type DockerDatabaseProvider = () => DockerDatabase
export type DockerWindowProvider = () => DockerWindow[]

function sendToWindows(windows: DockerWindow[], channel: string, event: unknown): void {
  for (const window of windows) {
    window.webContents.send(channel, event)
  }
}

export class DockerWatchController {
  private process: ChildProcessWithoutNullStreams | null = null
  private outputBuffer = ''
  private stopping = false

  constructor(private readonly getWindows: DockerWindowProvider) {}

  start(): void {
    if (this.process && !this.process.killed) {
      return
    }

    this.stopping = false
    this.outputBuffer = ''
    this.process = spawn('docker', ['events', '--format', '{{json .}}', '--filter', 'type=container', '--filter', 'type=image'], {
      env: createDockerCommandEnv()
    })

    this.process.stdout.on('data', (chunk: Buffer) => this.consumeOutput(chunk.toString('utf8')))
    this.process.stderr.on('data', (chunk: Buffer) => {
      const message = chunk.toString('utf8').trim()

      if (message) {
        this.emitError(message)
      }
    })
    this.process.on('error', (error) => this.emitError(error.message))
    this.process.on('close', (code) => {
      const wasStopping = this.stopping

      this.process = null
      this.outputBuffer = ''
      this.stopping = false

      if (!wasStopping && code !== 0 && code !== null) {
        this.emitError(`Docker 监听已停止，退出码 ${code}`)
      }
    })
  }

  stop(): void {
    if (!this.process) {
      return
    }

    this.stopping = true
    this.process.kill()
  }

  private consumeOutput(output: string): void {
    this.outputBuffer += output
    const lines = this.outputBuffer.split(/\r?\n/)
    this.outputBuffer = lines.pop() ?? ''
    const events = parseDockerEventLines(lines.join('\n'))

    for (const event of events) {
      this.emitChanged(event)
    }
  }

  private emitChanged(event: DockerEventSummary): void {
    sendToWindows(this.getWindows(), 'docker:changed', event)
  }

  private emitError(message: string): void {
    sendToWindows(this.getWindows(), 'docker:watch:error', { message })
  }
}

export function createDockerIpcService(getDatabase: DockerDatabaseProvider, getWindows: DockerWindowProvider): DockerIpcService {
  const watcher = new DockerWatchController(getWindows)

  return {
    getSnapshot: () => readDockerSnapshot(getDatabase()),
    getContainerDetail: (containerId) => readDockerContainerDetail(containerId),
    saveResourceNote: async (input) => {
      saveDockerResourceNote(getDatabase(), input)
      return readDockerSnapshot(getDatabase())
    },
    deleteResourceNote: async (resourceType, resourceKey) => {
      deleteDockerResourceNote(getDatabase(), resourceType, resourceKey)
      return readDockerSnapshot(getDatabase())
    },
    startWatch: () => watcher.start(),
    stopWatch: () => watcher.stop()
  }
}

export function registerDockerIpc(ipcMain: DockerIpcMain, service: DockerIpcService): void {
  ipcMain.handle('docker:snapshot', () => service.getSnapshot())
  ipcMain.handle('docker:container:detail', (_event, containerId: string) => service.getContainerDetail(containerId))
  ipcMain.handle('docker:note:save', (_event, input: DockerResourceNoteInput) => service.saveResourceNote(input))
  ipcMain.handle('docker:note:delete', (_event, resourceType: DockerResourceType, resourceKey: string) => service.deleteResourceNote(resourceType, resourceKey))
  ipcMain.handle('docker:watch:start', () => service.startWatch())
  ipcMain.handle('docker:watch:stop', () => service.stopWatch())
}
