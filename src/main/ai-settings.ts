import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AiProvider = 'openai-compatible' | 'openrouter'

type AiProviderDefaults = {
  baseUrl: string
  model: string
}

export type AiSettings = {
  enabled: boolean
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export type RedactedAiSettings = AiSettings & {
  apiKeyConfigured: boolean
}

const providerDefaults: Record<AiProvider, AiProviderDefaults> = {
  'openai-compatible': {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini'
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: '~openai/gpt-latest'
  }
}

const defaultAiSettings: AiSettings = {
  enabled: false,
  provider: 'openai-compatible',
  baseUrl: providerDefaults['openai-compatible'].baseUrl,
  apiKey: '',
  model: providerDefaults['openai-compatible'].model,
  temperature: 0.2
}

function getAiSettingsPath(userDataPath: string): string {
  return join(userDataPath, 'ai-settings.json')
}

export function normalizeAiSettings(input: Partial<AiSettings>): AiSettings {
  const provider: AiProvider = input.provider === 'openrouter' ? 'openrouter' : 'openai-compatible'
  const defaults = providerDefaults[provider]

  return {
    ...defaultAiSettings,
    ...input,
    provider,
    enabled: Boolean(input.enabled),
    baseUrl: (input.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, ''),
    apiKey: (input.apiKey || '').trim(),
    model: (input.model || defaults.model).trim(),
    temperature: Math.min(1, Math.max(0, Number(input.temperature ?? defaultAiSettings.temperature)))
  }
}

export function buildAiRequestHeaders(settings: AiSettings): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${settings.apiKey}`,
    'content-type': 'application/json'
  }

  if (settings.provider === 'openrouter') {
    headers['X-OpenRouter-Title'] = 'ForgeDesk'
  }

  return headers
}

export async function readAiSettingsFile(userDataPath: string): Promise<AiSettings> {
  try {
    const content = await readFile(getAiSettingsPath(userDataPath), 'utf8')
    return normalizeAiSettings(JSON.parse(content) as Partial<AiSettings>)
  } catch {
    return defaultAiSettings
  }
}

export async function writeAiSettingsFile(userDataPath: string, input: Partial<AiSettings>): Promise<AiSettings> {
  const settings = normalizeAiSettings(input)

  await mkdir(userDataPath, { recursive: true })
  await writeFile(getAiSettingsPath(userDataPath), `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })

  return settings
}

export function getRedactedAiSettings(settings: AiSettings): RedactedAiSettings {
  return { ...settings, apiKeyConfigured: Boolean(settings.apiKey) }
}
