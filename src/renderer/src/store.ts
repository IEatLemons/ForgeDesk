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
} from './data'
import { applyWorkspaceSnapshot } from './workspace-snapshot'

type ForgeDeskState = {
  projects: Project[]
  repositories: Repository[]
  people: Person[]
  environments: Environment[]
  providers: Provider[]
  selectedProjectId: string | null
  summaries: Record<string, ProjectGitSummary>
  loadingWorkspace: boolean
  setSelectedProjectId: (projectId: string) => void
  loadWorkspace: () => Promise<void>
  createProject: (projectName: string, workspacePath: string, scanned: ScannedRepository[]) => Promise<void>
  updateProject: (input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  updateRepository: (repository: ScannedRepository) => void
  setProjectSummary: (summary: ProjectGitSummary) => void
}

export const useForgeDeskStore = create<ForgeDeskState>((set) => ({
  projects,
  repositories,
  people,
  environments,
  providers,
  selectedProjectId: null,
  summaries: {},
  loadingWorkspace: true,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  loadWorkspace: async () => {
    if (!window.forgeDesk) {
      set({ loadingWorkspace: false })
      return
    }

    set({ loadingWorkspace: true })

    try {
      const snapshot = await window.forgeDesk.listProjects()
      set((state) => applyWorkspaceSnapshot(state, snapshot))
    } finally {
      set({ loadingWorkspace: false })
    }
  },
  updateRepository: (repository) =>
    set((state) => ({
      repositories: state.repositories.map((current) => (current.id === repository.id ? { ...current, ...repository } : current))
    })),
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
    set({
      projects: snapshot.projects,
      repositories: snapshot.repositories,
      selectedProjectId: newestProject?.id ?? null
    })
  },
  updateProject: async (input) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.updateProject(input)
    set((state) => applyWorkspaceSnapshot(state, snapshot))
  },
  deleteProject: async (projectId) => {
    if (!window.forgeDesk) {
      return
    }

    const snapshot = await window.forgeDesk.deleteProject(projectId)
    set((state) => applyWorkspaceSnapshot(state, snapshot, { dropProjectId: projectId }))
  },
  setProjectSummary: (summary) =>
    set((state) => ({
      summaries: {
        ...state.summaries,
        [summary.projectId]: summary
      }
    }))
}))
