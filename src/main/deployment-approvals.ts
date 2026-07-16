import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path'

export type DeploymentApprovalTarget = {
  targetId: string
  targetName: string
  rootDirectory: string
  triggerPath: string
  enabled: boolean
}

export type DeploymentApprovalConfig = {
  repositoryId: string
  remote: string
  branch: string
  authorName: string
  authorEmail: string
  targets: DeploymentApprovalTarget[]
  updatedAt: string
}

export type DeploymentApprovalCommit = {
  hash: string
  authorName: string
  authorEmail: string
  committedAt: string
  message: string
}

export type DeploymentApprovalFile = {
  path: string
  status: string
  additions: number
  deletions: number
  binary: boolean
  riskReasons: string[]
  targetIds: string[]
  patch: string
}

export type DeploymentApprovalAnalysis = {
  repositoryId: string
  remote: string
  branch: string
  reviewedHeadSha: string
  baselineSha: string
  baselineSource: 'approval' | 'manual'
  commits: DeploymentApprovalCommit[]
  files: DeploymentApprovalFile[]
  triggerPaths: string[]
  authorName: string
  authorEmail: string
  warnings: string[]
}

export type DeploymentApprovalHistory = {
  id: string
  repositoryId: string
  baselineSha: string
  sourceSha: string
  approvalCommitSha: string
  authorName: string
  authorEmail: string
  targetIds: string[]
  triggerPaths: string[]
  status: 'running' | 'succeeded' | 'failed'
  errorMessage: string
  createdAt: string
  finishedAt: string
}

