import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  createDockerCommandEnv,
  createDockerDevContainerCliArgs,
  createDockerDevEnvironment,
  createDockerDevEnvironmentRunSteps,
  deleteDockerResourceNote,
  formatDockerProcessCommand,
  parseDockerEventLines,
  readDockerContainerDetail,
  readDockerSnapshot,
  saveDockerResourceNote,
  type DockerContainerDetail,
  type DockerDatabase,
  type DockerDevEnvironmentCommandStep,
  type DockerDevEnvironmentInput,
  type DockerDevEnvironmentRunMode,
  type DockerDevEnvironmentTaskSnapshot,
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
  createDevEnvironment: (input: DockerDevEnvironmentInput) => Promise<DockerDevEnvironmentTaskSnapshot>
  listDevEnvironmentTasks: () => DockerDevEnvironmentTaskSnapshot[]
  saveResourceNote: (input: DockerResourceNoteInput) => Promise<DockerSnapshot>
  deleteResourceNote: (resourceType: DockerResourceType, resourceKey: string) => Promise<DockerSnapshot>
  startWatch: () => void
  stopWatch: () => void
}

export type DockerDatabaseProvider = () => DockerDatabase
export type DockerWindowProvider = () => DockerWindow[]

type DockerTaskProcessError = Error & {
  code?: string | number | null
  exitCode?: number | null
  stdout?: string
  stderr?: string
}

type DockerProcessRunOptions = {
  cwd?: string
  progressCeiling: number
  allowMissingContainer?: boolean
}

type DockerProcessRunResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

function sendToWindows(windows: DockerWindow[], channel: string, event: unknown): void {
  for (const window of windows) {
    window.webContents.send(channel, event)
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function cloneDevEnvironmentTask(task: DockerDevEnvironmentTaskSnapshot): DockerDevEnvironmentTaskSnapshot {
  return {
    ...task,
    logs: [...task.logs],
    result: { ...task.result }
  }
}

function splitLogLines(output: string): string[] {
  return output
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
}

function getProcessErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error ?? '')
  }

  const processError = error as DockerTaskProcessError

  return [processError.message, processError.stderr, processError.stdout].filter(Boolean).join('\n')
}

function isMissingExecutableError(error: unknown, executable: string): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const processError = error as DockerTaskProcessError
  const message = getProcessErrorText(error).toLowerCase()

  return processError.code === 'ENOENT' || message.includes(`spawn ${executable} enoent`) || message.includes(`${executable}: command not found`)
}

function isMissingContainerError(error: unknown): boolean {
  const message = getProcessErrorText(error).toLowerCase()

  return message.includes('no such container') || message.includes('no such object') || message.includes('no such container:')
}

function createDockerChangedEvent(containerName: string): DockerEventSummary {
  return {
    id: containerName,
    type: 'container',
    action: 'start',
    status: 'start',
    time: nowIso(),
    actorAttributes: {
      name: containerName,
      'forgedesk.dev-environment': 'true'
    }
  }
}

export class DockerDevEnvironmentTaskController {
  private readonly tasks = new Map<string, DockerDevEnvironmentTaskSnapshot>()

  constructor(private readonly getWindows: DockerWindowProvider) {}

  async start(input: DockerDevEnvironmentInput): Promise<DockerDevEnvironmentTaskSnapshot> {
    const result = await createDockerDevEnvironment(input)
    const cliArgs = createDockerDevContainerCliArgs(result)
    const task: DockerDevEnvironmentTaskSnapshot = {
      taskId: randomUUID(),
      status: 'queued',
      runMode: 'devcontainer-cli',
      progressPercent: 5,
      stage: '已写入 Dev Containers 配置',
      title: result.name,
      hostPath: result.hostPath,
      configPath: result.configPath,
      containerName: result.containerName,
      command: formatDockerProcessCommand('devcontainer', cliArgs),
      startedAt: nowIso(),
      updatedAt: nowIso(),
      finishedAt: '',
      exitCode: null,
      error: '',
      logs: [`已写入配置：${result.configPath}`],
      result
    }

    this.tasks.set(task.taskId, task)
    this.publish(task)
    void this.runTask(task, cliArgs)

    return cloneDevEnvironmentTask(task)
  }

