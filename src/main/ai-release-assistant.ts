import { requestAiText } from './ai-runtime.js'
import type { AiSettings } from './ai-settings.js'

export type ReleaseSuggestion = {
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
}

function stripMarkdownFence(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:json)?\n([\s\S]*?)\n```$/)
  return match ? match[1] : content
}

function parseReleaseSuggestion(content: string): Partial<ReleaseSuggestion> {
  const stripped = stripMarkdownFence(content)

  try {
    const parsed = JSON.parse(stripped) as Partial<ReleaseSuggestion>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function requestReleaseSuggestion(input: {
  settings: AiSettings
  repositoryName: string
  currentVersion: string
  suggestedVersion: string
  suggestedTagName: string
  recentCommits: string[]
  documentationContext: string
  fetchImpl?: typeof fetch
}): Promise<ReleaseSuggestion> {
  const content = await requestAiText({
    settings: input.settings,
    fetchImpl: input.fetchImpl,
    messages: [
          {
            role: 'system',
            content: [
              'You help prepare desktop app release metadata.',
              'Return valid JSON only with these string keys: version, tagName, releaseTitle, releaseNotes, commitMessage.',
              'Use concise Chinese release notes unless the project context clearly uses another language.',
              'Do not invent implementation details that are not present in the commits or project context.'
            ].join(' ')
          },
          {
            role: 'user',
            content: [
              `Repository: ${input.repositoryName}`,
              `Current version: ${input.currentVersion}`,
              `Suggested version: ${input.suggestedVersion}`,
              `Suggested tag: ${input.suggestedTagName}`,
              '',
              'Project documentation context:',
              input.documentationContext || '(no documentation context available)',
              '',
              'Recent commits:',
              ...(input.recentCommits.length > 0 ? input.recentCommits.map((commit) => `- ${commit}`) : ['- (no recent commits available)']),
              '',
              'Prepare release metadata for this version.'
            ].join('\n')
          }
    ]
  })
  const parsed = parseReleaseSuggestion(content)
  const version = normalizeField(parsed.version) || input.suggestedVersion
  const tagName = normalizeField(parsed.tagName) || input.suggestedTagName
  const releaseTitle = normalizeField(parsed.releaseTitle) || `${input.repositoryName} ${version}`
  const releaseNotes = normalizeField(parsed.releaseNotes) || `发布 ${tagName}`
  const commitMessage = normalizeField(parsed.commitMessage) || `chore: release ${tagName}`

  return {
    version,
    tagName,
    releaseTitle,
    releaseNotes,
    commitMessage
  }
}
