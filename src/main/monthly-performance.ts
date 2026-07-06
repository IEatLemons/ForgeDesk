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

type MonthlyPerformanceAssessmentItem = {
  project: string
  point: string
  weight: number
  scoringStandard: string
  completion: (row: MonthlyPerformanceRow, preview: MonthlyPerformancePreview) => string
  score: (row: MonthlyPerformanceRow) => number
}

const monthlyPerformanceAssessmentItems: MonthlyPerformanceAssessmentItem[] = [
  {
    project: '研发交付与工作项推进',
    point: '完成本月核心需求、缺陷修复及工作项闭环推进',
    weight: 0.4,
    scoringStandard: '100分：关键交付按期完成且无明显返工；80分：存在少量返工或延期但不影响主流程；60分：核心交付延期或阻塞上下游',
    completion: (row) => joinChineseLines([
      `提交 ${row.commits} 次，变更文件 ${row.filesChanged} 个，完成工作项 ${row.completedWorkItems} 个，进行中 ${row.inProgressWorkItems} 个。`,
      row.highlights
    ]),
    score: (row) => row.aiScore
  },
  {
    project: '代码质量与系统稳定性',
    point: '控制代码质量、发布风险和线上稳定性问题',
    weight: 0.25,
    scoringStandard: '100分：本月无重大质量问题，交付稳定；80分：存在可控问题并及时修复；60分：出现重大缺陷、事故或明显质量风险',
    completion: (row) => joinChineseLines([
      `新增 ${row.additions} 行，删除 ${row.deletions} 行，活跃 ${row.activeDays} 天。`,
      row.risks ? `风险/改进：${row.risks}` : ''
    ]),
    score: (row) => row.aiScore
  },
  {
    project: '协作沟通与执行效率',
    point: '配合产品、设计、测试及其他研发角色完成跨职能协作',
    weight: 0.2,
    scoringStandard: '100分：沟通主动、反馈及时且推动问题闭环；80分：协作基本顺畅；60分：沟通滞后或执行不到位影响排期',
    completion: (row) => joinChineseLines([
      row.notes,
      row.overdueWorkItems > 0 ? `存在逾期工作项 ${row.overdueWorkItems} 个。` : '本月未记录逾期工作项。'
    ]),
    score: (row) => row.aiScore
  },
  {
    project: '复盘改进与下月计划',
    point: '形成阶段复盘，明确下月重点和持续改进动作',
    weight: 0.1,
    scoringStandard: '100分：复盘清晰且下月计划可执行；80分：计划基本明确；60分：缺少复盘或改进动作不清晰',
    completion: (row, preview) => joinChineseLines([
      row.nextMonthPlan,
      preview.nextMonthFocus.length > 0 ? `团队下月重点：${preview.nextMonthFocus.join('；')}` : ''
    ]),
    score: (row) => row.aiScore
  },
  {
    project: '考勤',
    point: '按每月考勤结果进行评分',
    weight: 0.05,
    scoringStandard: 'a：迟到。迟到1～10分钟扣2.5分，迟到10～30分钟扣5分，迟到30分钟以上扣10分。\nb：早退。早退1～10分钟扣2.5分，早退10～30分钟扣5分，早退30分钟以上扣10分。\nc：旷工。旷工一次扣10分。\nd：缺卡。补卡规则外，每缺卡1次，扣2.5分。',
    completion: () => '按公司考勤规则执行；如无补充，待 HR 考勤结果确认。',
    score: () => 100
  }
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

const assessmentColumnWidths = [46, 50, 15, 63, 44, 15, 14, 16]
const assessmentHeaders = ['考核项目', '考核要点', '权重', '评分标准', '完成情况', '自评分', '上级评分', '审核人']
const assessmentInstruction =
  '使用说明：\n1.考核项目中必须设定至少一项关键指标，其权重占比不得低于 35%；2.绩效综合得分=自评得分×30%+上级评分×70%'

const blackCellBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
}

function joinChineseLines(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join('\n') || '无'
}

function formatAssessmentCycle(startDate: string, endDate: string): string {
  const start = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const end = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!start || !end) {
    return `${startDate} 至 ${endDate}`
  }

  return `${Number(start[1])}.${Number(start[2])}.${Number(start[3])}-${Number(end[2])}.${Number(end[3])}`
}

