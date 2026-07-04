export type ProjectStatus = 'ready' | 'needs-setup' | 'warning'

export type Project = {
  id: string
  name: string
  description: string
  status: ProjectStatus
  owner: string
  workspacePath: string
  createdAt: string
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

export type Repository = {
  id: string
  projectId: string
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
  startupCommand?: string
}

export type TerminalSession = {
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

export type ReleaseScriptName = 'publish:mac' | 'package:mac' | 'build' | ''
export type ReleasePublishActionKey = 'commit-workspace-changes' | 'replace-local-tag'

export type ReleasePublishAction = {
  key: ReleasePublishActionKey
  issue: string
  label: string
  description: string
}

export type RepositoryReleasePlan = {
  repositoryName: string
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
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
  githubTokenId?: string
  githubToken?: string
  releaseActions?: ReleasePublishActionKey[]
}

export type RepositoryReleasePublishResult = {
  ok: boolean
  repository: Repository
  plan: RepositoryReleasePlan
  stdout: string
  stderr: string
  exitCode: number | null
}

export type RepositoryReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type RepositoryReleasePublishTask = {
  id: string
  repositoryId: string
  repositoryName: string
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
  plan?: RepositoryReleasePlan
  repository?: Repository
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
}

export type VercelDeploymentSummary = ServiceDeploymentSummary

export type ServiceDeploymentListOptions = {
  target?: string
  limit?: number
}

export type VercelDeploymentListOptions = ServiceDeploymentListOptions

export type VercelDeploymentActionInput = {
  action: 'redeploy' | 'cancel' | 'promote' | 'rollback'
  deploymentId: string
  description?: string
}

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
  provider?: 'openai-compatible' | 'openrouter'
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

export type AiSettingsView = {
  enabled: boolean
  provider: 'openai-compatible' | 'openrouter'
  baseUrl: string
  apiKey: string
  apiKeyConfigured: boolean
  model: string
  temperature: number
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

export const projects: Project[] = []
export const repositories: Repository[] = []
export const people: Person[] = []
export const environments: Environment[] = []
export const providers: Provider[] = []
