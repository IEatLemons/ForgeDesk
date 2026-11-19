import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { graphParentPath, normalizeGraphWidth } from './git-graph-preferences.js'

describe('git graph width preferences and row geometry', () => {
  it('loads bounded widths and falls back to automatic for absent or corrupt values', () => {
    for (const value of [null, undefined, '320', Infinity, NaN, {}]) assert.equal(normalizeGraphWidth(value), null)
    assert.equal(normalizeGraphWidth(1), 160)
    assert.equal(normalizeGraphWidth(1000), 640)
    assert.equal(normalizeGraphWidth(319.8), 320)
  })
  it('connects across the actual tall row instead of ending at the old fixed 46px', () => {
    const short = graphParentPath(40, 80, 46), tall = graphParentPath(40, 80, 118)
    assert.match(short, /^M 40 23 C/); assert.ok(short.endsWith('80 48'))
    assert.match(tall, /^M 40 59 C/); assert.ok(tall.endsWith('80 120'))
    assert.equal(graphParentPath(40, 40, 118), 'M 40 59 L 40 120')
  })
})
