export type RunningProjectGitTask = {
  id: string
  projectId: string
  action: 'fetch' | 'push' | 'merge'
}

export function updateRunningProjectGitTasks(
  current: RunningProjectGitTask[],
  task: RunningProjectGitTask,
  running: boolean
): RunningProjectGitTask[] {
  if (running) {
    return current.some((item) => item.id === task.id) ? current : [...current, task]
  }

  // Completion/cancellation belongs to one task, not every task of this action.
  return current.filter((item) => item.id !== task.id)
}

export function hasRunningProjectGitTask(
  tasks: RunningProjectGitTask[],
  projectId: string,
  action: RunningProjectGitTask['action']
): boolean {
  return tasks.some((task) => task.projectId === projectId && task.action === action)
}
