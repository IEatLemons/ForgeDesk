export type ReleaseVersionBump = 'patch' | 'minor' | 'major'
export type ReleaseScriptName = 'publish:mac' | 'package:mac' | 'build' | ''
export type ReleasePublishActionKey = 'commit-workspace-changes' | 'replace-local-tag'

export type PackageScripts = Record<string, string>

export type ReleasePublishAction = {
  key: ReleasePublishActionKey
  issue: string
  label: string
  description: string
}

export type ReleaseTagHistoryEntry = {
  tagName: string
  version: string
}

export type ReleaseVersionRecommendationInput = {
  currentVersion: string
  tagNames: string[]
  historyLimit?: number
}

export type ReleaseVersionRecommendation = {
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  historicalTags: ReleaseTagHistoryEntry[]
}

export type ReleasePlanInput = {
  repositoryName: string
  currentVersion: string
  targetVersion?: string
  headCommit: string
  statusFileCount: number
  localTagCommit: string
  remoteTagCommit: string
  scripts: PackageScripts
  documentationSources?: string[]
}

export type ReleasePlan = {
  repositoryName: string
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  selectedScript: ReleaseScriptName
  needsVersionBump: boolean
  canPublish: boolean
  issues: string[]
  warnings: string[]
  availableActions: ReleasePublishAction[]
  documentationSources: string[]
}

const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/
const tagVersionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/

type ReleaseVersionParts = [number, number, number]

function parseReleaseVersion(version: string): [number, number, number] {
  const trimmed = version.trim()
  const match = trimmed.match(versionPattern)

  if (!match) {
    throw new Error(`package.json version 不是有效版本号：${trimmed || '(empty)'}`)
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function parseReleaseTagVersion(value: string): ReleaseVersionParts | null {
  const trimmed = value.trim()
  const match = trimmed.match(tagVersionPattern)

  if (!match) {
    return null
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function formatReleaseVersion(parts: ReleaseVersionParts): string {
  return parts.join('.')
}

function compareReleaseVersions(left: ReleaseVersionParts, right: ReleaseVersionParts): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

export function incrementReleaseVersion(version: string, bump: ReleaseVersionBump): string {
  const [major, minor, patch] = parseReleaseVersion(version)

  if (bump === 'major') {
    return `${major + 1}.0.0`
  }

  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`
  }

  return `${major}.${minor}.${patch + 1}`
}

export function createReleaseTagName(version: string): string {
  const [major, minor, patch] = parseReleaseVersion(version)
  return `v${major}.${minor}.${patch}`
}

export function createReleaseVersionRecommendation(input: ReleaseVersionRecommendationInput): ReleaseVersionRecommendation {
  const currentVersion = input.currentVersion.trim()
  const historyLimit = Math.max(1, input.historyLimit ?? 10)
  const parsedCurrentVersion = parseReleaseTagVersion(currentVersion)
  const parsedHistoricalTags = input.tagNames
    .map((tagName) => {
      const parts = parseReleaseTagVersion(tagName)
      return parts ? { tagName: tagName.trim(), version: formatReleaseVersion(parts), parts } : null
    })
    .filter((tag): tag is ReleaseTagHistoryEntry & { parts: ReleaseVersionParts } => Boolean(tag))
    .sort((left, right) => compareReleaseVersions(right.parts, left.parts) || left.tagName.localeCompare(right.tagName))

  const highestVersion = parsedHistoricalTags.reduce<ReleaseVersionParts | null>(
    (highest, tag) => (!highest || compareReleaseVersions(tag.parts, highest) > 0 ? tag.parts : highest),
    parsedCurrentVersion
  )
  const suggestedVersion = highestVersion ? incrementReleaseVersion(formatReleaseVersion(highestVersion), 'patch') : ''

  return {
    currentVersion,
    suggestedVersion,
    suggestedTagName: suggestedVersion ? createReleaseTagName(suggestedVersion) : '',
    historicalTags: parsedHistoricalTags.slice(0, historyLimit).map((tag) => ({ tagName: tag.tagName, version: tag.version }))
  }
}

export function selectReleaseScript(scripts: PackageScripts): ReleaseScriptName {
  if (scripts['publish:mac']) {
    return 'publish:mac'
  }

  if (scripts['package:mac']) {
    return 'package:mac'
  }

  if (scripts.build) {
    return 'build'
  }

  return ''
}

export function createReleasePlan(input: ReleasePlanInput): ReleasePlan {
  const issues: string[] = []
  const warnings: string[] = []
  const availableActions: ReleasePublishAction[] = []
  const selectedScript = selectReleaseScript(input.scripts)
  const currentVersion = input.currentVersion.trim()
  let suggestedVersion = input.targetVersion?.trim() || currentVersion
  let suggestedTagName = ''
  let currentTagName = ''
  let needsVersionBump = false

  try {
    currentTagName = createReleaseTagName(currentVersion)
    suggestedTagName = createReleaseTagName(suggestedVersion)
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'package.json version 不是有效版本号')
  }

  if (!input.headCommit.trim()) {
    issues.push('无法读取当前 Git 提交')
  }

  if (input.statusFileCount > 0) {
    const issue = `工作区还有 ${input.statusFileCount} 个未提交改动，请先提交后再发布`
    issues.push(issue)
    availableActions.push({
      key: 'commit-workspace-changes',
      issue,
      label: '发布时提交当前工作区改动',
      description: '会先暂存全部改动，并用版本提交信息创建提交。'
    })
  }

  if (!selectedScript) {
    issues.push('没有找到可用于发布的脚本，请在 package.json scripts 中配置 publish:mac 或 package:mac')
  } else if (selectedScript !== 'publish:mac') {
    warnings.push(`将使用 ${selectedScript} 脚本打包；如果要上传 GitHub Releases，建议配置 publish:mac`)
  }

  const normalizedHead = input.headCommit.trim()
  const normalizedLocalTagCommit = input.localTagCommit.trim()
  const normalizedRemoteTagCommit = input.remoteTagCommit.trim()

  if (suggestedTagName && normalizedHead) {
    if (normalizedLocalTagCommit && normalizedLocalTagCommit !== normalizedHead) {
      needsVersionBump = true
      const issue = `本地 ${suggestedTagName} 已存在，但不是当前提交。请确认版本号后再发布。`
      issues.push(issue)
      availableActions.push({
        key: 'replace-local-tag',
        issue,
        label: `发布时重建本地 ${suggestedTagName}`,
        description: '会先删除本地旧 Tag，让发布脚本在当前提交上重新创建。'
      })
    }

    if (normalizedRemoteTagCommit && normalizedRemoteTagCommit !== normalizedHead) {
      needsVersionBump = true
      issues.push(`远端 ${suggestedTagName} 已存在，但不是当前提交。请确认版本号后再发布。`)
    }
  }

  if (needsVersionBump && !input.targetVersion) {
    try {
      suggestedVersion = incrementReleaseVersion(currentVersion, 'patch')
      suggestedTagName = createReleaseTagName(suggestedVersion)
    } catch {
      // Keep the original validation issue.
    }
  }

  if (suggestedVersion !== currentVersion) {
    warnings.push(`发布前会把 package.json 版本从 ${currentVersion} 更新到 ${suggestedVersion}`)
  }

  return {
    repositoryName: input.repositoryName,
    currentVersion,
    suggestedVersion,
    suggestedTagName,
    selectedScript,
    needsVersionBump,
    canPublish: issues.length === 0,
    issues,
    warnings,
    availableActions,
    documentationSources: input.documentationSources ?? []
  }
}
