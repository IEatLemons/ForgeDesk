import { useState } from 'react'
import { Alert, Button, Card, Checkbox, Input, List, Modal, Select, Space, Spin, Tag, Typography } from 'antd'
import { LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { taskOverdue } from '../../shared/task-workspace'
import { TaskPersonBadge, taskDateLabel } from './task-workspace-controls'
import { TaskWorkspaceDetail, toggleWorkspaceTask } from './task-workspace-detail'
import { useTaskWorkspace } from './use-task-workspace'

type Props = {
  projectId: string
  entityId?: string
  onSelect: (id?: string) => void
  onOpenProject: (id: string) => void
}

export function ProjectTasksPanel({ projectId, entityId, onSelect, onOpenProject }: Props) {
  const { snapshot, error, loading, refresh, send } = useTaskWorkspace()
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState<string | null>(null)
  const [linkIds, setLinkIds] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  if (!snapshot) return error
    ? <Alert type="error" message={error} action={<Button onClick={() => void refresh()}>重试</Button>} />
    : loading ? <Spin /> : null

  const linked = snapshot.tasks.filter(task => task.projectIds.includes(projectId))
  const visible = linked.filter(task => task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const candidates = snapshot.tasks.filter(task => !task.projectIds.includes(projectId))
  const selected = snapshot.tasks.find(task => task.id === entityId) ?? null

  async function createTask() {
    if (!title?.trim() || busy) return
    setBusy(true)
    try {
      const id = await send({ type: 'save-task', input: { title, projectIds: [projectId] } })
      if (id) {
        setTitle(null)
        setQuery('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function linkTasks() {
    if (!linkIds?.length || busy) return
    const tasks = candidates.filter(task => linkIds.includes(task.id)).map(task => ({
      id: task.id,
      expectedVersion: task.rowVersion,
      patch: { projectIds: [...task.projectIds, projectId] }
    }))
    if (!tasks.length) {
      setLinkIds(null)
      return
    }
    setBusy(true)
    try {
      if (await send({ type: 'batch', tasks })) {
        setLinkIds(null)
        setQuery('')
      }
    } finally {
      setBusy(false)
    }
  }

  return <section>
    <div className="workspace-page-heading">
      <Typography.Title level={2}>关联任务</Typography.Title>
      <Space wrap>
        <Button icon={<LinkOutlined />} onClick={() => setLinkIds([])}>关联已有任务</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setTitle('')}>新建任务</Button>
      </Space>
    </div>
    {error ? <Alert type="error" message={error} /> : null}
    <Card>
      <Input.Search aria-label="搜索项目任务" placeholder="搜索任务" allowClear value={query}
        onChange={event => setQuery(event.target.value)} style={{ width: 280, maxWidth: '100%' }} />
      {title !== null ? <Input autoFocus aria-label="新建任务标题" placeholder="输入标题，回车确认"
        value={title} disabled={busy} style={{ marginBlock: 12 }}
        onChange={event => setTitle(event.target.value)} onPressEnter={() => void createTask()}
        onKeyDown={event => { if (event.key === 'Escape') setTitle(null) }} /> : null}
      <List dataSource={visible} rowKey="id" locale={{ emptyText: query ? '没有匹配的任务' : '暂无关联任务' }}
        renderItem={task => <List.Item extra={<Space>
          {taskOverdue(task) ? <Tag color="red">已逾期</Tag> : null}
          {task.dueDate ? <Typography.Text type="secondary">{taskDateLabel(task.dueDate)}</Typography.Text> : null}
          <TaskPersonBadge id={task.ownerId} snapshot={snapshot} />
        </Space>}>
          <Space>
            <Checkbox aria-label={`${task.done ? '重开' : '完成'}${task.title}`} checked={task.done}
              onChange={() => void toggleWorkspaceTask(task, snapshot)} />
            <Button type="link" onClick={() => onSelect(task.id)}><Typography.Text delete={task.done}>{task.title}</Typography.Text></Button>
          </Space>
        </List.Item>} />
    </Card>
    <Modal centered title="关联已有任务" open={linkIds !== null} onCancel={() => setLinkIds(null)} onOk={() => void linkTasks()}
      okText="关联" okButtonProps={{ disabled: !linkIds?.length }} confirmLoading={busy}>
      <Select mode="multiple" placement="topLeft" listHeight={176} aria-label="选择已有任务" placeholder="搜索或选择任务" optionFilterProp="label"
        style={{ width: '100%' }} value={linkIds ?? []} onChange={setLinkIds}
        options={candidates.map(task => ({ value: task.id, label: task.title }))} />
    </Modal>
    <TaskWorkspaceDetail task={selected} snapshot={snapshot} onClose={() => onSelect()} onSelect={onSelect} onOpenProject={onOpenProject} />
  </section>
}
