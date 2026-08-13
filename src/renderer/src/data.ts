export type ProjectStatus = 'ready' | 'needs-setup' | 'warning'

export type Project = {
  id: string
  name: string
  description: string
  status: ProjectStatus
  owner: string
  workspacePath: string
  groupId?: string | null
  createdAt: string
  isFavorite: boolean
}

export type ProjectGroup = {
  id: string
  name: string
  sortOrder: number
  projectCount: number
  createdAt: string
  updatedAt: string
}

export type ProjectGroupInput = {
  id?: string
  name: string
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

export type RsaPrivateKeySize = 2048 | 4096

export type RsaPrivateKeyRecord = {
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

export type RsaPrivateKeyCreateInput = {
  name: string
  notes?: string
  keySize?: RsaPrivateKeySize
}

export type RsaPrivateKeyUpdateInput = {
  id: string
  name: string
  notes?: string
}

export type CliEnvironmentIssueStatus = 'ok' | 'warning' | 'error'

export type CliEnvironmentRepairAction = 'source-profile-from-zprofile' | 'install-zsh-dev-prompt' | 'install-zsh-ls-colors'

export type CliEnvironmentIssue = {
  id: string
  status: CliEnvironmentIssueStatus
  title: string
  detail: string
  action?: CliEnvironmentRepairAction
}

export type CliEnvironmentConfigFile = {
  key: 'profile' | 'zprofile' | 'zshrc' | 'bashProfile' | 'bashrc'
  label: string
  path: string
  exists: boolean
  managed: boolean
}

export type CliEnvironmentCommandCheck = {
  name: string
  available: boolean
  path: string
  version: string
  error: string
}

export type CliEnvironmentPlatform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd'

export type CliEnvironmentSnapshot = {
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

export type CliEnvironmentRepairResult = {
  snapshot: CliEnvironmentSnapshot
  appliedActions: CliEnvironmentRepairAction[]
  changedFiles: string[]
  backupFiles: string[]
}

export type PlaneSettingsInput = {
  apiBaseUrl?: string
  webBaseUrl?: string
  apiToken?: string
}

export type PlaneSettings = {
  apiBaseUrl: string
  webBaseUrl: string
  apiToken: string
  tokenConfigured: boolean
}

export type PlaneConnectionTestResult = {
  ok: boolean
  message: string
  userName: string
  userEmail: string
}

export type PlaneProject = {
  id: string
  name: string
  identifier: string
  description: string
  totalMembers: number
  totalCycles: number
  totalModules: number
}

export type PlaneProjectBindingInput = {
  projectId: string
  workspaceSlug: string
  planeProjectId: string
  planeProjectName: string
  planeProjectIdentifier: string
}

export type PlaneProjectBinding = PlaneProjectBindingInput & {
  createdAt: string
  updatedAt: string
}

export type PlaneProjectSummary = {
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

export type PlaneWorkItem = {
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

export type PlaneCycle = {
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

export type PlaneModule = {
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

export type PlaneProjectContent = {
  binding: PlaneProjectBinding
  projectUrl: string
  summary: PlaneProjectSummary
  workItems: PlaneWorkItem[]
  cycles: PlaneCycle[]
  modules: PlaneModule[]
  fetchedAt: string
}

export type CloudflareDnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX'

export type ProjectCloudflareSettingsInput = {
  projectId: string
  domain?: string
  zoneId?: string
  apiToken?: string
}

export type ProjectCloudflareSettings = {
  projectId: string
  domain: string
  zoneId: string
  apiToken: string
  tokenConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type ProjectFirebaseReleaseSettingsInput = {
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

export type ProjectFirebaseReleaseSettings = {
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

export type CloudflareConnectionTestResult = {
  ok: boolean
  message: string
  recordCount: number
}

export type CloudflareDnsRecordInput = {
  id?: string
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl?: number
  proxied?: boolean
  priority?: number
  comment?: string
}

export type CloudflareDnsRecord = {
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

export type DataSourceKind = 'mysql' | 'postgresql' | 'redis' | 's3'

export type DataSourceConfig = {
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

export type DataSourceSecret = {
  password?: string
  secretAccessKey?: string
  sessionToken?: string
}

export type DataSourceConnectionInput = {
  id?: string
  kind: DataSourceKind
  name: string
  config: DataSourceConfig
  secret?: DataSourceSecret
}

export type DataSourceConnection = {
  id: string
  kind: DataSourceKind
  name: string
  config: DataSourceConfig
  secretConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type DataSourceConnectionTestResult = {
  ok: boolean
  message: string
  detail: string
}

export type DataSourceDatabaseTable = {
  schema: string
  name: string
  type: string
}

export type DataSourceTabularResult = {
  columns: string[]
  rows: Array<Record<string, unknown>>
  rowCount: number
  truncated: boolean
  durationMs: number
}

export type DataSourceRedisScanResult = {
  keys: string[]
  nextCursor: string
  scannedCount: number
}

export type DataSourceRedisValuePreview = {
  key: string
  type: string
  ttlSeconds: number
  size: number
  value: unknown
  rows: Array<Record<string, unknown>>
}

export type DataSourceS3Object = {
  key: string
  size: number
  lastModified: string
  etag: string
  storageClass: string
}

export type DataSourceS3ListResult = {
  bucket: string
  prefix: string
  objects: DataSourceS3Object[]
  nextContinuationToken: string
  truncated: boolean
}

export type DataSourceS3ObjectPreview = {
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

export type Repository = {
  id: string
  projectId: string
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

export type GitRemote = {
  name: string
  fetchUrl: string
  pushUrl: string
}

export type GitPushTarget = {
  remote: string
  branch: string
  ahead: number
  hasRemoteBranch: boolean
}

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

export type DeploymentApprovalAnalysis = {
  repositoryId: string
  remote: string
  branch: string
  reviewedHeadSha: string
  baselineSha: string
  baselineSource: 'approval' | 'manual'
  commits: Array<{ hash: string; authorName: string; authorEmail: string; committedAt: string; message: string }>
  files: Array<{ path: string; status: string; additions: number; deletions: number; binary: boolean; riskReasons: string[]; targetIds: string[]; patch: string }>
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

export type RepositoryRemoteInput = {
  repositoryId: string
  currentName?: string
  name: string
  fetchUrl: string
  pushUrl?: string
}

export type GitCommandRequest = {
  repositoryId: string
  command: string
}

export type GitCommandResult = {
  ok: boolean
  command: string
  args: string[]
  stdout: string
  stderr: string
  exitCode: number | null
}

export type TerminalCreateInput = {
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

export type TerminalSession = {
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

export type TerminalSessionSnapshot = TerminalSession & {
  output: string[]
}

export type TerminalDataEvent = {
  sessionId: string
  data: string
}

export type TerminalExitEvent = {
  sessionId: string
  exitCode: number
  signal?: number
}

export type AppRuntimeInfo = {
  version: string
  canQuickBuild: boolean
  isPackaged: boolean
  isDevelopmentBuild: boolean
  isDevServer: boolean
  appPath: string
  projectRoot: string
}

export type SystemMonitorStatus = 'healthy' | 'warning' | 'critical'

export type SystemMonitorDiskVolume = {
  filesystem: string
  mount: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

export type SystemMonitorMemoryInfo = {
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

export type SystemMonitorCpuInfo = {
  model: string
  coreCount: number
  speedMhz: number
  loadAverage: number[]
  loadPercent: number
}

export type SystemMonitorAppInfo = {
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

export type SystemMonitorNetworkInterface = {
  name: string
  address: string
  family: string
  mac: string
  cidr: string
  internal: boolean
}

export type SystemMonitorProxyEndpoint = {
  enabled: boolean
  host: string
  port: number
}

export type SystemMonitorProxyInfo = {
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

export type SystemMonitorDefaultRoute = {
  gateway: string
  interface: string
  error: string
}

export type SystemMonitorClashProxyGroup = {
  name: string
  type: string
  now: string
}

export type SystemMonitorClashInfo = {
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

export type SystemMonitorNetworkInfo = {
  interfaces: SystemMonitorNetworkInterface[]
  dnsServers: string[]
  proxy: SystemMonitorProxyInfo
  route: SystemMonitorDefaultRoute
  clash: SystemMonitorClashInfo
}

export type SystemMonitorSnapshot = {
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

export type ResourceProcess = {
  identityKey: string; instanceKey: string; pid: number; parentPid: number; appName: string; processName: string; user: string
  cpuPercent: number; memoryBytes: number; privateMemoryBytes: number; virtualMemoryBytes: number; threadCount: number; portCount: number
  pageIns: number; state: string; elapsedSeconds: number; executablePath: string; bundlePath: string; command: string
  networkReceivedBytes: number; networkSentBytes: number
}

export type ResourceHistoryPoint = { capturedAt: string; cpuPercent: number; memoryUsagePercent: number; memoryUsedBytes: number; swapUsedBytes: number; storageUsagePercent: number; networkInBytes?: number; networkOutBytes?: number }
export type ProcessHistoryPoint = { capturedAt: string; cpuAverage: number; cpuPeak: number; memoryAverageBytes: number; memoryPeakBytes: number; sampleCount: number; networkInBytes: number; networkOutBytes: number }
export type ProcessAnalysis = {
  identityKey: string; appName: string; processName: string; executablePath: string; averageCpuPercent: number; peakCpuPercent: number
  averageMemoryBytes: number; peakMemoryBytes: number; sampleCount: number; aboveThresholdSeconds: number; firstSeenAt: string; lastSeenAt: string
  networkReceivedBytes: number; networkSentBytes: number
}
export type ResourceRetentionStatus = { rawDays: number; fiveMinuteDays: number; sampleIntervalSeconds: number; rawSampleCount: number; rollupSampleCount: number; oldestRawAt: string; databaseBytesEstimate: number }
export type CleanupRisk = 'low' | 'confirm' | 'high' | 'protected'
export type CleanupCategory = 'large-file' | 'stale-file' | 'duplicate-candidate' | 'download' | 'cache' | 'log' | 'development' | 'docker' | 'trash' | 'protected'
export type StorageRoot = { id: string; path: string; label: string; enabled: boolean; source: 'manual' | 'project' | 'category'; createdAt: string; lastScannedAt: string }
export type StorageScanItem = { id: string; scanId: string; rootId: string; path: string; name: string; sizeBytes: number; modifiedAt: string; accessedAt: string; extension: string; category: CleanupCategory; risk: CleanupRisk; reason: string; duplicateKey: string; verifiedHash: string; isDirectory: boolean }
export type StorageScanRun = { id: string; mode: 'quick' | 'deep'; status: 'running' | 'paused' | 'completed' | 'failed'; startedAt: string; finishedAt: string; filesScanned: number; directoriesScanned: number; bytesScanned: number; reclaimableBytes: number; errorCount: number; errors: string[] }
export type CleanupPolicy = { key: CleanupCategory; label: string; description: string; enabled: boolean; risk: CleanupRisk; thresholdBytes: number; staleDays: number; requiresCategoryAuthorization: boolean }
export type CleanupAuditRecord = { id: string; action: 'scan' | 'verify' | 'ignore' | 'trash' | 'command' | 'terminate' | 'force-terminate' | 'export'; target: string; status: 'success' | 'failed' | 'blocked'; detail: string; reclaimedBytes: number; createdAt: string }
export type ExternalCleanupPreview = { key: 'docker-images' | 'docker-containers' | 'docker-build-cache'; label: string; command: string; estimatedBytes: number; risk: 'high'; enabled: boolean }
export type StorageDirectoryEntry = { path: string; name: string; rootId: string; sizeBytes: number; growthBytes: number; parentPath: string; fileCount: number; directoryCount: number; childDirectoryCount: number; depth: number; rootPercent: number }
export type StorageDirectorySortBy = 'name' | 'sizeBytes' | 'growthBytes' | 'fileCount' | 'directoryCount' | 'childDirectoryCount' | 'depth'
export type StorageDirectoryQuery = { scanId?: string; rootId?: string; parentPath?: string; search?: string; limit?: number; offset?: number; sortBy?: StorageDirectorySortBy; sortOrder?: 'asc' | 'desc' }
export type StorageDirectoryList = { scanId: string; total: number; directories: StorageDirectoryEntry[] }
export type StorageTrendPoint = { capturedAt: string; scannedBytes: number; reclaimableBytes: number }
export type StorageOverview = { roots: StorageRoot[]; latestRun: StorageScanRun | null; items: StorageScanItem[]; policies: CleanupPolicy[]; totalReclaimableBytes: number; categoryBytes: Record<string, number>; directories: StorageDirectoryEntry[]; trend: StorageTrendPoint[] }
export type StorageScanProgress = { scanId: string; status: StorageScanRun['status']; currentPath: string; filesScanned: number; directoriesScanned: number; bytesScanned: number; reclaimableBytes: number; errorCount: number }

export type QuickBuildTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type QuickBuildStartInput = {
  cwd?: string
}

export type QuickBuildRestartInput = {
  cwd?: string
}

export type QuickBuildRestartResult = {
  appPath: string
  restarted: boolean
}

export type QuickBuildTask = {
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

export type ProjectTerminalCommandRecord = {
  id: string
  projectId: string
  name: string
  command: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ProjectTerminalCommandInput = {
  id?: string
  projectId: string
  name: string
  command: string
}

export type GitAddInput = {
  mode: 'all' | 'paths'
  paths: string[]
}

export type GitCommitInput = {
  message: string
  paths?: string[]
  tagName?: string
}

export type GitPushInput = {
  remote?: string
  remotes?: string[]
  branch: string
}

export type GitMergeInput = {
  source: string
}

export type GitBranchSwitchInput = {
  branchName: string
  create?: boolean
  startPoint?: string
  track?: boolean
}

export type GitCommitMessageInput = {
  paths: string[]
}

export type CommitMessageSuggestion = {
  message: string
}

export type ReleaseScriptName = 'publish:mac' | 'package:mac' | 'package:android' | 'build:android' | 'build' | ''
export type ReleasePublishProvider = 'github' | 'codemagic' | 'firebase' | 'nextjs-pm2'
export type ReleasePublishActionKey = 'commit-workspace-changes' | 'replace-local-tag'

export type ReleasePublishAction = {
  key: ReleasePublishActionKey
  issue: string
  label: string
  description: string
}

export type RepositoryReleasePlan = {
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

export type RepositoryReleasePrepareInput = {
  targetVersion?: string
  provider?: ReleasePublishProvider
}

export type RepositoryReleasePreparation = {
  repositoryId: string
  packageManager: 'pnpm' | 'npm' | 'yarn'
  localPath: string
  documentationContext: string
  recentCommits: string[]
  plan: RepositoryReleasePlan
}

export type RepositoryReleaseSuggestionInput = {
  targetVersion?: string
}

export type ReleaseTagHistoryEntry = {
  tagName: string
  version: string
}

export type RepositoryReleaseTagRecommendation = {
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  historicalTags: ReleaseTagHistoryEntry[]
}

export type RepositoryReleaseSuggestion = {
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
}

export type RepositoryReleasePublishInput = {
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

export type RepositoryReleasePublishResult = {
  ok: boolean
  provider: ReleasePublishProvider
  repository: Repository
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

export type RepositoryReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type RepositoryReleasePublishTask = {
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
  repository?: Repository
}

export type ReleasePublishArtifact = {
  name: string
  type: string
  sizeInBytes: number
  downloadUrl: string
  versionCode?: string
  versionName?: string
}

export type GitMergeAnalysisInput = {
  source: string
  target: string
}

export type GitStatusFile = {
  path: string
  oldPath: string
  indexStatus: string
  worktreeStatus: string
  conflict: boolean
}

export type ConflictSection = {
  index: number
  currentLabel: string
  incomingLabel: string
  currentContent: string
  incomingContent: string
  rawContent: string
}

export type GitConflictFile = {
  path: string
  sections: ConflictSection[]
  content: string
}

export type GitWorkspaceStatus = {
  repositoryId: string
  branch: string
  files: GitStatusFile[]
  conflicts: GitConflictFile[]
  pushTargets: GitPushTarget[]
}

export type GitOperationResult = {
  ok: boolean
  repository: Repository
  status: GitWorkspaceStatus
  stdout: string
  stderr: string
}

export type GitMergeAnalysis = {
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

export type AiConflictSuggestion = {
  filePath: string
  suggestedContent: string
}

export type RemoteAlignmentStatus = 'aligned' | 'diverged' | 'missing-remote' | 'missing-branch' | 'unknown'

export type RemoteAlignmentBranchStatus = 'aligned' | 'diverged' | 'missing-branch' | 'unknown'

export type RemoteAlignmentRemote = {
  name: string
  url: string
  branchCount: number
}

export type RemoteAlignmentRemoteRef = {
  remoteName: string
  ref: string
  commit: string
  ahead: number
}

export type RemoteAlignmentBranch = {
  branchName: string
  remotes: RemoteAlignmentRemoteRef[]
  status: RemoteAlignmentBranchStatus
  uniqueCommitCount: number
}

export type RemoteAlignmentSummary = {
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

export type GitCommit = {
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

export type GitCommitFileChange = {
  id: string
  status: string
  path: string
  oldPath: string
  additions: number
  deletions: number
  binary: boolean
}

export type GitCommitDiff = {
  commitHash: string
  filePath: string
  oldPath: string
  status: string
  patch: string
  oldContent: string
  newContent: string
  binary: boolean
}

export type ProjectPerson = {
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

export type ProjectBranchTag = {
  id: string
  projectId: string
  label: string
  branchName: string
  color: string
}

export type Person = {
  id: string
  nickname: string
  role: string
  gitIdentities: string[]
}

export type Environment = {
  id: string
  projectId: string
  name: string
  type: 'Production' | 'Staging' | 'Testing' | 'Development'
  status: 'Unknown' | 'Online' | 'Deploying' | 'Failed' | 'Idle'
  deployTime: string
  commitHash: string
  deployer: string
}

export type Provider = {
  id: string
  name: string
  type: 'Git' | 'Hosting' | 'Cloud' | 'DNS'
  status: 'Not configured' | 'Connected'
}

export type ServiceProviderType = 'railway' | 'vercel'

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

export type ProjectDeploymentPrepareInput = {
  targetId?: string
  repositoryId: string
  provider: DeploymentProviderType
  sourceMode: DeploymentSourceMode
  config?: Partial<ProjectDeploymentConfig>
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

export type ProjectDeploymentTask = {
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

export type ProjectDeploymentTaskStartInput = {
  projectId: string
  targetId: string
  config?: Partial<ProjectDeploymentConfig>
}

export type RailwayTokenType = 'account' | 'workspace' | 'project'

export type ServiceMonitorStatus = 'online' | 'degraded' | 'offline' | 'unknown'

export type ServiceConnection = {
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

export type ServiceConnectionInput = {
  id?: string
  projectId?: string
  provider: ServiceProviderType
  name: string
  token?: string
  teamId?: string
  workspaceId?: string
  railwayTokenType?: RailwayTokenType
}

export type ProjectServiceEnvironment = {
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

export type ProjectServiceDomain = {
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

export type ProjectService = {
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
  environments: ProjectServiceEnvironment[]
  domains: ProjectServiceDomain[]
}

export type ProjectServiceInput = {
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
  environments?: Array<Partial<ProjectServiceEnvironment> & { name: string }>
  domains?: Array<Partial<ProjectServiceDomain> & { domain: string }>
}

export type ServiceExternalProjectAliasInput = {
  provider: ServiceProviderType
  externalProjectId: string
  alias?: string
}

export type ServiceMonitorCheck = {
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

export type ServiceEnvironmentLogLine = {
  timestamp: string
  level: string
  message: string
  source: string
}

export type ServiceDeploymentSummary = {
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

export type VercelDeploymentSummary = ServiceDeploymentSummary

export type ServiceDeploymentListOptions = {
  target?: string
  limit?: number
}

export type VercelDeploymentListOptions = ServiceDeploymentListOptions

export type ServiceDeploymentActionInput = {
  action: 'deploy' | 'redeploy' | 'restart' | 'stop' | 'cancel' | 'promote' | 'rollback'
  deploymentId?: string
  environmentId?: string
  description?: string
}

export type VercelDeploymentActionInput = ServiceDeploymentActionInput

export type ServiceEnvVarRecord = {
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

export type VercelEnvVarRecord = ServiceEnvVarRecord

export type VercelEnvVarInput = {
  id?: string
  key: string
  value?: string
  type: string
  target?: string[]
  customEnvironmentIds?: string[]
  gitBranch?: string
  comment?: string
}

export type VercelDomainInput = {
  name: string
  environmentName?: string
  gitBranch?: string
  redirect?: string
  redirectStatusCode?: number
}

export type DockerResourceType = 'image' | 'container'

export type DockerResourceNote = {
  resourceType: DockerResourceType
  resourceKey: string
  displayName: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type DockerResourceNoteInput = {
  resourceType: DockerResourceType
  resourceKey: string
  displayName?: string
  notes?: string
}

export type DockerDevEnvironmentSystem = 'ubuntu-24.04' | 'ubuntu-22.04' | 'debian-12' | 'node-22' | 'python-3.12'

export type DockerDevEnvironmentInput = {
  hostPath: string
  name?: string
  workspaceFolder?: string
  system: DockerDevEnvironmentSystem
  enableDockerInDocker?: boolean
  overwrite?: boolean
}

export type DockerDevEnvironmentResult = {
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

export type DockerDevEnvironmentTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type DockerDevEnvironmentRunMode = 'devcontainer-cli' | 'docker-run'

export type DockerDevEnvironmentTaskSnapshot = {
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

export type DockerImageSummary = {
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
  note: DockerResourceNote | null
}

export type DockerContainerSummary = {
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
  note: DockerResourceNote | null
}

export type DockerContainerPortDetail = {
  privatePort: string
  type: string
  hostIp: string
  hostPort: string
}

export type DockerContainerMountDetail = {
  type: string
  source: string
  destination: string
  mode: string
  rw: boolean
  name: string
}

export type DockerContainerNetworkDetail = {
  name: string
  networkId: string
  ipAddress: string
  gateway: string
  macAddress: string
}

export type DockerContainerDetail = {
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

export type DockerSnapshot = {
  images: DockerImageSummary[]
  containers: DockerContainerSummary[]
  notes: DockerResourceNote[]
  checkedAt: string
}

export type DockerEventSummary = {
  id: string
  type: string
  action: string
  status: string
  time: string
  actorAttributes: Record<string, string>
}

export type VercelDomainConfig = {
  configured: boolean
  misconfigured: boolean
  acceptedChallenges: unknown[]
  recommendedRecords: unknown[]
  raw: Record<string, unknown>
}

export type ContributorSummary = {
  personId: string
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
}

export type GitContributorIdentity = {
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

export type DailyGitMetric = {
  date: string
  commits: number
  additions: number
  deletions: number
}

export type RepositoryContribution = {
  repositoryId: string
  repositoryName: string
  commits: number
  additions: number
  deletions: number
}

export type ProjectGitSummary = {
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

export type AiSettingsInput = {
  enabled: boolean
  provider?: 'openai-compatible' | 'openrouter' | 'codex-cli' | 'cursor-cli' | 'codex-local-api'
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

export type AiSettingsView = {
  enabled: boolean
  provider: 'openai-compatible' | 'openrouter' | 'codex-cli' | 'cursor-cli' | 'codex-local-api'
  baseUrl: string
  apiKey: string
  apiKeyConfigured: boolean
  model: string
  temperature: number
}

export type CodexAccountInfo = {
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

export type CodexManagedAccount = CodexAccountInfo & {
  id: string
  name: string
  source: 'local' | 'imported'
  codexHome: string
  active: boolean
  createdAt: string
  lastUsedAt: string
}

export type CodexAccountRegistryView = {
  activeAccountId: string
  accounts: CodexManagedAccount[]
  message: string
}

export type CodexAccountImportInput = {
  name?: string
  sourcePath: string
}

export type CodexApiServiceView = {
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

export type QuotaSource = 'app-server' | 'session' | 'cache' | 'auth' | 'unavailable'
export type QuotaStatus = 'available' | 'stale' | 'unknown' | 'error' | 'reauth-required'

export type QuotaWindow = {
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

export type QuotaCredits = {
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

export type QuotaLimitBucket = {
  id: string
  name: string
  planType: string
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
  credits: QuotaCredits | null
  rateLimitReachedType: string
}

export type DailyUsageSnapshot = {
  summary: {
    lifetimeTokens: string | null
    peakDailyTokens: string | null
    longestRunningTurnSec: string | null
    currentStreakDays: string | null
    longestStreakDays: string | null
  } | null
  dailyUsageBuckets: Array<{ startDate: string; tokens: string }> | null
}

export type QuotaSnapshot = {
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

export type AiRuntimeStatus = {
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

export type CodexTaskRunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type CodexTaskMessage = {
  id: string
  taskId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images: string[]
  eventType: string
  createdAt: string
}

export type CodexTaskEnvironment = {
  cwd: string
  branch: string
  additions: number
  deletions: number
  filesChanged: number
  hasChanges: boolean
  repositoryAvailable: boolean
  checkedAt: string
}

export type CodexTaskRecord = {
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

export type CodexTaskCreateInput = {
  title?: string
  projectId?: string
  cwd?: string
  accountId?: string
  model?: string
}

export type CodexTaskMessageInput = {
  taskId: string
  content: string
  images?: string[]
}

export type CodexTaskEventType = 'updated' | 'running' | 'output' | 'succeeded' | 'failed' | 'cancelled'

export type CodexTaskEvent = {
  type: CodexTaskEventType
  task: CodexTaskRecord
}

export type CodexActivitySnapshot = {
  available: boolean
  running: number
  completed: number
  aborted: number
  sessions: CodexSessionRecord[]
  checkedAt: string
  source: string
  error: string
}

export type CodexSessionStatus = 'idle' | 'running' | 'completed' | 'aborted'

export type CodexSessionRecord = {
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

export type CodexConversationItemKind = 'user' | 'assistant' | 'tool-call' | 'tool-output' | 'status'

export type CodexTokenUsage = {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteInputTokens: number
  outputTokens: number
  reasoningOutputTokens: number
  totalTokens: number
  cumulativeInputTokens: number
  cumulativeOutputTokens: number
  cumulativeTotalTokens: number
  contextWindow: number
}

export type CodexConversationItem = {
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
  usage?: CodexTokenUsage
}

export type CodexSessionSummary = {
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

export type CodexSessionDetail = CodexSessionSummary & {
  items: CodexConversationItem[]
}

export type CodexProjectRecord = {
  key: string
  name: string
  cwd: string
  updatedAt: string
  sessionCount: number
  runningCount: number
}

export type CodexSessionsSnapshot = {
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
  groups: ProjectGroup[]
  alerts: CodexUncommittedAlert[]
  running: number
  uncommitted: number
  unlinked: number
  completed: number
  failed: number
  sessions: CodexSessionSummary[]
}

export type CodexSessionEventType = 'item' | 'running' | 'updated' | 'completed' | 'failed' | 'cancelled'

export type CodexSessionEvent = {
  type: CodexSessionEventType
  sessionId: string
  item?: CodexConversationItem
  session?: CodexSessionSummary
  error?: string
}

export type CodexSessionMessageInput = {
  sessionId: string
  content: string
  images?: string[]
  model?: string
  accountId?: string
}

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

export type OaSettingsInput = {
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

export type OaSettingsView = {
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

export type OaDocumentRecord = {
  id: string
  token: string
  name: string
  type: string
  url: string
  createdAt: string
  updatedAt: string
}

export type OaDocumentList = {
  sourceKind: 'home' | 'drive-root' | 'folder' | 'document' | 'unknown'
  sourceUrl: string
  documents: OaDocumentRecord[]
  nextPageToken: string
  hasMore: boolean
  unsupportedReason: string
}

export type OaDocumentTaskRecord = {
  id: string
  title: string
  completed: boolean
  documentToken: string
  documentName: string
  documentUrl: string
}

export type OaDocumentTaskList = {
  documentToken: string
  documentName: string
  documentUrl: string
  tasks: OaDocumentTaskRecord[]
  unsupportedReason: string
}

export type OaBitableTable = { id: string; name: string; revision: number }
export type OaBitableView = { id: string; name: string; type: string }
export type OaBitableField = { id: string; name: string; type: number; uiType: string; isPrimary: boolean; property: Record<string, unknown> }
export type OaBitableRecord = { id: string; fields: Record<string, unknown>; createdAt: string; updatedAt: string }
export type OaBitableSnapshot = {
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

export type LarkBotTask = {
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

export type LarkBotNotification = {
  id: string
  category: string
  title: string
  body: string
  createdAt: string
}

export type LarkBotRuntimeSettings = {
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

export type LarkBotDashboard = {
  settings: LarkBotRuntimeSettings
  connection: {
    apiBaseUrl: string
    appId: string
    appToken: string
    tableId: string
    chatId: string
  }
  stats: {
    total: number
    completed: number
    inProgress: number
    overdue: number
    dueSoon: number
  }
  state: {
    lastSyncAt: string
    lastSyncResult: Record<string, unknown> | null
    lastEventAt: string
    lastError: string
  }
  tasks: LarkBotTask[]
}

export type MonthlyPerformancePreviewInput = {
  projectId: string
  month: string
  instruction: string
}

export type MonthlyPerformanceRow = {
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

export type MonthlyPerformancePreview = {
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

export type MonthlyPerformanceExportInput = {
  preview: MonthlyPerformancePreview
}

export type MonthlyPerformanceExportResult = {
  filePath: string | null
}

export type MonthlyPerformanceMessageRole = 'user' | 'assistant'

export type MonthlyPerformanceChatMessage = {
  id: string
  role: MonthlyPerformanceMessageRole
  content: string
  createdAt: string
}

export type MonthlyPerformanceSessionStatus = 'draft' | 'ready' | 'exported'

export type MonthlyPerformanceSession = {
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

export type MonthlyPerformanceSessionCreateInput = {
  projectId: string
  month: string
}

export type MonthlyPerformanceSessionMessageInput = {
  sessionId: string
  projectId: string
  month: string
  content: string
}

export type MonthlyPerformanceSessionExportInput = {
  sessionId: string
}

export type GithubTokenType = 'classic' | 'fine-grained-or-app' | 'unknown'

export type GithubTokenInput = {
  id?: string
  name: string
  token?: string
}

export type GithubTokenView = {
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

export type CodemagicTokenInput = {
  id?: string
  name: string
  token?: string
}

export type CodemagicTokenView = {
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

export type CodemagicTeam = {
  id: string
  name: string
}

export type CodemagicApp = {
  id: string
  name: string
  teamId: string
  repositoryUrl: string
  settingsSource: string
  projectType: string
  lastBuildId: string
  archived: boolean
}

export type CodemagicAppListInput = {
  tokenId: string
  teamId?: string
  name?: string
}

export type CodemagicRepositoryBindingInput = {
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

export type CodemagicRepositoryBinding = {
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

export type CodemagicArtifactPublicUrlInput = {
  tokenId: string
  secureFilename: string
  expiresAt?: number
}

export type MenuBarItemSection = 'visible' | 'hidden' | 'always-hidden'

export type MenuBarManagerSettings = {
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

export type MenuBarManagerItem = {
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

export type MenuBarManagerStatus = {
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

export const projects: Project[] = []
export const repositories: Repository[] = []
export const people: Person[] = []
export const environments: Environment[] = []
export const providers: Provider[] = []
