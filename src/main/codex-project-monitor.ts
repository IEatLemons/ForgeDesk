import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, relative, resolve } from 'node:path'
import type { CodexSessionSummary, CodexSessionsSnapshot } from './codex-sessions.js'
import type { CodexTaskRecord, CodexTaskRunStatus } from './codex-tasks.js'
import type { ProjectGroupRecord } from './project-groups.js'
import { listAiProjectResourceLinks, type AiProjectResourceLink } from './ai-project-resource-links.js'

const execFileAsync = promisify(execFile)

export type MonitorProjectRecord = {
  id: string
  name: string
  workspacePath: string
  groupId: string | null
  repositoryPaths?: string[]
}

export type CodexProjectLink = {
  codexKey: string
  cwd: string
  projectId: string | null
  updatedAt: string
}

export type CodexProjectLinkInput = {
  cwd: string
  projectId: string | null
}

export type CodexGitWorkspaceState = {
  cwd: string
  repositoryRoot: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  hasChanges: boolean
  repositoryAvailable: boolean
  checkedAt: string
}

export type CodexWorktree = {
  path: string
  branch: string
  head: string
  detached: boolean
  isMain: boolean
  git: CodexGitWorkspaceState
  sessionIds: string[]
  taskIds: string[]
}

export type CodexTaskMonitorSummary = {
  id: string
  title: string
  projectId: string
  cwd: string
  status: CodexTaskRunStatus
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  errorMessage: string
  createdAt: string
  updatedAt: string
  finishedAt: string
}

export type CodexUncommittedAlert = {
  id: string
  sourceType: 'session' | 'task'
  sourceId: string
  completionMarker: string
  codexKey: string
  cwd: string
  projectId: string | null
  projectName: string
  completedAt: string
  detectedAt: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  status: 'open' | 'resolved'
  resolvedAt: string | null
  notifiedAt: string | null
}

export type CodexProjectMonitorStatus = 'running' | 'attention' | 'completed' | 'clean' | 'unknown'

export type CodexProjectMonitorItem = {
  key: string
  cwd: string
  forgeProjectId: string | null
  forgeProjectName: string
  groupId: string | null
  groupName: string
  linkSource: 'auto' | 'manual' | 'unlinked'
  sessionCount: number
  runningCount: number
  completedCount: number
  failedCount: number
  sessions: CodexSessionSummary[]
  tasks: CodexTaskMonitorSummary[]
  worktrees: CodexWorktree[]
  regularSessionIds: string[]
  regularTaskIds: string[]
  git: CodexGitWorkspaceState
  status: CodexProjectMonitorStatus
  openAlert: CodexUncommittedAlert | null
}

