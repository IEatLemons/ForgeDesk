export type OpenRouterModel = {
  id: string
  name: string
  created: number
}

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    created?: unknown
  }>
}

export async function listOpenRouterModels(fetcher: typeof fetch = fetch): Promise<OpenRouterModel[]> {
  const response = await fetcher('https://openrouter.ai/api/v1/models', {
    headers: {
      accept: 'application/json',
      'X-OpenRouter-Title': 'ForgeDesk'
    },
    signal: AbortSignal.timeout(10_000)
  })

  if (!response.ok) {
    throw new Error(`OpenRouter 模型列表请求失败（HTTP ${response.status}）`)
  }

  const payload = (await response.json()) as OpenRouterModelsResponse

  if (!Array.isArray(payload.data)) {
    throw new Error('OpenRouter 返回了无效的模型列表')
  }

  const models = payload.data
    .filter((model): model is { id: string; name?: string; created?: number } => typeof model.id === 'string' && Boolean(model.id.trim()))
    .map((model) => ({
      id: model.id.trim(),
      name: typeof model.name === 'string' && model.name.trim() ? model.name.trim() : model.id.trim(),
      created: typeof model.created === 'number' && Number.isFinite(model.created) ? model.created : 0
    }))

  const seen = new Set<string>()

  return models
    .filter((model) => !seen.has(model.id) && Boolean(seen.add(model.id)))
    .sort((left, right) => right.created - left.created || left.id.localeCompare(right.id))
}
