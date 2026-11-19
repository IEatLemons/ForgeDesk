import { getErrorMessage } from './error-messages.js'
import type { AiSettingsView } from './data'

export const configurationTargets = {
  ai: { title: 'AI 模型配置', action: '前往 AI 设置', scope: 'global', module: 'ai' },
  github: { title: 'GitHub Token', action: '配置 GitHub Token', scope: 'global', module: 'github' },
  codemagic: { title: 'Codemagic 凭据', action: '配置 Codemagic Token', scope: 'global', module: 'codemagic' },
  plane: { title: 'Plane 连接', action: '配置 Plane 连接', scope: 'global', module: 'plane' },
  oa: { title: 'Lark / 飞书设置', action: '前往 Lark 设置', scope: 'global', module: 'oa' },
  git: { title: 'Git 身份', action: '配置 Git 身份', scope: 'global', module: 'git' },
  private: { title: 'SSH 私钥', action: '配置 SSH 私钥', scope: 'global', module: 'private' },
  'ai-accounts': { title: 'AI 账号与登录', action: '前往账号与登录', scope: 'global', module: 'ai-accounts' },
  services: { title: '项目服务配置', action: '配置平台连接', scope: 'project', module: 'services' },
  repositories: { title: '仓库与远端', action: '前往仓库设置', scope: 'project', module: 'git' },
  release: { title: '项目发布设置', action: '前往发布设置', scope: 'project', module: 'release' },
  cloudflare: { title: 'Cloudflare 配置', action: '配置 Cloudflare', scope: 'project', module: 'cloudflare' },
  'project-plane': { title: 'Plane 项目绑定', action: '绑定 Plane 项目', scope: 'project', module: 'plane' }
} as const
export type ConfigurationTarget = keyof typeof configurationTargets
export type ConfigurationContext = { projectId?: string; repositoryId?: string }
export type ConfigurationRequest = ConfigurationContext & { target: ConfigurationTarget }

export function isDeploymentAiReady(settings: AiSettingsView): boolean {
  return Boolean(settings.enabled && (settings.provider === 'codex-cli' || settings.provider === 'cursor-cli' || (settings.apiKeyConfigured && settings.baseUrl.trim() && settings.model.trim())))
}

export function getConfigurationTarget(error: unknown): ConfigurationTarget | null {
  const text = getErrorMessage(error)
  const needsConfiguration = /请(?:先|在|填写|配置|选择|绑定|启用|保存)|需要(?:先)?(?:配置|绑定|启用|登录)|尚未(?:配置|启用|绑定|登录)|未配置|未启用|还没有绑定|没有.*(?:远端|连接|Token)|缺少.*(?:配置|Token|API Key)|找不到.*(?:Token|连接)|(?:Token|API\s*Key).*(?:无效|过期)|(?:Codex|Cursor).*(?:未登录|需要登录)/i.test(text)
  if (!needsConfiguration) return null
  if (/Cloudflare/i.test(text)) return 'cloudflare'
  if (/Firebase|Codemagic.*(?:App\s*ID|Workflow)|SSH.*(?:目标|部署目录|PM2)|发布设置/i.test(text)) return 'release'
  if (/Codemagic/i.test(text)) return 'codemagic'
  if (/GitHub.*Token/i.test(text)) return 'github'
  if (/Plane/i.test(text)) return /绑定|关联/.test(text) && !/API\s*Token/i.test(text) ? 'project-plane' : 'plane'
  if (/Lark|飞书|OA 设置/i.test(text)) return 'oa'
  if (/Vercel|Railway|平台.*(?:Token|连接|服务)|运行配置.*(?:连接|Token|服务)|(?:已有|已同步).*平台服务/i.test(text)) return 'services'
  if (/仓库.*(?:远端|配置)|远端.*配置|配置.*(?:仓库|远端)/i.test(text)) return 'repositories'
  if (/Git.*(?:身份|用户名|邮箱)|user\.name|user\.email/i.test(text)) return 'git'
  if (/SSH.*(?:私钥|密钥)/i.test(text)) return 'private'
  if (/(?:Codex|Cursor).*(?:登录|账户|账号)/i.test(text)) return 'ai-accounts'
  if (/\bAI\b|本地 Codex|AI API Key/i.test(text)) return 'ai'
  return null
}
