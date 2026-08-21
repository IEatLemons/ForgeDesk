export type ProjectSettingsModuleKey = 'basic' | 'people' | 'branches' | 'git' | 'services' | 'release' | 'cloudflare' | 'plane' | 'codex'

export type ProjectSettingsCategoryKey = 'project' | 'git' | 'delivery' | 'collaboration'

export type ProjectSettingsModule = {
  key: ProjectSettingsModuleKey
  title: string
  description: string
}

export type ProjectSettingsCategory = {
  key: ProjectSettingsCategoryKey
  title: string
  description: string
  moduleKeys: ProjectSettingsModuleKey[]
}

export type ProjectSettingsViewState = {
  mode: 'list' | 'detail'
  activeModuleKey: ProjectSettingsModuleKey | null
}

export const PROJECT_SETTINGS_CATEGORIES: ProjectSettingsCategory[] = [
  {
    key: 'project',
    title: '项目与成员',
    description: '维护项目基本资料，以及项目成员和提交身份的归属关系。',
    moduleKeys: ['basic', 'people']
  },
  {
    key: 'git',
    title: 'Git 与仓库',
    description: '集中管理仓库、远端、分支标签和 Git 操作。',
    moduleKeys: ['git', 'branches']
  },
  {
    key: 'delivery',
    title: '服务与发布',
    description: '统一配置项目服务、发布渠道和域名基础设施。',
    moduleKeys: ['services', 'release', 'cloudflare']
  },
  {
    key: 'collaboration',
    title: '协作与集成',
    description: '连接项目协作工具，让外部工作内容回到项目详情。',
    moduleKeys: ['plane', 'codex']
  }
]

export const PROJECT_SETTINGS_MODULES: ProjectSettingsModule[] = [
  {
    key: 'basic',
    title: '基础信息',
    description: '维护项目名称、目录、负责人和描述。'
  },
  {
    key: 'people',
    title: '人员映射',
    description: '维护真实人员和 Git 提交身份的归属关系。'
  },
  {
    key: 'branches',
    title: '分支标签颜色',
    description: '按分支短名维护 Log 树里的 ref 标签颜色。'
  },
  {
    key: 'git',
    title: 'Git 与仓库',
    description: '统一查看仓库状态、维护远端、设置主推送目标并运行 Git 操作。'
  },
  {
    key: 'services',
    title: '服务配置',
    description: '先配置平台连接，再把一个或多个 Vercel、Railway 项目绑定到当前项目。'
  },
  {
    key: 'release',
    title: '发布设置',
    description: '按项目启用 Firebase App Distribution，并维护 App ID、产物和发布凭证。'
  },
  {
    key: 'cloudflare',
    title: 'Cloudflare',
    description: '为当前项目单独配置 Cloudflare Zone、Token 和 DNS 记录。'
  },
  {
    key: 'plane',
    title: 'Plane 绑定',
    description: '绑定 Plane workspace/project，让项目详情显示 Plane 内容。'
  },
  {
    key: 'codex',
    title: 'Codex 项目绑定',
    description: '绑定多个 Codex 原生项目，并统一查看普通任务和工作树。'
  }
]

export function getProjectSettingsModulesForCategory(categoryKey: ProjectSettingsCategoryKey): ProjectSettingsModule[] {
  const category = PROJECT_SETTINGS_CATEGORIES.find((item) => item.key === categoryKey)

  if (!category) {
    return []
  }

  return category.moduleKeys
    .map((moduleKey) => PROJECT_SETTINGS_MODULES.find((module) => module.key === moduleKey))
    .filter((module): module is ProjectSettingsModule => Boolean(module))
}

export function createInitialProjectSettingsView(): ProjectSettingsViewState {
  return {
    mode: 'list',
    activeModuleKey: null
  }
}

export function openProjectSettingsModule(moduleKey: ProjectSettingsModuleKey): ProjectSettingsViewState {
  return {
    mode: 'detail',
    activeModuleKey: moduleKey
  }
}

export function closeProjectSettingsModule(): ProjectSettingsViewState {
  return createInitialProjectSettingsView()
}
