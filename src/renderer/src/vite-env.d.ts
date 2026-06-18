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

type GitAddInput = {
  mode: 'all' | 'paths'
  paths: string[]
}

type GitCommitInput = {
  message: string
  paths?: string[]
}

type GitPushInput = {
  remote: string
  branch: string
}

type GitMergeInput = {
  source: string
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

interface Window {
  forgeDesk: {
    listProjects: () => Promise<WorkspaceSnapshot>
    createProject: (input: { name: string; workspacePath: string; repositories: ScannedRepository[] }) => Promise<WorkspaceSnapshot>
    updateProject: (input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }) => Promise<WorkspaceSnapshot>
    listRepositories: (projectId?: string) => Promise<RepositoryRecord[]>
    getRepositoryDetail: (repositoryId: string) => Promise<RepositoryRecord>
    listRepositoryCommits: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) => Promise<GitCommitRecord[]>
    getRepositoryCommitGraph: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) => Promise<GitCommitRecord[]>
    syncRepositoryRemote: (repositoryId: string) => Promise<RepositoryRecord>
    saveRepositoryRemote: (input: RepositoryRemoteInput) => Promise<RepositoryRecord>
    deleteRepositoryRemote: (repositoryId: string, remoteName: string) => Promise<RepositoryRecord>
    fetchRepositoryRemote: (repositoryId: string, remoteName?: string) => Promise<RepositoryRecord>
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
    fixSshPrivateKeyPermissions: (path: string) => Promise<GitSetupStatus>
    deriveSshPublicKey: (privateKeyPath: string) => Promise<GitSetupStatus>
    readSshConfig: () => Promise<SshConfigFile>
    writeSshConfig: (content: string) => Promise<SshConfigFile>
    openSshDirectory: () => Promise<void>
    openGitDownload: () => Promise<void>
  }
}
