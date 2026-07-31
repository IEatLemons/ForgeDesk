import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'

export type CodexSessionStatus = 'idle' | 'running' | 'completed' | 'aborted'

export type CodexSessionRecord = {
  id: string
  filePath: string
  title: string
  cwd: string
  status: CodexSessionStatus
  startedAt: string
  updatedAt: string
  tasks: number
  completed: number
  aborted: number
  lastEvent: string
  lastMessage: string
}

export type CodexActivitySnapshot = {
  available: boolean
  running: number
  completed: number
  aborted: number
  sessions: CodexSessionRecord[]
  checkedAt: string
  source: string
  error: string
}

type SessionInspection = {
  id: string
  cwd: string
  title: string
  startedAt: string
  updatedAt: string
  completed: number
  aborted: number
  tasks: number
  running: boolean
  lastEvent: string
  lastMessage: string
}

type CachedSession = {
  signature: string
  inspection: SessionInspection
}

export type CodexActivityServiceOptions = {
  sessionsDirectory?: string
  now?: () => Date
}

const sessionFileSuffix = '.jsonl'

function emptyInspection(): SessionInspection {
  return {
    aborted: 0,
    completed: 0,
    cwd: '',
    id: '',
    lastEvent: '',
    lastMessage: '',
    running: false,
    startedAt: '',
    tasks: 0,
    title: '',
    updatedAt: ''
  }
}

function isTaskActivity(type: string): boolean {
  return type === 'task_started' || type === 'user_message'
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 5 || value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map((item) => extractText(item, depth + 1)).filter(Boolean).join('\n').trim()

  const record = objectValue(value)
  if (!record) return ''
  for (const key of ['text', 'message', 'content', 'input_text', 'output_text']) {
    const text = extractText(record[key], depth + 1)
    if (text) return text
  }
  return ''
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120)
}

function extractSessionMessage(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n')
  const requestMarker = normalized.match(/(?:^|\n)##\s*My request for Codex:\s*\n?([\s\S]*)$/i)
  const candidate = requestMarker?.[1] ?? normalized

  return candidate
    .replace(/<(recommended_plugins|environment_context)>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, ' ')
    .replace(/<image\b[^>]*\/?>/gi, ' ')
    .replace(/<\/image>/gi, ' ')
    .trim()
}

function sessionFallbackTitle(filePath: string, cwd: string, id: string): string {
  return basename(cwd) || id || basename(filePath, '.jsonl') || 'Codex 会话'
}

async function inspectSessionFile(filePath: string, fallbackUpdatedAt: string): Promise<SessionInspection> {
  const inspection = emptyInspection()
  let sequence = 0
  let lastTaskActivity = 0
  let lastTerminal = 0

  const input = createReadStream(filePath, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })

  try {
    for await (const line of lines) {
      let event: unknown
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }

      const record = event && typeof event === 'object' ? event as Record<string, unknown> : null
      if (!record) continue

      const timestamp = stringValue(record.timestamp)
      if (timestamp) {
        if (!inspection.startedAt) inspection.startedAt = timestamp
        inspection.updatedAt = timestamp
      }

      const recordType = stringValue(record.type)
      const payload = objectValue(record.payload)

      if (recordType === 'session_meta') {
        const metadata = payload ?? record
        inspection.id ||= stringValue(metadata.id) || stringValue(record.id)
        inspection.cwd ||= stringValue(metadata.cwd) || stringValue(metadata.workspace)
        continue
      }

      if (recordType === 'response_item') {
        const role = stringValue(payload?.role)
        if (role === 'user') {
          const message = normalizeTitle(extractSessionMessage(extractText(payload?.content ?? payload?.message ?? payload?.text)))
          if (message && !inspection.title) inspection.title = message
          if (message) inspection.lastMessage = message
        }
        continue
      }

      if (recordType !== 'event_msg') continue

      const eventType = typeof payload?.type === 'string' ? payload.type : ''
      if (!eventType) continue

      sequence += 1
      inspection.lastEvent = eventType
      if (eventType === 'task_complete') {
        inspection.completed += 1
        lastTerminal = sequence
      } else if (eventType === 'turn_aborted') {
        inspection.aborted += 1
        lastTerminal = sequence
      } else if (isTaskActivity(eventType)) {
        lastTaskActivity = sequence
        if (eventType === 'task_started' || inspection.tasks === 0) inspection.tasks += 1
        const message = normalizeTitle(extractSessionMessage(extractText(payload?.message ?? payload?.content ?? payload?.text)))
        if (message) {
          inspection.title ||= message
          inspection.lastMessage = message
        }
      }
    }
  } finally {
    lines.close()
  }

  inspection.id ||= basename(filePath, '.jsonl')
  inspection.title ||= sessionFallbackTitle(filePath, inspection.cwd, inspection.id)
  inspection.startedAt ||= fallbackUpdatedAt
  inspection.updatedAt ||= fallbackUpdatedAt
  inspection.running = lastTaskActivity > lastTerminal
  return inspection
}

