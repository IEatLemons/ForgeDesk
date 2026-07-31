import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type Database from 'better-sqlite3'

export type CodexSiteStatus = 'draft' | 'building' | 'ready' | 'previewing' | 'published' | 'error'

export type CodexSite = {
  id: string
  name: string
  prompt: string
  workspacePath: string
  linkedSessionId: string
  previewUrl: string
  publishedUrl: string
  status: CodexSiteStatus
  lastError: string
  createdAt: string
  updatedAt: string
}

export type CodexSiteCreateInput = {
  name: string
  prompt: string
  workspacePath: string
  linkedSessionId?: string
}

export type CodexSiteUpdateInput = {
  id: string
  name?: string
  prompt?: string
  workspacePath?: string
  linkedSessionId?: string
  status?: CodexSiteStatus
  previewUrl?: string
  publishedUrl?: string
  lastError?: string
}

type DatabaseLike = Pick<Database.Database, 'exec' | 'prepare'>
type SiteRow = {
  id?: unknown
  name?: unknown
  prompt?: unknown
  workspace_path?: unknown
  linked_session_id?: unknown
  preview_url?: unknown
  published_url?: unknown
  status?: unknown
  last_error?: unknown
  created_at?: unknown
  updated_at?: unknown
}
type PackageJson = { scripts?: Record<string, unknown> }

type SpawnPreview = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'pipe' }) => ChildProcessWithoutNullStreams

export type CodexSiteServiceOptions = {
  db: () => DatabaseLike
  now?: () => Date
  findPort?: () => Promise<number>
  spawnPreview?: SpawnPreview
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function statusValue(value: unknown): CodexSiteStatus {
  return value === 'building' || value === 'ready' || value === 'previewing' || value === 'published' || value === 'error' ? value : 'draft'
}

function nowIso(now: () => Date): string {
  return now().toISOString()
}

function mapSiteRow(row: SiteRow): CodexSite {
  return {
    createdAt: stringValue(row.created_at),
    id: stringValue(row.id),
    lastError: stringValue(row.last_error),
    linkedSessionId: stringValue(row.linked_session_id),
    name: stringValue(row.name),
    previewUrl: stringValue(row.preview_url),
    prompt: stringValue(row.prompt),
    publishedUrl: stringValue(row.published_url),
    status: statusValue(row.status),
    updatedAt: stringValue(row.updated_at),
    workspacePath: stringValue(row.workspace_path)
  }
}

export function migrateCodexSiteTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS codex_sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      workspace_path TEXT NOT NULL,
      linked_session_id TEXT NOT NULL DEFAULT '',
      preview_url TEXT NOT NULL DEFAULT '',
      published_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

function validateSiteUrl(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error('发布链接必须是有效的 http 或 https URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('发布链接必须使用 http 或 https')
  return url.toString()
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => error ? reject(error) : resolvePort(port))
    })
  })
}

function previewCommand(packageJson: PackageJson): { command: string; script: string; args: string[] } {
  const scripts = packageJson.scripts ?? {}
  const script = typeof scripts.dev === 'string' ? 'dev' : typeof scripts.start === 'string' ? 'start' : ''
  if (!script) throw new Error('项目没有 dev 或 start 脚本，无法启动站点预览')
  return { args: [], command: 'npm', script }
}

export class CodexSiteService {
  private readonly db: () => DatabaseLike
  private readonly now: () => Date
  private readonly findPort: () => Promise<number>
  private readonly spawnPreview: SpawnPreview
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>()

