import { create } from 'zustand'
import {
  environments,
  people,
  projects,
  providers,
  repositories,
  type Environment,
  type Person,
  type Project,
  type ProjectGitSummary,
  type Provider,
  type Repository
} from './data.js'
import { applyWorkspaceSnapshot, overlayRepositoryRead, shareWorkspaceRecords, type RepositoryReadOverlay } from './workspace-snapshot.js'

type ForgeDeskState = {
  projects: Project[]
  repositories: Repository[]
  people: Person[]
  environments: Environment[]
  providers: Provider[]
  selectedProjectId: string | null
  summaries: Record<string, ProjectGitSummary>
  loadingWorkspace: boolean
  workspaceLoaded: boolean
  setSelectedProjectId: (projectId: string) => void
  loadWorkspace: () => Promise<void>
  rescanProjectRepositories: (projectId: string) => Promise<void>
  initializeProjectRepository: (projectId: string) => Promise<void>
  createProject: (projectName: string, workspacePath: string, scanned: ScannedRepository[]) => Promise<void>
  createEmptyProject: (projectName: string, parentPath: string) => Promise<void>
  createProjectFromRemote: (projectName: string, remoteUrl: string, parentPath: string) => Promise<void>
  updateProject: (input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }) => Promise<void>
  setProjectFavorite: (input: { id: string; isFavorite: boolean }) => Promise<void>
  setProjectArchived: (input: { id: string; archived: boolean }) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  updateRepository: (repository: ScannedRepository) => void
  updateRepositories: (repositories: ScannedRepository[]) => void
  applyRepositoryChecks: (patches: { started: Repository; next: Repository }[]) => void
  applyWorkspace: (snapshot: WorkspaceSnapshot) => void
  setProjectSummary: (summary: ProjectGitSummary) => void
}

let workspaceRead: Promise<void> | undefined
let workspaceRevision = 0
const repositoryBases = new Map<string, Repository>()
const repositoryReads = new Map<string, RepositoryReadOverlay>()
export const useForgeDeskStore = create<ForgeDeskState>((set, get) => ({
  projects,
  repositories,
  people,
  environments,
  providers,
  selectedProjectId: null,
  summaries: {},
  loadingWorkspace: true,
  workspaceLoaded: false,
  applyWorkspace: snapshot => {
    workspaceRevision++
    const repositories = snapshot.repositories.map(incoming => {
      const overlaid = overlayRepositoryRead(incoming, repositoryReads.get(incoming.id))
      if (overlaid === incoming) repositoryReads.delete(incoming.id)
      repositoryBases.set(incoming.id, incoming)
      return overlaid
    })
    const ids = new Set(repositories.map(repository => repository.id))
    for (const id of repositoryBases.keys()) if (!ids.has(id)) { repositoryBases.delete(id); repositoryReads.delete(id) }
    set(state => {
      const next = applyWorkspaceSnapshot(state, { ...snapshot, repositories })
      return next.projects === state.projects && next.repositories === state.repositories && next.summaries === state.summaries && next.selectedProjectId === state.selectedProjectId ? state : next
    })
  },
  setSelectedProjectId: selectedProjectId => set(state => state.selectedProjectId === selectedProjectId ? state : { selectedProjectId }),
  loadWorkspace: () => {
    if (workspaceRead) return workspaceRead
    if (!window.forgeDesk) {
      set({ loadingWorkspace: false, workspaceLoaded: true })
      return Promise.resolve()
    }
    if (!get().workspaceLoaded) set({ loadingWorkspace: true })
    const revision = workspaceRevision
    workspaceRead = Promise.resolve().then(() => window.forgeDesk.listProjects()).then(snapshot => {
      if (revision === workspaceRevision) get().applyWorkspace(snapshot)
    }).finally(() => {
      if (get().loadingWorkspace || !get().workspaceLoaded) set({ loadingWorkspace: false, workspaceLoaded: true })
      workspaceRead = undefined
    })
    return workspaceRead
  },
  rescanProjectRepositories: async (projectId) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.rescanProjectRepositories(projectId)
    get().applyWorkspace(snapshot)
  },
  initializeProjectRepository: async (projectId) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.initializeProjectRepository(projectId)
    get().applyWorkspace(snapshot)
  },
  updateRepository: repository => get().updateRepositories([repository]),
  updateRepositories: updates => {
    workspaceRevision++
    for (const repository of updates) repositoryReads.delete(repository.id)
    const byId = new Map(updates.map(repository => [repository.id, repository]))
    set(state => {
      const repositories = shareWorkspaceRecords(state.repositories, state.repositories.map(current => byId.has(current.id) ? { ...current, ...byId.get(current.id) } : current))
      return repositories === state.repositories ? state : { repositories }
    })
  },
  applyRepositoryChecks: patches => {
    const byId = new Map(get().repositories.map(repository => [repository.id, repository]))
    const accepted = patches.filter(patch => byId.get(patch.started.id) === patch.started)
    if (!accepted.length) return
    workspaceRevision++
    const updates = new Map(accepted.map(patch => {
      repositoryReads.set(patch.started.id, { base: repositoryBases.get(patch.started.id) ?? patch.started, next: patch.next })
      return [patch.next.id, patch.next]
    }))
    set(state => {
      const repositories = shareWorkspaceRecords(state.repositories, state.repositories.map(repository => updates.get(repository.id) ?? repository))
      return repositories === state.repositories ? state : { repositories }
    })
  },
  createProject: async (projectName, workspacePath, scanned) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.createProject({
      name: projectName,
      workspacePath,
      repositories: scanned
    })
    const newestProject = snapshot.projects[0]
    get().applyWorkspace(snapshot)
    set({ selectedProjectId: newestProject?.id ?? null })
  },
  createEmptyProject: async (projectName, parentPath) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.createEmptyProject({
      name: projectName,
      parentPath
    })
    const newestProject = snapshot.projects[0]
    get().applyWorkspace(snapshot)
    set({ selectedProjectId: newestProject?.id ?? null })
  },
  createProjectFromRemote: async (projectName, remoteUrl, parentPath) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.createProjectFromRemote({
      name: projectName,
      remoteUrl,
      parentPath
    })
    const newestProject = snapshot.projects[0]
    get().applyWorkspace(snapshot)
    set({ selectedProjectId: newestProject?.id ?? null })
  },
  updateProject: async (input) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.updateProject(input)
    get().applyWorkspace(snapshot)
  },
  setProjectFavorite: async (input) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.setProjectFavorite(input)
    get().applyWorkspace(snapshot)
  },
  setProjectArchived: async (input) => {
    if (!window.forgeDesk) throw new Error('请在 ForgeDesk 桌面应用中管理项目')
    const snapshot = await window.forgeDesk.setProjectArchived(input)
    get().applyWorkspace(snapshot)
  },
  deleteProject: async (projectId) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.deleteProject(projectId)
    get().applyWorkspace(snapshot)
  },
  setProjectSummary: (summary) =>
    set((state) => ({
      summaries: {
        ...state.summaries,
        [summary.projectId]: summary
      }
    }))
}))