export type CodexProjectMonitorSnapshot = {
  available: boolean
  checkedAt: string
  error: string
  source: string
  projects: CodexProjectMonitorItem[]
  groups: ProjectGroupRecord[]
  alerts: CodexUncommittedAlert[]
  running: number
  uncommitted: number
  unlinked: number
  completed: number
  failed: number
  sessions: CodexSessionSummary[]
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

export type CodexMonitorDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

export type CodexMonitorOptions = {
  db: () => CodexMonitorDatabase
  listProjects: () => MonitorProjectRecord[]
  listGroups: () => ProjectGroupRecord[]
  listSessions: () => Promise<CodexSessionsSnapshot>
  listTasks: () => CodexTaskRecord[]
  now?: () => Date
  inspectGit?: (cwd: string) => Promise<CodexGitWorkspaceState>
  inspectWorktrees?: (cwd: string, now?: Date) => Promise<CodexWorktree[]>
  onAlert?: (alert: CodexUncommittedAlert) => void
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function normalizedPath(value: string): string {
  const trimmed = text(value)
  return trimmed ? resolve(trimmed) : ''
}

export function codexProjectKey(cwd: string): string {
  return normalizedPath(cwd) || '__unknown__'
}

function isPathWithin(parent: string, child: string): boolean {
  const normalizedParent = normalizedPath(parent)
  const normalizedChild = normalizedPath(child)
  if (!normalizedParent || !normalizedChild) return false
  const childRelative = relative(normalizedParent, normalizedChild)
  return childRelative === '' || (childRelative !== '..' && !childRelative.startsWith(`..${requirePathSeparator()}`) && !childRelative.startsWith('/'))
}

function automaticMatchLength(cwd: string, project: MonitorProjectRecord): number {
  return [project.workspacePath, ...(project.repositoryPaths ?? [])]
    .map(normalizedPath)
    .filter((path) => path && isPathWithin(path, cwd))
    .reduce((longest, path) => Math.max(longest, path.length), 0)
}

function requirePathSeparator(): string {
  return process.platform === 'win32' ? '\\' : '/'
}

function mapLinkRow(row: Record<string, unknown>): CodexProjectLink {
  return {
    codexKey: text(row.codex_key),
    cwd: text(row.cwd),
    projectId: text(row.project_id) || null,
    updatedAt: text(row.updated_at)
  }
}

function mapAlertRow(row: Record<string, unknown>): CodexUncommittedAlert {
  const sourceType = text(row.source_type) === 'task' ? 'task' : 'session'
  const status = text(row.status) === 'resolved' ? 'resolved' : 'open'
  return {
    additions: number(row.additions),
    branch: text(row.branch),
    codexKey: text(row.codex_key),
    completedAt: text(row.completed_at),
    completionMarker: text(row.completion_marker),
    cwd: text(row.cwd),
    detectedAt: text(row.detected_at),
    deletions: number(row.deletions),
    filesChanged: number(row.files_changed),
    id: text(row.id),
    notifiedAt: text(row.notified_at) || null,
    projectId: text(row.project_id) || null,
    projectName: text(row.project_name),
    resolvedAt: text(row.resolved_at) || null,
    sourceId: text(row.source_id),
    sourceType,
    status
  }
}

export function migrateCodexProjectMonitorTables(db: CodexMonitorDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS codex_project_links (
      codex_key TEXT PRIMARY KEY,
      cwd TEXT NOT NULL,
      project_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS codex_monitor_alerts (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      completion_marker TEXT NOT NULL,
      codex_key TEXT NOT NULL,
      cwd TEXT NOT NULL,
      project_id TEXT,
      project_name TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT '',
      additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      files_changed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_at TEXT,
      notified_at TEXT,
      UNIQUE(source_type, source_id, completion_marker),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_codex_monitor_alerts_status
      ON codex_monitor_alerts(status, detected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_codex_project_links_project_id
      ON codex_project_links(project_id);
  `)
}

export function listCodexProjectLinks(db: CodexMonitorDatabase): CodexProjectLink[] {
  return (db.prepare('SELECT codex_key, cwd, project_id, updated_at FROM codex_project_links ORDER BY cwd ASC').all() as Array<Record<string, unknown>>).map(mapLinkRow)
}

export function saveCodexProjectLink(db: CodexMonitorDatabase, input: CodexProjectLinkInput): CodexProjectLink {
  const cwd = normalizedPath(input.cwd)
  if (!cwd) throw new Error('Codex 工作目录不能为空')
  const projectId = text(input.projectId) || null
  if (projectId && !db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) throw new Error('项目不存在')

  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO codex_project_links (codex_key, cwd, project_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(codex_key) DO UPDATE SET
      cwd = excluded.cwd,
      project_id = excluded.project_id,
      updated_at = excluded.updated_at
  `).run(codexProjectKey(cwd), cwd, projectId, now)

  return mapLinkRow(db.prepare('SELECT codex_key, cwd, project_id, updated_at FROM codex_project_links WHERE codex_key = ?').get(codexProjectKey(cwd)) as Record<string, unknown>)
}

export function deleteCodexProjectLink(db: CodexMonitorDatabase, cwd: string): void {
  db.prepare('DELETE FROM codex_project_links WHERE codex_key = ?').run(codexProjectKey(cwd))
}

export function listCodexMonitorAlerts(db: CodexMonitorDatabase, status: 'open' | 'resolved' | 'all' = 'open'): CodexUncommittedAlert[] {
  const rows = status === 'all'
    ? db.prepare('SELECT * FROM codex_monitor_alerts ORDER BY detected_at DESC').all()
    : db.prepare('SELECT * FROM codex_monitor_alerts WHERE status = ? ORDER BY detected_at DESC').all(status)
  return (rows as Array<Record<string, unknown>>).map(mapAlertRow)
}

function markAlertNotified(db: CodexMonitorDatabase, alertId: string, now: string): void {
  db.prepare('UPDATE codex_monitor_alerts SET notified_at = ? WHERE id = ? AND notified_at IS NULL').run(now, alertId)
}

function createAlert(db: CodexMonitorDatabase, item: CodexProjectMonitorItem, sourceType: 'session' | 'task', sourceId: string, completedAt: string, marker: string, now: string): CodexUncommittedAlert {
  const id = `codex-alert-${sourceType}-${sourceId}-${marker}`.slice(0, 220)
  db.prepare(`
    INSERT INTO codex_monitor_alerts (
      id, source_type, source_id, completion_marker, codex_key, cwd, project_id, project_name,
      completed_at, detected_at, branch, additions, deletions, files_changed, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    ON CONFLICT(source_type, source_id, completion_marker) DO UPDATE SET
      branch = excluded.branch,
      additions = excluded.additions,
      deletions = excluded.deletions,
      files_changed = excluded.files_changed,
      project_id = excluded.project_id,
      project_name = excluded.project_name
  `).run(id, sourceType, sourceId, marker, item.key, item.cwd, item.forgeProjectId, item.forgeProjectName, completedAt, now, item.git.branch, item.git.additions, item.git.deletions, item.git.filesChanged)
  return mapAlertRow(db.prepare('SELECT * FROM codex_monitor_alerts WHERE source_type = ? AND source_id = ? AND completion_marker = ?').get(sourceType, sourceId, marker) as Record<string, unknown>)
}

function resolveSourceAlerts(db: CodexMonitorDatabase, sourceType: 'session' | 'task', sourceId: string, now: string): void {
  db.prepare(`
    UPDATE codex_monitor_alerts
    SET status = 'resolved', resolved_at = ?
    WHERE source_type = ? AND source_id = ? AND status = 'open'
  `).run(now, sourceType, sourceId)
}

function parseShortStat(value: string): { additions: number; deletions: number; filesChanged: number } {
  const filesChanged = Number(value.match(/(\d+) files? changed/)?.[1] ?? 0)
  const additions = Number(value.match(/(\d+) insertions?\(\+\)/)?.[1] ?? 0)
  const deletions = Number(value.match(/(\d+) deletions?\(-\)/)?.[1] ?? 0)
  return {
    additions: Number.isFinite(additions) ? additions : 0,
    deletions: Number.isFinite(deletions) ? deletions : 0,
    filesChanged: Number.isFinite(filesChanged) ? filesChanged : 0
  }
}

export async function inspectCodexGitWorkspace(cwd: string, now = new Date()): Promise<CodexGitWorkspaceState> {
  const checkedAt = now.toISOString()
  const normalizedCwd = normalizedPath(cwd)
  try {
    const [rootResult, branchResult, statusResult, diffResult] = await Promise.all([
      execFileAsync('git', ['-C', normalizedCwd, 'rev-parse', '--show-toplevel'], { timeout: 5000 }),
      execFileAsync('git', ['-C', normalizedCwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 5000 }),
      execFileAsync('git', ['-C', normalizedCwd, 'status', '--porcelain'], { timeout: 5000 }),
      execFileAsync('git', ['-C', normalizedCwd, 'diff', '--shortstat', 'HEAD'], { timeout: 5000 })
    ])
    const status = statusResult.stdout.trim()
    const shortStat = parseShortStat(diffResult.stdout.trim())
    return {
      additions: shortStat.additions,
      branch: branchResult.stdout.trim() || 'detached',
      checkedAt,
      cwd: normalizedCwd,
      deletions: shortStat.deletions,
      filesChanged: status ? status.split(/\r?\n/).filter(Boolean).length : shortStat.filesChanged,
      hasChanges: Boolean(status),
      repositoryAvailable: true,
      repositoryRoot: rootResult.stdout.trim()
    }
  } catch {
    return {
      additions: 0,
      branch: '',
      checkedAt,
      cwd: normalizedCwd,
      deletions: 0,
      filesChanged: 0,
      hasChanges: false,
      repositoryAvailable: false,
      repositoryRoot: ''
    }
  }
}

export type ParsedWorktree = { path: string; branch: string; head: string; detached: boolean }

export function parseGitWorktreeList(value: string): ParsedWorktree[] {
  const result: ParsedWorktree[] = []
  let current: ParsedWorktree | null = null
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current?.path) result.push(current)
      current = null
      continue
    }
    const [key, ...parts] = line.split(' ')
    const payload = parts.join(' ').trim()
    if (key === 'worktree') {
      if (current?.path) result.push(current)
      current = { branch: '', detached: false, head: '', path: normalizedPath(payload) }
    } else if (current && key === 'HEAD') current.head = payload
    else if (current && key === 'branch') current.branch = payload.replace(/^refs\/heads\//, '')
    else if (current && key === 'detached') current.detached = true
  }
  if (current?.path) result.push(current)
  return result
}

export async function inspectCodexWorktrees(cwd: string, now = new Date()): Promise<CodexWorktree[]> {
  const normalizedCwd = normalizedPath(cwd)
  if (!normalizedCwd) return []
  try {
    const { stdout } = await execFileAsync('git', ['-C', normalizedCwd, 'worktree', 'list', '--porcelain'], { timeout: 5000 })
    const parsed = parseGitWorktreeList(stdout)
    return await Promise.all(parsed.map(async (worktree, index) => ({
      ...worktree,
      branch: worktree.branch || (worktree.detached ? 'detached' : ''),
      git: await inspectCodexGitWorkspace(worktree.path, now),
      isMain: index === 0,
      sessionIds: [],
      taskIds: []
    })))
  } catch {
    return []
  }
}

function taskSummary(task: CodexTaskRecord): CodexTaskMonitorSummary {
  return {
    additions: task.additions,
    branch: task.branch,
    createdAt: task.createdAt,
    cwd: task.cwd,
    deletions: task.deletions,
    errorMessage: task.errorMessage,
    filesChanged: task.filesChanged,
    finishedAt: task.finishedAt,
    id: task.id,
    projectId: task.projectId,
    status: task.status,
    title: task.title,
    updatedAt: task.updatedAt
  }
}

type MutableProject = {
  key: string
  cwd: string
  sessions: CodexSessionSummary[]
  tasks: CodexTaskMonitorSummary[]
}

function resolveProjectBinding(cwd: string, projects: MonitorProjectRecord[], links: Map<string, AiProjectResourceLink>): { project: MonitorProjectRecord | null; source: CodexProjectMonitorItem['linkSource'] } {
  const key = codexProjectKey(cwd)
  const manual = links.get(key)
  if (manual) {
    return {
      project: manual.projectId ? projects.find((project) => project.id === manual.projectId) ?? null : null,
      source: manual.projectId ? 'manual' : 'unlinked'
    }
  }

  const candidates = projects
    .map((project) => ({ project, matchLength: automaticMatchLength(cwd, project) }))
    .filter((candidate) => candidate.matchLength > 0)
    .sort((left, right) => right.matchLength - left.matchLength)
  return { project: candidates[0]?.project ?? null, source: candidates.length > 0 ? 'auto' : 'unlinked' }
}

export function findAutomaticCodexProjectId(cwd: string, projects: MonitorProjectRecord[]): string | undefined {
  return projects
    .map((project) => ({ project, matchLength: automaticMatchLength(cwd, project) }))
    .filter((candidate) => candidate.matchLength > 0)
    .sort((left, right) => right.matchLength - left.matchLength)[0]?.project.id
}

function getGroupName(groupId: string | null, groups: ProjectGroupRecord[]): string {
  return groupId ? groups.find((group) => group.id === groupId)?.name ?? '未分组' : '未分组'
}

export class CodexProjectMonitorService {
  private readonly options: CodexMonitorOptions
  private readonly now: () => Date

  constructor(options: CodexMonitorOptions) {
    this.options = options
    this.now = options.now ?? (() => new Date())
  }

  async snapshot(): Promise<CodexProjectMonitorSnapshot> {
    const checkedAt = this.now().toISOString()
    const [sessionSnapshot, tasks] = await Promise.all([this.options.listSessions(), Promise.resolve(this.options.listTasks())])
    const projects = this.options.listProjects()
    const groups = this.options.listGroups()
    let resourceLinks: AiProjectResourceLink[] = []
    try {
      resourceLinks = listAiProjectResourceLinks(this.options.db(), { providerId: 'codex' })
    } catch {
      // Allows the monitor to keep working while an older test or database is being upgraded.
    }
    // Read historic explicit links as a compatibility fallback. New writes use ai_project_resource_links.
    try {
      for (const legacy of listCodexProjectLinks(this.options.db())) {
        const key = codexProjectKey(legacy.cwd)
        if (!resourceLinks.some((link) => link.resourceKey === key)) {
          resourceLinks.push({
            createdAt: legacy.updatedAt,
            projectId: legacy.projectId || '',
            providerId: 'codex',
            resourceKey: key,
            resourcePath: legacy.cwd,
            updatedAt: legacy.updatedAt
          })
        }
      }
    } catch {
      // The compatibility table is optional for fresh installations.
    }
    const links = new Map(resourceLinks.map((link) => [link.resourceKey, link]))
    const byKey = new Map<string, MutableProject>()

    for (const session of sessionSnapshot.sessions) {
      const key = codexProjectKey(session.cwd)
      const current = byKey.get(key) ?? { cwd: session.cwd, key, sessions: [], tasks: [] }
      current.sessions.push(session)
      byKey.set(key, current)
    }
    for (const task of tasks) {
      const key = codexProjectKey(task.cwd)
      const current = byKey.get(key) ?? { cwd: task.cwd, key, sessions: [], tasks: [] }
      current.tasks.push(taskSummary(task))
      byKey.set(key, current)
    }

    // Keep explicit links visible even before Codex has written its first thread.
    for (const link of resourceLinks) {
      const key = codexProjectKey(link.resourcePath)
      if (!byKey.has(key)) byKey.set(key, { cwd: link.resourcePath, key, sessions: [], tasks: [] })
    }

    const db = this.options.db()
    const items: CodexProjectMonitorItem[] = []
    for (const current of byKey.values()) {
      const binding = resolveProjectBinding(current.cwd, projects, links)
      const explicitProject = current.tasks.find((task) => task.projectId)?.projectId
      const project = explicitProject ? projects.find((candidate) => candidate.id === explicitProject) ?? binding.project : binding.project
      const source = explicitProject && project ? 'manual' : binding.source
      const git = await (this.options.inspectGit ?? inspectCodexGitWorkspace)(current.cwd, this.now())
      const worktrees = await (this.options.inspectWorktrees ?? inspectCodexWorktrees)(current.cwd, this.now())
      const boundWorktree = !project
        ? worktrees.map((worktree) => links.get(codexProjectKey(worktree.path))).find(Boolean)
        : undefined
      const inheritedProject = boundWorktree?.projectId ? projects.find((candidate) => candidate.id === boundWorktree.projectId) ?? null : null
      const resolvedProject = project ?? inheritedProject
      const resolvedSource = project ? source : inheritedProject ? 'manual' : source
      const regularSessionIds: string[] = []
      const regularTaskIds: string[] = []
      const targetWorktree = (cwd: string): CodexWorktree | undefined => worktrees
        .filter((worktree) => isPathWithin(worktree.path, cwd))
        .sort((left, right) => right.path.length - left.path.length)[0]
      for (const session of current.sessions) {
        const worktree = targetWorktree(session.cwd)
        if (worktree) worktree.sessionIds.push(session.id)
        else regularSessionIds.push(session.id)
      }
      for (const task of current.tasks) {
        const worktree = targetWorktree(task.cwd)
        if (worktree) worktree.taskIds.push(task.id)
        else regularTaskIds.push(task.id)
      }
      const terminalSessions = current.sessions.filter((session) => session.status === 'completed' || session.status === 'aborted')
      const terminalTasks = current.tasks.filter((task) => task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled')
      const runningCount = current.sessions.filter((session) => session.status === 'running').length + current.tasks.filter((task) => task.status === 'running').length
      const completedCount = current.sessions.filter((session) => session.status === 'completed').length + current.tasks.filter((task) => task.status === 'succeeded').length
      const failedCount = current.sessions.filter((session) => session.status === 'aborted').length + current.tasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length
      const hasTerminalActivity = terminalSessions.length > 0 || terminalTasks.length > 0
      const forgeProjectId = resolvedProject?.id ?? null
      const item: CodexProjectMonitorItem = {
        completedCount,
        cwd: current.cwd,
        failedCount,
        forgeProjectId,
        forgeProjectName: resolvedProject?.name ?? '',
        groupId: resolvedProject?.groupId ?? null,
        groupName: getGroupName(resolvedProject?.groupId ?? null, groups),
        git,
        key: current.key,
        linkSource: resolvedSource,
        openAlert: null,
        sessionCount: current.sessions.length,
        sessions: current.sessions,
        status: runningCount > 0 ? 'running' : failedCount > 0 ? 'attention' : !git.repositoryAvailable ? 'unknown' : git.hasChanges && hasTerminalActivity ? 'attention' : hasTerminalActivity ? 'completed' : 'clean',
        tasks: current.tasks,
        worktrees,
        regularSessionIds,
        regularTaskIds,
        runningCount
      }

      for (const session of terminalSessions) {
        const marker = `${session.updatedAt}:${session.lastEvent}:${session.status}`
        if (git.repositoryAvailable && git.hasChanges) {
          const alert = createAlert(db, item, 'session', session.id, session.updatedAt, marker, checkedAt)
          if (!alert.notifiedAt) {
            markAlertNotified(db, alert.id, checkedAt)
            this.options.onAlert?.({ ...alert, notifiedAt: checkedAt })
          }
        } else if (git.repositoryAvailable && !git.hasChanges) {
          resolveSourceAlerts(db, 'session', session.id, checkedAt)
        }
      }
      for (const task of terminalTasks) {
        const marker = `${task.finishedAt || task.updatedAt}:${task.status}`
        if (git.repositoryAvailable && git.hasChanges) {
          const alert = createAlert(db, item, 'task', task.id, task.finishedAt || task.updatedAt, marker, checkedAt)
          if (!alert.notifiedAt) {
            markAlertNotified(db, alert.id, checkedAt)
            this.options.onAlert?.({ ...alert, notifiedAt: checkedAt })
          }
        } else if (git.repositoryAvailable && !git.hasChanges) {
          resolveSourceAlerts(db, 'task', task.id, checkedAt)
        }
      }
      items.push(item)
    }

    const alerts = listCodexMonitorAlerts(db, 'open')
    const alertsByKey = new Map<string, CodexUncommittedAlert>()
    for (const alert of alerts) alertsByKey.set(alert.codexKey, alert)
    for (const item of items) item.openAlert = alertsByKey.get(item.key) ?? null
    items.sort((left, right) => Number(Boolean(right.openAlert)) - Number(Boolean(left.openAlert)) || Number(right.runningCount > 0) - Number(left.runningCount > 0) || left.cwd.localeCompare(right.cwd))

    return {
      alerts,
      available: sessionSnapshot.available || tasks.length > 0 || items.length > 0,
      checkedAt,
      completed: items.reduce((total, item) => total + item.completedCount, 0),
      error: sessionSnapshot.error,
      failed: items.reduce((total, item) => total + item.failedCount, 0),
      groups,
      projects: items,
      running: items.reduce((total, item) => total + item.runningCount, 0),
      sessions: sessionSnapshot.sessions,
      source: sessionSnapshot.source,
      uncommitted: alerts.length,
      unlinked: items.filter((item) => !item.forgeProjectId).length
    }
  }
}

export function normalizeCodexMonitorPath(value: string): string {
  return normalizedPath(value)
}

export function codexProjectDisplayName(cwd: string): string {
  return basename(normalizedPath(cwd)) || cwd || '未记录项目'
}
