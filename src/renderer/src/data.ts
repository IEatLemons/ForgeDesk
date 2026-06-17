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

export type GitAddInput = {
  mode: 'all' | 'paths'
  paths: string[]
}

export type GitCommitInput = {
  message: string
}

export type GitPushInput = {
  remote: string
  branch: string
}

export type GitMergeInput = {
  source: string
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

export type AiConflictSuggestion = {
  filePath: string
  suggestedContent: string
}

export type RemoteAlignmentStatus = 'aligned' | 'diverged' | 'missing-remote' | 'missing-branch' | 'unknown'

export type RemoteAlignmentBranchStatus = 'aligned' | 'diverged' | 'missing-branch' | 'unknown'

export type RemoteAlignmentBranch = {
  branchName: string
  companyRef: string
  githubRef: string
  companyCommit: string
  githubCommit: string
  companyAhead: number
  githubAhead: number
  status: RemoteAlignmentBranchStatus
}

export type RemoteAlignmentSummary = {
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
  provider?: 'openai-compatible'
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

export type AiSettingsView = {
  enabled: boolean
  provider: 'openai-compatible'
  baseUrl: string
  apiKeyConfigured: boolean
  model: string
  temperature: number
}

export const projects: Project[] = []
export const repositories: Repository[] = []
export const people: Person[] = []
export const environments: Environment[] = []
export const providers: Provider[] = []
