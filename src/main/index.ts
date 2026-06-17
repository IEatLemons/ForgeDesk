import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import Database from 'better-sqlite3'
import simpleGit from 'simple-git'
import { requestConflictResolutionSuggestion, type ConflictResolutionSuggestion } from './ai-conflict-assistant'
import { getRedactedAiSettings, readAiSettingsFile, writeAiSettingsFile, type AiSettings, type RedactedAiSettings } from './ai-settings'
import { parseControlledGitCommand, validateRepositoryRemoteName } from './git-controls'
import {
  buildGitAddArgs,
  buildGitCommitArgs,
  buildGitMergeArgs,
  buildGitPushArgs,
  parsePorcelainStatus,
  type GitAddInput,
  type GitCommitInput,
  type GitMergeInput,
  type GitPushInput,
  type GitStatusFile
} from './git-workspace'
import { extractConflictSections, type ConflictSection } from './merge-conflicts'
import { readSshConfigFile, writeSshConfigFile, type SshConfigFile } from './ssh-config'
import {
  deleteSshKeyFile,
  fixSshPrivateKeyPermissions,
  importSshKeyFile,
  normalizeSshKeyFileName,
  readSshKeyInventory,
  resolveSshKeyFilePath,
  type SshKeyGenerationInput,
  type SshKeyImportInput,
  type SshPrivateKeyRecord,
  type SshPublicKeyRecord
} from './ssh-keys'

type RepositoryScanResult = {
  id: string
  name: string
  localPath: string
  remoteUrl: string
  remotes: GitRemote[]
  remoteCount: number
  localBranchCount: number
  remoteBranchCount: number
  branches: string[]
  remoteBranches: string[]
  defaultBranch: string
  currentBranch: string
  latestCommit: string
  hasChanges: boolean
  ahead: number
  localUserName: string
  localUserEmail: string
  effectiveUserName: string
  effectiveUserEmail: string
  remoteAlignment: RemoteAlignmentSummary
}

type GitRemote = {
  name: string
  fetchUrl: string
  pushUrl: string
}

type RepositoryRemoteInput = {
  repositoryId: string
  currentName?: string
  name: string
  fetchUrl: string
  pushUrl?: string
}

type GitCommandRequest = {
  repositoryId: string
  command: string
}

type GitCommandResult = {
  ok: boolean
  command: string
  args: string[]
  stdout: string
  stderr: string
  exitCode: number | null
}

type GitConflictFile = {
  path: string
  sections: ConflictSection[]
  content: string
}

type GitWorkspaceStatus = {
  repositoryId: string
  branch: string
  files: GitStatusFile[]
  conflicts: GitConflictFile[]
}

type GitOperationResult = {
  ok: boolean
  repository: RepositoryRecord
  status: GitWorkspaceStatus
  stdout: string
  stderr: string
}

type RemoteAlignmentStatus = 'aligned' | 'diverged' | 'missing-remote' | 'missing-branch' | 'unknown'

type RemoteAlignmentBranchStatus = 'aligned' | 'diverged' | 'missing-branch' | 'unknown'

type RemoteAlignmentBranch = {
  branchName: string
  companyRef: string
  githubRef: string
  companyCommit: string
  githubCommit: string
  companyAhead: number
  githubAhead: number
  status: RemoteAlignmentBranchStatus
}

type RemoteAlignmentSummary = {
  status: RemoteAlignmentStatus
  companyRemoteName: string
  companyRemoteUrl: string
  githubRemoteName: string
  githubRemoteUrl: string
  branchCount: number
  alignedBranchCount: number
  divergedBranchCount: number
  missingBranchCount: number
  currentBranchStatus: RemoteAlignmentBranchStatus | ''
  errorMessage: string
  branches: RemoteAlignmentBranch[]
}

type ProjectRecord = {
  id: string
  name: string
  description: string
  status: 'ready' | 'needs-setup' | 'warning'
  owner: string
  workspacePath: string
  createdAt: string
}

type RepositoryRecord = RepositoryScanResult & {
  projectId: string
}

type ContributorSummary = {
  personId: string
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
}

type GitContributorIdentity = {
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
  mappedPersonId: string
  mappedPersonName: string
}

type DailyGitMetric = {
  date: string
  commits: number
  additions: number
  deletions: number
}

type RepositoryContribution = {
  repositoryId: string
  repositoryName: string
  commits: number
  additions: number
  deletions: number
}

type GitCommitRecord = {
  id: string
  repositoryId: string
  repositoryName: string
  hash: string
  shortHash: string
  parentHashes: string[]
  refs: string[]
  authorName: string
  authorEmail: string
  committedAt: string
  message: string
  branchName: string
  additions: number
  deletions: number
  filesChanged: number
}

type GitCommitFileChange = {
  id: string
  status: string
  path: string
  oldPath: string
  additions: number
  deletions: number
  binary: boolean
}

type GitCommitDiff = {
  commitHash: string
  filePath: string
  oldPath: string
  status: string
  patch: string
  oldContent: string
  newContent: string
  binary: boolean
}

type ProjectPersonRecord = {
  id: string
  projectId: string
  displayName: string
  role: string
  identities: Array<{
    id: string
    name: string
    email: string
  }>
}

type ProjectGitSummary = {
  projectId: string
  status: 'not-analyzed' | 'ready' | 'failed'
  lastAnalyzedAt: string
  errorMessage: string
  totalCommits: number
  contributorCount: number
  totalAdditions: number
  totalDeletions: number
  activeDays: number
  dailyMetrics: DailyGitMetric[]
  contributors: ContributorSummary[]
  repositories: RepositoryContribution[]
}

type WorkspaceSnapshot = {
  projects: ProjectRecord[]
  repositories: RepositoryRecord[]
}

type GitSetupStatus = {
  gitAvailable: boolean
  gitVersion: string
  userName: string
  userEmail: string
  sshPublicKeys: SshPublicKeyRecord[]
  sshPrivateKeys: SshPrivateKeyRecord[]
}

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const sshDirectory = join(homedir(), '.ssh')
let database: Database.Database | null = null

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : '读取远端对齐状态失败'
}

function expandHomePath(path: string): string {
  if (path === '~') {
    return homedir()
  }

  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }

  return path
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolveOutput) => {
    execFile('git', args, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolveOutput('')
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

function runGitStrict(args: string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('git', args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

function runGitInPath(localPath: string, args: string[]): Promise<string> {
  return new Promise((resolveOutput) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolveOutput('')
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

function runGitLog(localPath: string, options: { sinceDate?: string; branchName?: string; allRefs?: boolean } = {}): Promise<string> {
  const args = ['-C', localPath, 'log']

  if (options.sinceDate) {
    args.push(`--since=${options.sinceDate}`)
  }

  if (options.branchName) {
    args.push(options.branchName)
  } else if (options.allRefs) {
    args.push('--all')
  }

  args.push('--date=iso-strict', '--numstat', '--decorate=short', '--pretty=format:__FORGEDESK_COMMIT__%x1f%H%x1f%P%x1f%D%x1f%an%x1f%ae%x1f%aI%x1f%s')

  return new Promise((resolveOutput, reject) => {
    execFile(
      'git',
      args,
      { timeout: 30000, maxBuffer: 1024 * 1024 * 20 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message))
          return
        }

        resolveOutput(stdout)
      }
    )
  })
}

function parseBranchList(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.replace(/^\*\s*/, '').trim())
    .filter(Boolean)
}

function parseRefs(refs: string): string[] {
  return refs
    .split(',')
    .map((ref) => ref.trim())
    .filter(Boolean)
}

function createEmptyRemoteAlignment(status: RemoteAlignmentStatus = 'unknown', errorMessage = ''): RemoteAlignmentSummary {
  return {
    status,
    companyRemoteName: '',
    companyRemoteUrl: '',
    githubRemoteName: '',
    githubRemoteUrl: '',
    branchCount: 0,
    alignedBranchCount: 0,
    divergedBranchCount: 0,
    missingBranchCount: 0,
    currentBranchStatus: '',
    errorMessage,
    branches: []
  }
}

function parseRemoteAlignment(value: unknown): RemoteAlignmentSummary {
  if (!value) {
    return createEmptyRemoteAlignment()
  }

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createEmptyRemoteAlignment()
    }

    const remoteAlignment = parsed as Partial<RemoteAlignmentSummary>
    return {
      ...createEmptyRemoteAlignment(),
      ...remoteAlignment,
      branches: Array.isArray(remoteAlignment.branches) ? remoteAlignment.branches : []
    }
  } catch {
    return createEmptyRemoteAlignment()
  }
}

