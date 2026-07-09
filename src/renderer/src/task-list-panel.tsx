import {
  Badge,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import { useMemo, useState } from 'react'
import type { Project } from './data'
import { useForgeDeskStore } from './store'
import {
  createTaskGanttRange,
  createTask,
  defaultTaskFilterState,
  filterTaskItems,
  formatTaskLocalDate,
  getTaskStats,
  getTaskTags,
  groupTasksByStatus,
  isTaskOverdue,
  readStoredTaskItems,
  unassignedTaskProjectFilterValue,
  writeStoredTaskItems,
  type TaskFilterState,
  type TaskGanttRange,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type TaskViewMode
} from './task-list-view'

type TaskFormValues = {
  title: string
  notes?: string
  status: TaskStatus
  priority: TaskPriority
  projectId?: string
  startDate?: string
  dueDate?: string
  tags?: string[]
}

const unassignedTaskProjectValue = unassignedTaskProjectFilterValue

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成'
}

const taskPriorityLabels: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高'
}

const taskStatusColors: Record<TaskStatus, string> = {
  todo: 'default',
  doing: 'processing',
  done: 'success'
}

const taskPriorityColors: Record<TaskPriority, string> = {
  low: 'blue',
  medium: 'gold',
  high: 'red'
}

const taskViewOptions: Array<{ label: JSX.Element; value: TaskViewMode }> = [
  {
    label: (
      <Tooltip title="列表">
        <UnorderedListOutlined />
      </Tooltip>
    ),
    value: 'list'
  },
  {
    label: (
      <Tooltip title="看板">
        <AppstoreOutlined />
      </Tooltip>
    ),
    value: 'board'
  },
  {
    label: (
      <Tooltip title="甘特图">
        <BarChartOutlined />
      </Tooltip>
    ),
    value: 'gantt'
  }
]