export type DeploymentApprovalExecutionResult = {
  ok: boolean
  approval: DeploymentApprovalHistory
  stdout: string
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

export type DeploymentApprovalDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

type GitResult = { stdout: string; stderr: string }

type AnalyzeOptions = {
  db: DeploymentApprovalDatabase
  repositoryId: string
  localPath: string
  manualBaselineSha?: string
  env?: NodeJS.ProcessEnv
}

type ExecuteOptions = {
  db: DeploymentApprovalDatabase
  repositoryId: string
  localPath: string
  reviewedHeadSha: string
  baselineSha: string
  tempRoot: string
  env?: NodeJS.ProcessEnv
}

const REMOTE_PATTERN = /^[A-Za-z0-9._-]+$/
const REF_PATTERN = /^[A-Za-z0-9._/@:+-]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PATCH_LENGTH = 60_000

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeRelativePath(value: string, label: string, allowRoot = false): string {
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')

  if ((!normalized && !allowRoot) || isAbsolute(normalized) || normalized.includes('\0')) {
    throw new Error(`${label}必须是仓库内的相对路径`)
  }

  const segments = normalized.split('/').filter(Boolean)

  if (segments.includes('..') || segments.includes('.')) {
    throw new Error(`${label}不能包含 . 或 ..`)
  }

  return segments.join('/')
}

function normalizeRemote(value: string): string {
  const remote = value.trim()
  if (!REMOTE_PATTERN.test(remote)) throw new Error('审核远端名称无效')
  return remote
}

function normalizeBranch(value: string): string {
  const branch = value.trim()
  if (!REF_PATTERN.test(branch)) throw new Error('生产分支名称无效')
  return branch
}

function normalizeTarget(target: DeploymentApprovalTarget): DeploymentApprovalTarget {
  const rootDirectory = normalizeRelativePath(target.rootDirectory, '项目根目录', true)
  const configuredTrigger = normalizeRelativePath(target.triggerPath || '.forgedesk/deploy-trigger.json', '触发文件')
  const triggerPath = rootDirectory && !configuredTrigger.startsWith(`${rootDirectory}/`)
    ? posix.join(rootDirectory, configuredTrigger)
    : configuredTrigger

  const targetId = target.targetId.trim()
  if (!targetId) throw new Error('审核目标缺少 ID')

  return {
    targetId,
    targetName: target.targetName.trim() || targetId,
    rootDirectory,
    triggerPath,
    enabled: target.enabled !== false
  }
}

export function migrateDeploymentApprovalTables(db: DeploymentApprovalDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repository_deployment_approval_configs (
      repository_id TEXT PRIMARY KEY,
      remote TEXT NOT NULL DEFAULT 'origin',
      branch TEXT NOT NULL DEFAULT 'main',
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repository_deployment_approval_targets (
      repository_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL DEFAULT '',
      root_directory TEXT NOT NULL DEFAULT '',
      trigger_path TEXT NOT NULL DEFAULT '.forgedesk/deploy-trigger.json',
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (repository_id, target_id),
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repository_deployment_approvals (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      baseline_sha TEXT NOT NULL DEFAULT '',
      source_sha TEXT NOT NULL,
      approval_commit_sha TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      target_ids_json TEXT NOT NULL DEFAULT '[]',
      trigger_paths_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      finished_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_repository_deployment_approvals_repository_created
      ON repository_deployment_approvals(repository_id, created_at DESC);
  `)
}

export function getDeploymentApprovalConfig(db: DeploymentApprovalDatabase, repositoryId: string): DeploymentApprovalConfig | null {
  const row = db.prepare('SELECT * FROM repository_deployment_approval_configs WHERE repository_id = ?').get(repositoryId) as Record<string, unknown> | undefined
  if (!row) return null
  const targets = db.prepare('SELECT * FROM repository_deployment_approval_targets WHERE repository_id = ? ORDER BY target_name, target_id').all(repositoryId) as Record<string, unknown>[]

  return {
    repositoryId,
    remote: String(row.remote),
    branch: String(row.branch),
    authorName: String(row.author_name),
    authorEmail: String(row.author_email),
    updatedAt: String(row.updated_at),
    targets: targets.map((target) => ({
      targetId: String(target.target_id),
      targetName: String(target.target_name),
      rootDirectory: String(target.root_directory),
      triggerPath: String(target.trigger_path),
      enabled: Boolean(target.enabled)
    }))
  }
}

export function saveDeploymentApprovalConfig(db: DeploymentApprovalDatabase, input: DeploymentApprovalConfig): DeploymentApprovalConfig {
  const repositoryId = input.repositoryId.trim()
  const authorName = input.authorName.trim()
  const authorEmail = input.authorEmail.trim().toLowerCase()
  const targets = input.targets.map(normalizeTarget)

  if (!repositoryId || !authorName) throw new Error('请填写审核提交身份')
  if (!EMAIL_PATTERN.test(authorEmail)) throw new Error('审核提交邮箱格式不正确')
  if (targets.filter((target) => target.enabled).length === 0) throw new Error('请至少启用一个部署目标')
  if (new Set(targets.map((target) => target.targetId)).size !== targets.length) throw new Error('审核目标不能重复')
  const triggerPaths = targets.filter((target) => target.enabled).map((target) => target.triggerPath)
  if (triggerPaths.some((path) => path === '.git' || path.startsWith('.git/'))) throw new Error('触发文件不能位于 .git 目录')
  const updatedAt = nowIso()

  db.prepare(`
    INSERT INTO repository_deployment_approval_configs (repository_id, remote, branch, author_name, author_email, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository_id) DO UPDATE SET remote = excluded.remote, branch = excluded.branch,
      author_name = excluded.author_name, author_email = excluded.author_email, updated_at = excluded.updated_at
  `).run(repositoryId, normalizeRemote(input.remote), normalizeBranch(input.branch), authorName, authorEmail, updatedAt)
  db.prepare('DELETE FROM repository_deployment_approval_targets WHERE repository_id = ?').run(repositoryId)
  const insert = db.prepare(`
    INSERT INTO repository_deployment_approval_targets
      (repository_id, target_id, target_name, root_directory, trigger_path, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const target of targets) insert.run(repositoryId, target.targetId, target.targetName, target.rootDirectory, target.triggerPath, target.enabled ? 1 : 0)

  return getDeploymentApprovalConfig(db, repositoryId) as DeploymentApprovalConfig
}

function mapHistory(row: Record<string, unknown>): DeploymentApprovalHistory {
  return {
    id: String(row.id), repositoryId: String(row.repository_id), baselineSha: String(row.baseline_sha), sourceSha: String(row.source_sha),
    approvalCommitSha: String(row.approval_commit_sha), authorName: String(row.author_name), authorEmail: String(row.author_email),
    targetIds: JSON.parse(String(row.target_ids_json || '[]')), triggerPaths: JSON.parse(String(row.trigger_paths_json || '[]')),
    status: String(row.status) as DeploymentApprovalHistory['status'], errorMessage: String(row.error_message),
    createdAt: String(row.created_at), finishedAt: String(row.finished_at)
  }
}

export function listDeploymentApprovals(db: DeploymentApprovalDatabase, repositoryId: string): DeploymentApprovalHistory[] {
  return (db.prepare('SELECT * FROM repository_deployment_approvals WHERE repository_id = ? ORDER BY created_at DESC LIMIT 100').all(repositoryId) as Record<string, unknown>[]).map(mapHistory)
}

async function git(localPath: string, args: string[], env?: NodeJS.ProcessEnv, timeout = 60_000): Promise<GitResult> {
  return new Promise((resolveResult, reject) => {
    execFile('git', ['-C', localPath, ...args], { env: { ...process.env, ...env }, timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr).trim() || error.message))
        return
      }
      resolveResult({ stdout: String(stdout).trim(), stderr: String(stderr).trim() })
    })
  })
}

