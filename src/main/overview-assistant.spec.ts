import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { AiSettings } from './ai-settings.js'
import { readOverviewSnapshot, refreshOverviewNews, summarizeOverviewProjects } from './overview-assistant.js'

const settings: AiSettings = {
  enabled: true,
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'secret',
  model: 'gpt-test',
  temperature: 0.2
}

describe('overview assistant', () => {
  it('uses OpenAI web search and persists a normalized daily news report', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-overview-'))
    const seen: { url?: string; body?: Record<string, unknown> } = {}
    try {
      const report = await refreshOverviewNews(directory, settings, new Date('2026-07-14T08:00:00.000Z'), async (url, init) => {
        seen.url = String(url)
        seen.body = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({ output_text: JSON.stringify({ headline: '今日焦点', digest: '重要更新。', items: [{ title: '新模型发布', summary: '摘要', category: 'AI', source: 'OpenAI', url: 'https://example.com/news', publishedAt: '2026-07-14', relevance: '影响开发流程' }] }) }))
      })
      assert.equal(seen.url, 'https://api.openai.com/v1/responses')
      assert.deepEqual(seen.body?.tools, [{ type: 'web_search_preview' }])
      assert.equal(report.items[0].category, 'AI')
      assert.equal((await readOverviewSnapshot(directory)).newsHistory[0].headline, '今日焦点')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('keeps a useful project summary when AI is not configured', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-overview-'))
    try {
      const report = await summarizeOverviewProjects(directory, { ...settings, enabled: false }, [{ projectId: 'p1', projectName: 'ForgeDesk', repositoryCount: 1, changedRepositories: 1, aheadRepositories: 0, fetchFailures: [], repositories: [{ name: 'app', branch: 'main', latestCommit: 'feat: overview', hasChanges: true, ahead: 0 }] }])
      assert.equal(report.projects[0].status, 'attention')
      assert.match(report.projects[0].summary, /未提交/)
      assert.equal((await readOverviewSnapshot(directory)).projectReport?.projects.length, 1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
