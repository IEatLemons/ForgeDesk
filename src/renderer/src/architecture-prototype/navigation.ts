export type ProjectPage =
  | 'overview' | 'goals' | 'tasks' | 'milestones' | 'versions'
  | 'repositories' | 'contributions'
  | 'environments' | 'deployments' | 'monitoring' | 'domains'
  | 'settings-general' | 'settings-repositories' | 'settings-runtime' | 'settings-integrations'

export type TaskTab = 'overview' | 'children' | 'execution' | 'history'
export type GlobalArea = 'workbench' | 'projects' | 'ai' | 'resources' | 'toolbox' | 'settings'
export type GlobalPage =
  | 'home' | 'tasks' | 'activity' | 'conversations' | 'directories'
  | 'services' | 'data' | 'containers'
  | 'reading' | 'diagnostics' | 'development' | 'utilities'
  | 'appearance' | 'credentials' | 'integrations' | 'maintenance'

export type PrototypeRoute =
  | { scope: 'global'; area: GlobalArea; page: GlobalPage; projectFilter?: string; entityId?: string }
  | { scope: 'project'; projectId: string; page: ProjectPage; entityId?: string; taskTab?: TaskTab }

export type PrototypeGlobalRoute = Extract<PrototypeRoute, { scope: 'global' }>
export type PrototypeProjectRoute = Extract<PrototypeRoute, { scope: 'project' }>

export type NavigationLeaf<T extends string> = { key: T; label: string }
export type NavigationGroup = { key: string; label: string; children: NavigationLeaf<ProjectPage>[] }

export const PROJECT_GROUPS: NavigationGroup[] = [
  { key: 'progress', label: '进度', children: [
    { key: 'goals', label: '目标' }, { key: 'tasks', label: '任务' },
    { key: 'milestones', label: '里程碑' }, { key: 'versions', label: '版本计划' }
  ] },
  { key: 'code', label: '代码', children: [
    { key: 'repositories', label: '仓库' }, { key: 'contributions', label: '提交分析' }
  ] },
  { key: 'runtime', label: '运行', children: [
    { key: 'environments', label: '环境与服务' }, { key: 'deployments', label: '部署与发布' },
    { key: 'monitoring', label: '日志与监控' }, { key: 'domains', label: '域名' }
  ] },
  { key: 'project-settings', label: '项目设置', children: [
    { key: 'settings-general', label: '基本信息与人员' }, { key: 'settings-repositories', label: '仓库设置' },
    { key: 'settings-runtime', label: '运行配置' }, { key: 'settings-integrations', label: '外部绑定' }
  ] }
]

export const GLOBAL_AREAS: { key: GlobalArea; label: string; placement: 'main' | 'footer'; children: NavigationLeaf<GlobalPage>[] }[] = [
  { key: 'workbench', label: '工作台', placement: 'main', children: [] },
  { key: 'projects', label: '项目', placement: 'main', children: [] },
  { key: 'ai', label: 'AI 工作台', placement: 'main', children: [
    { key: 'activity', label: '运行动态' }, { key: 'conversations', label: '会话' }, { key: 'directories', label: '工作目录' }
  ] },
  { key: 'resources', label: '共享资源', placement: 'footer', children: [
    { key: 'services', label: '服务与部署总览' }, { key: 'data', label: '数据库与存储' }, { key: 'containers', label: '本机容器' }
  ] },
  { key: 'toolbox', label: '工具箱', placement: 'footer', children: [
    { key: 'reading', label: '资料资讯' }, { key: 'diagnostics', label: '本机诊断' },
    { key: 'development', label: '开发辅助' }, { key: 'utilities', label: '安全与数据工具' }
  ] },
  { key: 'settings', label: '设置', placement: 'footer', children: [
    { key: 'appearance', label: '界面与系统' }, { key: 'credentials', label: '身份凭据' },
    { key: 'integrations', label: '外部集成' }, { key: 'maintenance', label: '数据与维护' }
  ] }
]

export function globalRoute(area: GlobalArea, page?: GlobalPage): PrototypeGlobalRoute {
  return { scope: 'global', area, page: page ?? GLOBAL_AREAS.find(item => item.key === area)?.children[0]?.key ?? 'home' }
}

export function projectRoute(projectId: string, page: ProjectPage = 'overview', entityId?: string): PrototypeProjectRoute {
  return { scope: 'project', projectId, page, ...(entityId ? { entityId } : {}) }
}

export function getProjectGroup(page: ProjectPage): NavigationGroup | undefined {
  return PROJECT_GROUPS.find(group => group.children.some(item => item.key === page))
}