async function isAncestor(localPath: string, ancestor: string, head: string): Promise<boolean> {
  try {
    await git(localPath, ['merge-base', '--is-ancestor', ancestor, head])
    return true
  } catch {
    return false
  }
}

function getEnabledTargets(config: DeploymentApprovalConfig): DeploymentApprovalTarget[] {
  const targets = config.targets.filter((target) => target.enabled)
  if (!targets.length) throw new Error('审核配置没有启用的部署目标')
  return targets
}

async function resolveBaseline(db: DeploymentApprovalDatabase, localPath: string, repositoryId: string, head: string, manual?: string): Promise<{ sha: string; source: DeploymentApprovalAnalysis['baselineSource'] }> {
  if (manual?.trim()) {
    const requestedSha = manual.trim()
    if (!/^[0-9a-f]{7,40}$/i.test(requestedSha)) throw new Error('手工审核基线必须是提交 SHA')
    const sha = (await git(localPath, ['rev-parse', '--verify', `${requestedSha}^{commit}`])).stdout
    if (!(await isAncestor(localPath, sha, head))) throw new Error('手工审核基线不是当前 main 的祖先提交')
    return { sha, source: 'manual' }
  }

  const approval = db.prepare(`
    SELECT approval_commit_sha FROM repository_deployment_approvals
    WHERE repository_id = ? AND status = 'succeeded' AND approval_commit_sha != '' ORDER BY created_at DESC LIMIT 1
  `).get(repositoryId) as Record<string, unknown> | undefined
  const approvedSha = String(approval?.approval_commit_sha ?? '')
  if (approvedSha && await isAncestor(localPath, approvedSha, head)) return { sha: approvedSha, source: 'approval' }
  throw new Error('首次审核尚无成功审核基线，请选择一个目标分支历史提交作为审核起点')
}

function getRiskReasons(path: string, status: string, binary: boolean, patchLength: number): string[] {
  const lower = path.toLowerCase()
  const risks: string[] = []
  if (binary) risks.push('二进制文件')
  if (status.startsWith('D')) risks.push('删除文件')
  if (patchLength >= MAX_PATCH_LENGTH) risks.push('大型变更')
  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/.test(lower)) risks.push('依赖锁文件')
  if (/(^|\/)(\.env($|\.)|.*\.pem$|.*\.key$)/.test(lower)) risks.push('敏感配置')
  if (/(^|\/)(\.github\/workflows|\.gitlab-ci|\.circleci)(\/|\.|$)/.test(lower)) risks.push('CI 配置')
  return risks
}

function targetIdsForPath(path: string, targets: DeploymentApprovalTarget[]): string[] {
  return targets.filter((target) => !target.rootDirectory || path === target.rootDirectory || path.startsWith(`${target.rootDirectory}/`)).map((target) => target.targetId)
}

