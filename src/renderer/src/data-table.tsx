import { Table as AntTable, Typography, type TableProps } from 'antd'
import type { TextProps } from 'antd/es/typography/Text'
import { getTableScrollWidth } from './data-table-layout'

export function DataTable<Row extends object>({ columns, scroll, tableLayout, className, ...props }: TableProps<Row>): JSX.Element {
  if (typeof scroll?.x !== 'number' || tableLayout === 'auto') {
    return <AntTable<Row> {...props} columns={columns} scroll={scroll} tableLayout={tableLayout} className={className} />
  }

  const selectionWidth = props.rowSelection ? props.rowSelection.columnWidth ?? 32 : 0
  const scrollWidth = getTableScrollWidth(scroll.x, columns, selectionWidth)

  return (
    <AntTable<Row>
      {...props}
      columns={columns}
      scroll={{ ...scroll, x: scrollWidth }}
      tableLayout="fixed"
      className={className ? `data-table-scroll ${className}` : 'data-table-scroll'}
    />
  )
}

export function TableText({ value, className, ...props }: Pick<TextProps, 'strong' | 'type' | 'className'> & { value: string }): JSX.Element {
  return (
    <Typography.Text {...props} className={className ? `table-text ${className}` : 'table-text'} ellipsis={{ tooltip: value }}>
      {value}
    </Typography.Text>
  )
}
