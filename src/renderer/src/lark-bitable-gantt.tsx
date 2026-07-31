import { Button, Empty, Tag, Typography } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import type { OaBitableRecord } from './data'
import { formatLarkBitableDate, type LarkBitableGanttRange } from './lark-bitable-view'

function getBarClass(status: string, priority: string): string {
  const value = `${status} ${priority}`.toLocaleLowerCase()
  if (/阻塞|延期|紧急|高|high|urgent|blocked|delayed/.test(value)) return 'is-danger'
  if (/完成|已结束|done|complete/.test(value)) return 'is-success'
  if (/中|medium|doing|进行/.test(value)) return 'is-warning'
  return 'is-primary'
}

function getMetaTag(value: string, fallback: string): JSX.Element | null {
  return value ? <Tag>{value}</Tag> : fallback ? <Tag color="default">{fallback}</Tag> : null
}

export function LarkBitableGantt({
  range,
  totalRows,
  onOpenRecord
}: {
  range: LarkBitableGanttRange
  totalRows: number
  onOpenRecord?: (record: OaBitableRecord) => void
}): JSX.Element {
  if (range.rows.length === 0) {
    return (
      <div className="oa-bitable-empty-gantt">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={totalRows > 0 ? '没有识别到有效的开始日期和结束日期' : '当前视图没有可展示的记录'} />
      </div>
    )
  }

  return (
    <div className="oa-bitable-gantt-panel">
      <div className="oa-bitable-gantt-header">
        <div className="oa-bitable-gantt-title">
          <Typography.Title level={4}>项目计划甘特图</Typography.Title>
          <Typography.Text type="secondary">
            {formatLarkBitableDate(range.startDate)} - {formatLarkBitableDate(range.endDate)} · {range.rows.length} 项任务
          </Typography.Text>
        </div>
        <div className="oa-bitable-gantt-scale" style={{ gridTemplateColumns: `repeat(${range.ticks.length}, minmax(72px, 1fr))` }}>
          {range.ticks.map((tick) => <span key={tick}>{formatLarkBitableDate(tick)}</span>)}
        </div>
      </div>
      <div className="oa-bitable-gantt-body">
        {range.rows.map((row) => {
          const left = `${(row.offsetDays / range.totalDays) * 100}%`
          const width = `${Math.min((row.durationDays / range.totalDays) * 100, 100)}%`
          return (
            <div className="oa-bitable-gantt-row" key={row.record.id}>
              <div className="oa-bitable-gantt-task">
                <div className="oa-bitable-gantt-task-copy">
                  <Typography.Text strong ellipsis={{ tooltip: row.title }}>{row.title}</Typography.Text>
                  <div className="oa-bitable-gantt-meta">
                    {getMetaTag(row.status, '未设置状态')}
                    {getMetaTag(row.priority, '')}
                    {row.owner ? <Typography.Text type="secondary">负责人：{row.owner}</Typography.Text> : null}
                  </div>
                </div>
              </div>
              <div className="oa-bitable-gantt-track">
                <div
                  className={`oa-bitable-gantt-bar ${getBarClass(row.status, row.priority)}`}
                  style={{ left, width }}
                  title={`${row.title} · ${row.startDate} - ${row.endDate}`}
                >
                  <span>{formatLarkBitableDate(row.startDate)} - {formatLarkBitableDate(row.endDate)}</span>
                </div>
              </div>
              <div className="oa-bitable-gantt-actions">
                {onOpenRecord ? <Button size="small" icon={<EditOutlined />} onClick={() => onOpenRecord(row.record)}>编辑</Button> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
