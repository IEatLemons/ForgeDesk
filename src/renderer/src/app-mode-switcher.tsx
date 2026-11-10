import { Button, Dropdown } from 'antd'
import { DownOutlined, SwapOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { getAppModeLabel, type AppMode } from './app-mode'

export function AppModeSwitcher({ mode, onChange, compact = false }: { mode: AppMode; onChange: (mode: AppMode) => void; compact?: boolean }): JSX.Element {
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
        className={`app-mode-switcher${compact ? ' is-responsive' : ''}`}
        size="small"
        icon={<SwapOutlined />}
        aria-label={compact ? `切换版本：${getAppModeLabel(mode)}` : '切换版本'}
        title={compact ? `切换版本：${getAppModeLabel(mode)}` : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="app-mode-switcher-label">{getAppModeLabel(mode)}</span> <DownOutlined className="app-mode-switcher-arrow" />
      </Button>
    </Dropdown>
  )
}
