type SidebarStorage = Pick<Storage, 'getItem' | 'setItem'>

export const workspaceSidebarStorageKey = 'forgedesk:workspace-sidebar-collapsed:v1'

function browserStorage(): SidebarStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readWorkspaceSidebarCollapsed(storage: SidebarStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(workspaceSidebarStorageKey) === 'true'
  } catch {
    return false
  }
}

export function saveWorkspaceSidebarCollapsed(collapsed: boolean, storage: SidebarStorage | null = browserStorage()): void {
  try {
    storage?.setItem(workspaceSidebarStorageKey, String(collapsed))
  } catch {
    // A blocked or full storage must not prevent toggling the current window.
  }
}
