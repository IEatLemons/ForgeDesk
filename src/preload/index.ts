import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('forgeDesk', {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (input: { name: string; workspacePath: string; repositories: ScannedRepository[] }) => ipcRenderer.invoke('projects:create', input),
  updateProject: (input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }) => ipcRenderer.invoke('projects:update', input),
  listRepositories: (projectId?: string) => ipcRenderer.invoke('repositories:list', projectId),
  getRepositoryDetail: (repositoryId: string) => ipcRenderer.invoke('repository:detail', repositoryId),
  listRepositoryCommits: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) =>
    ipcRenderer.invoke('repository:commits', repositoryId, options),
  getRepositoryCommitGraph: (repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }) =>
    ipcRenderer.invoke('repository:commit-graph', repositoryId, options),
  syncRepositoryRemote: (repositoryId: string) => ipcRenderer.invoke('repository:sync-remote', repositoryId),
  listRepositoryCommitFiles: (repositoryId: string, commitHash: string) => ipcRenderer.invoke('repository:commit-files', repositoryId, commitHash),
  getRepositoryCommitDiff: (repositoryId: string, commitHash: string, filePath: string, oldPath?: string, status?: string) =>
    ipcRenderer.invoke('repository:commit-diff', repositoryId, commitHash, filePath, oldPath, status),
  getProjectSummary: (projectId: string, range?: { startDate?: string; endDate?: string }) => ipcRenderer.invoke('project:summary', projectId, range),
  analyzeProjectGit: (projectId: string) => ipcRenderer.invoke('project:analyze-git', projectId),
  listProjectPeople: (projectId: string) => ipcRenderer.invoke('project:people', projectId),
  listProjectContributorIdentities: (projectId: string) => ipcRenderer.invoke('project:contributor-identities', projectId),
  saveProjectPerson: (input: { id?: string; projectId: string; displayName: string; role?: string; identities: Array<{ name: string; email: string }> }) =>
    ipcRenderer.invoke('project:person:save', input),
  deleteProjectPerson: (projectId: string, personId: string) => ipcRenderer.invoke('project:person:delete', projectId, personId),
  scanRepositories: (paths: string[]) => ipcRenderer.invoke('repositories:scan', paths),
  scanWorkspace: (rootPath: string) => ipcRenderer.invoke('repositories:scan-workspace', rootPath),
  configureRepositoryIdentity: (localPath: string, identity: { userName: string; userEmail: string }) =>
    ipcRenderer.invoke('repository:configure-identity', localPath, identity),
  clearRepositoryIdentity: (localPath: string) => ipcRenderer.invoke('repository:clear-identity', localPath),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  getGitSetupStatus: () => ipcRenderer.invoke('git:setup-status'),
  configureGitIdentity: (identity: { userName: string; userEmail: string }) => ipcRenderer.invoke('git:configure-identity', identity),
  generateSshKey: (email: string) => ipcRenderer.invoke('ssh:generate-key', email),
  copySshPublicKey: (publicKeyPath: string) => ipcRenderer.invoke('ssh:copy-public-key', publicKeyPath),
  openSshDirectory: () => ipcRenderer.invoke('ssh:open-directory'),
  openGitDownload: () => ipcRenderer.invoke('external:open-git-download')
})
