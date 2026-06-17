import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AiSettings = {
  enabled: boolean
  provider: 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export type RedactedAiSettings = Omit<AiSettings, 'apiKey'> & {
  apiKeyConfigured: boolean
}

const defaultAiSettings: AiSettings = {
  enabled: false,
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4.1-mini',
  temperature: 0.2
}

function getAiSettingsPath(userDataPath: string): string {
  return join(userDataPath, 'ai-settings.json')
}

export function normalizeAiSettings(input: Partial<AiSettings>): AiSettings {
  return {
    ...defaultAiSettings,
    ...input,
    provider: 'openai-compatible',
    enabled: Boolean(input.enabled),
    baseUrl: (input.baseUrl || defaultAiSettings.baseUrl).trim().replace(/\/+$/, ''),
    apiKey: (input.apiKey || '').trim(),
    model: (input.model || defaultAiSettings.model).trim(),
    temperature: Math.min(1, Math.max(0, Number(input.temperature ?? defaultAiSettings.temperature)))
  }
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
  const { apiKey: _apiKey, ...rest } = settings
  return { ...rest, apiKeyConfigured: Boolean(settings.apiKey) }
}
