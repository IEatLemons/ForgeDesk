import ExcelJS from 'exceljs'
import { createAiNetworkError, createAiRequestError } from './ai-errors.js'
import { buildAiRequestHeaders, type AiSettings } from './ai-settings.js'

export type MonthlyPerformancePreviewInput = {
  projectId: string
  month: string
  instruction: string
}

export type MonthlyPerformanceRow = {
  personId: string
  name: string
  role: string
  identity: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
  completedWorkItems: number
  inProgressWorkItems: number
  overdueWorkItems: number
  aiScore: number
  performanceLevel: string
  highlights: string
  risks: string
  nextMonthPlan: string
  notes: string
}

export type MonthlyPerformancePreview = {
  projectId: string
  projectName: string
  month: string
  startDate: string
  endDate: string
  generatedAt: string
  totalCommits: number
  totalAdditions: number
  totalDeletions: number
  activeDays: number
  contributorCount: number
  aiSummary: string
  highlights: string[]
  risks: string[]
  nextMonthFocus: string[]
  rows: MonthlyPerformanceRow[]
  warnings: string[]
}

export type MonthlyPerformanceExportInput = {
  preview: MonthlyPerformancePreview
}

export type MonthlyPerformanceExportResult = {
  filePath: string | null
}

export type MonthlyPerformanceMessageRole = 'user' | 'assistant'

export type MonthlyPerformanceChatMessage = {
  id: string
  role: MonthlyPerformanceMessageRole
  content: string
  createdAt: string
}

export type MonthlyPerformanceSessionStatus = 'draft' | 'ready' | 'exported'

export type MonthlyPerformanceSession = {
  id: string
  projectId: string
  projectName: string
  month: string
  title: string
  status: MonthlyPerformanceSessionStatus
  messages: MonthlyPerformanceChatMessage[]
  preview: MonthlyPerformancePreview | null
  filePath: string
  createdAt: string
  updatedAt: string
  exportedAt: string
}

export type MonthlyPerformanceSessionCreateInput = {
  projectId: string
  month: string
}

export type MonthlyPerformanceSessionScopeInput = {
  sessionId: string
  projectId: string
  month: string
}

export type MonthlyPerformanceSessionMessageInput = MonthlyPerformanceSessionScopeInput & {
  content: string
}

export type MonthlyPerformanceSessionExportInput = {
  sessionId: string
}

export type MonthlyPerformanceChatRequest = {
  settings: AiSettings
  projectName: string
  month: string
  messages: MonthlyPerformanceChatMessage[]
  fetchImpl?: typeof fetch
}

export type MonthlyPerformanceRange = {
  startDate: string
  endDate: string
}

export type MonthlyPerformanceContributorSource = {
  personId: string
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
}

export type MonthlyPerformancePersonSource = {
  id: string
  displayName: string
  role: string
  identities: Array<{
    name: string
    email: string
  }>
}

export type MonthlyPerformanceWorkItemSource = {
  stateName: string
  stateGroup: string
  assigneeNames: string[]
  targetDate: string
  updatedAt: string
}

export type MonthlyPerformanceSourceRowInput = {
  contributors: MonthlyPerformanceContributorSource[]
  people: MonthlyPerformancePersonSource[]
  workItems: MonthlyPerformanceWorkItemSource[]
  startDate: string
  endDate: string
}

export type MonthlyPerformancePreviewRequest = {
  settings: AiSettings
  projectId: string
  projectName: string
  month: string
  startDate: string
  endDate: string
  instruction: string
  totalCommits: number
  totalAdditions: number
  totalDeletions: number
  activeDays: number
  contributorCount: number
  sourceRows: MonthlyPerformanceRow[]
  sourceWarnings?: string[]
  fetchImpl?: typeof fetch
}

type MonthlyPerformanceAiPayload = {
  aiSummary?: unknown
  summary?: {
    aiSummary?: unknown
    highlights?: unknown
    risks?: unknown
    nextMonthFocus?: unknown
    warnings?: unknown
  }
  highlights?: unknown
  risks?: unknown
  nextMonthFocus?: unknown
  rows?: unknown
  warnings?: unknown
}

