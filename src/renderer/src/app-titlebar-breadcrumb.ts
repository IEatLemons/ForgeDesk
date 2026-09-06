import { APP_NAVIGATION_ITEMS, type AppNavigationKey } from './app-navigation.js'

export const APP_TITLEBAR_PRODUCT_NAME = 'ForgeDesk'

export type AppTitlebarProjectLocation = {
  name: string
  tabLabel?: string
} | null

export function createAppTitlebarBreadcrumbs({
  activeKey,
  projectLocation = null,
  settingsModuleTitle
}: {
  activeKey: AppNavigationKey
  projectLocation?: AppTitlebarProjectLocation
  settingsModuleTitle?: string
}): string[] {
  if (activeKey === 'overview') {
    return [APP_TITLEBAR_PRODUCT_NAME]
  }

  if (activeKey === 'projects') {
    return projectLocation?.name
      ? [APP_TITLEBAR_PRODUCT_NAME, `项目：${projectLocation.name}`]
      : [APP_TITLEBAR_PRODUCT_NAME, '项目']
  }

  if (activeKey === 'settings') {
    return compactBreadcrumbs([APP_TITLEBAR_PRODUCT_NAME, '设置', settingsModuleTitle])
  }

  return compactBreadcrumbs([
    APP_TITLEBAR_PRODUCT_NAME,
    APP_NAVIGATION_ITEMS.find((item) => item.key === activeKey)?.label
  ])
}

function compactBreadcrumbs(items: Array<string | null | undefined>): string[] {
  return items.map((item) => item?.trim() ?? '').filter(Boolean)
}
