export type ReleasePublishPlanView = {
  repositoryName: string
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  selectedScript: 'publish:mac' | 'package:mac' | 'build' | ''
  needsVersionBump: boolean
  canPublish: boolean
  issues: string[]
  warnings: string[]
  availableActions: ReleasePublishAction[]
  documentationSources: string[]
}

export type ReleasePublishActionKey = 'commit-workspace-changes' | 'replace-local-tag'

export type ReleasePublishAction = {
  key: ReleasePublishActionKey
  issue: string
  label: string
  description: string
}

export type ReleasePublishViewModel = {
  primaryLabel: string
  primaryDisabled: boolean
  issueCount: number
  warningCount: number
}

export type ReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed'

export type ReleasePublishTaskViewInput = {
  repositoryName: string
  tagName: string
  status: ReleasePublishTaskStatus
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  phase?: string
  phaseIndex?: number
  phaseTotal?: number
  error?: string
}

export type ReleasePublishTaskViewModel = {
  title: string
  statusLabel: string
  statusColor: string
  active: boolean
  phase: string
  progressPercent: number
  log: string
}

export type ReleasePlatformOption = {
  key: 'github'
  name: string
  description: string
  detail: string
  statusLabel: string
  statusColor: string
  disabled: boolean
}

export function createReleasePlatformOptions(input: { plan: ReleasePublishPlanView | null }): ReleasePlatformOption[] {
  const scriptLabel = input.plan?.selectedScript || '发布脚本'

  return [
    {
      key: 'github',
      name: 'GitHub Releases',
      description: '发布版本 Tag、安装包和发布说明。',
      detail: input.plan ? `当前仓库将使用 ${scriptLabel} 流程。` : '读取仓库后确认发布流程。',
      statusLabel: '已对接',
      statusColor: 'green',
      disabled: false
    }
  ]
}

export function getUnresolvedReleaseIssues(plan: ReleasePublishPlanView, selectedActions: ReleasePublishActionKey[] = []): string[] {
  const selectedActionSet = new Set(selectedActions)
  const selectedIssueSet = new Set(plan.availableActions.filter((action) => selectedActionSet.has(action.key)).map((action) => action.issue))
  return plan.issues.filter((issue) => !selectedIssueSet.has(issue))
}

export function createReleasePublishViewModel(input: {
  plan: ReleasePublishPlanView | null
  githubToken: string
  selectedActions?: ReleasePublishActionKey[]
}): ReleasePublishViewModel {
  const issueCount = input.plan?.issues.length ?? 0
  const warningCount = input.plan?.warnings.length ?? 0
  const tokenReady = input.githubToken.trim().length > 0

  if (!input.plan) {
    return {
      primaryLabel: '读取发布信息',
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  const unresolvedIssueCount = getUnresolvedReleaseIssues(input.plan, input.selectedActions).length

  if (!input.plan.canPublish && unresolvedIssueCount > 0) {
    return {
      primaryLabel: `先处理 ${unresolvedIssueCount || 1} 个问题`,
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  if (!tokenReady && input.plan.selectedScript === 'publish:mac') {
    return {
      primaryLabel: '选择 GitHub Token',
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  return {
    primaryLabel: `发布 ${input.plan.suggestedTagName || input.plan.suggestedVersion}`,
    primaryDisabled: false,
    issueCount,
    warningCount
  }
}

export function createReleasePublishTaskView(input: { task: ReleasePublishTaskViewInput | null }): ReleasePublishTaskViewModel {
  if (!input.task) {
    return {
      title: '发布任务',
      statusLabel: '无任务',
      statusColor: 'default',
      active: false,
      phase: '暂无任务',
      progressPercent: 0,
      log: '暂无发布日志'
    }
  }

  const phaseTotal = Math.max(input.task.phaseTotal ?? 0, 1)
  const phaseIndex = Math.min(Math.max(input.task.phaseIndex ?? 0, 0), phaseTotal)
  const progressPercent = input.task.status === 'succeeded'
    ? 100
    : input.task.status === 'failed'
      ? Math.max(Math.round((phaseIndex / phaseTotal) * 100), 1)
      : Math.round((phaseIndex / phaseTotal) * 100)
  const statusView = input.task.status === 'running'
    ? { label: '发布中', color: 'processing', active: true }
    : input.task.status === 'succeeded'
      ? { label: '已完成', color: 'green', active: false }
      : { label: '失败', color: 'red', active: false }
  const fallbackLog = [
    input.task.log,
    input.task.stdout,
    input.task.stderr,
    input.task.error,
    input.task.exitCode === null ? '' : `退出码：${input.task.exitCode}`
  ].filter(Boolean).join('\n')

  return {
    title: `${input.task.repositoryName} ${input.task.tagName}`.trim(),
    statusLabel: statusView.label,
    statusColor: statusView.color,
    active: statusView.active,
    phase: input.task.phase || statusView.label,
    progressPercent,
    log: fallbackLog || '暂无发布日志'
  }
}