type MonthlyPerformanceStatement = {
  run: (...params: any[]) => unknown
  get: (...params: any[]) => unknown
  all: (...params: any[]) => unknown[]
}

type MonthlyPerformanceDatabase = {
  prepare: (sql: string) => MonthlyPerformanceStatement
}

const detailHeaders = [
  '姓名',
  '角色',
  '邮箱/身份',
  '提交数',
  '新增行',
  '删除行',
  '变更文件',
  '活跃天数',
  '完成工作项',
  '进行中工作项',
  '逾期工作项',
  'AI 分数',
  '绩效等级',
  '亮点',
  '风险/改进',
  '下月建议',
  '备注'
]

function nowIso(): string {
  return new Date().toISOString()
}

function createSessionId(): string {
  return `monthly-performance-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createMessageId(): string {
  return `message-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}

function normalizeSessionStatus(value: unknown): MonthlyPerformanceSessionStatus {
  const status = String(value || 'draft')
  return status === 'ready' || status === 'exported' ? status : 'draft'
}

function createSessionTitle(projectName: string, month: string): string {
  return `${projectName || '项目'} ${month} 月度绩效`
}

function mapMonthlyPerformanceSessionRow(row: Record<string, unknown>): MonthlyPerformanceSession {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    projectName: String(row.project_name ?? ''),
    month: String(row.month ?? ''),
    title: String(row.title ?? '') || createSessionTitle(String(row.project_name ?? ''), String(row.month ?? '')),
    status: normalizeSessionStatus(row.status),
    messages: parseJsonValue<MonthlyPerformanceChatMessage[]>(row.messages_json, []),
    preview: parseJsonValue<MonthlyPerformancePreview | null>(row.preview_json, null),
    filePath: String(row.file_path ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    exportedAt: String(row.exported_at ?? '')
  }
}

