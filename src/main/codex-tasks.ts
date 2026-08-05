import { randomUUID } from 'node:crypto'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'
import { findLocalAiCommand } from './ai-runtime.js'

const execFileAsync = promisify(execFile)

export type CodexTaskRunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type CodexTaskMessageRole = 'user' | 'assistant' | 'system'

export type CodexTaskMessage = {
  id: string
  taskId: string
  role: CodexTaskMessageRole
  content: string
  images: string[]
  eventType: string
  createdAt: string
}

export type CodexTaskEnvironment = {
  cwd: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  hasChanges: boolean
  repositoryAvailable: boolean
  checkedAt: string
}

export type CodexTaskRecord = {
  id: string
  title: string
  projectId: string
  cwd: string
  status: CodexTaskRunStatus
  accountId: string
  model: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  errorMessage: string
  runLog: string
  createdAt: string
  updatedAt: string
  finishedAt: string
  messages: CodexTaskMessage[]
  environment: CodexTaskEnvironment
}

export type CodexTaskCreateInput = {
  title?: string
  projectId?: string
  cwd?: string
  accountId?: string
  model?: string
}

export type CodexTaskRenameInput = {
  taskId: string
  title: string
}

export type CodexTaskMessageInput = {
  taskId: string
  content: string
  images?: string[]
}

export type CodexTaskEventType = 'updated' | 'running' | 'output' | 'succeeded' | 'failed' | 'cancelled'

export type CodexTaskEvent = {
  type: CodexTaskEventType
  task: CodexTaskRecord
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: any[]) => unknown[]
    get: (...params: any[]) => unknown
    run: (...params: any[]) => unknown
  }
}

type CodexTaskRow = {
  id?: unknown
  title?: unknown
  project_id?: unknown
  cwd?: unknown
  status?: unknown
  account_id?: unknown
  model?: unknown
  branch?: unknown
  additions?: unknown
  deletions?: unknown
  files_changed?: unknown
  error_message?: unknown
  run_log?: unknown
  created_at?: unknown
  updated_at?: unknown
  finished_at?: unknown
}

type CodexTaskMessageRow = {
  id?: unknown
  task_id?: unknown
  role?: unknown
  content?: unknown
  attachments?: unknown
  event_type?: unknown
  created_at?: unknown
}

