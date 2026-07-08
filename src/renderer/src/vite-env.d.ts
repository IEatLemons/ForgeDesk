/// <reference types="vite/client" />

type ScannedRepository = {
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

type GitRemote = {
  name: string
  fetchUrl: string
  pushUrl: string
}

type GitPushTarget = {
  remote: string
  branch: string
  ahead: number
  hasRemoteBranch: boolean
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
  isPackaged: boolean
  isDevelopmentBuild: boolean
  isDevServer: boolean
  appPath: string
  projectRoot: string
}

type QuickBuildTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

type QuickBuildStartInput = {
  cwd?: string
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

type ReleaseScriptName = 'publish:mac' | 'package:mac' | 'build' | ''
type ReleasePublishProvider = 'github' | 'codemagic'
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
  createdAt: string
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

type GitSetupStatus = {
  gitAvailable: boolean
  gitVersion: string
  userName: string
  userEmail: string
  sshPublicKeys: SshPublicKeyRecord[]
  sshPrivateKeys: SshPrivateKeyRecord[]
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
  provider?: 'openai-compatible' | 'openrouter'
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

type AiSettingsView = {
  enabled: boolean
  provider: 'openai-compatible' | 'openrouter'
  baseUrl: string
  apiKey: string
  apiKeyConfigured: boolean
  model: string
  temperature: number
}

type OaSettingsInput = {
  enabled: boolean
  provider?: 'lark'
  larkAppId: string
  larkAppSecret?: string
  docsHomeUrl: string
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
  enableDocumentBrowsing: boolean
  enableDocumentEditing: boolean
  enableAiDocumentDrafting: boolean
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

interface Window {
  forgeDesk: {
    listProjects: () => Promise<WorkspaceSnapshot>
    createProject: (input: { name: string; workspacePath: string; repositories: ScannedRepository[] }) => Promise<WorkspaceSnapshot>
    updateProject: (input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }) => Promise<WorkspaceSnapshot>
    deleteProject: (projectId: string) => Promise<WorkspaceSnapshot>
    listRepositories: (projectId?: string) => Promise<RepositoryRecord[]>
    getRepositoryDetail: (repositoryId: string) => Promise<RepositoryRecord>
    listRepositoryCommits: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) => Promise<GitCommitRecord[]>
    getRepositoryCommitGraph: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) => Promise<GitCommitRecord[]>
    syncRepositoryRemote: (repositoryId: string) => Promise<RepositoryRecord>
    saveRepositoryRemote: (input: RepositoryRemoteInput) => Promise<RepositoryRecord>
    deleteRepositoryRemote: (repositoryId: string, remoteName: string) => Promise<RepositoryRecord>
    fetchRepositoryRemote: (repositoryId: string, remoteName?: string) => Promise<RepositoryRecord>
    switchRepositoryBranch: (repositoryId: string, input: GitBranchSwitchInput) => Promise<RepositoryRecord>
    runRepositoryGitCommand: (input: GitCommandRequest) => Promise<GitCommandResult>
    getRepositoryWorkspaceStatus: (repositoryId: string) => Promise<GitWorkspaceStatus>
    gitAdd: (repositoryId: string, input: GitAddInput) => Promise<GitOperationResult>
    gitCommit: (repositoryId: string, input: GitCommitInput) => Promise<GitOperationResult>
    gitPush: (repositoryId: string, input: GitPushInput) => Promise<GitOperationResult>
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
    getGitSetupStatus: () => Promise<GitSetupStatus>
    configureGitIdentity: (identity: { userName: string; userEmail: string }) => Promise<GitSetupStatus>
    getAiSettings: () => Promise<AiSettingsView>
    saveAiSettings: (input: AiSettingsInput) => Promise<AiSettingsView>
    getOaSettings: () => Promise<OaSettingsView>
    saveOaSettings: (input: OaSettingsInput) => Promise<OaSettingsView>
    openOaDocs: () => Promise<void>
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
    onQuickBuildTaskUpdated: (listener: (task: QuickBuildTask | null) => void) => () => void
    onAppUpdateState: (listener: (state: AppUpdateState) => void) => () => void
    openAppReleases: () => Promise<void>
    openGitDownload: () => Promise<void>
  }
}
