export type ProjectSettingsModuleKey = 'basic' | 'people' | 'branches' | 'git' | 'services' | 'release' | 'cloudflare' | 'plane'

export type ProjectSettingsModule = {
  key: ProjectSettingsModuleKey
  title: string
  description: string
}

export type ProjectSettingsViewState = {
  mode: 'list' | 'detail'
  activeModuleKey: ProjectSettingsModuleKey | null
}

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
  }
]

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