function getRemoteUrl(remote: GitRemote | undefined): string {
  return remote?.fetchUrl || remote?.pushUrl || ''
}

function isGithubRemoteUrl(remote: GitRemote): boolean {
  return getRemoteUrl(remote).toLowerCase().includes('github.com')
}

function findGithubRemote(remotes: GitRemote[]): GitRemote | undefined {
  return remotes.find((remote) => remote.name === 'github') ?? remotes.find((remote) => remote.name === 'origin' && isGithubRemoteUrl(remote))
}

async function listRepositoryBranches(localPath: string): Promise<{ branches: string[]; remoteBranches: string[] }> {
  const [localBranches, remoteBranches] = await Promise.all([
    runGitInPath(localPath, ['branch', '--format=%(refname:short)']),
    runGitInPath(localPath, ['branch', '-r', '--format=%(refname:short)'])
  ])

  return {
    branches: parseBranchList(localBranches),
    remoteBranches: parseBranchList(remoteBranches).filter((branch) => !branch.includes('HEAD ->'))
  }
}

async function listRemoteBranchRefs(localPath: string, remoteName: string): Promise<Map<string, string>> {
  const output = await runGitInPath(localPath, ['for-each-ref', '--format=%(refname:short)%00%(objectname)', `refs/remotes/${remoteName}`])
  const refs = new Map<string, string>()
  const remotePrefix = `${remoteName}/`

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const [refName, commitHash] = line.split('\0')

    if (!refName || !commitHash || refName.endsWith('/HEAD') || !refName.startsWith(remotePrefix)) {
      continue
    }

    refs.set(refName.slice(remotePrefix.length), commitHash)
  }

  return refs
}

async function countExclusiveCommits(localPath: string, baseCommit: string, headCommit: string): Promise<number> {
  const output = await runGitInPathOptional(localPath, ['rev-list', '--count', `${baseCommit}..${headCommit}`])
  const count = Number(output.trim())
  return Number.isFinite(count) ? count : 0
}

function sortAlignmentBranches(branches: RemoteAlignmentBranch[], currentBranch: string, defaultBranch: string): RemoteAlignmentBranch[] {
  return [...branches].sort((a, b) => {
    if (a.branchName === currentBranch) {
      return -1
    }

    if (b.branchName === currentBranch) {
      return 1
    }

    if (a.branchName === defaultBranch) {
      return -1
    }

    if (b.branchName === defaultBranch) {
      return 1
    }

    return a.branchName.localeCompare(b.branchName)
  })
}

async function inspectRemoteAlignment(
  localPath: string,
  remotes: GitRemote[],
  currentBranch: string,
  defaultBranch: string
): Promise<RemoteAlignmentSummary> {
  const companyRemote = remotes.find((remote) => remote.name === 'company')
  const githubRemote = findGithubRemote(remotes)
  const summary = createEmptyRemoteAlignment()
  summary.companyRemoteName = companyRemote?.name ?? 'company'
  summary.companyRemoteUrl = getRemoteUrl(companyRemote)
  summary.githubRemoteName = githubRemote?.name ?? ''
  summary.githubRemoteUrl = getRemoteUrl(githubRemote)

  if (!companyRemote || !githubRemote) {
    const missingRemotes = [
      !companyRemote ? 'company 内部 Gitea' : '',
      !githubRemote ? 'GitHub CI/CD' : ''
    ].filter(Boolean)

    return {
      ...summary,
      status: 'missing-remote',
      errorMessage: `缺少 ${missingRemotes.join('、')} 远端`
    }
  }

  try {
    const [companyRefs, githubRefs] = await Promise.all([
      listRemoteBranchRefs(localPath, companyRemote.name),
      listRemoteBranchRefs(localPath, githubRemote.name)
    ])
    const branchNames = Array.from(new Set([...companyRefs.keys(), ...githubRefs.keys()]))

    if (branchNames.length === 0) {
      return {
        ...summary,
        status: 'unknown',
        errorMessage: '没有本地远端引用，请先同步远端'
      }
    }

    const branches = await Promise.all(
      branchNames.map(async (branchName): Promise<RemoteAlignmentBranch> => {
        const companyCommit = companyRefs.get(branchName) ?? ''
        const githubCommit = githubRefs.get(branchName) ?? ''
        const hasBothCommits = Boolean(companyCommit && githubCommit)
        const status: RemoteAlignmentBranchStatus = !hasBothCommits ? 'missing-branch' : companyCommit === githubCommit ? 'aligned' : 'diverged'
        const [companyAhead, githubAhead] = hasBothCommits && companyCommit !== githubCommit
          ? await Promise.all([
              countExclusiveCommits(localPath, githubCommit, companyCommit),
              countExclusiveCommits(localPath, companyCommit, githubCommit)
            ])
          : [0, 0]

        return {
          branchName,
          companyRef: `${companyRemote.name}/${branchName}`,
          githubRef: `${githubRemote.name}/${branchName}`,
          companyCommit,
          githubCommit,
          companyAhead,
          githubAhead,
          status
        }
      })
    )
    const sortedBranches = sortAlignmentBranches(branches, currentBranch, defaultBranch)
    const alignedBranchCount = sortedBranches.filter((branch) => branch.status === 'aligned').length
    const divergedBranchCount = sortedBranches.filter((branch) => branch.status === 'diverged').length
    const missingBranchCount = sortedBranches.filter((branch) => branch.status === 'missing-branch').length
    const currentBranchStatus = sortedBranches.find((branch) => branch.branchName === currentBranch)?.status ?? ''
    const status: RemoteAlignmentStatus = missingBranchCount > 0 ? 'missing-branch' : divergedBranchCount > 0 ? 'diverged' : 'aligned'

    return {
      ...summary,
      status,
      branchCount: sortedBranches.length,
      alignedBranchCount,
      divergedBranchCount,
      missingBranchCount,
      currentBranchStatus,
      branches: sortedBranches
    }
  } catch (error) {
    return {
      ...summary,
      status: 'unknown',
      errorMessage: getErrorText(error)
    }
  }
}

function getDatabase(): Database.Database {
  if (database) {
    return database
  }

  const databasePath = join(app.getPath('userData'), 'forgedesk.db')
  database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  migrateDatabase(database)
  return database
}

function migrateDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready',
      owner TEXT NOT NULL DEFAULT '',
      workspace_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      local_path TEXT NOT NULL,
      remote_url TEXT NOT NULL DEFAULT '',
      remotes_json TEXT NOT NULL DEFAULT '[]',
      remote_count INTEGER NOT NULL DEFAULT 0,
      local_branch_count INTEGER NOT NULL DEFAULT 0,
      remote_branch_count INTEGER NOT NULL DEFAULT 0,
      branches_json TEXT NOT NULL DEFAULT '[]',
      remote_branches_json TEXT NOT NULL DEFAULT '[]',
      remote_alignment_json TEXT NOT NULL DEFAULT '{}',
      default_branch TEXT NOT NULL DEFAULT '',
      current_branch TEXT NOT NULL DEFAULT '',
      latest_commit TEXT NOT NULL DEFAULT '',
      has_changes INTEGER NOT NULL DEFAULT 0,
      ahead INTEGER NOT NULL DEFAULT 0,
      local_user_name TEXT NOT NULL DEFAULT '',
      local_user_email TEXT NOT NULL DEFAULT '',
      effective_user_name TEXT NOT NULL DEFAULT '',
      effective_user_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS git_commits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      hash TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      message TEXT NOT NULL,
      branch_name TEXT NOT NULL DEFAULT '',
      additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      files_changed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      project_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_analyzed_at TEXT NOT NULL,
      error_message TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      git_identities TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_people (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_person_identities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      git_name TEXT NOT NULL DEFAULT '',
      git_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES project_people(id) ON DELETE CASCADE
    );
  `)

  addColumnIfMissing(db, 'repositories', 'remotes_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'local_branch_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'remote_branch_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'branches_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_branches_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_alignment_json', "TEXT NOT NULL DEFAULT '{}'")
  addColumnIfMissing(db, 'git_commits', 'branch_name', "TEXT NOT NULL DEFAULT ''")
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>

  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
  }
}

function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (!value) {
    return fallback
  }

  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function createProjectId(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}-${Date.now()}`
}

