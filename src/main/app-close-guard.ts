export type CloseGuardAction = 'close-window' | 'quit-app'

export type CloseGuardActivityKind = 'quick-build' | 'release-publish' | 'terminal'

export type CloseGuardActivity = {
  id: string
  kind: CloseGuardActivityKind
  title: string
  detail: string
}

export type CloseGuardQuickBuildTask = {
  id: string
  command: string
  cwd: string
  phase?: string
  status: string
}

export type CloseGuardReleaseTask = {
  id: string
  repositoryName?: string
  tagName?: string
  version?: string
  phase?: string
  status: string
}

export type CloseGuardTerminalSession = {
  id: string
  cwd: string
  exited: boolean
  title: string
}

export type CloseGuardState = {
  quickBuildTask?: CloseGuardQuickBuildTask | null
  releasePublishTasks?: Iterable<CloseGuardReleaseTask>
  terminalSessions?: Iterable<CloseGuardTerminalSession>
}

export type CloseGuardPrompt = {
  buttons: string[]
  cancelId: number
  confirmButtonIndex: number
  defaultId: number
  detail: string
  message: string
  title: string
}

function joinDetail(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

export function collectCloseGuardActivities(state: CloseGuardState): CloseGuardActivity[] {
  const activities: CloseGuardActivity[] = []

  if (state.quickBuildTask?.status === 'running') {
    activities.push({
      id: state.quickBuildTask.id,
      kind: 'quick-build',
      title: '快速构建',
      detail: joinDetail([state.quickBuildTask.command, state.quickBuildTask.phase, state.quickBuildTask.cwd])
    })
  }

  for (const task of state.releasePublishTasks ?? []) {
    if (task.status !== 'running') {
      continue
    }

    const releaseLabel = task.tagName || task.version || task.repositoryName || task.id

    activities.push({
      id: task.id,
      kind: 'release-publish',
      title: `发布任务：${releaseLabel}`,
      detail: joinDetail([task.repositoryName, task.phase])
    })
  }

  for (const session of state.terminalSessions ?? []) {
    if (session.exited) {
      continue
    }

    activities.push({
      id: session.id,
      kind: 'terminal',
      title: `终端：${session.title || session.cwd}`,
      detail: session.cwd
    })
  }

  return activities
}

export function formatCloseGuardActivityList(activities: CloseGuardActivity[], maxItems = 6): string {
  const visibleActivities = activities.slice(0, maxItems)
  const lines = visibleActivities.map((activity) => {
    const detail = activity.detail ? `：${activity.detail}` : ''
    return `- ${activity.title}${detail}`
  })
  const hiddenCount = activities.length - visibleActivities.length

  if (hiddenCount > 0) {
    lines.push(`- 另外 ${hiddenCount} 项活动仍在运行`)
  }

  return lines.join('\n')
}

export function createCloseGuardPrompt(action: CloseGuardAction, activities: CloseGuardActivity[]): CloseGuardPrompt | null {
  if (activities.length === 0) {
    return null
  }

  const activityList = formatCloseGuardActivityList(activities)

  if (action === 'quit-app') {
    return {
      buttons: ['留在 ForgeDesk', '退出并终止'],
      cancelId: 0,
      confirmButtonIndex: 1,
      defaultId: 0,
      detail: `退出会终止 ForgeDesk 启动的构建、发布任务和终端会话。\n\n正在运行：\n${activityList}`,
      message: '仍有活动正在运行，确定要退出吗？',
      title: '确认退出 ForgeDesk'
    }
  }

  return {
    buttons: ['保持打开', '关闭窗口'],
    cancelId: 0,
    confirmButtonIndex: 1,
    defaultId: 0,
    detail: `关闭窗口不会终止这些活动，它们会继续在后台运行。可以从 Dock 或任务栏重新打开 ForgeDesk。\n\n正在运行：\n${activityList}`,
    message: '仍有活动正在运行，确定要关闭窗口吗？',
    title: '确认关闭窗口'
  }
}
