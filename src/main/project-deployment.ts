import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, relative, resolve } from 'node:path'

export type DeploymentProviderType = 'vercel' | 'railway' | 'ssh-pm2' | 'docker-compose'
export type DeploymentSourceMode = 'git' | 'local'
export type DeploymentTargetStatus = 'draft' | 'ready' | 'attention'
export type ProjectDeploymentTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
export type DeploymentEnvSource = 'provider' | 'local' | 'manual'

export type DeploymentEnvBinding = {
  key: string
  source: DeploymentEnvSource
  required: boolean
  configured: boolean
}

export type ProjectDeploymentConfig = {
  repositoryId: string
  provider: DeploymentProviderType
  sourceMode: DeploymentSourceMode
  rootDirectory: string
  branch: string
  installCommand: string
  buildCommand: string
  outputDirectory: string
  framework: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | ''
  runtimeVersion: string
  startCommand: string
  port: string
  healthPath: string
  remoteHost: string
  remotePath: string
  uploadPath: string
  appName: string
  dockerContext: string
  dockerfile: string
  composeFile: string
  composeService: string
  envBindings: DeploymentEnvBinding[]
  extra: Record<string, string>
}

export type ProjectDeploymentTarget = {
  id: string
  projectId: string
  repositoryId: string
  provider: DeploymentProviderType
  connectionId: string
  serviceId: string
  externalProjectId: string
  externalProjectName: string
  externalServiceId: string
  externalServiceName: string
  externalEnvironmentId: string
  externalEnvironmentName: string
  displayName: string
  status: DeploymentTargetStatus
  latestDeploymentId: string
  latestDeploymentUrl: string
  lastStatus: string
  lastError: string
  createdAt: string
  updatedAt: string
  config: ProjectDeploymentConfig
}

export type ProjectDeploymentTargetInput = Partial<Omit<ProjectDeploymentTarget, 'config'>> & {
  projectId: string
  repositoryId: string
  provider: DeploymentProviderType
  config: Partial<ProjectDeploymentConfig>
}

export type DeploymentProviderCapabilities = {
  provider: DeploymentProviderType
  label: string
  supportsGit: boolean
  supportsLocal: boolean
  supportsCreateTarget: boolean
  supportsBuildConfig: boolean
  supportsCancel: boolean
  configFields: string[]
  platformManagedFields: string[]
}

export type DeploymentContextFile = {
  path: string
  category: 'manifest' | 'documentation' | 'build' | 'source' | 'container'
  sizeBytes: number
  includedInAi: boolean
  redacted: boolean
}

export type DeploymentInspection = {
  repositoryId: string
  repositoryName: string
  localPath: string
  currentBranch: string
  defaultBranch: string
  branches: string[]
  remoteBranches: string[]
  remoteUrl: string
  files: DeploymentContextFile[]
  detected: {
    framework: string
    packageManager: ProjectDeploymentConfig['packageManager']
    scripts: Record<string, string>
    nodeVersion: string
    pythonVersion: string
    hasDockerfile: boolean
    hasCompose: boolean
    hasReadme: boolean
    hasEnvironmentExample: boolean
  }
  aiContext: string
}

export type ProjectDeploymentSuggestion = {
  config: ProjectDeploymentConfig
  confidence: number
  reasons: string[]
  warnings: string[]
  sources: string[]
}

export type ProjectDeploymentPreparation = {
  target: ProjectDeploymentTarget | null
  config: ProjectDeploymentConfig
  capabilities: DeploymentProviderCapabilities
  issues: string[]
  warnings: string[]
  previewCommand: string
  ready: boolean
}

