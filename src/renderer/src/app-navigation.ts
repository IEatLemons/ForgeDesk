export type AppNavigationKey = 'overview' | 'services' | 'tools' | 'terminal' | 'settings'

export type AppNavigationItem = {
  key: AppNavigationKey
  label: string
}

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  { key: 'overview', label: '项目' },
  { key: 'services', label: '服务' },
  { key: 'tools', label: '工具' },
  { key: 'terminal', label: '命令行' },
  { key: 'settings', label: '设置' }
]
