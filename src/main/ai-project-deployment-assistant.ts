import { requestAiText } from './ai-runtime.js'
import { isAiSettingsConfigured, type AiSettings } from './ai-settings.js'
import {
  getDefaultDeploymentConfig,
  type DeploymentInspection,
  type DeploymentEnvBinding,
  type DeploymentProviderType,
  type DeploymentSourceMode,
  type ProjectDeploymentConfig,
  type ProjectDeploymentSuggestion
} from './project-deployment.js'

function stripMarkdownFence(content: string): string {
  const trimmed = content.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match?.[1] ?? trimmed
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown, fallback: number): number {
  const result = Number(value)
  return Number.isFinite(result) ? Math.max(0, Math.min(1, result)) : fallback
}

function parseSuggestion(content: string): Partial<ProjectDeploymentSuggestion> {
  try {
    const parsed = JSON.parse(stripMarkdownFence(content)) as Partial<ProjectDeploymentSuggestion>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeConfig(value: unknown): Partial<ProjectDeploymentConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const envBindings: DeploymentEnvBinding[] | undefined = Array.isArray(input.envBindings)
    ? input.envBindings.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const env = item as Record<string, unknown>
        const key = text(env.key)
        return key ? [{ key, source: (env.source === 'local' || env.source === 'manual' ? env.source : 'provider') as DeploymentEnvBinding['source'], required: env.required !== false, configured: Boolean(env.configured) }] : []
      })
    : undefined

  return {
    ...(typeof input.rootDirectory === 'string' ? { rootDirectory: text(input.rootDirectory) } : {}),
    ...(typeof input.branch === 'string' ? { branch: text(input.branch) } : {}),
    ...(typeof input.installCommand === 'string' ? { installCommand: text(input.installCommand) } : {}),
    ...(typeof input.buildCommand === 'string' ? { buildCommand: text(input.buildCommand) } : {}),
    ...(typeof input.outputDirectory === 'string' ? { outputDirectory: text(input.outputDirectory) } : {}),
    ...(typeof input.framework === 'string' ? { framework: text(input.framework) } : {}),
    ...(typeof input.runtimeVersion === 'string' ? { runtimeVersion: text(input.runtimeVersion) } : {}),
    ...(typeof input.startCommand === 'string' ? { startCommand: text(input.startCommand) } : {}),
    ...(typeof input.port === 'string' || typeof input.port === 'number' ? { port: text(input.port) } : {}),
    ...(typeof input.remoteHost === 'string' ? { remoteHost: text(input.remoteHost) } : {}),
    ...(typeof input.remotePath === 'string' ? { remotePath: text(input.remotePath) } : {}),
    ...(typeof input.uploadPath === 'string' ? { uploadPath: text(input.uploadPath) } : {}),
    ...(typeof input.appName === 'string' ? { appName: text(input.appName) } : {}),
    ...(typeof input.dockerContext === 'string' ? { dockerContext: text(input.dockerContext) } : {}),
    ...(typeof input.dockerfile === 'string' ? { dockerfile: text(input.dockerfile) } : {}),
    ...(typeof input.composeFile === 'string' ? { composeFile: text(input.composeFile) } : {}),
    ...(typeof input.composeService === 'string' ? { composeService: text(input.composeService) } : {}),
    ...(Array.isArray(envBindings) ? { envBindings } : {})
  }
}

export async function requestProjectDeploymentSuggestion(input: {
  settings: AiSettings
  inspection: DeploymentInspection
  provider: DeploymentProviderType
  sourceMode: DeploymentSourceMode
  fetchImpl?: typeof fetch
}): Promise<ProjectDeploymentSuggestion> {
  const fallback = getDefaultDeploymentConfig(input.inspection, input.provider, input.sourceMode)

  if (!isAiSettingsConfigured(input.settings)) {
    throw new Error('请先启用并配置 AI 设置')
  }

  const content = await requestAiText({
    settings: input.settings,
    fetchImpl: input.fetchImpl,
    messages: [
      {
        role: 'system',
        content: [
          'You are ForgeDesk deployment configuration assistant.',
          'Return valid JSON only.',
          'Infer only from the supplied project context; do not invent credentials, URLs, branches, or files.',
          'Never return environment variable values. Return only environment variable names with source provider, local, or manual.',
          'Keep commands executable and concise. Explain uncertain decisions in reasons or warnings.'
        ].join(' ')
      },
      {
        role: 'user',
        content: [
          `Provider: ${input.provider}`,
          `Source mode: ${input.sourceMode}`,
          'Project context:',
          input.inspection.aiContext,
          '',
          'Return JSON with this shape:',
          JSON.stringify({
            config: fallback,
            confidence: 0.8,
            reasons: [''],
            warnings: [''],
            sources: ['']
          })
        ].join('\n')
      }
    ]
  })
  const parsed = parseSuggestion(content)
  const config = { ...fallback, ...normalizeConfig(parsed.config) }
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(text).filter(Boolean).slice(0, 8) : []
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(text).filter(Boolean).slice(0, 8) : []
  const sources = Array.isArray(parsed.sources) ? parsed.sources.map(text).filter(Boolean).slice(0, 16) : []

  return {
    config,
    confidence: number(parsed.confidence, 0.55),
    reasons: reasons.length > 0 ? reasons : ['根据项目清单和构建文件生成默认配置，请确认后再发布。'],
    warnings,
    sources: sources.length > 0 ? sources : input.inspection.files.filter((file) => file.includedInAi).map((file) => file.path)
  }
}