type ExecFileText = (file: string, args: string[], options: { cwd?: string; timeout?: number }) => Promise<{ stdout: string; stderr: string }>
type SpawnCodex = (file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => ChildProcessWithoutNullStreams

export type CodexTaskServiceOptions = {
  db: () => DatabaseLike
  emit?: (event: CodexTaskEvent) => void
  execFileText?: ExecFileText
  findCodexCommand?: (env?: NodeJS.ProcessEnv) => Promise<string>
  resolveCodexHome?: (accountId?: string) => Promise<string>
  now?: () => Date
  spawnCodex?: SpawnCodex
}

const maxRunLogLength = 512 * 1024
const untitledCodexConversationTitle = '新对话'
const codexConversationInstruction = [
  '你正在 ForgeDesk 的 AI 编程助手对话里继续和用户交流。',
  '用户的消息不一定是要执行的任务；如果只是聊天、提问或讨论，请直接回应，不要擅自修改文件或运行命令。',
  '只有当用户明确要求实现、检查、运行、修改、创建或类似行动时，才把它当作任务处理。'
].join('\n')

function nowIso(now: () => Date): string {
  return now().toISOString()
}

function createTaskId(): string {
  return `codex-task-${randomUUID()}`
}

function createMessageId(): string {
  return `codex-message-${randomUUID()}`
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function imagePaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  } catch {
    return []
  }
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function statusValue(value: unknown): CodexTaskRunStatus {
  return value === 'running' || value === 'succeeded' || value === 'failed' || value === 'cancelled' ? value : 'idle'
}

function roleValue(value: unknown): CodexTaskMessageRole {
  return value === 'user' || value === 'system' ? value : 'assistant'
}

function createEmptyEnvironment(cwd: string, row?: Partial<CodexTaskRow>): CodexTaskEnvironment {
  return {
    additions: numberValue(row?.additions),
    branch: text(row?.branch),
    checkedAt: text(row?.updated_at),
    cwd,
    deletions: numberValue(row?.deletions),
    filesChanged: numberValue(row?.files_changed),
    hasChanges: numberValue(row?.additions) > 0 || numberValue(row?.deletions) > 0 || numberValue(row?.files_changed) > 0,
    repositoryAvailable: Boolean(text(row?.branch))
  }
}

function mapTaskMessageRow(row: CodexTaskMessageRow): CodexTaskMessage {
  return {
    content: text(row.content),
    createdAt: text(row.created_at),
    eventType: text(row.event_type),
    id: text(row.id),
    images: imagePaths(row.attachments),
    role: roleValue(row.role),
    taskId: text(row.task_id)
  }
}

function mapTaskRow(db: DatabaseLike, row: CodexTaskRow): CodexTaskRecord {
  const id = text(row.id)
  const cwd = text(row.cwd)
  const messages = (db.prepare('SELECT * FROM codex_task_messages WHERE task_id = ? ORDER BY created_at ASC, id ASC').all(id) as CodexTaskMessageRow[]).map(mapTaskMessageRow)

  return {
    accountId: text(row.account_id),
    additions: numberValue(row.additions),
    branch: text(row.branch),
    createdAt: text(row.created_at),
    cwd,
    deletions: numberValue(row.deletions),
    environment: createEmptyEnvironment(cwd, row),
    errorMessage: text(row.error_message),
    filesChanged: numberValue(row.files_changed),
    finishedAt: text(row.finished_at),
    id,
    messages,
    model: text(row.model),
    projectId: text(row.project_id),
    runLog: text(row.run_log),
    status: statusValue(row.status),
    title: text(row.title),
    updatedAt: text(row.updated_at)
  }
}

function appendLog(current: string, next: string): string {
  const joined = [current, next].filter(Boolean).join('\n')
  return joined.length > maxRunLogLength ? joined.slice(joined.length - maxRunLogLength) : joined
}

function createTaskTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/).find(Boolean) ?? ''
  const normalized = firstLine.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, 64) : untitledCodexConversationTitle
}

function isUntitledCodexConversationTitle(title: string): boolean {
  return title === untitledCodexConversationTitle || title === '新任务'
}

function formatConversationHistoryMessage(message: CodexTaskMessage): string {
  const role = message.role === 'user' ? '用户' : message.role === 'system' ? '系统' : 'AI 编程助手'
  return `${role}：\n${message.content.trim()}`
}

function createCodexRunPrompt(previousMessages: CodexTaskMessage[], content: string): string {
  const history = previousMessages
    .filter((message) => message.content.trim())
    .slice(-12)
    .map(formatConversationHistoryMessage)
    .join('\n\n')

  return [
    codexConversationInstruction,
    history ? `\n对话历史：\n\n${history}` : '',
    `\n用户当前消息：\n${content}`
  ].join('\n').trim()
}

