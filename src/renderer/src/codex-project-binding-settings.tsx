import { DeleteOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Empty, Input, List, Popconfirm, Select, Space, Spin, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { AiProjectResourceLink, CodexProjectMonitorSnapshot, Project } from './data'
import { getErrorMessage } from './error-messages'

type BindingFilter = 'all' | 'bound' | 'unbound' | 'running'

function displayName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path || '未命名项目'
}

export function CodexProjectBindingSettings({ project }: { project: Project }): JSX.Element {
  const [links, setLinks] = useState<AiProjectResourceLink[]>([])
  const [snapshot, setSnapshot] = useState<CodexProjectMonitorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BindingFilter>('all')
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [manualPath, setManualPath] = useState('')

  async function refresh(): Promise<void> {
    if (!window.forgeDesk) return
    setLoading(true)
    try {
      const [nextLinks, nextSnapshot] = await Promise.all([
        window.forgeDesk.listAiProjectResourceLinks({ projectId: project.id, providerId: 'codex' }),
        window.forgeDesk.getCodexProjectMonitorSnapshot()
      ])
      setLinks(nextLinks)
      setSnapshot(nextSnapshot)
      setSelectedPaths((current) => current.filter((path) => nextSnapshot.projects.some((item) => item.cwd === path)))
    } catch (error) {
      message.error(`读取 Codex 项目失败：${getErrorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [project.id])

  const linkedPaths = new Set(links.map((link) => link.resourcePath))
  const projects = useMemo(() => (snapshot?.projects ?? []).filter((item) => {
    const candidate = `${item.cwd}\n${item.forgeProjectName}`.toLowerCase()
    if (query.trim() && !candidate.includes(query.trim().toLowerCase())) return false
    if (filter === 'bound') return Boolean(item.forgeProjectId)
    if (filter === 'unbound') return !item.forgeProjectId
    if (filter === 'running') return item.runningCount > 0
    return true
  }), [filter, query, snapshot])

  async function bindSelected(): Promise<void> {
    if (!window.forgeDesk || selectedPaths.length === 0) return
    setSaving(true)
    try {
      await window.forgeDesk.saveAiProjectResourceLinks({ providerId: 'codex', projectId: project.id, resourcePaths: selectedPaths })
      message.success(`已绑定 ${selectedPaths.length} 个 Codex 项目`)
      setSelectedPaths([])
      await refresh()
    } catch (error) {
      message.error(`绑定 Codex 项目失败：${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  async function bindManualPath(): Promise<void> {
    if (!window.forgeDesk || !manualPath.trim()) return
    setSaving(true)
    try {
      await window.forgeDesk.saveAiProjectResourceLink({ providerId: 'codex', projectId: project.id, resourcePath: manualPath.trim() })
      setManualPath('')
      message.success('已保存 Codex 项目路径')
      await refresh()
    } catch (error) {
      message.error(`保存绑定失败：${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  async function removeLink(link: AiProjectResourceLink): Promise<void> {
    if (!window.forgeDesk) return
    try {
      await window.forgeDesk.deleteAiProjectResourceLink({ providerId: link.providerId, resourcePath: link.resourcePath })
      message.success('已解除 Codex 项目绑定')
      await refresh()
    } catch (error) {
      message.error(`解除绑定失败：${getErrorMessage(error)}`)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div className="panel-title">
        <div><Typography.Title level={4}>Codex 项目绑定</Typography.Title><Typography.Text type="secondary">绑定关系只保存在 ForgeDesk；不会写入 Codex、Git 分支或工作树。</Typography.Text></div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>重新读取</Button>
      </div>
      <Alert type="info" showIcon message={`已绑定 ${links.length} 个 Codex 项目`} description="可一次绑定多个 Codex 原生项目。工作树会自动归属到对应项目，普通会话也会显示在项目详情中。" />
      <Card size="small" title="当前绑定">
        {loading ? <Spin size="small" /> : links.length ? <List size="small" dataSource={links} renderItem={(link) => <List.Item actions={[<Popconfirm key="delete" title="解除该 Codex 项目绑定？" onConfirm={() => void removeLink(link)}><Button size="small" danger icon={<DeleteOutlined />}>解绑</Button></Popconfirm>]}><Space direction="vertical" size={0}><Typography.Text strong>{displayName(link.resourcePath)}</Typography.Text><Typography.Text type="secondary">{link.resourcePath}</Typography.Text></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未绑定 Codex 项目" />}
      </Card>
      <Card size="small" title="发现的 Codex 项目" extra={<Tag>{snapshot?.projects.length ?? 0} 个</Tag>}>
        <Space wrap style={{ marginBottom: 12, width: '100%' }}>
          <Input.Search allowClear placeholder="搜索路径或已关联 ForgeDesk 项目" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 300 }} />
          <Select<BindingFilter> value={filter} onChange={setFilter} style={{ width: 150 }} options={[{ value: 'all', label: '全部项目' }, { value: 'unbound', label: '未绑定' }, { value: 'bound', label: '已绑定' }, { value: 'running', label: '进行中' }]} />
          <Button type="primary" icon={<LinkOutlined />} disabled={selectedPaths.length === 0} loading={saving} onClick={() => void bindSelected()}>绑定所选（{selectedPaths.length}）</Button>
        </Space>
        {loading ? <Spin /> : projects.length ? <Checkbox.Group value={selectedPaths} onChange={(values) => setSelectedPaths(values.map(String))} style={{ width: '100%' }}><List size="small" dataSource={projects} renderItem={(item) => <List.Item><Checkbox value={item.cwd}><Space direction="vertical" size={0}><Space wrap><Typography.Text strong>{displayName(item.cwd)}</Typography.Text>{linkedPaths.has(item.cwd) ? <Tag color="blue">当前项目已绑定</Tag> : item.forgeProjectName ? <Tag>{item.forgeProjectName}</Tag> : <Tag color="orange">未绑定</Tag>}{item.runningCount > 0 ? <Tag color="processing">{item.runningCount} 进行中</Tag> : null}</Space><Typography.Text type="secondary">{item.cwd} · {item.sessionCount} 个会话 · {item.worktrees.length} 个工作树</Typography.Text></Space></Checkbox></List.Item>} /></Checkbox.Group> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的 Codex 项目" />}
      </Card>
      <Card size="small" title="手动绑定路径"><Space.Compact style={{ width: '100%' }}><Input placeholder="/Users/stone/develop/example（尚无会话的项目也可预先绑定）" value={manualPath} onChange={(event) => setManualPath(event.target.value)} onPressEnter={() => void bindManualPath()} /><Button icon={<LinkOutlined />} loading={saving} onClick={() => void bindManualPath()}>绑定</Button></Space.Compact></Card>
    </Space>
  )
}
