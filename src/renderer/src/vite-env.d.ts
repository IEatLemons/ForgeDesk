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
  sshPublicKeys: Array<{
    fileName: string
    path: string
    fingerprint: string
  }>
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
    getGitSetupStatus: () => Promise<GitSetupStatus>
    configureGitIdentity: (identity: { userName: string; userEmail: string }) => Promise<GitSetupStatus>
    generateSshKey: (email: string) => Promise<GitSetupStatus['sshPublicKeys'][number]>
    copySshPublicKey: (publicKeyPath: string) => Promise<void>
    openSshDirectory: () => Promise<void>
    openGitDownload: () => Promise<void>
  }
}
