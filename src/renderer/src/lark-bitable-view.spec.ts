import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLarkBitableGanttRange,
  createLarkBitableScheduleRows,
  inferLarkBitableScheduleFields,
  normalizeLarkDate
} from './lark-bitable-view.js'

test('infers schedule fields from common Chinese field names', () => {
  const mapping = inferLarkBitableScheduleFields([
    { id: 'title', name: '任务名称', type: 1, uiType: 'Text', isPrimary: true, property: {} },
    { id: 'start', name: '开始日期', type: 5, uiType: 'DateTime', isPrimary: false, property: {} },
    { id: 'end', name: '截止日期', type: 5, uiType: 'DateTime', isPrimary: false, property: {} },
    { id: 'owner', name: '负责人', type: 11, uiType: 'User', isPrimary: false, property: {} }
  ])

  assert.deepEqual(mapping, { title: '任务名称', start: '开始日期', end: '截止日期', status: '', owner: '负责人', priority: '' })
})

test('normalizes lark date values and creates gantt rows', () => {
  assert.equal(normalizeLarkDate(1_751_328_000_000), '2025-07-01')
  assert.equal(normalizeLarkDate({ value: '2025-07-03T12:00:00+08:00' }), '2025-07-03')

  const rows = createLarkBitableScheduleRows(
    [{ id: 'record-1', fields: { 任务: '接口开发', 开始: 1_751_328_000_000, 结束: 1_751_500_800_000 }, createdAt: '', updatedAt: '' }],
    { title: '任务', start: '开始', end: '结束', status: '', owner: '', priority: '' }
  )
  const range = createLarkBitableGanttRange(rows, new Date('2025-07-01T00:00:00'))

  assert.equal(rows[0]?.startDate, '2025-07-01')
  assert.equal(rows[0]?.endDate, '2025-07-03')
  assert.equal(range.rows[0]?.durationDays, 3)
  assert.ok(range.ticks.length >= 2)
})