function stripMarkdownFence(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:json)?\n([\s\S]*?)\n```$/i)
  return match ? match[1].trim() : trimmed
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join('；')
  }

  return ''
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean)
  }

  const text = normalizeText(value)
  return text ? [text] : []
}

function normalizeNumber(value: unknown): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeCount(value: unknown): number {
  return Math.max(0, Math.round(normalizeNumber(value)))
}

function normalizeScore(value: unknown): number {
  const score = normalizeNumber(value)
  return Math.min(100, Math.max(0, Math.round(score)))
}

function derivePerformanceLevel(score: number): string {
  if (score >= 90) {
    return 'A'
  }

  if (score >= 80) {
    return 'B'
  }

  if (score >= 70) {
    return 'C'
  }

  if (score > 0) {
    return 'D'
  }

  return '待评估'
}

function rowKey(row: Pick<MonthlyPerformanceRow, 'personId' | 'name' | 'identity'>): string {
  return (row.personId || row.identity || row.name).trim().toLowerCase()
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeDate(value: string): string {
  return value.slice(0, 10)
}

function isDateInRange(value: string, startDate: string, endDate: string): boolean {
  const normalized = normalizeDate(value)
  return Boolean(normalized) && normalized >= startDate && normalized <= endDate
}

function isCompletedWorkItem(workItem: MonthlyPerformanceWorkItemSource): boolean {
  return workItem.stateGroup.trim().toLowerCase() === 'completed'
}

function isCancelledWorkItem(workItem: MonthlyPerformanceWorkItemSource): boolean {
  return workItem.stateGroup.trim().toLowerCase() === 'cancelled'
}

function isInProgressWorkItem(workItem: MonthlyPerformanceWorkItemSource): boolean {
  const group = workItem.stateGroup.trim().toLowerCase()
  const state = workItem.stateName.trim().toLowerCase()
  return group === 'started' || state.includes('progress') || state.includes('进行')
}

function isRelevantWorkItem(workItem: MonthlyPerformanceWorkItemSource, startDate: string, endDate: string): boolean {
  return isDateInRange(workItem.updatedAt, startDate, endDate) || isDateInRange(workItem.targetDate, startDate, endDate)
}

function getPersonIdentity(person: MonthlyPerformancePersonSource | undefined, fallbackEmail: string): string {
  if (fallbackEmail) {
    return fallbackEmail
  }

  const identity = person?.identities.find((item) => item.email || item.name)
  return identity ? identity.email || identity.name : ''
}

function createEmptyMonthlyPerformanceRow(input: {
  personId?: string
  name: string
  role?: string
  identity?: string
}): MonthlyPerformanceRow {
  return {
    personId: input.personId ?? '',
    name: input.name,
    role: input.role ?? '',
    identity: input.identity ?? '',
    commits: 0,
    additions: 0,
    deletions: 0,
    filesChanged: 0,
    activeDays: 0,
    completedWorkItems: 0,
    inProgressWorkItems: 0,
    overdueWorkItems: 0,
    aiScore: 0,
    performanceLevel: '待评估',
    highlights: '',
    risks: '',
    nextMonthPlan: '',
    notes: ''
  }
}

function normalizeAiRow(value: unknown): MonthlyPerformanceRow | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const name = normalizeText(record.name)

  if (!name) {
    return null
  }

  const aiScore = normalizeScore(record.aiScore)

  return {
    personId: normalizeText(record.personId),
    name,
    role: normalizeText(record.role),
    identity: normalizeText(record.identity),
    commits: normalizeCount(record.commits),
    additions: normalizeCount(record.additions),
    deletions: normalizeCount(record.deletions),
    filesChanged: normalizeCount(record.filesChanged),
    activeDays: normalizeCount(record.activeDays),
    completedWorkItems: normalizeCount(record.completedWorkItems),
    inProgressWorkItems: normalizeCount(record.inProgressWorkItems),
    overdueWorkItems: normalizeCount(record.overdueWorkItems),
    aiScore,
    performanceLevel: normalizeText(record.performanceLevel) || derivePerformanceLevel(aiScore),
    highlights: normalizeText(record.highlights),
    risks: normalizeText(record.risks),
    nextMonthPlan: normalizeText(record.nextMonthPlan),
    notes: normalizeText(record.notes)
  }
}

function mergeAiRow(source: MonthlyPerformanceRow, aiRow: MonthlyPerformanceRow | undefined): MonthlyPerformanceRow {
  if (!aiRow) {
    return source
  }

  return {
    ...source,
    aiScore: aiRow.aiScore,
    performanceLevel: aiRow.performanceLevel || derivePerformanceLevel(aiRow.aiScore),
    highlights: aiRow.highlights,
    risks: aiRow.risks,
    nextMonthPlan: aiRow.nextMonthPlan,
    notes: aiRow.notes
  }
}

function parseMonthlyPerformanceAiPayload(content: string): MonthlyPerformanceAiPayload {
  const stripped = stripMarkdownFence(content)

  try {
    const parsed = JSON.parse(stripped) as MonthlyPerformanceAiPayload
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new Error('AI 没有返回有效的月度绩效 JSON')
  }
}

export function createMonthlyPerformanceRange(month: string): MonthlyPerformanceRange {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('月份格式必须是 YYYY-MM')
  }

  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('月份格式必须是 YYYY-MM')
  }

  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  }
}

export function migrateMonthlyPerformanceTables(db: MonthlyPerformanceDatabase): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS monthly_performance_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      month TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      messages_json TEXT NOT NULL DEFAULT '[]',
      preview_json TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      exported_at TEXT NOT NULL DEFAULT ''
    )
  `).run()
}

