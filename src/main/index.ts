import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import Database from 'better-sqlite3'
import simpleGit from 'simple-git'
import { requestCommitMessageSuggestion, type CommitMessageSuggestion } from './ai-commit-message-assistant'
import { requestConflictResolutionSuggestion, type ConflictResolutionSuggestion } from './ai-conflict-assistant'
import { requestReleaseSuggestion, type ReleaseSuggestion } from './ai-release-assistant'
import { getRedactedAiSettings, readAiSettingsFile, writeAiSettingsFile, type AiSettings, type RedactedAiSettings } from './ai-settings'
import { registerAppUpdateIpc } from './app-updates'
import { buildGitAuthorLookup, resolveGitAuthorDisplay, type GitAuthorLookup } from './git-author-mapping'
import { parseControlledGitCommand, validateRepositoryRemoteName } from './git-controls'
import {
  buildGitAddArgs,
  buildGitCommitArgs,
  buildGitDiffStatArgs,
  buildGitFastForwardCheckArgs,
  buildGitMergeArgs,
  buildGitMergeBaseArgs,
  buildGitMergeTreeArgs,
  buildGitPushOperationArgs,
  buildGitPushTargetCommitCountArgs,
  buildGitPushTargetLocalCommitCountArgs,
  buildGitPushTargetRemoteRefVerifyArgs,
  buildGitRevListCountArgs,
  buildGitSwitchBranchArgs,
  buildGitTagArgs,
  buildGitVerifyRefArgs,
  parsePorcelainStatus,
  type GitAddInput,
  type GitBranchSwitchInput,
  type GitCommitInput,
  type GitMergeAnalysisInput,
  type GitMergeInput,
  type GitPushInput,
  type GitPushTarget,
  type GitStatusFile
} from './git-workspace'
import { extractConflictSections, type ConflictSection } from './merge-conflicts'
import {
  deleteProjectBranchTag as deleteProjectBranchTagRecord,
  listProjectBranchTags as listProjectBranchTagRecords,
  migrateProjectBranchTagTable,
  saveProjectBranchTag as saveProjectBranchTagRecord,
  type ProjectBranchTagInput,
  type ProjectBranchTagRecord
} from './project-branch-tags'
import { readSshConfigFile, writeSshConfigFile, type SshConfigFile } from './ssh-config'
import { createNodePtyFactory } from './node-pty-factory'
import {
  buildTerminalRemoteSshCommand,
  deleteTerminalRemoteGroup as deleteTerminalRemoteGroupRecord,
  deleteTerminalRemoteHost as deleteTerminalRemoteHostRecord,
  listTerminalRemoteGroups as listTerminalRemoteGroupRecords,
  listTerminalRemoteHosts as listTerminalRemoteHostRecords,
  migrateTerminalRemoteShortcutTables,
  saveTerminalRemoteGroup as saveTerminalRemoteGroupRecord,
  saveTerminalRemoteHost as saveTerminalRemoteHostRecord,
  type TerminalRemoteGroupInput,
  type TerminalRemoteGroupRecord,
  type TerminalRemoteHostInput,
  type TerminalRemoteHostRecord
} from './terminal-remote-shortcuts'
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
import {
  clearSshPassphrase,
  listSshPassphrasePaths,
  readSshPassphrases,
  saveSshPassphrase,
  withSshPassphraseAskpass
} from './ssh-passphrases'
import { registerTerminalIpc } from './terminal-ipc'
import { TerminalService, type TerminalDataEvent, type TerminalExitEvent } from './terminal-service'
import { parseRemoteAlignment, summarizeRemoteAlignment, type GitRemote, type RemoteAlignmentSummary } from './remote-alignment'
import {
  createReleasePlan,
  createReleaseTagName,
  createReleaseVersionRecommendation,
  type ReleasePlan,
  type ReleaseScriptName,
  type ReleaseVersionRecommendation
} from './release-publishing'
import {
  bindProjectService as bindProjectServiceRecord,
  addServiceDomain as addServiceDomainRecord,
  checkServiceDomain,
  deleteServiceEnvVar as deleteServiceEnvVarRecord,
  deleteOldServiceMonitorHistory,
  deleteServiceConnection as deleteServiceConnectionRecord,
  inspectServiceDomainConfig as inspectServiceDomainConfigRecord,
  isMonitorableServiceDomain,
  listAllProjectServices as listAllProjectServiceRecords,
  listAllServiceMonitorHistory as listAllServiceMonitorHistoryRecords,
  listLatestServiceMonitorChecks as listLatestServiceMonitorCheckRecords,
  listProjectServices as listProjectServiceRecords,
  listServiceConnections as listServiceConnectionRecords,
  listServiceDeployments as listServiceDeploymentRecords,
  listServiceEnvironmentLogs as listServiceEnvironmentLogRecords,
  listServiceEnvVars as listServiceEnvVarRecords,
  listServiceMonitorHistory as listServiceMonitorHistoryRecords,
  listServiceRuntimeLogs as listServiceRuntimeLogRecords,
  migrateServiceMonitoringTables,
  recordServiceMonitorCheck,
  removeServiceDomain as removeServiceDomainRecord,
  revealServiceEnvVar as revealServiceEnvVarRecord,
  runServiceDeploymentAction as runServiceDeploymentActionRecord,
  saveServiceExternalProjectAlias as saveServiceExternalProjectAliasRecord,
  saveServiceEnvVar as saveServiceEnvVarRecord,
  saveProjectService as saveProjectServiceRecord,
  saveServiceConnection as saveServiceConnectionRecord,
  syncServiceConnection,
  verifyServiceDomain as verifyServiceDomainRecord,
  type ProjectServiceInput,
  type ProjectServiceRecord,
  type ServiceEnvironmentLogRecord,
  type ServiceConnectionInput,
  type ServiceConnectionRecord,
  type ServiceDeploymentListOptions,
  type ServiceDeploymentSummary,
  type ServiceExternalProjectAliasInput,
  type ServiceEnvVarRecord,
  type ServiceMonitorCheckRecord,
  type VercelDeploymentActionInput,
  type VercelDomainConfig,
  type VercelDomainInput,
  type VercelEnvVarInput,
} from './service-monitoring'

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
  pushTargets: GitPushTarget[]
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
  pushTargets: GitPushTarget[]
}

