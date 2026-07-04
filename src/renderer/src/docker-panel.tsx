import { DeleteOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Col, Empty, Form, Input, Modal, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DockerContainerSummary, DockerImageSummary, DockerResourceNote, DockerResourceType, DockerSnapshot } from './data'
import {
  createDockerDashboardSummary,
  filterDockerContainers,
  filterDockerImages,
  getDockerContainerStatusMeta,
  getDockerImageDefaultNoteResourceKey,
  getDockerImageNoteTargetOptions,
  getDockerWatchStatusMeta
} from './docker-view'
import { getErrorMessage } from './error-messages'

type DockerNoteForm = {
  resourceKey: string
  displayName: string
  notes: string
}

type EditingDockerNote = {
  resourceType: DockerResourceType
  resourceKey: string
  title: string
  targetOptions: Array<{ label: string; value: string }>
  defaultDisplayName: string
  note: DockerResourceNote | null
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

export function DockerPanel(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DockerSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [query, setQuery] = useState('')
  const [watching, setWatching] = useState(false)
  const [watchError, setWatchError] = useState('')
  const [lastEventLabel, setLastEventLabel] = useState('')
  const [editingNote, setEditingNote] = useState<EditingDockerNote | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [workingNoteKey, setWorkingNoteKey] = useState('')
  const [noteForm] = Form.useForm<DockerNoteForm>()
  const refreshInFlightRef = useRef(false)
  const mountedRef = useRef(true)

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
      setWatching(false)
      void window.forgeDesk.stopDockerWatch()
    }
  }, [])

  const summary = useMemo(
    () => createDockerDashboardSummary(snapshot ?? { images: [], containers: [], notes: [], checkedAt: '' }),
    [snapshot]
  )
  const watchStatus = useMemo(() => getDockerWatchStatusMeta({ watching, watchError, errorMessage }), [watching, watchError, errorMessage])
  const filteredContainers = useMemo(() => filterDockerContainers(snapshot?.containers ?? [], query), [query, snapshot])
  const filteredImages = useMemo(() => filterDockerImages(snapshot?.images ?? [], query), [query, snapshot])

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
      width: 260,
      render: (_, container) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong ellipsis={{ tooltip: container.displayName }}>
            {container.displayName}
          </Typography.Text>
          <Space size={6} wrap>
            {renderMutedText(container.name || container.shortId)}
            {container.note ? <Tag color="blue">备注</Tag> : null}
          </Space>
        </Space>
      )
    },
    {
      title: '状态',
      key: 'state',
      width: 170,
      render: (_, container) => {
        const meta = getDockerContainerStatusMeta(container.state, container.status)

        return (
          <Space direction="vertical" size={2}>
            <Badge status={meta.badgeStatus} text={<Tag color={meta.color}>{meta.label}</Tag>} />
            {renderMutedText(container.status)}
          </Space>
        )
      }
    },
    { title: '镜像', key: 'image', width: 220, render: (_, container) => renderMutedText(container.image) },
    { title: '端口', key: 'ports', render: (_, container) => renderMutedText(container.ports, '未暴露端口') },
    { title: '容器 ID', key: 'id', width: 150, render: (_, container) => <Typography.Text code>{container.shortId}</Typography.Text> },
    { title: '创建 / 运行', key: 'time', width: 220, render: (_, container) => renderMutedText(container.runningFor || container.createdAt) },
    {
      title: '备注',
      key: 'note',
      width: 250,
      render: (_, container) => (
        <Space direction="vertical" size={4}>
          {container.note?.notes ? renderMutedText(container.note.notes) : <Typography.Text type="secondary">-</Typography.Text>}
          <Space wrap size={6}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openContainerNote(container)}>
              备注
            </Button>
            {container.note ? (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={workingNoteKey === container.note.resourceKey}
                onClick={() => confirmDeleteNote('container', container.noteResourceKey)}
              >
                删除
              </Button>
            ) : null}
          </Space>
        </Space>
      )
    }
  ]

  const imageColumns: ColumnsType<DockerImageSummary> = [
    {
      title: '镜像',
      key: 'image',
      width: 280,
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
    { title: '仓库', key: 'repository', width: 200, render: (_, image) => renderMutedText(image.repository, '<none>') },
    { title: 'Tag', key: 'tag', width: 140, render: (_, image) => renderMutedText(image.tag, '<none>') },
    { title: 'Image ID', key: 'id', width: 150, render: (_, image) => <Typography.Text code>{image.shortId}</Typography.Text> },
    { title: 'Digest', key: 'digest', render: (_, image) => renderMutedText(image.digest, '<none>') },
    { title: '大小', key: 'size', width: 110, render: (_, image) => image.size || '-' },
    { title: '创建时间', key: 'created', width: 190, render: (_, image) => renderMutedText(image.createdSince || formatDockerTime(image.createdAt)) },
    {
      title: '备注',
      key: 'note',
      width: 250,
      render: (_, image) => (
        <Space direction="vertical" size={4}>
          {image.note?.notes ? renderMutedText(image.note.notes) : <Typography.Text type="secondary">-</Typography.Text>}
          <Space wrap size={6}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openImageNote(image)}>
              备注
            </Button>
            {image.note ? (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={workingNoteKey === image.note.resourceKey}
                onClick={() => confirmDeleteNote('image', image.note?.resourceKey ?? image.noteResourceKey)}
              >
                删除
              </Button>
            ) : null}
          </Space>
        </Space>
      )
    }
  ]

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
                    rowKey="id"
                    size="small"
                    columns={containerColumns}
                    dataSource={filteredContainers}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1420 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '正在读取容器' : '暂无容器'} /> }}
                  />
                )
              },
              {
                key: 'images',
                label: `镜像 ${filteredImages.length}`,
                children: (
                  <Table
                    rowKey={(image) => image.noteResourceKey || image.id}
                    size="small"
                    columns={imageColumns}
                    dataSource={filteredImages}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1540 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '正在读取镜像' : '暂无镜像'} /> }}
                  />
                )
              }
            ]}
          />
        </Spin>
      </div>

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
