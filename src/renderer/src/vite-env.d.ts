/// <reference types="vite/client" />

type ScannedRepository = {
  id: string
  name: string
  repositoryKind: 'root' | 'submodule'
  parentRepositoryId: string
  relativePath: string
  submoduleName: string
  submoduleUrl: string
  expectedCommit: string
  checkedOutCommit: string
  isDetached: boolean
  submoduleState: 'aligned' | 'changed' | 'dirty' | 'uninitialized' | 'missing' | 'conflicted' | 'unknown'
  available: boolean
  scanError: string
  active: boolean
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

type GitRemote = {
  name: string
  fetchUrl: string
  pushUrl: string
}

type DeploymentProviderType = 'vercel' | 'railway' | 'ssh-pm2' | 'docker-compose'
type DeploymentSourceMode = 'git' | 'local'
type DeploymentEnvSource = 'provider' | 'local' | 'manual'
type DeploymentEnvBinding = { key: string; source: DeploymentEnvSource; required: boolean; configured: boolean }
type ProjectDeploymentConfig = {
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
type ProjectDeploymentTarget = {
  id: string; projectId: string; repositoryId: string; provider: DeploymentProviderType; connectionId: string; serviceId: string
  externalProjectId: string; externalProjectName: string; externalServiceId: string; externalServiceName: string
  externalEnvironmentId: string; externalEnvironmentName: string; displayName: string; status: 'draft' | 'ready' | 'attention'
  latestDeploymentId: string; latestDeploymentUrl: string; lastStatus: string; lastError: string; createdAt: string; updatedAt: string
  config: ProjectDeploymentConfig
}
type ProjectDeploymentTargetInput = Partial<Omit<ProjectDeploymentTarget, 'config'>> & { projectId: string; repositoryId: string; provider: DeploymentProviderType; config: Partial<ProjectDeploymentConfig> }
type DeploymentProviderCapabilities = { provider: DeploymentProviderType; label: string; supportsGit: boolean; supportsLocal: boolean; supportsCreateTarget: boolean; supportsBuildConfig: boolean; supportsCancel: boolean; configFields: string[]; platformManagedFields: string[] }
type DeploymentContextFile = { path: string; category: 'manifest' | 'documentation' | 'build' | 'source' | 'container'; sizeBytes: number; includedInAi: boolean; redacted: boolean }
type DeploymentInspection = { repositoryId: string; repositoryName: string; localPath: string; currentBranch: string; defaultBranch: string; branches: string[]; remoteBranches: string[]; remoteUrl: string; files: DeploymentContextFile[]; detected: { framework: string; packageManager: ProjectDeploymentConfig['packageManager']; scripts: Record<string, string>; nodeVersion: string; pythonVersion: string; hasDockerfile: boolean; hasCompose: boolean; hasReadme: boolean; hasEnvironmentExample: boolean }; aiContext: string }
type ProjectDeploymentSuggestion = { config: ProjectDeploymentConfig; confidence: number; reasons: string[]; warnings: string[]; sources: string[] }
type ProjectDeploymentPrepareInput = { targetId?: string; repositoryId: string; provider: DeploymentProviderType; sourceMode: DeploymentSourceMode; config?: Partial<ProjectDeploymentConfig> }
type ProjectDeploymentPreparation = { target: ProjectDeploymentTarget | null; config: ProjectDeploymentConfig; capabilities: DeploymentProviderCapabilities; issues: string[]; warnings: string[]; previewCommand: string; ready: boolean }
type ProjectDeploymentTask = { id: string; projectId: string; targetId: string; repositoryId: string; targetName: string; provider: DeploymentProviderType; sourceMode: DeploymentSourceMode; status: 'running' | 'succeeded' | 'failed' | 'cancelled'; phase: string; phaseIndex: number; phaseTotal: number; hint: string; log: string; stdout: string; stderr: string; exitCode: number | null; error?: string; externalDeploymentId?: string; externalDeploymentUrl?: string; externalStatus?: string; artifactPath?: string; config: ProjectDeploymentConfig; startedAt: string; updatedAt: string; finishedAt?: string }
type ProjectDeploymentTaskStartInput = { projectId: string; targetId: string; config?: Partial<ProjectDeploymentConfig> }

type GitPushTarget = {
  remote: string
  branch: string
  ahead: number
  hasRemoteBranch: boolean
}

type DeploymentApprovalTarget = {
  targetId: string
  targetName: string
  rootDirectory: string
  triggerPath: string
  enabled: boolean
}

type DeploymentApprovalConfig = {
  repositoryId: string
  remote: string
  branch: string
  authorName: string
  authorEmail: string
  targets: DeploymentApprovalTarget[]
  updatedAt: string
}

type DeploymentApprovalCommit = {
  hash: string
  authorName: string
  authorEmail: string
  committedAt: string
  message: string
}

type DeploymentApprovalFile = {
  path: string
  status: string
  additions: number
  deletions: number
  binary: boolean
  riskReasons: string[]
  targetIds: string[]
  patch: string
}

type DeploymentApprovalAnalysis = {
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

type DeploymentApprovalHistory = {
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

type DeploymentApprovalExecutionResult = {
  ok: boolean
  approval: DeploymentApprovalHistory
  stdout: string
  repository: RepositoryRecord
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

type TerminalCreateInput = {
  cwd?: string
  title?: string
  reuseKey?: string
  cols?: number
  rows?: number
  directCommand?: {
    file: string
    args?: string[]
  }
  startupCommand?: string
}

type TerminalRemoteGroupRecord = {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type TerminalRemoteHostRecord = {
  id: string
  groupId: string
  name: string
  host: string
  username: string
  port: number
  identityFile: string
  notes: string
  createdAt: string
  updatedAt: string
}

type TerminalRemoteGroupInput = {
  id?: string
  name: string
}

type TerminalRemoteHostInput = {
  id?: string
  groupId: string
  name: string
  host: string
  username?: string
  port?: number
  identityFile?: string
  notes?: string
}

type RsaPrivateKeySize = 2048 | 4096

type RsaPrivateKeyRecord = {
  id: string
  name: string
  notes: string
  keySize: RsaPrivateKeySize
  privateKeyPem: string
  publicKeyPem: string
  fingerprint: string
  createdAt: string
  updatedAt: string
}

type RsaPrivateKeyCreateInput = {
  name: string
  notes?: string
  keySize?: RsaPrivateKeySize
}

type RsaPrivateKeyUpdateInput = {
  id: string
  name: string
  notes?: string
}

type CliEnvironmentIssueStatus = 'ok' | 'warning' | 'error'

type CliEnvironmentRepairAction = 'source-profile-from-zprofile' | 'install-zsh-dev-prompt' | 'install-zsh-ls-colors'

type CliEnvironmentIssue = {
  id: string
  status: CliEnvironmentIssueStatus
  title: string
  detail: string
  action?: CliEnvironmentRepairAction
}

type CliEnvironmentConfigFile = {
  key: 'profile' | 'zprofile' | 'zshrc' | 'bashProfile' | 'bashrc'
  label: string
  path: string
  exists: boolean
  managed: boolean
}

type CliEnvironmentCommandCheck = {
  name: string
  available: boolean
  path: string
  version: string
  error: string
}

type CliEnvironmentPlatform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd'

type CliEnvironmentSnapshot = {
  platform: CliEnvironmentPlatform
  shell: string
  shellName: string
  homeDirectory: string
  checkedAt: string
  processPath: string
  loginShellPath: string
  mergedPath: string
  pnpmHome: string
  profileSourcedFromLoginFile: boolean
  promptConfigured: boolean
  promptProvider: string
  listingColorsConfigured: boolean
  listingColorProvider: string
  configFiles: CliEnvironmentConfigFile[]
  commands: CliEnvironmentCommandCheck[]
  issues: CliEnvironmentIssue[]
  repairableActions: CliEnvironmentRepairAction[]
}

type CliEnvironmentRepairResult = {
  snapshot: CliEnvironmentSnapshot
  appliedActions: CliEnvironmentRepairAction[]
  changedFiles: string[]
  backupFiles: string[]
}

type TerminalSession = {
  id: string
  title: string
  cwd: string
  shell: string
  launchMode?: 'shell' | 'direct'
  pid: number
  reuseKey?: string
  exited: boolean
  exitCode?: number
  signal?: number
}

type TerminalSessionSnapshot = TerminalSession & {
  output: string[]
}

type TerminalDataEvent = {
  sessionId: string
  data: string
}

type TerminalExitEvent = {
  sessionId: string
  exitCode: number
  signal?: number
}

type AppRuntimeInfo = {
  version: string
  canQuickBuild: boolean
  isPackaged: boolean
  isDevelopmentBuild: boolean
  isDevServer: boolean
  appPath: string
  projectRoot: string
}

type SystemMonitorStatus = 'healthy' | 'warning' | 'critical'

type SystemMonitorDiskVolume = {
  filesystem: string
  mount: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

type SystemMonitorMemoryInfo = {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
  appBytes: number
  wiredBytes: number
  compressedBytes: number
  cachedFileBytes: number
  swapUsedBytes: number
  swapTotalBytes: number
  source: 'macos-vm' | 'node'
}

type SystemMonitorCpuInfo = {
  model: string
  coreCount: number
  speedMhz: number
  loadAverage: number[]
  loadPercent: number
}

type SystemMonitorAppInfo = {
  version: string
  isPackaged: boolean
  isDevelopmentBuild: boolean
  isDevServer: boolean
  appPath: string
  projectRoot: string
  processId: number
  uptimeSeconds: number
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
  v8Version: string
}

type SystemMonitorNetworkInterface = {
  name: string
  address: string
  family: string
  mac: string
  cidr: string
  internal: boolean
}

type SystemMonitorProxyEndpoint = {
  enabled: boolean
  host: string
  port: number
}

type SystemMonitorProxyInfo = {
  available: boolean
  enabled: boolean
  source: 'macos' | 'environment' | 'none'
  http: SystemMonitorProxyEndpoint
  https: SystemMonitorProxyEndpoint
  socks: SystemMonitorProxyEndpoint
  pac: {
    enabled: boolean
    url: string
  }
  bypass: string[]
  error: string
}

type SystemMonitorDefaultRoute = {
  gateway: string
  interface: string
  error: string
}

type SystemMonitorClashProxyGroup = {
  name: string
  type: string
  now: string
}

type SystemMonitorClashInfo = {
  detected: boolean
  running: boolean
  apiAvailable: boolean
  status: 'connected' | 'auth-required' | 'not-running' | 'unknown'
  name: string
  controllerUrl: string
  configPath: string
  secretConfigured: boolean
  version: string
  mode: string
  allowLan: boolean
  mixedPort: number
  httpPort: number
  socksPort: number
  redirPort: number
  tproxyPort: number
  activeProxyGroups: SystemMonitorClashProxyGroup[]
  connectionCount: number
  downloadTotalBytes: number
  uploadTotalBytes: number
  downloadSpeedBytes: number
  uploadSpeedBytes: number
  message: string
  error: string
}

type SystemMonitorNetworkInfo = {
  interfaces: SystemMonitorNetworkInterface[]
  dnsServers: string[]
  proxy: SystemMonitorProxyInfo
  route: SystemMonitorDefaultRoute
  clash: SystemMonitorClashInfo
}

type SystemMonitorSnapshot = {
  checkedAt: string
  status: SystemMonitorStatus
  statusMessage: string
  system: {
    platform: NodeJS.Platform
    release: string
    arch: string
    hostname: string
    uptimeSeconds: number
  }
  cpu: SystemMonitorCpuInfo
  memory: SystemMonitorMemoryInfo
  disks: SystemMonitorDiskVolume[]
  diskError: string
  network: SystemMonitorNetworkInfo
  app: SystemMonitorAppInfo
}

type ResourceProcess = {
  identityKey: string; instanceKey: string; pid: number; parentPid: number; appName: string; processName: string; user: string
  cpuPercent: number; memoryBytes: number; privateMemoryBytes: number; virtualMemoryBytes: number; threadCount: number; portCount: number
  pageIns: number; state: string; elapsedSeconds: number; executablePath: string; bundlePath: string; command: string
  networkReceivedBytes: number; networkSentBytes: number
}
type ResourceHistoryPoint = { capturedAt: string; cpuPercent: number; memoryUsagePercent: number; memoryUsedBytes: number; swapUsedBytes: number; storageUsagePercent: number; networkInBytes?: number; networkOutBytes?: number }
type ProcessHistoryPoint = { capturedAt: string; cpuAverage: number; cpuPeak: number; memoryAverageBytes: number; memoryPeakBytes: number; sampleCount: number; networkInBytes: number; networkOutBytes: number }
type ProcessAnalysis = { identityKey: string; appName: string; processName: string; executablePath: string; averageCpuPercent: number; peakCpuPercent: number; averageMemoryBytes: number; peakMemoryBytes: number; sampleCount: number; aboveThresholdSeconds: number; firstSeenAt: string; lastSeenAt: string; networkReceivedBytes: number; networkSentBytes: number }
type ResourceRetentionStatus = { rawDays: number; fiveMinuteDays: number; sampleIntervalSeconds: number; rawSampleCount: number; rollupSampleCount: number; oldestRawAt: string; databaseBytesEstimate: number }
type CleanupRisk = 'low' | 'confirm' | 'high' | 'protected'
type CleanupCategory = 'large-file' | 'stale-file' | 'duplicate-candidate' | 'download' | 'cache' | 'log' | 'development' | 'docker' | 'trash' | 'protected'
type StorageRoot = { id: string; path: string; label: string; enabled: boolean; source: 'manual' | 'project' | 'category'; createdAt: string; lastScannedAt: string }
type StorageScanItem = { id: string; scanId: string; rootId: string; path: string; name: string; sizeBytes: number; modifiedAt: string; accessedAt: string; extension: string; category: CleanupCategory; risk: CleanupRisk; reason: string; duplicateKey: string; verifiedHash: string; isDirectory: boolean }
type StorageScanRun = { id: string; mode: 'quick' | 'deep'; status: 'running' | 'paused' | 'completed' | 'failed'; startedAt: string; finishedAt: string; filesScanned: number; directoriesScanned: number; bytesScanned: number; reclaimableBytes: number; errorCount: number; errors: string[] }
type CleanupPolicy = { key: CleanupCategory; label: string; description: string; enabled: boolean; risk: CleanupRisk; thresholdBytes: number; staleDays: number; requiresCategoryAuthorization: boolean }
type CleanupAuditRecord = { id: string; action: 'scan' | 'verify' | 'ignore' | 'trash' | 'command' | 'terminate' | 'force-terminate' | 'export'; target: string; status: 'success' | 'failed' | 'blocked'; detail: string; reclaimedBytes: number; createdAt: string }
type ExternalCleanupPreview = { key: 'docker-images' | 'docker-containers' | 'docker-build-cache'; label: string; command: string; estimatedBytes: number; risk: 'high'; enabled: boolean }
type StorageDirectoryEntry = { path: string; name: string; rootId: string; sizeBytes: number; growthBytes: number; parentPath: string; fileCount: number; directoryCount: number; childDirectoryCount: number; depth: number; rootPercent: number }
type StorageDirectorySortBy = 'name' | 'sizeBytes' | 'growthBytes' | 'fileCount' | 'directoryCount' | 'childDirectoryCount' | 'depth'
type StorageDirectoryQuery = { scanId?: string; rootId?: string; parentPath?: string; search?: string; limit?: number; offset?: number; sortBy?: StorageDirectorySortBy; sortOrder?: 'asc' | 'desc' }
type StorageDirectoryList = { scanId: string; total: number; directories: StorageDirectoryEntry[] }
type StorageTrendPoint = { capturedAt: string; scannedBytes: number; reclaimableBytes: number }
type StorageOverview = { roots: StorageRoot[]; latestRun: StorageScanRun | null; items: StorageScanItem[]; policies: CleanupPolicy[]; totalReclaimableBytes: number; categoryBytes: Record<string, number>; directories: StorageDirectoryEntry[]; trend: StorageTrendPoint[] }
type StorageScanProgress = { scanId: string; status: StorageScanRun['status']; currentPath: string; filesScanned: number; directoriesScanned: number; bytesScanned: number; reclaimableBytes: number; errorCount: number }

type QuickBuildTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

type QuickBuildStartInput = {
  cwd?: string
}

type QuickBuildRestartInput = {
  cwd?: string
}

type QuickBuildRestartResult = {
  appPath: string
  restarted: boolean
}

type QuickBuildTask = {
  id: string
  command: string
  cwd: string
  status: QuickBuildTaskStatus
  phase: string
  hint: string
  lastOutputAt: string
  processPid?: number
  startedAt: string
  updatedAt: string
  finishedAt?: string
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  signal?: string
  error?: string
}

type GitAddInput = {
  mode: 'all' | 'paths'
  paths: string[]
}

type GitCommitInput = {
  message: string
  paths?: string[]
  tagName?: string
}

type GitPushInput = {
  remote?: string
  remotes?: string[]
  branch: string
}

type GitMergeInput = {
  source: string
}

type GitBranchSwitchInput = {
  branchName: string
  create?: boolean
  startPoint?: string
  track?: boolean
}

type GitCommitMessageInput = {
  paths: string[]
}

type CommitMessageSuggestion = {
  message: string
}

type ReleaseScriptName = 'publish:mac' | 'package:mac' | 'package:android' | 'build:android' | 'build' | ''
type ReleasePublishProvider = 'github' | 'codemagic' | 'firebase' | 'nextjs-pm2'
type ReleasePublishActionKey = 'commit-workspace-changes' | 'replace-local-tag'

type ReleasePublishAction = {
  key: ReleasePublishActionKey
  issue: string
  label: string
  description: string
}

type RepositoryReleasePlan = {
  repositoryName: string
  provider: ReleasePublishProvider
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  selectedScript: ReleaseScriptName
  needsVersionBump: boolean
  canPublish: boolean
  issues: string[]
  warnings: string[]
  availableActions: ReleasePublishAction[]
  documentationSources: string[]
}

type RepositoryReleasePrepareInput = {
  targetVersion?: string
  provider?: ReleasePublishProvider
}

type RepositoryReleasePreparation = {
  repositoryId: string
  packageManager: 'pnpm' | 'npm' | 'yarn'
  localPath: string
  documentationContext: string
  recentCommits: string[]
  plan: RepositoryReleasePlan
}

type RepositoryReleaseSuggestionInput = {
  targetVersion?: string
}

type ReleaseTagHistoryEntry = {
  tagName: string
  version: string
}

type RepositoryReleaseTagRecommendation = {
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  historicalTags: ReleaseTagHistoryEntry[]
}

type RepositoryReleaseSuggestion = {
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
}

type RepositoryReleasePublishInput = {
  provider?: ReleasePublishProvider
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
  githubTokenId?: string
  githubToken?: string
  codemagicTokenId?: string
  codemagicTeamId?: string
  codemagicAppId?: string
  codemagicAppName?: string
  codemagicWorkflowId?: string
  codemagicWorkflowName?: string
  codemagicDefaultBranch?: string
  codemagicLabels?: string[]
  saveCodemagicBinding?: boolean
  nextjsPm2SshHost?: string
  nextjsPm2RemotePath?: string
  nextjsPm2UploadPath?: string
  nextjsPm2AppName?: string
  nextjsPm2Port?: string | number
  nextjsPm2StartCommand?: string
  nextjsPm2InstallCommand?: string
  releaseActions?: ReleasePublishActionKey[]
}

type RepositoryReleasePublishResult = {
  ok: boolean
  provider: ReleasePublishProvider
  repository: RepositoryRecord
  plan: RepositoryReleasePlan
  stdout: string
  stderr: string
  exitCode: number | null
  externalBuildId?: string
  externalBuildUrl?: string
  externalStatus?: string
  externalWorkflow?: string
  externalBranch?: string
  externalTag?: string
  artifacts?: ReleasePublishArtifact[]
}

type RepositoryReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

type RepositoryReleasePublishTask = {
  id: string
  repositoryId: string
  repositoryName: string
  provider: ReleasePublishProvider
  version: string
  tagName: string
  releaseTitle: string
  selectedScript: ReleaseScriptName
  status: RepositoryReleasePublishTaskStatus
  phase: string
  phaseIndex: number
  phaseTotal: number
  hint: string
  lastOutputAt: string
  processPid?: number
  startedAt: string
  updatedAt: string
  finishedAt?: string
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  error?: string
  externalBuildId?: string
  externalBuildUrl?: string
  externalStatus?: string
  externalWorkflow?: string
  externalBranch?: string
  externalTag?: string
  artifacts: ReleasePublishArtifact[]
  plan?: RepositoryReleasePlan
  repository?: RepositoryRecord
}

type ReleasePublishArtifact = {
  name: string
  type: string
  sizeInBytes: number
  downloadUrl: string
  versionCode?: string
  versionName?: string
}

type GitMergeAnalysisInput = {
  source: string
  target: string
}

type GitStatusFile = {
  path: string
  oldPath: string
  indexStatus: string
  worktreeStatus: string
  conflict: boolean
}

type ConflictSection = {
  index: number
  currentLabel: string
  incomingLabel: string
  currentContent: string
  incomingContent: string
  rawContent: string
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

type GitPushTaskResult = {
  ok: boolean
  branch: string
  pushTargets: GitPushTarget[]
  stdout: string
  stderr: string
}

type ProjectGitTaskAction = 'fetch' | 'push' | 'merge'
type ProjectGitTaskStatus = 'running' | 'success' | 'failed' | 'skipped' | 'cancelled' | 'interrupted'
type ProjectGitRepositoryTaskResult = {
  repositoryId: string
  repositoryName: string
  ok: boolean
  message: string
  stdout?: string
  stderr?: string
}
type ProjectGitTaskLog = {
  id: string
  projectId: string
  projectName: string
  action: ProjectGitTaskAction
  status: ProjectGitTaskStatus
  startedAt: string
  finishedAt?: string
  summary: string
  repositoryResults: ProjectGitRepositoryTaskResult[]
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

type AiConflictSuggestion = {
  filePath: string
  suggestedContent: string
}

type RemoteAlignmentStatus = 'aligned' | 'diverged' | 'missing-remote' | 'missing-branch' | 'unknown'

type RemoteAlignmentBranchStatus = 'aligned' | 'diverged' | 'missing-branch' | 'unknown'

type RemoteAlignmentRemote = {
  name: string
  url: string
  branchCount: number
}

type RemoteAlignmentRemoteRef = {
  remoteName: string
  ref: string
  commit: string
  ahead: number
}

type RemoteAlignmentBranch = {
  branchName: string
  remotes: RemoteAlignmentRemoteRef[]
  status: RemoteAlignmentBranchStatus
  uniqueCommitCount: number
}

type RemoteAlignmentSummary = {
  status: RemoteAlignmentStatus
  remotes: RemoteAlignmentRemote[]
  remoteCount: number
  branchCount: number
  alignedBranchCount: number
  divergedBranchCount: number
  missingBranchCount: number
  currentBranchStatus: RemoteAlignmentBranchStatus | ''
  errorMessage: string
  branches: RemoteAlignmentBranch[]
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

type ProjectBranchTagRecord = {
  id: string
  projectId: string
  label: string
  branchName: string
  color: string
}

type ProjectTerminalCommandRecord = {
  id: string
  projectId: string
  name: string
  command: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type ProjectTerminalCommandInput = {
  id?: string
  projectId: string
  name: string
  command: string
}

type ServiceProviderType = 'railway' | 'vercel'

type RailwayTokenType = 'account' | 'workspace' | 'project'

type ServiceMonitorStatus = 'online' | 'degraded' | 'offline' | 'unknown'

type ServiceConnectionRecord = {
  id: string
  projectId: string
  provider: ServiceProviderType
  name: string
  token: string
  tokenConfigured: boolean
  teamId: string
  workspaceId: string
  railwayTokenType: RailwayTokenType
  createdAt: string
  updatedAt: string
}

type ServiceConnectionInput = {
  id?: string
  projectId?: string
  provider: ServiceProviderType
  name: string
  token?: string
  teamId?: string
  workspaceId?: string
  railwayTokenType?: RailwayTokenType
}

type ProjectServiceEnvironmentRecord = {
  id: string
  projectId: string
  serviceId: string
  provider: ServiceProviderType
  name: string
  externalEnvironmentId: string
  status: string
  deploymentStatus: string
  latestDeploymentId: string
  latestDeploymentUrl: string
  latestCommit: string
  updatedAt: string
}

type ProjectServiceDomainRecord = {
  id: string
  projectId: string
  serviceId: string
  environmentId: string
  environmentName: string
  domain: string
  url: string
  kind: 'custom' | 'generated' | 'manual'
  enabled: boolean
  lastStatus: ServiceMonitorStatus
  lastStatusCode: number
  lastResponseMs: number
  lastCheckedAt: string
  lastError: string
  createdAt: string
  updatedAt: string
}

type ProjectServiceRecord = {
  id: string
  projectId: string
  provider: ServiceProviderType
  connectionId: string
  repositoryId: string
  name: string
  externalProjectId: string
  externalProjectName: string
  externalProjectAlias: string
  externalServiceId: string
  defaultEnvironment: string
  healthPath: string
  enabled: boolean
  lastSyncedAt: string
  createdAt: string
  updatedAt: string
  environments: ProjectServiceEnvironmentRecord[]
  domains: ProjectServiceDomainRecord[]
}

type ProjectServiceInput = {
  id?: string
  projectId?: string
  provider: ServiceProviderType
  connectionId?: string
  repositoryId?: string
  name: string
  externalProjectId?: string
  externalProjectName?: string
  externalProjectAlias?: string
  externalServiceId?: string
  defaultEnvironment?: string
  healthPath?: string
  enabled?: boolean
  environments?: Array<Partial<ProjectServiceEnvironmentRecord> & { name: string }>
  domains?: Array<Partial<ProjectServiceDomainRecord> & { domain: string }>
}

type ServiceExternalProjectAliasInput = {
  provider: ServiceProviderType
  externalProjectId: string
  alias?: string
}

type ServiceMonitorCheckRecord = {
  id: string
  projectId: string
  serviceId: string
  domainId: string
  status: ServiceMonitorStatus
  statusCode: number
  responseMs: number
  checkedAt: string
  errorMessage: string
}

type ServiceEnvironmentLogRecord = {
  timestamp: string
  level: string
  message: string
  source: string
}

type ServiceDeploymentSummary = {
  id: string
  url: string
  target: string
  state: string
  createdAt: string
  readyAt: string
  creator: string
  meta: Record<string, unknown>
  commitSha: string
  environmentId?: string
  projectId?: string
  serviceId?: string
  canRedeploy?: boolean
  canRollback?: boolean
  deploymentStopped?: boolean
}

type VercelDeploymentSummary = ServiceDeploymentSummary

type ServiceDeploymentListOptions = {
  target?: string
  limit?: number
}

type VercelDeploymentListOptions = ServiceDeploymentListOptions

type ServiceDeploymentActionInput = {
  action: 'deploy' | 'redeploy' | 'restart' | 'stop' | 'cancel' | 'promote' | 'rollback'
  deploymentId?: string
  environmentId?: string
  description?: string
}

type VercelDeploymentActionInput = ServiceDeploymentActionInput

type ServiceEnvVarRecord = {
  id: string
  key: string
  type: string
  target: string[]
  gitBranch: string
  customEnvironmentIds: string[]
  comment: string
  createdAt: string
  updatedAt: string
  decrypted: boolean
  value?: string
}

type VercelEnvVarRecord = ServiceEnvVarRecord

type VercelEnvVarInput = {
  id?: string
  key: string
  value?: string
  type: string
  target?: string[]
  customEnvironmentIds?: string[]
  gitBranch?: string
  comment?: string
}

type VercelDomainInput = {
  name: string
  environmentName?: string
  gitBranch?: string
  redirect?: string
  redirectStatusCode?: number
}

type VercelDomainConfig = {
  configured: boolean
  misconfigured: boolean
  acceptedChallenges: unknown[]
  recommendedRecords: unknown[]
  raw: Record<string, unknown>
}

type DockerResourceType = 'image' | 'container'

type DockerResourceNoteRecord = {
  resourceType: DockerResourceType
  resourceKey: string
  displayName: string
  notes: string
  createdAt: string
  updatedAt: string
}

type DockerResourceNoteInput = {
  resourceType: DockerResourceType
  resourceKey: string
  displayName?: string
  notes?: string
}

type DockerDevEnvironmentSystem = 'ubuntu-24.04' | 'ubuntu-22.04' | 'debian-12' | 'node-22' | 'python-3.12'

type DockerDevEnvironmentInput = {
  hostPath: string
  name?: string
  workspaceFolder?: string
  system: DockerDevEnvironmentSystem
  enableDockerInDocker?: boolean
  overwrite?: boolean
}

type DockerDevEnvironmentResult = {
  configPath: string
  hostPath: string
  name: string
  workspaceFolder: string
  system: DockerDevEnvironmentSystem
  image: string
  dockerInDocker: boolean
  containerName: string
  content: string
}

type DockerDevEnvironmentTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

type DockerDevEnvironmentRunMode = 'devcontainer-cli' | 'docker-run'

type DockerDevEnvironmentTaskSnapshot = {
  taskId: string
  status: DockerDevEnvironmentTaskStatus
  runMode: DockerDevEnvironmentRunMode
  progressPercent: number
  stage: string
  title: string
  hostPath: string
  configPath: string
  containerName: string
  command: string
  startedAt: string
  updatedAt: string
  finishedAt: string
  exitCode: number | null
  error: string
  logs: string[]
  result: DockerDevEnvironmentResult
}

type DockerImageSummary = {
  id: string
  shortId: string
  repository: string
  tag: string
  digest: string
  size: string
  createdAt: string
  createdSince: string
  reference: string
  tagResourceKey: string
  imageIdResourceKey: string
  noteResourceKey: string
  displayName: string
  note: DockerResourceNoteRecord | null
}

type DockerContainerSummary = {
  id: string
  shortId: string
  name: string
  image: string
  state: string
  status: string
  ports: string
  createdAt: string
  runningFor: string
  noteResourceKey: string
  displayName: string
  note: DockerResourceNoteRecord | null
}

type DockerContainerPortDetail = {
  privatePort: string
  type: string
  hostIp: string
  hostPort: string
}

type DockerContainerMountDetail = {
  type: string
  source: string
  destination: string
  mode: string
  rw: boolean
  name: string
}

type DockerContainerNetworkDetail = {
  name: string
  networkId: string
  ipAddress: string
  gateway: string
  macAddress: string
}

type DockerContainerDetail = {
  id: string
  shortId: string
  name: string
  image: string
  imageName: string
  createdAt: string
  startedAt: string
  finishedAt: string
  status: string
  running: boolean
  paused: boolean
  restarting: boolean
  pid: number
  exitCode: number
  restartCount: number
  platform: string
  driver: string
  hostname: string
  user: string
  workingDir: string
  entrypoint: string[]
  command: string[]
  env: string[]
  ports: DockerContainerPortDetail[]
  mounts: DockerContainerMountDetail[]
  networks: DockerContainerNetworkDetail[]
  labels: Record<string, string>
  networkMode: string
  restartPolicy: string
  rawJson: string
}

type DockerSnapshot = {
  images: DockerImageSummary[]
  containers: DockerContainerSummary[]
  notes: DockerResourceNoteRecord[]
  checkedAt: string
}

type DockerEventSummary = {
  id: string
  type: string
  action: string
  status: string
  time: string
  actorAttributes: Record<string, string>
}

type ProjectRecord = {
  id: string
  name: string
  description: string
  status: 'ready' | 'needs-setup' | 'warning'
  owner: string
  workspacePath: string
  groupId?: string | null
  createdAt: string
  isFavorite: boolean
}

type ProjectGroupRecord = {
  id: string
  name: string
  sortOrder: number
  projectCount: number
  createdAt: string
  updatedAt: string
}

type ProjectGroupInput = {
  id?: string
  name: string
}

type CodexProjectLink = {
  codexKey: string
  cwd: string
  projectId: string | null
  updatedAt: string
}

type CodexProjectLinkInput = {
  cwd: string
  projectId: string | null
}

type RepositoryRecord = ScannedRepository & {
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

type AiProviderRuntimeSnapshot = {
  id: 'codex'
  label: string
  installed: boolean
  authenticated: boolean
  command: string
  appPath: string
  version: string
  openMode: 'app' | 'cli' | 'none'
  installUrl: string
  message: string
  checkedAt: string
}

type QuotaSource = 'app-server' | 'session' | 'cache' | 'auth' | 'unavailable'
type QuotaStatus = 'available' | 'stale' | 'unknown' | 'error' | 'reauth-required'

type QuotaWindow = {
  label: 'primary' | 'secondary' | 'hourly' | 'weekly'
  used: number | null
  limit: number | null
  remaining: number | null
  usedPercent: number | null
  remainingPercent: number | null
  windowDurationMins: number | null
  resetsAt: number | null
  resetAt: string
  source: QuotaSource
}

type QuotaCredits = {
  hasCredits: boolean | null
  unlimited: boolean | null
  balance: string | null
  availableCount: number | null
  credits: Array<{
    id: string
    resetType: string
    status: string
    grantedAt: string
    expiresAt: string
    title: string
    description: string
  }> | null
}

type QuotaLimitBucket = {
  id: string
  name: string
  planType: string
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
  credits: QuotaCredits | null
  rateLimitReachedType: string
}

type DailyUsageSnapshot = {
  summary: {
    lifetimeTokens: string | null
    peakDailyTokens: string | null
    longestRunningTurnSec: string | null
    currentStreakDays: string | null
    longestStreakDays: string | null
  } | null
  dailyUsageBuckets: Array<{ startDate: string; tokens: string }> | null
}

type QuotaSnapshot = {
  providerId: 'codex'
  accountId: string
  email: string
  authMode: string
  requiresOpenaiAuth: boolean | null
  planType: string
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
  limitBuckets: QuotaLimitBucket[]
  hourly: QuotaWindow | null
  weekly: QuotaWindow | null
  credits: QuotaCredits | null
  monthlyLimit: {
    limit: string
    used: string
    remainingPercent: number | null
    resetsAt: string
  } | null
  rateLimitReachedType: string
  usage: DailyUsageSnapshot | null
  checkedAt: string
  source: QuotaSource
  status: QuotaStatus
  stale: boolean
  errorCode: string
  message: string
}

type CodexAccountLiveSnapshot = {
  accountId: string
  email: string
  authMode: string
  planType: string
  quota: QuotaSnapshot
  usage: DailyUsageSnapshot | null
}

type AiProviderAccountSnapshot = {
  account: CodexManagedAccount
  live: CodexAccountLiveSnapshot
}

type InitializationProjectSummary = {
  id: string
  name: string
  workspacePath: string
}

type InitializationSnapshot = {
  requiresProject: boolean
  projectCount: number
  currentProject: InitializationProjectSummary | null
  codex: AiProviderRuntimeSnapshot
}

type ProjectAiBinding = {
  projectId: string
  providerId: string
  workspacePath: string
  createdAt: string
  updatedAt: string
}

type ProjectAiBindingInput = {
  projectId: string
  providerId: string
  workspacePath: string
}

type AiProviderOpenResult = {
  mode: 'app' | 'cli' | 'download'
  runtime: AiProviderRuntimeSnapshot
  session?: TerminalSession
}

type CodexApiHealth = {
  ok: boolean
  message: string
}

type GitSetupStatus = {
  gitAvailable: boolean
  gitVersion: string
  userName: string
  userEmail: string
  gpgAvailable: boolean
  gpgVersion: string
  gpgKeys: GpgSecretKeyRecord[]
  gitSigningKey: string
  gitCommitGpgSign: boolean
  sshPublicKeys: SshPublicKeyRecord[]
  sshPrivateKeys: SshPrivateKeyRecord[]
}

type GpgKeyUserId = {
  uid: string
  name: string
  email: string
}

type GpgSecretKeyRecord = {
  keyId: string
  fingerprint: string
  algorithm: string
  createdAt: string
  expiresAt: string
  trust: string
  capabilities: string
  userIds: GpgKeyUserId[]
}

type SshKeyKind = 'private' | 'public'

type SshPublicKeyRecord = {
  fileName: string
  path: string
  fingerprint: string
  pairedPrivateKeyPath: string
}

type SshPrivateKeyRecord = {
  fileName: string
  path: string
  fingerprint: string
  publicKeyPath: string
  hasPublicKey: boolean
  hasPassphrase: boolean
  mode: string
  needsPermissionFix: boolean
}

type SshKeyGenerationInput = {
  keyName?: string
  email: string
}

type SshKeyImportInput = {
  kind: SshKeyKind
  sourcePath: string
  fileName: string
}

type SshConfigFile = {
  path: string
  content: string
  exists: boolean
}

type AiSettingsInput = {
  enabled: boolean
  provider?: 'openai-compatible' | 'openrouter' | 'codex-cli' | 'cursor-cli' | 'codex-local-api'
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

type AiSettingsView = {
  enabled: boolean
  provider: 'openai-compatible' | 'openrouter' | 'codex-cli' | 'cursor-cli' | 'codex-local-api'
  baseUrl: string
  apiKey: string
  apiKeyConfigured: boolean
  model: string
  temperature: number
}

type CodexAccountInfo = {
  available: boolean
  authFilePath: string
  authMode: string
  email: string
  planType: string
  accountId: string
  accountIdSuffix: string
  accessTokenConfigured: boolean
  refreshTokenConfigured: boolean
  updatedAt: string
  message: string
}

type CodexManagedAccount = CodexAccountInfo & {
  id: string
  name: string
  source: 'local' | 'imported'
  codexHome: string
  active: boolean
  createdAt: string
  lastUsedAt: string
}

type CodexAccountRegistryView = {
  activeAccountId: string
  accounts: CodexManagedAccount[]
  message: string
}

type CodexAccountImportInput = {
  name?: string
  sourcePath: string
}

type CodexApiServiceView = {
  enabled: boolean
  running: boolean
  host: '127.0.0.1'
  port: number
  baseUrl: string
  apiKeyMasked: string
  apiKeyConfigured: boolean
  model: string
  account: CodexAccountInfo
  message: string
}

type AiRuntimeStatus = {
  provider: AiSettingsView['provider']
  configured: boolean
  available: boolean
  usable: boolean | null
  label: string
  command: string
  version: string
  message: string
  checkedAt: string
}

type CodexTaskRunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'

type CodexTaskMessage = {
  id: string
  taskId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images: string[]
  eventType: string
  createdAt: string
}

type CodexTaskEnvironment = {
  cwd: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  hasChanges: boolean
  repositoryAvailable: boolean
  checkedAt: string
}

type CodexTaskRecord = {
  id: string
  title: string
  projectId: string
  cwd: string
  status: CodexTaskRunStatus
  accountId: string
  model: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  errorMessage: string
  runLog: string
  createdAt: string
  updatedAt: string
  finishedAt: string
  messages: CodexTaskMessage[]
  environment: CodexTaskEnvironment
}

type CodexTaskCreateInput = {
  title?: string
  projectId?: string
  cwd?: string
  accountId?: string
  model?: string
}

type CodexTaskRenameInput = {
  taskId: string
  title: string
}

type CodexTaskMessageInput = {
  taskId: string
  content: string
  images?: string[]
}

type CodexTaskEventType = 'updated' | 'running' | 'output' | 'succeeded' | 'failed' | 'cancelled'

type CodexTaskEvent = {
  type: CodexTaskEventType
  task: CodexTaskRecord
}

type CodexActivitySnapshot = {
  available: boolean
  running: number
  completed: number
  aborted: number
  sessions: CodexSessionRecord[]
  checkedAt: string
  source: string
  error: string
}

type CodexSessionStatus = 'idle' | 'running' | 'completed' | 'aborted'

type CodexSessionRecord = {
  id: string
  filePath: string
  title: string
  cwd: string
  status: CodexSessionStatus
  startedAt: string
  updatedAt: string
  tasks: number
  completed: number
  aborted: number
  lastEvent: string
  lastMessage: string
}

type CodexConversationItemKind = 'user' | 'assistant' | 'tool-call' | 'tool-output' | 'status'

type CodexConversationItem = {
  id: string
  timestamp: string
  kind: CodexConversationItemKind
  text: string
  images: string[]
  eventType: string
  toolName: string
  callId: string
  input: string
  output: string
}

type CodexSessionSummary = {
  id: string
  title: string
  cwd: string
  projectKey: string
  projectName: string
  filePath: string
  status: CodexSessionStatus
  archived: boolean
  pinned: boolean
  createdAt: string
  updatedAt: string
  preview: string
  lastEvent: string
}

type CodexSessionDetail = CodexSessionSummary & {
  items: CodexConversationItem[]
}

type CodexProjectRecord = {
  key: string
  name: string
  cwd: string
  updatedAt: string
  sessionCount: number
  runningCount: number
}

type CodexSessionsSnapshot = {
  available: boolean
  checkedAt: string
  source: string
  error: string
  running: number
  completed: number
  aborted: number
  projects: CodexProjectRecord[]
  sessions: CodexSessionSummary[]
}

type CodexGitWorkspaceState = {
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

type CodexTaskMonitorSummary = {
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

type CodexUncommittedAlert = {
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

type CodexProjectMonitorItem = {
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
  git: CodexGitWorkspaceState
  status: 'running' | 'attention' | 'completed' | 'clean' | 'unknown'
  openAlert: CodexUncommittedAlert | null
}

type CodexProjectMonitorSnapshot = {
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

type CodexSessionEventType = 'item' | 'running' | 'updated' | 'completed' | 'failed' | 'cancelled'

type CodexSessionEvent = {
  type: CodexSessionEventType
  sessionId: string
  item?: CodexConversationItem
  session?: CodexSessionSummary
  error?: string
}

type CodexSessionMessageInput = {
  sessionId: string
  content: string
  images?: string[]
  model?: string
  accountId?: string
}

type CodexSiteStatus = 'draft' | 'building' | 'ready' | 'previewing' | 'published' | 'error'
type CodexSite = {
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
type CodexSiteCreateInput = { name: string; prompt: string; workspacePath: string; linkedSessionId?: string }
type CodexSiteUpdateInput = { id: string; name?: string; prompt?: string; workspacePath?: string; linkedSessionId?: string; status?: CodexSiteStatus; previewUrl?: string; publishedUrl?: string; lastError?: string }

type OpenRouterModel = {
  id: string
  name: string
  created: number
}

type OaSettingsInput = {
  enabled: boolean
  provider?: 'lark'
  larkAppId: string
  larkAppSecret?: string
  docsHomeUrl: string
  larkBotUrl: string
  larkBotAdminToken?: string
  enableDocumentBrowsing: boolean
  enableDocumentEditing: boolean
  enableAiDocumentDrafting: boolean
}

type OaSettingsView = {
  enabled: boolean
  provider: 'lark'
  larkAppId: string
  larkAppSecret: string
  larkAppSecretConfigured: boolean
  docsHomeUrl: string
  larkBotUrl: string
  larkBotAdminToken: string
  larkBotAdminTokenConfigured: boolean
  enableDocumentBrowsing: boolean
  enableDocumentEditing: boolean
  enableAiDocumentDrafting: boolean
}

type OaDocumentRecord = {
  id: string
  token: string
  name: string
  type: string
  url: string
  createdAt: string
  updatedAt: string
}

type OaDocumentList = {
  sourceKind: 'home' | 'drive-root' | 'folder' | 'document' | 'unknown'
  sourceUrl: string
  documents: OaDocumentRecord[]
  nextPageToken: string
  hasMore: boolean
  unsupportedReason: string
}

type OaDocumentTaskRecord = {
  id: string
  title: string
  completed: boolean
  documentToken: string
  documentName: string
  documentUrl: string
}

type OaDocumentTaskList = {
  documentToken: string
  documentName: string
  documentUrl: string
  tasks: OaDocumentTaskRecord[]
  unsupportedReason: string
}

type OaBitableTable = { id: string; name: string; revision: number }
type OaBitableView = { id: string; name: string; type: string }
type OaBitableField = { id: string; name: string; type: number; uiType: string; isPrimary: boolean; property: Record<string, unknown> }
type OaBitableRecord = { id: string; fields: Record<string, unknown>; createdAt: string; updatedAt: string }
type OaBitableSnapshot = {
  supported: boolean
  sourceUrl: string
  appToken: string
  selectedTableId: string
  selectedViewId: string
  selectedViewType: string
  tables: OaBitableTable[]
  views: OaBitableView[]
  fields: OaBitableField[]
  records: OaBitableRecord[]
  unsupportedReason: string
}

type LarkBotTask = {
  recordId: string
  name: string
  status: string
  progress: string
  owner: string
  startAt: string
  dueAt: string
  note: string
  completed: boolean
}

type LarkBotNotification = {
  id: string
  category: string
  title: string
  body: string
  createdAt: string
}

type LarkBotRuntimeSettings = {
  monitorEnabled: boolean
  remindersEnabled: boolean
  pollIntervalSeconds: number
  reminderHour: number
  reminderMinute: number
  reminderDaysAhead: number
  notifyOnFirstSync: boolean
  fieldTask: string
  fieldStatus: string
  fieldProgress: string
  fieldOwner: string
  fieldStart: string
  fieldDue: string
  fieldNote: string
  completedStatuses: string
}

type LarkBotDashboard = {
  settings: LarkBotRuntimeSettings
  connection: { apiBaseUrl: string; appId: string; appToken: string; tableId: string; chatId: string }
  stats: { total: number; completed: number; inProgress: number; overdue: number; dueSoon: number }
  state: { lastSyncAt: string; lastSyncResult: Record<string, unknown> | null; lastEventAt: string; lastError: string }
  tasks: LarkBotTask[]
}

type MonthlyPerformancePreviewInput = {
  projectId: string
  month: string
  instruction: string
}

type MonthlyPerformanceRow = {
  personId: string
  name: string
  role: string
  identity: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
  completedWorkItems: number
  inProgressWorkItems: number
  overdueWorkItems: number
  aiScore: number
  performanceLevel: string
  highlights: string
  risks: string
  nextMonthPlan: string
  notes: string
}

type MonthlyPerformancePreview = {
  projectId: string
  projectName: string
  month: string
  startDate: string
  endDate: string
  generatedAt: string
  totalCommits: number
  totalAdditions: number
  totalDeletions: number
  activeDays: number
  contributorCount: number
  aiSummary: string
  highlights: string[]
  risks: string[]
  nextMonthFocus: string[]
  rows: MonthlyPerformanceRow[]
  warnings: string[]
}

type MonthlyPerformanceExportInput = {
  preview: MonthlyPerformancePreview
}

type MonthlyPerformanceExportResult = {
  filePath: string | null
}

type MonthlyPerformanceMessageRole = 'user' | 'assistant'

type MonthlyPerformanceChatMessage = {
  id: string
  role: MonthlyPerformanceMessageRole
  content: string
  createdAt: string
}

type MonthlyPerformanceSessionStatus = 'draft' | 'ready' | 'exported'

type MonthlyPerformanceSession = {
  id: string
  projectId: string
  projectName: string
  month: string
  title: string
  status: MonthlyPerformanceSessionStatus
  messages: MonthlyPerformanceChatMessage[]
  preview: MonthlyPerformancePreview | null
  filePath: string
  createdAt: string
  updatedAt: string
  exportedAt: string
}

type MonthlyPerformanceSessionCreateInput = {
  projectId: string
  month: string
}

type MonthlyPerformanceSessionMessageInput = {
  sessionId: string
  projectId: string
  month: string
  content: string
}

type MonthlyPerformanceSessionExportInput = {
  sessionId: string
}

type GithubTokenType = 'classic' | 'fine-grained-or-app' | 'unknown'

type GithubTokenInput = {
  id?: string
  name: string
  token?: string
}

type GithubTokenView = {
  id: string
  name: string
  tokenLastFour: string
  githubLogin: string
  scopes: string[]
  tokenType: GithubTokenType
  permissionSummary: string
  tokenConfigured: boolean
  createdAt: string
  updatedAt: string
  lastCheckedAt: string
}

type CodemagicTokenInput = {
  id?: string
  name: string
  token?: string
}

type CodemagicTokenView = {
  id: string
  name: string
  tokenLastFour: string
  userId: string
  teamCount: number
  appCount: number
  permissionSummary: string
  tokenConfigured: boolean
  createdAt: string
  updatedAt: string
  lastCheckedAt: string
}

type CodemagicTeam = {
  id: string
  name: string
}

type CodemagicApp = {
  id: string
  name: string
  teamId: string
  repositoryUrl: string
  settingsSource: string
  projectType: string
  lastBuildId: string
  archived: boolean
}

type CodemagicAppListInput = {
  tokenId: string
  teamId?: string
  name?: string
}

type CodemagicRepositoryBindingInput = {
  repositoryId: string
  tokenId: string
  teamId?: string
  appId: string
  appName?: string
  workflowId: string
  workflowName?: string
  defaultBranch?: string
  labels?: string[]
}

type CodemagicRepositoryBinding = {
  repositoryId: string
  tokenId: string
  teamId: string
  appId: string
  appName: string
  workflowId: string
  workflowName: string
  defaultBranch: string
  labels: string[]
  createdAt: string
  updatedAt: string
}

type CodemagicArtifactPublicUrlInput = {
  tokenId: string
  secureFilename: string
  expiresAt?: number
}

type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

type AppUpdateState = {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string
  percent?: number
  error?: string
  releaseNotes?: string
  lastCheckedAt?: string
}

type PlaneSettingsInput = {
  apiBaseUrl?: string
  webBaseUrl?: string
  apiToken?: string
}

type PlaneSettings = {
  apiBaseUrl: string
  webBaseUrl: string
  apiToken: string
  tokenConfigured: boolean
}

type PlaneConnectionTestResult = {
  ok: boolean
  message: string
  userName: string
  userEmail: string
}

type PlaneProject = {
  id: string
  name: string
  identifier: string
  description: string
  totalMembers: number
  totalCycles: number
  totalModules: number
}

type PlaneProjectBindingInput = {
  projectId: string
  workspaceSlug: string
  planeProjectId: string
  planeProjectName: string
  planeProjectIdentifier: string
}

type PlaneProjectBinding = PlaneProjectBindingInput & {
  createdAt: string
  updatedAt: string
}

type PlaneProjectSummary = {
  id: string
  name: string
  identifier: string
  counts: {
    members: number
    states: number
    labels: number
    cycles: number
    modules: number
    issues: number
    intakes: number
    pages: number
  }
}

type PlaneWorkItem = {
  id: string
  name: string
  identifier: string
  sequenceId: string
  priority: string
  stateName: string
  stateGroup: string
  assigneeNames: string[]
  targetDate: string
  updatedAt: string
  url: string
}

type PlaneCycle = {
  id: string
  name: string
  startDate: string
  endDate: string
  totalIssues: number
  completedIssues: number
  cancelledIssues: number
  updatedAt: string
  url: string
}

type PlaneModule = {
  id: string
  name: string
  status: string
  targetDate: string
  totalIssues: number
  completedIssues: number
  cancelledIssues: number
  updatedAt: string
  url: string
}

type PlaneProjectContent = {
  binding: PlaneProjectBinding
  projectUrl: string
  summary: PlaneProjectSummary
  workItems: PlaneWorkItem[]
  cycles: PlaneCycle[]
  modules: PlaneModule[]
  fetchedAt: string
}

type CloudflareDnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX'

type ProjectCloudflareSettingsInput = {
  projectId: string
  domain?: string
  zoneId?: string
  apiToken?: string
}

type ProjectCloudflareSettings = {
  projectId: string
  domain: string
  zoneId: string
  apiToken: string
  tokenConfigured: boolean
  createdAt: string
  updatedAt: string
}

type ProjectFirebaseReleaseSettingsInput = {
  projectId: string
  enabled?: boolean
  appId?: string
  artifactPath?: string
  buildScript?: string
  groups?: string[] | string
  testers?: string[] | string
  serviceAccountKey?: string
  serviceAccountKeyFilePath?: string
}

type ProjectFirebaseReleaseSettings = {
  projectId: string
  enabled: boolean
  active: boolean
  appId: string
  artifactPath: string
  buildScript: string
  groups: string[]
  testers: string[]
  serviceAccountProjectId: string
  serviceAccountEmail: string
  serviceAccountKeyConfigured: boolean
  createdAt: string
  updatedAt: string
}

type CloudflareConnectionTestResult = {
  ok: boolean
  message: string
  recordCount: number
}

type CloudflareDnsRecordInput = {
  id?: string
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl?: number
  proxied?: boolean
  priority?: number
  comment?: string
}

type CloudflareDnsRecord = {
  id: string
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl: number
  proxied: boolean
  proxiable: boolean
  priority: number
  comment: string
  createdAt: string
  modifiedAt: string
}

type DataSourceKind = 'mysql' | 'postgresql' | 'redis' | 's3'

type DataSourceConfig = {
  host?: string
  port?: number
  database?: string
  username?: string
  ssl?: boolean
  url?: string
  tls?: boolean
  region?: string
  bucket?: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
}

type DataSourceSecret = {
  password?: string
  secretAccessKey?: string
  sessionToken?: string
}

type DataSourceConnectionInput = {
  id?: string
  kind: DataSourceKind
  name: string
  config: DataSourceConfig
  secret?: DataSourceSecret
}

type DataSourceConnection = {
  id: string
  kind: DataSourceKind
  name: string
  config: DataSourceConfig
  secretConfigured: boolean
  createdAt: string
  updatedAt: string
}

type DataSourceConnectionTestResult = {
  ok: boolean
  message: string
  detail: string
}

type DataSourceDatabaseTable = {
  schema: string
  name: string
  type: string
}

type DataSourceTabularResult = {
  columns: string[]
  rows: Array<Record<string, unknown>>
  rowCount: number
  truncated: boolean
  durationMs: number
}

type DataSourceRedisScanResult = {
  keys: string[]
  nextCursor: string
  scannedCount: number
}

type DataSourceRedisValuePreview = {
  key: string
  type: string
  ttlSeconds: number
  size: number
  value: unknown
  rows: Array<Record<string, unknown>>
}

type DataSourceS3Object = {
  key: string
  size: number
  lastModified: string
  etag: string
  storageClass: string
}

type DataSourceS3ListResult = {
  bucket: string
  prefix: string
  objects: DataSourceS3Object[]
  nextContinuationToken: string
  truncated: boolean
}

type DataSourceS3ObjectPreview = {
  bucket: string
  key: string
  size: number
  lastModified: string
  etag: string
  contentType: string
  isText: boolean
  content: string
  bytesRead: number
  truncated: boolean
}

type MenuBarItemSection = 'visible' | 'hidden' | 'always-hidden'

type MenuBarManagerSettings = {
  enabled: boolean
  showOnHover: boolean
  autoRehideMs: number
  hiddenItemKeys: string[]
  alwaysHiddenItemKeys: string[]
  orderedItemKeys: string[]
  hotkeys: {
    toggleHidden: {
      enabled: boolean
      accelerator: string
    }
  }
}

type MenuBarManagerItem = {
  key: string
  displayName: string
  bundleIdentifier: string
  ownerName: string
  title: string
  section: MenuBarItemSection
  canMove: boolean
  frame?: {
    x: number
    y: number
    width: number
    height: number
  }
}

type MenuBarManagerStatus = {
  available: boolean
  running: boolean
  supported: boolean
  platform: NodeJS.Platform
  macosMajorVersion: number | null
  helperPath: string
  helperAvailable: boolean
  accessibilityTrusted: boolean
  sectionVisible: boolean
  hotkeyRegistered: boolean
  hotkeyError: string
  message: string
  settings: MenuBarManagerSettings
  items: MenuBarManagerItem[]
}

type OverviewNewsItem = { title: string; summary: string; category: string; source: string; url: string; publishedAt: string; relevance: string }
type OverviewNewsReport = { date: string; headline: string; digest: string; items: OverviewNewsItem[]; generatedAt: string }
type OverviewProjectItem = { projectId: string; projectName: string; status: 'healthy' | 'attention' | 'error' | 'empty'; summary: string; highlights: string[]; repositoryCount: number; changedRepositories: number; aheadRepositories: number; fetchFailures: string[] }
type OverviewProjectReport = { summary: string; projects: OverviewProjectItem[]; generatedAt: string }
type OverviewSnapshot = { newsHistory: OverviewNewsReport[]; projectReport: OverviewProjectReport | null }
type MarketPeriod = '1D' | '1W' | '1M' | '1Y'
type MarketKey = 'cn' | 'us' | 'europe' | 'asia'
type MacroKey = 'dxy' | 'us10y' | 'brent' | 'gold' | 'vix'
type MarketDataKey = MarketKey | MacroKey
type MarketSeriesPoint = { timestamp: number; value: number }
type MarketQuote = {
  key: MarketDataKey
  name: string
  symbol: string
  value: number
  change: number
  changePercent: number
  previousClose: number | null
  currency: string | null
  volume: number | null
  marketState: string | null
  fetchedAt: string
}
type MarketHistoryRow = { date: string; values: Partial<Record<MarketDataKey, number>> }
type MarketDataSnapshot = {
  period: MarketPeriod
  fetchedAt: string
  source: 'Yahoo Finance chart'
  sourceUrl: string
  delayed: true
  quotes: Record<MarketKey, MarketQuote | null>
  macro: Record<MacroKey, MarketQuote | null>
  series: Record<MarketKey, MarketSeriesPoint[]>
  historical: MarketHistoryRow[]
  failures: Array<{ key: MarketDataKey; name: string; message: string }>
}

interface Window {
  forgeDesk: {
    listProjects: () => Promise<WorkspaceSnapshot>
    createProject: (input: { name: string; workspacePath: string; repositories: ScannedRepository[] }) => Promise<WorkspaceSnapshot>
    createEmptyProject: (input: { name: string; parentPath: string }) => Promise<WorkspaceSnapshot>
    createProjectFromRemote: (input: { name: string; remoteUrl: string; parentPath: string }) => Promise<WorkspaceSnapshot>
    updateProject: (input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }) => Promise<WorkspaceSnapshot>
    setProjectFavorite: (input: { id: string; isFavorite: boolean }) => Promise<WorkspaceSnapshot>
    listProjectGroups: () => Promise<ProjectGroupRecord[]>
    saveProjectGroup: (input: ProjectGroupInput) => Promise<ProjectGroupRecord>
    deleteProjectGroup: (groupId: string) => Promise<ProjectGroupRecord[]>
    reorderProjectGroups: (groupIds: string[]) => Promise<ProjectGroupRecord[]>
    setProjectGroup: (input: { projectId: string; groupId: string | null }) => Promise<WorkspaceSnapshot>
    listCodexProjectLinks: () => Promise<CodexProjectLink[]>
    saveCodexProjectLink: (input: CodexProjectLinkInput) => Promise<CodexProjectLink>
    deleteCodexProjectLink: (cwd: string) => Promise<void>
    deleteProject: (projectId: string) => Promise<WorkspaceSnapshot>
    rescanProjectRepositories: (projectId: string) => Promise<WorkspaceSnapshot>
    initializeProjectRepository: (projectId: string) => Promise<WorkspaceSnapshot>
    listRepositories: (projectId?: string) => Promise<RepositoryRecord[]>
    getRepositoryDetail: (repositoryId: string) => Promise<RepositoryRecord>
    listRepositoryCommits: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) => Promise<GitCommitRecord[]>
    getRepositoryCommitGraph: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) => Promise<GitCommitRecord[]>
    syncRepositoryRemote: (repositoryId: string) => Promise<RepositoryRecord>
    saveRepositoryRemote: (input: RepositoryRemoteInput) => Promise<RepositoryRecord>
    deleteRepositoryRemote: (repositoryId: string, remoteName: string) => Promise<RepositoryRecord>
    fetchRepositoryRemote: (repositoryId: string, remoteName?: string, operationId?: string) => Promise<RepositoryRecord>
    switchRepositoryBranch: (repositoryId: string, input: GitBranchSwitchInput) => Promise<RepositoryRecord>
    runRepositoryGitCommand: (input: GitCommandRequest) => Promise<GitCommandResult>
    getRepositoryWorkspaceStatus: (repositoryId: string) => Promise<GitWorkspaceStatus>
    gitAdd: (repositoryId: string, input: GitAddInput) => Promise<GitOperationResult>
    gitCommit: (repositoryId: string, input: GitCommitInput) => Promise<GitOperationResult>
    gitPush: (repositoryId: string, input: GitPushInput, operationId?: string) => Promise<GitOperationResult>
    gitPushTask: (repositoryId: string, input: GitPushInput, operationId: string) => Promise<GitPushTaskResult>
    cancelRepositoryGitOperation: (operationId: string) => Promise<boolean>
    listProjectGitTasks: (projectId?: string) => Promise<ProjectGitTaskLog[]>
    getProjectGitTask: (taskId: string) => Promise<ProjectGitTaskLog | null>
    saveProjectGitTask: (task: ProjectGitTaskLog) => Promise<ProjectGitTaskLog>
    deleteProjectGitTask: (taskId: string) => Promise<void>
    clearProjectGitTasks: () => Promise<void>
    onProjectGitTaskUpdated: (listener: (task: ProjectGitTaskLog) => void) => () => void
    getRepositoryDeploymentApprovalConfig: (repositoryId: string) => Promise<DeploymentApprovalConfig | null>
    saveRepositoryDeploymentApprovalConfig: (input: DeploymentApprovalConfig) => Promise<DeploymentApprovalConfig>
    analyzeRepositoryDeploymentApproval: (repositoryId: string, input?: { manualBaselineSha?: string }) => Promise<DeploymentApprovalAnalysis>
    executeRepositoryDeploymentApproval: (repositoryId: string, input: { reviewedHeadSha: string; baselineSha: string }) => Promise<DeploymentApprovalExecutionResult>
    listRepositoryDeploymentApprovals: (repositoryId: string) => Promise<DeploymentApprovalHistory[]>
    analyzeRepositoryMerge: (repositoryId: string, input: GitMergeAnalysisInput) => Promise<GitMergeAnalysis>
    gitMerge: (repositoryId: string, input: GitMergeInput) => Promise<GitOperationResult>
    suggestCommitMessage: (repositoryId: string, input: GitCommitMessageInput) => Promise<CommitMessageSuggestion>
    prepareRepositoryRelease: (repositoryId: string, input?: RepositoryReleasePrepareInput) => Promise<RepositoryReleasePreparation>
    recommendRepositoryReleaseTag: (repositoryId: string) => Promise<RepositoryReleaseTagRecommendation>
    suggestRepositoryRelease: (repositoryId: string, input?: RepositoryReleaseSuggestionInput) => Promise<RepositoryReleaseSuggestion>
    publishRepositoryRelease: (repositoryId: string, input: RepositoryReleasePublishInput) => Promise<RepositoryReleasePublishResult>
    startRepositoryReleasePublishTask: (repositoryId: string, input: RepositoryReleasePublishInput) => Promise<RepositoryReleasePublishTask>
    listRepositoryReleasePublishTasks: (repositoryId?: string) => Promise<RepositoryReleasePublishTask[]>
    getRepositoryReleasePublishTask: (taskId: string) => Promise<RepositoryReleasePublishTask | null>
    cancelRepositoryReleasePublishTask: (taskId: string) => Promise<RepositoryReleasePublishTask>
    getRepositoryCodemagicBinding: (repositoryId: string) => Promise<CodemagicRepositoryBinding | null>
    saveRepositoryCodemagicBinding: (input: CodemagicRepositoryBindingInput) => Promise<CodemagicRepositoryBinding>
    deleteRepositoryCodemagicBinding: (repositoryId: string) => Promise<void>
    suggestConflictResolution: (repositoryId: string, filePath: string) => Promise<AiConflictSuggestion>
    applyConflictResolution: (repositoryId: string, filePath: string, content: string) => Promise<GitOperationResult>
    listRepositoryCommitFiles: (repositoryId: string, commitHash: string) => Promise<GitCommitFileChange[]>
    getRepositoryCommitDiff: (repositoryId: string, commitHash: string, filePath: string, oldPath?: string, status?: string) => Promise<GitCommitDiff>
    getProjectSummary: (projectId: string, range?: { startDate?: string; endDate?: string }) => Promise<ProjectGitSummary>
    analyzeProjectGit: (projectId: string) => Promise<ProjectGitSummary>
    listProjectPeople: (projectId: string) => Promise<ProjectPersonRecord[]>
    listProjectContributorIdentities: (projectId: string) => Promise<GitContributorIdentity[]>
    listProjectBranchTags: (projectId: string) => Promise<ProjectBranchTagRecord[]>
    saveProjectBranchTag: (input: { id?: string; projectId: string; label: string; branchName: string; color: string }) => Promise<ProjectBranchTagRecord>
    deleteProjectBranchTag: (projectId: string, tagId: string) => Promise<ProjectBranchTagRecord[]>
    listProjectTerminalCommands: (projectId: string) => Promise<ProjectTerminalCommandRecord[]>
    saveProjectTerminalCommand: (input: ProjectTerminalCommandInput) => Promise<ProjectTerminalCommandRecord>
    deleteProjectTerminalCommand: (projectId: string, commandId: string) => Promise<ProjectTerminalCommandRecord[]>
    getPlaneSettings: () => Promise<PlaneSettings>
    savePlaneSettings: (input: PlaneSettingsInput) => Promise<PlaneSettings>
    testPlaneSettings: (input?: PlaneSettingsInput) => Promise<PlaneConnectionTestResult>
    listPlaneProjects: (workspaceSlug: string) => Promise<PlaneProject[]>
    getProjectPlaneBinding: (projectId: string) => Promise<PlaneProjectBinding | null>
    saveProjectPlaneBinding: (input: PlaneProjectBindingInput) => Promise<PlaneProjectBinding>
    deleteProjectPlaneBinding: (projectId: string) => Promise<void>
    getPlaneProjectContent: (projectId: string) => Promise<PlaneProjectContent>
    openPlane: (projectId?: string) => Promise<void>
    getProjectCloudflareSettings: (projectId: string) => Promise<ProjectCloudflareSettings | null>
    saveProjectCloudflareSettings: (input: ProjectCloudflareSettingsInput) => Promise<ProjectCloudflareSettings>
    deleteProjectCloudflareSettings: (projectId: string) => Promise<void>
    testProjectCloudflareSettings: (projectId: string, input?: ProjectCloudflareSettingsInput) => Promise<CloudflareConnectionTestResult>
    listProjectCloudflareDnsRecords: (projectId: string) => Promise<CloudflareDnsRecord[]>
    saveProjectCloudflareDnsRecord: (projectId: string, input: CloudflareDnsRecordInput) => Promise<CloudflareDnsRecord[]>
    deleteProjectCloudflareDnsRecord: (projectId: string, recordId: string) => Promise<CloudflareDnsRecord[]>
    getProjectFirebaseReleaseSettings: (projectId: string) => Promise<ProjectFirebaseReleaseSettings | null>
    saveProjectFirebaseReleaseSettings: (input: ProjectFirebaseReleaseSettingsInput) => Promise<ProjectFirebaseReleaseSettings>
    deleteProjectFirebaseReleaseSettings: (projectId: string) => Promise<void>
    listDataSourceConnections: () => Promise<DataSourceConnection[]>
    saveDataSourceConnection: (input: DataSourceConnectionInput) => Promise<DataSourceConnection>
    deleteDataSourceConnection: (connectionId: string) => Promise<DataSourceConnection[]>
    testDataSourceConnection: (connectionId: string) => Promise<DataSourceConnectionTestResult>
    listDatabaseTables: (connectionId: string) => Promise<DataSourceDatabaseTable[]>
    previewDatabaseTable: (connectionId: string, input: { schema?: string; table: string; limit?: number; offset?: number }) => Promise<DataSourceTabularResult>
    runDataSourceSql: (connectionId: string, input: { sql: string; limit?: number }) => Promise<DataSourceTabularResult>
    scanRedisKeys: (connectionId: string, input?: { pattern?: string; cursor?: string; limit?: number }) => Promise<DataSourceRedisScanResult>
    previewRedisValue: (connectionId: string, input: { key: string; limit?: number }) => Promise<DataSourceRedisValuePreview>
    listS3Objects: (connectionId: string, input?: { prefix?: string; continuationToken?: string; limit?: number }) => Promise<DataSourceS3ListResult>
    previewS3Object: (connectionId: string, input: { key: string }) => Promise<DataSourceS3ObjectPreview>
    listServiceConnections: () => Promise<ServiceConnectionRecord[]>
    saveServiceConnection: (input: ServiceConnectionInput) => Promise<ServiceConnectionRecord>
    deleteServiceConnection: (connectionId: string) => Promise<ServiceConnectionRecord[]>
    testServiceConnection: (connectionId: string) => Promise<{ ok: boolean; message: string; serviceCount: number }>
    listAllProjectServices: () => Promise<ProjectServiceRecord[]>
    listProjectServices: (projectId: string) => Promise<ProjectServiceRecord[]>
    saveProjectService: (input: ProjectServiceInput) => Promise<ProjectServiceRecord>
    saveServiceExternalProjectAlias: (input: ServiceExternalProjectAliasInput) => Promise<ProjectServiceRecord[]>
    bindProjectService: (input: { projectId: string; serviceId: string; repositoryId?: string }) => Promise<ProjectServiceRecord[]>
    syncProjectServices: (connectionId?: string) => Promise<ProjectServiceRecord[]>
    checkProjectServices: (projectId?: string) => Promise<ProjectServiceRecord[]>
    listLatestServiceMonitorChecks: (projectId: string) => Promise<ServiceMonitorCheckRecord[]>
    listServiceMonitorHistory: (projectId: string) => Promise<ServiceMonitorCheckRecord[]>
    listAllServiceMonitorHistory: () => Promise<ServiceMonitorCheckRecord[]>
    listServiceEnvironmentLogs: (serviceId: string, environmentName: string) => Promise<ServiceEnvironmentLogRecord[]>
    listCachedServiceDeployments: (serviceId: string, options?: ServiceDeploymentListOptions) => Promise<ServiceDeploymentSummary[]>
    listServiceDeployments: (serviceId: string, options?: ServiceDeploymentListOptions) => Promise<ServiceDeploymentSummary[]>
    runServiceDeploymentAction: (serviceId: string, input: ServiceDeploymentActionInput) => Promise<ProjectServiceRecord>
    listServiceEnvVars: (serviceId: string) => Promise<ServiceEnvVarRecord[]>
    revealServiceEnvVar: (serviceId: string, envVarId: string) => Promise<ServiceEnvVarRecord>
    saveServiceEnvVar: (serviceId: string, input: VercelEnvVarInput) => Promise<ServiceEnvVarRecord>
    deleteServiceEnvVar: (serviceId: string, envVarId: string) => Promise<void>
    addServiceDomain: (serviceId: string, input: VercelDomainInput) => Promise<ProjectServiceRecord>
    removeServiceDomain: (serviceId: string, domain: string, removeRedirects?: boolean) => Promise<ProjectServiceRecord>
    verifyServiceDomain: (serviceId: string, domain: string) => Promise<ProjectServiceRecord>
    inspectServiceDomainConfig: (serviceId: string, domain: string) => Promise<VercelDomainConfig>
    listServiceRuntimeLogs: (serviceId: string, environmentName: string) => Promise<ServiceEnvironmentLogRecord[]>
    inspectProjectDeploymentContext: (repositoryId: string) => Promise<DeploymentInspection>
    suggestProjectDeploymentConfig: (repositoryId: string, input: { provider: DeploymentProviderType; sourceMode: DeploymentSourceMode }) => Promise<ProjectDeploymentSuggestion>
    listProjectDeploymentTargets: (projectId: string) => Promise<ProjectDeploymentTarget[]>
    saveProjectDeploymentTarget: (input: ProjectDeploymentTargetInput) => Promise<ProjectDeploymentTarget>
    deleteProjectDeploymentTarget: (projectId: string, targetId: string) => Promise<ProjectDeploymentTarget[]>
    prepareProjectDeployment: (input: ProjectDeploymentPrepareInput) => Promise<ProjectDeploymentPreparation>
    startProjectDeploymentTask: (input: ProjectDeploymentTaskStartInput) => Promise<ProjectDeploymentTask>
    listProjectDeploymentTasks: (projectId?: string) => Promise<ProjectDeploymentTask[]>
    getProjectDeploymentTask: (taskId: string) => Promise<ProjectDeploymentTask | null>
    cancelProjectDeploymentTask: (taskId: string) => Promise<ProjectDeploymentTask>
    getDockerSnapshot: () => Promise<DockerSnapshot>
    getDockerContainerDetail: (containerId: string) => Promise<DockerContainerDetail>
    createDockerDevEnvironment: (input: DockerDevEnvironmentInput) => Promise<DockerDevEnvironmentTaskSnapshot>
    listDockerDevEnvironmentTasks: () => Promise<DockerDevEnvironmentTaskSnapshot[]>
    saveDockerResourceNote: (input: DockerResourceNoteInput) => Promise<DockerSnapshot>
    deleteDockerResourceNote: (resourceType: DockerResourceType, resourceKey: string) => Promise<DockerSnapshot>
    startDockerWatch: () => Promise<void>
    stopDockerWatch: () => Promise<void>
    onDockerChanged: (listener: (event: DockerEventSummary) => void) => () => void
    onDockerWatchError: (listener: (event: { message: string }) => void) => () => void
    onDockerDevEnvironmentProgress: (listener: (event: DockerDevEnvironmentTaskSnapshot) => void) => () => void
    saveProjectPerson: (input: { id?: string; projectId: string; displayName: string; role?: string; identities: Array<{ name: string; email: string }> }) => Promise<ProjectPersonRecord>
    deleteProjectPerson: (projectId: string, personId: string) => Promise<ProjectPersonRecord[]>
    scanRepositories: (paths: string[]) => Promise<ScannedRepository[]>
    scanWorkspace: (rootPath: string) => Promise<ScannedRepository[]>
    configureRepositoryIdentity: (localPath: string, identity: { userName: string; userEmail: string }) => Promise<ScannedRepository>
    clearRepositoryIdentity: (localPath: string) => Promise<ScannedRepository>
    selectDirectory: () => Promise<string | null>
    selectFile: () => Promise<string | null>
    selectImage: () => Promise<string | null>
    readClipboardImage: () => Promise<string | null>
    readImageData: (imagePath: string) => Promise<string | null>
    getGitSetupStatus: () => Promise<GitSetupStatus>
    configureGitIdentity: (identity: { userName: string; userEmail: string }) => Promise<GitSetupStatus>
    installGpg: () => Promise<{ status: GitSetupStatus; requiresManualInstall: boolean }>
    importGpgBundle: (input: { sourcePath: string }) => Promise<GitSetupStatus>
    copyGpgPublicKey: (fingerprint: string) => Promise<void>
    configureGitGpgSigning: (fingerprint: string) => Promise<GitSetupStatus>
    getAiSettings: () => Promise<AiSettingsView>
    connectCodexApiServiceToAi: () => Promise<AiSettingsView>
    syncCodexApiServiceToAi: () => Promise<AiSettingsView>
    getInitializationSnapshot: () => Promise<InitializationSnapshot>
    listAiProviders: () => Promise<AiProviderRuntimeSnapshot[]>
    openAiProvider: (input: { providerId: 'codex'; projectPath?: string }) => Promise<AiProviderOpenResult>
    getAiProviderQuota: (input: { providerId: 'codex'; accountId?: string; refresh?: boolean }) => Promise<QuotaSnapshot>
    listAiProviderAccountSnapshots: (input: { providerId: 'codex'; refresh?: boolean }) => Promise<AiProviderAccountSnapshot[]>
    getProjectAiBinding: (input: { projectId: string; providerId: string }) => Promise<ProjectAiBinding | null>
    saveProjectAiBinding: (input: ProjectAiBindingInput) => Promise<ProjectAiBinding>
    getCodexAccount: () => Promise<CodexAccountInfo>
    listCodexAccounts: () => Promise<CodexAccountRegistryView>
    importCodexAccount: (input: CodexAccountImportInput) => Promise<CodexAccountRegistryView>
    createCodexAccount: (input?: { name?: string }) => Promise<CodexAccountRegistryView>
    activateCodexAccount: (accountId: string) => Promise<CodexAccountRegistryView>
    removeCodexAccount: (accountId: string) => Promise<CodexAccountRegistryView>
    verifyCodexAccount: (accountId: string) => Promise<AiRuntimeStatus>
    openCodexAccountLogin: (accountId: string) => Promise<TerminalSession>
    getCodexApiService: () => Promise<CodexApiServiceView>
    startCodexApiService: (input?: { port?: number; model?: string }) => Promise<CodexApiServiceView>
    stopCodexApiService: () => Promise<CodexApiServiceView>
    rotateCodexApiKey: () => Promise<CodexApiServiceView>
    checkCodexApiService: () => Promise<CodexApiHealth>
    getAiRuntimeStatus: (verify?: boolean) => Promise<AiRuntimeStatus>
    getCodexRuntimeStatus: (verify?: boolean) => Promise<AiRuntimeStatus>
    getCodexActivitySnapshot: () => Promise<CodexActivitySnapshot>
    listCodexSessions: () => Promise<CodexSessionsSnapshot>
    getCodexSession: (sessionId: string) => Promise<CodexSessionDetail>
    toggleCodexSessionPin: (sessionId: string) => Promise<CodexSessionSummary>
    sendCodexSessionMessage: (input: CodexSessionMessageInput) => Promise<CodexSessionDetail>
    cancelCodexSession: (sessionId: string) => Promise<CodexSessionDetail>
    onCodexSessionEvent: (listener: (event: CodexSessionEvent) => void) => () => void
    getCodexProjectMonitorSnapshot: () => Promise<CodexProjectMonitorSnapshot>
    onCodexProjectMonitorUpdated: (listener: (snapshot: CodexProjectMonitorSnapshot) => void) => () => void
    onCodexMonitorAlert: (listener: (alert: CodexUncommittedAlert) => void) => () => void
    onCodexMonitorFocus: (listener: (alert: CodexUncommittedAlert) => void) => () => void
    listCodexSites: () => Promise<CodexSite[]>
    createCodexSite: (input: CodexSiteCreateInput) => Promise<CodexSite>
    updateCodexSite: (input: CodexSiteUpdateInput) => Promise<CodexSite>
    deleteCodexSite: (siteId: string) => Promise<CodexSite[]>
    startCodexSitePreview: (siteId: string) => Promise<CodexSite>
    stopCodexSitePreview: (siteId: string) => Promise<CodexSite | null>
    listCodexTasks: () => Promise<CodexTaskRecord[]>
    createCodexTask: (input?: CodexTaskCreateInput) => Promise<CodexTaskRecord>
    renameCodexTask: (input: CodexTaskRenameInput) => Promise<CodexTaskRecord>
    sendCodexTaskMessage: (input: CodexTaskMessageInput) => Promise<CodexTaskRecord>
    cancelCodexTask: (taskId: string) => Promise<CodexTaskRecord>
    deleteCodexTask: (taskId: string) => Promise<CodexTaskRecord[]>
    getCodexTaskEnvironment: (taskId: string) => Promise<CodexTaskEnvironment>
    onCodexTaskEvent: (listener: (event: CodexTaskEvent) => void) => () => void
    listOpenRouterModels: () => Promise<OpenRouterModel[]>
    saveAiSettings: (input: AiSettingsInput) => Promise<AiSettingsView>
    getOverviewSnapshot: () => Promise<OverviewSnapshot>
    getMarketDataSnapshot: (period?: MarketPeriod) => Promise<MarketDataSnapshot>
    refreshOverviewNews: () => Promise<OverviewNewsReport>
    refreshOverviewProjects: () => Promise<OverviewProjectReport>
    getSystemMonitorSnapshot: () => Promise<SystemMonitorSnapshot>
    listCurrentResourceProcesses: () => Promise<ResourceProcess[]>
    listResourceHistory: (range?: { from?: string; to?: string }) => Promise<ResourceHistoryPoint[]>
    importLegacyResourceHistory: (points: Array<{ checkedAt: string; cpuLoadPercent: number; memoryUsagePercent: number; storageUsagePercent: number }>) => Promise<number>
    listProcessResourceHistory: (identityKey: string, range?: { from?: string; to?: string }) => Promise<ProcessHistoryPoint[]>
    listProcessAnalysis: (range?: { from?: string; to?: string }) => Promise<ProcessAnalysis[]>
    getResourceRetentionStatus: () => Promise<ResourceRetentionStatus>
    signalResourceProcess: (pid: number, force?: boolean) => Promise<void>
    revealResourceProcess: (path: string) => Promise<void>
    exportProcessAnalysis: (input: { format: 'csv' | 'json'; range?: { from?: string; to?: string } }) => Promise<{ canceled: boolean; path: string }>
    getResourceMonitorSettings: () => Promise<{ sampleIntervalSeconds: number; rawRetentionDays: number; fiveMinuteRetentionDays: number; loginStartEnabled: boolean }>
    setResourceLoginStart: (enabled: boolean) => Promise<{ enabled: boolean }>
    getStorageGovernanceOverview: () => Promise<StorageOverview>
    listStorageDirectories: (query?: StorageDirectoryQuery) => Promise<StorageDirectoryList>
    selectStorageGovernanceRoots: () => Promise<StorageOverview>
    saveStorageGovernanceRoot: (input: { path: string; label?: string; source?: 'manual' | 'project' | 'category' }) => Promise<StorageOverview>
    deleteStorageGovernanceRoot: (rootId: string) => Promise<StorageOverview>
    setCleanupCategoryAuthorization: (category: CleanupCategory, enabled: boolean) => Promise<StorageOverview>
    startStorageGovernanceScan: (mode: 'quick' | 'deep') => Promise<StorageScanRun>
    pauseStorageGovernanceScan: (scanId: string, paused: boolean) => Promise<void>
    verifyStorageDuplicateGroup: (itemId: string) => Promise<StorageScanItem[]>
    previewStorageCleanup: (itemIds: string[]) => Promise<StorageScanItem[]>
    executeStorageCleanup: (itemIds: string[]) => Promise<CleanupAuditRecord[]>
    listStorageCleanupAudit: () => Promise<CleanupAuditRecord[]>
    listExternalCleanupPreviews: () => Promise<ExternalCleanupPreview[]>
    executeExternalCleanup: (key: ExternalCleanupPreview['key']) => Promise<CleanupAuditRecord>
    onStorageGovernanceProgress: (listener: (event: StorageScanProgress) => void) => () => void
    getOaSettings: () => Promise<OaSettingsView>
    saveOaSettings: (input: OaSettingsInput) => Promise<OaSettingsView>
    openOaDocs: () => Promise<void>
    listOaDocuments: () => Promise<OaDocumentList>
    getOaDocumentTasks: (document: OaDocumentRecord) => Promise<OaDocumentTaskList>
    getOaBitable: (tableId?: string, viewId?: string) => Promise<OaBitableSnapshot>
    saveOaBitableRecord: (input: { tableId: string; recordId?: string; fields: Record<string, unknown> }) => Promise<OaBitableRecord>
    deleteOaBitableRecord: (input: { tableId: string; recordId: string }) => Promise<void>
    getLarkBotDashboard: () => Promise<LarkBotDashboard>
    listLarkBotTasks: (query?: { q?: string; status?: string }) => Promise<LarkBotTask[]>
    listLarkBotNotifications: () => Promise<LarkBotNotification[]>
    getLarkBotSettings: () => Promise<LarkBotRuntimeSettings>
    saveLarkBotSettings: (input: Partial<LarkBotRuntimeSettings>) => Promise<LarkBotRuntimeSettings>
    syncLarkBot: () => Promise<Record<string, unknown>>
    sendLarkBotTestMessage: () => Promise<void>
    sendLarkBotReminder: () => Promise<void>
    getMenuBarManagerStatus: () => Promise<MenuBarManagerStatus>
    saveMenuBarManagerSettings: (input: Partial<MenuBarManagerSettings>) => Promise<MenuBarManagerStatus>
    requestMenuBarManagerPermission: () => Promise<MenuBarManagerStatus>
    refreshMenuBarItems: () => Promise<MenuBarManagerStatus>
    showMenuBarHiddenItems: () => Promise<MenuBarManagerStatus>
    hideMenuBarHiddenItems: () => Promise<MenuBarManagerStatus>
    toggleMenuBarHiddenItems: () => Promise<MenuBarManagerStatus>
    onMenuBarManagerChanged: (listener: (status: MenuBarManagerStatus) => void) => () => void
    listGithubTokens: () => Promise<GithubTokenView[]>
    saveGithubToken: (input: GithubTokenInput) => Promise<GithubTokenView[]>
    refreshGithubToken: (tokenId: string) => Promise<GithubTokenView[]>
    deleteGithubToken: (tokenId: string) => Promise<GithubTokenView[]>
    listCodemagicTokens: () => Promise<CodemagicTokenView[]>
    saveCodemagicToken: (input: CodemagicTokenInput) => Promise<CodemagicTokenView[]>
    refreshCodemagicToken: (tokenId: string) => Promise<CodemagicTokenView[]>
    deleteCodemagicToken: (tokenId: string) => Promise<CodemagicTokenView[]>
    listCodemagicTeams: (tokenId: string) => Promise<CodemagicTeam[]>
    listCodemagicApps: (input: CodemagicAppListInput) => Promise<CodemagicApp[]>
    createCodemagicArtifactPublicUrl: (input: CodemagicArtifactPublicUrlInput) => Promise<{ url: string; expiresAt: string }>
    listRsaPrivateKeys: () => Promise<RsaPrivateKeyRecord[]>
    createRsaPrivateKey: (input: RsaPrivateKeyCreateInput) => Promise<RsaPrivateKeyRecord>
    updateRsaPrivateKey: (input: RsaPrivateKeyUpdateInput) => Promise<RsaPrivateKeyRecord>
    deleteRsaPrivateKey: (id: string) => Promise<RsaPrivateKeyRecord[]>
    inspectCliEnvironment: () => Promise<CliEnvironmentSnapshot>
    repairCliEnvironment: () => Promise<CliEnvironmentRepairResult>
    previewMonthlyPerformance: (input: MonthlyPerformancePreviewInput) => Promise<MonthlyPerformancePreview>
    exportMonthlyPerformance: (input: MonthlyPerformanceExportInput) => Promise<MonthlyPerformanceExportResult>
    listMonthlyPerformanceSessions: () => Promise<MonthlyPerformanceSession[]>
    createMonthlyPerformanceSession: (input: MonthlyPerformanceSessionCreateInput) => Promise<MonthlyPerformanceSession>
    sendMonthlyPerformanceSessionMessage: (input: MonthlyPerformanceSessionMessageInput) => Promise<MonthlyPerformanceSession>
    confirmMonthlyPerformanceSession: (input: { sessionId: string; projectId: string; month: string }) => Promise<MonthlyPerformanceSession>
    exportMonthlyPerformanceSession: (input: MonthlyPerformanceSessionExportInput) => Promise<MonthlyPerformanceSession>
    generateSshKey: (input: string | SshKeyGenerationInput) => Promise<GitSetupStatus['sshPublicKeys'][number]>
    copySshPublicKey: (publicKeyPath: string) => Promise<void>
    copySshKeyPath: (path: string, kind: SshKeyKind) => Promise<void>
    importSshKey: (input: SshKeyImportInput) => Promise<GitSetupStatus>
    deleteSshKey: (path: string, kind: SshKeyKind) => Promise<GitSetupStatus>
    saveSshPrivateKeyPassphrase: (path: string, passphrase: string) => Promise<GitSetupStatus>
    clearSshPrivateKeyPassphrase: (path: string) => Promise<GitSetupStatus>
    fixSshPrivateKeyPermissions: (path: string) => Promise<GitSetupStatus>
    deriveSshPublicKey: (privateKeyPath: string) => Promise<GitSetupStatus>
    readSshConfig: () => Promise<SshConfigFile>
    writeSshConfig: (content: string) => Promise<SshConfigFile>
    openSshDirectory: () => Promise<void>
    listTerminalRemoteGroups: () => Promise<TerminalRemoteGroupRecord[]>
    saveTerminalRemoteGroup: (input: TerminalRemoteGroupInput) => Promise<TerminalRemoteGroupRecord>
    deleteTerminalRemoteGroup: (groupId: string) => Promise<TerminalRemoteGroupRecord[]>
    listTerminalRemoteHosts: () => Promise<TerminalRemoteHostRecord[]>
    saveTerminalRemoteHost: (input: TerminalRemoteHostInput) => Promise<TerminalRemoteHostRecord>
    deleteTerminalRemoteHost: (hostId: string) => Promise<TerminalRemoteHostRecord[]>
    getTerminalRemoteSshCommand: (hostId: string) => Promise<string>
    listTerminals: () => Promise<TerminalSessionSnapshot[]>
    openTerminal: (input?: TerminalCreateInput) => Promise<TerminalSession>
    writeTerminal: (sessionId: string, data: string) => Promise<void>
    resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
    closeTerminal: (sessionId: string) => Promise<void>
    onTerminalData: (listener: (event: TerminalDataEvent) => void) => () => void
    onTerminalExit: (listener: (event: TerminalExitEvent) => void) => () => void
    getAppUpdateState: () => Promise<AppUpdateState>
    checkAppUpdate: () => Promise<AppUpdateState>
    installAppUpdate: () => Promise<AppUpdateState>
    getAppRuntimeInfo: () => Promise<AppRuntimeInfo>
    startQuickBuild: (input?: QuickBuildStartInput) => Promise<QuickBuildTask>
    getQuickBuildTask: () => Promise<QuickBuildTask | null>
    cancelQuickBuild: () => Promise<QuickBuildTask>
    restartQuickBuildApp: (input?: QuickBuildRestartInput) => Promise<QuickBuildRestartResult>
    onQuickBuildTaskUpdated: (listener: (task: QuickBuildTask | null) => void) => () => void
    onAppUpdateState: (listener: (state: AppUpdateState) => void) => () => void
    openAppReleases: () => Promise<void>
    openGitDownload: () => Promise<void>
    openExternalUrl: (url: string) => Promise<void>
  }
}
