import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezonePlugin from 'dayjs/plugin/timezone.js'
import type { TaskRecurrence } from '../shared/task-workspace.js'
dayjs.extend(utc)
dayjs.extend(timezonePlugin)

function occurrence(rule: TaskRecurrence, step: number): string {
  const timed = rule.anchor.length > 10
  const anchor = timed ? dayjs(rule.anchor).tz(rule.timezone) : dayjs.utc(rule.anchor)
  const date = new Date(Date.UTC(anchor.year(), anchor.month(), anchor.date()))
  const amount = rule.interval * step
  if (rule.unit === 'month' || rule.unit === 'year') {
    const month = anchor.month() + (rule.unit === 'year' ? amount * 12 : amount)
    date.setUTCDate(1)
    date.setUTCMonth(month)
    date.setUTCDate(Math.min(anchor.date(), new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()))
  } else if (rule.unit === 'workday') {
    let remaining = amount
    while (remaining > 0 && [0, 6].includes(date.getUTCDay())) { date.setUTCDate(date.getUTCDate() + 1); if (![0, 6].includes(date.getUTCDay())) remaining-- }
    date.setUTCDate(date.getUTCDate() + Math.floor(remaining / 5) * 7)
    remaining %= 5
    while (remaining > 0) { date.setUTCDate(date.getUTCDate() + 1); if (![0, 6].includes(date.getUTCDay())) remaining-- }
  } else date.setUTCDate(date.getUTCDate() + amount * (rule.unit === 'week' ? 7 : 1))
  const calendar = date.toISOString().slice(0, 10)
  return timed ? dayjs.tz(`${calendar} ${anchor.format('HH:mm:ss')}`, rule.timezone).toISOString() : calendar
}

export function nextTaskOccurrence(rule: TaskRecurrence, previous: string, now = new Date()): string {
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 999) throw new Error('重复间隔应为 1–999 的整数')
  const anchor = dayjs(rule.anchor), end = dayjs(previous), current = dayjs(now).tz(rule.timezone)
  if (!anchor.isValid() || !end.isValid()) throw new Error('重复任务需要有效的计划日期')
  const lower = end.isAfter(current) ? end : current
  const roughDays = Math.max(0, lower.diff(anchor, 'day'))
  const estimate = rule.unit === 'year' ? lower.diff(anchor, 'year') : rule.unit === 'month' ? lower.diff(anchor, 'month') : rule.unit === 'week' ? Math.floor(roughDays / 7) : rule.unit === 'workday' ? Math.floor(roughDays * 5 / 7) : roughDays
  let index = Math.max(1, Math.floor(estimate / rule.interval) - 2)
  const today = current.format('YYYY-MM-DD')
  for (; index < 1_000_000; index++) {
    const candidate = occurrence(rule, index)
    if (candidate > previous && (candidate.length === 10 ? candidate >= today : Date.parse(candidate) > now.getTime())) return candidate
  }
  throw new Error('无法计算下一次重复日期')
}

export function shiftTaskStart(start: string | null, previousDue: string, nextDue: string): string | null {
  if (!start) return null
  const milliseconds = Date.parse(nextDue) - Date.parse(previousDue)
  const value = new Date(Date.parse(start) + milliseconds).toISOString()
  return start.length === 10 ? value.slice(0, 10) : value
}