export function listMonthlyPerformanceSessions(db: MonthlyPerformanceDatabase): MonthlyPerformanceSession[] {
  return (db.prepare('SELECT * FROM monthly_performance_sessions ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>).map(mapMonthlyPerformanceSessionRow)
}

export function getMonthlyPerformanceSession(db: MonthlyPerformanceDatabase, sessionId: string): MonthlyPerformanceSession | null {
  const row = db.prepare('SELECT * FROM monthly_performance_sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined
  return row ? mapMonthlyPerformanceSessionRow(row) : null
}

export function createMonthlyPerformanceSession(db: MonthlyPerformanceDatabase, input: {
  projectId: string
  projectName: string
  month: string
}): MonthlyPerformanceSession {
  const timestamp = nowIso()
  const id = createSessionId()
  const title = createSessionTitle(input.projectName, input.month)
  const messages: MonthlyPerformanceChatMessage[] = [
    {
      id: createMessageId(),
      role: 'assistant',
      content: '我们先把这个月的绩效口径聊清楚。你可以直接告诉我评分规则、需要关注的成员、加减分项或任何补充事实。',
      createdAt: timestamp
    }
  ]

  db.prepare(`
    INSERT INTO monthly_performance_sessions (
      id, project_id, project_name, month, title, status, messages_json, preview_json, file_path, created_at, updated_at, exported_at
    )
    VALUES (?, ?, ?, ?, ?, 'draft', ?, '', '', ?, ?, '')
  `).run(id, input.projectId, input.projectName, input.month, title, JSON.stringify(messages), timestamp, timestamp)

  const session = getMonthlyPerformanceSession(db, id)

  if (!session) {
    throw new Error('月度绩效会话创建失败')
  }

  return session
}

export function updateMonthlyPerformanceSessionScope(db: MonthlyPerformanceDatabase, input: {
  sessionId: string
  projectId: string
  projectName: string
  month: string
}): MonthlyPerformanceSession {
  const existing = getMonthlyPerformanceSession(db, input.sessionId)

  if (!existing) {
    throw new Error('月度绩效会话不存在')
  }

  const timestamp = nowIso()
  const title = createSessionTitle(input.projectName, input.month)
  db.prepare(`
    UPDATE monthly_performance_sessions
    SET project_id = ?, project_name = ?, month = ?, title = ?, updated_at = ?
    WHERE id = ?
  `).run(input.projectId, input.projectName, input.month, title, timestamp, input.sessionId)

  return getMonthlyPerformanceSession(db, input.sessionId) as MonthlyPerformanceSession
}

export function appendMonthlyPerformanceMessages(db: MonthlyPerformanceDatabase, sessionId: string, nextMessages: Array<{
  role: MonthlyPerformanceMessageRole
  content: string
}>): MonthlyPerformanceSession {
  const existing = getMonthlyPerformanceSession(db, sessionId)

  if (!existing) {
    throw new Error('月度绩效会话不存在')
  }

  const timestamp = nowIso()
  const messages = existing.messages.concat(
    nextMessages.map((message) => ({
      id: createMessageId(),
      role: message.role,
      content: message.content.trim(),
      createdAt: timestamp
    })).filter((message) => message.content)
  )

  db.prepare(`
    UPDATE monthly_performance_sessions
    SET messages_json = ?, status = 'draft', preview_json = '', file_path = '', exported_at = '', updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(messages), timestamp, sessionId)

  return getMonthlyPerformanceSession(db, sessionId) as MonthlyPerformanceSession
}

export function saveMonthlyPerformanceSessionPreview(db: MonthlyPerformanceDatabase, sessionId: string, preview: MonthlyPerformancePreview): MonthlyPerformanceSession {
  const existing = getMonthlyPerformanceSession(db, sessionId)

  if (!existing) {
    throw new Error('月度绩效会话不存在')
  }

  const timestamp = nowIso()
  db.prepare(`
    UPDATE monthly_performance_sessions
    SET preview_json = ?, status = 'ready', file_path = '', exported_at = '', updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(preview), timestamp, sessionId)

  return getMonthlyPerformanceSession(db, sessionId) as MonthlyPerformanceSession
}

export function saveMonthlyPerformanceSessionExport(db: MonthlyPerformanceDatabase, sessionId: string, filePath: string): MonthlyPerformanceSession {
  const existing = getMonthlyPerformanceSession(db, sessionId)

  if (!existing) {
    throw new Error('月度绩效会话不存在')
  }

  const timestamp = nowIso()
  db.prepare(`
    UPDATE monthly_performance_sessions
    SET file_path = ?, status = 'exported', updated_at = ?, exported_at = ?
    WHERE id = ?
  `).run(filePath, timestamp, timestamp, sessionId)

  return getMonthlyPerformanceSession(db, sessionId) as MonthlyPerformanceSession
}

export function createMonthlyPerformanceSourceRows(input: MonthlyPerformanceSourceRowInput): MonthlyPerformanceRow[] {
  const peopleById = new Map(input.people.map((person) => [person.id, person]))
  const peopleByName = new Map(input.people.map((person) => [normalizeName(person.displayName), person]))
  const rows = new Map<string, MonthlyPerformanceRow>()

  for (const contributor of input.contributors) {
    const person = contributor.personId ? peopleById.get(contributor.personId) : peopleByName.get(normalizeName(contributor.name))
    const row = createEmptyMonthlyPerformanceRow({
      personId: contributor.personId,
      name: person?.displayName || contributor.name || contributor.email,
      role: person?.role,
      identity: getPersonIdentity(person, contributor.email)
    })

    row.commits = normalizeCount(contributor.commits)
    row.additions = normalizeCount(contributor.additions)
    row.deletions = normalizeCount(contributor.deletions)
    row.filesChanged = normalizeCount(contributor.filesChanged)
    row.activeDays = normalizeCount(contributor.activeDays)
    rows.set(rowKey(row), row)
  }

  for (const workItem of input.workItems.filter((item) => isRelevantWorkItem(item, input.startDate, input.endDate))) {
    for (const assigneeName of workItem.assigneeNames) {
      const person = peopleByName.get(normalizeName(assigneeName))
      const seed = createEmptyMonthlyPerformanceRow({
        personId: person?.id,
        name: person?.displayName || assigneeName,
        role: person?.role,
        identity: getPersonIdentity(person, '')
      })
      const key = rowKey(seed)
      const row = rows.get(key) ?? seed

      if (isCompletedWorkItem(workItem)) {
        row.completedWorkItems += 1
      } else if (isInProgressWorkItem(workItem)) {
        row.inProgressWorkItems += 1
      }

      if (workItem.targetDate && normalizeDate(workItem.targetDate) <= input.endDate && !isCompletedWorkItem(workItem) && !isCancelledWorkItem(workItem)) {
        row.overdueWorkItems += 1
      }

      rows.set(key, row)
    }
  }

  return Array.from(rows.values()).sort((left, right) => right.commits - left.commits || right.completedWorkItems - left.completedWorkItems || left.name.localeCompare(right.name))
}

export function normalizeMonthlyPerformancePreview(input: {
  projectId: string
  projectName: string
  month: string
  startDate: string
  endDate: string
  generatedAt?: string
  totalCommits: number
  totalAdditions: number
  totalDeletions: number
  activeDays: number
  contributorCount: number
  sourceRows: MonthlyPerformanceRow[]
  sourceWarnings?: string[]
  aiContent: string
}): MonthlyPerformancePreview {
  const payload = parseMonthlyPerformanceAiPayload(input.aiContent)
  const normalizedAiRows = Array.isArray(payload.rows) ? payload.rows.map(normalizeAiRow).filter((row): row is MonthlyPerformanceRow => Boolean(row)) : []
  const aiRowsByKey = new Map(normalizedAiRows.map((row) => [rowKey(row), row]))
  const rows = input.sourceRows.map((row) => mergeAiRow(row, aiRowsByKey.get(rowKey(row))))
  const knownKeys = new Set(rows.map(rowKey))

  for (const aiRow of normalizedAiRows) {
    if (!knownKeys.has(rowKey(aiRow))) {
      rows.push(aiRow)
      knownKeys.add(rowKey(aiRow))
    }
  }

  const summary = payload.summary ?? {}
  const warnings = [
    ...(input.sourceWarnings ?? []),
    ...normalizeStringList(summary.warnings),
    ...normalizeStringList(payload.warnings)
  ]

  if (rows.length === 0) {
    warnings.push('本月没有可用于绩效整理的人员数据')
  }

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    month: input.month,
    startDate: input.startDate,
    endDate: input.endDate,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    totalCommits: normalizeCount(input.totalCommits),
    totalAdditions: normalizeCount(input.totalAdditions),
    totalDeletions: normalizeCount(input.totalDeletions),
    activeDays: normalizeCount(input.activeDays),
    contributorCount: normalizeCount(input.contributorCount),
    aiSummary: normalizeText(summary.aiSummary) || normalizeText(payload.aiSummary),
    highlights: normalizeStringList(summary.highlights).concat(normalizeStringList(payload.highlights)),
    risks: normalizeStringList(summary.risks).concat(normalizeStringList(payload.risks)),
    nextMonthFocus: normalizeStringList(summary.nextMonthFocus).concat(normalizeStringList(payload.nextMonthFocus)),
    rows,
    warnings: Array.from(new Set(warnings.filter(Boolean)))
  }
}

export async function requestMonthlyPerformancePreview(input: MonthlyPerformancePreviewRequest): Promise<MonthlyPerformancePreview> {
  if (!input.settings.enabled || !input.settings.apiKey) {
    throw new Error('请先在公共设置里启用 AI 并填写 API Key')
  }

  const fetchImpl = input.fetchImpl ?? fetch
  let response: Response

  try {
    response = await fetchImpl(`${input.settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAiRequestHeaders(input.settings),
      body: JSON.stringify({
        model: input.settings.model,
        temperature: input.settings.temperature,
        messages: [
          {
            role: 'system',
            content: [
              '你是研发团队月度绩效助理。',
              '只能返回合法 JSON，不能返回 Markdown。',
              'JSON 顶层字段必须包含 summary、rows、warnings。',
              'summary 包含 aiSummary、highlights、risks、nextMonthFocus。',
              'rows 每项必须包含 personId、name、role、identity、aiScore、performanceLevel、highlights、risks、nextMonthPlan、notes。',
              '不要改写用户提供的数字统计；数字字段如果不确定就返回 0。'
            ].join(' ')
          },
          {
            role: 'user',
            content: JSON.stringify({
              projectName: input.projectName,
              month: input.month,
              range: { startDate: input.startDate, endDate: input.endDate },
              instruction: input.instruction,
              sourceSummary: {
                totalCommits: input.totalCommits,
                totalAdditions: input.totalAdditions,
                totalDeletions: input.totalDeletions,
                activeDays: input.activeDays,
                contributorCount: input.contributorCount
              },
              sourceRows: input.sourceRows,
              sourceWarnings: input.sourceWarnings ?? []
            })
          }
        ]
      })
    })
  } catch (error) {
    throw createAiNetworkError(error)
  }

  if (!response.ok) {
    throw await createAiRequestError(response)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const aiContent = payload.choices?.[0]?.message?.content ?? ''

  if (!aiContent.trim()) {
    throw new Error('AI 没有返回可用的月度绩效内容')
  }

  return normalizeMonthlyPerformancePreview({
    projectId: input.projectId,
    projectName: input.projectName,
    month: input.month,
    startDate: input.startDate,
    endDate: input.endDate,
    totalCommits: input.totalCommits,
    totalAdditions: input.totalAdditions,
    totalDeletions: input.totalDeletions,
    activeDays: input.activeDays,
    contributorCount: input.contributorCount,
    sourceRows: input.sourceRows,
    sourceWarnings: input.sourceWarnings,
    aiContent
  })
}

export async function requestMonthlyPerformanceChat(input: MonthlyPerformanceChatRequest): Promise<string> {
  if (!input.settings.enabled || !input.settings.apiKey) {
    throw new Error('请先在公共设置里启用 AI 并填写 API Key')
  }

  const fetchImpl = input.fetchImpl ?? fetch
  let response: Response

  try {
    response = await fetchImpl(`${input.settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAiRequestHeaders(input.settings),
      body: JSON.stringify({
        model: input.settings.model,
        temperature: input.settings.temperature,
        messages: [
          {
            role: 'system',
            content: [
              '你是 ForgeDesk 的月度绩效生成助手，交互方式类似 Codex。',
              '目标是通过多轮对话逐步收集生成月度绩效 Excel 所需的数据和规则。',
              '每次回复要简洁，优先确认已经得到的信息，并提出下一步最重要的问题。',
              '当信息足够时，明确告诉用户可以点击“确认生成数据”。',
              '不要输出 JSON，不要编造事实。'
            ].join(' ')
          },
          {
            role: 'user',
            content: `项目：${input.projectName}\n月份：${input.month}`
          },
          ...input.messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        ]
      })
    })
  } catch (error) {
    throw createAiNetworkError(error)
  }

  if (!response.ok) {
    throw await createAiRequestError(response)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content?.trim() ?? ''

  if (!content) {
    throw new Error('AI 没有返回可用的对话内容')
  }

  return content
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
}

function styleWorksheet(worksheet: ExcelJS.Worksheet): void {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        right: { style: 'thin', color: { argb: 'FFD9E2F3' } }
      }
      cell.alignment = { vertical: 'top', wrapText: true }
    })
  })
}

