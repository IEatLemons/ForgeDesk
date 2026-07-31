import type { OaBitableField, OaBitableRecord } from './data'

export type LarkBitableScheduleFieldMap = {
  title: string
  start: string
  end: string
  status: string
  owner: string
  priority: string
}

export type LarkBitableScheduleRow = {
  record: OaBitableRecord
  title: string
  startDate: string
  endDate: string
  status: string
  owner: string
  priority: string
}

export type LarkBitableGanttRow = LarkBitableScheduleRow & {
  offsetDays: number
  durationDays: number
}

export type LarkBitableGanttRange = {
  startDate: string
  endDate: string
  totalDays: number
  ticks: string[]
  rows: LarkBitableGanttRow[]
}

const titleKeywords = ['标题', '任务', '名称', '事项', '工作项', 'title', 'task', 'name']
const startKeywords = ['开始', '起始', 'start', 'begin']
const endKeywords = ['结束', '截止', '完成日期', 'due', 'end', 'finish']
const statusKeywords = ['状态', '进度', 'status', 'state', 'progress']
const ownerKeywords = ['负责人', '执行人', '成员', 'owner', 'assignee', 'member']
const priorityKeywords = ['优先级', '重要性', 'priority', 'level']

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function findField(fields: OaBitableField[], keywords: string[], excluded = new Set<string>()): string {
  const normalizedKeywords = keywords.map(normalizeSearchText)
  const match = fields.find((field) => {
    if (excluded.has(field.name)) return false
    const name = normalizeSearchText(field.name)
    return normalizedKeywords.some((keyword) => name.includes(keyword))
  })

  return match?.name ?? ''
}

function findDateField(fields: OaBitableField[], keywords: string[], excluded = new Set<string>()): string {
  const named = findField(fields, keywords, excluded)
  if (named) return named

  return fields.find((field) => !excluded.has(field.name) && (field.type === 5 || /date|time/i.test(field.uiType)))?.name ?? ''
}

export function inferLarkBitableScheduleFields(fields: OaBitableField[]): LarkBitableScheduleFieldMap {
  const title = fields.find((field) => field.isPrimary)?.name || findField(fields, titleKeywords) || fields[0]?.name || ''
  const start = findDateField(fields, startKeywords, new Set([title]))
  const end = findDateField(fields, endKeywords, new Set([title, start]))

  return {
    title,
    start,
    end,
    status: findField(fields, statusKeywords, new Set([title, start, end])),
    owner: findField(fields, ownerKeywords, new Set([title, start, end])),
    priority: findField(fields, priorityKeywords, new Set([title, start, end]))
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function firstValue(value: unknown): unknown {
  if (Array.isArray(value)) return value[0]
  return value
}

function nestedValue(value: unknown): unknown {
  const item = asObject(firstValue(value))
  if (!item) return firstValue(value)
  return item.value ?? item.date ?? item.timestamp ?? item.text ?? item.name ?? item.title ?? item.id ?? ''
}

export function normalizeLarkDate(value: unknown): string {
  const raw = nestedValue(value)
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const milliseconds = raw > 1_000_000_000_000 ? raw : raw * 1000
    return formatDateOnly(new Date(milliseconds))
  }

  if (typeof raw !== 'string' || !raw.trim()) return ''
  const text = raw.trim()
  const directDate = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (directDate) return `${directDate[1]}-${directDate[2].padStart(2, '0')}-${directDate[3].padStart(2, '0')}`

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : formatDateOnly(parsed)
}

function formatDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatDateOnly(date)
}

function dateDifference(left: string, right: string): number {
  const leftTime = new Date(`${left}T00:00:00`).getTime()
  const rightTime = new Date(`${right}T00:00:00`).getTime()
  return Math.round((rightTime - leftTime) / 86_400_000)
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('、')
  const item = asObject(value)
  if (!item) return String(value)
  if (Array.isArray(item.users)) return valueText(item.users)
  return valueText(item.text ?? item.name ?? item.title ?? item.value ?? item.link ?? item.id)
}

export function createLarkBitableScheduleRows(
  records: OaBitableRecord[],
  mapping: LarkBitableScheduleFieldMap
): LarkBitableScheduleRow[] {
  return records.map((record) => {
    const fields = record.fields
    const startDate = normalizeLarkDate(fields[mapping.start])
    const rawEndDate = normalizeLarkDate(fields[mapping.end])
    const endDate = rawEndDate && startDate && rawEndDate < startDate ? startDate : rawEndDate || startDate

    return {
      record,
      title: valueText(fields[mapping.title]) || '未命名任务',
      startDate,
      endDate,
      status: valueText(fields[mapping.status]),
      owner: valueText(fields[mapping.owner]),
      priority: valueText(fields[mapping.priority])
    }
  })
}

export function createLarkBitableGanttRange(rows: LarkBitableScheduleRow[], today = new Date()): LarkBitableGanttRange {
  const fallbackStart = formatDateOnly(today)
  const fallbackEnd = addDays(fallbackStart, 6)
  const scheduledRows = rows.filter((row) => row.startDate && row.endDate)
  const minStart = scheduledRows.reduce((current, row) => (row.startDate < current ? row.startDate : current), fallbackStart)
  const maxEnd = scheduledRows.reduce((current, row) => (row.endDate > current ? row.endDate : current), fallbackEnd)
  const startDate = minStart < fallbackStart ? minStart : fallbackStart
  const endDate = maxEnd > fallbackEnd ? maxEnd : fallbackEnd
  const totalDays = Math.max(dateDifference(startDate, endDate) + 1, 1)
  const tickStep = Math.max(Math.ceil(totalDays / 8), 1)
  const ticks: string[] = []

  for (let day = 0; day < totalDays; day += tickStep) {
    ticks.push(addDays(startDate, day))
  }
  if (ticks[ticks.length - 1] !== endDate) ticks.push(endDate)

  return {
    startDate,
    endDate,
    totalDays,
    ticks,
    rows: scheduledRows.map((row) => ({
      ...row,
      offsetDays: Math.max(dateDifference(startDate, row.startDate), 0),
      durationDays: Math.max(dateDifference(row.startDate, row.endDate) + 1, 1)
    }))
  }
}

export function formatLarkBitableDate(value: string): string {
  if (!value) return '-'
  const [, month, day] = value.split('-')
  return month && day ? `${Number(month)}月${Number(day)}日` : value
}
