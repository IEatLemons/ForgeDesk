export type ReleasePublishPlanView = {
  repositoryName: string
  provider?: ReleasePublishProvider
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
export type ReleasePublishProvider = 'github' | 'codemagic' | 'nextjs-pm2'

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

export type ReleasePublishTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type ReleasePublishTaskViewInput = {
  repositoryName: string
  provider?: ReleasePublishProvider
  tagName: string
  status: ReleasePublishTaskStatus
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  phase?: string
  phaseIndex?: number
  phaseTotal?: number
  hint?: string
  lastOutputAt?: string
  error?: string
  externalBuildId?: string
  externalBuildUrl?: string
  externalStatus?: string
  externalWorkflow?: string
  artifacts?: Array<{
    name: string
    type: string
    sizeInBytes: number
    downloadUrl: string
    versionName?: string
    versionCode?: string
  }>
}

export type ReleasePublishTaskViewModel = {
  title: string
  statusLabel: string
  statusColor: string
  active: boolean
  canCancel: boolean
  phase: string
  hint: string
  progressPercent: number
  log: string
}

export type ReleaseMetadataDefaults = {
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
}

export type ReleaseMetadataVersionChangeInput = {
  repositoryName: string
  previousVersion: string
  previousTagName: string
  nextVersion: string
  nextTagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
}

export type ReleasePlatformOption = {
  key: ReleasePublishProvider
  name: string
  description: string
  detail: string
  statusLabel: string
  statusColor: string
  disabled: boolean
}

export function createDefaultReleaseMetadata(input: { repositoryName: string; version: string; tagName: string }): ReleaseMetadataDefaults {
  const versionLabel = input.tagName.trim() || input.version.trim()

  return {
    releaseTitle: `${input.repositoryName} ${versionLabel}`.trim(),
    releaseNotes: `发布 ${versionLabel}`.trim(),
    commitMessage: `chore: release ${versionLabel}`.trim()
  }
}

function updateDefaultField(currentValue: string, previousDefault: string, nextDefault: string): string {
  const trimmedCurrentValue = currentValue.trim()
  return !trimmedCurrentValue || trimmedCurrentValue === previousDefault ? nextDefault : currentValue
}

export function updateDefaultReleaseMetadataForVersionChange(input: ReleaseMetadataVersionChangeInput): ReleaseMetadataDefaults {
  const previousDefaults = createDefaultReleaseMetadata({
    repositoryName: input.repositoryName,
    version: input.previousVersion,
    tagName: input.previousTagName
  })
  const nextDefaults = createDefaultReleaseMetadata({
    repositoryName: input.repositoryName,
    version: input.nextVersion,
    tagName: input.nextTagName
  })

  return {
    releaseTitle: updateDefaultField(input.releaseTitle, previousDefaults.releaseTitle, nextDefaults.releaseTitle),
    releaseNotes: updateDefaultField(input.releaseNotes, previousDefaults.releaseNotes, nextDefaults.releaseNotes),
    commitMessage: updateDefaultField(input.commitMessage, previousDefaults.commitMessage, nextDefaults.commitMessage)
  }
}

export function createReleasePlatformOptions(input: { plan: ReleasePublishPlanView | null; codemagicBound?: boolean }): ReleasePlatformOption[] {
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
    },
    {
      key: 'codemagic',
      name: 'Codemagic',
      description: '触发远程 workflow，并同步 IPA/APK/AAB 构建包。',
      detail: input.codemagicBound ? '当前仓库已绑定 Codemagic App 和 Workflow。' : '需要先保存当前仓库的 Codemagic 绑定。',
      statusLabel: input.codemagicBound ? '已绑定' : '待配置',
      statusColor: input.codemagicBound ? 'green' : 'orange',
      disabled: false
    },
    {
      key: 'nextjs-pm2',
      name: 'Next.js PM2',
      description: '本地构建并打包，上传服务器后用 PM2 管理进程。',
      detail: input.plan ? `当前仓库将使用 ${input.plan.selectedScript || 'build'} 构建产物。` : '读取仓库后确认 Next.js 构建流程。',
      statusLabel: 'SSH',
      statusColor: 'blue',
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
  provider?: ReleasePublishProvider
  codemagicReady?: boolean
  nextjsPm2Ready?: boolean
  selectedActions?: ReleasePublishActionKey[]
}): ReleasePublishViewModel {
  const issueCount = input.plan?.issues.length ?? 0
  const warningCount = input.plan?.warnings.length ?? 0
  const tokenReady = input.githubToken.trim().length > 0
  const provider = input.provider ?? input.plan?.provider ?? 'github'

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

  if (provider === 'github' && !tokenReady && input.plan.selectedScript === 'publish:mac') {
    return {
      primaryLabel: '选择 GitHub Token',
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  if (provider === 'codemagic' && !input.codemagicReady) {
    return {
      primaryLabel: '配置 Codemagic',
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  if (provider === 'nextjs-pm2' && !input.nextjsPm2Ready) {
    return {
      primaryLabel: '填写远端部署信息',
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  return {
    primaryLabel: `${provider === 'codemagic' ? '构建' : provider === 'nextjs-pm2' ? '部署' : '发布'} ${input.plan.suggestedTagName || input.plan.suggestedVersion}`,
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
      canCancel: false,
      phase: '暂无任务',
      hint: '还没有发布任务。',
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
      : input.task.status === 'cancelled'
        ? { label: '已终止', color: 'orange', active: false }
        : { label: '失败', color: 'red', active: false }
  const externalStatusLabel = input.task.provider === 'nextjs-pm2' ? '远端状态' : 'Codemagic 状态'
  const externalWorkflowLabel = input.task.provider === 'nextjs-pm2' ? 'PM2 应用' : 'Workflow'
  const fallbackLog = [
    input.task.hint ? `中文提示：${input.task.hint}` : '',
    input.task.externalBuildId ? `Codemagic Build：${input.task.externalBuildId}` : '',
    input.task.externalStatus ? `${externalStatusLabel}：${input.task.externalStatus}` : '',
    input.task.externalWorkflow ? `${externalWorkflowLabel}：${input.task.externalWorkflow}` : '',
    ...(input.task.artifacts ?? []).map((artifact) =>
      `Artifact：${artifact.name}${artifact.versionName ? ` · ${artifact.versionName}` : ''}${artifact.type ? ` · ${artifact.type}` : ''}`
    ),
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
    canCancel: input.task.status === 'running',
    phase: input.task.phase || statusView.label,
    hint: input.task.hint || '正在等待发布任务输出。',
    progressPercent,
    log: fallbackLog || '暂无发布日志'
  }
}
