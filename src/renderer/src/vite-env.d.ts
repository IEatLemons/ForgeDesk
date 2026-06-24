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

type TerminalCreateInput = {
  cwd?: string
  title?: string
  reuseKey?: string
  cols?: number
  rows?: number
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

type TerminalDataEvent = {
  sessionId: string
  data: string
}

type TerminalExitEvent = {
  sessionId: string
  exitCode: number
  signal?: number
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
  remote: string
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
  externalServiceId?: string
  defaultEnvironment?: string
  healthPath?: string
  enabled?: boolean
  environments?: Array<Partial<ProjectServiceEnvironmentRecord> & { name: string }>
  domains?: Array<Partial<ProjectServiceDomainRecord> & { domain: string }>
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

type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

type AppUpdateState = {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion?: string
  percent?: number
  error?: string
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
    listServiceConnections: () => Promise<ServiceConnectionRecord[]>
    saveServiceConnection: (input: ServiceConnectionInput) => Promise<ServiceConnectionRecord>
    deleteServiceConnection: (connectionId: string) => Promise<ServiceConnectionRecord[]>
    testServiceConnection: (connectionId: string) => Promise<{ ok: boolean; message: string; serviceCount: number }>
    listAllProjectServices: () => Promise<ProjectServiceRecord[]>
    listProjectServices: (projectId: string) => Promise<ProjectServiceRecord[]>
    saveProjectService: (input: ProjectServiceInput) => Promise<ProjectServiceRecord>
    bindProjectService: (input: { projectId: string; serviceId: string; repositoryId?: string }) => Promise<ProjectServiceRecord[]>
    syncProjectServices: (connectionId?: string) => Promise<ProjectServiceRecord[]>
    checkProjectServices: (projectId?: string) => Promise<ProjectServiceRecord[]>
    listLatestServiceMonitorChecks: (projectId: string) => Promise<ServiceMonitorCheckRecord[]>
    listServiceMonitorHistory: (projectId: string) => Promise<ServiceMonitorCheckRecord[]>
    listAllServiceMonitorHistory: () => Promise<ServiceMonitorCheckRecord[]>
    listServiceEnvironmentLogs: (serviceId: string, environmentName: string) => Promise<ServiceEnvironmentLogRecord[]>
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
    openTerminal: (input?: TerminalCreateInput) => Promise<TerminalSession>
    writeTerminal: (sessionId: string, data: string) => Promise<void>
    resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
    closeTerminal: (sessionId: string) => Promise<void>
    onTerminalData: (listener: (event: TerminalDataEvent) => void) => () => void
    onTerminalExit: (listener: (event: TerminalExitEvent) => void) => () => void
    getAppUpdateState: () => Promise<AppUpdateState>
    checkAppUpdate: () => Promise<AppUpdateState>
    installAppUpdate: () => Promise<AppUpdateState>
    onAppUpdateState: (listener: (state: AppUpdateState) => void) => () => void
    openAppReleases: () => Promise<void>
    openGitDownload: () => Promise<void>
  }
}
