import { execFile } from 'node:child_process'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import {
  createMonitorAlert,
  listCodexMonitorAlerts,
  type AiMonitorProvider,
  type CodexGitWorkspaceState,
  type CodexMonitorDatabase,
  type CodexProjectMonitorItem,
  type CodexUncommittedAlert,
  type MonitorProjectRecord
} from './codex-project-monitor.js'
import { listAiProjectResourceLinks } from './ai-project-resource-links.js'
import type { ProjectGroupRecord } from './project-groups.js'

const execFileAsync = promisify(execFile)

export type CursorWorkspace = { path: string; workspaceId: string; updatedAt: string }
export type CursorAgentProcess = { pid: number; cwd: string; command: string }

export type CursorMonitorSnapshot = {
  available: boolean
  checkedAt: string
  error: string
  source: string
  projects: CodexProjectMonitorItem[]
  alerts: CodexUncommittedAlert[]
  running: number
  uncommitted: number
  unlinked: number
  completed: number
  failed: number
}

export type CursorMonitorOptions = {
  db: () => CodexMonitorDatabase
  listProjects: () => MonitorProjectRecord[]
  listGroups: () => ProjectGroupRecord[]
  cursorUserDataPath?: string
  now?: () => Date
  listWorkspaces?: () => Promise<CursorWorkspace[]>
  listAgents?: () => Promise<CursorAgentProcess[]>
  inspectGit?: (cwd: string) => Promise<CodexGitWorkspaceState>
  onAlert?: (alert: CodexUncommittedAlert) => void
}

type CursorState = { cwd: string; lastSeenAt: string; active: boolean }

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function normalizedPath(value: string): string { const v = text(value); return v ? resolve(v) : '' }
function key(cwd: string): string { return normalizedPath(cwd) || '__unknown__' }
function isWithin(parent: string, child: string): boolean {
  const p = normalizedPath(parent); const c = normalizedPath(child)
  return Boolean(p && c && (c === p || c.startsWith(`${p}/`)))
}

function cursorUserDataDefault(): string {
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Cursor')
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Cursor')
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Cursor')
}

