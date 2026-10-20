import { createContext, useContext } from 'react'

// Visibility controls read effects only. Execution controllers and terminals
// remain mounted and are deliberately not coupled to this context.
const WorkspaceVisibility = createContext(true)
export const WorkspaceVisibilityProvider = WorkspaceVisibility.Provider
export const useWorkspaceVisible = (): boolean => useContext(WorkspaceVisibility)
