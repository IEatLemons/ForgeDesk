import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

type ModuleBackButtonProps = {
  label: string
  onClick: () => void
}

export function ModuleBackButton({ label, onClick }: ModuleBackButtonProps): JSX.Element {
  return (
    <Button className="module-back-button" icon={<ArrowLeftOutlined />} onClick={onClick} aria-label={label}>
      {label}
    </Button>
  )
}
