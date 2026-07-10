export type AppNavigationKey = 'overview' | 'tasks' | 'docs' | 'services' | 'docker' | 'tools' | 'terminal' | 'settings'

export type AppNavigationItem = {
  key: AppNavigationKey
  label: string
}

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  { key: 'overview', label: '项目' },
  { key: 'tasks', label: '任务' },
  { key: 'docs', label: '文档' },
  { key: 'services', label: '服务' },
  { key: 'docker', label: 'Docker' },
  { key: 'tools', label: '工具' },
  { key: 'terminal', label: '命令行' },
  { key: 'settings', label: '设置' }
]
