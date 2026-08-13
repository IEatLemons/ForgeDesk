export type CodexTitlebarQuotaWindow = {
  label: 'primary' | 'secondary' | 'hourly' | 'weekly'
  usedPercent: number | null
  remainingPercent: number | null
  windowDurationMins: number | null
  resetAt: string
}

export type CodexQuotaProgressTone = 'critical' | 'warning' | 'healthy' | 'unknown'

export type CodexQuotaProgressMeta = {
  percent: number | null
  tone: CodexQuotaProgressTone
}

const minimumWeeklyWindowMinutes = 3 * 24 * 60

export function selectCodexWeeklyQuotaWindow(input: {
  primary?: CodexTitlebarQuotaWindow | null
  secondary?: CodexTitlebarQuotaWindow | null
  weekly?: CodexTitlebarQuotaWindow | null
} | null | undefined): CodexTitlebarQuotaWindow | null {
  const secondary = input?.secondary
  if (secondary && secondary.windowDurationMins !== null && secondary.windowDurationMins >= minimumWeeklyWindowMinutes) {
    return secondary
  }

  const primary = input?.primary
  if (primary && primary.windowDurationMins !== null && primary.windowDurationMins >= minimumWeeklyWindowMinutes) {
    return primary
  }

  return input?.weekly ?? null
}

export function getCodexQuotaProgressMeta(remainingPercent: number | null | undefined): CodexQuotaProgressMeta {
  if (remainingPercent === null || remainingPercent === undefined || !Number.isFinite(remainingPercent)) {
    return { percent: null, tone: 'unknown' }
  }

  const percent = Math.min(100, Math.max(0, remainingPercent))
  if (percent < 5) return { percent, tone: 'critical' }
  if (percent <= 20) return { percent, tone: 'warning' }
  return { percent, tone: 'healthy' }
}

export function formatCodexQuotaPercent(remainingPercent: number | null | undefined): string {
  if (remainingPercent === null || remainingPercent === undefined || !Number.isFinite(remainingPercent)) return '未知'
  const percent = Math.min(100, Math.max(0, remainingPercent))
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}
