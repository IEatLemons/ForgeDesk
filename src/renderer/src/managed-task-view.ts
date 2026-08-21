import type { ManagedTask } from './data'

type CodexThreadCandidate = {
  id: string
  updatedAt: string
}

function newestThreadId(candidates: CodexThreadCandidate[]): string {
  return candidates
    .filter((candidate) => candidate.id.trim())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    ?.id.trim() || ''
}

/**
 * A managed task starts with a parent thread for planning, but execution can
 * create one native Codex thread per subtask. Prefer the active execution
 * thread, then the most recently updated subtask thread, before falling back
 * to the parent planning conversation.
 */
export function resolveManagedTaskCodexThreadId(task: ManagedTask): string {
  const runningSubtaskThread = newestThreadId(task.subtasks
    .filter((subtask) => subtask.runStatus === 'running')
    .map((subtask) => ({ id: subtask.codexThreadId, updatedAt: subtask.updatedAt })))

  if (runningSubtaskThread) return runningSubtaskThread

  const latestSubtaskThread = newestThreadId([
    ...task.subtasks.map((subtask) => ({ id: subtask.codexThreadId, updatedAt: subtask.updatedAt })),
    ...task.bindings
      .filter((binding) => binding.role === 'subtask')
      .map((binding) => ({ id: binding.codexThreadId, updatedAt: binding.updatedAt }))
  ])

  if (latestSubtaskThread) return latestSubtaskThread

  return task.codexThreadId.trim()
    || task.bindings.find((binding) => binding.role === 'parent')?.codexThreadId.trim()
    || task.bindings.find((binding) => binding.role === 'imported')?.codexThreadId.trim()
    || ''
}
