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

export type TerminalDataEvent = {
  sessionId: string
  data: string
}

export type TerminalExitEvent = {
  sessionId: string
  exitCode: number
  signal?: number
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
  remote: string
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
  externalServiceId?: string
  defaultEnvironment?: string
  healthPath?: string
  enabled?: boolean
  environments?: Array<Partial<ProjectServiceEnvironment> & { name: string }>
  domains?: Array<Partial<ProjectServiceDomain> & { domain: string }>
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

export const projects: Project[] = []
export const repositories: Repository[] = []
export const people: Person[] = []
export const environments: Environment[] = []
export const providers: Provider[] = []
