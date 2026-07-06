import { CodeOutlined, DeleteOutlined, EditOutlined, FolderOpenOutlined, InfoCircleOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Progress, Row, Select, Space, Spin, Statistic, Switch, Table, Tabs, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  DockerContainerDetail,
  DockerContainerSummary,
  DockerDevEnvironmentInput,
  DockerDevEnvironmentSystem,
  DockerDevEnvironmentTaskSnapshot,
  DockerDevEnvironmentTaskStatus,
  DockerImageSummary,
  DockerResourceNote,
  DockerResourceType,
  DockerSnapshot
} from './data'
import {
  createDockerImageRootTerminalRequest,
  createDockerDashboardSummary,
  filterDockerContainers,
  filterDockerImages,
  getDockerContainerStatusMeta,
  getDockerContainerTableLayout,
  getDockerImageDefaultNoteResourceKey,
  getDockerImageNoteTargetOptions,
  getDockerImageTableLayout,
  getDockerWatchStatusMeta
} from './docker-view'
import { getErrorMessage } from './error-messages'
import type { TerminalOpenRequest } from './terminal-panel-events'

type DockerNoteForm = {
  resourceKey: string
  displayName: string
  notes: string
}

type DockerDevEnvironmentForm = {
  hostPath: string
  name: string
  workspaceFolder: string
  system: DockerDevEnvironmentSystem
  enableDockerInDocker: boolean
  overwrite: boolean
}

type EditingDockerNote = {
  resourceType: DockerResourceType
  resourceKey: string
  title: string
  targetOptions: Array<{ label: string; value: string }>
  defaultDisplayName: string
  note: DockerResourceNote | null
}

type DockerPanelProps = {
  onOpenTerminalRequest?: (request: Omit<TerminalOpenRequest, 'requestId'>) => void
}

const dockerDevEnvironmentSystemOptions: Array<{ label: string; value: DockerDevEnvironmentSystem }> = [
  { label: 'Ubuntu 24.04', value: 'ubuntu-24.04' },
  { label: 'Ubuntu 22.04', value: 'ubuntu-22.04' },
  { label: 'Debian 12', value: 'debian-12' },
  { label: 'Node.js 22', value: 'node-22' },
  { label: 'Python 3.12', value: 'python-3.12' }
]

function getPathBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || 'workspace'
}

function createDefaultDevEnvironmentValues(hostPath = ''): DockerDevEnvironmentForm {
  const folderName = hostPath ? getPathBasename(hostPath) : 'workspace'

  return {
    hostPath,
    name: `${folderName} Dev`,
    workspaceFolder: `/workspaces/${folderName}`,
    system: 'ubuntu-24.04',
    enableDockerInDocker: true,
    overwrite: false
  }
}

function isDevEnvironmentTaskActive(task: DockerDevEnvironmentTaskSnapshot | null): boolean {
  return task?.status === 'queued' || task?.status === 'running'
}

function getDevEnvironmentTaskStatusText(status: DockerDevEnvironmentTaskStatus): string {
  if (status === 'queued') {
    return '等待中'
  }

  if (status === 'running') {
    return '构建中'
  }

  if (status === 'succeeded') {
    return '已启动'
  }

  return '失败'
}

function getDevEnvironmentTaskProgressStatus(status: DockerDevEnvironmentTaskStatus): 'active' | 'success' | 'exception' | 'normal' {
  if (status === 'succeeded') {
    return 'success'
  }

  if (status === 'failed') {
    return 'exception'
  }

  return status === 'running' ? 'active' : 'normal'
}

function getDevEnvironmentRunModeLabel(task: DockerDevEnvironmentTaskSnapshot): string {
  return task.runMode === 'devcontainer-cli' ? 'Dev Containers CLI' : 'Docker 直接运行'
}

function formatDockerTime(value: string): string {
  if (!value) {
    return '-'
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value
}

function findNote(snapshot: DockerSnapshot | null, resourceType: DockerResourceType, resourceKey: string): DockerResourceNote | null {
  return snapshot?.notes.find((note) => note.resourceType === resourceType && note.resourceKey === resourceKey) ?? null
}

function renderMutedText(value: string, fallback = '-'): JSX.Element {
  return (
    <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: value || fallback }}>
      {value || fallback}
    </Typography.Text>
  )
}

function renderCompactText(value: string, fallback = '-'): JSX.Element {
  return (
    <Typography.Text className="docker-cell-text" ellipsis={{ tooltip: value || fallback }}>
      {value || fallback}
    </Typography.Text>
  )
}

function renderCompactMutedText(value: string, fallback = '-'): JSX.Element {
  return (
    <Typography.Text type="secondary" className="docker-cell-text" ellipsis={{ tooltip: value || fallback }}>
      {value || fallback}
    </Typography.Text>
  )
}

function formatDockerList(value: string[]): string {
  return value.length > 0 ? value.join(' ') : '-'
}

function formatDockerBoolean(value: boolean): string {
  return value ? '是' : '否'
}

