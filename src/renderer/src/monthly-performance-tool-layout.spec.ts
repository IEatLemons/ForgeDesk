import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function getAppSource(): string {
  return readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
}

function getFunctionSource(name: string, endMarker: string): string {
  const appSource = getAppSource()
  const start = appSource.indexOf(`function ${name}`)
  const end = appSource.indexOf(endMarker, start)

  assert.notEqual(start, -1, `${name} should exist`)
  assert.notEqual(end, -1, `${name} end marker should exist`)

  return appSource.slice(start, end)
}

describe('monthly performance Excel tool layout', () => {
  it('adds Excel as a top-level tool entry', () => {
    const source = getFunctionSource('ToolsPanel', '\nfunction getCurrentMonthValue')

    assert.match(source, /setActiveTool\('excel'\)/)
    assert.match(source, /Excel 工具/)
  })

  it('adds monthly performance as the second-level Excel entry', () => {
    const source = getFunctionSource('ExcelTool', '\nfunction MonthlyPerformanceTool')

    assert.match(source, /setActiveExcelTool\('monthly-performance'\)/)
    assert.match(source, /月度绩效/)
  })

  it('shows history first and opens a new performance chat page', () => {
    const source = getFunctionSource('MonthlyPerformanceTool', '\nfunction RsaPrivateKeyTool')

    assert.match(source, /listMonthlyPerformanceSessions/)
    assert.match(source, /新增绩效/)
    assert.match(source, /createMonthlyPerformanceSession/)
  })

  it('uses the chat session flow before exporting Excel', () => {
    const source = getFunctionSource('MonthlyPerformanceChatPage', '\nfunction MonthlyPerformanceTool')

    assert.match(source, /sendMonthlyPerformanceSessionMessage/)
    assert.match(source, /confirmMonthlyPerformanceSession/)
    assert.match(source, /exportMonthlyPerformanceSession/)
    assert.match(source, /确认生成数据/)
    assert.match(source, /disabled=\{!session\.preview \|\| confirming\}/)
  })
})