function parseDiffShortstat(stdout: string): Pick<CodexTaskEnvironment, 'additions' | 'deletions' | 'filesChanged' | 'hasChanges'> {
  const filesChanged = Number(/(\d+)\s+files?\s+changed/.exec(stdout)?.[1] ?? /(\d+)\s+files?\s+?/.exec(stdout)?.[1] ?? 0)
  const additions = Number(/(\d+)\s+insertions?\(\+\)/.exec(stdout)?.[1] ?? 0)
  const deletions = Number(/(\d+)\s+deletions?\(-\)/.exec(stdout)?.[1] ?? 0)
  return {
    additions: Number.isFinite(additions) ? additions : 0,
    deletions: Number.isFinite(deletions) ? deletions : 0,
    filesChanged: Number.isFinite(filesChanged) ? filesChanged : 0,
    hasChanges: filesChanged > 0 || additions > 0 || deletions > 0
  }
}

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function extractTextFromCodexEvent(value: unknown, depth = 0): string {
  if (depth > 5 || value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return ''
  if (Array.isArray(value)) return value.map((item) => extractTextFromCodexEvent(item, depth + 1)).filter(Boolean).join('\n')

  const record = value as Record<string, unknown>
  for (const key of ['text', 'content', 'message', 'delta', 'final_response', 'output_text', 'item', 'data']) {
    const content = extractTextFromCodexEvent(record[key], depth + 1)
    if (content) return content
  }
  return ''
}

export function migrateCodexTaskTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS codex_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      cwd TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      account_id TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      files_changed INTEGER NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT '',
      run_log TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS codex_task_messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT NOT NULL DEFAULT '[]',
      event_type TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES codex_tasks(id) ON DELETE CASCADE
    );
  `)

  const columns = db.prepare('PRAGMA table_info(codex_task_messages)').all() as Array<{ name?: unknown }>
  if (!columns.some((column) => column.name === 'attachments')) {
    db.exec("ALTER TABLE codex_task_messages ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'")
  }
  const taskColumns = db.prepare('PRAGMA table_info(codex_tasks)').all() as Array<{ name?: unknown }>
  if (!taskColumns.some((column) => column.name === 'account_id')) {
    db.exec("ALTER TABLE codex_tasks ADD COLUMN account_id TEXT NOT NULL DEFAULT ''")
  }
}

export async function collectCodexTaskEnvironment(cwd: string, execFileText: ExecFileText = execFileAsync): Promise<CodexTaskEnvironment> {
  const checkedAt = new Date().toISOString()

  try {
    const branch = (await execFileText('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeout: 5000 })).stdout.trim()
    const status = (await execFileText('git', ['status', '--porcelain'], { cwd, timeout: 5000 })).stdout.trim()
    const shortstat = (await execFileText('git', ['diff', '--shortstat', 'HEAD'], { cwd, timeout: 5000 })).stdout.trim()
    const parsed = parseDiffShortstat(shortstat)

    return {
      ...parsed,
      checkedAt,
      cwd,
      branch,
      hasChanges: parsed.hasChanges || Boolean(status),
      repositoryAvailable: true
    }
  } catch {
    return {
      additions: 0,
      branch: '',
      checkedAt,
      cwd,
      deletions: 0,
      filesChanged: 0,
      hasChanges: false,
      repositoryAvailable: false
    }
  }
}

export class CodexTaskService {
  private readonly db: () => DatabaseLike
  private readonly emit?: (event: CodexTaskEvent) => void
  private readonly execFileText: ExecFileText
  private readonly findCodexCommand: (env?: NodeJS.ProcessEnv) => Promise<string>
  private readonly resolveCodexHome: (accountId?: string) => Promise<string>
  private readonly now: () => Date
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>()
  private readonly spawnCodex: SpawnCodex

  constructor(options: CodexTaskServiceOptions) {
    this.db = options.db
    this.emit = options.emit
    this.execFileText = options.execFileText ?? execFileAsync
    this.findCodexCommand = options.findCodexCommand ?? ((env) => findLocalAiCommand('codex-cli', { env }))
    this.resolveCodexHome = options.resolveCodexHome ?? (async () => process.env.CODEX_HOME?.trim() || '')
    this.now = options.now ?? (() => new Date())
    this.spawnCodex = options.spawnCodex ?? ((file, args, spawnOptions) => spawn(file, args, spawnOptions))
  }

  list(): CodexTaskRecord[] {
    const db = this.db()
    return (db.prepare('SELECT * FROM codex_tasks ORDER BY updated_at DESC').all() as CodexTaskRow[]).map((row) => mapTaskRow(db, row))
  }

  get(taskId: string): CodexTaskRecord | null {
    const db = this.db()
    const row = db.prepare('SELECT * FROM codex_tasks WHERE id = ?').get(taskId) as CodexTaskRow | undefined
    return row ? mapTaskRow(db, row) : null
  }

  create(input: CodexTaskCreateInput = {}): CodexTaskRecord {
    const db = this.db()
    const timestamp = nowIso(this.now)
    const id = createTaskId()
    const title = input.title?.trim() || untitledCodexConversationTitle
    const cwd = input.cwd?.trim() || process.cwd()

    db.prepare(`
      INSERT INTO codex_tasks (
        id, title, project_id, cwd, status, account_id, model, branch, additions, deletions, files_changed, error_message, run_log, created_at, updated_at, finished_at
      )
      VALUES (?, ?, ?, ?, 'idle', ?, ?, '', 0, 0, 0, '', '', ?, ?, '')
    `).run(id, title, input.projectId?.trim() || '', cwd, input.accountId?.trim() || '', input.model?.trim() || '', timestamp, timestamp)

    return this.requireTask(id)
  }

  rename(input: CodexTaskRenameInput): CodexTaskRecord {
    const title = input.title.trim().slice(0, 64)
    if (!title) throw new Error('请输入对话名称')

    const task = this.requireTask(input.taskId)
    this.updateTaskTitle(task.id, title)
    this.broadcast(task.id)
    return this.requireTask(task.id)
  }

  async sendMessage(input: CodexTaskMessageInput): Promise<CodexTaskRecord> {
    const content = input.content.trim()
    if (!content) throw new Error('请输入对话内容')
    const task = this.requireTask(input.taskId)
    if (task.status === 'running') throw new Error('AI 编程助手对话正在运行')

    const previousMessages = task.messages
    const images = [...new Set((input.images ?? []).map((image) => image.trim()).filter(Boolean))]
    const conversationImages = [...new Set([...previousMessages.flatMap((message) => message.images), ...images])]
    this.appendMessage(task.id, 'user', content, 'user_message', images)
    if (isUntitledCodexConversationTitle(task.title)) this.updateTaskTitle(task.id, createTaskTitle(content))
    await this.startRun(task.id, createCodexRunPrompt(previousMessages, content), conversationImages)
    return this.requireTask(task.id)
  }

  cancel(taskId: string): CodexTaskRecord {
    const process = this.processes.get(taskId)
    if (process) {
      process.kill()
      this.processes.delete(taskId)
    }
    this.finishTask(taskId, 'cancelled', '已取消 AI 编程助手对话')
    return this.requireTask(taskId)
  }

  delete(taskId: string): CodexTaskRecord[] {
    const process = this.processes.get(taskId)
    if (process) process.kill()
    this.processes.delete(taskId)
    this.db().prepare('DELETE FROM codex_tasks WHERE id = ?').run(taskId)
    return this.list()
  }

  async environment(taskId: string): Promise<CodexTaskEnvironment> {
    const task = this.requireTask(taskId)
    const environment = await collectCodexTaskEnvironment(task.cwd, this.execFileText)
    this.updateEnvironment(task.id, environment)
    this.broadcast(task.id)
    return environment
  }

  private async startRun(taskId: string, prompt: string, images: string[] = []): Promise<void> {
    const task = this.requireTask(taskId)
    const codexHome = await this.resolveCodexHome(task.accountId)
    const environment = {
      ...process.env,
      ...(codexHome ? { CODEX_HOME: codexHome } : {}),
      NO_COLOR: '1'
    }
    let command = ''
    try {
      command = await this.findCodexCommand(environment)
      if (!command) throw new Error('未检测到 AI 编程助手运行环境')
    } catch (error) {
      this.finishTask(task.id, 'failed', error instanceof Error ? error.message : String(error))
      return
    }

    this.updateStatus(task.id, 'running', '')
    const before = await collectCodexTaskEnvironment(task.cwd, this.execFileText)
    this.updateEnvironment(task.id, before)
    this.broadcast(task.id, 'running')

    const imageArgs = images.flatMap((image) => ['--image', image])
    const args = ['exec', '--json', '-C', task.cwd, '--skip-git-repo-check', ...(task.model ? ['--model', task.model] : []), ...imageArgs, prompt]
    let child: ChildProcessWithoutNullStreams
    try {
      child = this.spawnCodex(command, args, { cwd: task.cwd, env: environment })
    } catch (error) {
      this.finishTask(task.id, 'failed', error instanceof Error ? error.message : String(error))
      return
    }
    this.processes.set(task.id, child)

    let stdoutBuffer = ''
    let stderrBuffer = ''
    const assistantChunks: string[] = []

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdoutBuffer += String(chunk)
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        this.appendRunLog(task.id, line)
        const parsed = parseJsonLine(line)
        const extracted = extractTextFromCodexEvent(parsed)
        if (extracted && !assistantChunks.includes(extracted)) assistantChunks.push(extracted)
        this.broadcast(task.id, 'output')
      }
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrBuffer += String(chunk)
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        this.appendRunLog(task.id, line)
        this.broadcast(task.id, 'output')
      }
    })

    child.on('error', (error) => {
      this.processes.delete(task.id)
      this.finishTask(task.id, 'failed', error instanceof Error ? error.message : String(error))
    })

    child.on('close', async (code, signal) => {
      this.processes.delete(task.id)
      if (stdoutBuffer.trim()) {
        this.appendRunLog(task.id, stdoutBuffer.trim())
        const extracted = extractTextFromCodexEvent(parseJsonLine(stdoutBuffer.trim()))
        if (extracted && !assistantChunks.includes(extracted)) assistantChunks.push(extracted)
      }
      if (stderrBuffer.trim()) this.appendRunLog(task.id, stderrBuffer.trim())

      const current = this.requireTask(task.id)
      if (current.status === 'cancelled') return

      const assistantText = assistantChunks.join('\n\n').trim()
      if (assistantText) this.appendMessage(task.id, 'assistant', assistantText, 'codex_output')
      const after = await collectCodexTaskEnvironment(task.cwd, this.execFileText)
      this.updateEnvironment(task.id, after)
      this.finishTask(task.id, code === 0 ? 'succeeded' : 'failed', code === 0 ? '' : `AI 编程助手退出码 ${code ?? 'unknown'}${signal ? `，信号 ${signal}` : ''}`)
    })
  }

  private appendMessage(taskId: string, role: CodexTaskMessageRole, content: string, eventType: string, images: string[] = []): void {
    const timestamp = nowIso(this.now)
    this.db().prepare(`
      INSERT INTO codex_task_messages (id, task_id, role, content, attachments, event_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(createMessageId(), taskId, role, content, JSON.stringify(images), eventType, timestamp)
    this.touchTask(taskId, timestamp)
  }

  private appendRunLog(taskId: string, content: string): void {
    const task = this.requireTask(taskId)
    const timestamp = nowIso(this.now)
    this.db().prepare('UPDATE codex_tasks SET run_log = ?, updated_at = ? WHERE id = ?').run(appendLog(task.runLog, content), timestamp, taskId)
  }

  private updateTaskTitle(taskId: string, title: string): void {
    this.db().prepare('UPDATE codex_tasks SET title = ?, updated_at = ? WHERE id = ?').run(title, nowIso(this.now), taskId)
  }

  private updateStatus(taskId: string, status: CodexTaskRunStatus, errorMessage: string): void {
    const timestamp = nowIso(this.now)
    this.db().prepare(`
      UPDATE codex_tasks
      SET status = ?, error_message = ?, run_log = CASE WHEN ? = 'running' THEN '' ELSE run_log END, finished_at = CASE WHEN ? = 'running' THEN '' ELSE finished_at END, updated_at = ?
      WHERE id = ?
    `).run(status, errorMessage, status, status, timestamp, taskId)
  }

  private finishTask(taskId: string, status: CodexTaskRunStatus, errorMessage: string): void {
    const timestamp = nowIso(this.now)
    this.db().prepare(`
      UPDATE codex_tasks SET status = ?, error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?
    `).run(status, errorMessage, timestamp, timestamp, taskId)
    this.broadcast(taskId, status === 'succeeded' || status === 'failed' || status === 'cancelled' ? status : 'updated')
  }

  private updateEnvironment(taskId: string, environment: CodexTaskEnvironment): void {
    this.db().prepare(`
      UPDATE codex_tasks SET branch = ?, additions = ?, deletions = ?, files_changed = ?, updated_at = ? WHERE id = ?
    `).run(environment.branch, environment.additions, environment.deletions, environment.filesChanged, environment.checkedAt, taskId)
  }

  private touchTask(taskId: string, timestamp: string): void {
    this.db().prepare('UPDATE codex_tasks SET updated_at = ? WHERE id = ?').run(timestamp, taskId)
  }

  private requireTask(taskId: string): CodexTaskRecord {
    const task = this.get(taskId)
    if (!task) throw new Error('AI 编程助手对话不存在')
    return task
  }

  private broadcast(taskId: string, type: CodexTaskEventType = 'updated'): void {
    const task = this.get(taskId)
    if (task) this.emit?.({ task, type })
  }
}
