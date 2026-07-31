import {
  CodeOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined
} from '@ant-design/icons'
import { Button, Card, Drawer, Empty, Input, Modal, Popconfirm, Space, Spin, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import type { CodexSite, CodexSessionSummary } from './data'
import { getErrorMessage } from './error-messages'

type CodexSitesPanelProps = {
  open: boolean
  onClose: () => void
  selectedSession: CodexSessionSummary | null
  sessionRunning: boolean
}

const siteStatusLabels: Record<CodexSite['status'], string> = {
  building: 'Codex 构建中',
  draft: '草稿',
  error: '需要处理',
  previewing: '预览中',
  published: '已发布',
  ready: '可预览'
}

function siteStatusColor(status: CodexSite['status']): string | undefined {
  if (status === 'building' || status === 'previewing') return 'processing'
  if (status === 'published' || status === 'ready') return 'green'
  if (status === 'error') return 'red'
  return undefined
}

function formatSiteTime(value: string): string {
  if (!value) return '未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString()
}

export function CodexSitesPanel({ open, onClose, selectedSession, sessionRunning }: CodexSitesPanelProps): JSX.Element {
  const [sites, setSites] = useState<CodexSite[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [workingSiteId, setWorkingSiteId] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [publishSite, setPublishSite] = useState<CodexSite | null>(null)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')

  async function loadSites(showLoading = true): Promise<void> {
    if (!window.forgeDesk) return
    if (showLoading) setLoading(true)
    else setRefreshing(true)
    try {
      setSites(await window.forgeDesk.listCodexSites())
    } catch (error) {
      message.error(getErrorMessage(error, '读取 Sites 失败'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!open) return
    loadSites().catch(() => undefined)
  }, [open])

  function openCreateModal(): void {
    setName('')
    setPrompt('')
    setWorkspacePath(selectedSession?.cwd || '')
    setCreateModalOpen(true)
  }

  async function chooseWorkspace(): Promise<void> {
    try {
      const path = await window.forgeDesk?.selectDirectory()
      if (path) setWorkspacePath(path)
    } catch (error) {
      message.error(getErrorMessage(error, '选择站点目录失败'))
    }
  }

  async function createSite(): Promise<void> {
    if (!window.forgeDesk) return
    setCreating(true)
    try {
      const site = await window.forgeDesk.createCodexSite({
        linkedSessionId: selectedSession?.id,
        name,
        prompt,
        workspacePath
      })
      setSites((current) => [site, ...current.filter((item) => item.id !== site.id)])
      setCreateModalOpen(false)
      message.success('站点草稿已创建')
    } catch (error) {
      message.error(getErrorMessage(error, '创建站点失败'))
    } finally {
      setCreating(false)
    }
  }

  async function askCodexToBuild(site: CodexSite): Promise<void> {
    if (!window.forgeDesk || !selectedSession) {
      message.warning('请先选中一个 Codex 会话')
      return
    }
    if (selectedSession.archived) {
      message.warning('已归档的 Codex 会话不能继续构建站点')
      return
    }
    if (sessionRunning) {
      message.info('当前 Codex 会话正在运行，请等待完成后再提交站点任务')
      return
    }
    setWorkingSiteId(site.id)
    try {
      const buildingSite = await window.forgeDesk.updateCodexSite({ id: site.id, linkedSessionId: selectedSession.id, lastError: '', status: 'building' })
      setSites((current) => current.map((item) => item.id === buildingSite.id ? buildingSite : item))
      await window.forgeDesk.sendCodexSessionMessage({
        content: [
          `请直接在工作目录 ${site.workspacePath} 中创建或完善一个可运行的网站站点「${site.name}」。`,
          site.prompt || '请先检查现有项目结构，再实现一个清晰、响应式、可预览的页面。',
          '请实际修改代码并运行必要的检查，不要只输出方案。完成后说明本地预览命令和入口。'
        ].join('\n'),
        sessionId: selectedSession.id
      })
      message.success('已把站点任务交给当前 Codex 会话')
    } catch (error) {
      const failedSite = await window.forgeDesk.updateCodexSite({ id: site.id, lastError: getErrorMessage(error, 'Codex 构建站点失败'), status: 'error' }).catch(() => null)
      if (failedSite) setSites((current) => current.map((item) => item.id === failedSite.id ? failedSite : item))
      message.error(getErrorMessage(error, 'Codex 构建站点失败'))
    } finally {
      setWorkingSiteId('')
    }
  }

  async function previewSite(site: CodexSite): Promise<void> {
    if (!window.forgeDesk) return
    setWorkingSiteId(site.id)
    try {
      const nextSite = site.status === 'previewing' && site.previewUrl
        ? site
        : await window.forgeDesk.startCodexSitePreview(site.id)
      setSites((current) => current.map((item) => item.id === nextSite.id ? nextSite : item))
      await window.forgeDesk.openExternalUrl(nextSite.previewUrl)
    } catch (error) {
      message.error(getErrorMessage(error, '启动站点预览失败'))
      await loadSites(false)
    } finally {
      setWorkingSiteId('')
    }
  }

  async function stopSitePreview(site: CodexSite): Promise<void> {
    if (!window.forgeDesk) return
    setWorkingSiteId(site.id)
    try {
      const nextSite = await window.forgeDesk.stopCodexSitePreview(site.id)
      if (nextSite) setSites((current) => current.map((item) => item.id === nextSite.id ? nextSite : item))
    } catch (error) {
      message.error(getErrorMessage(error, '停止站点预览失败'))
    } finally {
      setWorkingSiteId('')
    }
  }

  function openPublishedModal(site: CodexSite): void {
    setPublishSite(site)
    setPublishedUrl(site.publishedUrl)
  }

  async function savePublishedUrl(): Promise<void> {
    if (!window.forgeDesk || !publishSite) return
    setWorkingSiteId(publishSite.id)
    try {
      const nextSite = await window.forgeDesk.updateCodexSite({ id: publishSite.id, publishedUrl, status: publishedUrl.trim() ? 'published' : 'ready', lastError: '' })
      setSites((current) => current.map((item) => item.id === nextSite.id ? nextSite : item))
      setPublishSite(null)
      message.success(publishedUrl.trim() ? '发布链接已保存' : '已清除发布链接')
    } catch (error) {
      message.error(getErrorMessage(error, '保存发布链接失败'))
    } finally {
      setWorkingSiteId('')
    }
  }

  async function removeSite(site: CodexSite): Promise<void> {
    if (!window.forgeDesk) return
    try {
      setSites(await window.forgeDesk.deleteCodexSite(site.id))
      message.success('站点已删除')
    } catch (error) {
      message.error(getErrorMessage(error, '删除站点失败'))
    }
  }

  return (
    <>
      <Drawer
        className="codex-sites-drawer"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建站点</Button>}
        onClose={onClose}
        open={open}
        title={<Space><GlobalOutlined /> Sites</Space>}
        width={560}
      >
        <div className="codex-sites-intro">
          <Typography.Text strong>从 Codex 对话创建可预览的网站</Typography.Text>
          <Typography.Paragraph type="secondary">
            先建立站点草稿，再让当前 Codex 会话直接修改工作目录。ForgeDesk 负责本地预览和链接管理；正式部署继续使用项目中的 Vercel、SSH / PM2 或 Docker 发布配置。
          </Typography.Paragraph>
        </div>
        <div className="codex-sites-toolbar">
          <Typography.Text type="secondary">{sites.length} 个站点</Typography.Text>
          <Button type="text" icon={<ReloadOutlined />} loading={refreshing} onClick={() => loadSites(false)}>刷新</Button>
        </div>
        {loading ? <div className="codex-sites-loading"><Spin /></div> : sites.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有站点"><Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>创建第一个站点</Button></Empty>
        ) : (
          <div className="codex-sites-list">
            {sites.map((site) => {
              const busy = workingSiteId === site.id
              return (
                <Card className="codex-site-card" key={site.id} size="small">
                  <div className="codex-site-card-heading">
                    <div>
                      <Typography.Text strong>{site.name}</Typography.Text>
                      <Typography.Text type="secondary">更新于 {formatSiteTime(site.updatedAt)}</Typography.Text>
                    </div>
                    <Tag color={siteStatusColor(site.status)}>{siteStatusLabels[site.status]}</Tag>
                  </div>
                  <Typography.Paragraph className="codex-site-card-prompt" ellipsis={{ rows: 3 }}>{site.prompt || '未填写站点描述'}</Typography.Paragraph>
                  <Typography.Text className="codex-site-card-path" type="secondary" title={site.workspacePath}><FolderOpenOutlined /> {site.workspacePath}</Typography.Text>
                  {site.lastError ? <Typography.Text className="codex-site-card-error" type="danger">{site.lastError}</Typography.Text> : null}
                  <div className="codex-site-card-actions">
                    <Button icon={<SendOutlined />} loading={busy && site.status === 'building'} onClick={() => askCodexToBuild(site)}>交给 Codex</Button>
                    {site.status === 'previewing' ? <Button icon={<StopOutlined />} loading={busy} onClick={() => stopSitePreview(site)}>停止预览</Button> : <Button icon={<PlayCircleOutlined />} loading={busy} onClick={() => previewSite(site)}>本地预览</Button>}
                    <Button icon={<LinkOutlined />} onClick={() => openPublishedModal(site)}>发布链接</Button>
                    <Popconfirm title="删除这个站点记录？" description="不会删除工作目录中的代码。" okText="删除" cancelText="取消" onConfirm={() => removeSite(site)}>
                      <Button danger type="text" icon={<DeleteOutlined />} aria-label={`删除站点 ${site.name}`} />
                    </Popconfirm>
                  </div>
                  {site.publishedUrl ? <Button className="codex-site-published-link" type="link" icon={<GlobalOutlined />} onClick={() => window.forgeDesk?.openExternalUrl(site.publishedUrl)}>打开已发布站点</Button> : null}
                </Card>
              )
            })}
          </div>
        )}
        <div className="codex-sites-note"><CodeOutlined /> 站点代码保存在你选择的本地工作目录中，删除记录不会删除代码。</div>
      </Drawer>

      <Modal
        cancelText="取消"
        okButtonProps={{ loading: creating, disabled: !name.trim() || !workspacePath.trim() }}
        okText="创建站点"
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createSite()}
        open={createModalOpen}
        title="新建 Codex Site"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div><Typography.Text strong>站点名称</Typography.Text><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：项目发布看板" /></div>
          <div><Typography.Text strong>工作目录</Typography.Text><Space.Compact style={{ width: '100%' }}><Input value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} placeholder="选择一个已有的前端项目目录" /><Button icon={<FolderOpenOutlined />} onClick={() => chooseWorkspace()}>选择</Button></Space.Compact></div>
          <div><Typography.Text strong>告诉 Codex 要做什么</Typography.Text><Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述页面、用户、数据、交互和视觉要求" /></div>
          <Typography.Text type="secondary">建议选择已有前端项目目录；Codex 会在这个目录中创建或修改站点代码。</Typography.Text>
        </Space>
      </Modal>

      <Modal
        cancelText="取消"
        okText="保存链接"
        onCancel={() => setPublishSite(null)}
        onOk={() => savePublishedUrl()}
        open={Boolean(publishSite)}
        title="管理发布链接"
      >
        <Typography.Paragraph type="secondary">正式部署请使用项目发布配置完成，然后把生成的 http/https 地址保存到这里，便于从 Sites 面板打开和分享。</Typography.Paragraph>
        <Input value={publishedUrl} onChange={(event) => setPublishedUrl(event.target.value)} placeholder="https://example.com" />
      </Modal>
    </>
  )
}
