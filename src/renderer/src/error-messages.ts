const aiCredentialErrorMessage = 'AI API Key 无效、已过期或没有权限，请在 AI 设置里更新 API Key 后重试。'

function getRawErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return fallback
}

function stripRemoteErrorPrefix(messageText: string): string {
  return messageText
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

function isAiErrorContext(rawMessage: string, normalizedMessage: string): boolean {
  const raw = rawMessage.toLowerCase()
  const normalized = normalizedMessage.toLowerCase()

  return (
    normalized.includes('ai ') ||
    normalized.includes('ai 请求') ||
    raw.includes('repository:commit-message:suggest') ||
    raw.includes('repository:release:suggest') ||
    raw.includes('repository:conflict:suggest')
  )
}

function normalizeAiErrorMessage(rawMessage: string, normalizedMessage: string): string {
  const combined = `${rawMessage} ${normalizedMessage}`.toLowerCase()

  if (!isAiErrorContext(rawMessage, normalizedMessage)) {
    return normalizedMessage
  }

  if (
    /http\s*401/i.test(normalizedMessage) ||
    /invalid[_\s-]?api[_\s-]?key/i.test(combined) ||
    /incorrect[_\s-]?api[_\s-]?key/i.test(combined) ||
    /unauthori[sz]ed/i.test(combined) ||
    /authentication/i.test(combined) ||
    /expired/i.test(combined)
  ) {
    return aiCredentialErrorMessage
  }

  if (/http\s*402/i.test(normalizedMessage) || /insufficient[_\s-]?quota|quota|billing|credit|balance/i.test(combined)) {
    return 'AI 服务额度不足或账单状态异常，请检查余额、额度或账单设置后重试。'
  }

  if (/http\s*429/i.test(normalizedMessage) || /rate[_\s-]?limit|too many requests/i.test(combined)) {
    return 'AI 服务请求过于频繁，请稍后重试，或换用有更高额度的 API Key/模型。'
  }

  return normalizedMessage
}

export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  const rawMessage = getRawErrorMessage(error, fallback)
  const normalizedMessage = stripRemoteErrorPrefix(rawMessage)

  return normalizeAiErrorMessage(rawMessage, normalizedMessage)
}

export function isAiCredentialErrorMessage(errorMessage: string): boolean {
  return errorMessage.includes('AI API Key 无效')
}
