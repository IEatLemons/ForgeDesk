import { CheckCircleOutlined, CloudSyncOutlined, CodeOutlined, FolderOpenOutlined, MessageOutlined, PlayCircleOutlined, PlusOutlined, SendOutlined, StopOutlined } from '@ant-design/icons'
import { Button, Empty, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ManagedTask, ManagedTaskPlanItem, ManagedTaskStage } from './data'
import { resolveManagedTaskCodexThreadId } from './managed-task-view'
import { useForgeDeskStore } from './store'
import { readStoredTaskItems, writeStoredTaskItems } from './task-list-view'

const labels: Record<ManagedTaskStage, string> = {
  created: '已创建', planning: 'Codex 分析中', ready: '待确认执行', branching: '创建分支中', executing: '执行中', 'codex-complete': 'Codex 已完成', 'completed-no-changes': '已完成（无代码变更）', 'awaiting-review': '待审核', 'awaiting-commit': '待提交', 'awaiting-target': '待选择发布分支', merging: '合并中', merged: '已合并', pushing: '推送中', completed: '已完成', failed: '执行失败', cancelled: '已取消', 'needs-attention': '需处理', unassigned: '待关联项目'
}

function color(stage: ManagedTaskStage): string {
  if (['completed', 'completed-no-changes', 'merged'].includes(stage)) return 'success'
  if (['failed', 'needs-attention', 'unassigned'].includes(stage)) return 'error'
  if (['executing', 'planning', 'branching', 'merging', 'pushing'].includes(stage)) return 'processing'
  if (stage === 'awaiting-review' || stage === 'awaiting-commit' || stage === 'awaiting-target') return 'warning'
  return 'default'
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error) }

type ManagedTaskPanelProps = {
  onOpenCodexSession: (sessionId: string) => void
}

