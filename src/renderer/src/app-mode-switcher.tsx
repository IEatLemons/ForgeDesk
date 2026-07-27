import { Button, Dropdown } from 'antd'
import { DownOutlined, SwapOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { getAppModeLabel, type AppMode } from './app-mode'

export function AppModeSwitcher({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }): JSX.Element {
  const items: MenuProps['items'] = [
    { key: 'simple', label: '简洁版', disabled: mode === 'simple' },
    { key: 'full', label: '完整版', disabled: mode === 'full' }
  ]

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items,
        onClick: ({ key }) => onChange(key as AppMode)
      }}
    >
      <Button
        className="app-mode-switcher"
        size="small"
        icon={<SwapOutlined />}
        aria-label="切换版本"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {getAppModeLabel(mode)} <DownOutlined />
      </Button>
    </Dropdown>
  )
}
