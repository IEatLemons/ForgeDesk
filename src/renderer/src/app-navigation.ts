import type { AppMode } from './app-mode'

export type AppNavigationKey =
  | 'overview'
  | 'tasks'
  | 'docs'
  | 'projects'
  | 'services'
  | 'data-sources'
  | 'docker'
  | 'tools'
  | 'system-monitor'
  | 'system-info'
  | 'codex-sessions'
  | 'ai-chat'
  | 'terminal'
  | 'settings'

export type AppNavigationSectionKey = 'home' | 'life' | 'study' | 'work' | 'computer' | 'system'

export type AppNavigationSection = {
  key: AppNavigationSectionKey
  label: string
  placement: 'main' | 'footer'
}

export type AppNavigationItem = {
  key: AppNavigationKey
  label: string
  section: AppNavigationSectionKey
}

export const APP_NAVIGATION_SECTIONS: AppNavigationSection[] = [
  { key: 'home', label: '今日', placement: 'main' },
  { key: 'system', label: '系统', placement: 'main' },
  { key: 'life', label: '生活', placement: 'main' },
  { key: 'study', label: '学习', placement: 'main' },
  { key: 'work', label: '工作', placement: 'main' },
  { key: 'computer', label: '电脑', placement: 'main' }
]

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  { key: 'overview', label: '总览', section: 'home' },
  { key: 'settings', label: '设置', section: 'system' },
  { key: 'tasks', label: '待办与安排', section: 'life' },
  { key: 'docs', label: '资料与文档', section: 'study' },
  { key: 'projects', label: '项目', section: 'work' },
  { key: 'services', label: '服务', section: 'work' },
  { key: 'data-sources', label: '数据源', section: 'work' },
  { key: 'docker', label: 'Docker', section: 'work' },
  { key: 'tools', label: '工具', section: 'work' },
  { key: 'system-monitor', label: '电脑监控', section: 'computer' },
  { key: 'system-info', label: '系统信息', section: 'computer' },
  { key: 'codex-sessions', label: 'Codex 会话', section: 'computer' },
  { key: 'ai-chat', label: 'AI 对话', section: 'computer' },
  { key: 'terminal', label: '命令行', section: 'computer' }
]

export function getNavigationItemsForMode(mode: AppMode): AppNavigationItem[] {
  if (mode === 'simple') {
    return APP_NAVIGATION_ITEMS.filter((item) => item.key === 'projects')
  }

  return APP_NAVIGATION_ITEMS
}

export function getNavigationSectionsForMode(mode: AppMode): AppNavigationSection[] {
  const visibleSections = new Set(getNavigationItemsForMode(mode).map((item) => item.section))
  return APP_NAVIGATION_SECTIONS.filter((section) => visibleSections.has(section.key))
}

export function isNavigationKeyVisible(mode: AppMode, key: AppNavigationKey): boolean {
  return getNavigationItemsForMode(mode).some((item) => item.key === key)
}
