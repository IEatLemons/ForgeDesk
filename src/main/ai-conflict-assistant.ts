import { requestAiText } from './ai-runtime.js'
import type { AiSettings } from './ai-settings.js'
import { hasConflictMarkers } from './merge-conflicts.js'

export type ConflictResolutionSuggestion = {
  filePath: string
  suggestedContent: string
}

function stripMarkdownFence(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```$/)
  return match ? match[1] : content
}

export async function requestConflictResolutionSuggestion(input: {
  settings: AiSettings
  repositoryName: string
  filePath: string
  conflictedContent: string
  fetchImpl?: typeof fetch
}): Promise<ConflictResolutionSuggestion> {
  if (!input.conflictedContent.includes('<<<<<<<')) {
    throw new Error('当前文件没有检测到冲突标记')
  }

  const content = await requestAiText({
    settings: input.settings,
    fetchImpl: input.fetchImpl,
    messages: [
          {
            role: 'system',
            content: 'You resolve Git merge conflicts. Return only the full resolved file content, with no markdown fences and no explanation.'
          },
          {
            role: 'user',
            content: `Repository: ${input.repositoryName}\nFile: ${input.filePath}\n\nResolve this conflicted file:\n${input.conflictedContent}`
          }
    ]
  })
  const suggestedContent = stripMarkdownFence(content)

  if (!suggestedContent.trim()) {
    throw new Error('AI 没有返回可用的合并内容')
  }

  if (hasConflictMarkers(suggestedContent)) {
    throw new Error('AI 返回的内容仍包含冲突标记，请重新生成或手动处理')
  }

  return { filePath: input.filePath, suggestedContent }
}
