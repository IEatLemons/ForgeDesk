import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTableScrollWidth } from './data-table-layout.js'

describe('horizontal table layout', () => {
  it('preserves the requested width when flexible columns have room', () => {
    assert.equal(getTableScrollWidth(720, [{ width: 140 }, {}, {}, { width: 230 }]), 720)
  })

  it('keeps room for flexible columns and row selection after reserving declared widths', () => {
    assert.equal(getTableScrollWidth(400, [{ width: 260 }, {}, { width: 180 }], 32), 592)
  })

  it('counts visible leaf columns and preserves relative widths for the browser', () => {
    const columns = [{ width: 500, children: [{ width: 160 }, { width: '140' }, { width: '20%' }] }, { width: 400, hidden: true }]
    assert.equal(getTableScrollWidth(250, columns), 300)
  })
})