function addListRows(worksheet: ExcelJS.Worksheet, title: string, values: string[]): void {
  worksheet.addRow([])
  worksheet.addRow([title])
  const titleRow = worksheet.lastRow

  if (titleRow) {
    titleRow.font = { bold: true }
  }

  if (values.length === 0) {
    worksheet.addRow(['无'])
    return
  }

  for (const value of values) {
    worksheet.addRow([value])
  }
}

export function createMonthlyPerformanceWorkbook(preview: MonthlyPerformancePreview): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ForgeDesk'
  workbook.created = new Date(preview.generatedAt)

  const overview = workbook.addWorksheet('总览', {
    views: [{ state: 'frozen', ySplit: 1 }]
  })
  overview.columns = [
    { header: '指标', key: 'metric', width: 22 },
    { header: '内容', key: 'value', width: 80 }
  ]
  overview.addRows([
    ['项目', preview.projectName],
    ['月份', preview.month],
    ['统计范围', `${preview.startDate} 至 ${preview.endDate}`],
    ['生成时间', preview.generatedAt],
    ['提交总数', preview.totalCommits],
    ['贡献人数', preview.contributorCount],
    ['新增行', preview.totalAdditions],
    ['删除行', preview.totalDeletions],
    ['活跃天数', preview.activeDays],
    ['AI 总结', preview.aiSummary || '无']
  ])
  addListRows(overview, '亮点', preview.highlights)
  addListRows(overview, '风险', preview.risks)
  addListRows(overview, '下月重点', preview.nextMonthFocus)
  addListRows(overview, '生成提示', preview.warnings.length > 0 ? preview.warnings : ['无'])
  styleHeaderRow(overview.getRow(1))
  styleWorksheet(overview)

  const detail = workbook.addWorksheet('人员绩效明细', {
    views: [{ state: 'frozen', ySplit: 1 }]
  })
  detail.columns = detailHeaders.map((header) => ({ header, key: header, width: header.length > 5 ? 18 : 14 }))
  detail.getColumn('邮箱/身份').width = 26
  detail.getColumn('亮点').width = 32
  detail.getColumn('风险/改进').width = 32
  detail.getColumn('下月建议').width = 32
  detail.getColumn('备注').width = 28
  detail.autoFilter = {
    from: 'A1',
    to: `Q${Math.max(1, preview.rows.length + 1)}`
  }
  detail.addRows(
    preview.rows.map((row) => [
      row.name,
      row.role,
      row.identity,
      row.commits,
      row.additions,
      row.deletions,
      row.filesChanged,
      row.activeDays,
      row.completedWorkItems,
      row.inProgressWorkItems,
      row.overdueWorkItems,
      row.aiScore,
      row.performanceLevel,
      row.highlights,
      row.risks,
      row.nextMonthPlan,
      row.notes
    ])
  )

  if (preview.rows.length === 0) {
    detail.addRow(['无人员数据', '', '', 0, 0, 0, 0, 0, 0, 0, 0, 0, '待评估', '', '', '', preview.warnings.join('；')])
  }

  styleHeaderRow(detail.getRow(1))
  styleWorksheet(detail)

  for (const columnIndex of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    detail.getColumn(columnIndex).numFmt = '#,##0'
  }

  return workbook
}

export async function writeMonthlyPerformanceWorkbook(preview: MonthlyPerformancePreview, filePath: string): Promise<void> {
  const workbook = createMonthlyPerformanceWorkbook(preview)
  await workbook.xlsx.writeFile(filePath)
}
