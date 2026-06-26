import { createAiNetworkError, createAiRequestError } from './ai-errors.js'
import { buildAiRequestHeaders, type AiSettings } from './ai-settings.js'

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
  if (!input.settings.enabled || !input.settings.apiKey) {
    throw new Error('请先在公共设置里启用 AI 并填写 API Key')
  }

  const fetchImpl = input.fetchImpl ?? fetch
  let response: Response

  try {
    response = await fetchImpl(`${input.settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildAiRequestHeaders(input.settings),
      body: JSON.stringify({
        model: input.settings.model,
        temperature: input.settings.temperature,
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
    })
  } catch (error) {
    throw createAiNetworkError(error)
  }

  if (!response.ok) {
    throw await createAiRequestError(response)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const parsed = parseReleaseSuggestion(payload.choices?.[0]?.message?.content ?? '')
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