function renderDetailCode(value: string, fallback = '-'): JSX.Element {
  return (
    <Typography.Text code copyable={value ? { text: value } : false} className="docker-image-detail-code">
      {value || fallback}
    </Typography.Text>
  )
}

export function DockerPanel({ onOpenTerminalRequest }: DockerPanelProps): JSX.Element {
  const [snapshot, setSnapshot] = useState<DockerSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [query, setQuery] = useState('')
  const [onlyRunning, setOnlyRunning] = useState(false)
  const [watching, setWatching] = useState(false)
  const [watchError, setWatchError] = useState('')
  const [lastEventLabel, setLastEventLabel] = useState('')
  const [editingNote, setEditingNote] = useState<EditingDockerNote | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<DockerContainerSummary | null>(null)
  const [containerDetail, setContainerDetail] = useState<DockerContainerDetail | null>(null)
  const [containerDetailLoading, setContainerDetailLoading] = useState(false)
  const [containerDetailError, setContainerDetailError] = useState('')
  const [selectedImage, setSelectedImage] = useState<DockerImageSummary | null>(null)
  const [devEnvironmentOpen, setDevEnvironmentOpen] = useState(false)
  const [creatingDevEnvironment, setCreatingDevEnvironment] = useState(false)
  const [devEnvironmentTask, setDevEnvironmentTask] = useState<DockerDevEnvironmentTaskSnapshot | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [workingNoteKey, setWorkingNoteKey] = useState('')
  const [noteForm] = Form.useForm<DockerNoteForm>()
  const [devEnvironmentForm] = Form.useForm<DockerDevEnvironmentForm>()
  const containerDetailRequestRef = useRef(0)
  const refreshInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const devEnvironmentTaskStatusRef = useRef<Record<string, DockerDevEnvironmentTaskStatus>>({})

  async function loadSnapshot(options: { silent?: boolean } = {}): Promise<void> {
    if (!window.forgeDesk || refreshInFlightRef.current) {
      return
    }

    refreshInFlightRef.current = true

    if (!options.silent) {
      setLoading(true)
    }

    try {
      const nextSnapshot = await window.forgeDesk.getDockerSnapshot()

      if (mountedRef.current) {
        setSnapshot(nextSnapshot)
        setErrorMessage('')
      }
    } catch (error) {
      if (mountedRef.current) {
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      refreshInFlightRef.current = false

      if (!options.silent && mountedRef.current) {
        setLoading(false)
      }
    }
  }

  function handleDevEnvironmentTaskUpdate(task: DockerDevEnvironmentTaskSnapshot): void {
    setDevEnvironmentTask(task)

    const previousStatus = devEnvironmentTaskStatusRef.current[task.taskId]
    devEnvironmentTaskStatusRef.current[task.taskId] = task.status

    if (previousStatus === task.status) {
      return
    }

    if (task.status === 'succeeded') {
      message.success(`开发容器已启动：${task.containerName}`)
      void loadSnapshot({ silent: true })
    }

    if (task.status === 'failed') {
      message.error(task.error || '开发环境构建失败')
      void loadSnapshot({ silent: true })
    }
  }

  useEffect(() => {
    mountedRef.current = true
    void loadSnapshot()

    if (!window.forgeDesk) {
      return () => {
        mountedRef.current = false
      }
    }

    const removeChangedListener = window.forgeDesk.onDockerChanged((event) => {
      setLastEventLabel([event.type, event.action || event.status, event.id ? event.id.slice(0, 12) : ''].filter(Boolean).join(' · '))
      void loadSnapshot({ silent: true })
    })
    const removeWatchErrorListener = window.forgeDesk.onDockerWatchError((event) => {
      setWatchError(event.message)
      setWatching(false)
    })
    const removeDevEnvironmentProgressListener = window.forgeDesk.onDockerDevEnvironmentProgress((task) => {
      if (mountedRef.current) {
        handleDevEnvironmentTaskUpdate(task)
      }
    })

    window.forgeDesk
      .listDockerDevEnvironmentTasks()
      .then((tasks) => {
        if (mountedRef.current && tasks[0]) {
          setDevEnvironmentTask(tasks[0])
          devEnvironmentTaskStatusRef.current[tasks[0].taskId] = tasks[0].status
        }
      })
      .catch(() => undefined)

    window.forgeDesk
      .startDockerWatch()
      .then(() => {
        if (mountedRef.current) {
          setWatching(true)
          setWatchError('')
        }
      })
      .catch((error) => {
        if (mountedRef.current) {
          setWatchError(getErrorMessage(error))
          setWatching(false)
        }
      })

    return () => {
      mountedRef.current = false
      removeChangedListener()
      removeWatchErrorListener()
      removeDevEnvironmentProgressListener()
      setWatching(false)
      void window.forgeDesk.stopDockerWatch()
    }
  }, [])

  const summary = useMemo(
    () => createDockerDashboardSummary(snapshot ?? { images: [], containers: [], notes: [], checkedAt: '' }),
    [snapshot]
  )
  const watchStatus = useMemo(() => getDockerWatchStatusMeta({ watching, watchError, errorMessage }), [watching, watchError, errorMessage])
  const filteredContainers = useMemo(() => filterDockerContainers(snapshot?.containers ?? [], query, { onlyRunning }), [onlyRunning, query, snapshot])
  const filteredImages = useMemo(() => filterDockerImages(snapshot?.images ?? [], query), [query, snapshot])
  const containerTableLayout = getDockerContainerTableLayout()
  const imageTableLayout = getDockerImageTableLayout()

  function openContainerNote(container: DockerContainerSummary): void {
    const note = container.note

    setEditingNote({
      resourceType: 'container',
      resourceKey: container.noteResourceKey,
      title: container.displayName || container.name || container.shortId,
      targetOptions: [{ label: `按容器 ID ${container.shortId}`, value: container.noteResourceKey }],
      defaultDisplayName: container.name || container.shortId,
      note
    })
    noteForm.setFieldsValue({
      resourceKey: container.noteResourceKey,
      displayName: note?.displayName || container.displayName || container.name || container.shortId,
      notes: note?.notes || ''
    })
  }

  function openImageNote(image: DockerImageSummary): void {
    const options = getDockerImageNoteTargetOptions(image)
    const resourceKey = getDockerImageDefaultNoteResourceKey(image)
    const note = findNote(snapshot, 'image', resourceKey)

    setEditingNote({
      resourceType: 'image',
      resourceKey,
      title: image.reference || image.shortId,
      targetOptions: options,
      defaultDisplayName: image.reference || image.shortId,
      note
    })
    noteForm.setFieldsValue({
      resourceKey,
      displayName: note?.displayName || image.displayName || image.reference || image.shortId,
      notes: note?.notes || ''
    })
  }

  function openImageDetails(image: DockerImageSummary): void {
    setSelectedImage(image)
  }

  function openImageRootTerminal(image: DockerImageSummary): void {
    onOpenTerminalRequest?.(createDockerImageRootTerminalRequest(image))
  }

  function openDevEnvironmentModal(): void {
    devEnvironmentForm.setFieldsValue(createDefaultDevEnvironmentValues())
    setDevEnvironmentOpen(true)
  }

  async function selectDevEnvironmentDirectory(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    try {
      const directory = await window.forgeDesk.selectDirectory()

      if (!directory) {
        return
      }

      const defaults = createDefaultDevEnvironmentValues(directory)
      const currentName = devEnvironmentForm.getFieldValue('name')

      devEnvironmentForm.setFieldsValue({
        ...defaults,
        name: currentName?.trim() ? currentName : defaults.name
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  async function createDevEnvironment(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await devEnvironmentForm.validateFields()
    const input: DockerDevEnvironmentInput = {
      hostPath: values.hostPath,
      name: values.name,
      workspaceFolder: values.workspaceFolder,
      system: values.system,
      enableDockerInDocker: values.enableDockerInDocker,
      overwrite: values.overwrite
    }

    setCreatingDevEnvironment(true)

    try {
      const task = await window.forgeDesk.createDockerDevEnvironment(input)
      setDevEnvironmentTask(task)
      devEnvironmentTaskStatusRef.current[task.taskId] = task.status
      setDevEnvironmentOpen(false)
      devEnvironmentForm.resetFields()
      message.success(`开发环境构建已启动：${task.containerName}`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCreatingDevEnvironment(false)
    }
  }

  function openContainerDetails(container: DockerContainerSummary): void {
    setSelectedContainer(container)
    setContainerDetail(null)
    setContainerDetailError('')

    if (!window.forgeDesk) {
      return
    }

    const requestId = containerDetailRequestRef.current + 1
    containerDetailRequestRef.current = requestId
    setContainerDetailLoading(true)

    window.forgeDesk
      .getDockerContainerDetail(container.id)
      .then((detail) => {
        if (containerDetailRequestRef.current === requestId) {
          setContainerDetail(detail)
        }
      })
      .catch((error) => {
        if (containerDetailRequestRef.current === requestId) {
          setContainerDetailError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (containerDetailRequestRef.current === requestId) {
          setContainerDetailLoading(false)
        }
      })
  }

  function closeContainerDetails(): void {
    containerDetailRequestRef.current += 1
    setSelectedContainer(null)
    setContainerDetail(null)
    setContainerDetailError('')
    setContainerDetailLoading(false)
  }

  function changeNoteResourceKey(resourceKey: string): void {
    if (!editingNote) {
      return
    }

    const note = findNote(snapshot, editingNote.resourceType, resourceKey)
    setEditingNote({ ...editingNote, resourceKey, note })
    noteForm.setFieldsValue({
      resourceKey,
      displayName: note?.displayName || editingNote.defaultDisplayName,
      notes: note?.notes || ''
    })
  }

  async function saveNote(): Promise<void> {
    if (!window.forgeDesk || !editingNote) {
      return
    }

    const values = await noteForm.validateFields()
    setSavingNote(true)

    try {
      const nextSnapshot = await window.forgeDesk.saveDockerResourceNote({
        resourceType: editingNote.resourceType,
        resourceKey: values.resourceKey,
        displayName: values.displayName,
        notes: values.notes
      })
      setSnapshot(nextSnapshot)
      setEditingNote(null)
      noteForm.resetFields()
      message.success('Docker 备注已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingNote(false)
    }
  }

  function confirmDeleteNote(resourceType: DockerResourceType, resourceKey: string): void {
    Modal.confirm({
      title: '删除 Docker 备注？',
      content: '只会删除 ForgeDesk 本地备注，不会修改 Docker 资源。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        if (!window.forgeDesk) {
          return
        }

        setWorkingNoteKey(resourceKey)

        try {
          const nextSnapshot = await window.forgeDesk.deleteDockerResourceNote(resourceType, resourceKey)
          setSnapshot(nextSnapshot)
          message.success('Docker 备注已删除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setWorkingNoteKey('')
        }
      }
    })
  }

  const containerColumns: ColumnsType<DockerContainerSummary> = [
    {
      title: '容器',
      key: 'container',
      width: containerTableLayout.columns[0].width,
      render: (_, container) => (
        <div className="docker-cell-stack">
          <Typography.Text strong className="docker-cell-text" ellipsis={{ tooltip: container.displayName }}>
            {container.displayName}
          </Typography.Text>
          <div className="docker-cell-row">
            {renderCompactMutedText(container.name || container.shortId)}
            {container.note ? <Tag color="blue">备注</Tag> : null}
          </div>
        </div>
      )
    },
    {
      title: '状态',
      key: 'state',
      width: containerTableLayout.columns[1].width,
      render: (_, container) => {
        const meta = getDockerContainerStatusMeta(container.state, container.status)

        return (
          <div className="docker-cell-stack">
            <Badge status={meta.badgeStatus} text={<Tag color={meta.color}>{meta.label}</Tag>} />
            {renderCompactMutedText(container.status)}
          </div>
        )
      }
    },
    {
      title: '镜像 / 端口',
      key: 'image',
      width: containerTableLayout.columns[2].width,
      render: (_, container) => (
        <div className="docker-cell-stack">
          {renderCompactText(container.image)}
          {renderCompactMutedText(container.ports, '未暴露端口')}
        </div>
      )
    },
    {
      title: '运行 / ID',
      key: 'runtime',
      width: containerTableLayout.columns[3].width,
      render: (_, container) => (
        <div className="docker-cell-stack">
          {renderCompactText(container.runningFor || container.createdAt)}
          <Typography.Text code className="docker-cell-text" ellipsis={{ tooltip: container.id }}>
            {container.shortId}
          </Typography.Text>
        </div>
      )
    },
    {
      title: '备注 / 操作',
      key: 'noteActions',
      width: containerTableLayout.columns[4].width,
      render: (_, container) => (
        <div className="docker-note-action-cell">
          {container.note?.notes ? renderCompactMutedText(container.note.notes) : <Typography.Text type="secondary">-</Typography.Text>}
          <div className="docker-note-actions">
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openContainerDetails(container)
              }}
            >
              详情
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openContainerNote(container)
              }}
            >
              备注
            </Button>
            {container.note ? (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={workingNoteKey === container.note.resourceKey}
                onClick={(event) => {
                  event.stopPropagation()
                  confirmDeleteNote('container', container.noteResourceKey)
                }}
              >
                删除
              </Button>
            ) : null}
          </div>
        </div>
      )
    }
  ]

  const imageColumns: ColumnsType<DockerImageSummary> = [
    {
      title: '镜像',
      key: 'image',
      width: imageTableLayout.columns[0].width,
      render: (_, image) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong ellipsis={{ tooltip: image.displayName }}>
            {image.displayName}
          </Typography.Text>
          <Space size={6} wrap>
            {renderMutedText(image.reference)}
            {image.note ? <Tag color="blue">备注</Tag> : null}
          </Space>
        </Space>
      )
    },
    { title: '仓库', key: 'repository', width: imageTableLayout.columns[1].width, render: (_, image) => renderMutedText(image.repository, '<none>') },
    { title: 'Tag', key: 'tag', width: imageTableLayout.columns[2].width, render: (_, image) => renderMutedText(image.tag, '<none>') },
    { title: 'Image ID', key: 'id', width: imageTableLayout.columns[3].width, render: (_, image) => <Typography.Text code>{image.shortId}</Typography.Text> },
    { title: 'Digest', key: 'digest', width: imageTableLayout.columns[4].width, render: (_, image) => renderMutedText(image.digest, '<none>') },
    { title: '大小', key: 'size', width: imageTableLayout.columns[5].width, render: (_, image) => image.size || '-' },
    { title: '创建时间', key: 'created', width: imageTableLayout.columns[6].width, render: (_, image) => renderMutedText(image.createdSince || formatDockerTime(image.createdAt)) },
    {
      title: '详情 / 操作',
      key: 'actions',
      width: imageTableLayout.columns[7].width,
      render: (_, image) => (
        <div className="docker-note-action-cell">
          {image.note?.notes ? renderMutedText(image.note.notes) : <Typography.Text type="secondary">-</Typography.Text>}
          <div className="docker-note-actions">
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openImageDetails(image)
              }}
            >
              详情
            </Button>
            <Button
              size="small"
              icon={<CodeOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openImageRootTerminal(image)
              }}
            >
              Root
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openImageNote(image)
              }}
            >
              备注
            </Button>
            {image.note ? (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={workingNoteKey === image.note.resourceKey}
                onClick={(event) => {
                  event.stopPropagation()
                  confirmDeleteNote('image', image.note?.resourceKey ?? image.noteResourceKey)
                }}
              >
                删除
              </Button>
            ) : null}
          </div>
        </div>
      )
    }
  ]

  const selectedContainerStatus = selectedContainer ? getDockerContainerStatusMeta(containerDetail?.status || selectedContainer.state, selectedContainer.status) : null
  const containerEnvRows = (containerDetail?.env ?? []).map((value, index) => ({ key: String(index), value }))
  const containerPortRows = (containerDetail?.ports ?? []).map((port, index) => ({ key: `${port.privatePort}-${port.hostPort}-${index}`, ...port }))
  const containerMountRows = (containerDetail?.mounts ?? []).map((mount, index) => ({ key: `${mount.destination}-${index}`, ...mount }))
  const containerNetworkRows = (containerDetail?.networks ?? []).map((network) => ({ key: network.name, ...network }))
  const containerLabelRows = Object.entries(containerDetail?.labels ?? {}).map(([key, value]) => ({ key, label: key, value }))
  const devEnvironmentTaskActive = isDevEnvironmentTaskActive(devEnvironmentTask)
  const devEnvironmentTaskLogs = (devEnvironmentTask?.logs ?? []).slice(-80).join('\n')

  return (
    <section className="workspace-section docker-page">
      <div className="panel docker-panel">
        <div className="settings-module-header">
          <Space direction="vertical" size={2}>
            <Typography.Title level={3}>Docker</Typography.Title>
            <Typography.Text type="secondary">查看本机镜像和容器实例，给它们保存只属于 ForgeDesk 的备注名称。</Typography.Text>
          </Space>
          <Space wrap>
            <Tag color={watchStatus.color}>{watchStatus.label}</Tag>
            <Button type="primary" icon={<PlusOutlined />} loading={creatingDevEnvironment} disabled={devEnvironmentTaskActive} onClick={openDevEnvironmentModal}>
              创建开发环境
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadSnapshot()}>
              刷新
            </Button>
          </Space>
        </div>

        {errorMessage ? (
          <Alert
            className="docker-alert"
            type="warning"
            showIcon
            message="Docker 暂不可用"
            description={errorMessage}
            action={<Button onClick={() => loadSnapshot()}>重试</Button>}
          />
        ) : null}
        {watchError ? <Alert className="docker-alert" type="info" showIcon message="Docker 监听未运行" description={watchError} /> : null}

        {devEnvironmentTask ? (
          <div className={`docker-dev-environment-task docker-dev-environment-task-${devEnvironmentTask.status}`}>
            <div className="docker-dev-environment-task-heading">
              <Space size={8} wrap>
                <Tag color={devEnvironmentTask.status === 'failed' ? 'red' : devEnvironmentTask.status === 'succeeded' ? 'green' : 'blue'}>
                  {getDevEnvironmentTaskStatusText(devEnvironmentTask.status)}
                </Tag>
                <Typography.Text strong>{devEnvironmentTask.stage}</Typography.Text>
                <Typography.Text type="secondary">{getDevEnvironmentRunModeLabel(devEnvironmentTask)}</Typography.Text>
              </Space>
              <Typography.Text type="secondary">更新：{formatDockerTime(devEnvironmentTask.updatedAt)}</Typography.Text>
            </div>
            <Progress
              percent={devEnvironmentTask.progressPercent}
              size="small"
              status={getDevEnvironmentTaskProgressStatus(devEnvironmentTask.status)}
            />
            <div className="docker-dev-environment-task-meta">
              <div>
                <Typography.Text type="secondary">容器</Typography.Text>
                <Typography.Text code copyable={{ text: devEnvironmentTask.containerName }}>{devEnvironmentTask.containerName}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">映射目录</Typography.Text>
                <Typography.Text ellipsis={{ tooltip: devEnvironmentTask.hostPath }}>{devEnvironmentTask.hostPath}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">配置</Typography.Text>
                <Typography.Text ellipsis={{ tooltip: devEnvironmentTask.configPath }}>{devEnvironmentTask.configPath}</Typography.Text>
              </div>
            </div>
            {devEnvironmentTask.error ? <Alert type="error" showIcon message="开发环境构建失败" description={devEnvironmentTask.error} /> : null}
            {devEnvironmentTaskLogs ? <Input.TextArea className="docker-dev-environment-log" readOnly rows={6} value={devEnvironmentTaskLogs} /> : null}
          </div>
        ) : null}

        <Row gutter={[12, 12]} className="docker-summary-row">
          <Col xs={12} md={6}><div className="metric-tile"><Statistic title="镜像" value={summary.imageCount} /></div></Col>
          <Col xs={12} md={6}><div className="metric-tile"><Statistic title="容器" value={summary.containerCount} /></div></Col>
          <Col xs={12} md={6}><div className="metric-tile"><Statistic title="运行中" value={summary.runningContainerCount} /></div></Col>
          <Col xs={12} md={6}><div className="metric-tile"><Statistic title="备注" value={summary.notedResourceCount} /></div></Col>
        </Row>

        <div className="docker-toolbar">
          <Input
            allowClear
            className="docker-search"
            prefix={<SearchOutlined />}
            placeholder="搜索备注、名称、镜像、端口或 ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Space wrap>
            <Space size={8}>
              <Switch size="small" checked={onlyRunning} onChange={setOnlyRunning} />
              <Typography.Text type="secondary">只看运行中</Typography.Text>
            </Space>
            <Typography.Text type="secondary">上次刷新：{formatDockerTime(snapshot?.checkedAt ?? '')}</Typography.Text>
            {lastEventLabel ? <Typography.Text type="secondary">最近事件：{lastEventLabel}</Typography.Text> : null}
          </Space>
        </div>

        <Spin spinning={loading && !snapshot}>
          <Tabs
            items={[
              {
                key: 'containers',
                label: `容器 ${filteredContainers.length}`,
                children: (
                  <Table
                    className="docker-compact-table"
                    rowKey="id"
                    size="small"
                    tableLayout="fixed"
                    columns={containerColumns}
                    dataSource={filteredContainers}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: containerTableLayout.minWidth }}
                    onRow={(container) => ({
                      className: 'docker-clickable-row',
                      onClick: () => openContainerDetails(container)
                    })}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '正在读取容器' : '暂无容器'} /> }}
                  />
                )
              },
              {
                key: 'images',
                label: `镜像 ${filteredImages.length}`,
                children: (
                  <Table
                    className="docker-compact-table"
                    rowKey={(image) => image.noteResourceKey || image.id}
                    size="small"
                    tableLayout="fixed"
                    columns={imageColumns}
                    dataSource={filteredImages}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: imageTableLayout.minWidth }}
                    onRow={(image) => ({
                      className: 'docker-clickable-row',
                      onClick: () => openImageDetails(image)
                    })}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '正在读取镜像' : '暂无镜像'} /> }}
                  />
                )
              }
            ]}
          />
        </Spin>
      </div>

      <Drawer
        title={selectedContainer ? `容器详情：${selectedContainer.displayName}` : '容器详情'}
        width={760}
        open={Boolean(selectedContainer)}
        onClose={closeContainerDetails}
      >
        {selectedContainer ? (
          <Spin spinning={containerDetailLoading}>
            <Space direction="vertical" size={16} className="docker-container-detail">
              {containerDetailError ? (
                <Alert
                  type="warning"
                  showIcon
                  message="容器详情读取失败"
                  description={containerDetailError}
                  action={<Button onClick={() => openContainerDetails(selectedContainer)}>重试</Button>}
                />
              ) : null}
              <Tabs
                items={[
                  {
                    key: 'overview',
                    label: '概览',
                    children: (
                      <Descriptions
                        bordered
                        size="small"
                        column={1}
                        items={[
                          { key: 'name', label: '名称', children: containerDetail?.name || selectedContainer.name || selectedContainer.shortId },
                          {
                            key: 'id',
                            label: 'Container ID',
                            children: renderDetailCode(containerDetail?.id || selectedContainer.id)
                          },
                          {
                            key: 'status',
                            label: '状态',
                            children: selectedContainerStatus ? <Badge status={selectedContainerStatus.badgeStatus} text={<Tag color={selectedContainerStatus.color}>{selectedContainerStatus.label}</Tag>} /> : '-'
                          },
                          { key: 'imageName', label: '镜像', children: containerDetail?.imageName || selectedContainer.image || '-' },
                          { key: 'imageId', label: 'Image ID', children: renderDetailCode(containerDetail?.image || '') },
                          { key: 'ports', label: '端口', children: selectedContainer.ports || (containerPortRows.length > 0 ? `${containerPortRows.length} 条映射` : '-') },
                          { key: 'createdAt', label: '创建时间', children: formatDockerTime(containerDetail?.createdAt || selectedContainer.createdAt) },
                          { key: 'startedAt', label: '启动时间', children: formatDockerTime(containerDetail?.startedAt || '') },
                          { key: 'finishedAt', label: '结束时间', children: formatDockerTime(containerDetail?.finishedAt || '') },
                          { key: 'pid', label: 'PID', children: containerDetail ? String(containerDetail.pid) : '-' },
                          { key: 'exitCode', label: 'Exit Code', children: containerDetail ? String(containerDetail.exitCode) : '-' },
                          { key: 'restartCount', label: '重启次数', children: containerDetail ? String(containerDetail.restartCount) : '-' },
                          { key: 'platform', label: '平台', children: containerDetail?.platform || '-' },
                          { key: 'driver', label: '存储驱动', children: containerDetail?.driver || '-' }
                        ]}
                      />
                    )
                  },
                  {
                    key: 'config',
                    label: '配置',
                    children: (
                      <Space direction="vertical" size={16} className="docker-detail-tab">
                        <Descriptions
                          bordered
                          size="small"
                          column={1}
                          items={[
                            { key: 'hostname', label: 'Hostname', children: containerDetail?.hostname || '-' },
                            { key: 'user', label: 'User', children: containerDetail?.user || 'default' },
                            { key: 'workingDir', label: 'WorkingDir', children: containerDetail?.workingDir || '-' },
                            { key: 'entrypoint', label: 'Entrypoint', children: formatDockerList(containerDetail?.entrypoint ?? []) },
                            { key: 'command', label: 'Command', children: formatDockerList(containerDetail?.command ?? []) },
                            { key: 'networkMode', label: 'Network Mode', children: containerDetail?.networkMode || '-' },
                            { key: 'restartPolicy', label: 'Restart Policy', children: containerDetail?.restartPolicy || '-' },
                            { key: 'running', label: 'Running', children: containerDetail ? formatDockerBoolean(containerDetail.running) : '-' },
                            { key: 'paused', label: 'Paused', children: containerDetail ? formatDockerBoolean(containerDetail.paused) : '-' },
                            { key: 'restarting', label: 'Restarting', children: containerDetail ? formatDockerBoolean(containerDetail.restarting) : '-' }
                          ]}
                        />
                        <Table
                          className="docker-detail-table"
                          rowKey="key"
                          size="small"
                          pagination={false}
                          columns={[{ title: 'Env', dataIndex: 'value', key: 'value' }]}
                          dataSource={containerEnvRows}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无环境变量" /> }}
                        />
                      </Space>
                    )
                  },
                  {
                    key: 'mounts',
                    label: `挂载 ${containerMountRows.length}`,
                    children: (
                      <Table
                        className="docker-detail-table"
                        rowKey="key"
                        size="small"
                        pagination={false}
                        scroll={{ x: 720 }}
                        columns={[
                          { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
                          { title: '宿主机路径', dataIndex: 'source', key: 'source', width: 260 },
                          { title: '容器路径', dataIndex: 'destination', key: 'destination', width: 220 },
                          { title: '模式', dataIndex: 'mode', key: 'mode', width: 100 },
                          { title: 'RW', dataIndex: 'rw', key: 'rw', width: 80, render: (value: boolean) => formatDockerBoolean(value) }
                        ]}
                        dataSource={containerMountRows}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无挂载" /> }}
                      />
                    )
                  },
                  {
                    key: 'networks',
                    label: `网络 ${containerNetworkRows.length}`,
                    children: (
                      <Space direction="vertical" size={16} className="docker-detail-tab">
                        <Table
                          className="docker-detail-table"
                          rowKey="key"
                          size="small"
                          pagination={false}
                          scroll={{ x: 760 }}
                          columns={[
                            { title: '网络', dataIndex: 'name', key: 'name', width: 140 },
                            { title: 'IP', dataIndex: 'ipAddress', key: 'ipAddress', width: 150 },
                            { title: '网关', dataIndex: 'gateway', key: 'gateway', width: 150 },
                            { title: 'MAC', dataIndex: 'macAddress', key: 'macAddress', width: 180 },
                            { title: 'Network ID', dataIndex: 'networkId', key: 'networkId', width: 180 }
                          ]}
                          dataSource={containerNetworkRows}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无网络信息" /> }}
                        />
                        <Table
                          className="docker-detail-table"
                          rowKey="key"
                          size="small"
                          pagination={false}
                          columns={[
                            { title: '容器端口', dataIndex: 'privatePort', key: 'privatePort', width: 120 },
                            { title: '协议', dataIndex: 'type', key: 'type', width: 100 },
                            { title: 'Host IP', dataIndex: 'hostIp', key: 'hostIp', width: 160 },
                            { title: 'Host Port', dataIndex: 'hostPort', key: 'hostPort', width: 160 }
                          ]}
                          dataSource={containerPortRows}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无端口映射" /> }}
                        />
                      </Space>
                    )
                  },
                  {
                    key: 'labels',
                    label: `标签 ${containerLabelRows.length}`,
                    children: (
                      <Table
                        className="docker-detail-table"
                        rowKey="key"
                        size="small"
                        pagination={false}
                        scroll={{ x: 680 }}
                        columns={[
                          { title: 'Key', dataIndex: 'label', key: 'label', width: 300 },
                          { title: 'Value', dataIndex: 'value', key: 'value', width: 360 }
                        ]}
                        dataSource={containerLabelRows}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无标签" /> }}
                      />
                    )
                  },
                  {
                    key: 'inspect',
                    label: 'Inspect',
                    children: (
                      <Input.TextArea className="docker-detail-raw" readOnly rows={18} value={containerDetail?.rawJson || ''} />
                    )
                  }
                ]}
              />
            </Space>
          </Spin>
        ) : null}
      </Drawer>

      <Drawer
        title={selectedImage ? `镜像详情：${selectedImage.displayName}` : '镜像详情'}
        width={560}
        open={Boolean(selectedImage)}
        onClose={() => setSelectedImage(null)}
        extra={
          selectedImage ? (
            <Button icon={<CodeOutlined />} onClick={() => openImageRootTerminal(selectedImage)}>
              Root 终端
            </Button>
          ) : null
        }
      >
        {selectedImage ? (
          <Space direction="vertical" size={16} className="docker-image-detail">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'displayName', label: '显示名称', children: selectedImage.displayName || '-' },
                { key: 'reference', label: '镜像引用', children: selectedImage.reference || '<untagged>' },
                { key: 'repository', label: '仓库', children: selectedImage.repository || '<none>' },
                { key: 'tag', label: 'Tag', children: selectedImage.tag || '<none>' },
                {
                  key: 'id',
                  label: 'Image ID',
                  children: (
                    <Typography.Text code copyable={{ text: selectedImage.id }} className="docker-image-detail-code">
                      {selectedImage.id}
                    </Typography.Text>
                  )
                },
                { key: 'digest', label: 'Digest', children: selectedImage.digest || '<none>' },
                { key: 'size', label: '大小', children: selectedImage.size || '-' },
                { key: 'createdSince', label: '创建', children: selectedImage.createdSince || '-' },
                { key: 'createdAt', label: '创建时间', children: formatDockerTime(selectedImage.createdAt) },
                { key: 'noteKey', label: '备注绑定', children: selectedImage.noteResourceKey },
                { key: 'notes', label: '备注', children: selectedImage.note?.notes || '-' }
              ]}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="创建开发环境"
        open={devEnvironmentOpen}
        okText="创建并启动"
        cancelText="取消"
        confirmLoading={creatingDevEnvironment}
        onOk={createDevEnvironment}
        onCancel={() => {
          setDevEnvironmentOpen(false)
          devEnvironmentForm.resetFields()
        }}
      >
        <Space direction="vertical" size={14} className="docker-dev-environment-form">
          <Alert
            type="info"
            showIcon
            message="生成并启动 Dev Containers 开发环境"
            description="会写入 .devcontainer/devcontainer.json，并启动一个 root 用户开发容器；默认启用 Docker-in-Docker 配置。"
          />
          <Form form={devEnvironmentForm} layout="vertical" initialValues={createDefaultDevEnvironmentValues()}>
            <Form.Item label="映射目录" required>
              <Space.Compact className="docker-dev-environment-path">
                <Form.Item name="hostPath" noStyle rules={[{ required: true, message: '请选择映射目录' }]}>
                  <Input placeholder="/Users/stone/project" />
                </Form.Item>
                <Button icon={<FolderOpenOutlined />} onClick={selectDevEnvironmentDirectory}>
                  选择
                </Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="name" label="环境名称" rules={[{ required: true, message: '请输入环境名称' }]}>
              <Input placeholder="workspace Dev" />
            </Form.Item>
            <Form.Item name="workspaceFolder" label="容器工作区路径" rules={[{ required: true, message: '请输入容器工作区路径' }]}>
              <Input placeholder="/workspaces/workspace" />
            </Form.Item>
            <Form.Item name="system" label="开发系统环境" rules={[{ required: true, message: '请选择开发系统环境' }]}>
              <Select options={dockerDevEnvironmentSystemOptions} />
            </Form.Item>
            <Form.Item name="enableDockerInDocker" label="Docker-in-Docker 插件" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name="overwrite" label="覆盖已有配置" valuePropName="checked">
              <Switch checkedChildren="覆盖" unCheckedChildren="保留" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title={editingNote ? `编辑备注：${editingNote.title}` : '编辑 Docker 备注'}
        open={Boolean(editingNote)}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingNote}
        onOk={saveNote}
        onCancel={() => {
          setEditingNote(null)
          noteForm.resetFields()
        }}
      >
        <Form form={noteForm} layout="vertical">
          <Form.Item name="resourceKey" label="备注绑定目标" rules={[{ required: true, message: '请选择备注绑定目标' }]}>
            <Select options={editingNote?.targetOptions ?? []} onChange={changeNoteResourceKey} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder={editingNote?.defaultDisplayName || '本地显示名称'} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={4} placeholder="只保存在 ForgeDesk 本地，不会写入 Docker" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