export function ManagedTaskPanel({ onOpenCodexSession }: ManagedTaskPanelProps): JSX.Element {
  const { projects, repositories, selectedProjectId } = useForgeDeskStore()
  const [tasks, setTasks] = useState<ManagedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [selected, setSelected] = useState<ManagedTask | null>(null)
  const [form] = Form.useForm<{ title: string; description: string; projectId: string; repositoryId: string; autoExecute: boolean }>()
  const [planText, setPlanText] = useState('')
  const [cancellingTaskIds, setCancellingTaskIds] = useState<Set<string>>(() => new Set())
  const migratedLegacyTasks = useRef(false)

  const visible = useMemo(() => tasks.filter((task) => projectFilter === 'all' || task.projectId === projectFilter), [projectFilter, tasks])
  const projectName = (projectId: string) => projects.find((project) => project.id === projectId)?.name || '待关联项目'
  const update = (task: ManagedTask) => {
    setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    setSelected((current) => current?.id === task.id ? task : current)
  }

  async function reload(sync = false): Promise<void> {
    if (!window.forgeDesk) return
    setLoading(true)
    try {
      if (!migratedLegacyTasks.current) {
        const legacyTasks = readStoredTaskItems()
        if (legacyTasks.length) {
          await window.forgeDesk.importLegacyManagedTasks(legacyTasks)
          writeStoredTaskItems([])
        }
        migratedLegacyTasks.current = true
      }
      if (sync) await window.forgeDesk.syncManagedTasks()
      setTasks(await window.forgeDesk.listManagedTasks())
    } catch (error) {
      message.error(errorText(error))
    } finally { setLoading(false) }
  }

  useEffect(() => { reload().catch(() => undefined) }, [])
  useEffect(() => {
    if (!window.forgeDesk) return undefined
    return window.forgeDesk.onManagedTaskEvent(update)
  }, [])
  useEffect(() => { if (selectedProjectId) setProjectFilter(selectedProjectId) }, [selectedProjectId])

  function openCreate(): void {
    const projectId = selectedProjectId || projects[0]?.id || ''
    const repository = repositories.filter((item) => item.projectId === projectId)[0]
    form.setFieldsValue({ title: '', description: '', projectId, repositoryId: repository?.id || '', autoExecute: false })
    setCreateOpen(true)
  }

  async function create(): Promise<void> {
    const values = await form.validateFields()
    const task = await window.forgeDesk.createManagedTask(values)
    update(task); setCreateOpen(false); message.success('任务已发布到 Codex，正在分析')
  }

  function openPlan(task: ManagedTask): void {
    setSelected(task)
    setPlanText(task.subtasks.map((item) => [item.title, item.description, item.acceptance].filter(Boolean).join('｜')).join('\n'))
    setPlanOpen(true)
  }

  async function savePlan(): Promise<void> {
    if (!selected) return
    const subtasks: ManagedTaskPlanItem[] = planText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [title, description = '', acceptance = ''] = line.split('｜').map((item) => item.trim())
      return { title, description, acceptance }
    })
    if (!subtasks.length) throw new Error('至少输入一个子任务')
    const task = await window.forgeDesk.saveManagedTaskPlan({ taskId: selected.id, subtasks })
    update(task); setPlanOpen(false); message.success('执行计划已确认')
    if (task.autoExecute) await execute(task)
  }

  async function execute(task: ManagedTask): Promise<void> {
    const repository = repositories.find((item) => item.id === task.repositoryId)
    const next = await window.forgeDesk.executeManagedTask({ taskId: task.id, baseBranch: repository?.defaultBranch || repository?.currentBranch })
    update(next)
  }

  async function commit(task: ManagedTask): Promise<void> {
    let commitMessage = ''
    Modal.confirm({ title: '提交任务代码', content: <Input autoFocus placeholder="请输入提交信息" onChange={(event) => { commitMessage = event.target.value }} />, okText: '提交并检测', cancelText: '取消', onOk: async () => update(await window.forgeDesk.commitManagedTask({ taskId: task.id, message: commitMessage })) })
  }

  async function publish(task: ManagedTask, targetBranch: 'develop' | 'preview'): Promise<void> {
    Modal.confirm({ title: `发布到 ${targetBranch}`, content: `将合并 ${task.branch} 并推送 ${targetBranch}。`, okText: '合并并推送', cancelText: '取消', onOk: async () => update(await window.forgeDesk.publishManagedTask({ taskId: task.id, targetBranch })) })
  }

  async function cancel(task: ManagedTask): Promise<void> {
    if (!window.forgeDesk) return
    setCancellingTaskIds((current) => new Set(current).add(task.id))
    try {
      update(await window.forgeDesk.cancelManagedTask(task.id))
      message.success('任务已终止，已保留执行记录和工作区改动')
    } catch (error) {
      message.error(`终止 Codex 任务失败：${errorText(error)}`)
      throw error
    } finally {
      setCancellingTaskIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
    }
  }

  function confirmCancel(task: ManagedTask): void {
    Modal.confirm({
      title: '终止任务？',
      content: '将中断该任务正在运行的 Codex 执行。已产生的文件和未提交改动不会自动回滚。',
      okText: '终止任务',
      okButtonProps: { danger: true },
      cancelText: '保留任务',
      onOk: () => cancel(task)
    })
  }

  function openCodexConversation(task: ManagedTask): void {
    const sessionId = resolveManagedTaskCodexThreadId(task)
    if (!sessionId) {
      message.info('这个任务尚未关联 Codex 对话')
      return
    }
    onOpenCodexSession(sessionId)
  }

  const columns: ColumnsType<ManagedTask> = [
    { title: '任务', dataIndex: 'title', render: (_, task) => <Space direction="vertical" size={0}><Typography.Text strong>{task.title}</Typography.Text><Typography.Text type="secondary">{task.subtasks.length ? `${task.subtasks.length} 个子任务` : '等待 Codex 拆分'} · {task.branch || '尚未创建分支'}</Typography.Text></Space> },
    { title: '项目', dataIndex: 'projectId', width: 180, render: (id) => <Tag icon={<FolderOpenOutlined />} color="blue">{projectName(id)}</Tag> },
    { title: '状态', dataIndex: 'stage', width: 160, render: (stage: ManagedTaskStage) => <Tag color={color(stage)}>{labels[stage]}</Tag> },
    { title: '更新', dataIndex: 'updatedAt', width: 160, render: (value) => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', width: 340, render: (_, task) => {
      const cancelling = cancellingTaskIds.has(task.id)
      const terminal = ['completed', 'completed-no-changes', 'failed', 'cancelled'].includes(task.stage)
      return <Space wrap>
        {['planning', 'ready'].includes(task.stage) ? <Button size="small" disabled={cancelling} onClick={() => openPlan(task)}>确认计划</Button> : null}
        {task.stage === 'ready' ? <Button size="small" type="primary" disabled={cancelling} icon={<PlayCircleOutlined />} onClick={() => execute(task)}>创建分支并执行</Button> : null}
        {task.stage === 'awaiting-review' ? <Button size="small" disabled={cancelling} icon={<CheckCircleOutlined />} onClick={() => window.forgeDesk.approveManagedTaskReview(task.id).then(update)}>审核通过</Button> : null}
        {task.stage === 'awaiting-commit' ? <Button size="small" disabled={cancelling} icon={<CodeOutlined />} onClick={() => commit(task)}>提交检测</Button> : null}
        {task.stage === 'awaiting-target' ? <><Button size="small" disabled={cancelling} onClick={() => publish(task, 'develop')}>发布 develop</Button><Button size="small" disabled={cancelling} onClick={() => publish(task, 'preview')}>发布 preview</Button></> : null}
        {!terminal ? <Button danger size="small" icon={<StopOutlined />} loading={cancelling} onClick={() => confirmCancel(task)}>终止</Button> : null}
        <Button size="small" disabled={cancelling} icon={<MessageOutlined />} onClick={() => openCodexConversation(task)}>查看 Codex 对话</Button>
      </Space>
    } }
  ]

  return <section className="workspace-section task-workspace">
    <div className="section-heading task-section-heading"><div><Typography.Title level={2}>统一任务</Typography.Title><Typography.Text type="secondary">与 Codex 原生线程、项目分支和交付状态保持同步。</Typography.Text></div><Space><Select value={projectFilter} onChange={setProjectFilter} style={{ minWidth: 180 }} options={[{ value: 'all', label: '全部项目' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} /><Button icon={<CloudSyncOutlined />} loading={loading} onClick={() => reload(true)}>同步 Codex</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建任务</Button></Space></div>
    <div className="panel task-list-panel"><Table rowKey="id" loading={loading} columns={columns} dataSource={visible} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="暂无统一任务" /> }} /></div>
    <Modal title="发布任务到 Codex" open={createOpen} okText="创建并分析" cancelText="取消" onOk={() => create().catch((error) => message.error(errorText(error)))} onCancel={() => setCreateOpen(false)}>
      <Form form={form} layout="vertical"><Form.Item label="任务" name="title" rules={[{ required: true, message: '请输入任务标题' }]}><Input /></Form.Item><Form.Item label="任务说明" name="description"><Input.TextArea rows={4} /></Form.Item><Form.Item label="项目" name="projectId" rules={[{ required: true, message: '必须关联项目' }]}><Select options={projects.map((project) => ({ value: project.id, label: project.name }))} onChange={(projectId) => form.setFieldValue('repositoryId', repositories.find((repository) => repository.projectId === projectId)?.id || '')} /></Form.Item><Form.Item label="仓库" name="repositoryId" rules={[{ required: true, message: '必须关联仓库' }]}><Select options={repositories.filter((repository) => repository.projectId === form.getFieldValue('projectId')).map((repository) => ({ value: repository.id, label: repository.name }))} /></Form.Item><Form.Item name="autoExecute" label="确认计划后自动执行" valuePropName="checked"><Switch /></Form.Item></Form>
    </Modal>
    <Modal title="确认 Codex 子任务计划" open={planOpen} okText="保存并可执行" cancelText="取消" onOk={() => savePlan().catch((error) => message.error(errorText(error)))} onCancel={() => setPlanOpen(false)}><Typography.Paragraph type="secondary">每行一个子任务，格式：任务｜说明｜验收标准。可根据 Codex 分析结果调整。</Typography.Paragraph><Input.TextArea rows={9} value={planText} onChange={(event) => setPlanText(event.target.value)} /></Modal>
  </section>
}
