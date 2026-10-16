import type { AppNavigationKey } from './app-navigation'

export type WorkspaceArea = 'workbench' | 'projects' | 'ai' | 'resources' | 'toolbox' | 'settings'
export type ProjectPage = 'overview' | 'goals' | 'tasks' | 'milestones' | 'versions' | 'repositories' | 'contributions' | 'environments' | 'deployments' | 'monitoring' | 'domains' | 'settings-general' | 'settings-repositories' | 'settings-runtime' | 'settings-integrations'
type DetailLocation = { detailView?: 'preview'|'overview'|'children'|'ai'|'history' }
export type AppRoute = DetailLocation & (
  | { scope: 'global'; area: WorkspaceArea; page: string; entityId?: string; projectFilter?: string; view?: string }
  | { scope: 'project'; projectId: string; page: ProjectPage; repositoryId?: string; entityId?: string; view?: string })
export type ProjectRoute = Extract<AppRoute, { scope: 'project' }>
export type GlobalRoute = Extract<AppRoute, { scope: 'global' }>
export type DirectoryItem = { key: string; label: string; children?: DirectoryItem[] }

export const PROJECT_DIRECTORY: DirectoryItem[] = [
  { key: 'overview', label: '项目概览' },
  { key: 'progress', label: '进度', children: [{ key: 'goals', label: '目标' }, { key: 'tasks', label: '任务' }, { key: 'milestones', label: '里程碑' }, { key: 'versions', label: '版本计划' }] },
  { key: 'code', label: '代码管理', children: [{ key: 'repositories', label: '仓库' }, { key: 'contributions', label: '提交分析' }] },
  { key: 'runtime', label: '运行', children: [{ key: 'environments', label: '环境与服务' }, { key: 'deployments', label: '部署与发布' }, { key: 'monitoring', label: '日志与监控' }, { key: 'domains', label: '域名' }] },
  { key: 'project-settings', label: '项目设置', children: [{ key: 'settings-general', label: '基本信息与人员' }, { key: 'settings-repositories', label: '仓库设置' }, { key: 'settings-runtime', label: '运行配置' }, { key: 'settings-integrations', label: '外部绑定' }] }
]
export const TOOL_DIRECTORY: DirectoryItem[] = [
  { key: 'security', label: '密码与密钥', children: [{ key: 'password', label: '密码生成' }, { key: 'rsa', label: 'RSA 私钥与记录' }] },
  { key: 'development', label: '开发辅助', children: [{ key: 'env-diff', label: '环境变量对比' }, { key: 'terminal', label: '通用终端' }] },
  { key: 'data', label: '数据处理', children: [{ key: 'excel', label: 'Excel / 月度绩效' }] },
  { key: 'reading', label: '资料资讯', children: [{ key: 'docs', label: '文档与资料' }, { key: 'news', label: '市场资讯' }] },
  { key: 'diagnostics', label: '本机诊断', children: [{ key: 'system-monitor', label: '电脑监控' }, { key: 'system-info', label: '系统信息' }, { key: 'cli-environment', label: '命令行环境' }] }
]
export const SETTINGS_DIRECTORY: DirectoryItem[] = [
  { key: 'display', label: '界面与系统', children: [{ key: 'appearance', label: '外观' }, { key: 'menu-bar', label: '菜单栏整理' }, { key: 'log-refresh', label: 'Git 刷新设置' }] },
  { key: 'credentials', label: '身份凭据', children: [{ key: 'ai-accounts', label: 'AI 账号与额度' }, { key: 'git', label: 'Git 身份与环境' }, { key: 'github', label: 'GitHub Token' }, { key: 'private', label: 'SSH 私钥' }, { key: 'public', label: 'SSH 公钥' }, { key: 'config', label: 'SSH config' }, { key: 'gpg', label: 'GPG 签名' }, { key: 'codemagic', label: 'Codemagic 凭据' }] },
  { key: 'integrations', label: '外部集成', children: [{ key: 'services', label: '服务平台连接' }, { key: 'plane', label: 'Plane' }, { key: 'oa', label: 'Lark / 飞书' }, { key: 'ai', label: 'AI 模型配置' }] },
  { key: 'maintenance', label: '数据与维护', children: [{ key: 'migration', label: '任务迁移与核对' }, { key: 'legacy-todos', label: '旧待办恢复' }, { key: 'legacy-ai', label: '历史 AI 工作流' }, { key: 'repair', label: '原始记录修复' }, { key: 'updates', label: '应用更新' }, { key: 'layout', label: '布局恢复' }] }
]
export const GLOBAL_DIRECTORY: { key: WorkspaceArea; label: string; footer: boolean; children?: DirectoryItem[] }[] = [
  { key: 'workbench', label: '工作台', footer: false }, { key: 'projects', label: '项目', footer: false },
  { key: 'ai', label: 'AI 工作台', footer: false, children: [{ key: 'activity', label: '运行动态' }, { key: 'sessions', label: '会话' }, { key: 'directories', label: '工作目录' }] },
  { key: 'resources', label: '共享资源', footer: true, children: [{ key: 'services', label: '服务与部署总览' }, { key: 'data-sources', label: '数据库与存储' }, { key: 'docker', label: '本机容器' }] },
  { key: 'toolbox', label: '工具箱', footer: true, children: TOOL_DIRECTORY }, { key: 'settings', label: '设置', footer: true, children: SETTINGS_DIRECTORY }
]
export const projectPage = (projectId: string, page: ProjectPage = 'overview'): ProjectRoute => ({ scope: 'project', projectId, page })
export const globalPage = (area: WorkspaceArea, page?: string): GlobalRoute => ({ scope: 'global', area, page: page ?? ({ workbench: 'home', projects: 'list', ai: 'activity', resources: 'services', toolbox: 'security', settings: 'appearance' }[area]) })
export function findDirectory(items: DirectoryItem[], key: string): DirectoryItem | undefined {
  for (const item of items) { if (item.key === key) return item; const child = item.children && findDirectory(item.children, key); if (child) return child }
}
export function directoryParents(items: DirectoryItem[], key: string): string[] {
  for (const item of items) { if (item.key === key) return []; if (item.children && findDirectory(item.children, key)) return [item.key, ...directoryParents(item.children, key)] }
  return []
}
export function routeLabel(route: AppRoute): string {
  if (route.scope === 'project') return findDirectory(PROJECT_DIRECTORY, route.page)?.label ?? '项目概览'
  const area = GLOBAL_DIRECTORY.find(item => item.key === route.area)!
  return findDirectory(area.children ?? [], route.page)?.label ?? (route.page === 'tasks' ? '跨项目待办' : route.page === 'assistant' ? 'AI 对话' : area.label)
}
export function routeKey(route: AppRoute): string { return JSON.stringify(route) }
export function legacyRoute(key: AppNavigationKey, projectId?: string | null): AppRoute {
  const routes: Record<AppNavigationKey, AppRoute> = {
    overview: globalPage('workbench'), tasks: globalPage('workbench', 'tasks'), projects: globalPage('projects'),
    'ai-tools': globalPage('ai'), 'ai-chat': globalPage('ai', 'assistant'), services: globalPage('resources'),
    'data-sources': globalPage('resources', 'data-sources'), docker: globalPage('resources', 'docker'),
    tools: globalPage('toolbox'), docs: globalPage('toolbox', 'docs'), 'market-news': globalPage('toolbox', 'news'),
    'system-monitor': globalPage('toolbox', 'system-monitor'), 'system-info': globalPage('toolbox', 'system-info'),
    terminal: globalPage('toolbox', 'terminal'), settings: globalPage('settings')
  }
  return key === 'projects' && projectId ? projectPage(projectId) : routes[key]
}
export type WorkspaceHistory = { entries: AppRoute[]; index: number; locations: Record<string, ProjectRoute> }
export function createWorkspaceHistory(initial: AppRoute = globalPage('workbench')): WorkspaceHistory { return { entries: [initial], index: 0, locations: initial.scope === 'project' ? { [initial.projectId]: initial } : {} } }
export function visitRoute(state: WorkspaceHistory, route: AppRoute): WorkspaceHistory {
  if (routeKey(state.entries[state.index]) === routeKey(route)) return state
  return { entries: [...state.entries.slice(0, state.index + 1), route], index: state.index + 1, locations: route.scope === 'project' ? { ...state.locations, [route.projectId]: route } : state.locations }
}
export function restoreHistory(state: WorkspaceHistory, index: number): WorkspaceHistory {
  if (index < 0 || index >= state.entries.length) return state
  const route = state.entries[index]
  return { ...state, index, locations: route.scope === 'project' ? { ...state.locations, [route.projectId]: route } : state.locations }
}
export function validRoute(value: unknown): value is AppRoute {
  if (!value || typeof value !== 'object') return false
  const route = value as AppRoute
  if (route.entityId !== undefined && typeof route.entityId !== 'string') return false
  if (route.detailView!==undefined&&!['preview','overview','children','ai','history'].includes(route.detailView))return false
  if (route.view !== undefined && typeof route.view !== 'string') return false
  if (route.scope === 'project' && route.repositoryId !== undefined && typeof route.repositoryId !== 'string') return false
  if (route.scope === 'global' && route.projectFilter !== undefined && typeof route.projectFilter !== 'string') return false
  if (route.scope === 'project') return typeof route.projectId === 'string' && !!route.projectId && !!findDirectory(PROJECT_DIRECTORY, route.page) && !PROJECT_DIRECTORY.some(item => item.children && item.key === route.page)
  if (route.scope !== 'global') return false
  const area = GLOBAL_DIRECTORY.find(item => item.key === route.area)
  return !!area && (area.children ? !!findDirectory(area.children, route.page) || route.area === 'ai' && route.page === 'assistant' : ['home', 'list', 'tasks', 'archived'].includes(route.page))
}
export const workspaceLocationKey = 'forgedesk:workspace-locations:v2'
export const workspaceLayoutKey = 'forgedesk:workspace-layout:v2'