export async function analyzeDeploymentApproval(options: AnalyzeOptions): Promise<DeploymentApprovalAnalysis> {
  const config = getDeploymentApprovalConfig(options.db, options.repositoryId)
  if (!config) throw new Error('请先配置快速审核')
  const targets = getEnabledTargets(config)
  await git(options.localPath, ['fetch', config.remote, '--prune'], options.env)
  const remoteRef = `refs/remotes/${config.remote}/${config.branch}`
  const head = (await git(options.localPath, ['rev-parse', '--verify', remoteRef])).stdout
  const baseline = await resolveBaseline(options.db, options.localPath, options.repositoryId, head, options.manualBaselineSha)
  if (baseline.sha === head) throw new Error('当前 main 与审核基线相同，没有待审核改动')

  const logOutput = (await git(options.localPath, ['log', '--reverse', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s', `${baseline.sha}..${head}`])).stdout
  const commits = logOutput ? logOutput.split('\n').map((line) => {
    const [hash, authorName, authorEmail, committedAt, message] = line.split('\u001f')
    return { hash, authorName, authorEmail, committedAt, message }
  }) : []
  const statusOutput = (await git(options.localPath, ['diff', '--name-status', '-M', baseline.sha, head])).stdout
  const files: DeploymentApprovalFile[] = []

  for (const line of statusOutput.split('\n').filter(Boolean)) {
    const [status, ...pathParts] = line.split('\t')
    const path = pathParts[pathParts.length - 1]
    const numstat = (await git(options.localPath, ['diff', '--numstat', baseline.sha, head, '--', path])).stdout.split('\t')
    const binary = numstat[0] === '-' || numstat[1] === '-'
    const rawPatch = (await git(options.localPath, ['diff', '--no-ext-diff', '--unified=3', baseline.sha, head, '--', path])).stdout
    const patch = rawPatch.length > MAX_PATCH_LENGTH ? `${rawPatch.slice(0, MAX_PATCH_LENGTH)}\n… diff 已截断` : rawPatch
    files.push({
      path, status, additions: binary ? 0 : Number(numstat[0] || 0), deletions: binary ? 0 : Number(numstat[1] || 0), binary,
      riskReasons: getRiskReasons(path, status, binary, rawPatch.length), targetIds: targetIdsForPath(path, targets), patch
    })
  }

  const warnings = files.flatMap((file) => file.riskReasons.map((reason) => `${file.path}：${reason}`))
  return {
    repositoryId: options.repositoryId, remote: config.remote, branch: config.branch, reviewedHeadSha: head,
    baselineSha: baseline.sha, baselineSource: baseline.source, commits, files,
    triggerPaths: [...new Set(targets.map((target) => target.triggerPath))].sort(),
    authorName: config.authorName, authorEmail: config.authorEmail, warnings
  }
}

async function assertNoSymlinkPath(worktreePath: string, relativePath: string): Promise<string> {
  const absolutePath = resolve(worktreePath, ...relativePath.split('/'))
  const within = relative(worktreePath, absolutePath)
  if (!within || within.startsWith(`..${sep}`) || isAbsolute(within)) throw new Error('触发文件路径越出临时工作树')
  let current = worktreePath
  for (const segment of relativePath.split('/').slice(0, -1)) {
    current = join(current, segment)
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`触发文件父目录不能是符号链接：${relativePath}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break
      throw error
    }
  }
  try {
    if ((await lstat(absolutePath)).isSymbolicLink()) throw new Error(`触发文件不能是符号链接：${relativePath}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return absolutePath
}

async function writeTriggerFiles(worktreePath: string, config: DeploymentApprovalConfig, sourceSha: string, approvedAt: string): Promise<string[]> {
  const targets = getEnabledTargets(config)
  const grouped = new Map<string, DeploymentApprovalTarget[]>()
  for (const target of targets) grouped.set(target.triggerPath, [...(grouped.get(target.triggerPath) ?? []), target])

  for (const [triggerPath, pathTargets] of grouped) {
    const absolutePath = await assertNoSymlinkPath(worktreePath, triggerPath)
    try {
      const existing = JSON.parse(await readFile(absolutePath, 'utf8')) as Record<string, unknown>
      if (existing.schemaVersion !== 1) throw new Error(`已有触发文件不是 ForgeDesk v1 格式：${triggerPath}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await mkdir(resolve(absolutePath, '..'), { recursive: true })
    await writeFile(absolutePath, `${JSON.stringify({
      schemaVersion: 1, approvedSource: sourceSha, approvedAt,
      approvedBy: { name: config.authorName, email: config.authorEmail },
      targets: pathTargets.map((target) => ({ id: target.targetId, name: target.targetName })).sort((a, b) => a.id.localeCompare(b.id))
    }, null, 2)}\n`, 'utf8')
  }
  return [...grouped.keys()].sort()
}

export async function executeDeploymentApproval(options: ExecuteOptions): Promise<DeploymentApprovalExecutionResult> {
  const config = getDeploymentApprovalConfig(options.db, options.repositoryId)
  if (!config) throw new Error('请先配置快速审核')
  const targets = getEnabledTargets(config)
  const reviewedHeadSha = options.reviewedHeadSha.trim()
  if (!/^[0-9a-f]{40}$/i.test(reviewedHeadSha)) throw new Error('审核 SHA 无效，请重新分析')
  if (!/^[0-9a-f]{40}$/i.test(options.baselineSha.trim())) throw new Error('审核基线 SHA 无效，请重新分析')
  const id = randomUUID()
  const createdAt = nowIso()
  const triggerPaths = [...new Set(targets.map((target) => target.triggerPath))].sort()
  const targetIds = targets.map((target) => target.targetId)
  options.db.prepare(`
    INSERT INTO repository_deployment_approvals
      (id, repository_id, source_sha, author_name, author_email, target_ids_json, trigger_paths_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)
  `).run(id, options.repositoryId, reviewedHeadSha, config.authorName, config.authorEmail, JSON.stringify(targetIds), JSON.stringify(triggerPaths), createdAt)

  let tempDirectory = ''
  let worktreePath = ''
  try {
    await git(options.localPath, ['fetch', config.remote, '--prune'], options.env)
    const remoteRef = `refs/remotes/${config.remote}/${config.branch}`
    const currentHead = (await git(options.localPath, ['rev-parse', '--verify', remoteRef])).stdout
    if (currentHead !== reviewedHeadSha) throw new Error('远端目标分支已更新，本次审核已过期，请重新审核')
    const baseline = await resolveBaseline(options.db, options.localPath, options.repositoryId, reviewedHeadSha, options.baselineSha)
    tempDirectory = await mkdtemp(join(options.tempRoot, 'forgedesk-approval-'))
    worktreePath = join(tempDirectory, 'worktree')
    await git(options.localPath, ['worktree', 'add', '--detach', worktreePath, reviewedHeadSha])
    const approvedAt = nowIso()
    const writtenPaths = await writeTriggerFiles(worktreePath, config, reviewedHeadSha, approvedAt)
    await git(worktreePath, ['add', '--', ...writtenPaths])
    const stagedPaths = (await git(worktreePath, ['diff', '--cached', '--name-only'])).stdout.split('\n').filter(Boolean).sort()
    if (JSON.stringify(stagedPaths) !== JSON.stringify(writtenPaths)) throw new Error('暂存内容超出审核触发文件范围')
    const message = [
      `chore(review): approve ${reviewedHeadSha.slice(0, 7)} for deployment`, '',
      `ForgeDesk-Approved-Commit: ${reviewedHeadSha}`,
      `ForgeDesk-Approved-By: ${config.authorName} <${config.authorEmail}>`,
      `ForgeDesk-Targets: ${targetIds.sort().join(',')}`
    ].join('\n')
    const identityEnv = {
      ...options.env, GIT_AUTHOR_NAME: config.authorName, GIT_AUTHOR_EMAIL: config.authorEmail,
      GIT_COMMITTER_NAME: config.authorName, GIT_COMMITTER_EMAIL: config.authorEmail
    }
    await git(worktreePath, ['commit', '-m', message], identityEnv)
    const approvalCommitSha = (await git(worktreePath, ['rev-parse', 'HEAD'])).stdout
    await git(options.localPath, ['fetch', config.remote, '--prune'], options.env)
    const latestHead = (await git(options.localPath, ['rev-parse', '--verify', remoteRef])).stdout
    if (latestHead !== reviewedHeadSha) throw new Error('远端目标分支在提交期间发生更新，已停止推送，请重新审核')
    const push = await git(worktreePath, ['push', config.remote, `HEAD:refs/heads/${config.branch}`], options.env, 120_000)
    const finishedAt = nowIso()
    options.db.prepare(`
      UPDATE repository_deployment_approvals SET baseline_sha = ?, approval_commit_sha = ?, status = 'succeeded', finished_at = ? WHERE id = ?
    `).run(baseline.sha, approvalCommitSha, finishedAt, id)
    const approval = mapHistory(options.db.prepare('SELECT * FROM repository_deployment_approvals WHERE id = ?').get(id) as Record<string, unknown>)
    return { ok: true, approval, stdout: push.stdout || push.stderr }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    options.db.prepare(`UPDATE repository_deployment_approvals SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?`).run(message, nowIso(), id)
    throw error
  } finally {
    if (worktreePath) await git(options.localPath, ['worktree', 'remove', '--force', worktreePath]).catch(() => undefined)
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true })
  }
}