function toSessionStatus(inspection: SessionInspection): CodexSessionStatus {
  if (inspection.running) return 'running'
  if (inspection.lastEvent === 'task_complete') return 'completed'
  if (inspection.lastEvent === 'turn_aborted') return 'aborted'
  return 'idle'
}

function mapSession(filePath: string, inspection: SessionInspection): CodexSessionRecord {
  return {
    aborted: inspection.aborted,
    completed: inspection.completed,
    cwd: inspection.cwd,
    filePath,
    id: inspection.id,
    lastEvent: inspection.lastEvent,
    lastMessage: inspection.lastMessage,
    startedAt: inspection.startedAt,
    status: toSessionStatus(inspection),
    tasks: inspection.tasks,
    title: inspection.title,
    updatedAt: inspection.updatedAt
  }
}

async function listSessionFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  const pending = [directory]

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) continue

    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        pending.push(path)
      } else if (entry.isFile() && entry.name.endsWith(sessionFileSuffix)) {
        files.push(path)
      }
    }
  }

  return files
}

export class CodexActivityService {
  private readonly sessionsDirectory: string
  private readonly now: () => Date
  private readonly cache = new Map<string, CachedSession>()

  constructor(options: CodexActivityServiceOptions = {}) {
    const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
    this.sessionsDirectory = options.sessionsDirectory ?? join(codexHome, 'sessions')
    this.now = options.now ?? (() => new Date())
  }

  async snapshot(): Promise<CodexActivitySnapshot> {
    const checkedAt = this.now().toISOString()

    try {
      const files = await listSessionFiles(this.sessionsDirectory)
      const currentFiles = new Set(files)
      let running = 0
      let completed = 0
      let aborted = 0
      const sessions: CodexSessionRecord[] = []

      for (const filePath of files) {
        const fileStat = await stat(filePath)
        const signature = `${fileStat.size}:${fileStat.mtimeMs}`
        const cached = this.cache.get(filePath)
        const inspection = cached?.signature === signature
          ? cached.inspection
          : await inspectSessionFile(filePath, fileStat.mtime.toISOString())

        this.cache.set(filePath, { inspection, signature })
        if (inspection.running) running += 1
        completed += inspection.completed
        aborted += inspection.aborted
        sessions.push(mapSession(filePath, inspection))
      }

      for (const filePath of this.cache.keys()) {
        if (!currentFiles.has(filePath)) this.cache.delete(filePath)
      }

      return {
        aborted,
        available: true,
        checkedAt,
        completed,
        error: '',
        running,
        sessions: sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        source: this.sessionsDirectory
      }
    } catch (error) {
      return {
        aborted: 0,
        available: false,
        checkedAt,
        completed: 0,
        error: error instanceof Error ? error.message : String(error),
        running: 0,
        sessions: [],
        source: this.sessionsDirectory
      }
    }
  }
}