function mapProjectRow(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    status: (String(row.status) as ProjectRecord['status']) || 'ready',
    owner: String(row.owner ?? ''),
    workspacePath: String(row.workspace_path ?? ''),
    createdAt: String(row.created_at)
  }
}

function mapRepositoryRow(row: Record<string, unknown>): RepositoryRecord {
  const remotes = parseJsonArray<GitRemote>(row.remotes_json)
  const branches = parseJsonArray<string>(row.branches_json)
  const remoteBranches = parseJsonArray<string>(row.remote_branches_json)
  const remoteAlignment = parseRemoteAlignment(row.remote_alignment_json)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    localPath: String(row.local_path),
    remoteUrl: String(row.remote_url ?? ''),
    remotes,
    remoteCount: Number(row.remote_count ?? remotes.length),
    localBranchCount: Number(row.local_branch_count ?? branches.length),
    remoteBranchCount: Number(row.remote_branch_count ?? remoteBranches.length),
    branches,
    remoteBranches,
    defaultBranch: String(row.default_branch ?? ''),
    currentBranch: String(row.current_branch ?? ''),
    latestCommit: String(row.latest_commit ?? ''),
    hasChanges: Boolean(row.has_changes),
    ahead: Number(row.ahead ?? 0),
    localUserName: String(row.local_user_name ?? ''),
    localUserEmail: String(row.local_user_email ?? ''),
    effectiveUserName: String(row.effective_user_name ?? ''),
    effectiveUserEmail: String(row.effective_user_email ?? ''),
    remoteAlignment
  }
}

function listProjects(): ProjectRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM projects ORDER BY created_at DESC')
    .all()
    .map((row) => mapProjectRow(row as Record<string, unknown>))
}

