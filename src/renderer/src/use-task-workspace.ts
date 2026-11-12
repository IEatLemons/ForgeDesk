import { useEffect, useSyncExternalStore } from 'react'
import { message } from 'antd'
import type { TaskCommand, TaskView, TaskWorkspaceSnapshot } from '../../shared/task-workspace'

type State = { snapshot: TaskWorkspaceSnapshot | null; error: string; loading: boolean }
let state: State = { snapshot: null, error: '', loading: true }
let initialization: Promise<void> | null = null
let request = 0
let unsubscribe: (() => void) | undefined
let clock: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
export async function refreshTaskWorkspace(): Promise<void> {
  const current = ++request
  try {
    if (!window.forgeDesk?.initializeTaskWorkspace) throw new Error('请在 ForgeDesk 桌面应用中使用本地任务')
    if (!initialization) initialization = (async () => {
      const legacy: Record<string, string> = {}
      for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index)!; if (key.startsWith('forgedesk.taskList.items.v1')) legacy[key] = localStorage.getItem(key)! }
      await window.forgeDesk.initializeTaskWorkspace(legacy)
      for (const key of Object.keys(legacy)) localStorage.removeItem(key)
    })().catch(error => { initialization = null; throw error })
    await initialization
    const snapshot = await window.forgeDesk.getTaskWorkspace()
    if (current === request) state = { snapshot, error: '', loading: false }
  } catch (error) { if (current === request) state = { ...state, error: error instanceof Error ? error.message : String(error), loading: false } }
  emit()
}
type CommandInput = TaskCommand extends infer T ? T extends TaskCommand ? Omit<T, 'commandId'> : never : never
export async function sendTaskCommand(command: CommandInput): Promise<string | null> {
  try {
    const result = await window.forgeDesk.runTaskCommand({ ...command, commandId: crypto.randomUUID() } as TaskCommand)
    await refreshTaskWorkspace()
    return result.entityId
  } catch (error) { message.error(error instanceof Error ? error.message : String(error)); await refreshTaskWorkspace(); return null }
}
const preferences = new Map<string, { patch: Partial<TaskView>; timer?: ReturnType<typeof setTimeout>; resolve: (() => void)[] }>()
let preferenceWrite = Promise.resolve()
export function saveTaskViewPreferences(scope: string, patch: Partial<TaskView>): Promise<void> {
  const pending = preferences.get(scope) ?? { patch: {}, resolve: [] }
  pending.patch = { ...pending.patch, ...patch }
  clearTimeout(pending.timer)
  const result = new Promise<void>(resolve => pending.resolve.push(resolve))
  pending.timer = setTimeout(() => {
    preferences.delete(scope)
    preferenceWrite = preferenceWrite.then(async () => {
      const current = state.snapshot?.views.find(view => view.scope === scope)
      await sendTaskCommand({ type: 'save-view', input: { id: current?.id, scope, ...pending.patch }, expectedVersion: current?.rowVersion })
      pending.resolve.forEach(resolve => resolve())
    })
  }, 0)
  preferences.set(scope, pending)
  return result
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    unsubscribe = window.forgeDesk?.onTaskWorkspaceUpdated?.(() => void refreshTaskWorkspace())
    window.addEventListener('focus', refreshTaskWorkspace)
    clock = setInterval(() => void refreshTaskWorkspace(), 60_000)
  }
  return () => { listeners.delete(listener); if (!listeners.size) { unsubscribe?.(); window.removeEventListener('focus', refreshTaskWorkspace); clearInterval(clock) } }
}
export function useTaskWorkspace() {
  const value = useSyncExternalStore(subscribe, () => state)
  useEffect(() => { void refreshTaskWorkspace() }, [])
  return { ...value, refresh: refreshTaskWorkspace, send: sendTaskCommand }
}
