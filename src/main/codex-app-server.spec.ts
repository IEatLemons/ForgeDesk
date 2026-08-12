import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'
import { readCodexAppServerSnapshot, type CodexAppServerSpawnProcess } from './codex-app-server.js'

class FakeAppServerProcess extends EventEmitter {
  readonly stdin = new PassThrough()
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  killed = false

  kill(): boolean {
    this.killed = true
    this.emit('exit', 0, null)
    return true
  }
}

function fakeSpawn(): { spawn: CodexAppServerSpawnProcess; process: FakeAppServerProcess; requests: Array<Record<string, unknown>> } {
  const process = new FakeAppServerProcess()
  const requests: Array<Record<string, unknown>> = []
  process.stdin.on('data', (chunk) => {
    for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) {
      const request = JSON.parse(line) as Record<string, unknown>
      requests.push(request)
      if (request.id === undefined) continue
      const method = request.method
      const result = method === 'account/read'
        ? { account: { type: 'chatgpt', email: 'live@example.com', planType: 'pro' }, requiresOpenaiAuth: true }
        : method === 'account/rateLimits/read'
          ? {
            rateLimits: {
              limitId: 'codex',
              limitName: null,
              primary: { usedPercent: 25, windowDurationMins: 15, resetsAt: 1786197730 },
              secondary: { usedPercent: 50, windowDurationMins: 10080, resetsAt: 1786797730 },
              credits: { hasCredits: false, unlimited: false, balance: '0' },
              individualLimit: null,
              spendControlReached: null,
              planType: 'pro',
              rateLimitReachedType: null
            },
            rateLimitResetCredits: { availableCount: 1, credits: [] }
          }
          : method === 'account/usage/read'
            ? {
              summary: { lifetimeTokens: 1234, peakDailyTokens: 456, longestRunningTurnSec: 12, currentStreakDays: 2, longestStreakDays: 4 },
              dailyUsageBuckets: [{ startDate: '2026-08-07', tokens: 1234 }]
            }
            : {}
      process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)
    }
  })
  return {
    process,
    requests,
    spawn: (() => process) as unknown as CodexAppServerSpawnProcess
  }
}

describe('Codex App Server adapter', () => {
  it('performs the initialize handshake and normalizes live account, limits and usage data', async () => {
    const fake = fakeSpawn()
    const snapshot = await readCodexAppServerSnapshot({
      command: '/fake/codex',
      codexHome: '/tmp/codex-profile',
      refreshToken: true,
      spawnProcess: fake.spawn
    })

    assert.equal(snapshot.account.email, 'live@example.com')
    assert.equal(snapshot.account.planType, 'pro')
    assert.equal(snapshot.rateLimits?.primary?.usedPercent, 25)
    assert.equal(snapshot.rateLimits?.secondary?.windowDurationMins, 10080)
    assert.equal(snapshot.rateLimits?.resetCredits?.availableCount, 1)
    assert.equal(snapshot.usage?.summary?.lifetimeTokens, '1234')
    assert.equal(snapshot.usage?.dailyUsageBuckets?.[0]?.tokens, '1234')
    assert.equal(fake.requests[0]?.method, 'initialize')
    assert.equal(fake.requests[0]?.jsonrpc, undefined)
    const requestsWithIds = fake.requests.filter((request) => request.id !== undefined)
    assert.equal(requestsWithIds[1]?.method, 'account/read')
    assert.deepEqual(requestsWithIds[1]?.params, { refreshToken: true })
    assert.equal(requestsWithIds[2]?.method, 'account/rateLimits/read')
    assert.equal(requestsWithIds[3]?.method, 'account/usage/read')
    const initialized = fake.requests.find((request) => request.method === 'initialized')
    assert.deepEqual(initialized?.params, {})
    assert.equal(initialized?.jsonrpc, undefined)
    assert.equal(fake.process.killed, true)
  })
})
