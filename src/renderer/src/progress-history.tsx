import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Empty, List, Space, Typography } from 'antd'
import type { ProgressEvent, ProgressObject } from '../../shared/project-progress'
import { progressEventLabels } from './project-progress-view'

export function ProgressHistory({ object, projectId }: { object: ProgressObject; projectId?: string | null }): JSX.Element {
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  async function read(next?: string, revision = generation.current): Promise<void> {
    setLoading(true); setError('')
    try {
      const page = await window.forgeDesk.getProjectProgressHistory({ object, projectId, cursor: next })
      if (revision !== generation.current) return
      setEvents(previous => next ? [...previous, ...page.events] : page.events); setCursor(page.nextCursor)
    } catch (error) { if (revision === generation.current) setError(error instanceof Error ? error.message : String(error)) }
    finally { if (revision === generation.current) setLoading(false) }
  }
  useEffect(() => { const revision = ++generation.current; setEvents([]); setCursor(null); void read(undefined, revision); return () => { generation.current++ } }, [object.id, object.kind, projectId])
  return <section aria-label="对象变更历史">
    {error ? <Alert type="error" message={error} action={<Button onClick={() => void read()}>重试</Button>} /> : null}
    <List loading={loading} dataSource={events} locale={{ emptyText: <Empty description="暂无变更记录" /> }} renderItem={event => <List.Item><Space direction="vertical" style={{ width: '100%' }}>
      <Typography.Text>{progressEventLabels[event.eventType] || event.eventType} · {new Date(event.occurredAt).toLocaleString()}</Typography.Text>
      <details><summary>查看依据与变更</summary><pre className="progress-event-detail">{JSON.stringify({ before: event.before, after: event.after }, null, 2)}</pre></details>
    </Space></List.Item>} />
    {cursor ? <Button loading={loading} onClick={() => void read(cursor)}>加载更早记录</Button> : null}
  </section>
}
