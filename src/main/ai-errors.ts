const aiCredentialMessage = 'AI API Key 无效、已过期或没有权限，请在 AI 设置里更新 API Key 后重试。'

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi, 'Bearer ***')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-***')
}

function truncateDetail(value: string): string {
  const detail = normalizeWhitespace(redactSensitiveText(value))
  return detail.length > 220 ? `${detail.slice(0, 217)}...` : detail
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collectErrorText(value: unknown, depth = 0): string[] {
  if (depth > 3) {
    return []
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [String(value)]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorText(item, depth + 1))
  }

  if (!isRecord(value)) {
    return []
  }

  const parts: string[] = []

  for (const key of ['message', 'code', 'type', 'error', 'detail', 'reason']) {
    if (key in value) {
      parts.push(...collectErrorText(value[key], depth + 1))
    }
  }

  return parts
}

function getAiErrorDetail(rawBody: string): string {
  const body = rawBody.trim()

  if (!body) {
    return ''
  }

  try {
    const parsed = JSON.parse(body) as unknown
    return truncateDetail(collectErrorText(parsed).filter(Boolean).join(' '))
  } catch {
    return truncateDetail(body)
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value))
}

function appendDetail(message: string, detail: string): string {
  return detail ? `${message} 服务返回：${detail}` : message
}

function formatAiRequestError(status: number, detail: string): string {
  const haystack = `${status} ${detail}`.toLowerCase()

  if (
    status === 401 ||
    includesAny(haystack, [
      /invalid[_\s-]?api[_\s-]?key/,
      /incorrect[_\s-]?api[_\s-]?key/,
      /expired/,
      /unauthori[sz]ed/,
      /authentication/,
      /auth credentials/,
      /invalid token/
    ])
  ) {
    return aiCredentialMessage
  }

  if (
    status === 402 ||
    includesAny(haystack, [
      /insufficient[_\s-]?quota/,
      /quota/,
      /credit/,
      /billing/,
      /payment/,
      /balance/
    ])
  ) {
    return 'AI 服务额度不足或账单状态异常，请检查余额、额度或账单设置后重试。'
  }

  if (status === 403 || includesAny(haystack, [/forbidden/, /permission/, /access denied/])) {
    return 'AI API Key 没有访问权限，请检查提供商、模型权限或账号状态后重试。'
  }

  if (status === 429 || includesAny(haystack, [/rate[_\s-]?limit/, /too many requests/])) {
    return 'AI 服务请求过于频繁，请稍后重试，或换用有更高额度的 API Key/模型。'
  }

  if (status === 404 || includesAny(haystack, [/model[_\s-]?not[_\s-]?found/, /not found/, /no endpoints found/])) {
    return appendDetail('AI 接口地址或模型不存在，请检查 Base URL 和模型名称。', detail)
  }

  if (status === 400 || includesAny(haystack, [/invalid[_\s-]?model/, /bad request/])) {
    return appendDetail('AI 请求被服务端拒绝，请检查模型名称、Base URL 和提供商设置。', detail)
  }

  if (status >= 500) {
    return appendDetail('AI 服务暂时不可用，请稍后重试。', detail)
  }

  return appendDetail(`AI 请求失败：HTTP ${status}。`, detail)
}

export async function createAiRequestError(response: Response): Promise<Error> {
  const detail = getAiErrorDetail(await readErrorBody(response))
  return new Error(formatAiRequestError(response.status, detail))
}

export function createAiNetworkError(error: unknown): Error {
  const detail = error instanceof Error ? truncateDetail(error.message) : ''
  return new Error(appendDetail('AI 请求没有连上服务，请检查 Base URL、网络或代理设置。', detail))
}
