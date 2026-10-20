import { DatePicker } from 'antd'
import zhCN from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

type TaskDatePickerProps = {
  value?: string | null
  onChange?: (value: string | null) => void
  id?: string
  className?: string
  placeholder?: string
  showTime?: boolean
}

// Forms and persistence keep strings; only the calendar works with Dayjs values.
export function TaskDatePicker({ value, onChange, id, className, placeholder, showTime = false }: TaskDatePickerProps): JSX.Element {
  const parsed = value ? dayjs(value).locale('zh-cn') : null
  return (
    <DatePicker
      id={id}
      className={className}
      style={{ width: '100%' }}
      locale={zhCN}
      value={parsed?.isValid() ? parsed : null}
      format={showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
      placeholder={placeholder ?? (showTime ? '选择日期和时间' : '选择日期')}
      inputReadOnly
      allowClear
      showTime={showTime ? { format: 'HH:mm' } : false}
      presets={showTime ? [
        { label: '现在', value: () => dayjs().locale('zh-cn') }
      ] : [
        { label: '今天', value: () => dayjs().locale('zh-cn') },
        { label: '明天', value: () => dayjs().add(1, 'day').locale('zh-cn') },
        { label: '一周后', value: () => dayjs().add(7, 'day').locale('zh-cn') }
      ]}
      onChange={(date) => onChange?.(date ? (showTime ? date.toISOString() : date.format('YYYY-MM-DD')) : null)}
    />
  )
}