export function getPageLabel(route: PrototypeRoute): string {
  if (route.scope === 'project') return route.page === 'overview' ? '项目概览' : getProjectGroup(route.page)?.children.find(item => item.key === route.page)?.label ?? '项目概览'
  if (route.page === 'tasks' && route.area === 'workbench') return '跨项目待办'
  const area = GLOBAL_AREAS.find(item => item.key === route.area)!
  return area.children.find(item => item.key === route.page)?.label ?? area.label
}

export type PrototypeNavigation = {
  entries: PrototypeRoute[]
  index: number
  projectLocations: Record<string, PrototypeRoute>
}

export function createNavigation(route: PrototypeRoute = globalRoute('workbench')): PrototypeNavigation {
  return { entries: [route], index: 0, projectLocations: route.scope === 'project' ? { [route.projectId]: route } : {} }
}

export function currentRoute(state: PrototypeNavigation): PrototypeRoute {
  return state.entries[state.index]
}

// Detail tabs are navigation within the same object, not a new return destination.
export function contextOrigin(state: PrototypeNavigation): PrototypeRoute | undefined {
  const current = currentRoute(state)
  for (let index = state.index - 1; index >= 0; index--) {
    const previous = state.entries[index]
    const sameTask = current.scope === 'project' && previous.scope === 'project' && current.page === 'tasks' && previous.page === 'tasks' && !!current.entityId && current.entityId === previous.entityId && current.projectId === previous.projectId
    const sameConversation = current.scope === 'global' && previous.scope === 'global' && current.area === 'ai' && previous.area === 'ai' && current.page === 'conversations' && previous.page === 'conversations' && !!current.entityId && current.entityId === previous.entityId
    if (!sameTask && !sameConversation) return previous
  }
  return undefined
}

function rememberProject(state: PrototypeNavigation, route: PrototypeRoute): PrototypeNavigation {
  return route.scope === 'project' ? { ...state, projectLocations: { ...state.projectLocations, [route.projectId]: route } } : state
}

export function navigate(state: PrototypeNavigation, route: PrototypeRoute): PrototypeNavigation {
  if (routeToHash(currentRoute(state)) === routeToHash(route)) return state
  return rememberProject({ ...state, entries: [...state.entries.slice(0, state.index + 1), route], index: state.index + 1 }, route)
}

export function enterProject(state: PrototypeNavigation, projectId: string): PrototypeNavigation {
  return navigate(state, state.projectLocations[projectId] ?? projectRoute(projectId))
}

export function moveHistory(state: PrototypeNavigation, index: number): PrototypeNavigation {
  if (!Number.isInteger(index) || index < 0 || index >= state.entries.length) return state
  return rememberProject({ ...state, index }, state.entries[index])
}

export function routeToHash(route: PrototypeRoute): string {
  const params = new URLSearchParams()
  if (route.entityId) params.set('item', route.entityId)
  if (route.scope === 'project' && route.taskTab) params.set('tab', route.taskTab)
  if (route.scope === 'global' && route.projectFilter) params.set('project', route.projectFilter)
  const base = route.scope === 'project' ? `project/${encodeURIComponent(route.projectId)}/${route.page}` : `${route.area}/${route.page}`
  return `#/${base}${params.size ? `?${params}` : ''}`
}

export function routeFromHash(hash: string): PrototypeRoute | undefined {
  try {
    const [path, search] = hash.replace(/^#\/?/, '').split('?')
    const segments = path.split('/')
    const params = new URLSearchParams(search)
    const entityId = params.get('item') || undefined
    if (segments[0] === 'project' && segments.length === 3) {
      const page = segments[2] as ProjectPage
      if (!segments[1] || (page !== 'overview' && !getProjectGroup(page))) return undefined
      const taskTab = params.get('tab')
      if (taskTab && !['overview', 'children', 'execution', 'history'].includes(taskTab)) return undefined
      return { scope: 'project', projectId: decodeURIComponent(segments[1]), page, entityId, ...(page === 'tasks' && taskTab ? { taskTab: taskTab as TaskTab } : {}) }
    }
    if (segments.length !== 2) return undefined
    const area = GLOBAL_AREAS.find(item => item.key === segments[0])
    if (!area) return undefined
    const page = segments[1] as GlobalPage
    const valid = area.children.length ? area.children.some(item => item.key === page) : page === 'home' || (area.key === 'workbench' && page === 'tasks')
    return valid ? { scope: 'global', area: area.key, page, entityId, projectFilter: params.get('project') || undefined } : undefined
  } catch {
    return undefined
  }
}
