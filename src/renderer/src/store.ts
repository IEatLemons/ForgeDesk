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
  loadingWorkspace: false,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  loadWorkspace: async () => {
    if (!window.forgeDesk) {
      return
    }

    set({ loadingWorkspace: true })

    try {
      const snapshot = await window.forgeDesk.listProjects()
      set((state) => ({
        projects: snapshot.projects,
        repositories: snapshot.repositories,
        selectedProjectId: state.selectedProjectId ?? snapshot.projects[0]?.id ?? null
      }))
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
  setProjectSummary: (summary) =>
    set((state) => ({
      summaries: {
        ...state.summaries,
        [summary.projectId]: summary
      }
    }))
}))