function decodeWorkspaceFolder(value: unknown): string {
  const folder = text(value)
  if (!folder.startsWith('file://')) return ''
  try { return normalizedPath(decodeURIComponent(folder.replace(/^file:\/\//, ''))) } catch { return '' }
}

export async function discoverCursorWorkspaces(root = join(cursorUserDataDefault(), 'User', 'workspaceStorage')): Promise<CursorWorkspace[]> {
  try { await access(root) } catch { return [] }
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const result: CursorWorkspace[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const workspaceId = entry.name
    try {
      const workspaceFile = join(root, workspaceId, 'workspace.json')
      const parsed = JSON.parse(await readFile(workspaceFile, 'utf8')) as { folder?: unknown }
      const path = decodeWorkspaceFolder(parsed.folder)
      if (!path) continue
      const details = await stat(workspaceFile)
      result.push({ path, updatedAt: details.mtime.toISOString(), workspaceId })
    } catch { /* ignore stale or remote workspaces */ }
  }
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

async function processCwd(pid: number): Promise<string> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') return ''
  try {
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { timeout: 3000 })
    return normalizedPath(stdout.split(/\r?\n/).find((line) => line.startsWith('n'))?.slice(1) || '')
  } catch { return '' }
}

export async function listCursorAgentProcesses(): Promise<CursorAgentProcess[]> {
  try {
    const { stdout } = await execFileAsync('ps', process.platform === 'win32' ? [] : ['-axo', 'pid=,command='], { timeout: 5000 })
    const rows = await Promise.all(stdout.split(/\r?\n/).map(async (line) => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/)
      if (!match || !/(?:^|[\s/])(?:cursor-agent|agent)(?:\s|$)/i.test(match[2]) || /Cursor Helper|Cursor\.app/i.test(match[2])) return null
      const cwd = await processCwd(Number(match[1]))
      return cwd ? { pid: Number(match[1]), cwd, command: match[2] } : null
    }))
    return rows.filter((row): row is CursorAgentProcess => Boolean(row))
  } catch { return [] }
}

function groupName(groupId: string | null, groups: ProjectGroupRecord[]): string { return groupId ? groups.find((g) => g.id === groupId)?.name || '未分组' : '未分组' }
function matchProject(cwd: string, projects: MonitorProjectRecord[], links: Map<string, { projectId: string }>): { project: MonitorProjectRecord | null; source: CodexProjectMonitorItem['linkSource'] } {
  const explicit = links.get(key(cwd))
  if (explicit) return { project: projects.find((p) => p.id === explicit.projectId) || null, source: 'manual' }
  const matches = projects.filter((p) => isWithin(p.workspacePath, cwd) || (p.repositoryPaths || []).some((path) => isWithin(path, cwd))).sort((a, b) => b.workspacePath.length - a.workspacePath.length)
  return { project: matches[0] || null, source: matches.length ? 'auto' : 'unlinked' }
}

function emptyGit(cwd: string, checkedAt: string): CodexGitWorkspaceState { return { cwd, repositoryRoot: '', branch: '', additions: 0, deletions: 0, filesChanged: 0, hasChanges: false, repositoryAvailable: false, checkedAt } }

export class CursorMonitorService {
  private readonly options: CursorMonitorOptions
  private readonly now: () => Date
  constructor(options: CursorMonitorOptions) { this.options = options; this.now = options.now || (() => new Date()) }

  async snapshot(): Promise<CursorMonitorSnapshot> {
    const checkedAt = this.now().toISOString()
    const [workspaces, agents] = await Promise.all([(this.options.listWorkspaces || (() => discoverCursorWorkspaces()))(), (this.options.listAgents || listCursorAgentProcesses)()])
    const projects = this.options.listProjects(); const groups = this.options.listGroups()
    const links = new Map(listAiProjectResourceLinks(this.options.db(), { providerId: 'cursor' }).map((link) => [link.resourceKey, link]))
    const paths = new Set([...workspaces.map((w) => w.path), ...agents.map((a) => a.cwd)])
    const states = new Map<string, CursorState>()
    try {
      this.options.db().exec('CREATE TABLE IF NOT EXISTS cursor_monitor_state (cwd TEXT PRIMARY KEY, last_seen_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0)')
      for (const row of this.options.db().prepare('SELECT cwd, last_seen_at, active FROM cursor_monitor_state').all() as Array<Record<string, unknown>>) states.set(key(text(row.cwd)), { cwd: text(row.cwd), lastSeenAt: text(row.last_seen_at), active: Boolean(row.active) })
    } catch { /* optional state is best effort */ }
    const activePaths = new Set(agents.map((agent) => key(agent.cwd)))
    const inspectGit = this.options.inspectGit || (async (cwd: string) => emptyGit(cwd, checkedAt))
    for (const [stateKey, state] of states) {
      if (state.active && !activePaths.has(stateKey)) {
        const git = await inspectGit(state.cwd)
        if (git.repositoryAvailable && git.hasChanges) {
          const binding = matchProject(state.cwd, projects, links)
          const item = this.makeItem(state.cwd, binding, git, 0, checkedAt)
          const alert = createMonitorAlert(this.options.db(), item, 'cursor-agent', state.cwd, state.lastSeenAt, state.lastSeenAt, checkedAt)
          if (!alert.notifiedAt) {
            try { this.options.db().prepare('UPDATE codex_monitor_alerts SET notified_at = ? WHERE id = ? AND notified_at IS NULL').run(checkedAt, alert.id) } catch { /* best effort */ }
            this.options.onAlert?.({ ...alert, notifiedAt: checkedAt })
          }
        }
      }
    }
    for (const agent of agents) {
      const agentKey = key(agent.cwd); const previous = states.get(agentKey)
      states.set(agentKey, { cwd: agent.cwd, lastSeenAt: previous?.lastSeenAt || checkedAt, active: true })
    }
    for (const path of paths) {
      const pathKey = key(path); const active = activePaths.has(pathKey); const previous = states.get(pathKey)
      if (!previous) states.set(pathKey, { cwd: path, lastSeenAt: checkedAt, active })
      else if (!active) states.set(pathKey, { ...previous, active: false })
    }
    try {
      for (const state of states.values()) this.options.db().prepare('INSERT INTO cursor_monitor_state (cwd, last_seen_at, active) VALUES (?, ?, ?) ON CONFLICT(cwd) DO UPDATE SET last_seen_at=excluded.last_seen_at, active=excluded.active').run(state.cwd, state.lastSeenAt, state.active ? 1 : 0)
    } catch { /* best effort */ }
    const items = await Promise.all([...paths].map(async (cwd) => {
      const git = await inspectGit(cwd); const binding = matchProject(cwd, projects, links); const running = agents.filter((a) => isWithin(cwd, a.cwd)).length
      if (git.repositoryAvailable && !git.hasChanges) {
        try { this.options.db().prepare("UPDATE codex_monitor_alerts SET status = 'resolved', resolved_at = ? WHERE provider_id = 'cursor' AND cwd = ? AND status = 'open'").run(checkedAt, cwd) } catch { /* best effort */ }
      }
      return this.makeItem(cwd, binding, git, running, checkedAt)
    }))
    const alerts = listCodexMonitorAlerts(this.options.db(), 'open').filter((alert) => alert.providerId === 'cursor')
    const byPath = new Map(alerts.map((alert) => [key(alert.cwd), alert])); for (const item of items) item.openAlert = byPath.get(key(item.cwd)) || null
    items.sort((a, b) => Number(b.openAlert) - Number(a.openAlert) || b.runningCount - a.runningCount || a.cwd.localeCompare(b.cwd))
    return { available: workspaces.length > 0 || agents.length > 0, checkedAt, error: '', source: cursorUserDataDefault(), projects: items, alerts, running: items.reduce((n, i) => n + i.runningCount, 0), uncommitted: alerts.length, unlinked: items.filter((i) => !i.forgeProjectId).length, completed: 0, failed: 0 }
  }

  private makeItem(cwd: string, binding: { project: MonitorProjectRecord | null; source: CodexProjectMonitorItem['linkSource'] }, git: CodexGitWorkspaceState, runningCount: number, checkedAt: string): CodexProjectMonitorItem {
    return { providerId: 'cursor' as AiMonitorProvider, key: key(cwd), cwd, forgeProjectId: binding.project?.id || null, forgeProjectName: binding.project?.name || '', groupId: binding.project?.groupId || null, groupName: groupName(binding.project?.groupId || null, this.options.listGroups()), linkSource: binding.source, sessionCount: 0, runningCount, completedCount: 0, failedCount: 0, sessions: [], tasks: [], worktrees: [], regularSessionIds: [], regularTaskIds: [], git, status: runningCount ? 'running' : git.repositoryAvailable && git.hasChanges ? 'attention' : git.repositoryAvailable ? 'clean' : 'unknown', openAlert: null }
  }
}
