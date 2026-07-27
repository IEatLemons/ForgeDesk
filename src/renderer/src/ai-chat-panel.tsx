import {
  BranchesOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  CodeOutlined,
  FileImageOutlined,
  DeleteOutlined,
  EditOutlined,
  LaptopOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined
} from '@ant-design/icons'
import { Badge, Button, Dropdown, Empty, Input, Layout, Modal, Popconfirm, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { AiRuntimeStatus, CodexTaskRecord } from './data'
import { getErrorMessage } from './error-messages'
import { ModuleBackButton } from './module-navigation'
import { useForgeDeskStore } from './store'
import { AI_CODING_ASSISTANT_NAME } from './ai-coding-assistant'
import {
  codexTaskStatusLabels,
  createCodexTaskTitle,
  formatCodexChangeStat,
  getCodexTaskStatusTone,
  groupCodexTasks,
  removeCodexTask,
  upsertCodexTask,
  type AiChatContextKind
} from './ai-chat-view'

type AiChatPanelProps = {
  onBack: () => void
  onOpenAiSettings: () => void
  usesCustomTitleBar: boolean
}

type AiChatContextOption = {
  kind: AiChatContextKind
  label: string
  path?: string
  projectId?: string
  value: string
}

function createHomeContextOption(): AiChatContextOption {
  return {
    kind: 'home',
    label: '本地',
    value: 'home'
  }
}

function getRuntimeStatusLabel(status: AiRuntimeStatus | null): string {
  if (!status) return '检测中'
  if (!status.available) return '未检测到'
  if (status.usable === true) return '已验证'
  if (status.usable === false) return '需处理'
  return '已检测到'
}

function getRuntimeStatus(status: AiRuntimeStatus | null): 'default' | 'processing' | 'success' | 'error' | 'warning' {
  if (!status) return 'processing'
  if (!status.available) return 'error'
  if (status.usable === false) return 'warning'
  if (status.usable === true) return 'success'
  return 'processing'
}

function formatTaskTime(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getProjectFallbackPath(tasks: CodexTaskRecord[], fallback?: string): string | undefined {
  return fallback || tasks[0]?.cwd
}

export function AiChatPanel({ onBack, onOpenAiSettings, usesCustomTitleBar }: AiChatPanelProps): JSX.Element {
  const { projects, selectedProjectId, setSelectedProjectId } = useForgeDeskStore()
  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus | null>(null)
  const [tasks, setTasks] = useState<CodexTaskRecord[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [draft, setDraft] = useState('')
  const [imageAttachments, setImageAttachments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [checkingRuntime, setCheckingRuntime] = useState(false)
  const [renameTaskId, setRenameTaskId] = useState('')
  const [renameTitle, setRenameTitle] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const shellClassName = `ai-chat-shell codex-workbench${usesCustomTitleBar ? ' ai-chat-shell-with-titlebar' : ''}`
  const contextOptions = useMemo<AiChatContextOption[]>(() => [
    createHomeContextOption(),
    ...projects.map((project) => ({
      kind: 'project' as const,
      label: project.name,
      path: project.workspacePath,
      projectId: project.id,
      value: `project:${project.id}`
    }))
  ], [projects])
  const selectedProjectOption = selectedProjectId ? contextOptions.find((option) => option.projectId === selectedProjectId) : undefined
  const [selectedContextValue, setSelectedContextValue] = useState(selectedProjectOption?.value ?? 'home')
  const selectedContext = contextOptions.find((option) => option.value === selectedContextValue) ?? contextOptions[0] ?? createHomeContextOption()
  const groupedTasks = useMemo(() => groupCodexTasks(tasks, projects), [projects, tasks])
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null
  const runtimeReady = runtimeStatus?.available === true && runtimeStatus.usable !== false
  const running = selectedTask?.status === 'running'
  const canSend = Boolean((draft.trim() || imageAttachments.length > 0) && runtimeReady && !sending && !running)

  async function refreshRuntime(verify = false): Promise<void> {
    if (!window.forgeDesk) {
      setRuntimeStatus({
        available: false,
        checkedAt: new Date().toISOString(),
        command: '',
        configured: false,
        label: AI_CODING_ASSISTANT_NAME,
        message: `仅 ForgeDesk 桌面应用支持${AI_CODING_ASSISTANT_NAME}对话`,
        provider: 'codex-cli',
        usable: false,
        version: ''
      })
      return
    }

    setCheckingRuntime(true)
    try {
      setRuntimeStatus(await window.forgeDesk.getCodexRuntimeStatus(verify))
    } catch (error) {
      message.error(getErrorMessage(error, `${AI_CODING_ASSISTANT_NAME}状态检测失败`))
    } finally {
      setCheckingRuntime(false)
    }
  }

  async function loadTasks(): Promise<void> {
    if (!window.forgeDesk) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const nextTasks = await window.forgeDesk.listCodexTasks()
      setTasks(nextTasks)
      setSelectedTaskId((current) => current || nextTasks[0]?.id || '')
    } catch (error) {
      message.error(getErrorMessage(error, `读取${AI_CODING_ASSISTANT_NAME}对话失败`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshRuntime(false).catch((error) => message.error(getErrorMessage(error, `${AI_CODING_ASSISTANT_NAME}状态检测失败`)))
    loadTasks().catch((error) => message.error(getErrorMessage(error, `读取${AI_CODING_ASSISTANT_NAME}对话失败`)))
  }, [])

  useEffect(() => {
    if (!window.forgeDesk) return undefined
    return window.forgeDesk.onCodexTaskEvent((event) => {
      setTasks((current) => upsertCodexTask(current, event.task))
      setSelectedTaskId((current) => current || event.task.id)
    })
  }, [])

  useEffect(() => {
    if (!contextOptions.some((option) => option.value === selectedContextValue)) {
      setSelectedContextValue('home')
    }
  }, [contextOptions, selectedContextValue])

  function selectContext(value: string): void {
    setSelectedContextValue(value)
    const nextContext = contextOptions.find((option) => option.value === value)
    if (nextContext?.projectId) setSelectedProjectId(nextContext.projectId)
  }

  async function createTask(): Promise<CodexTaskRecord | null> {
    if (!window.forgeDesk) return null
    setCreating(true)
    try {
      const task = await window.forgeDesk.createCodexTask({
        cwd: getProjectFallbackPath(tasks, selectedContext.path),
        projectId: selectedContext.projectId,
        title: '新对话'
      })
      setTasks((current) => upsertCodexTask(current, task))
      setSelectedTaskId(task.id)
      return task
    } catch (error) {
      message.error(getErrorMessage(error, `创建${AI_CODING_ASSISTANT_NAME}对话失败`))
      return null
    } finally {
      setCreating(false)
    }
  }

  async function sendMessage(): Promise<void> {
    const content = draft.trim() || '请分析我上传的图片。'
    if (!window.forgeDesk || (!draft.trim() && imageAttachments.length === 0)) return
    const images = imageAttachments
    setSending(true)
    try {
      const task = selectedTask ?? await window.forgeDesk.createCodexTask({
        cwd: getProjectFallbackPath(tasks, selectedContext.path),
        projectId: selectedContext.projectId,
        title: createCodexTaskTitle(content)
      })
      setSelectedTaskId(task.id)
      setDraft('')
      const updated = await window.forgeDesk.sendCodexTaskMessage({ taskId: task.id, content, images })
      setTasks((current) => upsertCodexTask(current, updated))
      setImageAttachments([])
    } catch (error) {
      message.error(getErrorMessage(error, `发送${AI_CODING_ASSISTANT_NAME}消息失败`))
    } finally {
      setSending(false)
    }
  }

  async function cancelTask(): Promise<void> {
    if (!selectedTask || !window.forgeDesk) return
    try {
      const updated = await window.forgeDesk.cancelCodexTask(selectedTask.id)
      setTasks((current) => upsertCodexTask(current, updated))
    } catch (error) {
      message.error(getErrorMessage(error, `取消${AI_CODING_ASSISTANT_NAME}对话失败`))
    }
  }

  async function deleteTask(taskId: string): Promise<void> {
    if (!window.forgeDesk) return
    try {
      await window.forgeDesk.deleteCodexTask(taskId)
      setTasks((current) => removeCodexTask(current, taskId))
      setSelectedTaskId((current) => current === taskId ? '' : current)
    } catch (error) {
      message.error(getErrorMessage(error, `删除${AI_CODING_ASSISTANT_NAME}对话失败`))
    }
  }

  function openRenameTask(task: CodexTaskRecord): void {
    setRenameTaskId(task.id)
    setRenameTitle(task.title)
    setRenameOpen(true)
  }

  async function renameTask(): Promise<void> {
    const title = renameTitle.trim()
    if (!title) {
      message.error('请输入对话名称')
      return
    }
    if (!window.forgeDesk || !renameTaskId) return

    setRenaming(true)
    try {
      const updated = await window.forgeDesk.renameCodexTask({ taskId: renameTaskId, title })
      setTasks((current) => upsertCodexTask(current, updated))
      setRenameOpen(false)
    } catch (error) {
      message.error(getErrorMessage(error, '重命名对话失败'))
    } finally {
      setRenaming(false)
    }
  }

  async function copyTaskPath(task: CodexTaskRecord): Promise<void> {
    try {
      await navigator.clipboard.writeText(task.cwd)
      message.success('工作目录已复制')
    } catch (error) {
      message.error(getErrorMessage(error, '复制工作目录失败'))
    }
  }

  function confirmDeleteTask(task: CodexTaskRecord): void {
    Modal.confirm({
      cancelText: '取消',
      content: `「${task.title}」及其对话记录将被删除。`,
      okButtonProps: { danger: true },
      okText: '删除',
      onOk: () => deleteTask(task.id),
      title: `删除这个${AI_CODING_ASSISTANT_NAME}对话？`
    })
  }

  function getTaskMenu(task: CodexTaskRecord) {
    return {
      items: [
        { key: 'open', icon: <MessageOutlined />, label: '打开对话' },
        { key: 'rename', icon: <EditOutlined />, label: '重命名' },
        { key: 'copy-path', icon: <CopyOutlined />, label: '复制工作目录' },
        { type: 'divider' as const },
        { danger: true, key: 'delete', icon: <DeleteOutlined />, label: '删除对话' }
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'open') setSelectedTaskId(task.id)
        if (key === 'rename') openRenameTask(task)
        if (key === 'copy-path') copyTaskPath(task).catch(() => undefined)
        if (key === 'delete') confirmDeleteTask(task)
      }
    }
  }

  async function refreshEnvironment(): Promise<void> {
    if (!selectedTask || !window.forgeDesk) return
    try {
      await window.forgeDesk.getCodexTaskEnvironment(selectedTask.id)
    } catch (error) {
      message.error(getErrorMessage(error, '刷新环境信息失败'))
    }
  }

  async function selectImage(): Promise<void> {
    if (!window.forgeDesk || running || sending) return
    try {
      const path = await window.forgeDesk.selectImage()
      if (!path) return
      setImageAttachments((current) => current.includes(path) ? current : [...current, path])
    } catch (error) {
      message.error(getErrorMessage(error, '选择图片失败'))
    }
  }

  function removeImage(path: string): void {
    setImageAttachments((current) => current.filter((item) => item !== path))
  }

  function getFileName(path: string): string {
    return path.split(/[\\/]/).pop() || path
  }

  return (
    <Layout className={shellClassName}>
      <aside className="codex-workbench-sidebar">
        <div className="module-back-row codex-sidebar-back-row">
          <ModuleBackButton label="返回总览" onClick={onBack} />
        </div>
        <div className="codex-sidebar-top">
          <div>
            <Typography.Text className="codex-brand">{AI_CODING_ASSISTANT_NAME}</Typography.Text>
            <Typography.Text className="codex-sidebar-subtitle">ForgeDesk 工作台</Typography.Text>
          </div>
          <Tooltip title="新建对话">
            <Button type="text" icon={<MessageOutlined />} loading={creating} onClick={() => createTask()} />
          </Tooltip>
        </div>
        <Button className="codex-new-task-button" icon={<MessageOutlined />} loading={creating} onClick={() => createTask()}>
          新建对话
        </Button>
        <div className="codex-task-groups">
          {loading ? (
            <div className="codex-sidebar-loading"><Spin size="small" /></div>
          ) : groupedTasks.length > 0 ? (
            groupedTasks.map((group) => (
              <section className="codex-task-group" key={group.key}>
                <Typography.Text className="codex-task-group-title">{group.label}</Typography.Text>
                {group.tasks.map((task) => (
                  <Dropdown key={task.id} menu={getTaskMenu(task)} trigger={['contextMenu']}>
                    <button
                      className={`codex-task-row${task.id === selectedTask?.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedTaskId(task.id)}
                      onContextMenu={() => setSelectedTaskId(task.id)}
                      type="button"
                    >
                      <span className="codex-task-row-title">{task.title}</span>
                      <span className="codex-task-row-meta">
                        <Badge status={getCodexTaskStatusTone(task.status)} />
                        {codexTaskStatusLabels[task.status]}
                        {formatTaskTime(task.updatedAt)}
                      </span>
                    </button>
                  </Dropdown>
                ))}
              </section>
            ))
          ) : (
            <div className="codex-sidebar-empty">暂无对话</div>
          )}
        </div>
      </aside>

      <main className="codex-workbench-main">
        <header className="codex-workbench-header">
          <div className="codex-thread-title">
            <MessageOutlined />
            <Typography.Title level={4}>{selectedTask?.title || `新${AI_CODING_ASSISTANT_NAME}对话`}</Typography.Title>
            {selectedTask ? <Tag>{codexTaskStatusLabels[selectedTask.status]}</Tag> : null}
          </div>
          <Space wrap>
            <Select
              className="codex-context-select"
              optionLabelProp="label"
              value={selectedContext.value}
              onChange={selectContext}
              options={contextOptions.map((option) => ({ label: option.label, value: option.value, title: option.path || option.label }))}
            />
            <Tooltip title={runtimeStatus?.message || `${AI_CODING_ASSISTANT_NAME}状态`}>
              <Badge status={getRuntimeStatus(runtimeStatus)} text={getRuntimeStatusLabel(runtimeStatus)} />
            </Tooltip>
            <Button icon={<ReloadOutlined />} loading={checkingRuntime} onClick={() => refreshRuntime(false)} />
            <Button icon={<SettingOutlined />} onClick={onOpenAiSettings} />
          </Space>
        </header>

        <section className="codex-message-stage">
          {selectedTask ? (
            <>
              <div className="codex-message-list">
                {selectedTask.messages.map((item) => (
                  <article className={`codex-message is-${item.role}`} key={item.id}>
                    <div className="codex-message-avatar">{item.role === 'user' ? '你' : 'AI'}</div>
                    <div className="codex-message-bubble">
                      <Typography.Text className="codex-message-role">{item.role === 'user' ? '你' : AI_CODING_ASSISTANT_NAME}</Typography.Text>
                      <Typography.Paragraph>{item.content}</Typography.Paragraph>
                      {item.images.length > 0 ? (
                        <div className="codex-message-attachments">
                          {item.images.map((path) => (
                            <Tooltip key={path} title={path}>
                              <span className="codex-message-attachment">
                                <FileImageOutlined />
                                <span>{getFileName(path)}</span>
                              </span>
                            </Tooltip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
                {selectedTask.status === 'running' ? (
                  <article className="codex-message is-assistant">
                    <div className="codex-message-avatar">AI</div>
                    <div className="codex-message-bubble">
                      <Typography.Text className="codex-message-role">{AI_CODING_ASSISTANT_NAME}</Typography.Text>
                      <Spin size="small" /> <Typography.Text type="secondary">正在运行</Typography.Text>
                    </div>
                  </article>
                ) : null}
                {selectedTask.runLog ? (
                  <details className="codex-run-log">
                    <summary>运行输出</summary>
                    <pre>{selectedTask.runLog}</pre>
                  </details>
                ) : null}
                {selectedTask.errorMessage ? (
                  <div className="codex-task-error">
                    <CloseOutlined />
                    <Typography.Text>{selectedTask.errorMessage}</Typography.Text>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="codex-empty-stage">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`开始一个${AI_CODING_ASSISTANT_NAME}对话`} />
            </div>
          )}
        </section>

        <footer className="codex-composer">
          <div className="codex-composer-body">
            {imageAttachments.length > 0 ? (
              <div className="codex-attachment-list">
                {imageAttachments.map((path) => (
                  <Tooltip key={path} title={path}>
                    <span className="codex-attachment-chip">
                      <FileImageOutlined />
                      <span>{getFileName(path)}</span>
                      <Button
                        aria-label={`移除图片 ${getFileName(path)}`}
                        className="codex-attachment-remove"
                        icon={<CloseOutlined />}
                        size="small"
                        type="text"
                        onClick={() => removeImage(path)}
                      />
                    </span>
                  </Tooltip>
                ))}
              </div>
            ) : null}
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 6 }}
              disabled={!runtimeReady || running}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault()
                  sendMessage().catch((error) => message.error(getErrorMessage(error, '发送失败')))
                }
              }}
              placeholder={runtimeReady ? `问${AI_CODING_ASSISTANT_NAME}一个问题，或描述想完成的事` : `${AI_CODING_ASSISTANT_NAME}当前不可用`}
              value={draft}
            />
          </div>
          <div className="codex-composer-actions">
            <Tooltip title="上传图片">
              <Button
                aria-label="上传图片"
                disabled={!runtimeReady || running || sending}
                icon={<FileImageOutlined />}
                onClick={() => selectImage()}
                type="text"
              >
                图片
              </Button>
            </Tooltip>
          {running ? (
            <Button danger icon={<StopOutlined />} onClick={() => cancelTask()}>
              停止
            </Button>
          ) : (
            <Button type="primary" shape="circle" icon={<SendOutlined />} disabled={!canSend} loading={sending} onClick={() => sendMessage()} />
          )}
          </div>
        </footer>
      </main>

      <aside className="codex-workbench-inspector">
        <div className="codex-inspector-section">
          <div className="codex-inspector-heading">
            <Typography.Text strong>环境信息</Typography.Text>
            <Button size="small" type="text" icon={<ReloadOutlined />} disabled={!selectedTask} onClick={() => refreshEnvironment()} />
          </div>
          <div className="codex-env-list">
            <div className="codex-env-row">
              <CodeOutlined />
              <span>变更</span>
              <strong>{selectedTask ? formatCodexChangeStat(selectedTask) : '无变更'}</strong>
            </div>
            <div className="codex-env-row is-path">
              <LaptopOutlined />
              <span>本地</span>
              {(() => {
                const localPath = selectedTask?.cwd || selectedContext.path || '默认目录'
                return (
                  <Typography.Text
                    className="codex-env-path"
                    copyable={localPath === '默认目录' ? false : { text: localPath, tooltips: ['复制路径', '已复制'] }}
                    title={localPath}
                  >
                    {localPath}
                  </Typography.Text>
                )
              })()}
            </div>
            <div className="codex-env-row">
              <BranchesOutlined />
              <span>分支</span>
              <strong>{selectedTask?.branch || '未检测'}</strong>
            </div>
            <div className="codex-env-row is-muted">
              <CheckCircleOutlined />
              <span>提交或推送</span>
              <strong>待接入</strong>
            </div>
          </div>
        </div>
        {selectedTask ? (
          <div className="codex-inspector-section">
            <div className="codex-inspector-heading">
              <Typography.Text strong>对话</Typography.Text>
              <Popconfirm title={`删除这个${AI_CODING_ASSISTANT_NAME}对话？`} okText="删除" cancelText="取消" onConfirm={() => deleteTask(selectedTask.id)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
            <div className="codex-task-detail-list">
              <span>创建 {formatTaskTime(selectedTask.createdAt)}</span>
              <span>更新 {formatTaskTime(selectedTask.updatedAt)}</span>
              <span>{selectedTask.model || '默认模型'}</span>
            </div>
          </div>
        ) : null}
      </aside>

      <Modal
        destroyOnClose
        title="重命名对话"
        open={renameOpen}
        confirmLoading={renaming}
        okText="保存"
        cancelText="取消"
        onCancel={() => setRenameOpen(false)}
        onOk={() => renameTask()}
      >
        <Input
          autoFocus
          maxLength={64}
          showCount
          value={renameTitle}
          onChange={(event) => setRenameTitle(event.target.value)}
          onPressEnter={() => renameTask()}
          placeholder="输入对话名称"
        />
      </Modal>
    </Layout>
  )
}