type GitOperationResult = {
  ok: boolean
  repository: RepositoryRecord
  status: GitWorkspaceStatus
  stdout: string
  stderr: string
}

type GitCommitMessageInput = {
  paths: string[]
}

type RepositoryReleasePrepareInput = {
  targetVersion?: string
}

type RepositoryReleasePreparation = {
  repositoryId: string
  packageManager: 'pnpm' | 'npm' | 'yarn'
  localPath: string
  documentationContext: string
  recentCommits: string[]
  plan: ReleasePlan
}

type RepositoryReleaseSuggestionInput = {
  targetVersion?: string
}

type RepositoryReleaseTagRecommendation = ReleaseVersionRecommendation

type RepositoryReleasePublishInput = {
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
  githubToken?: string
}

type RepositoryReleasePublishResult = {
  ok: boolean
  repository: RepositoryRecord
  plan: ReleasePlan
  stdout: string
  stderr: string
  exitCode: number | null
}

type GitMergeAnalysis = {
  repositoryId: string
  ok: boolean
  source: string
  target: string
  currentBranch: string
  incomingCommits: number
  localOnlyCommits: number
  fastForward: boolean
  mergeBase: string
  issues: string[]
  warnings: string[]
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
  authorDisplayName: string
  authorDisplayEmail: string
  mappedPersonId: string
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

type GitExecutionOptions = {
  env?: NodeJS.ProcessEnv
}

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const sshDirectory = join(homedir(), '.ssh')
const appIconPath = isDev ? join(__dirname, '../../resources/forgedesk.png') : join(process.resourcesPath, 'forgedesk.png')
let database: Database.Database | null = null
const terminalService = new TerminalService({
  onData: (event) => sendTerminalEvent('terminal:data', event),
  onExit: (event) => sendTerminalEvent('terminal:exit', event),
  ptyFactory: createNodePtyFactory()
})

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : '读取远端对齐状态失败'
}

function sendTerminalEvent(channel: 'terminal:data', event: TerminalDataEvent): void
function sendTerminalEvent(channel: 'terminal:exit', event: TerminalExitEvent): void
function sendTerminalEvent(channel: 'terminal:data' | 'terminal:exit', event: TerminalDataEvent | TerminalExitEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, event)
  }
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

async function inspectRepositoryPushTargets(localPath: string, remotes: GitRemote[], currentBranch: string): Promise<GitPushTarget[]> {
  const branch = currentBranch.trim()

  if (!branch || branch === 'detached' || remotes.length === 0) {
    return []
  }

  const targets = await Promise.all(
    remotes
      .filter((remote) => remote.name)
      .map(async (remote): Promise<GitPushTarget | null> => {
        try {
          const remoteRefResult = await runGitInPathResult(localPath, buildGitPushTargetRemoteRefVerifyArgs(remote.name, branch))
          const countArgs = remoteRefResult.ok ? buildGitPushTargetCommitCountArgs(remote.name, branch) : buildGitPushTargetLocalCommitCountArgs(branch)
          const countOutput = await runGitInPathOptional(localPath, countArgs)

          return {
            remote: remote.name,
            branch,
            ahead: parseGitCount(countOutput),
            hasRemoteBranch: remoteRefResult.ok
          }
        } catch {
          return null
        }
      })
  )

  return targets.filter((target): target is GitPushTarget => Boolean(target))
}

