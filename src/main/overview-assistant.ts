import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requestAiText } from './ai-runtime.js'
import { isAiSettingsConfigured, type AiSettings } from './ai-settings.js'

export type OverviewNewsItem = {
  title: string
  summary: string
  category: string
  source: string
  url: string
  publishedAt: string
  relevance: string
}

export type OverviewNewsReport = {
  date: string
  headline: string
  digest: string
  items: OverviewNewsItem[]
  generatedAt: string
}

export type OverviewProjectItem = {
  projectId: string
  projectName: string
  status: 'healthy' | 'attention' | 'error' | 'empty'
  summary: string
  highlights: string[]
  repositoryCount: number
  changedRepositories: number
  aheadRepositories: number
  fetchFailures: string[]
}

export type OverviewProjectReport = {
  summary: string
  projects: OverviewProjectItem[]
  generatedAt: string
}

export type OverviewSnapshot = {
  newsHistory: OverviewNewsReport[]
  projectReport: OverviewProjectReport | null
}

type ProjectContext = Omit<OverviewProjectItem, 'status' | 'summary' | 'highlights'> & {
  repositories: Array<{
    name: string
    branch: string
    latestCommit: string
    hasChanges: boolean
    ahead: number
  }>
}

const emptySnapshot: OverviewSnapshot = { newsHistory: [], projectReport: null }

function snapshotPath(userDataPath: string): string {
  return join(userDataPath, 'overview-snapshot.json')
}

export async function readOverviewSnapshot(userDataPath: string): Promise<OverviewSnapshot> {
  try {
    const parsed = JSON.parse(await readFile(snapshotPath(userDataPath), 'utf8')) as Partial<OverviewSnapshot>
    return {
      newsHistory: Array.isArray(parsed.newsHistory) ? parsed.newsHistory : [],
      projectReport: parsed.projectReport ?? null
    }
  } catch {
    return emptySnapshot
  }
}

async function writeOverviewSnapshot(userDataPath: string, snapshot: OverviewSnapshot): Promise<void> {
  await mkdir(userDataPath, { recursive: true })
  await writeFile(snapshotPath(userDataPath), `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 })
}

function stripFence(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return match?.[1] ?? trimmed
}

async function requestJson(settings: AiSettings, system: string, user: string, webSearch = false, fetchImpl: typeof fetch = fetch): Promise<Record<string, unknown>> {
  const text = await requestAiText({
    settings,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    webSearch,
    fetchImpl
  })
  try {
    const parsed = JSON.parse(stripFence(text)) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid payload')
    return parsed
  } catch {
    throw new Error('AI 返回的总览内容格式不正确，请重试')
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function refreshOverviewNews(userDataPath: string, settings: AiSettings, now = new Date(), fetchImpl?: typeof fetch): Promise<OverviewNewsReport> {
  const date = now.toLocaleDateString('en-CA')
  const payload = await requestJson(
    settings,
    '你是 ForgeDesk 的科技与商业情报编辑。必须先联网搜索，再仅用可靠来源整理当天新闻。返回严格 JSON，不要 Markdown。',
    [
      `今天是 ${date}。搜索今天最新且值得软件开发者和产品团队关注的新闻。`,
      '覆盖 AI、开发者工具、科技行业、商业/政策，合并重复事件，最多 12 条。',
      'JSON: {"headline":"一句话标题","digest":"2-4句总摘要","items":[{"title":"","summary":"","category":"AI|开发工具|科技|商业政策","source":"","url":"https://...","publishedAt":"ISO日期或时间","relevance":"为何值得关注"}]}'
    ].join('\n'),
    true,
    fetchImpl
  )
  const items = Array.isArray(payload.items) ? payload.items : []
  const report: OverviewNewsReport = {
    date,
    headline: text(payload.headline) || '今日科技情报',
    digest: text(payload.digest),
    items: items.slice(0, 12).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const value = item as Record<string, unknown>
      const title = text(value.title)
      const url = text(value.url)
      if (!title || !/^https?:\/\//i.test(url)) return []
      return [{ title, url, summary: text(value.summary), category: text(value.category) || '科技', source: text(value.source), publishedAt: text(value.publishedAt), relevance: text(value.relevance) }]
    }),
    generatedAt: now.toISOString()
  }
  const snapshot = await readOverviewSnapshot(userDataPath)
  snapshot.newsHistory = [report, ...snapshot.newsHistory.filter((item) => item.date !== date)].slice(0, 30)
  await writeOverviewSnapshot(userDataPath, snapshot)
  return report
}

export async function summarizeOverviewProjects(userDataPath: string, settings: AiSettings, contexts: ProjectContext[], fetchImpl?: typeof fetch): Promise<OverviewProjectReport> {
  if (contexts.length === 0) {
    const report: OverviewProjectReport = { summary: '还没有项目可更新。', projects: [], generatedAt: new Date().toISOString() }
    const snapshot = await readOverviewSnapshot(userDataPath)
    snapshot.projectReport = report
    await writeOverviewSnapshot(userDataPath, snapshot)
    return report
  }
  const payload = isAiSettingsConfigured(settings)
    ? await requestJson(
        settings,
        '你是项目组合管理助手。只依据输入的 Git 状态生成简洁中文总结，不得编造。返回严格 JSON，不要 Markdown。',
        `分析以下项目状态：\n${JSON.stringify(contexts)}\nJSON: {"summary":"组合级摘要","projects":[{"projectId":"","summary":"一句话进展与风险","highlights":["最多3条"]}]}`,
        false,
        fetchImpl
      )
    : {}
  const aiProjects = Array.isArray(payload.projects) ? payload.projects : []
  const byId = new Map(aiProjects.flatMap((item) => item && typeof item === 'object' ? [[text((item as Record<string, unknown>).projectId), item as Record<string, unknown>] as const] : []))
  const report: OverviewProjectReport = {
    summary: text(payload.summary) || `已刷新 ${contexts.length} 个项目的远端状态；启用 AI 后可获得进展与风险解读。`,
    projects: contexts.map((context) => {
      const ai = byId.get(context.projectId)
      const highlights = Array.isArray(ai?.highlights) ? ai.highlights.map(text).filter(Boolean).slice(0, 3) : []
      const status: OverviewProjectItem['status'] = context.fetchFailures.length > 0 ? 'error' : context.repositoryCount === 0 ? 'empty' : context.changedRepositories > 0 || context.aheadRepositories > 0 ? 'attention' : 'healthy'
      const { repositories: _repositories, ...base } = context
      const fallbackSummary = status === 'error' ? `远端更新有 ${context.fetchFailures.length} 个失败。` : status === 'empty' ? '项目下还没有仓库。' : status === 'attention' ? '存在未提交修改或待推送提交。' : '仓库与远端状态正常。'
      return { ...base, status, summary: text(ai?.summary) || fallbackSummary, highlights }
    }),
    generatedAt: new Date().toISOString()
  }
  const snapshot = await readOverviewSnapshot(userDataPath)
  snapshot.projectReport = report
  await writeOverviewSnapshot(userDataPath, snapshot)
  return report
}