function sanitizeWorksheetName(value: string, fallback: string): string {
  const name = value.trim().replace(/[\\/*?:[\]]+/g, '-').slice(0, 31)
  return name || fallback
}

function createUniqueWorksheetName(value: string, usedNames: Set<string>, fallback: string): string {
  const baseName = sanitizeWorksheetName(value, fallback)
  let name = baseName
  let index = 2

  while (usedNames.has(name)) {
    const suffix = `-${index}`
    name = `${baseName.slice(0, 31 - suffix.length)}${suffix}`
    index += 1
  }

  usedNames.add(name)
  return name
}

function createRowsForAssessmentExport(preview: MonthlyPerformancePreview): MonthlyPerformanceRow[] {
  if (preview.rows.length > 0) {
    return preview.rows
  }

  return [
    {
      ...createEmptyMonthlyPerformanceRow({ name: '无人员数据', role: '', identity: '' }),
      notes: preview.warnings.join('；') || '本月没有可用于绩效整理的人员数据'
    }
  ]
}

function setCellStyle(cell: ExcelJS.Cell, style: {
  font?: Partial<ExcelJS.Font>
  alignment?: Partial<ExcelJS.Alignment>
  numFmt?: string
  bold?: boolean
} = {}): void {
  cell.font = {
    name: 'Calibri',
    size: 11,
    color: { argb: 'FF000000' },
    bold: style.bold,
    ...style.font
  }
  cell.alignment = {
    vertical: 'middle',
    ...style.alignment
  }
  cell.border = blackCellBorder

  if (style.numFmt) {
    cell.numFmt = style.numFmt
  }
}

function applyAssessmentSheetStyles(worksheet: ExcelJS.Worksheet, itemStartRow: number, itemEndRow: number, totalRow: number, finalRow: number, signatureRow: number): void {
  worksheet.properties.defaultRowHeight = 19
  worksheet.properties.defaultColWidth = 14

  for (let rowIndex = 1; rowIndex <= signatureRow; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= 8; columnIndex += 1) {
      setCellStyle(worksheet.getCell(rowIndex, columnIndex))
    }
  }

  worksheet.getRow(1).height = 38
  worksheet.getRow(2).height = 34
  worksheet.getRow(3).height = 50
  worksheet.getRow(4).height = 34
  worksheet.getRow(totalRow).height = 34
  worksheet.getRow(finalRow).height = 34
  worksheet.getRow(signatureRow).height = 52

  for (let rowIndex = itemStartRow; rowIndex <= itemEndRow; rowIndex += 1) {
    worksheet.getRow(rowIndex).height = 72
  }

  setCellStyle(worksheet.getCell('A1'), {
    font: { size: 16 },
    bold: true,
    alignment: { horizontal: 'center', vertical: 'middle' }
  })

  for (const cellAddress of ['A2', 'B2', 'C2', 'E2']) {
    setCellStyle(worksheet.getCell(cellAddress), {
      alignment: { horizontal: cellAddress === 'E2' ? 'center' : 'left', vertical: 'middle', wrapText: cellAddress === 'E2' }
    })
  }

  setCellStyle(worksheet.getCell('A3'), {
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }
  })

  for (let columnIndex = 1; columnIndex <= 8; columnIndex += 1) {
    setCellStyle(worksheet.getCell(4, columnIndex), {
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
    })
  }

  for (let rowIndex = itemStartRow; rowIndex <= itemEndRow; rowIndex += 1) {
    for (const columnIndex of [1, 2, 4, 5]) {
      setCellStyle(worksheet.getCell(rowIndex, columnIndex), {
        font: { name: '微软雅黑', size: 10 },
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }
      })
    }

    setCellStyle(worksheet.getCell(rowIndex, 3), {
      font: { name: '微软雅黑', size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      numFmt: '0%'
    })

    for (const columnIndex of [6, 7]) {
      setCellStyle(worksheet.getCell(rowIndex, columnIndex), {
        alignment: { horizontal: 'center', vertical: 'middle' },
        numFmt: '0.0_ '
      })
    }

    setCellStyle(worksheet.getCell(rowIndex, 8), {
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
    })
  }

  for (let columnIndex = 1; columnIndex <= 8; columnIndex += 1) {
    setCellStyle(worksheet.getCell(totalRow, columnIndex), {
      bold: true,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: columnIndex === 3 ? '0%' : columnIndex === 6 || columnIndex === 7 ? '0.0_ ' : undefined
    })
    setCellStyle(worksheet.getCell(finalRow, columnIndex), {
      bold: true,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: columnIndex === 6 || columnIndex === 7 ? '0.0_ ' : undefined
    })
  }

  for (let columnIndex = 1; columnIndex <= 8; columnIndex += 1) {
    setCellStyle(worksheet.getCell(signatureRow, columnIndex), {
      alignment: { horizontal: 'left', vertical: 'middle' }
    })
  }
}

function addAssessmentWorksheet(workbook: ExcelJS.Workbook, preview: MonthlyPerformancePreview, row: MonthlyPerformanceRow, sheetName: string): void {
  const worksheet = workbook.addWorksheet(sheetName)
  worksheet.columns = assessmentColumnWidths.map((width) => ({ width }))

  worksheet.mergeCells('A1:H1')
  worksheet.mergeCells('C2:D2')
  worksheet.mergeCells('E2:H2')
  worksheet.mergeCells('A3:H3')

  worksheet.getCell('A1').value = '绩效考核表'
  worksheet.getCell('A2').value = '部门：技术部'
  worksheet.getCell('B2').value = `岗位名称：${row.role || '技术部'}`
  worksheet.getCell('C2').value = `姓名：${row.name}`
  worksheet.getCell('E2').value = `考核周期：${formatAssessmentCycle(preview.startDate, preview.endDate)}`
  worksheet.getCell('A3').value = assessmentInstruction
  worksheet.getRow(4).values = assessmentHeaders

  const itemStartRow = 5
  const assessmentRows = monthlyPerformanceAssessmentItems.map((item, index) => {
    const itemRow = itemStartRow + index
    const score = normalizeScore(item.score(row))
    worksheet.getRow(itemRow).values = [
      item.project,
      item.point,
      item.weight,
      item.scoringStandard,
      item.completion(row, preview),
      score,
      score,
      ''
    ]
    return { row: itemRow, weight: item.weight, score }
  })

  const itemEndRow = itemStartRow + assessmentRows.length - 1
  const totalRow = itemEndRow + 1
  const finalRow = totalRow + 1
  const signatureRow = finalRow + 1
  const weightedScore = assessmentRows.reduce((sum, item) => sum + item.weight * item.score, 0)
  const weightedScoreResult = Math.round(weightedScore * 10) / 10
  const weightedTerms = assessmentRows.map((item) => `(F${item.row}*C${item.row})`).join('+')
  const managerWeightedTerms = assessmentRows.map((item) => `(G${item.row}*C${item.row})`).join('+')

  worksheet.getCell(totalRow, 2).value = '总权重'
  worksheet.getCell(totalRow, 3).value = { formula: `SUM(C${itemStartRow}:C${itemEndRow})`, result: 1 }
  worksheet.getCell(totalRow, 5).value = '合计得分'
  worksheet.getCell(totalRow, 6).value = { formula: `SUM(${weightedTerms})`, result: weightedScoreResult }
  worksheet.getCell(totalRow, 7).value = { formula: `SUM(${managerWeightedTerms})`, result: weightedScoreResult }

  worksheet.mergeCells(`A${finalRow}:E${finalRow}`)
  worksheet.mergeCells(`F${finalRow}:G${finalRow}`)
  worksheet.getCell(finalRow, 1).value = '本期绩效综合得分'
  worksheet.getCell(finalRow, 6).value = { formula: `F${totalRow}*0.3+G${totalRow}*0.7`, result: weightedScoreResult }

  worksheet.mergeCells(`G${signatureRow}:H${signatureRow}`)
  worksheet.getCell(signatureRow, 1).value = '被考核人签名：'
  worksheet.getCell(signatureRow, 2).value = '日期：'
  worksheet.getCell(signatureRow, 4).value = '考核人签名：'
  worksheet.getCell(signatureRow, 5).value = '日期：'
  worksheet.getCell(signatureRow, 6).value = 'CEO签字'

  applyAssessmentSheetStyles(worksheet, itemStartRow, itemEndRow, totalRow, finalRow, signatureRow)
}

export function createMonthlyPerformanceWorkbook(preview: MonthlyPerformancePreview): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ForgeDesk'
  workbook.created = new Date(preview.generatedAt)
  workbook.calcProperties.fullCalcOnLoad = true

  const usedNames = new Set<string>()
  for (const row of createRowsForAssessmentExport(preview)) {
    const sheetName = createUniqueWorksheetName(row.name, usedNames, '无人员数据')
    addAssessmentWorksheet(workbook, preview, row, sheetName)
  }

  return workbook
}

export async function writeMonthlyPerformanceWorkbook(preview: MonthlyPerformancePreview, filePath: string): Promise<void> {
  const workbook = createMonthlyPerformanceWorkbook(preview)
  await workbook.xlsx.writeFile(filePath)
}
