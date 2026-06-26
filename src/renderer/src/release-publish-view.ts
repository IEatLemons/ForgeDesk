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
  documentationSources: string[]
}

export type ReleasePublishViewModel = {
  primaryLabel: string
  primaryDisabled: boolean
  issueCount: number
  warningCount: number
}

export function createReleasePublishViewModel(input: {
  plan: ReleasePublishPlanView | null
  githubToken: string
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

  if (!input.plan.canPublish || issueCount > 0) {
    return {
      primaryLabel: `先处理 ${issueCount || 1} 个问题`,
      primaryDisabled: true,
      issueCount,
      warningCount
    }
  }

  if (!tokenReady && input.plan.selectedScript === 'publish:mac') {
    return {
      primaryLabel: '填写 GitHub Token',
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