function listRepositories(projectId?: string): RepositoryRecord[] {
  const statement = projectId
    ? getDatabase().prepare('SELECT * FROM repositories WHERE project_id = ? ORDER BY name ASC')
    : getDatabase().prepare('SELECT * FROM repositories ORDER BY name ASC')
  const rows = projectId ? statement.all(projectId) : statement.all()
  return rows.map((row) => mapRepositoryRow(row as Record<string, unknown>))
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function identityKey(name: string, email: string): string {
  return `${name.trim().toLowerCase()} <${email.trim().toLowerCase()}>`
}

function emailIdentityKey(email: string): string {
  return email.trim().toLowerCase()
}

function nameIdentityKey(name: string): string {
  return name.trim().toLowerCase()
}

function listProjectPeople(projectId: string): ProjectPersonRecord[] {
  const db = getDatabase()
  normalizeProjectPeople(projectId)
  const people = db.prepare('SELECT * FROM project_people WHERE project_id = ? ORDER BY display_name ASC').all(projectId) as Array<Record<string, unknown>>
  const identities = db.prepare('SELECT * FROM project_person_identities WHERE project_id = ? ORDER BY git_name ASC, git_email ASC').all(projectId) as Array<Record<string, unknown>>
  const identityGroups = new Map<string, ProjectPersonRecord['identities']>()

  for (const identity of identities) {
    const personId = String(identity.person_id)
    const current = identityGroups.get(personId) ?? []
    current.push({
      id: String(identity.id),
      name: String(identity.git_name ?? ''),
      email: String(identity.git_email ?? '')
    })
    identityGroups.set(personId, current)
  }

  return people.map((person) => ({
    id: String(person.id),
    projectId: String(person.project_id),
    displayName: String(person.display_name ?? ''),
    role: String(person.role ?? ''),
    identities: identityGroups.get(String(person.id)) ?? []
  }))
}

function normalizeProjectPeople(projectId: string): void {
  const db = getDatabase()
  const people = db.prepare('SELECT * FROM project_people WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as Array<Record<string, unknown>>
  const displayNames = new Set(people.map((person) => String(person.display_name ?? '').trim()).filter(Boolean))
  const roleCounts = new Map<string, number>()

  for (const person of people) {
    const role = String(person.role ?? '').trim()

    if (role) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
    }
  }

  const mergeGroups = new Map<string, Array<Record<string, unknown>>>()

  for (const person of people) {
    const role = String(person.role ?? '').trim()

    if (!role) {
      continue
    }

    if ((roleCounts.get(role) ?? 0) > 1 || displayNames.has(role)) {
      const group = mergeGroups.get(role) ?? []
      group.push(person)
      mergeGroups.set(role, group)
    }
  }

  if (mergeGroups.size === 0) {
    return
  }

  const now = new Date().toISOString()
  db.transaction(() => {
    for (const [displayName, group] of mergeGroups) {
      const existingTarget = people.find((person) => String(person.display_name ?? '').trim() === displayName)
      const target = existingTarget ?? group[0]
      const targetId = String(target.id)

      db.prepare('UPDATE project_people SET display_name = ?, role = ?, updated_at = ? WHERE id = ?').run(displayName, '', now, targetId)

      for (const person of group) {
        const personId = String(person.id)

        if (personId === targetId) {
          continue
        }

        db.prepare('UPDATE project_person_identities SET person_id = ?, updated_at = ? WHERE person_id = ?').run(targetId, now, personId)
        db.prepare('DELETE FROM project_people WHERE id = ?').run(personId)
      }
    }
  })()
}

function saveProjectPerson(input: {
  id?: string
  projectId: string
  displayName: string
  role?: string
  identities: Array<{ name: string; email: string }>
}): ProjectPersonRecord {
  const displayName = input.displayName.trim()

  if (!displayName) {
    throw new Error('请输入人员名称')
  }

  const project = getDatabase().prepare('SELECT id FROM projects WHERE id = ?').get(input.projectId)

  if (!project) {
    throw new Error('项目不存在')
  }

  const now = new Date().toISOString()
  const personId = input.id || createId('person')
  const identitiesByKey = new Map<string, { name: string; email: string }>()

  for (const identity of input.identities
    .map((identity) => ({ name: identity.name.trim(), email: identity.email.trim() }))
    .filter((identity) => identity.name || identity.email)) {
    identitiesByKey.set(identityKey(identity.name, identity.email), identity)
  }

  const identities = Array.from(identitiesByKey.values())

  getDatabase()
    .transaction(() => {
      getDatabase()
        .prepare(
          `
          INSERT INTO project_people (id, project_id, display_name, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            role = excluded.role,
            updated_at = excluded.updated_at
        `
        )
        .run(personId, input.projectId, displayName, input.role?.trim() ?? '', now, now)

      getDatabase().prepare('DELETE FROM project_person_identities WHERE person_id = ?').run(personId)
      const insertIdentity = getDatabase().prepare(`
        INSERT INTO project_person_identities (id, project_id, person_id, git_name, git_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const identity of identities) {
        insertIdentity.run(createId('identity'), input.projectId, personId, identity.name, identity.email, now, now)
      }
    })()

  const person = listProjectPeople(input.projectId).find((item) => item.id === personId)

  if (!person) {
    throw new Error('人员映射保存失败')
  }

  return person
}

function deleteProjectPerson(projectId: string, personId: string): ProjectPersonRecord[] {
  getDatabase().prepare('DELETE FROM project_people WHERE project_id = ? AND id = ?').run(projectId, personId)
  return listProjectPeople(projectId)
}

function getWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    projects: listProjects(),
    repositories: listRepositories()
  }
}

function upsertRepository(projectId: string, repository: RepositoryScanResult): RepositoryRecord {
  const now = new Date().toISOString()
  getDatabase()
    .prepare(
      `
      INSERT INTO repositories (
        id, project_id, name, local_path, remote_url, remotes_json, remote_count, local_branch_count,
        remote_branch_count, branches_json, remote_branches_json, remote_alignment_json, default_branch, current_branch, latest_commit,
        has_changes, ahead, local_user_name, local_user_email, effective_user_name, effective_user_email,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        name = excluded.name,
        local_path = excluded.local_path,
        remote_url = excluded.remote_url,
        remotes_json = excluded.remotes_json,
        remote_count = excluded.remote_count,
        local_branch_count = excluded.local_branch_count,
        remote_branch_count = excluded.remote_branch_count,
        branches_json = excluded.branches_json,
        remote_branches_json = excluded.remote_branches_json,
        remote_alignment_json = excluded.remote_alignment_json,
        default_branch = excluded.default_branch,
        current_branch = excluded.current_branch,
        latest_commit = excluded.latest_commit,
        has_changes = excluded.has_changes,
        ahead = excluded.ahead,
        local_user_name = excluded.local_user_name,
        local_user_email = excluded.local_user_email,
        effective_user_name = excluded.effective_user_name,
        effective_user_email = excluded.effective_user_email,
        updated_at = excluded.updated_at
    `
    )
    .run(
      repository.id,
      projectId,
      repository.name,
      repository.localPath,
      repository.remoteUrl,
      JSON.stringify(repository.remotes),
      repository.remoteCount,
      repository.localBranchCount,
      repository.remoteBranchCount,
      JSON.stringify(repository.branches),
      JSON.stringify(repository.remoteBranches),
      JSON.stringify(repository.remoteAlignment),
      repository.defaultBranch,
      repository.currentBranch,
      repository.latestCommit,
      repository.hasChanges ? 1 : 0,
      repository.ahead,
      repository.localUserName,
      repository.localUserEmail,
      repository.effectiveUserName,
      repository.effectiveUserEmail,
      now,
      now
    )

  return { ...repository, projectId }
}

function runGitInPathStrict(localPath: string, args: string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

function runGitInPathOptional(localPath: string, args: string[]): Promise<string> {
  return new Promise((resolveOutput) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout) => {
      if (error) {
        resolveOutput('')
        return
      }

      resolveOutput(stdout)
    })
  })
}

function runGitInPathResult(localPath: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolveResult) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      const exitCode = typeof error?.code === 'number' ? error.code : error ? null : 0

      resolveResult({
        ok: !error,
        command: `git ${args.join(' ')}`,
        args,
        stdout: stdout.trimEnd(),
        stderr: (stderr || error?.message || '').trimEnd(),
        exitCode
      })
    })
  })
}

function runSshKeygen(args: string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('ssh-keygen', args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

async function findAvailableSshKeyPath(): Promise<string> {
  const candidates = ['id_ed25519', 'id_ed25519_forgedesk']

  for (const candidate of candidates) {
    const path = join(sshDirectory, candidate)

    if (!existsSync(path) && !existsSync(`${path}.pub`)) {
      return path
    }
  }

  let index = 2

  while (true) {
    const path = join(sshDirectory, `id_ed25519_forgedesk_${index}`)

    if (!existsSync(path) && !existsSync(`${path}.pub`)) {
      return path
    }

    index += 1
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'ForgeDesk',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function scanRepository(localPath: string): Promise<RepositoryScanResult | null> {
  const normalizedPath = resolve(expandHomePath(localPath))

  if (!existsSync(join(normalizedPath, '.git'))) {
    return null
  }

  const git = simpleGit(normalizedPath)
  const [status, log, gitRemotes, branchInfo, localUserName, localUserEmail, effectiveUserName, effectiveUserEmail] = await Promise.all([
    git.status(),
    git.log({ maxCount: 1 }),
    git.getRemotes(true),
    listRepositoryBranches(normalizedPath),
    runGitInPath(normalizedPath, ['config', '--local', 'user.name']),
    runGitInPath(normalizedPath, ['config', '--local', 'user.email']),
    runGitInPath(normalizedPath, ['config', 'user.name']),
    runGitInPath(normalizedPath, ['config', 'user.email'])
  ])
  const latest = log.latest
  const remotes = gitRemotes.map((remote) => ({
    name: remote.name,
    fetchUrl: remote.refs.fetch ?? '',
    pushUrl: remote.refs.push ?? ''
  }))
  const origin = remotes.find((remote) => remote.name === 'origin') ?? remotes[0]
  const currentBranch = status.current ?? 'detached'
  const defaultBranch = status.tracking ? status.tracking.replace(/^[^/]+\//, '') : currentBranch
  const remoteAlignment = await inspectRemoteAlignment(normalizedPath, remotes, currentBranch, defaultBranch)

  return {
    id: normalizedPath,
    name: basename(normalizedPath),
    localPath: normalizedPath,
    remoteUrl: origin?.fetchUrl ?? origin?.pushUrl ?? '',
    remotes,
    remoteCount: remotes.length,
    localBranchCount: branchInfo.branches.length,
    remoteBranchCount: branchInfo.remoteBranches.length,
    branches: branchInfo.branches,
    remoteBranches: branchInfo.remoteBranches,
    defaultBranch,
    currentBranch,
    latestCommit: latest ? `${latest.hash.slice(0, 7)} ${latest.message}` : 'No commits yet',
    hasChanges: status.files.length > 0,
    ahead: status.ahead,
    localUserName,
    localUserEmail,
    effectiveUserName,
    effectiveUserEmail,
    remoteAlignment
  }
}

type ParsedGitCommit = {
  hash: string
  parentHashes: string[]
  refs: string[]
  authorName: string
  authorEmail: string
  committedAt: string
  message: string
  branchName: string
  additions: number
  deletions: number
  filesChanged: number
}

function parseGitLog(output: string): ParsedGitCommit[] {
  const commits: ParsedGitCommit[] = []
  let current: ParsedGitCommit | null = null

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('__FORGEDESK_COMMIT__')) {
      if (current) {
        commits.push(current)
      }

      const [, hash, parents, refs, authorName, authorEmail, committedAt, message] = line.replace('__FORGEDESK_COMMIT__', '').split('\u001f')
      current = {
        hash: hash ?? '',
        parentHashes: parents ? parents.split(' ').filter(Boolean) : [],
        refs: parseRefs(refs ?? ''),
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        committedAt: committedAt ?? '',
        message: message ?? '',
        branchName: '',
        additions: 0,
        deletions: 0,
        filesChanged: 0
      }
      continue
    }

    if (!current || !line.trim()) {
      continue
    }

    const [additions, deletions] = line.split('\t')
    current.filesChanged += 1

    if (additions !== '-' && deletions !== '-') {
      current.additions += Number(additions) || 0
      current.deletions += Number(deletions) || 0
    }
  }

  if (current) {
    commits.push(current)
  }

  return commits.filter((commit) => commit.hash)
}

function emptyProjectSummary(projectId: string, status: ProjectGitSummary['status'] = 'not-analyzed', errorMessage = ''): ProjectGitSummary {
  return {
    projectId,
    status,
    lastAnalyzedAt: '',
    errorMessage,
    totalCommits: 0,
    contributorCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    activeDays: 0,
    dailyMetrics: [],
    contributors: [],
    repositories: []
  }
}

function getProjectSummary(projectId: string, range?: { startDate?: string; endDate?: string }): ProjectGitSummary {
  const db = getDatabase()
  const run = db.prepare('SELECT * FROM analysis_runs WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined
  const conditions = ['c.project_id = ?']
  const params: unknown[] = [projectId]

  if (range?.startDate) {
    conditions.push('c.committed_at >= ?')
    params.push(`${range.startDate}T00:00:00.000Z`)
  }

  if (range?.endDate) {
    conditions.push('c.committed_at <= ?')
    params.push(`${range.endDate}T23:59:59.999Z`)
  }

  const commits = db
    .prepare(
      `
      SELECT c.*, r.name AS repository_name
      FROM git_commits c
      LEFT JOIN repositories r ON r.id = c.repository_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.committed_at ASC
    `
    )
    .all(...params) as Array<Record<string, unknown>>

  if (!run && commits.length === 0) {
    return emptyProjectSummary(projectId)
  }

  const daily = new Map<string, DailyGitMetric>()
  const contributors = new Map<string, ContributorSummary & { days: Set<string> }>()
  const repositoryContributions = new Map<string, RepositoryContribution>()
  const people = listProjectPeople(projectId)
  const peopleByIdentity = new Map<string, ProjectPersonRecord>()
  const peopleByEmail = new Map<string, ProjectPersonRecord>()
  const peopleByName = new Map<string, ProjectPersonRecord>()
  const activeDays = new Set<string>()

  for (const person of people) {
    for (const identity of person.identities) {
      peopleByIdentity.set(identityKey(identity.name, identity.email), person)
      if (identity.email) {
        peopleByEmail.set(emailIdentityKey(identity.email), person)
      }
      if (identity.name && !identity.email) {
        peopleByName.set(nameIdentityKey(identity.name), person)
      }
    }
  }

  for (const commit of commits) {
    const date = String(commit.committed_at).slice(0, 10)
    const additions = Number(commit.additions ?? 0)
    const deletions = Number(commit.deletions ?? 0)
    const filesChanged = Number(commit.files_changed ?? 0)
    const email = String(commit.author_email ?? '')
    const authorName = String(commit.author_name ?? '')
    const mappedPerson = peopleByIdentity.get(identityKey(authorName, email)) ?? (email ? peopleByEmail.get(emailIdentityKey(email)) : undefined) ?? peopleByName.get(nameIdentityKey(authorName))
    const contributorKey = mappedPerson?.id ?? (email || authorName)
    const repositoryId = String(commit.repository_id)

    activeDays.add(date)

    const dayMetric = daily.get(date) ?? { date, commits: 0, additions: 0, deletions: 0 }
    dayMetric.commits += 1
    dayMetric.additions += additions
    dayMetric.deletions += deletions
    daily.set(date, dayMetric)

    const contributor = contributors.get(contributorKey) ?? {
      personId: mappedPerson?.id ?? '',
      name: mappedPerson?.displayName ?? authorName,
      email: mappedPerson ? mappedPerson.identities.find((identity) => identity.email)?.email ?? email : email,
      commits: 0,
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      activeDays: 0,
      days: new Set<string>()
    }
    contributor.commits += 1
    contributor.additions += additions
    contributor.deletions += deletions
    contributor.filesChanged += filesChanged
    contributor.days.add(date)
    contributor.activeDays = contributor.days.size
    contributors.set(contributorKey, contributor)

    const repository = repositoryContributions.get(repositoryId) ?? {
      repositoryId,
      repositoryName: String(commit.repository_name ?? basename(repositoryId)),
      commits: 0,
      additions: 0,
      deletions: 0
    }
    repository.commits += 1
    repository.additions += additions
    repository.deletions += deletions
    repositoryContributions.set(repositoryId, repository)
  }

  return {
    projectId,
    status: ((run?.status as ProjectGitSummary['status'] | undefined) ?? 'ready') || 'ready',
    lastAnalyzedAt: String(run?.last_analyzed_at ?? ''),
    errorMessage: String(run?.error_message ?? ''),
    totalCommits: commits.length,
    contributorCount: contributors.size,
    totalAdditions: commits.reduce((sum, commit) => sum + Number(commit.additions ?? 0), 0),
    totalDeletions: commits.reduce((sum, commit) => sum + Number(commit.deletions ?? 0), 0),
    activeDays: activeDays.size,
    dailyMetrics: Array.from(daily.values()),
    contributors: Array.from(contributors.values())
      .map(({ days: _days, ...contributor }) => contributor)
      .sort((a, b) => b.commits - a.commits || b.additions + b.deletions - (a.additions + a.deletions)),
    repositories: Array.from(repositoryContributions.values()).sort((a, b) => b.commits - a.commits)
  }
}

function listProjectContributorIdentities(projectId: string): GitContributorIdentity[] {
  const db = getDatabase()
  const commits = db
    .prepare(
      `
      SELECT author_name, author_email, additions, deletions, files_changed, committed_at
      FROM git_commits
      WHERE project_id = ?
      ORDER BY author_name ASC, author_email ASC
    `
    )
    .all(projectId) as Array<Record<string, unknown>>
  const people = listProjectPeople(projectId)
  const peopleByIdentity = new Map<string, ProjectPersonRecord>()
  const peopleByEmail = new Map<string, ProjectPersonRecord>()
  const peopleByName = new Map<string, ProjectPersonRecord>()
  const identities = new Map<string, GitContributorIdentity & { days: Set<string> }>()

  for (const person of people) {
    for (const identity of person.identities) {
      peopleByIdentity.set(identityKey(identity.name, identity.email), person)
      if (identity.email) {
        peopleByEmail.set(emailIdentityKey(identity.email), person)
      }
      if (identity.name && !identity.email) {
        peopleByName.set(nameIdentityKey(identity.name), person)
      }
    }
  }

  for (const commit of commits) {
    const name = String(commit.author_name ?? '')
    const email = String(commit.author_email ?? '')
    const key = identityKey(name, email)
    const mappedPerson = peopleByIdentity.get(key) ?? (email ? peopleByEmail.get(emailIdentityKey(email)) : undefined) ?? peopleByName.get(nameIdentityKey(name))
    const current = identities.get(key) ?? {
      name,
      email,
      commits: 0,
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      activeDays: 0,
      mappedPersonId: mappedPerson?.id ?? '',
      mappedPersonName: mappedPerson?.displayName ?? '',
      days: new Set<string>()
    }

    current.commits += 1
    current.additions += Number(commit.additions ?? 0)
    current.deletions += Number(commit.deletions ?? 0)
    current.filesChanged += Number(commit.files_changed ?? 0)
    current.days.add(String(commit.committed_at).slice(0, 10))
    current.activeDays = current.days.size
    current.mappedPersonId = mappedPerson?.id ?? current.mappedPersonId
    current.mappedPersonName = mappedPerson?.displayName ?? current.mappedPersonName
    identities.set(key, current)
  }

  return Array.from(identities.values())
    .map(({ days: _days, ...identity }) => identity)
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name))
}

function mapCommitRecord(commit: ParsedGitCommit & { repositoryId: string; repositoryName: string; branchName: string }): GitCommitRecord {
  return {
    id: `${commit.repositoryId}:${commit.hash}`,
    repositoryId: commit.repositoryId,
    repositoryName: commit.repositoryName,
    hash: commit.hash,
    shortHash: commit.hash.slice(0, 7),
    parentHashes: commit.parentHashes,
    refs: commit.refs,
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    committedAt: commit.committedAt,
    message: commit.message,
    branchName: commit.branchName,
    additions: commit.additions,
    deletions: commit.deletions,
    filesChanged: commit.filesChanged
  }
}

async function getCommitBaseRef(localPath: string, commitHash: string): Promise<string> {
  const parentsLine = await runGitInPathOptional(localPath, ['rev-list', '--parents', '-n', '1', commitHash])
  const [, firstParent] = parentsLine.trim().split(/\s+/)
  return firstParent || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
}

function parseNumstat(output: string): Map<string, { additions: number; deletions: number; binary: boolean }> {
  const stats = new Map<string, { additions: number; deletions: number; binary: boolean }>()

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const [additions, deletions, ...paths] = line.split('\t')
    const path = paths[paths.length - 1] ?? ''

    if (!path) {
      continue
    }

    stats.set(path, {
      additions: additions === '-' ? 0 : Number(additions) || 0,
      deletions: deletions === '-' ? 0 : Number(deletions) || 0,
      binary: additions === '-' || deletions === '-'
    })
  }

  return stats
}

async function listRepositoryCommitFiles(repositoryId: string, commitHash: string): Promise<GitCommitFileChange[]> {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  const baseRef = await getCommitBaseRef(repository.localPath, commitHash)
  const [nameStatusOutput, numstatOutput] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['diff', '--name-status', '-M', baseRef, commitHash]),
    runGitInPathStrict(repository.localPath, ['diff', '--numstat', '-M', baseRef, commitHash])
  ])
  const stats = parseNumstat(numstatOutput)

  return nameStatusOutput
    .split(/\r?\n/)
    .map((line): GitCommitFileChange | null => {
      if (!line.trim()) {
        return null
      }

      const [rawStatus, firstPath, secondPath] = line.split('\t')
      const status = rawStatus.charAt(0)
      const path = secondPath || firstPath || ''
      const oldPath = secondPath ? firstPath : ''
      const stat = stats.get(path) ?? stats.get(firstPath ?? '') ?? { additions: 0, deletions: 0, binary: false }

      return {
        id: `${commitHash}:${path}:${oldPath}`,
        status,
        path,
        oldPath,
        additions: stat.additions,
        deletions: stat.deletions,
        binary: stat.binary
      }
    })
    .filter((change): change is GitCommitFileChange => Boolean(change))
}

async function getRepositoryCommitDiff(repositoryId: string, commitHash: string, filePath: string, oldPath = '', status = ''): Promise<GitCommitDiff> {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  const baseRef = await getCommitBaseRef(repository.localPath, commitHash)
  const patch = await runGitInPathOptional(repository.localPath, ['diff', '--find-renames', baseRef, commitHash, '--', oldPath || filePath, filePath])
  const [oldContent, newContent] = await Promise.all([
    oldPath || status !== 'A' ? runGitInPathOptional(repository.localPath, ['show', `${baseRef}:${oldPath || filePath}`]) : Promise.resolve(''),
    status !== 'D' ? runGitInPathOptional(repository.localPath, ['show', `${commitHash}:${filePath}`]) : Promise.resolve('')
  ])

  return {
    commitHash,
    filePath,
    oldPath,
    status,
    patch,
    oldContent,
    newContent,
    binary: patch.includes('Binary files') || (!oldContent && !newContent && Boolean(filePath))
  }
}

function getRepositoryOrThrow(repositoryId: string): RepositoryRecord {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  if (!existsSync(join(repository.localPath, '.git'))) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return repository
}

async function rescanRepositoryRecord(repository: RepositoryRecord): Promise<RepositoryRecord> {
  const scanned = await scanRepository(repository.localPath)

  if (!scanned) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return upsertRepository(repository.projectId, scanned)
}

async function listGitRemoteNames(localPath: string): Promise<string[]> {
  return parseBranchList(await runGitInPathStrict(localPath, ['remote']))
}

function normalizeRemoteUrl(value: string, fieldName: string): string {
  const url = value.trim()

  if (!url) {
    throw new Error(`请输入${fieldName}`)
  }

  return url
}

async function saveRepositoryRemote(input: RepositoryRemoteInput): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(input.repositoryId)
  const currentName = input.currentName ? validateRepositoryRemoteName(input.currentName) : ''
  const nextName = validateRepositoryRemoteName(input.name)
  const fetchUrl = normalizeRemoteUrl(input.fetchUrl, 'Fetch URL')
  const pushUrl = normalizeRemoteUrl(input.pushUrl || input.fetchUrl, 'Push URL')
  const remoteNames = await listGitRemoteNames(repository.localPath)

  if (currentName && !remoteNames.includes(currentName)) {
    throw new Error(`远端 ${currentName} 不存在`)
  }

  if (!currentName && remoteNames.includes(nextName)) {
    throw new Error(`远端 ${nextName} 已存在`)
  }

  if (currentName && currentName !== nextName && remoteNames.includes(nextName)) {
    throw new Error(`远端 ${nextName} 已存在`)
  }

  if (!currentName) {
    await runGitInPathStrict(repository.localPath, ['remote', 'add', nextName, fetchUrl])
  } else if (currentName !== nextName) {
    await runGitInPathStrict(repository.localPath, ['remote', 'rename', currentName, nextName])
  }

  await runGitInPathStrict(repository.localPath, ['remote', 'set-url', nextName, fetchUrl])
  await runGitInPathStrict(repository.localPath, ['remote', 'set-url', '--push', nextName, pushUrl])

  return rescanRepositoryRecord(repository)
}

async function deleteRepositoryRemote(repositoryId: string, remoteName: string): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(repositoryId)
  const name = validateRepositoryRemoteName(remoteName)
  const remoteNames = await listGitRemoteNames(repository.localPath)

  if (!remoteNames.includes(name)) {
    throw new Error(`远端 ${name} 不存在`)
  }

  await runGitInPathStrict(repository.localPath, ['remote', 'remove', name])
  return rescanRepositoryRecord(repository)
}

async function fetchRepositoryRemote(repositoryId: string, remoteName?: string): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(repositoryId)

  if (remoteName) {
    const name = validateRepositoryRemoteName(remoteName)
    await runGitInPathStrict(repository.localPath, ['fetch', name, '--prune'])
  } else {
    await runGitInPathStrict(repository.localPath, ['fetch', '--all', '--prune'])
  }

  return rescanRepositoryRecord(repository)
}

async function runRepositoryGitCommand(input: GitCommandRequest): Promise<GitCommandResult> {
  const repository = getRepositoryOrThrow(input.repositoryId)
  const args = parseControlledGitCommand(input.command)
  const result = await runGitInPathResult(repository.localPath, args)

  if (result.ok && args[0] === 'fetch') {
    await rescanRepositoryRecord(repository)
  }

  return result
}

function resolveRepositoryFilePath(repository: RepositoryRecord, filePath: string): string {
  const normalizedPath = resolve(repository.localPath, filePath)
  const relativePath = relative(repository.localPath, normalizedPath)

  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('只能处理当前仓库内的文件')
  }

  return normalizedPath
}

async function getRepositoryWorkspaceStatus(repositoryId: string): Promise<GitWorkspaceStatus> {
  const repository = getRepositoryOrThrow(repositoryId)
  const [statusOutput, branch] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['status', '--porcelain']),
    runGitInPath(repository.localPath, ['branch', '--show-current'])
  ])
  const files = parsePorcelainStatus(statusOutput)
  const conflicts = await Promise.all(
    files
      .filter((file) => file.conflict)
      .map(async (file) => {
        const content = await readFile(resolveRepositoryFilePath(repository, file.path), 'utf8')
        return {
          path: file.path,
          content,
          sections: extractConflictSections(content)
        }
      })
  )

  return { repositoryId, branch, files, conflicts }
}

async function runRepositoryWriteOperation(repositoryId: string, args: string[]): Promise<GitOperationResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const result = await runGitInPathResult(repository.localPath, args)
  const rescannedRepository = await rescanRepositoryRecord(repository)
  const status = await getRepositoryWorkspaceStatus(repositoryId)

  return {
    ok: result.ok,
    repository: rescannedRepository,
    status,
    stdout: result.stdout,
    stderr: result.stderr
  }
}

async function suggestRepositoryConflictResolution(repositoryId: string, filePath: string): Promise<ConflictResolutionSuggestion> {
  const repository = getRepositoryOrThrow(repositoryId)
  const content = await readFile(resolveRepositoryFilePath(repository, filePath), 'utf8')
  const settings = await readAiSettingsFile(app.getPath('userData'))

  return requestConflictResolutionSuggestion({
    settings,
    repositoryName: repository.name,
    filePath,
    conflictedContent: content
  })
}

async function applyRepositoryConflictResolution(repositoryId: string, filePath: string, content: string): Promise<GitOperationResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const normalizedPath = resolveRepositoryFilePath(repository, filePath)

  await writeFile(normalizedPath, content, 'utf8')

  return runRepositoryWriteOperation(repositoryId, buildGitAddArgs({ mode: 'paths', paths: [filePath] }))
}

async function listRepositoryCommits(
  repositoryId: string,
  options: { startDate?: string; endDate?: string; branchName?: string } = {}
): Promise<GitCommitRecord[]> {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  const since = options.startDate ? `${options.startDate}T00:00:00.000Z` : undefined
  const output = await runGitLog(repository.localPath, { sinceDate: since, branchName: options.branchName, allRefs: !options.branchName })
  const endTime = options.endDate ? new Date(`${options.endDate}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY

  return parseGitLog(output)
    .filter((commit) => new Date(commit.committedAt).getTime() <= endTime)
    .map((commit) =>
      mapCommitRecord({
        ...commit,
        repositoryId: repository.id,
        repositoryName: repository.name,
        branchName: options.branchName || '全部引用'
      })
    )
}

async function syncRepositoryRemote(repositoryId: string): Promise<RepositoryRecord> {
  const existing = listRepositories().find((repository) => repository.id === repositoryId)

  if (!existing) {
    throw new Error('仓库不存在')
  }

  await runGitInPathStrict(existing.localPath, ['fetch', '--all', '--prune'])

  const scanned = await scanRepository(existing.localPath)

  if (!scanned) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return upsertRepository(existing.projectId, scanned)
}

async function analyzeProjectGit(projectId: string): Promise<ProjectGitSummary> {
  const db = getDatabase()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined

  if (!project) {
    throw new Error('项目不存在')
  }

  const repositories = listRepositories(projectId)
  const now = new Date().toISOString()

  try {
    const allCommits: Array<ParsedGitCommit & { repositoryId: string }> = []

    for (const repository of repositories) {
      if (!existsSync(join(repository.localPath, '.git'))) {
        continue
      }

      const output = await runGitLog(repository.localPath, { allRefs: true })
      allCommits.push(...parseGitLog(output).map((commit) => ({ ...commit, repositoryId: repository.id, branchName: '全部引用' })))
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM git_commits WHERE project_id = ?').run(projectId)

      const insertCommit = db.prepare(`
        INSERT OR REPLACE INTO git_commits (
          id, project_id, repository_id, hash, author_name, author_email, committed_at, message,
          branch_name, additions, deletions, files_changed
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const commit of allCommits) {
        insertCommit.run(
          `${commit.repositoryId}:${commit.hash}`,
          projectId,
          commit.repositoryId,
          commit.hash,
          commit.authorName,
          commit.authorEmail,
          commit.committedAt,
          commit.message,
          commit.branchName,
          commit.additions,
          commit.deletions,
          commit.filesChanged
        )
      }

      db.prepare(
        `
        INSERT INTO analysis_runs (project_id, status, last_analyzed_at, error_message)
        VALUES (?, 'ready', ?, '')
        ON CONFLICT(project_id) DO UPDATE SET
          status = 'ready',
          last_analyzed_at = excluded.last_analyzed_at,
          error_message = ''
      `
      ).run(projectId, now)
    })

    transaction()
    return getProjectSummary(projectId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Git 分析失败'
    db.prepare(
      `
      INSERT INTO analysis_runs (project_id, status, last_analyzed_at, error_message)
      VALUES (?, 'failed', ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        status = 'failed',
        last_analyzed_at = excluded.last_analyzed_at,
        error_message = excluded.error_message
    `
    ).run(projectId, now, message)
    return getProjectSummary(projectId)
  }
}

async function findGitRepositories(rootPath: string): Promise<string[]> {
  const normalizedRoot = resolve(expandHomePath(rootPath))
  const repositories = new Set<string>()
  const queue: Array<{ path: string; depth: number }> = [{ path: normalizedRoot, depth: 0 }]
  const maxDepth = 4

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    if (existsSync(join(current.path, '.git'))) {
      repositories.add(current.path)
      continue
    }

    if (current.depth >= maxDepth) {
      continue
    }

    let entries

    try {
      entries = await readdir(current.path, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }

      queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 })
    }
  }

  return Array.from(repositories)
}

function readSshFingerprint(path: string, content: string): Promise<string> {
  return new Promise((resolveFingerprint) => {
    execFile('ssh-keygen', ['-lf', path], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolveFingerprint(content.trim().slice(0, 80))
        return
      }

      resolveFingerprint(stdout.trim())
    })
  })
}

async function getGitSetupStatus(): Promise<GitSetupStatus> {
  const [gitVersion, userName, userEmail, sshKeys] = await Promise.all([
    runGit(['--version']),
    runGit(['config', '--global', 'user.name']),
    runGit(['config', '--global', 'user.email']),
    readSshKeyInventory(sshDirectory, readSshFingerprint)
  ])

  return {
    gitAvailable: gitVersion.length > 0,
    gitVersion,
    userName,
    userEmail,
    sshPublicKeys: sshKeys.sshPublicKeys,
    sshPrivateKeys: sshKeys.sshPrivateKeys
  }
}

ipcMain.handle('repositories:scan', async (_event, paths: string[]) => {
  const results = await Promise.all(paths.map((path) => scanRepository(path)))
  return results.filter(Boolean)
})

ipcMain.handle('repositories:scan-workspace', async (_event, rootPath: string) => {
  const repositoryPaths = await findGitRepositories(rootPath)
  const results = await Promise.all(repositoryPaths.map((path) => scanRepository(path)))
  return results.filter(Boolean)
})

ipcMain.handle('projects:list', async (): Promise<WorkspaceSnapshot> => getWorkspaceSnapshot())

ipcMain.handle(
  'projects:create',
  async (_event, input: { name: string; workspacePath: string; repositories: RepositoryScanResult[] }): Promise<WorkspaceSnapshot> => {
    const name = input.name.trim()
    const workspacePath = resolve(expandHomePath(input.workspacePath.trim()))

    if (!name) {
      throw new Error('请输入项目名称')
    }

    if (!workspacePath) {
      throw new Error('请选择项目目录')
    }

    const now = new Date().toISOString()
    const projectId = createProjectId(name)
    const db = getDatabase()
    const transaction = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO projects (id, name, description, status, owner, workspace_path, created_at, updated_at)
        VALUES (?, ?, '', 'ready', '', ?, ?, ?)
      `
      ).run(projectId, name, workspacePath, now, now)

      for (const repository of input.repositories) {
        upsertRepository(projectId, repository)
      }
    })

    transaction()
    return getWorkspaceSnapshot()
  }
)

ipcMain.handle(
  'projects:update',
  async (_event, input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }): Promise<WorkspaceSnapshot> => {
    const existing = getDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(input.id) as Record<string, unknown> | undefined

    if (!existing) {
      throw new Error('项目不存在')
    }

    getDatabase()
      .prepare(
        `
        UPDATE projects
        SET name = ?, workspace_path = ?, description = ?, owner = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        input.name?.trim() || String(existing.name),
        input.workspacePath ? resolve(expandHomePath(input.workspacePath.trim())) : String(existing.workspace_path),
        input.description ?? String(existing.description ?? ''),
        input.owner ?? String(existing.owner ?? ''),
        new Date().toISOString(),
        input.id
      )

    return getWorkspaceSnapshot()
  }
)

ipcMain.handle('repositories:list', async (_event, projectId?: string): Promise<RepositoryRecord[]> => listRepositories(projectId))

ipcMain.handle('repository:detail', async (_event, repositoryId: string): Promise<RepositoryRecord> => {
  const existing = listRepositories().find((repository) => repository.id === repositoryId)

  if (!existing) {
    throw new Error('仓库不存在')
  }

  const scanned = await scanRepository(existing.localPath)

  if (!scanned) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return upsertRepository(existing.projectId, scanned)
})

ipcMain.handle(
  'repository:commits',
  async (_event, repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }): Promise<GitCommitRecord[]> =>
    listRepositoryCommits(repositoryId, options)
)

ipcMain.handle(
  'repository:commit-graph',
  async (_event, repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }): Promise<GitCommitRecord[]> =>
    listRepositoryCommits(repositoryId, options)
)

ipcMain.handle('repository:sync-remote', async (_event, repositoryId: string): Promise<RepositoryRecord> => syncRepositoryRemote(repositoryId))

ipcMain.handle('repository:remote:save', async (_event, input: RepositoryRemoteInput): Promise<RepositoryRecord> => saveRepositoryRemote(input))

ipcMain.handle('repository:remote:delete', async (_event, repositoryId: string, remoteName: string): Promise<RepositoryRecord> => deleteRepositoryRemote(repositoryId, remoteName))

ipcMain.handle('repository:remote:fetch', async (_event, repositoryId: string, remoteName?: string): Promise<RepositoryRecord> => fetchRepositoryRemote(repositoryId, remoteName))

ipcMain.handle('repository:git-command', async (_event, input: GitCommandRequest): Promise<GitCommandResult> => runRepositoryGitCommand(input))

ipcMain.handle('repository:workspace-status', async (_event, repositoryId: string): Promise<GitWorkspaceStatus> => getRepositoryWorkspaceStatus(repositoryId))

ipcMain.handle('repository:git-add', async (_event, repositoryId: string, input: GitAddInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitAddArgs(input))
)

ipcMain.handle('repository:git-commit', async (_event, repositoryId: string, input: GitCommitInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitCommitArgs(input))
)

ipcMain.handle('repository:git-push', async (_event, repositoryId: string, input: GitPushInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitPushArgs(input))
)

ipcMain.handle('repository:git-merge', async (_event, repositoryId: string, input: GitMergeInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitMergeArgs(input))
)

ipcMain.handle('repository:conflict:suggest', async (_event, repositoryId: string, filePath: string): Promise<ConflictResolutionSuggestion> =>
  suggestRepositoryConflictResolution(repositoryId, filePath)
)

ipcMain.handle('repository:conflict:apply', async (_event, repositoryId: string, filePath: string, content: string): Promise<GitOperationResult> =>
  applyRepositoryConflictResolution(repositoryId, filePath, content)
)

ipcMain.handle('repository:commit-files', async (_event, repositoryId: string, commitHash: string): Promise<GitCommitFileChange[]> =>
  listRepositoryCommitFiles(repositoryId, commitHash)
)

ipcMain.handle(
  'repository:commit-diff',
  async (_event, repositoryId: string, commitHash: string, filePath: string, oldPath?: string, status?: string): Promise<GitCommitDiff> =>
    getRepositoryCommitDiff(repositoryId, commitHash, filePath, oldPath, status)
)

ipcMain.handle('project:summary', async (_event, projectId: string, range?: { startDate?: string; endDate?: string }): Promise<ProjectGitSummary> => getProjectSummary(projectId, range))

ipcMain.handle('project:analyze-git', async (_event, projectId: string): Promise<ProjectGitSummary> => analyzeProjectGit(projectId))

ipcMain.handle('project:people', async (_event, projectId: string): Promise<ProjectPersonRecord[]> => listProjectPeople(projectId))

ipcMain.handle('project:contributor-identities', async (_event, projectId: string): Promise<GitContributorIdentity[]> => listProjectContributorIdentities(projectId))

ipcMain.handle(
  'project:person:save',
  async (
    _event,
    input: { id?: string; projectId: string; displayName: string; role?: string; identities: Array<{ name: string; email: string }> }
  ): Promise<ProjectPersonRecord> => saveProjectPerson(input)
)

ipcMain.handle('project:person:delete', async (_event, projectId: string, personId: string): Promise<ProjectPersonRecord[]> => deleteProjectPerson(projectId, personId))

ipcMain.handle(
  'repository:configure-identity',
  async (_event, localPath: string, identity: { userName: string; userEmail: string }): Promise<RepositoryScanResult> => {
    const normalizedPath = resolve(expandHomePath(localPath))
    const userName = identity.userName.trim()
    const userEmail = identity.userEmail.trim()

    if (!existsSync(join(normalizedPath, '.git'))) {
      throw new Error('这不是一个 Git 仓库')
    }

    if (!userName || !userEmail) {
      throw new Error('请填写本仓库的提交用户名和邮箱')
    }

    await runGitInPathStrict(normalizedPath, ['config', '--local', 'user.name', userName])
    await runGitInPathStrict(normalizedPath, ['config', '--local', 'user.email', userEmail])

    const repository = await scanRepository(normalizedPath)

    if (!repository) {
      throw new Error('仓库设置已保存，但重新读取失败')
    }

    const existing = getDatabase().prepare('SELECT project_id FROM repositories WHERE id = ?').get(repository.id) as Record<string, unknown> | undefined

    if (existing?.project_id) {
      upsertRepository(String(existing.project_id), repository)
    }

    return repository
  }
)

ipcMain.handle('repository:clear-identity', async (_event, localPath: string): Promise<RepositoryScanResult> => {
  const normalizedPath = resolve(expandHomePath(localPath))

  if (!existsSync(join(normalizedPath, '.git'))) {
    throw new Error('这不是一个 Git 仓库')
  }

  await runGitInPath(normalizedPath, ['config', '--local', '--unset', 'user.name'])
  await runGitInPath(normalizedPath, ['config', '--local', '--unset', 'user.email'])

  const repository = await scanRepository(normalizedPath)

  if (!repository) {
    throw new Error('仓库设置已清除，但重新读取失败')
  }

  const existing = getDatabase().prepare('SELECT project_id FROM repositories WHERE id = ?').get(repository.id) as Record<string, unknown> | undefined

  if (existing?.project_id) {
    upsertRepository(String(existing.project_id), repository)
  }

  return repository
})

ipcMain.handle('dialog:select-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a workspace or Git repository folder',
    properties: ['openDirectory']
  })

  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('git:setup-status', async (): Promise<GitSetupStatus> => getGitSetupStatus())

ipcMain.handle('git:configure-identity', async (_event, identity: { userName: string; userEmail: string }): Promise<GitSetupStatus> => {
  const userName = identity.userName.trim()
  const userEmail = identity.userEmail.trim()

  if (!userName || !userEmail) {
    throw new Error('请填写 Git 用户名和邮箱')
  }

  await runGitStrict(['config', '--global', 'user.name', userName])
  await runGitStrict(['config', '--global', 'user.email', userEmail])

  return getGitSetupStatus()
})

ipcMain.handle('settings:ai:get', async (): Promise<RedactedAiSettings> => getRedactedAiSettings(await readAiSettingsFile(app.getPath('userData'))))

ipcMain.handle('settings:ai:save', async (_event, input: Partial<AiSettings>): Promise<RedactedAiSettings> => {
  const currentSettings = await readAiSettingsFile(app.getPath('userData'))
  const nextSettings = await writeAiSettingsFile(app.getPath('userData'), {
    ...currentSettings,
    ...input,
    apiKey: input.apiKey === undefined ? currentSettings.apiKey : input.apiKey
  })

  return getRedactedAiSettings(nextSettings)
})

ipcMain.handle('ssh:generate-key', async (_event, input: string | SshKeyGenerationInput): Promise<GitSetupStatus['sshPublicKeys'][number]> => {
  const comment = (typeof input === 'string' ? input : input.email).trim()

  if (!comment) {
    throw new Error('请先填写用于 SSH 公钥备注的邮箱')
  }

  await mkdir(sshDirectory, { recursive: true, mode: 0o700 })

  const keyPath =
    typeof input === 'string' || !input.keyName?.trim()
      ? await findAvailableSshKeyPath()
      : join(sshDirectory, normalizeSshKeyFileName(input.keyName, 'private'))

  if (existsSync(keyPath) || existsSync(`${keyPath}.pub`)) {
    throw new Error('同名 SSH 密钥已经存在，请换一个文件名')
  }

  await runSshKeygen(['-t', 'ed25519', '-C', comment, '-f', keyPath, '-N', ''])

  const publicKeyPath = `${keyPath}.pub`
  const keys = await readSshKeyInventory(sshDirectory, readSshFingerprint)
  const createdKey = keys.sshPublicKeys.find((key) => key.path === publicKeyPath)

  if (!createdKey) {
    throw new Error('SSH 公钥已生成，但读取失败，请重新检测')
  }

  return createdKey
})

ipcMain.handle('ssh:copy-public-key', async (_event, publicKeyPath: string): Promise<void> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(publicKeyPath), 'public')

  clipboard.writeText((await readFile(normalizedPath, 'utf8')).trim())
})

ipcMain.handle('ssh:copy-key-path', async (_event, path: string, kind: 'private' | 'public'): Promise<void> => {
  clipboard.writeText(resolveSshKeyFilePath(sshDirectory, expandHomePath(path), kind))
})

ipcMain.handle('ssh:import-key', async (_event, input: SshKeyImportInput): Promise<GitSetupStatus> => {
  await importSshKeyFile(sshDirectory, input)
  return getGitSetupStatus()
})

ipcMain.handle('ssh:delete-key', async (_event, path: string, kind: 'private' | 'public'): Promise<GitSetupStatus> => {
  await deleteSshKeyFile(sshDirectory, expandHomePath(path), kind)
  return getGitSetupStatus()
})

ipcMain.handle('ssh:fix-private-key-permissions', async (_event, path: string): Promise<GitSetupStatus> => {
  await fixSshPrivateKeyPermissions(sshDirectory, expandHomePath(path))
  return getGitSetupStatus()
})

ipcMain.handle('ssh:derive-public-key', async (_event, privateKeyPath: string): Promise<GitSetupStatus> => {
  const normalizedPrivateKeyPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(privateKeyPath), 'private')
  const publicKeyContent = await runSshKeygen(['-y', '-f', normalizedPrivateKeyPath])

  if (!publicKeyContent.trim()) {
    throw new Error('无法从私钥生成公钥')
  }

  await writeFile(`${normalizedPrivateKeyPath}.pub`, `${publicKeyContent.trim()}\n`, { encoding: 'utf8', mode: 0o644 })
  return getGitSetupStatus()
})

ipcMain.handle('dialog:select-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a file',
    properties: ['openFile']
  })

  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('ssh:read-config', async (): Promise<SshConfigFile> => readSshConfigFile(sshDirectory))

ipcMain.handle('ssh:write-config', async (_event, content: string): Promise<SshConfigFile> => writeSshConfigFile(sshDirectory, content))

ipcMain.handle('ssh:open-directory', async (): Promise<void> => {
  await mkdir(sshDirectory, { recursive: true, mode: 0o700 })
  await shell.openPath(sshDirectory)
})

ipcMain.handle('external:open-git-download', async (): Promise<void> => {
  await shell.openExternal('https://git-scm.com/downloads')
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