  list(): DockerDevEnvironmentTaskSnapshot[] {
    return Array.from(this.tasks.values())
      .map(cloneDevEnvironmentTask)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  private async runTask(task: DockerDevEnvironmentTaskSnapshot, cliArgs: string[]): Promise<void> {
    try {
      this.update(task, {
        status: 'running',
        stage: '检查 Dev Containers CLI',
        progressPercent: 10
      })

      try {
        await this.runProcess(task, 'devcontainer', ['--version'], { progressCeiling: 15 })
        task.runMode = 'devcontainer-cli'
        task.command = formatDockerProcessCommand('devcontainer', cliArgs)
        this.addLog(task, `执行：${task.command}`)
        this.update(task, { stage: '使用 Dev Containers CLI 构建并启动', progressPercent: 18 })
        await this.runProcess(task, 'devcontainer', cliArgs, { cwd: task.hostPath, progressCeiling: 92 })
      } catch (error) {
        if (!isMissingExecutableError(error, 'devcontainer')) {
          throw error
        }

        this.addLog(task, '未找到 Dev Containers CLI，改用 Docker 直接启动基础开发容器。')
        this.addLog(task, '提示：完整的 Dev Containers feature 已写入配置；用 Cursor/VS Code 打开该目录时会继续按配置应用。')
        await this.runDockerFallback(task)
      }

      this.update(task, {
        status: 'succeeded',
        stage: '开发容器已启动',
        progressPercent: 100,
        finishedAt: nowIso(),
        exitCode: 0
      })
      sendToWindows(this.getWindows(), 'docker:changed', createDockerChangedEvent(task.containerName))
    } catch (error) {
      this.addLog(task, getProcessErrorText(error) || '开发环境构建失败')
      this.update(task, {
        status: 'failed',
        stage: '开发环境构建失败',
        progressPercent: Math.max(task.progressPercent, 95),
        finishedAt: nowIso(),
        exitCode: typeof (error as DockerTaskProcessError).exitCode === 'number' ? (error as DockerTaskProcessError).exitCode ?? null : null,
        error: getProcessErrorText(error) || '开发环境构建失败'
      })
    }
  }

  private async runDockerFallback(task: DockerDevEnvironmentTaskSnapshot): Promise<void> {
    const steps = createDockerDevEnvironmentRunSteps(task.result)

    task.runMode = 'docker-run'
    task.command = steps.map((step) => formatDockerProcessCommand(step.file, step.args)).join('\n')
    this.publish(task)

    for (const step of steps) {
      this.addLog(task, `执行：${formatDockerProcessCommand(step.file, step.args)}`)
      this.update(task, {
        stage: step.stage,
        progressPercent: Math.min(task.progressPercent + 5, step.progressPercent)
      })

      try {
        await this.runStep(task, step)
      } catch (error) {
        if (step.allowMissingContainer && isMissingContainerError(error)) {
          this.addLog(task, '没有发现同名旧容器，继续启动。')
          continue
        }

        throw error
      }
    }
  }

  private runStep(task: DockerDevEnvironmentTaskSnapshot, step: DockerDevEnvironmentCommandStep): Promise<DockerProcessRunResult> {
    return this.runProcess(task, step.file, step.args, {
      progressCeiling: step.progressPercent,
      allowMissingContainer: step.allowMissingContainer
    })
  }

  private runProcess(task: DockerDevEnvironmentTaskSnapshot, file: string, args: string[], options: DockerProcessRunOptions): Promise<DockerProcessRunResult> {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      const process = spawn(file, args, {
        cwd: options.cwd,
        env: createDockerCommandEnv()
      })

      process.stdout.on('data', (chunk: Buffer) => {
        const output = chunk.toString('utf8')

        stdout += output
        this.addLog(task, output)
        this.bumpProgress(task, options.progressCeiling)
      })
      process.stderr.on('data', (chunk: Buffer) => {
        const output = chunk.toString('utf8')

        stderr += output
        this.addLog(task, output)
        this.bumpProgress(task, options.progressCeiling)
      })
      process.on('error', (error: DockerTaskProcessError) => {
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      })
      process.on('close', (code) => {
        if (code === 0) {
          this.update(task, { progressPercent: Math.max(task.progressPercent, options.progressCeiling) })
          resolve({ stdout, stderr, exitCode: code })
          return
        }

        const error = new Error(`${file} 退出码 ${code ?? 'unknown'}`) as DockerTaskProcessError
        error.exitCode = code
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      })
    })
  }

  private bumpProgress(task: DockerDevEnvironmentTaskSnapshot, ceiling: number): void {
    if (task.status !== 'running') {
      return
    }

    const nextProgress = Math.min(ceiling, task.progressPercent + 1)

    if (nextProgress !== task.progressPercent) {
      this.update(task, { progressPercent: nextProgress })
    }
  }

  private addLog(task: DockerDevEnvironmentTaskSnapshot, output: string): void {
    const lines = splitLogLines(output)

    if (lines.length === 0) {
      return
    }

    task.logs.push(...lines)
    task.logs = task.logs.slice(-300)
    this.update(task, {})
  }

  private update(task: DockerDevEnvironmentTaskSnapshot, patch: Partial<DockerDevEnvironmentTaskSnapshot>): void {
    Object.assign(task, patch, { updatedAt: nowIso() })
    this.publish(task)
  }

  private publish(task: DockerDevEnvironmentTaskSnapshot): void {
    sendToWindows(this.getWindows(), 'docker:dev-environment:progress', cloneDevEnvironmentTask(task))
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
  const devEnvironmentTasks = new DockerDevEnvironmentTaskController(getWindows)

  return {
    getSnapshot: () => readDockerSnapshot(getDatabase()),
    getContainerDetail: (containerId) => readDockerContainerDetail(containerId),
    createDevEnvironment: (input) => devEnvironmentTasks.start(input),
    listDevEnvironmentTasks: () => devEnvironmentTasks.list(),
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
  ipcMain.handle('docker:dev-environment:create', (_event, input: DockerDevEnvironmentInput) => service.createDevEnvironment(input))
  ipcMain.handle('docker:dev-environment:tasks', () => service.listDevEnvironmentTasks())
  ipcMain.handle('docker:note:save', (_event, input: DockerResourceNoteInput) => service.saveResourceNote(input))
  ipcMain.handle('docker:note:delete', (_event, resourceType: DockerResourceType, resourceKey: string) => service.deleteResourceNote(resourceType, resourceKey))
  ipcMain.handle('docker:watch:start', () => service.startWatch())
  ipcMain.handle('docker:watch:stop', () => service.stopWatch())
}
