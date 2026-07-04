import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createMonthlyPerformanceWorkbook,
  normalizeMonthlyPerformancePreview,
  requestMonthlyPerformanceChat,
  requestMonthlyPerformancePreview,
  type MonthlyPerformancePreview,
  type MonthlyPerformanceRow
} from './monthly-performance.js'
import type { AiSettings } from './ai-settings.js'

const readySettings: AiSettings = {
  enabled: true,
  provider: 'openai-compatible',
  baseUrl: 'https://llm.example.com/v1',
  apiKey: 'secret',
  model: 'gpt-test',
  temperature: 0.2
}

function createSourceRow(patch: Partial<MonthlyPerformanceRow> = {}): MonthlyPerformanceRow {
  return {
    personId: 'person-1',
    name: 'Stone',
    role: 'Engineer',
    identity: 'stone@example.com',
    commits: 3,
    additions: 120,
    deletions: 20,
    filesChanged: 9,
    activeDays: 4,
    completedWorkItems: 2,
    inProgressWorkItems: 1,
    overdueWorkItems: 0,
    aiScore: 0,
    performanceLevel: '待评估',
    highlights: '',
    risks: '',
    nextMonthPlan: '',
    notes: '',
    ...patch
  }
}

function createPreview(patch: Partial<MonthlyPerformancePreview> = {}): MonthlyPerformancePreview {
  return {
    projectId: 'project-a',
    projectName: 'ForgeDesk',
    month: '2026-06',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    generatedAt: '2026-07-01T00:00:00.000Z',
    totalCommits: 3,
    totalAdditions: 120,
    totalDeletions: 20,
    activeDays: 4,
    contributorCount: 1,
    aiSummary: '交付稳定。',
    highlights: ['完成核心交付'],
    risks: ['测试覆盖需要继续补齐'],
    nextMonthFocus: ['推进自动化测试'],
    rows: [createSourceRow({ aiScore: 88, performanceLevel: 'B', highlights: '交付稳定' })],
    warnings: [],
    ...patch
  }
}

describe('monthly performance assistant', () => {
  it('calls an OpenAI-compatible endpoint and merges AI comments with local metrics', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> })

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: {
                    aiSummary: '本月交付节奏稳定',
                    highlights: ['核心功能推进顺利'],
                    risks: ['继续控制返工'],
                    nextMonthFocus: ['补齐测试']
                  },
                  rows: [
                    {
                      personId: 'person-1',
                      name: 'Stone',
                      commits: 999,
                      aiScore: 91,
                      performanceLevel: 'A',
                      highlights: '推进核心功能',
                      risks: '注意需求变更',
                      nextMonthPlan: '完善回归测试',
                      notes: '按质量优先口径'
                    }
                  ],
                  warnings: ['Plane 数据未参与']
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    }

    const preview = await requestMonthlyPerformancePreview({
      settings: readySettings,
      projectId: 'project-a',
      projectName: 'ForgeDesk',
      month: '2026-06',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      instruction: '质量优先',
      totalCommits: 3,
      totalAdditions: 120,
      totalDeletions: 20,
      activeDays: 4,
      contributorCount: 1,
      sourceRows: [createSourceRow()],
      fetchImpl: fakeFetch as typeof fetch
    })

    assert.equal(calls[0].url, 'https://llm.example.com/v1/chat/completions')
    assert.equal((calls[0].body.messages as Array<{ role: string }>)[0].role, 'system')
    assert.equal(preview.aiSummary, '本月交付节奏稳定')
    assert.equal(preview.rows[0].commits, 3)
    assert.equal(preview.rows[0].aiScore, 91)
    assert.equal(preview.rows[0].highlights, '推进核心功能')
    assert.deepEqual(preview.warnings, ['Plane 数据未参与'])
  })

  it('rejects disabled or incomplete AI settings', async () => {
    await assert.rejects(
      () =>
        requestMonthlyPerformancePreview({
          settings: { ...readySettings, enabled: false, apiKey: '' },
          projectId: 'project-a',
          projectName: 'ForgeDesk',
          month: '2026-06',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          instruction: '',
          totalCommits: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          activeDays: 0,
          contributorCount: 0,
          sourceRows: []
        }),
      /请先在公共设置里启用 AI/
    )
  })

  it('reports invalid AI JSON clearly', () => {
    assert.throws(
      () =>
        normalizeMonthlyPerformancePreview({
          projectId: 'project-a',
          projectName: 'ForgeDesk',
          month: '2026-06',
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          totalCommits: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          activeDays: 0,
          contributorCount: 0,
          sourceRows: [],
          aiContent: 'not json'
        }),
      /AI 没有返回有效的月度绩效 JSON/
    )
  })

  it('continues a monthly performance chat with concise assistant text', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> })

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '已记录质量优先口径。下一步请补充是否有事故或关键交付。' } }]
        }),
        { status: 200 }
      )
    }

    const content = await requestMonthlyPerformanceChat({
      settings: readySettings,
      projectName: 'ForgeDesk',
      month: '2026-06',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: '这个月质量优先，事故扣分。',
          createdAt: '2026-07-01T00:00:00.000Z'
        }
      ],
      fetchImpl: fakeFetch as typeof fetch
    })

    assert.equal(calls[0].url, 'https://llm.example.com/v1/chat/completions')
    assert.match(content, /已记录质量优先口径/)
  })

  it('creates overview and detail worksheets with typed numeric cells', () => {
    const workbook = createMonthlyPerformanceWorkbook(createPreview())
    const overview = workbook.getWorksheet('总览')
    const detail = workbook.getWorksheet('人员绩效明细')

    assert.ok(overview)
    assert.ok(detail)
    assert.equal(detail?.getCell('A1').value, '姓名')
    assert.equal(detail?.getCell('D1').value, '提交数')
    assert.equal(detail?.getCell('D2').value, 3)
    assert.equal(typeof detail?.getCell('D2').value, 'number')
    assert.equal(overview?.getCell('A1').value, '指标')
  })

  it('adds an explicit empty data row when preview has no people', () => {
    const workbook = createMonthlyPerformanceWorkbook(createPreview({ rows: [], warnings: ['本月没有可用于绩效整理的人员数据'] }))
    const detail = workbook.getWorksheet('人员绩效明细')

    assert.equal(detail?.getCell('A2').value, '无人员数据')
    assert.match(String(detail?.getCell('Q2').value ?? ''), /本月没有可用于绩效整理的人员数据/)
  })
})
