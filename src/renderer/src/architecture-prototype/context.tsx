import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { DemoData, DemoTask } from './data'
import type { PrototypeRoute } from './navigation'

export type CreateKind = 'project' | 'task' | 'goal' | 'milestone' | 'version'
export type PrototypeContextValue = {
  data: DemoData
  setData: Dispatch<SetStateAction<DemoData>>
  route: PrototypeRoute
  previousRoute?: PrototypeRoute
  navigate: (route: PrototypeRoute) => void
  openProject: (projectId: string) => void
  create: (kind: CreateKind) => void
  previewTask: (task: DemoTask) => void
  openTerminal: () => void
  notify: (message: string) => void
  back: () => void
}

export const PrototypeContext = createContext<PrototypeContextValue | null>(null)

export function usePrototype(): PrototypeContextValue {
  const context = useContext(PrototypeContext)
  if (!context) throw new Error('Prototype components require an isolated demo context')
  return context
}
