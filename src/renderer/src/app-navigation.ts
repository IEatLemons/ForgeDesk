export type AppNavigationKey = 'overview' | 'services' | 'settings'

export type AppNavigationItem = {
  key: AppNavigationKey
  label: string
}

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  { key: 'overview', label: '项目' },
  { key: 'services', label: '服务' },
  { key: 'settings', label: '设置' }
]