function formatTaskDate(value: string | null): string {
  if (!value) {
    return '未设置'
  }

  const timestamp = new Date(`${value}T00:00:00`)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatTaskTimestamp(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getProjectName(projects: Project[], projectId: string | null): string {
  if (!projectId) {
    return '未关联项目'
  }

  return projects.find((project) => project.id === projectId)?.name ?? '未知项目'
}

function ProjectTag({ projectId, projects }: { projectId: string | null; projects: Project[] }): JSX.Element {
  if (!projectId) {
    return <Tag>未关联项目</Tag>
  }

  return (
    <Tag icon={<FolderOpenOutlined />} color="blue">
      {getProjectName(projects, projectId)}
    </Tag>
  )
}

function getDueTag(task: TaskItem): JSX.Element {
  if (!task.dueDate) {
    return <Tag>无截止</Tag>
  }

  if (isTaskOverdue(task)) {
    return <Tag color="error">{formatTaskDate(task.dueDate)}</Tag>
  }

  return <Tag icon={<CalendarOutlined />}>{formatTaskDate(task.dueDate)}</Tag>
}

function createNextTaskStatus(status: TaskStatus): TaskStatus {
  if (status === 'todo') {
    return 'doing'
  }

  if (status === 'doing') {
    return 'done'
  }

  return 'todo'
}

function TaskStatusTag({ status }: { status: TaskStatus }): JSX.Element {
  return <Tag color={taskStatusColors[status]}>{taskStatusLabels[status]}</Tag>
}

function TaskPriorityTag({ priority }: { priority: TaskPriority }): JSX.Element {
  return <Tag color={taskPriorityColors[priority]}>{taskPriorityLabels[priority]}优先级</Tag>
}

function TaskCard({
  task,
  projects,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleDone
}: {
  task: TaskItem
  projects: Project[]
  onEdit: (task: TaskItem) => void
  onDelete: (taskId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onToggleDone: (taskId: string) => void
}): JSX.Element {
  const nextStatus = createNextTaskStatus(task.status)

  return (
    <article className={`task-card ${task.status === 'done' ? 'is-done' : ''}`}>
      <div className="task-card-heading">
        <Checkbox checked={task.status === 'done'} onChange={() => onToggleDone(task.id)} />
        <div className="task-card-title">
          <Typography.Text strong delete={task.status === 'done'}>
            {task.title}
          </Typography.Text>
          {task.notes ? <Typography.Text type="secondary">{task.notes}</Typography.Text> : null}
        </div>
      </div>
      <div className="task-meta-row">
        <ProjectTag projectId={task.projectId} projects={projects} />
        <TaskPriorityTag priority={task.priority} />
        {getDueTag(task)}
      </div>
      {task.tags.length > 0 ? (
        <div className="task-tag-row">
          {task.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}
      <div className="task-card-actions">
        <Button size="small" icon={<ClockCircleOutlined />} onClick={() => onStatusChange(task.id, nextStatus)}>
          {taskStatusLabels[nextStatus]}
        </Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(task)} />
        <Popconfirm title="删除这个任务？" okText="删除" cancelText="取消" onConfirm={() => onDelete(task.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </div>
    </article>
  )
}

function TaskGanttView({
  range,
  projects,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleDone
}: {
  range: TaskGanttRange
  projects: Project[]
  onEdit: (task: TaskItem) => void
  onDelete: (taskId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onToggleDone: (taskId: string) => void
}): JSX.Element {
  if (range.rows.length === 0) {
    return (
      <div className="panel task-empty-panel">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的任务" />
      </div>
    )
  }

  return (
    <div className="panel task-gantt-panel">
      <div className="task-gantt-header">
        <div className="task-gantt-title">
          <Typography.Title level={4}>甘特图</Typography.Title>
          <Typography.Text type="secondary">
            {formatTaskDate(range.startDate)} - {formatTaskDate(range.endDate)}
          </Typography.Text>
        </div>
        <div className="task-gantt-scale" style={{ gridTemplateColumns: `repeat(${range.ticks.length}, minmax(72px, 1fr))` }}>
          {range.ticks.map((tick) => (
            <span key={tick}>{formatTaskDate(tick)}</span>
          ))}
        </div>
      </div>
      <div className="task-gantt-body">
        {range.rows.map((row) => {
          const left = `${(row.offsetDays / range.totalDays) * 100}%`
          const width = `${(row.durationDays / range.totalDays) * 100}%`
          const nextStatus = createNextTaskStatus(row.task.status)

          return (
            <div className="task-gantt-row" key={row.task.id}>
              <div className="task-gantt-task">
                <Checkbox checked={row.task.status === 'done'} onChange={() => onToggleDone(row.task.id)} />
                <div className="task-gantt-task-copy">
                  <Typography.Text strong delete={row.task.status === 'done'}>
                    {row.task.title}
                  </Typography.Text>
                  <div className="task-meta-row">
                    <ProjectTag projectId={row.task.projectId} projects={projects} />
                    <TaskStatusTag status={row.task.status} />
                    <TaskPriorityTag priority={row.task.priority} />
                  </div>
                </div>
              </div>
              <div className="task-gantt-track">
                <div className={`task-gantt-bar task-gantt-bar-${row.task.priority}`} style={{ left, width }} title={`${row.startDate} - ${row.endDate}`}>
                  <span>{formatTaskDate(row.startDate)} - {formatTaskDate(row.endDate)}</span>
                </div>
              </div>
              <div className="task-gantt-actions">
                <Button size="small" icon={<ClockCircleOutlined />} onClick={() => onStatusChange(row.task.id, nextStatus)}>
                  {taskStatusLabels[nextStatus]}
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row.task)} />
                <Popconfirm title="删除这个任务？" okText="删除" cancelText="取消" onConfirm={() => onDelete(row.task.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TaskListPanel(): JSX.Element {
  const [form] = Form.useForm<TaskFormValues>()
  const { projects } = useForgeDeskStore()
  const [tasks, setTasks] = useState<TaskItem[]>(() => readStoredTaskItems())
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilterState)
  const [viewMode, setViewMode] = useState<TaskViewMode>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const stats = useMemo(() => getTaskStats(tasks), [tasks])
  const visibleTasks = useMemo(() => filterTaskItems(tasks, filters), [filters, tasks])
  const taskTags = useMemo(() => getTaskTags(tasks), [tasks])
  const boardGroups = useMemo(() => groupTasksByStatus(visibleTasks), [visibleTasks])
  const ganttRange = useMemo(() => createTaskGanttRange(visibleTasks), [visibleTasks])
  const projectFilterOptions = useMemo(
    () => [
      { label: '全部项目', value: 'all' },
      { label: '未关联项目', value: unassignedTaskProjectValue },
      ...projects.map((project) => ({ label: project.name, value: project.id }))
    ],
    [projects]
  )
  const projectFormOptions = useMemo(
    () => [{ label: '未关联项目', value: unassignedTaskProjectValue }, ...projects.map((project) => ({ label: project.name, value: project.id }))],
    [projects]
  )
  const completionPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  function commitTasks(updater: (currentTasks: TaskItem[]) => TaskItem[]): void {
    setTasks((currentTasks) => {
      const nextTasks = updater(currentTasks)
      writeStoredTaskItems(nextTasks)
      return nextTasks
    })
  }

  function openTaskModal(task?: TaskItem): void {
    setEditingTask(task ?? null)
    form.setFieldsValue(
      task
        ? {
            title: task.title,
            notes: task.notes,
            status: task.status,
            priority: task.priority,
            projectId: task.projectId ?? unassignedTaskProjectValue,
            startDate: task.startDate ?? '',
            dueDate: task.dueDate ?? '',
            tags: task.tags
          }
        : {
            title: '',
            notes: '',
            status: 'todo',
            priority: 'medium',
            projectId: unassignedTaskProjectValue,
            startDate: formatTaskLocalDate(new Date()),
            dueDate: '',
            tags: []
          }
    )
    setModalOpen(true)
  }

  function closeTaskModal(): void {
    setModalOpen(false)
    setEditingTask(null)
    form.resetFields()
  }

  async function saveTask(): Promise<void> {
    const values = await form.validateFields()
    const now = new Date()
    const projectId = values.projectId && values.projectId !== unassignedTaskProjectValue ? values.projectId : null
    const startDate = values.startDate || null
    const dueDate = values.dueDate || null

    commitTasks((currentTasks) => {
      if (editingTask) {
        return currentTasks.map((task) =>
          task.id === editingTask.id
            ? {
                ...task,
                title: values.title.trim(),
                notes: values.notes?.trim() ?? '',
                status: values.status,
                priority: values.priority,
                projectId,
                startDate,
                dueDate,
                tags: values.tags ?? [],
                updatedAt: now.toISOString(),
                completedAt: values.status === 'done' ? task.completedAt ?? now.toISOString() : null
              }
            : task
        )
      }

      return [
        createTask(
          {
            title: values.title,
            notes: values.notes,
            status: values.status,
            priority: values.priority,
            projectId,
            startDate,
            dueDate,
            tags: values.tags
          },
          now
        ),
        ...currentTasks
      ]
    })

    message.success(editingTask ? '任务已更新' : '任务已创建')
    closeTaskModal()
  }

  function updateTaskStatus(taskId: string, status: TaskStatus): void {
    const now = new Date().toISOString()

    commitTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updatedAt: now,
              completedAt: status === 'done' ? task.completedAt ?? now : null
            }
          : task
      )
    )
  }

  function toggleTaskDone(taskId: string): void {
    const task = tasks.find((item) => item.id === taskId)

    if (!task) {
      return
    }

    updateTaskStatus(taskId, task.status === 'done' ? 'todo' : 'done')
  }

  function deleteTask(taskId: string): void {
    commitTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))
    message.success('任务已删除')
  }

  const columns: ColumnsType<TaskItem> = [
    {
      title: '任务',
      dataIndex: 'title',
      render: (_, task) => (
        <div className="task-title-cell">
          <Checkbox checked={task.status === 'done'} onChange={() => toggleTaskDone(task.id)} />
          <div className="task-title-copy">
            <Typography.Text strong delete={task.status === 'done'}>
              {task.title}
            </Typography.Text>
            {task.notes ? <Typography.Text type="secondary">{task.notes}</Typography.Text> : null}
            <div className="task-meta-row">
              <ProjectTag projectId={task.projectId} projects={projects} />
              {task.startDate ? <Tag icon={<CalendarOutlined />}>开始 {formatTaskDate(task.startDate)}</Tag> : null}
            </div>
            {task.tags.length > 0 ? (
              <div className="task-tag-row">
                {task.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )
    },
    {
      title: '项目',
      dataIndex: 'projectId',
      width: 150,
      render: (projectId: string | null) => <ProjectTag projectId={projectId} projects={projects} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 112,
      render: (status: TaskStatus) => <TaskStatusTag status={status} />
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 120,
      render: (priority: TaskPriority) => <TaskPriorityTag priority={priority} />
    },
    {
      title: '截止',
      dataIndex: 'dueDate',
      width: 128,
      render: (_, task) => getDueTag(task)
    },
    {
      title: '更新',
      dataIndex: 'updatedAt',
      width: 132,
      render: (value: string) => <Typography.Text type="secondary">{formatTaskTimestamp(value)}</Typography.Text>
    },
    {
      title: '',
      key: 'actions',
      width: 152,
      render: (_, task) => (
        <Space size={4}>
          <Button size="small" icon={<ClockCircleOutlined />} onClick={() => updateTaskStatus(task.id, createNextTaskStatus(task.status))}>
            {taskStatusLabels[createNextTaskStatus(task.status)]}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openTaskModal(task)} />
          <Popconfirm title="删除这个任务？" okText="删除" cancelText="取消" onConfirm={() => deleteTask(task.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <section className="workspace-section task-workspace">
      <div className="section-heading task-section-heading">
        <div>
          <Typography.Title level={2}>任务</Typography.Title>
          <Typography.Text type="secondary">安排待办、进行中的事项和已完成记录。</Typography.Text>
        </div>
        <Space wrap>
          <Segmented value={viewMode} options={taskViewOptions} onChange={(value) => setViewMode(value as TaskViewMode)} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>
            新建任务
          </Button>
        </Space>
      </div>

      <div className="task-stat-grid">
        <div className="metric-tile task-metric">
          <Typography.Text type="secondary">总任务</Typography.Text>
          <Typography.Title level={3}>{stats.total}</Typography.Title>
        </div>
        <div className="metric-tile task-metric">
          <Typography.Text type="secondary">进行中</Typography.Text>
          <Typography.Title level={3}>{stats.doing}</Typography.Title>
        </div>
        <div className="metric-tile task-metric">
          <Typography.Text type="secondary">今天截止</Typography.Text>
          <Typography.Title level={3}>{stats.dueToday}</Typography.Title>
        </div>
        <div className="metric-tile task-metric task-progress-metric">
          <div>
            <Typography.Text type="secondary">完成度</Typography.Text>
            <Typography.Title level={3}>{completionPercent}%</Typography.Title>
          </div>
          <Progress type="circle" size={56} percent={completionPercent} />
        </div>
      </div>

      <div className="panel task-filter-panel">
        <div className="task-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索任务、备注或标签"
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          />
          <Select
            value={filters.status}
            onChange={(status) => setFilters((current) => ({ ...current, status }))}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '待办', value: 'todo' },
              { label: '进行中', value: 'doing' },
              { label: '已完成', value: 'done' }
            ]}
          />
          <Select value={filters.projectId} onChange={(projectId) => setFilters((current) => ({ ...current, projectId }))} options={projectFilterOptions} />
          <Select
            value={filters.priority}
            onChange={(priority) => setFilters((current) => ({ ...current, priority }))}
            options={[
              { label: '全部优先级', value: 'all' },
              { label: '高优先级', value: 'high' },
              { label: '中优先级', value: 'medium' },
              { label: '低优先级', value: 'low' }
            ]}
          />
          <Select
            value={filters.due}
            onChange={(due) => setFilters((current) => ({ ...current, due }))}
            options={[
              { label: '全部日期', value: 'all' },
              { label: '已逾期', value: 'overdue' },
              { label: '今天', value: 'today' },
              { label: '未来 7 天', value: 'week' },
              { label: '无截止', value: 'none' }
            ]}
          />
          <Select
            value={filters.tag}
            onChange={(tag) => setFilters((current) => ({ ...current, tag }))}
            options={[{ label: '全部标签', value: 'all' }, ...taskTags.map((tag) => ({ label: tag, value: tag }))]}
          />
          <Select
            value={filters.sort}
            onChange={(sort) => setFilters((current) => ({ ...current, sort }))}
            options={[
              { label: '按更新排序', value: 'updated' },
              { label: '按截止排序', value: 'due' },
              { label: '按优先级排序', value: 'priority' },
              { label: '按创建排序', value: 'created' }
            ]}
          />
        </div>
      </div>

      {stats.overdue > 0 ? (
        <div className="task-overdue-strip">
          <Badge status="error" />
          <Typography.Text>{stats.overdue} 个任务已逾期</Typography.Text>
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <div className="panel task-list-panel">
          <Table<TaskItem>
            rowKey="id"
            columns={columns}
            dataSource={visibleTasks}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的任务" /> }}
          />
        </div>
      ) : null}

      {viewMode === 'board' ? (
        <div className="task-board-grid">
          {(['todo', 'doing', 'done'] as TaskStatus[]).map((status) => (
            <section className="task-board-column" key={status}>
              <div className="task-board-header">
                <Space>
                  {status === 'done' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                  <Typography.Title level={4}>{taskStatusLabels[status]}</Typography.Title>
                </Space>
                <Badge count={boardGroups[status].length} style={{ backgroundColor: 'var(--primary)' }} />
              </div>
              <div className="task-board-list">
                {boardGroups[status].length > 0 ? (
                  boardGroups[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      projects={projects}
                      onEdit={openTaskModal}
                      onDelete={deleteTask}
                      onStatusChange={updateTaskStatus}
                      onToggleDone={toggleTaskDone}
                    />
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务" />
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {viewMode === 'gantt' ? (
        <TaskGanttView
          range={ganttRange}
          projects={projects}
          onEdit={openTaskModal}
          onDelete={deleteTask}
          onStatusChange={updateTaskStatus}
          onToggleDone={toggleTaskDone}
        />
      ) : null}

      <Modal
        title={editingTask ? '编辑任务' : '新建任务'}
        open={modalOpen}
        okText="保存"
        cancelText="取消"
        onOk={() => saveTask().catch((error) => message.error(error instanceof Error ? error.message : '保存失败'))}
        onCancel={closeTaskModal}
      >
        <Form form={form} layout="vertical" className="task-form">
          <Form.Item name="title" label="任务" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input placeholder="例如：检查发布清单" />
          </Form.Item>
          <div className="task-form-grid">
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: '待办', value: 'todo' },
                  { label: '进行中', value: 'doing' },
                  { label: '已完成', value: 'done' }
                ]}
              />
            </Form.Item>
            <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: '高', value: 'high' },
                  { label: '中', value: 'medium' },
                  { label: '低', value: 'low' }
                ]}
              />
            </Form.Item>
            <Form.Item name="projectId" label="项目">
              <Select options={projectFormOptions} />
            </Form.Item>
            <Form.Item name="startDate" label="开始日期">
              <Input className="task-date-picker" type="date" />
            </Form.Item>
            <Form.Item name="dueDate" label="截止日期">
              <Input className="task-date-picker" type="date" />
            </Form.Item>
            <Form.Item name="tags" label="标签">
              <Select mode="tags" placeholder="输入后回车" tokenSeparators={[',', '，']} options={taskTags.map((tag) => ({ label: tag, value: tag }))} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={4} placeholder="补充上下文、验收点或链接" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
