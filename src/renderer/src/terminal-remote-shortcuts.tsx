import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
  message
} from 'antd'
import { CodeOutlined, DeleteOutlined, EditOutlined, FolderOpenOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from './error-messages'
import type { TerminalOpenRequest } from './terminal-panel-events'
import { createTerminalRemoteGroupSections, formatTerminalRemoteTarget } from './terminal-remote-shortcuts-view'

type TerminalRemoteShortcutsProps = {
  onOpenTerminalRequest: (request: Omit<TerminalOpenRequest, 'requestId'>) => void
}

type TerminalRemoteGroupForm = {
  name: string
}

const defaultRemoteGroupId = 'remote-group-default'

function getPathFileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function isDefaultRemoteGroup(group: TerminalRemoteGroupRecord): boolean {
  return group.id === defaultRemoteGroupId
}

export function TerminalRemoteShortcuts({ onOpenTerminalRequest }: TerminalRemoteShortcutsProps): JSX.Element {
  const [groups, setGroups] = useState<TerminalRemoteGroupRecord[]>([])
  const [hosts, setHosts] = useState<TerminalRemoteHostRecord[]>([])
  const [privateKeys, setPrivateKeys] = useState<SshPrivateKeyRecord[]>([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingGroup, setSavingGroup] = useState(false)
  const [savingHost, setSavingHost] = useState(false)
  const [workingHostId, setWorkingHostId] = useState<string | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [hostModalOpen, setHostModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<TerminalRemoteGroupRecord | null>(null)
  const [editingHost, setEditingHost] = useState<TerminalRemoteHostRecord | null>(null)
  const [groupForm] = Form.useForm<TerminalRemoteGroupForm>()
  const [hostForm] = Form.useForm<TerminalRemoteHostInput>()
  const hasBridge = Boolean(window.forgeDesk)
  const defaultGroup = groups.find(isDefaultRemoteGroup) ?? groups[0] ?? null
  const sections = useMemo(() => createTerminalRemoteGroupSections(groups, hosts, searchText), [groups, hosts, searchText])
  const visibleHostCount = sections.reduce((count, section) => count + section.hosts.length, 0)
  const identityFileOptions = useMemo(() => {
    const options = privateKeys.map((key) => ({
      label: `${key.fileName}${key.hasPassphrase ? ' · 有密码' : ''}`,
      value: key.path
    }))
    const currentIdentityFile = editingHost?.identityFile

    if (currentIdentityFile && !options.some((option) => option.value === currentIdentityFile)) {
      options.unshift({
        label: getPathFileName(currentIdentityFile),
        value: currentIdentityFile
      })
    }

    return options
  }, [editingHost?.identityFile, privateKeys])

  async function refreshRemoteShortcuts(): Promise<void> {
    if (!window.forgeDesk) {
      setGroups([])
      setHosts([])
      setPrivateKeys([])
      return
    }

    setLoading(true)

    try {
      const [nextGroups, nextHosts, gitStatus] = await Promise.all([
        window.forgeDesk.listTerminalRemoteGroups(),
        window.forgeDesk.listTerminalRemoteHosts(),
        window.forgeDesk.getGitSetupStatus()
      ])
      setGroups(nextGroups)
      setHosts(nextHosts)
      setPrivateKeys(gitStatus.sshPrivateKeys)
    } catch (error) {
      message.error(getErrorMessage(error, '读取远程快捷连接失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshRemoteShortcuts().catch((error) => message.error(getErrorMessage(error)))
  }, [])

  function closeGroupModal(): void {
    setGroupModalOpen(false)
    setEditingGroup(null)
    groupForm.resetFields()
  }

  function closeHostModal(): void {
    setHostModalOpen(false)
    setEditingHost(null)
    hostForm.resetFields()
  }

  function openGroupModal(group?: TerminalRemoteGroupRecord): void {
    setEditingGroup(group ?? null)
    groupForm.setFieldsValue({ name: group?.name ?? '' })
    setGroupModalOpen(true)
  }

  function openHostModal(host?: TerminalRemoteHostRecord): void {
    setEditingHost(host ?? null)
    hostForm.setFieldsValue({
      groupId: host?.groupId ?? defaultGroup?.id ?? '',
      host: host?.host ?? '',
      identityFile: host?.identityFile ?? '',
      name: host?.name ?? '',
      notes: host?.notes ?? '',
      port: host?.port ?? 22,
      username: host?.username ?? ''
    })
    setHostModalOpen(true)
  }

  async function saveGroup(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await groupForm.validateFields()
    setSavingGroup(true)

    try {
      await window.forgeDesk.saveTerminalRemoteGroup({ id: editingGroup?.id, name: values.name })
      message.success(editingGroup ? '分组已更新' : '分组已创建')
      closeGroupModal()
      await refreshRemoteShortcuts()
    } catch (error) {
      message.error(getErrorMessage(error, '保存分组失败'))
    } finally {
      setSavingGroup(false)
    }
  }

  async function deleteGroup(group: TerminalRemoteGroupRecord): Promise<void> {
    if (!window.forgeDesk || isDefaultRemoteGroup(group)) {
      return
    }

    try {
      await window.forgeDesk.deleteTerminalRemoteGroup(group.id)
      message.success('分组已删除，连接已移到默认分组')
      await refreshRemoteShortcuts()
    } catch (error) {
      message.error(getErrorMessage(error, '删除分组失败'))
    }
  }

  async function saveHost(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await hostForm.validateFields()
    setSavingHost(true)

    try {
      await window.forgeDesk.saveTerminalRemoteHost({
        ...values,
        id: editingHost?.id,
        groupId: values.groupId || defaultGroup?.id || defaultRemoteGroupId,
        port: values.port ?? 22
      })
      message.success(editingHost ? '远程连接已更新' : '远程连接已创建')
      closeHostModal()
      await refreshRemoteShortcuts()
    } catch (error) {
      message.error(getErrorMessage(error, '保存远程连接失败'))
    } finally {
      setSavingHost(false)
    }
  }

  async function deleteHost(host: TerminalRemoteHostRecord): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setWorkingHostId(host.id)

    try {
      const nextHosts = await window.forgeDesk.deleteTerminalRemoteHost(host.id)
      setHosts(nextHosts)
      message.success('远程连接已删除')
    } catch (error) {
      message.error(getErrorMessage(error, '删除远程连接失败'))
    } finally {
      setWorkingHostId(null)
    }
  }

  async function openRemoteHost(host: TerminalRemoteHostRecord): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setWorkingHostId(host.id)

    try {
      const command = await window.forgeDesk.getTerminalRemoteSshCommand(host.id)
      onOpenTerminalRequest({
        reuseKey: `terminal-remote:${host.id}`,
        startupCommand: `${command}\r`,
        title: host.name
      })
    } catch (error) {
      message.error(getErrorMessage(error, '打开远程连接失败'))
    } finally {
      setWorkingHostId(null)
    }
  }

  return (
    <aside className="terminal-remote-sidebar" aria-label="远程快捷连接">
      <div className="terminal-remote-heading">
        <Space direction="vertical" size={0}>
          <Typography.Text strong>远程</Typography.Text>
          <Typography.Text type="secondary">{visibleHostCount} 个快捷连接</Typography.Text>
        </Space>
        <Space size={4}>
          <Tooltip title="刷新">
            <Button size="small" type="text" icon={<ReloadOutlined />} loading={loading} onClick={() => refreshRemoteShortcuts().catch((error) => message.error(getErrorMessage(error)))} />
          </Tooltip>
          <Tooltip title="新建分组">
            <Button size="small" type="text" icon={<FolderOpenOutlined />} disabled={!hasBridge} onClick={() => openGroupModal()} />
          </Tooltip>
          <Tooltip title="新建远程">
            <Button size="small" type="primary" icon={<PlusOutlined />} disabled={!hasBridge || groups.length === 0} onClick={() => openHostModal()} />
          </Tooltip>
        </Space>
      </div>

      <Input
        allowClear
        className="terminal-remote-search"
        disabled={!hasBridge}
        prefix={<SearchOutlined />}
        placeholder="搜索远程"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
      />

      <div className="terminal-remote-list">
        {loading ? (
          <div className="terminal-remote-state">
            <Spin />
          </div>
        ) : sections.length > 0 ? (
          sections.map((section) => (
            <section className="terminal-remote-group" key={section.group.id}>
              <div className="terminal-remote-group-header">
                <div className="terminal-remote-group-title">
                  <FolderOpenOutlined />
                  <Typography.Text>{section.group.name}</Typography.Text>
                  <span>{section.hosts.length}</span>
                </div>
                <Space size={2}>
                  <Tooltip title="编辑分组">
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openGroupModal(section.group)} />
                  </Tooltip>
                  {!isDefaultRemoteGroup(section.group) ? (
                    <Popconfirm
                      overlayClassName="terminal-remote-popconfirm"
                      title="删除这个分组？"
                      description="连接会移动到默认分组。"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => deleteGroup(section.group)}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ) : null}
                </Space>
              </div>
              <div className="terminal-remote-host-list">
                {section.hosts.length > 0 ? (
                  section.hosts.map((host) => (
                    <div className="terminal-remote-host-row" key={host.id}>
                      <button className="terminal-remote-host" type="button" onClick={() => openRemoteHost(host)}>
                        <span className="terminal-remote-host-icon">
                          <CodeOutlined />
                        </span>
                        <span className="terminal-remote-host-main">
                          <span className="terminal-remote-host-name">{host.name}</span>
                          <span className="terminal-remote-host-target">{formatTerminalRemoteTarget(host)}</span>
                          {host.identityFile ? (
                            <span className="terminal-remote-host-key">
                              <KeyOutlined /> {getPathFileName(host.identityFile)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <Space size={2} className="terminal-remote-host-actions">
                        <Tooltip title="编辑">
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openHostModal(host)} />
                        </Tooltip>
                        <Popconfirm
                          overlayClassName="terminal-remote-popconfirm"
                          title="删除这个远程连接？"
                          okText="删除"
                          cancelText="取消"
                          onConfirm={() => deleteHost(host)}
                        >
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} loading={workingHostId === host.id} />
                        </Popconfirm>
                      </Space>
                    </div>
                  ))
                ) : (
                  <div className="terminal-remote-empty-group">暂无连接</div>
                )}
              </div>
            </section>
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={hasBridge ? '还没有远程快捷连接' : '需要在 ForgeDesk 桌面端使用'}
          />
        )}
      </div>

      <Modal
        className="terminal-remote-modal"
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={groupModalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingGroup}
        onOk={saveGroup}
        onCancel={closeGroupModal}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="生产 / 测试 / 客户项目" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="terminal-remote-modal"
        title={editingHost ? '编辑远程连接' : '新建远程连接'}
        open={hostModalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingHost}
        width={560}
        onOk={saveHost}
        onCancel={closeHostModal}
      >
        <Form form={hostForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入连接名称' }]}>
            <Input placeholder="prod-api-01" />
          </Form.Item>
          <Form.Item name="groupId" label="分组" rules={[{ required: true, message: '请选择分组' }]}>
            <Select popupClassName="terminal-remote-select-popup" options={groups.map((group) => ({ label: group.name, value: group.id }))} />
          </Form.Item>
          <div className="terminal-remote-endpoint-grid">
            <Form.Item name="username" label="用户">
              <Input placeholder="deploy" />
            </Form.Item>
            <Form.Item name="host" label="Host" rules={[{ required: true, message: '请输入 Host' }]}>
              <Input placeholder="example.com" />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ type: 'number', min: 1, max: 65535, message: '端口范围 1-65535' }]}>
              <InputNumber min={1} max={65535} precision={0} />
            </Form.Item>
          </div>
          <Form.Item name="identityFile" label="私钥">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={identityFileOptions}
              popupClassName="terminal-remote-select-popup"
              placeholder={identityFileOptions.length > 0 ? '选择已有私钥' : '未检测到本机私钥'}
            />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="用途、环境或跳板说明" />
          </Form.Item>
        </Form>
      </Modal>
    </aside>
  )
}