export type ProjectDeploymentTaskSnapshot = {
  id: string
  projectId: string
  targetId: string
  repositoryId: string
  targetName: string
  provider: DeploymentProviderType
  sourceMode: DeploymentSourceMode
  status: ProjectDeploymentTaskStatus
  phase: string
  phaseIndex: number
  phaseTotal: number
  hint: string
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  error?: string
  externalDeploymentId?: string
  externalDeploymentUrl?: string
  externalStatus?: string
  artifactPath?: string
  config: ProjectDeploymentConfig
  startedAt: string
  updatedAt: string
  finishedAt?: string
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

type DeploymentRepositoryInput = {
  repositoryId: string
  repositoryName: string
  localPath: string
  currentBranch: string
  defaultBranch: string
  branches: string[]
  remoteBranches: string[]
  remoteUrl: string
}

const providerCapabilities: Record<DeploymentProviderType, DeploymentProviderCapabilities> = {
  vercel: {
    provider: 'vercel',
    label: 'Vercel',
    supportsGit: true,
    supportsLocal: true,
    supportsCreateTarget: true,
    supportsBuildConfig: true,
    supportsCancel: true,
    configFields: ['rootDirectory', 'branch', 'installCommand', 'buildCommand', 'outputDirectory', 'framework', 'runtimeVersion'],
    platformManagedFields: []
  },
  railway: {
    provider: 'railway',
    label: 'Railway',
    supportsGit: true,
    supportsLocal: false,
    supportsCreateTarget: false,
    supportsBuildConfig: false,
    supportsCancel: true,
    configFields: ['branch', 'rootDirectory', 'buildCommand'],
    platformManagedFields: ['installCommand', 'buildCommand', 'outputDirectory', 'framework', 'runtimeVersion']
  },
  'ssh-pm2': {
    provider: 'ssh-pm2',
    label: 'SSH / PM2',
    supportsGit: false,
    supportsLocal: true,
    supportsCreateTarget: true,
    supportsBuildConfig: true,
    supportsCancel: true,
    configFields: ['rootDirectory', 'installCommand', 'buildCommand', 'remoteHost', 'remotePath', 'uploadPath', 'appName', 'port', 'startCommand'],
    platformManagedFields: []
  },
  'docker-compose': {
    provider: 'docker-compose',
    label: 'Docker / Compose',
    supportsGit: false,
    supportsLocal: true,
    supportsCreateTarget: true,
    supportsBuildConfig: true,
    supportsCancel: true,
    configFields: ['rootDirectory', 'dockerContext', 'dockerfile', 'composeFile', 'composeService', 'remoteHost', 'remotePath'],
    platformManagedFields: []
  }
}

const ignoredDirectoryNames = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', '.turbo', 'coverage', '.cache', 'vendor'])
const candidateFilePattern = /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|pyproject\.toml|requirements\.txt|Pipfile|Dockerfile(?:\..*)?|docker-compose(?:\..*)?\.ya?ml|compose(?:\..*)?\.ya?ml|README(?:\..*)?|\.nvmrc|\.node-version|\.python-version|vercel\.json|railway\.toml|nixpacks\.toml|vite\.config\..*|next\.config\..*|nuxt\.config\..*|svelte\.config\..*|\.env\.example|\.env\.sample|\.gitlab-ci\.yml|bitbucket-pipelines\.yml|\.github\/workflows\/[^/]+\.ya?ml|turbo\.json)$/i
const sourceFilePattern = /(^|\/)(src|app|pages|server|api|lib|cmd|scripts)\/[^/]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs)$/i
const secretPattern = /(api[_-]?key|token|secret|password|private[_-]?key|access[_-]?key|authorization|BEGIN (?:RSA|OPENSSH|EC|PRIVATE))/i

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function trimText(value: unknown): string {
  return String(value ?? '').trim()
}

function parseJsonObject<T extends object>(value: unknown, fallback: T): T {
  if (!value) return fallback

  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : fallback
  } catch {
    return fallback
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function normalizeProvider(value: unknown): DeploymentProviderType {
  return value === 'railway' || value === 'ssh-pm2' || value === 'docker-compose' ? value : 'vercel'
}

function normalizeSourceMode(value: unknown): DeploymentSourceMode {
  return value === 'local' ? 'local' : 'git'
}

function detectPackageManager(localPath: string, names: string[]): ProjectDeploymentConfig['packageManager'] {
  if (names.includes('pnpm-lock.yaml')) return 'pnpm'
  if (names.includes('yarn.lock')) return 'yarn'
  if (names.includes('bun.lockb')) return 'bun'
  if (names.includes('package-lock.json')) return 'npm'

  return names.includes('package.json') && localPath ? 'npm' : ''
}

function readScriptCommand(scripts: Record<string, string>, key: string): string {
  return trimText(scripts[key])
}

function inferFramework(packageJson: Record<string, unknown>, files: string[]): string {
  const dependencies = {
    ...(packageJson.dependencies && typeof packageJson.dependencies === 'object' ? packageJson.dependencies as Record<string, unknown> : {}),
    ...(packageJson.devDependencies && typeof packageJson.devDependencies === 'object' ? packageJson.devDependencies as Record<string, unknown> : {})
  }

  if (dependencies.next || files.some((file) => /(^|\/)next\.config\./i.test(file))) return 'nextjs'
  if (dependencies.nuxt || files.some((file) => /(^|\/)nuxt\.config\./i.test(file))) return 'nuxt'
  if (dependencies.svelte || dependencies['@sveltejs/kit']) return 'svelte'
  if (dependencies.react) return 'react'
  if (dependencies.vue) return 'vue'
  if (dependencies['@angular/core']) return 'angular'
  if (dependencies.vite || files.some((file) => /(^|\/)vite\.config\./i.test(file))) return 'vite'

  return ''
}

function redactForAi(value: string): { text: string; redacted: boolean } {
  let redacted = false
  const text = value
    .split(/\r?\n/)
    .filter((line) => {
      if (secretPattern.test(line) || /^\s*(?:[A-Z0-9_]+)\s*=\s*.+/.test(line) && !/^\s*(?:NODE_ENV|PORT|HOST)\s*=/.test(line)) {
        redacted = true
        return false
      }
      return true
    })
    .join('\n')
    .replace(/https?:\/\/[^\s"']+/g, (url) => {
      if (secretPattern.test(url)) {
        redacted = true
        return '[REDACTED_URL]'
      }
      return url
    })

  return { text: text.slice(0, 12000), redacted }
}

async function collectFiles(root: string, current = root, depth = 0): Promise<string[]> {
  if (depth > 4) return []

  let entries
  try {
    entries = await readdir(current, { withFileTypes: true })
  } catch {
    return []
  }

  const files: string[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') && !['.github', '.circleci'].includes(entry.name)) continue
      if (ignoredDirectoryNames.has(entry.name)) continue
      files.push(...await collectFiles(root, resolve(current, entry.name), depth + 1))
      continue
    }

    const relativePath = relative(root, resolve(current, entry.name)).replaceAll('\\', '/')
    if (candidateFilePattern.test(relativePath) || sourceFilePattern.test(relativePath)) files.push(relativePath)
  }

  return files
}

