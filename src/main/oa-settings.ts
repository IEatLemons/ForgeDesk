import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type OaProvider = 'lark'

export type OaSettings = {
  enabled: boolean
  provider: OaProvider
  larkAppId: string
  larkAppSecret: string
  docsHomeUrl: string
  enableDocumentBrowsing: boolean
  enableDocumentEditing: boolean
  enableAiDocumentDrafting: boolean
}

export type RedactedOaSettings = OaSettings & {
  larkAppSecretConfigured: boolean
}

const defaultOaSettings: OaSettings = {
  enabled: false,
  provider: 'lark',
  larkAppId: '',
  larkAppSecret: '',
  docsHomeUrl: 'https://docs.feishu.cn',
  enableDocumentBrowsing: true,
  enableDocumentEditing: true,
  enableAiDocumentDrafting: true
}

function getOaSettingsPath(userDataPath: string): string {
  return join(userDataPath, 'oa-settings.json')
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHttpUrl(value: unknown, fallback: string): string {
  const raw = trimText(value) || fallback

  try {
    const url = new URL(raw)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }

    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new Error('请输入有效的 Lark 文档 URL')
  }
}

export function normalizeOaSettings(input: Partial<OaSettings>): OaSettings {
  return {
    ...defaultOaSettings,
    ...input,
    provider: 'lark',
    enabled: Boolean(input.enabled),
    larkAppId: trimText(input.larkAppId),
    larkAppSecret: trimText(input.larkAppSecret),
    docsHomeUrl: normalizeHttpUrl(input.docsHomeUrl, defaultOaSettings.docsHomeUrl),
    enableDocumentBrowsing: input.enableDocumentBrowsing === undefined ? defaultOaSettings.enableDocumentBrowsing : Boolean(input.enableDocumentBrowsing),
    enableDocumentEditing: input.enableDocumentEditing === undefined ? defaultOaSettings.enableDocumentEditing : Boolean(input.enableDocumentEditing),
    enableAiDocumentDrafting: input.enableAiDocumentDrafting === undefined ? defaultOaSettings.enableAiDocumentDrafting : Boolean(input.enableAiDocumentDrafting)
  }
}

export async function readOaSettingsFile(userDataPath: string): Promise<OaSettings> {
  try {
    const content = await readFile(getOaSettingsPath(userDataPath), 'utf8')
    return normalizeOaSettings(JSON.parse(content) as Partial<OaSettings>)
  } catch {
    return defaultOaSettings
  }
}

export async function writeOaSettingsFile(userDataPath: string, input: Partial<OaSettings>): Promise<OaSettings> {
  const settings = normalizeOaSettings(input)

  await mkdir(userDataPath, { recursive: true })
  await writeFile(getOaSettingsPath(userDataPath), `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })

  return settings
}

export function getRedactedOaSettings(settings: OaSettings): RedactedOaSettings {
  return {
    ...settings,
    larkAppSecret: '',
    larkAppSecretConfigured: Boolean(settings.larkAppSecret)
  }
}
