import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { readCodexQuota } from './ai-providers.js'

describe('AI provider quota fallback', () => {
  it('returns an explicit unknown state when no quota source is available', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-quota-test-'))
    try {
      const quota = await readCodexQuota(directory, 'account-1', 'Plus')
      assert.equal(quota.status, 'unknown')
      assert.equal(quota.source, 'unavailable')
      assert.equal(quota.planType, 'Plus')
      assert.equal(quota.hourly, null)
      assert.equal(quota.weekly, null)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('reads cached hourly and weekly windows without exposing unrelated fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-quota-test-'))
    try {
      await writeFile(join(directory, 'codex-quota-cache.json'), JSON.stringify([{
        accountId: 'account-1',
        planType: 'Pro',
        hourly: { used: 2, limit: 10, remaining: 8, resetAt: '2026-08-07T12:00:00.000Z' },
        weekly: { used: 20, limit: 100, remaining: 80, resetAt: '2026-08-10T12:00:00.000Z' },
        checkedAt: '2026-08-07T10:00:00.000Z',
        source: 'provider',
        status: 'available',
        message: 'cached'
      }]))

      const quota = await readCodexQuota(directory, 'account-1')
      assert.equal(quota.source, 'cache')
      assert.equal(quota.status, 'available')
      assert.equal(quota.hourly?.remaining, 8)
      assert.equal(quota.weekly?.remaining, 80)
      assert.equal((quota as unknown as Record<string, unknown>).token, undefined)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