function categoryForFile(path: string): DeploymentContextFile['category'] {
  if (/Dockerfile|compose|docker-compose/i.test(path)) return 'container'
  if (/README/i.test(path)) return 'documentation'
  if (/package|lock|pyproject|requirements|Pipfile/i.test(path)) return 'manifest'
  if (/config|\.nvmrc|\.node-version|\.python-version|vercel|railway|nixpacks|\.env\./i.test(path)) return 'build'
  return 'source'
}

function createDefaultDeploymentConfig(
  inspection: Pick<DeploymentInspection, 'repositoryId' | 'repositoryName' | 'currentBranch' | 'defaultBranch' | 'detected'>,
  provider: DeploymentProviderType,
  sourceMode: DeploymentSourceMode
): ProjectDeploymentConfig {
  const packageManager = inspection.detected.packageManager
  const installCommand = packageManager === ''
    ? ''
    : packageManager === 'pnpm'
    ? 'pnpm install --frozen-lockfile'
    : packageManager === 'yarn'
      ? 'yarn install --frozen-lockfile'
      : packageManager === 'bun'
        ? 'bun install --frozen-lockfile'
        : 'npm install'
  const buildCommand = readScriptCommand(inspection.detected.scripts, 'build')
  const framework = inspection.detected.framework
  const outputDirectory = framework === 'vite' || framework === 'react' || framework === 'vue' ? 'dist' : framework === 'angular' ? 'dist' : ''
  const appName = inspection.repositoryName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'app'

  return {
    repositoryId: inspection.repositoryId,
    provider,
    sourceMode,
    rootDirectory: '',
    branch: inspection.currentBranch || inspection.defaultBranch || 'main',
    installCommand,
    buildCommand,
    outputDirectory,
    framework,
    packageManager,
    runtimeVersion: inspection.detected.nodeVersion,
    startCommand: readScriptCommand(inspection.detected.scripts, 'start'),
    port: '3000',
    healthPath: '/',
    remoteHost: '',
    remotePath: `/var/www/${appName}`,
    uploadPath: '/tmp/forgedesk-releases',
    appName,
    dockerContext: '.',
    dockerfile: 'Dockerfile',
    composeFile: inspection.detected.hasCompose ? 'docker-compose.yml' : '',
    composeService: '',
    envBindings: [],
    extra: {
      ...(provider === 'railway' ? { note: 'Railway 构建配置以平台项目设置为准' } : {}),
      ...(sourceMode === 'git' ? { source: 'remote-git' } : {})
    }
  }
}

