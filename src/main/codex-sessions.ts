import { createReadStream } from 'node:fs'
import { readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import Database from 'better-sqlite3'
import { findLocalAiCommand } from './ai-runtime.js'

export type CodexSessionStatus = 'idle' | 'running' | 'completed' | 'aborted'
export type CodexConversationItemKind = 'user' | 'assistant' | 'tool-call' | 'tool-output' | 'status'

export type CodexTokenUsage = {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteInputTokens: number
  outputTokens: number
  reasoningOutputTokens: number
  totalTokens: number
  cumulativeInputTokens: number
  cumulativeOutputTokens: number
  cumulativeTotalTokens: number
  contextWindow: number
}

export type CodexConversationItem = {
  id: string
  timestamp: string
  kind: CodexConversationItemKind
  text: string
  images: string[]
  eventType: string
  toolName: string
  callId: string
  input: string
  output: string
  usage?: CodexTokenUsage
}

export type CodexSessionSummary = {
  id: string
  title: string
  cwd: string
  projectKey: string
  projectName: string
  filePath: string
  status: CodexSessionStatus
  archived: boolean
  pinned: boolean
  createdAt: string
  updatedAt: string
  preview: string
  lastEvent: string
}

export type CodexSessionDetail = CodexSessionSummary & {
  items: CodexConversationItem[]
}

export type CodexProjectRecord = {
  key: string
  name: string
  cwd: string
  updatedAt: string
  sessionCount: number
  runningCount: number
}

export type CodexSessionsSnapshot = {
  available: boolean
  checkedAt: string
  source: string
  error: string
  running: number
  completed: number
  aborted: number
  projects: CodexProjectRecord[]
  sessions: CodexSessionSummary[]
}

export type CodexSessionEventType = 'item' | 'running' | 'updated' | 'completed' | 'failed' | 'cancelled'

export type CodexSessionEvent = {
  type: CodexSessionEventType
  sessionId: string
  item?: CodexConversationItem
  session?: CodexSessionSummary
  error?: string
}

export type CodexSessionMessageInput = {
  sessionId: string
  content: string
  images?: string[]
  model?: string
  accountId?: string
}

export type CodexSessionStateThread = {
  id?: unknown
  rollout_path?: unknown
  created_at_ms?: unknown
  updated_at_ms?: unknown
  cwd?: unknown
  title?: unknown
  preview?: unknown
  archived?: unknown
}

type SessionCacheEntry = {
  signature: string
  detail: CodexSessionDetail
}

type SpawnCodex = (file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => ChildProcessWithoutNullStreams

export type CodexSessionServiceOptions = {
  codexHome?: string
  stateDatabasePath?: string
  sessionsDirectory?: string
  now?: () => Date
  findCodexCommand?: (env?: NodeJS.ProcessEnv) => Promise<string>
  resolveCodexHome?: (accountId?: string) => Promise<string>
  spawnCodex?: SpawnCodex
  emit?: (event: CodexSessionEvent) => void
  readStateRows?: () => Promise<CodexSessionStateThread[]>
}

const sessionFileSuffix = '.jsonl'
const codexGlobalStateFile = '.codex-global-state.json'
const pinnedThreadIdsKey = 'pinned-thread-ids'
const ignoredEventTypes = new Set(['agent_reasoning', 'thread_settings_applied'])
const visibleStatusEventTypes = new Set([
  'task_started',
  'task_complete',
  'turn_aborted',
  'patch_apply_end',
  'web_search_end',
  'item_completed',
  'context_compacted'
])

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function nativeCodexGlobalStatePath(codexHome: string): string {
  return join(codexHome, codexGlobalStateFile)
}

function pinnedIdsFromGlobalState(value: unknown): Set<string> {
  const state = objectValue(value)
  const ids = state?.[pinnedThreadIdsKey]
  if (!Array.isArray(ids)) return new Set<string>()
  return new Set(ids.map((id) => textValue(id)).filter(Boolean))
}

export async function readCodexPinnedSessionIds(codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')): Promise<Set<string>> {
  try {
    const raw = await readFile(nativeCodexGlobalStatePath(codexHome), 'utf8')
    return pinnedIdsFromGlobalState(JSON.parse(raw) as unknown)
  } catch {
    return new Set<string>()
  }
}

export async function setCodexSessionPinned(codexHome: string, sessionId: string, pinned: boolean): Promise<void> {
  const normalizedSessionId = sessionId.trim()
  if (!normalizedSessionId) return

  const statePath = nativeCodexGlobalStatePath(codexHome)
  let state: Record<string, unknown> = {}
  try {
    const raw = await readFile(statePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    state = objectValue(parsed) ?? {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const pinnedIds = pinnedIdsFromGlobalState(state)
  if (pinned) pinnedIds.add(normalizedSessionId)
  else pinnedIds.delete(normalizedSessionId)
  state[pinnedThreadIdsKey] = Array.from(pinnedIds)

  const tempPath = `${statePath}.forgedesk-${process.pid}-${Date.now()}.tmp`
  await writeFile(tempPath, JSON.stringify(state), 'utf8')
  try {
    await rename(tempPath, statePath)
  } catch (error) {
    try {
      await writeFile(statePath, JSON.stringify(state), 'utf8')
    } catch {
      throw error
    } finally {
      await unlink(tempPath).catch(() => undefined)
    }
  }
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 8 || value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map((item) => extractText(item, depth + 1)).filter(Boolean).join('\n').trim()

  const record = objectValue(value)
  if (!record) return ''
  for (const key of ['text', 'output_text', 'input_text', 'message', 'content', 'delta', 'final_response', 'item', 'data']) {
    const valueText = extractText(record[key], depth + 1)
    if (valueText) return valueText
  }
  return ''
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const imagePathPattern = /(?:file:\/\/)?(\/[^\n\r"'<>[\]()]+?\.(?:png|jpe?g|gif|webp|bmp|avif|svg))(?:\b|$)/gi

function extractImagePaths(value: unknown, depth = 0): string[] {
  if (depth > 8 || value === null || value === undefined) return []
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return [value]
    const matches = Array.from(value.matchAll(imagePathPattern)).map((match) => {
      const path = match[1] || ''
      if (!path) return ''
      if (!value.includes('file://')) return path
      try {
        return decodeURIComponent(path)
      } catch {
        return path
      }
    })
    return matches.filter(Boolean)
  }
  if (Array.isArray(value)) return value.flatMap((item) => extractImagePaths(item, depth + 1))

  const record = objectValue(value)
  if (!record) return []
  return Object.entries(record).flatMap(([key, child]) => {
    if (key === 'image_url' || key === 'image_path' || key === 'file_path' || key === 'path' || key === 'url') {
      return extractImagePaths(child, depth + 1)
    }
    return extractImagePaths(child, depth + 1)
  })
}

function normalizeVisibleUserMessage(value: string): string {
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

function makeItem(input: Partial<CodexConversationItem> & Pick<CodexConversationItem, 'id' | 'timestamp' | 'kind'>): CodexConversationItem {
  return {
    callId: input.callId ?? '',
    eventType: input.eventType ?? '',
    images: input.images ?? [],
    id: input.id,
    input: input.input ?? '',
    kind: input.kind,
    output: input.output ?? '',
    text: input.text ?? '',
    timestamp: input.timestamp,
    toolName: input.toolName ?? '',
    ...(input.usage ? { usage: input.usage } : {})
  }
}

function tokenUsageFromRecord(record: Record<string, unknown>): CodexTokenUsage | undefined {
  const payload = objectValue(record.payload) ?? record
  const info = objectValue(payload.info)
  const last = objectValue(info?.last_token_usage)
  const total = objectValue(info?.total_token_usage)
  if (!last && !total) return undefined

  return {
    inputTokens: numberValue(last?.input_tokens),
    cachedInputTokens: numberValue(last?.cached_input_tokens),
    cacheWriteInputTokens: numberValue(last?.cache_write_input_tokens),
    outputTokens: numberValue(last?.output_tokens),
    reasoningOutputTokens: numberValue(last?.reasoning_output_tokens),
    totalTokens: numberValue(last?.total_tokens),
    cumulativeInputTokens: numberValue(total?.input_tokens),
    cumulativeOutputTokens: numberValue(total?.output_tokens),
    cumulativeTotalTokens: numberValue(total?.total_tokens),
    contextWindow: numberValue(info?.model_context_window)
  }
}

function itemFromRecord(record: Record<string, unknown>, timestamp: string, index: number): CodexConversationItem | null {
  const payload = objectValue(record.payload) ?? record
  const id = textValue(payload.id) || textValue(record.id) || `${timestamp}:${index}`
  const recordType = textValue(record.type)
  const liveItem = objectValue(record.item)

  if (liveItem && (recordType === 'item.started' || recordType === 'item.completed')) {
    const liveItemType = textValue(liveItem.type)
    const liveItemId = textValue(liveItem.id) || id
    if (liveItemType === 'agent_message') {
      const content = extractText(liveItem.text ?? liveItem.content ?? liveItem.message)
      if (!content) return null
      return makeItem({ eventType: 'agent_message', id: liveItemId, kind: 'assistant', text: content, timestamp })
    }

    if (liveItemType === 'command_execution' || liveItemType === 'shell_command') {
      const command = textValue(liveItem.command)
      const output = stringifyValue(liveItem.aggregated_output ?? liveItem.output)
      return makeItem({
        callId: liveItemId,
        eventType: liveItemType,
        id: liveItemId,
        input: command,
        kind: output ? 'tool-output' : 'tool-call',
        output,
        text: output ? '工具输出' : `调用 ${command || 'exec'}`,
        timestamp,
        toolName: 'exec'
      })
    }

    if (liveItemType === 'file_change' || liveItemType === 'file_changes') {
      return makeItem({ eventType: 'patch_apply_end', id: liveItemId, kind: 'status', text: '补丁处理完成', timestamp })
    }

    if (liveItemType === 'web_search_call' || liveItemType === 'web_search') {
      return makeItem({ eventType: 'web_search_end', id: liveItemId, kind: 'status', text: '网络搜索完成', timestamp })
    }
  }

  if (recordType === 'thread.started' || recordType === 'turn.started') {
    return makeItem({ eventType: 'task_started', id, kind: 'status', text: '任务开始', timestamp })
  }
  if (recordType === 'turn.completed') {
    return makeItem({ eventType: 'task_complete', id, kind: 'status', text: '任务完成', timestamp })
  }
  if (recordType === 'turn.failed' || recordType === 'turn.cancelled' || recordType === 'turn.aborted') {
    return makeItem({ eventType: 'turn_aborted', id, kind: 'status', text: textValue(record.error) || '回合已中止', timestamp })
  }

  if (record.type === 'response_item') {
    const responseType = textValue(payload.type)
    const role = textValue(payload.role)
    if (responseType === 'reasoning') return null

    if (responseType === 'custom_tool_call' || responseType === 'function_call') {
      return makeItem({
        callId: textValue(payload.call_id),
        eventType: responseType,
        id,
        input: stringifyValue(payload.input ?? payload.arguments),
        kind: 'tool-call',
        text: `调用 ${textValue(payload.name) || '工具'}`,
        timestamp,
        toolName: textValue(payload.name) || '工具'
      })
    }

    if (responseType === 'custom_tool_call_output' || responseType === 'function_call_output') {
      return makeItem({
        callId: textValue(payload.call_id),
        eventType: responseType,
        id,
        kind: 'tool-output',
        output: stringifyValue(payload.output ?? payload.content),
        text: '工具输出',
        timestamp
      })
    }

    if (role === 'user') {
      const source = payload.content ?? payload.message ?? payload.text
      const images = [...new Set(extractImagePaths(source))]
      const content = normalizeVisibleUserMessage(extractText(source))
      if (!content && images.length === 0) return null
      return makeItem({ eventType: 'user_message', id, images, kind: 'user', text: content || '已附加图片', timestamp })
    }

    if (role === 'assistant') {
      const content = extractText(payload.content ?? payload.message ?? payload.text)
      if (!content) return null
      return makeItem({ eventType: 'assistant_message', id, kind: 'assistant', text: content, timestamp })
    }

    return null
  }

  if (record.type === 'event_msg') {
    const eventType = textValue(payload.type)
    if (eventType === 'token_count') {
      const usage = tokenUsageFromRecord(record)
      if (!usage) return null
      return makeItem({ eventType, id, kind: 'status', text: 'Token 使用情况', timestamp, usage })
    }
    if (eventType === 'agent_message') {
      const content = extractText(payload.message ?? payload.content ?? payload.text)
      if (!content) return null
      return makeItem({ eventType, id, kind: 'assistant', text: content, timestamp })
    }
    if (!visibleStatusEventTypes.has(eventType) || ignoredEventTypes.has(eventType)) return null
    return makeItem({ eventType, id, kind: 'status', text: textValue(payload.message) || eventType, timestamp })
  }

  return null
}

function dedupeItems(items: CodexConversationItem[]): CodexConversationItem[] {
  const result: CodexConversationItem[] = []
  let previousKey = ''
  for (const item of items) {
    const key = `${item.kind}:${item.text}:${item.images.join('|')}:${item.toolName}:${item.callId}`
    if ((item.kind === 'assistant' || item.kind === 'user') && key === previousKey) continue
    previousKey = key
    result.push(item)
  }
  return result
}

function parseTimestamp(value: unknown, fallback: string): string {
  const text = textValue(value)
  if (text) return text
  return fallback
}

function toIsoTimestamp(value: unknown, fallback: string): string {
  const number = numberValue(value)
  if (number > 0) {
    return new Date(number < 1_000_000_000_000 ? number * 1000 : number).toISOString()
  }
  return fallback
}

function projectKey(cwd: string): string {
  return cwd ? normalize(resolve(cwd)) : '__unknown__'
}

function projectName(cwd: string): string {
  return cwd ? basename(normalize(resolve(cwd))) || cwd : '未记录项目'
}

function fallbackTitle(filePath: string, cwd: string, id: string): string {
  return basename(cwd) || id || basename(filePath, sessionFileSuffix) || 'Codex 会话'
}

async function listSessionFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  const pending = [directory]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) continue
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const filePath = join(current, entry.name)
      if (entry.isDirectory()) pending.push(filePath)
      else if (entry.isFile() && entry.name.endsWith(sessionFileSuffix)) files.push(filePath)
    }
  }
  return files
}

async function parseSessionFile(filePath: string, fallback: CodexSessionSummary): Promise<CodexSessionDetail> {
  const items: CodexConversationItem[] = []
  let lastEvent = fallback.lastEvent
  let lastTerminalEvent = ''
  let running = fallback.status === 'running'
  let sequence = 0
  let lastTerminal = 0
  let lastTaskActivity = 0
  let startedAt = fallback.createdAt
  let updatedAt = fallback.updatedAt

  const input = createReadStream(filePath, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }
      const record = objectValue(parsed)
      if (!record) continue
      const timestamp = parseTimestamp(record.timestamp, updatedAt || fallback.updatedAt)
      if (timestamp) {
        startedAt ||= timestamp
        updatedAt = timestamp
      }
      const payload = objectValue(record.payload)
      if (record.type === 'event_msg' || record.type === 'thread.started' || record.type === 'turn.started' || record.type === 'turn.completed' || record.type === 'turn.failed' || record.type === 'turn.cancelled' || record.type === 'turn.aborted') {
        const eventType = record.type === 'event_msg'
          ? textValue(payload?.type)
          : record.type === 'thread.started' || record.type === 'turn.started'
            ? 'task_started'
            : record.type === 'turn.completed'
              ? 'task_complete'
              : 'turn_aborted'
        if (eventType) {
          sequence += 1
          lastEvent = eventType
          if (eventType === 'task_started' || eventType === 'user_message') lastTaskActivity = sequence
          if (eventType === 'task_complete' || eventType === 'turn_aborted') {
            lastTerminal = sequence
            lastTerminalEvent = eventType
          }
        }
      }
      const item = itemFromRecord(record, timestamp, items.length)
      if (item) items.push(item)
    }
  } finally {
    lines.close()
  }

  const dedupedItems = dedupeItems(items)
  if (lastTaskActivity > lastTerminal) running = true
  else if (lastEvent === 'task_complete') running = false
  else if (lastEvent === 'turn_aborted') running = false

  return {
    ...fallback,
    createdAt: startedAt || fallback.createdAt,
    items: dedupedItems,
    lastEvent,
    preview: [...dedupedItems].reverse().find((item) => item.kind === 'user')?.text || fallback.preview,
    status: running ? 'running' : lastTerminalEvent === 'task_complete' ? 'completed' : lastTerminalEvent === 'turn_aborted' ? 'aborted' : fallback.status,
    title: fallback.title || dedupedItems.find((item) => item.kind === 'user')?.text || fallbackTitle(filePath, fallback.cwd, fallback.id),
    updatedAt: updatedAt || fallback.updatedAt
  }
}

function eventFromJsonLine(line: string, index: number): CodexConversationItem | null {
  try {
    const record = JSON.parse(line) as unknown
    const object = objectValue(record)
    if (!object) return null
    return itemFromRecord(object, parseTimestamp(object.timestamp, new Date().toISOString()), index)
  } catch {
    return null
  }
}

export class CodexSessionService {
  private readonly codexHome: string
  private readonly stateDatabasePath?: string
  private readonly sessionsDirectory: string
  private readonly now: () => Date
  private readonly findCodexCommand: (env?: NodeJS.ProcessEnv) => Promise<string>
  private readonly resolveCodexHome: (accountId?: string) => Promise<string>
  private readonly spawnCodex: SpawnCodex
  private readonly emit?: (event: CodexSessionEvent) => void
  private readonly readStateRowsOverride?: () => Promise<CodexSessionStateThread[]>
  private readonly cache = new Map<string, SessionCacheEntry>()
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>()
  private readonly cancelledSessions = new Set<string>()
  private readonly terminalStatuses = new Map<string, CodexSessionStatus>()

  constructor(options: CodexSessionServiceOptions = {}) {
    this.codexHome = options.codexHome ?? process.env.CODEX_HOME?.trim() ?? join(homedir(), '.codex')
    this.stateDatabasePath = options.stateDatabasePath
    this.sessionsDirectory = options.sessionsDirectory ?? join(this.codexHome, 'sessions')
    this.now = options.now ?? (() => new Date())
    this.findCodexCommand = options.findCodexCommand ?? ((env) => findLocalAiCommand('codex-cli', { env }))
    this.resolveCodexHome = options.resolveCodexHome ?? (async () => this.codexHome)
    this.spawnCodex = options.spawnCodex ?? ((file, args, spawnOptions) => spawn(file, args, spawnOptions))
    this.emit = options.emit
    this.readStateRowsOverride = options.readStateRows
  }

  async list(): Promise<CodexSessionsSnapshot> {
    const checkedAt = this.now().toISOString()
    try {
      const summaries = await this.readSummaries(await this.resolveCodexHome())
      const projects = new Map<string, CodexProjectRecord>()
      for (const session of summaries) {
        const current = projects.get(session.projectKey)
        if (current) {
          current.sessionCount += 1
          current.runningCount += session.status === 'running' ? 1 : 0
          if (session.updatedAt > current.updatedAt) current.updatedAt = session.updatedAt
        } else {
          projects.set(session.projectKey, {
            cwd: session.cwd,
            key: session.projectKey,
            name: session.projectName,
            runningCount: session.status === 'running' ? 1 : 0,
            sessionCount: 1,
            updatedAt: session.updatedAt
          })
        }
      }
      const sortedSessions = summaries.sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt.localeCompare(left.updatedAt))
      const running = sortedSessions.filter((session) => session.status === 'running').length
      const completed = sortedSessions.filter((session) => session.status === 'completed').length
      const aborted = sortedSessions.filter((session) => session.status === 'aborted').length
      return {
        aborted,
        available: true,
        checkedAt,
        completed,
        error: '',
        projects: Array.from(projects.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        running,
        sessions: sortedSessions,
        source: this.stateDatabasePath ?? this.codexHome
      }
    } catch (error) {
      return {
        aborted: 0,
        available: false,
        checkedAt,
        completed: 0,
        error: error instanceof Error ? error.message : String(error),
        projects: [],
        running: 0,
        sessions: [],
        source: this.stateDatabasePath ?? this.codexHome
      }
    }
  }

  async get(sessionId: string): Promise<CodexSessionDetail> {
    const summaries = await this.readSummaries(await this.resolveCodexHome())
    const summary = summaries.find((session) => session.id === sessionId)
    if (!summary) throw new Error('Codex 会话不存在')
    const fileStat = await stat(summary.filePath)
    const signature = `${fileStat.size}:${fileStat.mtimeMs}`
    const cached = this.cache.get(sessionId)
    const statusOverride = this.processes.has(sessionId) ? 'running' : this.terminalStatuses.get(sessionId)
    if (cached?.signature === signature) {
      return { ...cached.detail, status: statusOverride ?? cached.detail.status }
    }
    const detail = await parseSessionFile(summary.filePath, summary)
    this.cache.set(sessionId, { detail, signature })
    return { ...detail, status: statusOverride ?? detail.status }
  }

  async togglePin(sessionId: string): Promise<CodexSessionSummary> {
    const session = await this.get(sessionId)
    const pinned = !session.pinned
    await setCodexSessionPinned(await this.resolveCodexHome(), sessionId, pinned)
    const nextSession = { ...session, pinned }
    const cached = this.cache.get(sessionId)
    if (cached) this.cache.set(sessionId, { ...cached, detail: { ...cached.detail, pinned } })
    this.emit?.({ session: nextSession, sessionId, type: 'updated' })
    return nextSession
  }

  async sendMessage(input: CodexSessionMessageInput): Promise<CodexSessionDetail> {
    const content = input.content.trim()
    if (!content) throw new Error('请输入对话内容')
    if (this.processes.has(input.sessionId)) throw new Error('该 Codex 会话正在运行')
    const session = await this.get(input.sessionId)
    if (session.archived) throw new Error('已归档的 Codex 会话不能继续对话')
    const codexHome = await this.resolveCodexHome(input.accountId)
    const environment = { ...process.env, CODEX_HOME: codexHome, NO_COLOR: '1' }
    const command = await this.findCodexCommand(environment)
    if (!command) throw new Error('未检测到 Codex CLI')

    const images = [...new Set((input.images ?? []).map((image) => image.trim()).filter(Boolean))]
    const model = input.model?.trim() || ''
    const args = ['exec', 'resume', '--json', '--skip-git-repo-check', ...(model ? ['--model', model] : []), ...images.flatMap((image) => ['--image', image]), input.sessionId, content]
    let child: ChildProcessWithoutNullStreams
    try {
      child = this.spawnCodex(command, args, { cwd: session.cwd || process.cwd(), env: environment })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error))
    }
    this.processes.set(input.sessionId, child)
    this.cancelledSessions.delete(input.sessionId)
    this.terminalStatuses.delete(input.sessionId)
    this.emit?.({ sessionId: input.sessionId, type: 'running', session: { ...session, status: 'running' } })

    let stdoutBuffer = ''
    let stderrBuffer = ''
    let index = 0
    const consume = (line: string, isError = false): void => {
      if (!line.trim()) return
      const item = isError ? makeItem({ id: `stderr:${input.sessionId}:${index}`, kind: 'status', text: line.trim(), timestamp: this.now().toISOString(), eventType: 'stderr' }) : eventFromJsonLine(line, index)
      index += 1
      if (item) this.emit?.({ item, sessionId: input.sessionId, type: 'item' })
    }

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdoutBuffer += String(chunk)
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      lines.forEach((line) => consume(line))
    })
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrBuffer += String(chunk)
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() ?? ''
      lines.forEach((line) => consume(line, true))
    })
    child.on('error', (error) => {
      this.processes.delete(input.sessionId)
      this.terminalStatuses.set(input.sessionId, 'aborted')
      this.emit?.({ error: error.message, sessionId: input.sessionId, type: 'failed' })
    })
    child.on('close', async (code, signal) => {
      if (stdoutBuffer.trim()) consume(stdoutBuffer)
      if (stderrBuffer.trim()) consume(stderrBuffer, true)
      this.processes.delete(input.sessionId)
      const cancelled = this.cancelledSessions.delete(input.sessionId)
      const type: CodexSessionEventType = cancelled ? 'cancelled' : code === 0 ? 'completed' : 'failed'
      const status: CodexSessionStatus = type === 'completed' ? 'completed' : 'aborted'
      this.terminalStatuses.set(input.sessionId, status)
      let session: CodexSessionSummary | undefined
      try {
        session = { ...await this.get(input.sessionId), status }
      } catch {
        session = undefined
      }
      this.emit?.({
        error: cancelled || code === 0 ? undefined : `Codex 退出码 ${code ?? 'unknown'}${signal ? `，信号 ${signal}` : ''}`,
        session,
        sessionId: input.sessionId,
        type
      })
    })

    return this.get(input.sessionId)
  }

  async cancel(sessionId: string): Promise<CodexSessionDetail> {
    const process = this.processes.get(sessionId)
    if (process) {
      this.cancelledSessions.add(sessionId)
      process.kill()
      this.processes.delete(sessionId)
      this.terminalStatuses.set(sessionId, 'aborted')
      let session: CodexSessionSummary | undefined
      try {
        session = { ...await this.get(sessionId), status: 'aborted' }
      } catch {
        session = undefined
      }
      this.emit?.({ session, sessionId, type: 'cancelled' })
    }
    return this.get(sessionId)
  }

  private async readSummaries(codexHome = this.codexHome): Promise<CodexSessionSummary[]> {
    const rows = await this.readStateRows(codexHome)
    const pinnedSessionIds = await readCodexPinnedSessionIds(codexHome)
    if (rows.length > 0) {
      const summaries: CodexSessionSummary[] = []
      for (const row of rows) {
        const id = textValue(row.id)
        const filePath = textValue(row.rollout_path)
        if (!id || !filePath) continue
        const cwd = textValue(row.cwd)
          const fallback: CodexSessionSummary = {
          archived: Boolean(numberValue(row.archived)),
          createdAt: toIsoTimestamp(row.created_at_ms, ''),
          cwd,
          filePath,
          id,
          lastEvent: '',
          preview: normalizeVisibleUserMessage(textValue(row.preview)),
          projectKey: projectKey(cwd),
          projectName: projectName(cwd),
          status: this.processes.has(id) ? 'running' : this.terminalStatuses.get(id) ?? 'idle',
          pinned: pinnedSessionIds.has(id),
          title: normalizeVisibleUserMessage(textValue(row.title)) || fallbackTitle(filePath, cwd, id),
          updatedAt: toIsoTimestamp(row.updated_at_ms, toIsoTimestamp(row.created_at_ms, ''))
        }
        try {
          const fileStat = await stat(filePath)
          const signature = `${fileStat.size}:${fileStat.mtimeMs}`
          const cached = this.cache.get(id)
          if (cached?.signature === signature) {
            summaries.push({
              ...fallback,
              lastEvent: cached.detail.lastEvent,
              preview: cached.detail.preview || fallback.preview,
              status: this.processes.has(id) ? 'running' : this.terminalStatuses.get(id) ?? cached.detail.status
            })
            continue
          }
          const detail = await parseSessionFile(filePath, fallback)
          this.cache.set(id, { detail, signature })
          summaries.push({ ...detail })
        } catch {
          summaries.push(fallback)
        }
      }
      return summaries
    }

    const files = await listSessionFiles(join(codexHome, 'sessions'))
    const summaries: CodexSessionSummary[] = []
    for (const filePath of files) {
      const fileStat = await stat(filePath)
      const fileName = basename(filePath, sessionFileSuffix)
      const id = /([0-9a-f]{8}-[0-9a-f-]{27,})$/i.exec(fileName)?.[1] ?? fileName
      const fallback: CodexSessionSummary = {
        archived: false,
        createdAt: fileStat.mtime.toISOString(),
        cwd: '',
        filePath,
        id,
        lastEvent: '',
        preview: '',
        projectKey: '__unknown__',
        projectName: '未记录项目',
        status: this.processes.has(id) ? 'running' : this.terminalStatuses.get(id) ?? 'idle',
        pinned: pinnedSessionIds.has(id),
        title: fallbackTitle(filePath, '', id),
        updatedAt: fileStat.mtime.toISOString()
      }
      const detail = await parseSessionFile(filePath, fallback)
      this.cache.set(id, { detail, signature: `${fileStat.size}:${fileStat.mtimeMs}` })
      summaries.push(detail)
    }
    return summaries
  }

  private async readStateRows(codexHome = this.codexHome): Promise<CodexSessionStateThread[]> {
    if (this.readStateRowsOverride) return this.readStateRowsOverride()
    try {
      const databasePath = this.stateDatabasePath ?? await this.findStateDatabasePath(codexHome)
      if (!databasePath) return []
      const database = new Database(databasePath, { readonly: true, fileMustExist: true })
      try {
      return database.prepare('SELECT id, rollout_path, created_at_ms, updated_at_ms, cwd, title, preview, archived FROM threads ORDER BY updated_at_ms DESC').all() as CodexSessionStateThread[]
      } finally {
        database.close()
      }
    } catch {
      return []
    }
  }

  private async findStateDatabasePath(codexHome = this.codexHome): Promise<string> {
    const entries = await readdir(codexHome, { withFileTypes: true })
    const candidates = entries
      .filter((entry) => entry.isFile() && /^state_\d+\.sqlite$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => Number(right.match(/\d+/)?.[0] ?? 0) - Number(left.match(/\d+/)?.[0] ?? 0))
    return candidates[0] ? join(codexHome, candidates[0]) : ''
  }
}
