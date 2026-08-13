import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatCodexQuotaPercent, getCodexQuotaProgressMeta, selectCodexWeeklyQuotaWindow, type CodexTitlebarQuotaWindow } from './codex-titlebar-state.js'

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
})