function normalizeConfig(input: Partial<ProjectDeploymentConfig>, fallback: ProjectDeploymentConfig): ProjectDeploymentConfig {
  const packageManager = input.packageManager === 'pnpm' || input.packageManager === 'yarn' || input.packageManager === 'bun' || input.packageManager === 'npm'
    ? input.packageManager
    : fallback.packageManager

  return {
    ...fallback,
    ...input,
    provider: normalizeProvider(input.provider ?? fallback.provider),
    sourceMode: normalizeSourceMode(input.sourceMode ?? fallback.sourceMode),
    packageManager,
    rootDirectory: trimText(input.rootDirectory ?? fallback.rootDirectory).replaceAll('\\', '/').replace(/^\.\//, ''),
    envBindings: Array.isArray(input.envBindings)
      ? input.envBindings.flatMap((item) => item && trimText(item.key) ? [{
          key: trimText(item.key),
          source: item.source === 'local' || item.source === 'manual' ? item.source : 'provider',
          required: item.required !== false,
          configured: Boolean(item.configured)
        }] : [])
      : fallback.envBindings,
    extra: input.extra && typeof input.extra === 'object' ? Object.fromEntries(Object.entries(input.extra).map(([key, value]) => [key, trimText(value)])) : fallback.extra
  }
}

export function getDeploymentProviderCapabilities(provider: DeploymentProviderType): DeploymentProviderCapabilities {
  return providerCapabilities[provider]
}

export function getDefaultDeploymentConfig(
  inspection: DeploymentInspection,
  provider: DeploymentProviderType,
  sourceMode: DeploymentSourceMode
): ProjectDeploymentConfig {
  return createDefaultDeploymentConfig(inspection, provider, sourceMode)
}

export function validateProjectDeploymentConfig(
  config: ProjectDeploymentConfig,
  inspection: DeploymentInspection,
  target?: ProjectDeploymentTarget | null
): { issues: string[]; warnings: string[]; previewCommand: string } {
  const issues: string[] = []
  const warnings: string[] = []
  const capabilities = getDeploymentProviderCapabilities(config.provider)
  const root = config.rootDirectory.trim()

  if (config.sourceMode === 'git' && !capabilities.supportsGit) issues.push(`${capabilities.label} 暂不支持 Git 构建发布`)
  if (config.sourceMode === 'local' && !capabilities.supportsLocal) issues.push(`${capabilities.label} 暂不支持本地构建上传`)
  if (root === '..' || root.startsWith('../') || root.includes('/../') || root.startsWith('/')) issues.push('Root Directory 必须是仓库内的相对目录')
  if (config.branch && inspection.branches.length + inspection.remoteBranches.length > 0 && !new Set([...inspection.branches, ...inspection.remoteBranches]).has(config.branch)) {
    warnings.push(`未在本地缓存中找到分支 ${config.branch}，发布前请确认远端分支存在`)
  }
  if (config.sourceMode === 'git' && !inspection.remoteUrl.trim()) issues.push('Git 构建需要配置远端仓库地址')
  if (config.sourceMode === 'local' && !config.buildCommand.trim() && !config.composeFile.trim()) warnings.push('没有检测到构建命令，发布时可能只会上传原始文件')
  if (config.provider === 'vercel' && config.sourceMode === 'local' && !config.outputDirectory.trim()) issues.push('Vercel 本地静态发布需要填写 Output Directory')
  if (config.provider === 'ssh-pm2') {
    if (!config.remoteHost.trim()) issues.push('SSH/PM2 需要填写远程主机')
    if (!config.remotePath.trim()) issues.push('SSH/PM2 需要填写远程部署目录')
    if (!config.appName.trim()) issues.push('SSH/PM2 需要填写应用名')
  }
  if (config.provider === 'docker-compose') {
    if (!config.remoteHost.trim()) issues.push('Docker/Compose 需要填写远程主机')
    if (!config.composeFile.trim() && !config.dockerfile.trim()) issues.push('Docker/Compose 需要填写 Dockerfile 或 Compose 文件')
  }
  if (config.provider === 'vercel' || config.provider === 'railway') {
    if (!target?.connectionId) warnings.push('还没有绑定平台连接，请先在服务中心配置并选择连接')
    if (!target?.serviceId) issues.push(`还没有绑定已有 ${config.provider === 'vercel' ? 'Vercel' : 'Railway'} 服务，请先在项目设置 / 服务配置中完成实际绑定`)
  }

  const sourcePath = root ? `${root}/` : ''
  const command = config.sourceMode === 'local'
    ? [config.installCommand, config.buildCommand].filter(Boolean).join(' && ')
    : `平台从 ${config.branch || '默认分支'} 拉取 ${sourcePath || '仓库根目录'}`

  return { issues, warnings, previewCommand: command || '未配置执行命令' }
}

export async function inspectProjectDeploymentContext(input: DeploymentRepositoryInput): Promise<DeploymentInspection> {
  const root = resolve(input.localPath)
  const relativeFiles = await collectFiles(root)
  const packageFiles = relativeFiles
    .filter((file) => basename(file).toLowerCase() === 'package.json')
    .sort((left, right) => (left === 'package.json' ? -1 : right === 'package.json' ? 1 : left.localeCompare(right)))
  let packageJson: Record<string, unknown> = {}

  for (const packageFile of packageFiles.slice(0, 8)) {
    try {
      const parsed = JSON.parse(await readFile(resolve(root, packageFile), 'utf8')) as Record<string, unknown>
      packageJson = {
        ...parsed,
        ...packageJson,
        dependencies: {
          ...(parsed.dependencies && typeof parsed.dependencies === 'object' ? parsed.dependencies as Record<string, unknown> : {}),
          ...(packageJson.dependencies && typeof packageJson.dependencies === 'object' ? packageJson.dependencies as Record<string, unknown> : {})
        },
        devDependencies: {
          ...(parsed.devDependencies && typeof parsed.devDependencies === 'object' ? parsed.devDependencies as Record<string, unknown> : {}),
          ...(packageJson.devDependencies && typeof packageJson.devDependencies === 'object' ? packageJson.devDependencies as Record<string, unknown> : {})
        },
        scripts: {
          ...(parsed.scripts && typeof parsed.scripts === 'object' ? parsed.scripts as Record<string, unknown> : {}),
          ...(packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts as Record<string, unknown> : {})
        }
      }
    } catch {
      // Keep scanning the remaining workspace manifests.
    }
  }

  const scriptsValue = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts as Record<string, unknown> : {}
  const scripts = Object.fromEntries(Object.entries(scriptsValue).flatMap(([key, value]) => typeof value === 'string' ? [[key, value] as const] : []))
  const packageManager = detectPackageManager(root, relativeFiles.map((file) => basename(file)))
  const framework = inferFramework(packageJson, relativeFiles)
  const sourceCandidates = relativeFiles.filter((file) => sourceFilePattern.test(file)).slice(0, 12)
  const selectedFiles = relativeFiles.filter((file) => !sourceFilePattern.test(file) || sourceCandidates.includes(file)).slice(0, 80)
  const files: DeploymentContextFile[] = []
  const contextParts: string[] = []
  let aiBytes = 0

  for (const file of selectedFiles) {
    let sizeBytes = 0
    try {
      sizeBytes = (await stat(resolve(root, file))).size
    } catch {
      continue
    }

    const category = categoryForFile(file)
    const shouldRead = aiBytes < 48000 && sizeBytes <= 256 * 1024
    let includedInAi = false
    let redacted = false

    if (shouldRead) {
      try {
        const content = await readFile(resolve(root, file), 'utf8')
        const safe = redactForAi(content)
        redacted = safe.redacted
        const part = `--- ${file} ---\n${safe.text}`
        if (aiBytes + part.length <= 48000) {
          contextParts.push(part)
          aiBytes += part.length
          includedInAi = true
        }
      } catch {
        // Binary or unreadable files stay in the inventory only.
      }
    }

    files.push({ path: file, category, sizeBytes, includedInAi, redacted })
  }

  const nodeVersion = relativeFiles.find((file) => file === '.nvmrc' || file === '.node-version')
    ? await readFile(resolve(root, relativeFiles.find((file) => file === '.nvmrc' || file === '.node-version') as string), 'utf8').then((value) => value.trim()).catch(() => '')
    : ''
  const pythonVersion = relativeFiles.find((file) => file === '.python-version')
    ? await readFile(resolve(root, '.python-version'), 'utf8').then((value) => value.trim()).catch(() => '')
    : ''
  const readme = relativeFiles.find((file) => /^README(?:\..*)?$/i.test(file))
  const envExample = relativeFiles.some((file) => /^\.env\.(?:example|sample)$/i.test(file))

  const inspection: DeploymentInspection = {
    repositoryId: input.repositoryId,
    repositoryName: input.repositoryName,
    localPath: root,
    currentBranch: input.currentBranch,
    defaultBranch: input.defaultBranch,
    branches: input.branches,
    remoteBranches: input.remoteBranches,
    remoteUrl: input.remoteUrl,
    files,
    detected: {
      framework,
      packageManager,
      scripts,
      nodeVersion,
      pythonVersion,
      hasDockerfile: relativeFiles.some((file) => /^Dockerfile(?:\..*)?$/i.test(file)),
      hasCompose: relativeFiles.some((file) => /(?:docker-compose|compose).*\.ya?ml$/i.test(file)),
      hasReadme: Boolean(readme),
      hasEnvironmentExample: envExample
    },
    aiContext: [
      `Repository: ${input.repositoryName}`,
      `Current branch: ${input.currentBranch}`,
      `Default branch: ${input.defaultBranch}`,
      `Remote: ${input.remoteUrl || '(none)'}`,
      `Detected framework: ${framework || '(unknown)'}`,
      `Package manager: ${packageManager || '(unknown)'}`,
      `Node version: ${nodeVersion || '(not specified)'}`,
      `Python version: ${pythonVersion || '(not specified)'}`,
      `Files: ${relativeFiles.join(', ')}`,
      '',
      ...contextParts
    ].join('\n')
  }

  return inspection
}

function mapTargetRow(row: Record<string, unknown>): ProjectDeploymentTarget {
  const provider = normalizeProvider(row.provider)
  const sourceMode = normalizeSourceMode(row.source_mode)
  const config = parseJsonObject<Partial<ProjectDeploymentConfig>>(row.config_json, {})
  const fallback: ProjectDeploymentConfig = {
    ...createDefaultDeploymentConfig({
      repositoryId: trimText(row.repository_id),
      repositoryName: trimText(row.display_name) || 'app',
      currentBranch: trimText(row.branch),
      defaultBranch: trimText(row.branch),
      detected: { framework: '', packageManager: '', scripts: {}, nodeVersion: '', pythonVersion: '', hasDockerfile: false, hasCompose: false, hasReadme: false, hasEnvironmentExample: false }
    }, provider, sourceMode),
    ...config,
    repositoryId: trimText(row.repository_id),
    provider,
    sourceMode
  }

  return {
    id: trimText(row.id),
    projectId: trimText(row.project_id),
    repositoryId: trimText(row.repository_id),
    provider,
    connectionId: trimText(row.connection_id),
    serviceId: trimText(row.service_id),
    externalProjectId: trimText(row.external_project_id),
    externalProjectName: trimText(row.external_project_name),
    externalServiceId: trimText(row.external_service_id),
    externalServiceName: trimText(row.external_service_name),
    externalEnvironmentId: trimText(row.external_environment_id),
    externalEnvironmentName: trimText(row.external_environment_name),
    displayName: trimText(row.display_name),
    status: row.status === 'attention' || row.status === 'draft' ? row.status : 'ready',
    latestDeploymentId: trimText(row.latest_deployment_id),
    latestDeploymentUrl: trimText(row.latest_deployment_url),
    lastStatus: trimText(row.last_status),
    lastError: trimText(row.last_error),
    createdAt: trimText(row.created_at),
    updatedAt: trimText(row.updated_at),
    config: fallback
  }
}

export function migrateProjectDeploymentTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_deployment_targets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      connection_id TEXT NOT NULL DEFAULT '',
      service_id TEXT NOT NULL DEFAULT '',
      external_project_id TEXT NOT NULL DEFAULT '',
      external_project_name TEXT NOT NULL DEFAULT '',
      external_service_id TEXT NOT NULL DEFAULT '',
      external_service_name TEXT NOT NULL DEFAULT '',
      external_environment_id TEXT NOT NULL DEFAULT '',
      external_environment_name TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      latest_deployment_id TEXT NOT NULL DEFAULT '',
      latest_deployment_url TEXT NOT NULL DEFAULT '',
      last_status TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      source_mode TEXT NOT NULL DEFAULT 'git',
      branch TEXT NOT NULL DEFAULT '',
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_deployment_targets_project ON project_deployment_targets(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_deployment_targets_repository ON project_deployment_targets(repository_id);
    CREATE TABLE IF NOT EXISTS project_deployment_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      provider TEXT NOT NULL,
      source_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT '',
      phase_index INTEGER NOT NULL DEFAULT 0,
      phase_total INTEGER NOT NULL DEFAULT 0,
      hint TEXT NOT NULL DEFAULT '',
      log TEXT NOT NULL DEFAULT '',
      stdout TEXT NOT NULL DEFAULT '',
      stderr TEXT NOT NULL DEFAULT '',
      exit_code INTEGER,
      error TEXT,
      external_deployment_id TEXT,
      external_deployment_url TEXT,
      external_status TEXT,
      artifact_path TEXT,
      config_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES project_deployment_targets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_deployment_tasks_target_started ON project_deployment_tasks(target_id, started_at);
  `)
}

export function listProjectDeploymentTargets(db: DatabaseLike, projectId: string): ProjectDeploymentTarget[] {
  return db.prepare('SELECT * FROM project_deployment_targets WHERE project_id = ? ORDER BY updated_at DESC').all(projectId).map((row) => mapTargetRow(row as Record<string, unknown>))
}

export function getProjectDeploymentTarget(db: DatabaseLike, targetId: string): ProjectDeploymentTarget | null {
  const row = db.prepare('SELECT * FROM project_deployment_targets WHERE id = ?').get(targetId) as Record<string, unknown> | undefined
  return row ? mapTargetRow(row) : null
}

export function saveProjectDeploymentTarget(db: DatabaseLike, input: ProjectDeploymentTargetInput): ProjectDeploymentTarget {
  const existing = input.id ? getProjectDeploymentTarget(db, input.id) : null
  const id = existing?.id ?? input.id ?? createId('deployment-target')
  const now = nowIso()
  const provider = normalizeProvider(input.provider)
  const sourceMode = normalizeSourceMode(input.config.sourceMode ?? existing?.config.sourceMode)
  const fallback = existing?.config ?? createDefaultDeploymentConfig({
    repositoryId: input.repositoryId,
    repositoryName: input.displayName || provider,
    currentBranch: trimText(input.config.branch),
    defaultBranch: trimText(input.config.branch),
    detected: { framework: '', packageManager: '', scripts: {}, nodeVersion: '', pythonVersion: '', hasDockerfile: false, hasCompose: false, hasReadme: false, hasEnvironmentExample: false }
  }, provider, sourceMode)
  const config = normalizeConfig({ ...input.config, repositoryId: input.repositoryId, provider, sourceMode }, fallback)
  const displayName = trimText(input.displayName) || `${provider} · ${input.repositoryId}`
  const values = [
    id,
    input.projectId,
    input.repositoryId,
    provider,
    trimText(input.connectionId),
    trimText(input.serviceId),
    trimText(input.externalProjectId),
    trimText(input.externalProjectName),
    trimText(input.externalServiceId),
    trimText(input.externalServiceName),
    trimText(input.externalEnvironmentId),
    trimText(input.externalEnvironmentName),
    displayName,
    input.status ?? existing?.status ?? 'draft',
    trimText(input.latestDeploymentId ?? existing?.latestDeploymentId),
    trimText(input.latestDeploymentUrl ?? existing?.latestDeploymentUrl),
    trimText(input.lastStatus ?? existing?.lastStatus),
    trimText(input.lastError ?? existing?.lastError),
    sourceMode,
    config.branch,
    JSON.stringify(config),
    existing?.createdAt ?? now,
    now
  ]

  db.prepare(`
    INSERT INTO project_deployment_targets (
      id, project_id, repository_id, provider, connection_id, service_id, external_project_id,
      external_project_name, external_service_id, external_service_name, external_environment_id,
      external_environment_name, display_name, status, latest_deployment_id, latest_deployment_url,
      last_status, last_error, source_mode, branch, config_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id, repository_id = excluded.repository_id, provider = excluded.provider,
      connection_id = excluded.connection_id, service_id = excluded.service_id, external_project_id = excluded.external_project_id,
      external_project_name = excluded.external_project_name, external_service_id = excluded.external_service_id,
      external_service_name = excluded.external_service_name, external_environment_id = excluded.external_environment_id,
      external_environment_name = excluded.external_environment_name, display_name = excluded.display_name,
      status = excluded.status, latest_deployment_id = excluded.latest_deployment_id, latest_deployment_url = excluded.latest_deployment_url,
      last_status = excluded.last_status, last_error = excluded.last_error, source_mode = excluded.source_mode,
      branch = excluded.branch, config_json = excluded.config_json, updated_at = excluded.updated_at
  `).run(...values)

  const target = getProjectDeploymentTarget(db, id)
  if (!target) throw new Error('发布目标保存失败')
  return target
}

export function deleteProjectDeploymentTarget(db: DatabaseLike, projectId: string, targetId: string): ProjectDeploymentTarget[] {
  db.prepare('DELETE FROM project_deployment_targets WHERE id = ? AND project_id = ?').run(targetId, projectId)
  return listProjectDeploymentTargets(db, projectId)
}

function mapTaskRow(row: Record<string, unknown>): ProjectDeploymentTaskSnapshot {
  return {
    id: trimText(row.id),
    projectId: trimText(row.project_id),
    targetId: trimText(row.target_id),
    repositoryId: trimText(row.repository_id),
    targetName: trimText(row.target_name),
    provider: normalizeProvider(row.provider),
    sourceMode: normalizeSourceMode(row.source_mode),
    status: (row.status === 'succeeded' || row.status === 'failed' || row.status === 'cancelled' ? row.status : 'running'),
    phase: trimText(row.phase),
    phaseIndex: Number(row.phase_index ?? 0),
    phaseTotal: Number(row.phase_total ?? 0),
    hint: trimText(row.hint),
    log: trimText(row.log),
    stdout: trimText(row.stdout),
    stderr: trimText(row.stderr),
    exitCode: row.exit_code === null || row.exit_code === undefined || row.exit_code === '' ? null : Number(row.exit_code),
    error: trimText(row.error) || undefined,
    externalDeploymentId: trimText(row.external_deployment_id) || undefined,
    externalDeploymentUrl: trimText(row.external_deployment_url) || undefined,
    externalStatus: trimText(row.external_status) || undefined,
    artifactPath: trimText(row.artifact_path) || undefined,
    config: parseJsonObject<ProjectDeploymentConfig>(row.config_json, {} as ProjectDeploymentConfig),
    startedAt: trimText(row.started_at),
    updatedAt: trimText(row.updated_at),
    finishedAt: trimText(row.finished_at) || undefined
  }
}

export function saveProjectDeploymentTask(db: DatabaseLike, task: ProjectDeploymentTaskSnapshot): ProjectDeploymentTaskSnapshot {
  db.prepare(`
    INSERT INTO project_deployment_tasks (
      id, project_id, target_id, repository_id, target_name, provider, source_mode, status,
      phase, phase_index, phase_total, hint, log, stdout, stderr, exit_code, error,
      external_deployment_id, external_deployment_url, external_status, artifact_path,
      config_json, started_at, updated_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status, phase = excluded.phase, phase_index = excluded.phase_index,
      phase_total = excluded.phase_total, hint = excluded.hint, log = excluded.log,
      stdout = excluded.stdout, stderr = excluded.stderr, exit_code = excluded.exit_code,
      error = excluded.error, external_deployment_id = excluded.external_deployment_id,
      external_deployment_url = excluded.external_deployment_url, external_status = excluded.external_status,
      artifact_path = excluded.artifact_path, config_json = excluded.config_json,
      updated_at = excluded.updated_at, finished_at = excluded.finished_at
  `).run(
    task.id, task.projectId, task.targetId, task.repositoryId, task.targetName, task.provider, task.sourceMode,
    task.status, task.phase, task.phaseIndex, task.phaseTotal, task.hint, task.log, task.stdout, task.stderr,
    task.exitCode, task.error ?? null, task.externalDeploymentId ?? null, task.externalDeploymentUrl ?? null,
    task.externalStatus ?? null, task.artifactPath ?? null, JSON.stringify(task.config), task.startedAt,
    task.updatedAt, task.finishedAt ?? null
  )
  return getProjectDeploymentTask(db, task.id) as ProjectDeploymentTaskSnapshot
}

export function listProjectDeploymentTasks(db: DatabaseLike, projectId?: string): ProjectDeploymentTaskSnapshot[] {
  const rows = projectId
    ? db.prepare('SELECT * FROM project_deployment_tasks WHERE project_id = ? ORDER BY started_at DESC').all(projectId)
    : db.prepare('SELECT * FROM project_deployment_tasks ORDER BY started_at DESC').all()
  return rows.map((row) => mapTaskRow(row as Record<string, unknown>))
}

export function getProjectDeploymentTask(db: DatabaseLike, taskId: string): ProjectDeploymentTaskSnapshot | null {
  const row = db.prepare('SELECT * FROM project_deployment_tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined
  return row ? mapTaskRow(row) : null
}

export function recoverProjectDeploymentTasks(db: DatabaseLike): ProjectDeploymentTaskSnapshot[] {
  const running = listProjectDeploymentTasks(db).filter((task) => task.status === 'running')
  const recoveredAt = nowIso()

  for (const task of running) {
    saveProjectDeploymentTask(db, {
      ...task,
      status: 'failed',
      phase: '应用重启后中断',
      hint: 'ForgeDesk 重启时任务仍在执行，已标记为失败；请确认远程状态后重试。',
      error: '应用重启导致发布任务中断',
      stderr: task.stderr || '应用重启导致发布任务中断',
      updatedAt: recoveredAt,
      finishedAt: recoveredAt
    })
  }

  return listProjectDeploymentTasks(db)
}

export function createProjectDeploymentTask(input: {
  projectId: string
  target: ProjectDeploymentTarget
  config: ProjectDeploymentConfig
}): ProjectDeploymentTaskSnapshot {
  const timestamp = nowIso()
  return {
    id: createId('deployment-task'),
    projectId: input.projectId,
    targetId: input.target.id,
    repositoryId: input.target.repositoryId,
    targetName: input.target.displayName,
    provider: input.config.provider,
    sourceMode: input.config.sourceMode,
    status: 'running',
    phase: '准备发布',
    phaseIndex: 0,
    phaseTotal: 5,
    hint: '发布任务已创建，等待执行。',
    log: '',
    stdout: '',
    stderr: '',
    exitCode: null,
    config: input.config,
    startedAt: timestamp,
    updatedAt: timestamp
  }
}
