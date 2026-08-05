import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AiProvider = 'openai-compatible' | 'openrouter' | 'codex-cli' | 'cursor-cli' | 'codex-local-api'

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
  },
  'codex-cli': {
    baseUrl: '',
    model: ''
  },
  'cursor-cli': {
    baseUrl: '',
    model: ''
  },
  'codex-local-api': {
    baseUrl: 'http://127.0.0.1:55914/v1',
    model: 'gpt-5.3-codex'
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
  const provider: AiProvider =
    input.provider === 'openrouter' || input.provider === 'codex-cli' || input.provider === 'cursor-cli' || input.provider === 'codex-local-api'
      ? input.provider
      : 'openai-compatible'
  const defaults = providerDefaults[provider]
  const inputBaseUrl = (input.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, '')
  const baseUrl = provider === 'codex-local-api'
    ? inputBaseUrl.replace(/^http:\/\/(?:localhost|\[::1\])(?=[:/]|$)/i, 'http://127.0.0.1')
    : inputBaseUrl

  return {
    ...defaultAiSettings,
    ...input,
    provider,
    enabled: Boolean(input.enabled),
    baseUrl,
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

export function isLocalAiProvider(provider: AiProvider): boolean {
  return provider === 'codex-cli' || provider === 'cursor-cli'
}

export function isAiSettingsConfigured(settings: AiSettings): boolean {
  return Boolean(settings.enabled && (isLocalAiProvider(settings.provider) || (settings.apiKey && settings.baseUrl && settings.model)))
}
