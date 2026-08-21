import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CodexUncommittedAlert } from './data.js'
import { formatCodexQuotaPercent, formatCodexResetAt, getCodexQuotaProgressMeta, selectCodexWeeklyQuotaWindow, sortCodexUncommittedAlerts, type CodexTitlebarQuotaWindow } from './codex-titlebar-state.js'

function quotaWindow(patch: Partial<CodexTitlebarQuotaWindow> = {}): CodexTitlebarQuotaWindow {
  return {
    label: 'secondary',
    usedPercent: 50,
    remainingPercent: 50,
    resetAt: '',
    windowDurationMins: 7 * 24 * 60,
    ...patch
  }
}

function alert(id: string, completedAt: string, patch: Partial<CodexUncommittedAlert> = {}): CodexUncommittedAlert {
  return {
    additions: 1,
    branch: 'main',
    completedAt,
    completionMarker: `${id}-marker`,
    cwd: '/tmp/project',
    deletions: 0,
    detectedAt: completedAt,
    filesChanged: 1,
    id,
    notifiedAt: null,
    projectId: 'project-1',
    projectName: '项目',
    resolvedAt: null,
    sourceId: `source-${id}`,
    sourceType: 'task',
    status: 'open',
    codexKey: '/tmp/project',
    ...patch
  }
}

describe('Codex titlebar quota state', () => {
  it('uses a long secondary window as the weekly quota', () => {
    const secondary = quotaWindow()
    assert.equal(selectCodexWeeklyQuotaWindow({ secondary, weekly: quotaWindow({ label: 'weekly', remainingPercent: 20 }) }), secondary)
  })

  it('falls back to the legacy weekly window and ignores short secondary windows', () => {
    const weekly = quotaWindow({ label: 'weekly', remainingPercent: 80, windowDurationMins: null })
    assert.equal(selectCodexWeeklyQuotaWindow({ secondary: quotaWindow({ windowDurationMins: 5 * 60 }), weekly }), weekly)
    assert.equal(selectCodexWeeklyQuotaWindow({ secondary: quotaWindow({ windowDurationMins: 5 * 60 }) }), null)
  })

  it('uses a long primary window when Codex returns the weekly quota there', () => {
    const primary = quotaWindow({ label: 'primary', remainingPercent: 97 })
    assert.equal(selectCodexWeeklyQuotaWindow({ primary }), primary)
  })

  it('applies the battery thresholds to remaining quota', () => {
    assert.equal(getCodexQuotaProgressMeta(4.9).tone, 'critical')
    assert.equal(getCodexQuotaProgressMeta(5).tone, 'warning')
    assert.equal(getCodexQuotaProgressMeta(20).tone, 'warning')
    assert.equal(getCodexQuotaProgressMeta(21).tone, 'healthy')
    assert.equal(getCodexQuotaProgressMeta(null).tone, 'unknown')
  })

  it('clamps progress and formats fractional percentages compactly', () => {
    assert.deepEqual(getCodexQuotaProgressMeta(-10), { percent: 0, tone: 'critical' })
    assert.deepEqual(getCodexQuotaProgressMeta(120), { percent: 100, tone: 'healthy' })
    assert.equal(formatCodexQuotaPercent(4.9), '4.9%')
    assert.equal(formatCodexQuotaPercent(null), '未知')
  })

  it('sorts uncommitted alerts by completion time without mutating the source list', () => {
    const older = alert('older', '2026-08-16T08:00:00.000Z')
    const newer = alert('newer', '2026-08-16T09:00:00.000Z')
    const input = [older, newer]

    assert.deepEqual(sortCodexUncommittedAlerts(input).map((item) => item.id), ['newer', 'older'])
    assert.deepEqual(input.map((item) => item.id), ['older', 'newer'])
  })

  it('formats the next reset time and handles missing values', () => {
    assert.match(formatCodexResetAt('2026-08-20T03:43:00.000Z'), /^下次重置：/)
    assert.equal(formatCodexResetAt(''), '下次重置：未知')
    assert.equal(formatCodexResetAt('not-a-date'), '下次重置：未知')
  })
})
