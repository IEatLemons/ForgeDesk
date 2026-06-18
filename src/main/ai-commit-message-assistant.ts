import { buildAiRequestHeaders, type AiSettings } from './ai-settings.js'

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
  if (!input.settings.enabled || !input.settings.apiKey) {
    throw new Error('请先在公共设置里启用 AI 并填写 API Key')
  }

  if (input.files.length === 0) {
    throw new Error('请选择要生成提交信息的文件')
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(`${input.settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildAiRequestHeaders(input.settings),
    body: JSON.stringify({
      model: input.settings.model,
      temperature: input.settings.temperature,
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
  })

  if (!response.ok) {
    throw new Error(`AI 请求失败：HTTP ${response.status}`)
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const message = normalizeCommitMessage(payload.choices?.[0]?.message?.content ?? '')

  if (!message) {
    throw new Error('AI 没有返回可用的提交信息')
  }

  return { message }
}
