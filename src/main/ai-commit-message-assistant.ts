import { requestAiText } from './ai-runtime.js'
import type { AiSettings } from './ai-settings.js'

export type CommitMessageSuggestion = {
  message: string
}

export type CommitMessageFile = {
  path: string
  status: string
}

function stripMarkdownFence(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```$/)
  return match ? match[1] : content
}

function normalizeCommitMessage(content: string): string {
  return stripMarkdownFence(content)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .find(Boolean) ?? ''
}

export async function requestCommitMessageSuggestion(input: {
  settings: AiSettings
  repositoryName: string
  files: CommitMessageFile[]
  diffSummary: string
  fetchImpl?: typeof fetch
}): Promise<CommitMessageSuggestion> {
  if (input.files.length === 0) {
    throw new Error('请选择要生成提交信息的文件')
  }

  const content = await requestAiText({
    settings: input.settings,
    fetchImpl: input.fetchImpl,
    messages: [
          {
            role: 'system',
            content: 'You write concise Git commit messages. Return exactly one conventional commit message line, no markdown, no explanation.'
          },
          {
            role: 'user',
            content: [
              `Repository: ${input.repositoryName}`,
              'Changed files:',
              ...input.files.map((file) => `- ${file.status} ${file.path}`),
              '',
              'Diff summary:',
              input.diffSummary || '(no diff summary available)',
              '',
              'Write the best commit message for only these selected files.'
            ].join('\n')
          }
    ]
  })
  const message = normalizeCommitMessage(content)

  if (!message) {
    throw new Error('AI 没有返回可用的提交信息')
  }

  return { message }
}