async function inspectRemoteAlignment(
  localPath: string,
  remotes: GitRemote[],
  currentBranch: string,
  defaultBranch: string
): Promise<RemoteAlignmentSummary> {
  try {
    const refsByRemote = new Map(await Promise.all(remotes.map(async (remote) => [remote.name, await listRemoteBranchRefs(localPath, remote.name)] as const)))

    return summarizeRemoteAlignment({
      remotes,
      refsByRemote,
      currentBranch,
      defaultBranch,
      countExclusiveCommits: (baseCommit, headCommit) => countExclusiveCommits(localPath, baseCommit, headCommit)
    })
  } catch (error) {
    return {
      remotes: remotes.map((remote) => ({
        name: remote.name,
        url: remote.fetchUrl || remote.pushUrl || '',
        branchCount: 0
      })),
      remoteCount: remotes.length,
      status: 'unknown',
      branchCount: 0,
      alignedBranchCount: 0,
      divergedBranchCount: 0,
      missingBranchCount: 0,
      currentBranchStatus: '',
      errorMessage: getErrorText(error),
      branches: []
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
      push_targets_json TEXT NOT NULL DEFAULT '[]',
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

  migrateProjectBranchTagTable(db)
  migrateServiceMonitoringTables(db)
  migrateTerminalRemoteShortcutTables(db)

  addColumnIfMissing(db, 'repositories', 'remotes_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'local_branch_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'remote_branch_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'branches_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_branches_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'push_targets_json', "TEXT NOT NULL DEFAULT '[]'")
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
  const pushTargets = parseJsonArray<GitPushTarget>(row.push_targets_json)
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
    pushTargets,
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

function deleteProject(projectId: string): WorkspaceSnapshot {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)

  if (!existing) {
    throw new Error('项目不存在')
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
  return getWorkspaceSnapshot()
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
        remote_branch_count, branches_json, remote_branches_json, push_targets_json, remote_alignment_json, default_branch, current_branch, latest_commit,
        has_changes, ahead, local_user_name, local_user_email, effective_user_name, effective_user_email,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        push_targets_json = excluded.push_targets_json,
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
      JSON.stringify(repository.pushTargets),
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

function createGitExecutionEnv(options: GitExecutionOptions = {}): NodeJS.ProcessEnv {
  return options.env ? { ...process.env, ...options.env } : process.env
}

function runGitInPathStrict(localPath: string, args: string[], options: GitExecutionOptions = {}): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 * 20, env: createGitExecutionEnv(options) }, (error, stdout, stderr) => {
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

function runGitInPathResult(localPath: string, args: string[], options: GitExecutionOptions = {}): Promise<GitCommandResult> {
  return new Promise((resolveResult) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 * 20, env: createGitExecutionEnv(options) }, (error, stdout, stderr) => {
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

async function withSavedSshPassphrases<T>(operation: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  return withSshPassphraseAskpass(await readSshPassphrases(app.getPath('userData')), operation)
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
    icon: appIconPath,
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
  const [remoteAlignment, pushTargets] = await Promise.all([
    inspectRemoteAlignment(normalizedPath, remotes, currentBranch, defaultBranch),
    inspectRepositoryPushTargets(normalizedPath, remotes, currentBranch)
  ])

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
    pushTargets,
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

function mapCommitRecord(
  commit: ParsedGitCommit & { repositoryId: string; repositoryName: string; branchName: string },
  authorLookup?: GitAuthorLookup
): GitCommitRecord {
  const authorDisplay = authorLookup
    ? resolveGitAuthorDisplay(
        {
          authorName: commit.authorName,
          authorEmail: commit.authorEmail
        },
        authorLookup
      )
    : {
        authorDisplayName: commit.authorName,
        authorDisplayEmail: commit.authorEmail,
        mappedPersonId: ''
      }

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
    authorDisplayName: authorDisplay.authorDisplayName,
    authorDisplayEmail: authorDisplay.authorDisplayEmail,
    mappedPersonId: authorDisplay.mappedPersonId,
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
    await withSavedSshPassphrases((env) => runGitInPathStrict(repository.localPath, ['fetch', name, '--prune'], { env }))
  } else {
    await withSavedSshPassphrases((env) => runGitInPathStrict(repository.localPath, ['fetch', '--all', '--prune'], { env }))
  }

  return rescanRepositoryRecord(repository)
}

async function switchRepositoryBranch(repositoryId: string, input: GitBranchSwitchInput): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(repositoryId)

  await runGitInPathStrict(repository.localPath, buildGitSwitchBranchArgs(input))

  return rescanRepositoryRecord(repository)
}

const serviceMonitorIntervalMs = 5 * 60 * 1000
const serviceMonitorRetentionDays = 30
let serviceMonitorTimer: NodeJS.Timeout | null = null
let serviceMonitorRunning = false

function getServiceMonitorCutoffIso(): string {
  return new Date(Date.now() - serviceMonitorRetentionDays * 24 * 60 * 60 * 1000).toISOString()
}

async function checkProjectServicesNow(projectId?: string): Promise<ProjectServiceRecord[]> {
  const db = getDatabase()
  const services = projectId ? listProjectServiceRecords(db, projectId) : listAllProjectServiceRecords(db)

  for (const service of services) {
    if (!service.enabled) {
      continue
    }

    for (const domain of service.domains) {
      if (!isMonitorableServiceDomain(domain, service.provider)) {
        continue
      }

      const result = await checkServiceDomain(domain)
      recordServiceMonitorCheck(db, {
        projectId: projectId ?? '',
        serviceId: service.id,
        domainId: domain.id,
        ...result
      })
    }
  }

  deleteOldServiceMonitorHistory(db, getServiceMonitorCutoffIso())
  return projectId ? listProjectServiceRecords(db, projectId) : listAllProjectServiceRecords(db)
}

async function runServiceMonitorSweep(projectId?: string): Promise<void> {
  if (serviceMonitorRunning) {
    return
  }

  serviceMonitorRunning = true

  try {
    await checkProjectServicesNow(projectId)
  } catch (error) {
    console.error('Service monitor sweep failed', error)
  } finally {
    serviceMonitorRunning = false
  }
}

function startServiceMonitorScheduler(): void {
  if (serviceMonitorTimer) {
    return
  }

  serviceMonitorTimer = setInterval(() => {
    runServiceMonitorSweep().catch((error) => console.error('Service monitor sweep failed', error))
  }, serviceMonitorIntervalMs)
  serviceMonitorTimer.unref?.()
  setTimeout(() => runServiceMonitorSweep().catch((error) => console.error('Service monitor sweep failed', error)), 10000).unref?.()
}

async function runRepositoryGitCommand(input: GitCommandRequest): Promise<GitCommandResult> {
  const repository = getRepositoryOrThrow(input.repositoryId)
  const args = parseControlledGitCommand(input.command)
  const result = args[0] === 'fetch'
    ? await withSavedSshPassphrases((env) => runGitInPathResult(repository.localPath, args, { env }))
    : await runGitInPathResult(repository.localPath, args)

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
  const currentBranch = branch || repository.currentBranch
  const pushTargets = await inspectRepositoryPushTargets(repository.localPath, repository.remotes, currentBranch)
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

  return { repositoryId, branch, files, conflicts, pushTargets }
}

function parseGitCount(output: string): number {
  const count = Number.parseInt(output.trim(), 10)
  return Number.isFinite(count) ? count : 0
}

function mergeTreeCheckIsUnsupported(result: GitCommandResult): boolean {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return output.includes('unknown option') || output.includes('usage:') || output.includes('not a git command')
}

async function analyzeRepositoryMerge(repositoryId: string, input: GitMergeAnalysisInput): Promise<GitMergeAnalysis> {
  const repository = getRepositoryOrThrow(repositoryId)
  const status = await getRepositoryWorkspaceStatus(repositoryId)
  const currentBranch = status.branch || repository.currentBranch || 'HEAD'
  const source = input.source.trim()
  const target = input.target.trim()
  const issues: string[] = []
  const warnings: string[] = []

  if (!source) {
    issues.push('请选择要合并进来的分支')
  }

  if (!target) {
    issues.push('请选择要合并到的目标分支')
  }

  if (source && target && source === target) {
    issues.push('合并双方不能是同一个分支')
  }

  if (target && target !== currentBranch) {
    issues.push(`当前工作区停在 ${currentBranch}，目标分支必须是当前分支。请先切到 ${target} 后再合并。`)
  }

  if (status.files.length > 0) {
    issues.push('当前工作区还有未提交改动，请先提交或暂存后再合并')
  }

  let sourceExists = false
  let targetExists = false
  let incomingCommits = 0
  let localOnlyCommits = 0
  let fastForward = false
  let mergeBase = ''

  if (source) {
    try {
      const sourceRefResult = await runGitInPathResult(repository.localPath, buildGitVerifyRefArgs(source))
      sourceExists = sourceRefResult.ok

      if (!sourceRefResult.ok) {
        issues.push(`找不到要合并进来的分支：${source}`)
      }
    } catch (error) {
      issues.push(getErrorText(error))
    }
  }

  if (target) {
    try {
      const targetRefResult = await runGitInPathResult(repository.localPath, buildGitVerifyRefArgs(target))
      targetExists = targetRefResult.ok

      if (!targetRefResult.ok) {
        issues.push(`找不到目标分支：${target}`)
      }
    } catch (error) {
      issues.push(getErrorText(error))
    }
  }

  if (sourceExists && targetExists && source !== target) {
    const [incomingResult, localResult, mergeBaseResult, fastForwardResult, mergeTreeResult] = await Promise.all([
      runGitInPathResult(repository.localPath, buildGitRevListCountArgs(target, source)),
      runGitInPathResult(repository.localPath, buildGitRevListCountArgs(source, target)),
      runGitInPathResult(repository.localPath, buildGitMergeBaseArgs({ source, target })),
      runGitInPathResult(repository.localPath, buildGitFastForwardCheckArgs({ source, target })),
      runGitInPathResult(repository.localPath, buildGitMergeTreeArgs({ source, target }))
    ])

    incomingCommits = incomingResult.ok ? parseGitCount(incomingResult.stdout) : 0
    localOnlyCommits = localResult.ok ? parseGitCount(localResult.stdout) : 0
    mergeBase = mergeBaseResult.ok ? mergeBaseResult.stdout.trim() : ''
    fastForward = fastForwardResult.ok

    if (!incomingResult.ok || !localResult.ok || !mergeBaseResult.ok) {
      issues.push('无法读取双方分支的提交关系，请检查本地仓库状态')
    }

    if (incomingResult.ok && incomingCommits === 0) {
      issues.push(`${target} 已经包含 ${source} 的提交，不需要合并`)
    }

    if (localOnlyCommits > 0 && !fastForward) {
      warnings.push(`${target} 也有 ${localOnlyCommits} 个独有提交，本次会创建一次普通合并`)
    }

    if (!mergeTreeResult.ok) {
      if (mergeTreeCheckIsUnsupported(mergeTreeResult)) {
        warnings.push('当前 Git 版本无法做冲突预检查，真实合并前仍会二次确认')
      } else {
        issues.push('预检查发现这次合并可能产生冲突，请确认双方改动后再合并')
      }
    }
  }

  return {
    repositoryId,
    ok: issues.length === 0,
    source,
    target,
    currentBranch,
    incomingCommits,
    localOnlyCommits,
    fastForward,
    mergeBase,
    issues,
    warnings
  }
}

async function runRepositoryWriteOperation(repositoryId: string, args: string[], options: GitExecutionOptions = {}): Promise<GitOperationResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const result = await runGitInPathResult(repository.localPath, args, options)
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

async function commitRepositoryChanges(repositoryId: string, input: GitCommitInput): Promise<GitOperationResult> {
  const tagName = input.tagName?.trim() ?? ''
  const tagArgs = tagName ? buildGitTagArgs(tagName) : null
  const commitResult = await runRepositoryWriteOperation(repositoryId, buildGitCommitArgs(input))

  if (!commitResult.ok || !tagArgs) {
    return commitResult
  }

  const repository = getRepositoryOrThrow(repositoryId)
  const tagResult = await runGitInPathResult(repository.localPath, tagArgs)
  const rescannedRepository = await rescanRepositoryRecord(repository)
  const status = await getRepositoryWorkspaceStatus(repositoryId)

  return {
    ok: tagResult.ok,
    repository: rescannedRepository,
    status,
    stdout: [commitResult.stdout, tagResult.stdout].filter(Boolean).join('\n'),
    stderr: tagResult.ok ? commitResult.stderr : tagResult.stderr || tagResult.stdout || 'Tag 创建失败'
  }
}

async function pushRepositoryChanges(repositoryId: string, input: GitPushInput): Promise<GitOperationResult> {
  return withSavedSshPassphrases(async (env) => {
    const operationArgs = buildGitPushOperationArgs(input)

    if (operationArgs.length === 1) {
      return runRepositoryWriteOperation(repositoryId, operationArgs[0], { env })
    }

    const repository = getRepositoryOrThrow(repositoryId)
    const results = []

    for (const args of operationArgs) {
      results.push(await runGitInPathResult(repository.localPath, args, { env }))
    }

    const rescannedRepository = await rescanRepositoryRecord(repository)
    const status = await getRepositoryWorkspaceStatus(repositoryId)
    const failedResult = results.find((result) => !result.ok)

    return {
      ok: results.every((result) => result.ok),
      repository: rescannedRepository,
      status,
      stdout: results.map((result) => result.stdout).filter(Boolean).join('\n'),
      stderr: failedResult ? failedResult.stderr || failedResult.stdout || '部分远端推送失败' : results.map((result) => result.stderr).filter(Boolean).join('\n')
    }
  })
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

async function suggestRepositoryCommitMessage(repositoryId: string, input: GitCommitMessageInput): Promise<CommitMessageSuggestion> {
  const repository = getRepositoryOrThrow(repositoryId)
  const settings = await readAiSettingsFile(app.getPath('userData'))
  const paths = input.paths

  if (paths.length === 0) {
    throw new Error('请选择要生成提交信息的文件')
  }

  const [status, diffSummaryResult] = await Promise.all([
    getRepositoryWorkspaceStatus(repositoryId),
    runGitInPathResult(repository.localPath, buildGitDiffStatArgs(paths))
  ])
  const selectedPaths = new Set(paths)
  const files = status.files
    .filter((file) => selectedPaths.has(file.path))
    .map((file) => ({
      path: file.path,
      status: `${file.indexStatus}${file.worktreeStatus}`.trim() || 'changed'
    }))

  if (files.length === 0) {
    throw new Error('选中文件没有可用于提交的改动')
  }

  return requestCommitMessageSuggestion({
    settings,
    repositoryName: repository.name,
    files,
    diffSummary: diffSummaryResult.stdout
  })
}

async function readRepositoryPackageJson(localPath: string): Promise<{ version: string; scripts: Record<string, string>; raw: Record<string, unknown> }> {
  const packagePath = join(localPath, 'package.json')

  if (!existsSync(packagePath)) {
    throw new Error('当前仓库没有 package.json，无法按项目脚本发布')
  }

  const raw = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>
  const scripts = raw.scripts && typeof raw.scripts === 'object' ? raw.scripts as Record<string, string> : {}

  return {
    version: String(raw.version ?? '').trim(),
    scripts,
    raw
  }
}

async function writeRepositoryPackageVersion(localPath: string, version: string): Promise<void> {
  const packagePath = join(localPath, 'package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>

  packageJson.version = version
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

function detectPackageManager(localPath: string): RepositoryReleasePreparation['packageManager'] {
  if (existsSync(join(localPath, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (existsSync(join(localPath, 'yarn.lock'))) {
    return 'yarn'
  }

  return 'npm'
}

async function readRepositoryRemoteTagCommit(localPath: string, tagName: string): Promise<string> {
  return withSavedSshPassphrases(async (env) => {
    const result = await runGitInPathResult(localPath, ['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`, `refs/tags/${tagName}^{}`], { env })

    if (!result.ok) {
      return ''
    }

    const rows = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const peeled = rows.find((line) => line.endsWith(`refs/tags/${tagName}^{}`))
    const selected = peeled ?? rows.find((line) => line.endsWith(`refs/tags/${tagName}`))

    return selected?.split(/\s+/)[0] ?? ''
  })
}

async function recommendRepositoryReleaseTag(repositoryId: string): Promise<RepositoryReleaseTagRecommendation> {
  const repository = getRepositoryOrThrow(repositoryId)
  const [packageInfo, tagOutput] = await Promise.all([
    readRepositoryPackageJson(repository.localPath).catch(() => ({ version: '', scripts: {}, raw: {} })),
    runGitInPathOptional(repository.localPath, ['tag', '--list'])
  ])

  return createReleaseVersionRecommendation({
    currentVersion: packageInfo.version,
    tagNames: tagOutput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  })
}

async function readRepositoryDocumentation(localPath: string): Promise<{ context: string; sources: string[] }> {
  const chunks: string[] = []
  const sources: string[] = []
  const maxFileChars = 4000
  const maxTotalChars = 12000

  async function appendTextSource(relativePath: string): Promise<void> {
    const fullPath = join(localPath, relativePath)

    if (!existsSync(fullPath)) {
      return
    }

    try {
      const content = await readFile(fullPath, 'utf8')
      sources.push(relativePath)
      chunks.push(`## ${relativePath}\n${content.slice(0, maxFileChars)}`)
    } catch {
      // Documentation is useful context, but missing or unreadable docs should not block publishing.
    }
  }

  await appendTextSource('README.md')
  await appendTextSource('readme.md')

  const docsPath = join(localPath, 'docs')
  if (existsSync(docsPath)) {
    try {
      const entries = await readdir(docsPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue
        }

        const relativePath = join('docs', entry.name)

        if (/\.(md|txt)$/i.test(entry.name)) {
          await appendTextSource(relativePath)
        } else if (/\.pdf$/i.test(entry.name)) {
          sources.push(relativePath)
        }
      }
    } catch {
      // Ignore optional docs scan failures.
    }
  }

  return {
    context: chunks.join('\n\n').slice(0, maxTotalChars),
    sources: Array.from(new Set(sources))
  }
}

async function prepareRepositoryRelease(repositoryId: string, input: RepositoryReleasePrepareInput = {}): Promise<RepositoryReleasePreparation> {
  const repository = getRepositoryOrThrow(repositoryId)
  const packageInfo = await readRepositoryPackageJson(repository.localPath)
  const targetVersion = input.targetVersion?.trim() || packageInfo.version
  const tagName = createReleaseTagName(targetVersion)
  const [headCommit, status, localTagCommit, remoteTagCommit, docs, recentCommitsOutput] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['rev-parse', 'HEAD']),
    getRepositoryWorkspaceStatus(repositoryId),
    runGitInPathOptional(repository.localPath, ['rev-parse', '-q', '--verify', `${tagName}^{}`]),
    readRepositoryRemoteTagCommit(repository.localPath, tagName),
    readRepositoryDocumentation(repository.localPath),
    runGitInPathOptional(repository.localPath, ['log', '-n', '20', '--pretty=format:%s'])
  ])
  const plan = createReleasePlan({
    repositoryName: repository.name,
    currentVersion: packageInfo.version,
    targetVersion: input.targetVersion,
    headCommit,
    statusFileCount: status.files.length,
    localTagCommit,
    remoteTagCommit,
    scripts: packageInfo.scripts,
    documentationSources: docs.sources
  })

  return {
    repositoryId,
    packageManager: detectPackageManager(repository.localPath),
    localPath: repository.localPath,
    documentationContext: docs.context,
    recentCommits: recentCommitsOutput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    plan
  }
}

async function suggestRepositoryRelease(repositoryId: string, input: RepositoryReleaseSuggestionInput = {}): Promise<ReleaseSuggestion> {
  const preparation = await prepareRepositoryRelease(repositoryId, input)
  const settings = await readAiSettingsFile(app.getPath('userData'))

  return requestReleaseSuggestion({
    settings,
    repositoryName: preparation.plan.repositoryName,
    currentVersion: preparation.plan.currentVersion,
    suggestedVersion: preparation.plan.suggestedVersion,
    suggestedTagName: preparation.plan.suggestedTagName,
    recentCommits: preparation.recentCommits,
    documentationContext: preparation.documentationContext
  })
}

function getReleaseScriptCommand(packageManager: RepositoryReleasePreparation['packageManager'], scriptName: ReleaseScriptName): string {
  if (!scriptName) {
    throw new Error('没有可执行的发布脚本')
  }

  if (packageManager === 'yarn') {
    return `yarn ${scriptName}`
  }

  return `${packageManager} run ${scriptName}`
}

function runReleaseScript(localPath: string, packageManager: RepositoryReleasePreparation['packageManager'], scriptName: ReleaseScriptName, env: NodeJS.ProcessEnv): Promise<Pick<RepositoryReleasePublishResult, 'ok' | 'stdout' | 'stderr' | 'exitCode'>> {
  const command = getReleaseScriptCommand(packageManager, scriptName)
  const maxOutputLength = 1024 * 1024
  let stdout = ''
  let stderr = ''

  function appendOutput(current: string, chunk: Buffer): string {
    const next = current + chunk.toString()
    return next.length > maxOutputLength ? next.slice(next.length - maxOutputLength) : next
  }

  return new Promise((resolveResult) => {
    const child = spawn('/bin/zsh', ['-lc', command], {
      cwd: localPath,
      env: { ...process.env, ...env }
    })

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk)
    })
    child.on('error', (error) => {
      stderr = appendOutput(stderr, Buffer.from(error.message))
      resolveResult({ ok: false, stdout, stderr, exitCode: null })
    })
    child.on('exit', (exitCode) => {
      resolveResult({ ok: exitCode === 0, stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode })
    })
  })
}

function parseGithubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  const trimmed = remoteUrl.trim()
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  const match = sshMatch ?? httpsMatch

  if (!match) {
    return null
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  }
}

async function updateGithubReleaseDetails(repository: RepositoryRecord, input: RepositoryReleasePublishInput): Promise<string> {
  const token = input.githubToken?.trim()
  const githubRepository = parseGithubRemote(repository.remoteUrl || repository.remotes.find((remote) => remote.name === 'origin')?.fetchUrl || '')

  if (!token || !githubRepository) {
    return ''
  }

  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28'
  }
  const tagName = input.tagName.trim()
  const releaseResponse = await fetch(`https://api.github.com/repos/${githubRepository.owner}/${githubRepository.repo}/releases/tags/${encodeURIComponent(tagName)}`, { headers })

  if (!releaseResponse.ok) {
    return `GitHub Release ${tagName} 暂未更新说明：HTTP ${releaseResponse.status}`
  }

  const release = await releaseResponse.json() as { id?: number }

  if (!release.id) {
    return `GitHub Release ${tagName} 暂未更新说明：无法读取 Release ID`
  }

  const patchResponse = await fetch(`https://api.github.com/repos/${githubRepository.owner}/${githubRepository.repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: input.releaseTitle.trim() || tagName,
      body: input.releaseNotes.trim() || `发布 ${tagName}`
    })
  })

  if (!patchResponse.ok) {
    return `GitHub Release ${tagName} 暂未更新说明：HTTP ${patchResponse.status}`
  }

  return `GitHub Release ${tagName} 标题和说明已更新`
}

async function publishRepositoryRelease(repositoryId: string, input: RepositoryReleasePublishInput): Promise<RepositoryReleasePublishResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const version = input.version.trim()
  const tagName = input.tagName.trim()
  const expectedTagName = createReleaseTagName(version)

  if (tagName !== expectedTagName) {
    throw new Error(`Tag 应为 ${expectedTagName}`)
  }

  const initialPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version })

  if (!initialPreparation.plan.canPublish) {
    throw new Error(initialPreparation.plan.issues.join('\n') || '发布前检查未通过')
  }

  if (initialPreparation.plan.selectedScript === 'publish:mac' && !input.githubToken?.trim()) {
    throw new Error('发布到 GitHub Releases 需要 GitHub Token')
  }

  if (initialPreparation.plan.currentVersion !== version) {
    await writeRepositoryPackageVersion(repository.localPath, version)
    await runGitInPathStrict(repository.localPath, ['add', 'package.json'])
    await runGitInPathStrict(repository.localPath, ['commit', '-m', input.commitMessage.trim() || `chore: release ${tagName}`])
  }

  const finalPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version })

  if (!finalPreparation.plan.canPublish) {
    throw new Error(finalPreparation.plan.issues.join('\n') || '版本提交后发布前检查未通过')
  }

  const branch = await runGitInPath(repository.localPath, ['branch', '--show-current'])

  if (branch) {
    await withSavedSshPassphrases((env) => runGitInPathStrict(repository.localPath, ['push', 'origin', branch], { env }))
  }

  const scriptResult = await withSavedSshPassphrases((env) =>
    runReleaseScript(repository.localPath, finalPreparation.packageManager, finalPreparation.plan.selectedScript, {
      ...env,
      GH_TOKEN: input.githubToken?.trim() || process.env.GH_TOKEN || '',
      GITHUB_TOKEN: input.githubToken?.trim() || process.env.GITHUB_TOKEN || ''
    })
  )
  let stdout = scriptResult.stdout
  let stderr = scriptResult.stderr

  if (scriptResult.ok && finalPreparation.plan.selectedScript === 'publish:mac') {
    const releaseUpdateMessage = await updateGithubReleaseDetails(repository, input)

    if (releaseUpdateMessage) {
      stdout = [stdout, releaseUpdateMessage].filter(Boolean).join('\n')
    }
  }

  return {
    ok: scriptResult.ok,
    repository: await rescanRepositoryRecord(repository),
    plan: finalPreparation.plan,
    stdout,
    stderr,
    exitCode: scriptResult.exitCode
  }
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
  const authorLookup = buildGitAuthorLookup(listProjectPeople(repository.projectId))

  return parseGitLog(output)
    .filter((commit) => new Date(commit.committedAt).getTime() <= endTime)
    .map((commit) =>
      mapCommitRecord({
        ...commit,
        repositoryId: repository.id,
        repositoryName: repository.name,
        branchName: options.branchName || '全部引用'
      }, authorLookup)
    )
}

async function syncRepositoryRemote(repositoryId: string): Promise<RepositoryRecord> {
  const existing = listRepositories().find((repository) => repository.id === repositoryId)

  if (!existing) {
    throw new Error('仓库不存在')
  }

  await withSavedSshPassphrases((env) => runGitInPathStrict(existing.localPath, ['fetch', '--all', '--prune'], { env }))

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
  const [gitVersion, userName, userEmail, passphrasePaths] = await Promise.all([
    runGit(['--version']),
    runGit(['config', '--global', 'user.name']),
    runGit(['config', '--global', 'user.email']),
    listSshPassphrasePaths(app.getPath('userData'))
  ])
  const sshKeys = await readSshKeyInventory(sshDirectory, readSshFingerprint, passphrasePaths)

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

ipcMain.handle('projects:delete', async (_event, projectId: string): Promise<WorkspaceSnapshot> => deleteProject(projectId))

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

ipcMain.handle('repository:branch:switch', async (_event, repositoryId: string, input: GitBranchSwitchInput): Promise<RepositoryRecord> => switchRepositoryBranch(repositoryId, input))

ipcMain.handle('repository:git-command', async (_event, input: GitCommandRequest): Promise<GitCommandResult> => runRepositoryGitCommand(input))

ipcMain.handle('repository:workspace-status', async (_event, repositoryId: string): Promise<GitWorkspaceStatus> => getRepositoryWorkspaceStatus(repositoryId))

ipcMain.handle('repository:git-add', async (_event, repositoryId: string, input: GitAddInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitAddArgs(input))
)

ipcMain.handle('repository:git-commit', async (_event, repositoryId: string, input: GitCommitInput): Promise<GitOperationResult> =>
  commitRepositoryChanges(repositoryId, input)
)

ipcMain.handle('repository:git-push', async (_event, repositoryId: string, input: GitPushInput): Promise<GitOperationResult> =>
  pushRepositoryChanges(repositoryId, input)
)

ipcMain.handle('repository:merge-analysis', async (_event, repositoryId: string, input: GitMergeAnalysisInput): Promise<GitMergeAnalysis> =>
  analyzeRepositoryMerge(repositoryId, input)
)

ipcMain.handle('repository:git-merge', async (_event, repositoryId: string, input: GitMergeInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitMergeArgs(input))
)

ipcMain.handle('repository:conflict:suggest', async (_event, repositoryId: string, filePath: string): Promise<ConflictResolutionSuggestion> =>
  suggestRepositoryConflictResolution(repositoryId, filePath)
)

ipcMain.handle('repository:commit-message:suggest', async (_event, repositoryId: string, input: GitCommitMessageInput): Promise<CommitMessageSuggestion> =>
  suggestRepositoryCommitMessage(repositoryId, input)
)

ipcMain.handle('repository:release:prepare', async (_event, repositoryId: string, input?: RepositoryReleasePrepareInput): Promise<RepositoryReleasePreparation> =>
  prepareRepositoryRelease(repositoryId, input)
)

ipcMain.handle('repository:release-tag:recommend', async (_event, repositoryId: string): Promise<RepositoryReleaseTagRecommendation> =>
  recommendRepositoryReleaseTag(repositoryId)
)

ipcMain.handle('repository:release:suggest', async (_event, repositoryId: string, input?: RepositoryReleaseSuggestionInput): Promise<ReleaseSuggestion> =>
  suggestRepositoryRelease(repositoryId, input)
)

ipcMain.handle('repository:release:publish', async (_event, repositoryId: string, input: RepositoryReleasePublishInput): Promise<RepositoryReleasePublishResult> =>
  publishRepositoryRelease(repositoryId, input)
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

ipcMain.handle('project:branch-tags', async (_event, projectId: string): Promise<ProjectBranchTagRecord[]> => listProjectBranchTagRecords(getDatabase(), projectId))

ipcMain.handle('project:branch-tag:save', async (_event, input: ProjectBranchTagInput): Promise<ProjectBranchTagRecord> => saveProjectBranchTagRecord(getDatabase(), input))

ipcMain.handle('project:branch-tag:delete', async (_event, projectId: string, tagId: string): Promise<ProjectBranchTagRecord[]> =>
  deleteProjectBranchTagRecord(getDatabase(), projectId, tagId)
)

ipcMain.handle('service:connections:list', async (): Promise<ServiceConnectionRecord[]> => listServiceConnectionRecords(getDatabase()))

ipcMain.handle('service:connection:save', async (_event, input: ServiceConnectionInput): Promise<ServiceConnectionRecord> => saveServiceConnectionRecord(getDatabase(), input))

ipcMain.handle('service:connection:delete', async (_event, connectionId: string): Promise<ServiceConnectionRecord[]> =>
  deleteServiceConnectionRecord(getDatabase(), connectionId)
)

ipcMain.handle(
  'service:connection:test',
  async (_event, connectionId: string): Promise<{ ok: boolean; message: string; serviceCount: number }> => {
    const services = await syncServiceConnection(getDatabase(), connectionId)

    return {
      ok: true,
      message: `读取到 ${services.length} 个服务`,
      serviceCount: services.length
    }
  }
)

ipcMain.handle('service:services:list', async (): Promise<ProjectServiceRecord[]> => listAllProjectServiceRecords(getDatabase()))

ipcMain.handle('project:services:list', async (_event, projectId: string): Promise<ProjectServiceRecord[]> => listProjectServiceRecords(getDatabase(), projectId))

ipcMain.handle('project:service:save', async (_event, input: ProjectServiceInput): Promise<ProjectServiceRecord> => saveProjectServiceRecord(getDatabase(), input))

ipcMain.handle('service:external-project:alias:save', async (_event, input: ServiceExternalProjectAliasInput): Promise<ProjectServiceRecord[]> =>
  saveServiceExternalProjectAliasRecord(getDatabase(), input)
)

ipcMain.handle('project:service:bind', async (_event, input: { projectId: string; serviceId: string; repositoryId?: string }): Promise<ProjectServiceRecord[]> =>
  bindProjectServiceRecord(getDatabase(), input)
)

ipcMain.handle('project:services:sync', async (_event, connectionId?: string): Promise<ProjectServiceRecord[]> => {
  const connections = connectionId
    ? listServiceConnectionRecords(getDatabase()).filter((connection) => connection.id === connectionId)
    : listServiceConnectionRecords(getDatabase())

  for (const connection of connections) {
    await syncServiceConnection(getDatabase(), connection.id)
  }

  return listAllProjectServiceRecords(getDatabase())
})

ipcMain.handle('service:monitor:check', async (_event, projectId?: string): Promise<ProjectServiceRecord[]> => checkProjectServicesNow(projectId))

ipcMain.handle('service:monitor:latest', async (_event, projectId: string): Promise<ServiceMonitorCheckRecord[]> => listLatestServiceMonitorCheckRecords(getDatabase(), projectId))

ipcMain.handle('service:monitor:history', async (_event, projectId: string): Promise<ServiceMonitorCheckRecord[]> => listServiceMonitorHistoryRecords(getDatabase(), projectId))

ipcMain.handle('service:monitor:history:all', async (): Promise<ServiceMonitorCheckRecord[]> => listAllServiceMonitorHistoryRecords(getDatabase()))

ipcMain.handle('service:environment:logs', async (_event, serviceId: string, environmentName: string): Promise<ServiceEnvironmentLogRecord[]> =>
  listServiceEnvironmentLogRecords(getDatabase(), serviceId, environmentName)
)

ipcMain.handle(
  'service:deployments:list',
  async (_event, serviceId: string, options?: ServiceDeploymentListOptions): Promise<ServiceDeploymentSummary[]> =>
    listServiceDeploymentRecords(getDatabase(), serviceId, options)
)

ipcMain.handle(
  'service:deployment:action',
  async (_event, serviceId: string, input: VercelDeploymentActionInput): Promise<ProjectServiceRecord> =>
    runServiceDeploymentActionRecord(getDatabase(), serviceId, input)
)

ipcMain.handle('service:env:list', async (_event, serviceId: string): Promise<ServiceEnvVarRecord[]> => listServiceEnvVarRecords(getDatabase(), serviceId))

ipcMain.handle(
  'service:env:reveal',
  async (_event, serviceId: string, envVarId: string): Promise<ServiceEnvVarRecord> => revealServiceEnvVarRecord(getDatabase(), serviceId, envVarId)
)

ipcMain.handle(
  'service:env:save',
  async (_event, serviceId: string, input: VercelEnvVarInput): Promise<ServiceEnvVarRecord> => saveServiceEnvVarRecord(getDatabase(), serviceId, input)
)

ipcMain.handle('service:env:delete', async (_event, serviceId: string, envVarId: string): Promise<void> =>
  deleteServiceEnvVarRecord(getDatabase(), serviceId, envVarId)
)

ipcMain.handle(
  'service:domain:add',
  async (_event, serviceId: string, input: VercelDomainInput): Promise<ProjectServiceRecord> => addServiceDomainRecord(getDatabase(), serviceId, input)
)

ipcMain.handle(
  'service:domain:remove',
  async (_event, serviceId: string, domain: string, removeRedirects?: boolean): Promise<ProjectServiceRecord> =>
    removeServiceDomainRecord(getDatabase(), serviceId, domain, removeRedirects)
)

ipcMain.handle('service:domain:verify', async (_event, serviceId: string, domain: string): Promise<ProjectServiceRecord> =>
  verifyServiceDomainRecord(getDatabase(), serviceId, domain)
)

ipcMain.handle('service:domain:config', async (_event, serviceId: string, domain: string): Promise<VercelDomainConfig> =>
  inspectServiceDomainConfigRecord(getDatabase(), serviceId, domain)
)

ipcMain.handle('service:runtime:logs', async (_event, serviceId: string, environmentName: string): Promise<ServiceEnvironmentLogRecord[]> =>
  listServiceRuntimeLogRecords(getDatabase(), serviceId, environmentName)
)

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
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(path), kind)
  await deleteSshKeyFile(sshDirectory, normalizedPath, kind)

  if (kind === 'private') {
    await clearSshPassphrase(app.getPath('userData'), normalizedPath)
  }

  return getGitSetupStatus()
})

ipcMain.handle('ssh:save-private-key-passphrase', async (_event, path: string, passphrase: string): Promise<GitSetupStatus> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(path), 'private')
  await saveSshPassphrase(app.getPath('userData'), normalizedPath, passphrase)
  return getGitSetupStatus()
})

ipcMain.handle('ssh:clear-private-key-passphrase', async (_event, path: string): Promise<GitSetupStatus> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(path), 'private')
  await clearSshPassphrase(app.getPath('userData'), normalizedPath)
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

registerAppUpdateIpc()

ipcMain.handle('terminal:remote-groups:list', async (): Promise<TerminalRemoteGroupRecord[]> => listTerminalRemoteGroupRecords(getDatabase()))

ipcMain.handle('terminal:remote-group:save', async (_event, input: TerminalRemoteGroupInput): Promise<TerminalRemoteGroupRecord> => {
  return saveTerminalRemoteGroupRecord(getDatabase(), input)
})

ipcMain.handle('terminal:remote-group:delete', async (_event, groupId: string): Promise<TerminalRemoteGroupRecord[]> => {
  return deleteTerminalRemoteGroupRecord(getDatabase(), groupId)
})

ipcMain.handle('terminal:remote-hosts:list', async (): Promise<TerminalRemoteHostRecord[]> => listTerminalRemoteHostRecords(getDatabase()))

ipcMain.handle('terminal:remote-host:save', async (_event, input: TerminalRemoteHostInput): Promise<TerminalRemoteHostRecord> => {
  return saveTerminalRemoteHostRecord(getDatabase(), input)
})

ipcMain.handle('terminal:remote-host:delete', async (_event, hostId: string): Promise<TerminalRemoteHostRecord[]> => {
  return deleteTerminalRemoteHostRecord(getDatabase(), hostId)
})

ipcMain.handle('terminal:remote-host:ssh-command', async (_event, hostId: string): Promise<string> => {
  const host = listTerminalRemoteHostRecords(getDatabase()).find((item) => item.id === hostId)

  if (!host) {
    throw new Error('远程快捷连接不存在')
  }

  return buildTerminalRemoteSshCommand(host)
})

registerTerminalIpc(ipcMain, terminalService)

ipcMain.handle('external:open-git-download', async (): Promise<void> => {
  await shell.openExternal('https://git-scm.com/downloads')
})

ipcMain.handle('external:open-app-releases', async (): Promise<void> => {
  await shell.openExternal('https://github.com/IEatLemons/ForgeDesk/releases')
})

app.whenReady().then(() => {
  if (process.platform === 'darwin' && existsSync(appIconPath)) {
    app.dock?.setIcon(appIconPath)
  }

  createWindow()
  startServiceMonitorScheduler()

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
