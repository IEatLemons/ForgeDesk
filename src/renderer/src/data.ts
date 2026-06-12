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

export const projects: Project[] = []
export const repositories: Repository[] = []
export const people: Person[] = []
export const environments: Environment[] = []
export const providers: Provider[] = []
