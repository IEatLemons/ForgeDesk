export type ServiceProviderGuideProvider = 'railway' | 'vercel'

export type ServiceProviderGuide = {
  provider: ServiceProviderGuideProvider
  title: string
  primaryTokenUrl: string
  docsUrl: string
  dashboardUrl: string
  projectTokenDocsUrl?: string
  steps: string[]
}

const providerGuides: Record<ServiceProviderGuideProvider, ServiceProviderGuide> = {
  vercel: {
    provider: 'vercel',
    title: 'Vercel',
    primaryTokenUrl: 'https://vercel.com/account/settings/tokens',
    docsUrl: 'https://vercel.com/docs/rest-api',
    dashboardUrl: 'https://vercel.com/dashboard',
    steps: [
      '打开 Vercel Tokens 页面，新建 Access Token 后粘贴到 Token。',
      '个人项目可以不填 Team ID；团队项目需要在 Team 设置里复制 Team ID。',
      '保存连接后点击“测试”或“同步”，ForgeDesk 会读取项目、环境、部署和域名。'
    ]
  },
  railway: {
    provider: 'railway',
    title: 'Railway',
    primaryTokenUrl: 'https://railway.com/account/tokens',
    docsUrl: 'https://docs.railway.com/integrations/api',
    dashboardUrl: 'https://railway.com/dashboard',
    projectTokenDocsUrl: 'https://docs.railway.com/integrations/api#project-token',
    steps: [
      '账号或 Workspace Token 在 Account Tokens 页面创建，Token 类型选择 Account 或 Workspace。',
      'Project Token 在项目设置的 Tokens 页面创建，类型选择 Project。',
      'Project Token 使用 Project-Access-Token 方式同步；账号和 Workspace Token 使用 Bearer Token。',
      '需要手动填 ID 时，可在 Railway 项目里用 Cmd/Ctrl+K 复制 Project、Service 或 Environment ID。'
    ]
  }
}

export function getServiceProviderGuide(provider: ServiceProviderGuideProvider): ServiceProviderGuide {
  return providerGuides[provider]
}