  constructor(options: CodexSiteServiceOptions) {
    this.db = options.db
    this.now = options.now ?? (() => new Date())
    this.findPort = options.findPort ?? findAvailablePort
    this.spawnPreview = options.spawnPreview ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions))
  }

  list(): CodexSite[] {
    return (this.db().prepare('SELECT * FROM codex_sites ORDER BY updated_at DESC, created_at DESC').all() as SiteRow[]).map(mapSiteRow)
  }

  get(siteId: string): CodexSite | null {
    const row = this.db().prepare('SELECT * FROM codex_sites WHERE id = ?').get(siteId) as SiteRow | undefined
    return row ? mapSiteRow(row) : null
  }

  create(input: CodexSiteCreateInput): CodexSite {
    const name = input.name.trim()
    const workspacePath = resolve(input.workspacePath.trim())
    if (!name) throw new Error('请输入站点名称')
    if (!input.workspacePath.trim()) throw new Error('请选择站点工作目录')
    const timestamp = nowIso(this.now)
    const id = `codex-site-${randomUUID()}`
    this.db().prepare(`
      INSERT INTO codex_sites (id, name, prompt, workspace_path, linked_session_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, input.prompt.trim(), workspacePath, input.linkedSessionId?.trim() ?? '', timestamp, timestamp)
    return this.get(id) as CodexSite
  }

  update(input: CodexSiteUpdateInput): CodexSite {
    const current = this.get(input.id)
    if (!current) throw new Error('站点不存在')
    const name = input.name?.trim() || current.name
    const workspacePath = input.workspacePath?.trim() ? resolve(input.workspacePath.trim()) : current.workspacePath
    const publishedUrl = input.publishedUrl === undefined ? current.publishedUrl : validateSiteUrl(input.publishedUrl)
    const status = input.status ?? (publishedUrl ? 'published' : current.status)
    const timestamp = nowIso(this.now)
    this.db().prepare(`
      UPDATE codex_sites
      SET name = ?, prompt = ?, workspace_path = ?, linked_session_id = ?, preview_url = ?, published_url = ?, status = ?, last_error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name,
      input.prompt === undefined ? current.prompt : input.prompt.trim(),
      workspacePath,
      input.linkedSessionId === undefined ? current.linkedSessionId : input.linkedSessionId.trim(),
      input.previewUrl === undefined ? current.previewUrl : input.previewUrl.trim(),
      publishedUrl,
      status,
      input.lastError === undefined ? current.lastError : input.lastError.trim(),
      timestamp,
      input.id
    )
    return this.get(input.id) as CodexSite
  }

  delete(siteId: string): CodexSite[] {
    this.stopPreview(siteId)
    this.db().prepare('DELETE FROM codex_sites WHERE id = ?').run(siteId)
    return this.list()
  }

  async startPreview(siteId: string): Promise<CodexSite> {
    const site = this.get(siteId)
    if (!site) throw new Error('站点不存在')
    if (this.processes.has(siteId) && site.previewUrl) return site

    const packagePath = resolve(site.workspacePath, 'package.json')
    let packageJson: PackageJson
    try {
      packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as PackageJson
    } catch {
      throw new Error('站点目录中没有可读取的 package.json')
    }
    const commandInfo = previewCommand(packageJson)
    const port = await this.findPort()
    const args = ['run', commandInfo.script, '--', '--host', '127.0.0.1', '--port', String(port)]
    let child: ChildProcessWithoutNullStreams
    try {
      child = this.spawnPreview(commandInfo.command, args, {
        cwd: site.workspacePath,
        env: { ...process.env, BROWSER: 'none', HOST: '127.0.0.1', PORT: String(port) },
        stdio: 'pipe'
      })
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error))
    }

    this.processes.set(siteId, child)
    const previewUrl = `http://127.0.0.1:${port}`
    const nextSite = this.update({ id: siteId, lastError: '', previewUrl, status: 'previewing' })
    child.once('error', (error) => {
      if (this.processes.get(siteId) !== child) return
      this.processes.delete(siteId)
      this.update({ id: siteId, status: 'error', lastError: error.message })
    })
    child.once('close', (code) => {
      if (this.processes.get(siteId) !== child) return
      this.processes.delete(siteId)
      this.update({ id: siteId, status: code === 0 ? (site.publishedUrl ? 'published' : 'ready') : 'error', lastError: code === 0 ? '' : `预览进程退出，退出码 ${code ?? 'unknown'}` })
    })
    return nextSite
  }

  stopPreview(siteId: string): CodexSite | null {
    const child = this.processes.get(siteId)
    if (child) {
      child.kill()
      this.processes.delete(siteId)
    }
    const site = this.get(siteId)
    if (!site) return null
    return this.update({ id: siteId, status: site.publishedUrl ? 'published' : 'ready' })
  }

  handleSessionEvent(sessionId: string, type: string, error = ''): void {
    if (type !== 'completed' && type !== 'failed' && type !== 'cancelled') return
    const status = type === 'completed' ? 'ready' : 'error'
    const sites = this.list().filter((site) => site.linkedSessionId === sessionId && site.status === 'building')
    sites.forEach((site) => this.update({ id: site.id, lastError: error || (status === 'error' ? 'Codex 构建未完成' : ''), status }))
  }
}
