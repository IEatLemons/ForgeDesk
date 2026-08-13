import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  SwapOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from './error-messages'

type AiToolsPanelProps = {
  projectId: string | null
  projectPath: string
  onOpenTerminal?: () => void
}

function formatDate(value: string): string {
  if (!value) return '未记录'
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value
}

function windowLabel(window: QuotaWindow): string {
  const duration = window.windowDurationMins
  if (duration === null) return window.label === 'primary' ? 'Primary' : window.label === 'secondary' ? 'Secondary' : window.label
  if (duration >= 60 * 24 * 3) return `${window.label === 'primary' ? 'Primary' : 'Secondary'} · ${Math.round(duration / (60 * 24))} 天窗口`
  if (duration >= 60) return `${window.label === 'primary' ? 'Primary' : 'Secondary'} · ${Math.round(duration / 60)} 小时窗口`
  return `${window.label === 'primary' ? 'Primary' : 'Secondary'} · ${duration} 分钟窗口`
}

function formatTokenCount(value: string | null | undefined): string {
  if (!value) return '未知'
  const number = Number(value)
  return Number.isSafeInteger(number) ? number.toLocaleString() : value
}

function quotaSourceLabel(snapshot: QuotaSnapshot | null | undefined): string {
  if (!snapshot) return '不可用'
  if (snapshot.source === 'app-server') return snapshot.status === 'unknown' ? '官方未提供' : '实时 · Codex App Server'
  if (snapshot.source === 'session') return '本地 Codex 记录'
  if (snapshot.source === 'cache') return 'ForgeDesk 缓存'
  if (snapshot.source === 'auth') return '本地登录信息'
  return '不可用'
}

function quotaSourceColor(snapshot: QuotaSnapshot | null | undefined): string | undefined {
  if (!snapshot) return undefined
  if (snapshot.status === 'reauth-required') return 'orange'
  if (snapshot.source === 'app-server' && snapshot.status === 'available') return 'green'
  if (snapshot.source === 'session') return 'blue'
  if (snapshot.source === 'cache') return 'gold'
  if (snapshot.status === 'error') return 'red'
  return undefined
}

function quotaProgressColor(remainingPercent: number): string {
  if (remainingPercent <= 10) return '#ff4d4f'
  if (remainingPercent <= 30) return '#faad14'
  return '#3867f2'
}

function quotaResetLabel(window: QuotaWindow): string {
  return window.resetAt ? `重置：${formatDate(window.resetAt)}` : '重置时间未知'
}

function QuotaWindowProgress({ window, compact = false }: { window: QuotaWindow; compact?: boolean }): JSX.Element {
  const remainingPercent = window.remainingPercent
  return (
    <div className={`ai-quota-window${compact ? ' is-compact' : ''}`}>
      <div className="ai-quota-window-heading">
        <span>{windowLabel(window)}</span>
        <strong>{remainingPercent === null ? '未知' : `${remainingPercent}%`}</strong>
      </div>
      {remainingPercent === null ? (
        <div className="ai-quota-progress ai-quota-progress-unknown" aria-label="配额未知" />
      ) : (
        <Progress
          className="ai-quota-progress"
          percent={remainingPercent}
          showInfo={false}
          size={compact ? 'small' : 'default'}
          strokeColor={quotaProgressColor(remainingPercent)}
        />
      )}
      <div className="ai-quota-window-meta">
        <span>{window.usedPercent === null ? '已用未知' : `已用 ${window.usedPercent}%`}</span>
        <span>{quotaResetLabel(window)}</span>
      </div>
    </div>
  )
}

function AccountUsageSummary({ quota, compact = false }: { quota: QuotaSnapshot | null | undefined; compact?: boolean }): JSX.Element {
  const windows = [quota?.primary, quota?.secondary].filter((window): window is QuotaWindow => Boolean(window))
  if (windows.length === 0) {
    return (
      <div className={`ai-account-usage-summary is-empty${compact ? ' is-compact' : ''}`}>
        <span>剩余配额</span>
        <strong>未知</strong>
        <Typography.Text type="secondary">{quota?.message || '等待 Codex 返回真实配额数据'}</Typography.Text>
      </div>
    )
  }
  return (
    <div className={`ai-account-usage-summary${compact ? ' is-compact' : ''}`}>
      {windows.map((window) => <QuotaWindowProgress key={`${window.label}-${window.windowDurationMins ?? 'unknown'}`} window={window} compact={compact} />)}
    </div>
  )
}

export function AiToolsPanel({ projectId, projectPath, onOpenTerminal }: AiToolsPanelProps): JSX.Element {
  const [provider, setProvider] = useState<AiProviderRuntimeSnapshot | null>(null)
  const [accounts, setAccounts] = useState<CodexAccountRegistryView | null>(null)
  const [apiService, setApiService] = useState<CodexApiServiceView | null>(null)
  const [quotaByAccountId, setQuotaByAccountId] = useState<Record<string, QuotaSnapshot | null>>({})
  const [binding, setBinding] = useState<ProjectAiBinding | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [providerAction, setProviderAction] = useState(false)
  const [accountAction, setAccountAction] = useState('')
  const [apiAction, setApiAction] = useState<'start' | 'stop' | 'rotate' | 'health' | ''>('')
  const [accountDrawer, setAccountDrawer] = useState<CodexManagedAccount | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importName, setImportName] = useState('')
  const [importPath, setImportPath] = useState('')
  const [codexDetailsOpen, setCodexDetailsOpen] = useState(false)

  const activeAccount = useMemo(
    () => accounts?.accounts.find((account) => account.active) ?? null,
    [accounts]
  )

  async function refreshProvider(): Promise<void> {
    if (!window.forgeDesk) return
    const providers = await window.forgeDesk.listAiProviders()
    setProvider(providers.find((item) => item.id === 'codex') ?? null)
  }

  async function refreshAccounts(forceRefresh = false): Promise<void> {
    if (!window.forgeDesk) return
    const registry = await window.forgeDesk.listCodexAccounts()
    setAccounts(registry)
    const snapshots = await window.forgeDesk.listAiProviderAccountSnapshots({ providerId: 'codex', refresh: forceRefresh })
    const liveByAccountId = new Map(snapshots.map((snapshot) => [snapshot.account.id, snapshot.live]))
    setAccounts((current) => current ? {
      ...current,
      accounts: current.accounts.map((account) => {
        const live = liveByAccountId.get(account.id)
        return live ? { ...account, email: live.email || account.email, planType: live.planType || account.planType } : account
      })
    } : registry)
    setQuotaByAccountId(Object.fromEntries(snapshots.map((snapshot) => [snapshot.account.id, snapshot.live.quota])))
  }

  async function refreshApiService(): Promise<void> {
    if (!window.forgeDesk) return
    setApiService(await window.forgeDesk.getCodexApiService())
  }

  async function refreshQuota(nextAccountId?: string, showError = false, forceRefresh = false): Promise<void> {
    if (!window.forgeDesk) return
    const accountId = nextAccountId || activeAccount?.id
    if (!accountId) return
    try {
      const next = await window.forgeDesk.getAiProviderQuota({ providerId: 'codex', accountId, refresh: forceRefresh })
      setQuotaByAccountId((current) => ({ ...current, [accountId]: next }))
    } catch (error) {
      setQuotaByAccountId((current) => ({ ...current, [accountId]: null }))
      if (showError) message.warning(`读取 Codex 配额失败：${getErrorMessage(error)}`)
    }
  }

  async function refreshAll(showMessage = false): Promise<void> {
    if (!window.forgeDesk) return
    setRefreshing(true)
    try {
      await Promise.all([refreshProvider(), refreshAccounts(showMessage), refreshApiService()])
      if (projectId) {
        setBinding(await window.forgeDesk.getProjectAiBinding({ projectId, providerId: 'codex' }))
      } else {
        setBinding(null)
      }
      if (showMessage) message.success('AI 工具状态已刷新')
    } catch (error) {
      message.warning(`刷新 AI 工具状态失败：${getErrorMessage(error)}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [projectId])

  async function openCodex(): Promise<void> {
    if (!window.forgeDesk) return
    setProviderAction(true)
    try {
      const result = await window.forgeDesk.openAiProvider({ providerId: 'codex', projectPath })
      if (result.mode === 'app') message.success('已打开 Codex 官方应用')
      else if (result.mode === 'cli') {
        message.success('已在 ForgeDesk 终端中启动 Codex CLI')
        onOpenTerminal?.()
      } else {
        message.info('未检测到 Codex，已打开官方安装页面')
      }
      await refreshProvider()
    } catch (error) {
      message.error(`打开 Codex 失败：${getErrorMessage(error)}`)
    } finally {
      setProviderAction(false)
    }
  }

  async function bindCurrentProject(): Promise<void> {
    if (!window.forgeDesk || !projectId || !projectPath) {
      message.warning('请先选择一个项目')
      return
    }
    try {
      setBinding(await window.forgeDesk.saveProjectAiBinding({ projectId, providerId: 'codex', workspacePath: projectPath }))
      message.success('当前项目已绑定 Codex')
    } catch (error) {
      message.error(`绑定项目失败：${getErrorMessage(error)}`)
    }
  }

  async function chooseImportFile(): Promise<void> {
    if (!window.forgeDesk) return
    const selected = await window.forgeDesk.selectFile()
    if (selected) setImportPath(selected)
  }

  async function importAccount(): Promise<void> {
    if (!window.forgeDesk || !importPath.trim()) {
      message.warning('请选择 Codex auth.json 或 profile 目录')
      return
    }
    setAccountAction('import')
    try {
      setAccounts(await window.forgeDesk.importCodexAccount({ name: importName.trim() || undefined, sourcePath: importPath.trim() }))
      setImportOpen(false)
      setImportName('')
      setImportPath('')
      message.success('Codex 账户已导入')
      await refreshAccounts(true)
      await refreshApiService()
    } catch (error) {
      message.error(`导入 Codex 账户失败：${getErrorMessage(error)}`)
    } finally {
      setAccountAction('')
    }
  }

  async function createAccount(): Promise<void> {
    if (!window.forgeDesk) return
    setAccountAction('create')
    try {
      const previous = new Set(accounts?.accounts.map((account) => account.id) ?? [])
      const registry = await window.forgeDesk.createCodexAccount()
      const account = registry.accounts.find((item) => !previous.has(item.id))
      setAccounts(registry)
      await refreshAccounts(false)
      if (!account) throw new Error('新 Codex 账户 profile 创建失败')
      await window.forgeDesk.openCodexAccountLogin(account.id)
      message.success(`已为「${account.name}」打开登录终端`)
    } catch (error) {
      message.error(`创建 Codex 账户失败：${getErrorMessage(error)}`)
    } finally {
      setAccountAction('')
    }
  }

  async function accountLogin(account: CodexManagedAccount): Promise<void> {
    if (!window.forgeDesk) return
    setAccountAction(`login:${account.id}`)
    try {
      await window.forgeDesk.openCodexAccountLogin(account.id)
      message.success(`已为「${account.name}」打开登录终端`)
    } catch (error) {
      message.error(`打开登录终端失败：${getErrorMessage(error)}`)
    } finally {
      setAccountAction('')
    }
  }

  async function activateAccount(account: CodexManagedAccount): Promise<void> {
    if (!window.forgeDesk) return
    setAccountAction(`activate:${account.id}`)
    try {
      setAccounts(await window.forgeDesk.activateCodexAccount(account.id))
      await refreshApiService()
      await refreshQuota(account.id, true, true)
      message.success(`已切换到「${account.name}」`)
    } catch (error) {
      message.error(`切换账户失败：${getErrorMessage(error)}`)
    } finally {
      setAccountAction('')
    }
  }

  async function verifyAccount(account: CodexManagedAccount): Promise<void> {
    if (!window.forgeDesk) return
    setAccountAction(`verify:${account.id}`)
    try {
      const status = await window.forgeDesk.verifyCodexAccount(account.id)
      if (status.usable) message.success(`${account.name} 验证成功`)
      else message.warning(`${account.name} 暂不可用：${status.message}`)
      await refreshAccounts(true)
    } catch (error) {
      message.error(`验证账户失败：${getErrorMessage(error)}`)
    } finally {
      setAccountAction('')
    }
  }

  async function removeAccount(account: CodexManagedAccount): Promise<void> {
    if (!window.forgeDesk) return
    setAccountAction(`remove:${account.id}`)
    try {
      setAccounts(await window.forgeDesk.removeCodexAccount(account.id))
      await refreshAccounts(false)
      await refreshApiService()
      message.success('账户已从 ForgeDesk 移除')
    } catch (error) {
      message.error(`移除账户失败：${getErrorMessage(error)}`)
    } finally {
      setAccountAction('')
    }
  }

  async function apiActionRun(action: 'start' | 'stop' | 'rotate'): Promise<void> {
    if (!window.forgeDesk) return
    setApiAction(action)
    try {
      const next = action === 'start'
        ? await window.forgeDesk.startCodexApiService()
        : action === 'stop'
          ? await window.forgeDesk.stopCodexApiService()
          : await window.forgeDesk.rotateCodexApiKey()
      setApiService(next)
      message.success(action === 'start' ? '本机 Codex API 服务已启动' : action === 'stop' ? '本机 Codex API 服务已停止' : 'API Key 已轮换')
    } catch (error) {
      message.error(`API 服务操作失败：${getErrorMessage(error)}`)
    } finally {
      setApiAction('')
    }
  }

  async function healthCheck(): Promise<void> {
    if (!window.forgeDesk) return
    setApiAction('health')
    try {
      const result = await window.forgeDesk.checkCodexApiService()
      if (result.ok) message.success(result.message)
      else message.warning(result.message)
    } catch (error) {
      message.warning(`API 健康检查失败：${getErrorMessage(error)}`)
    } finally {
      setApiAction('')
    }
  }

  if (loading) {
    return <div className="loading-panel"><Spin /></div>
  }

  const activeQuota = activeAccount ? quotaByAccountId[activeAccount.id] : null

  if (!codexDetailsOpen) {
    return (
      <section className="workspace-section ai-tools-shell">
        <div className="workspace-section-header">
          <div>
            <Typography.Title level={2}>AI 工具</Typography.Title>
            <Typography.Paragraph type="secondary">选择一个 AI 工具查看详情。未来可以在这里继续接入 Cursor、本地模型或其他 CLI。</Typography.Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refreshAll(true)}>刷新状态</Button>
        </div>

        <div className="ai-provider-catalog-grid">
          <Card className="ai-provider-catalog-card" hoverable onClick={() => setCodexDetailsOpen(true)}>
            <div className="ai-provider-catalog-leading">
              <div className="ai-provider-icon"><SafetyCertificateOutlined /></div>
              <div>
                <Space wrap>
                  <Typography.Title level={3} style={{ margin: 0 }}>Codex</Typography.Title>
                  <Tag color={provider?.installed ? 'green' : 'default'}>{provider?.installed ? '已安装' : '未安装'}</Tag>
                  {provider?.authenticated ? <Tag color="blue">已登录</Tag> : <Tag>登录状态未知</Tag>}
                </Space>
                <Typography.Paragraph type="secondary">{provider?.message || '正在检测本机 Codex 环境。'}</Typography.Paragraph>
                <Space wrap size={16}>
                  <Typography.Text type="secondary">版本：{provider?.version || '未读取'}</Typography.Text>
                  <Typography.Text type="secondary">当前账户：{activeAccount?.name || '未设置'}</Typography.Text>
                  <Typography.Text type="secondary">API：{apiService?.running ? '运行中' : '未运行'}</Typography.Text>
                </Space>
              </div>
            </div>
            <Button type="primary" onClick={(event) => { event.stopPropagation(); setCodexDetailsOpen(true) }}>
              查看 Codex 详情
            </Button>
          </Card>

          <Card className="ai-provider-catalog-card ai-provider-catalog-card-placeholder">
            <div className="ai-provider-catalog-leading">
              <div className="ai-provider-icon muted"><PlusOutlined /></div>
              <div>
                <Typography.Title level={3} style={{ margin: 0 }}>更多 AI 工具</Typography.Title>
                <Typography.Paragraph type="secondary">未来可接入 Cursor、其他 CLI 或本地模型，使用同一套项目绑定和运行状态流程。</Typography.Paragraph>
              </div>
            </div>
            <Tag>即将支持</Tag>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section className="workspace-section ai-tools-shell">
      <div className="workspace-section-header">
        <div>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => setCodexDetailsOpen(false)}>返回 AI 工具</Button>
          <Typography.Title level={2}>Codex</Typography.Title>
          <Typography.Paragraph type="secondary">账户与配额是主要信息；本机 API 服务集中在账户管理区，软件状态提供快捷入口，项目绑定位于底部。</Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refreshAll(true)}>刷新状态</Button>
      </div>

      <Row gutter={[16, 16]} className="ai-top-grid">
        <Col xs={24} lg={8}>
          <Card title="Codex 软件信息" className="ai-top-card ai-software-card" extra={<Tag color={provider?.installed ? 'green' : 'default'}>{provider?.installed ? '已安装' : '未安装'}</Tag>}>
            <Space align="start" size={12} className="ai-software-card-content">
              <div className="ai-provider-icon"><SafetyCertificateOutlined /></div>
              <div className="ai-software-card-copy">
                <Space wrap>
                  <Typography.Title level={3} style={{ margin: 0 }}>Codex</Typography.Title>
                  {provider?.authenticated ? <Tag color="blue">已登录</Tag> : <Tag>登录状态未知</Tag>}
                </Space>
                <Typography.Paragraph type="secondary" className="ai-software-card-message">{provider?.message || '正在检测本机 Codex 环境。'}</Typography.Paragraph>
                <Typography.Text type="secondary" className="ai-software-card-version">
                  {provider?.version ? `版本 ${provider.version}` : '版本未读取'}{provider?.command ? ` · ${provider.command}` : ''}
                </Typography.Text>
                <Space wrap className="ai-top-card-actions">
                  <Button type="primary" icon={<PlayCircleOutlined />} loading={providerAction} onClick={() => void openCodex()}>
                    {provider?.installed ? '打开 Codex' : '安装 Codex'}
                  </Button>
                  {!provider?.installed ? <Button icon={<DownloadOutlined />} onClick={() => window.forgeDesk?.openExternalUrl(provider?.installUrl || 'https://openai.com/codex/')}>官方安装页</Button> : null}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="Codex 账号信息" className="ai-top-card ai-account-summary-card" extra={activeAccount ? <Tag color="blue">当前账号</Tag> : <Tag>未设置</Tag>}>
            {activeAccount ? (
              <Space direction="vertical" size={8} className="ai-active-account-summary">
                <Space wrap>
                  <Typography.Title level={3} style={{ margin: 0 }}>{activeAccount.name}</Typography.Title>
                  <Tag color={activeAccount.available ? 'green' : 'default'}>{activeAccount.available ? '可用' : '待验证'}</Tag>
                </Space>
                <Typography.Text type="secondary">{activeQuota?.email || activeAccount.email || activeAccount.accountIdSuffix || '未读取邮箱'}</Typography.Text>
                <div className="ai-active-account-facts">
                  <div><span>账户等级</span><strong>{activeQuota?.planType || activeAccount.planType || '未知'}</strong></div>
                  <div><span>最近使用</span><strong>{formatDate(activeAccount.lastUsedAt)}</strong></div>
                  <div><span>数据状态</span><Tag color={quotaSourceColor(activeQuota)}>{quotaSourceLabel(activeQuota)}</Tag></div>
                </div>
                <AccountUsageSummary quota={activeQuota} compact />
                <Typography.Text type="secondary">
                  {activeQuota?.checkedAt ? `最近检查：${formatDate(activeQuota.checkedAt)}` : '点击右上角刷新状态读取最新数据'}
                </Typography.Text>
                <Button onClick={() => document.getElementById('codex-account-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>管理账户</Button>
              </Space>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有当前 Codex 账户" />}
          </Card>
        </Col>
      </Row>

      <Card
        id="codex-account-management"
        title="Codex 账户管理"
        extra={
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => setImportOpen(true)}>导入账户</Button>
            <Button icon={<UserAddOutlined />} loading={accountAction === 'create'} onClick={() => void createAccount()}>创建并登录</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAccounts(true)}>刷新账户</Button>
          </Space>
        }
      >
        {accounts?.accounts.length ? (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={accounts.accounts}
            renderItem={(account) => {
              const quota = quotaByAccountId[account.id]
              const additionalBuckets = quota?.limitBuckets?.filter((bucket) => bucket.id !== 'codex') || []
              return (
              <List.Item>
                <Card className={`ai-account-card${account.active ? ' active' : ''}`} size="small">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div className="ai-account-card-heading">
                      <Space wrap>
                        <Typography.Text strong>{account.name}</Typography.Text>
                        {account.active ? <Tag color="blue">当前</Tag> : null}
                        <Tag color={account.available ? 'green' : 'default'}>{account.available ? '可用' : '待验证'}</Tag>
                      </Space>
                      <Tag color={quotaSourceColor(quota)}>{quotaSourceLabel(quota)}</Tag>
                    </div>
                    <Typography.Text type="secondary">{account.email || account.accountIdSuffix || '未读取邮箱'}</Typography.Text>
                    <div className="ai-account-card-facts">
                      <div><span>账户等级</span><strong>{quota?.planType || account.planType || '未知'}</strong></div>
                      <div><span>最近使用</span><strong>{formatDate(account.lastUsedAt)}</strong></div>
                    </div>
                    <div className="ai-account-quota">
                      <div className="ai-account-quota-heading">
                        <span>剩余配额</span>
                        <Typography.Text type="secondary">{quota?.checkedAt ? `更新于 ${formatDate(quota.checkedAt)}` : '尚未读取'}</Typography.Text>
                      </div>
                      <AccountUsageSummary quota={quota} />
                      {quota?.credits ? <Typography.Text type="secondary">Credits：{quota.credits.balance || (quota.credits.unlimited ? '无限' : quota.credits.hasCredits === false ? '无' : '未知')}{quota.credits.availableCount !== null ? ` · 可用重置 ${quota.credits.availableCount}` : ''}</Typography.Text> : null}
                      {quota?.usage?.summary ? <div className="ai-account-usage-stats"><span>累计 Token <strong>{formatTokenCount(quota.usage.summary.lifetimeTokens)}</strong></span><span>连续使用 <strong>{quota.usage.summary.currentStreakDays || '未知'} 天</strong></span></div> : null}
                      {additionalBuckets.length ? <div className="ai-account-additional-limits">{additionalBuckets.map((bucket) => <div key={bucket.id}><span>{bucket.name || bucket.id}</span>{bucket.primary ? <QuotaWindowProgress window={bucket.primary} compact /> : <Typography.Text type="secondary">官方未提供窗口</Typography.Text>}</div>)}</div> : null}
                      <Typography.Text type="secondary">{quota?.message || '等待 Codex 返回真实配额数据。'}</Typography.Text>
                      {quota?.status === 'reauth-required' ? <Button size="small" icon={<LinkOutlined />} loading={accountAction === `login:${account.id}`} onClick={() => void accountLogin(account)}>重新登录并刷新</Button> : null}
                    </div>
                    <Card size="small" className="ai-account-api-card" title="本机 Codex API 服务" extra={<Tag color={account.active && apiService?.running ? 'green' : 'default'}>{account.active && apiService?.running ? '运行中' : account.active ? '未运行' : '切换后管理'}</Tag>}>
                      {account.active ? (
                        <>
                          <Descriptions size="small" column={1} bordered>
                            <Descriptions.Item label="Base URL">{apiService?.baseUrl || '未设置'}</Descriptions.Item>
                            <Descriptions.Item label="模型">{apiService?.model || '未设置'}</Descriptions.Item>
                            <Descriptions.Item label="API Key"><Space><LockOutlined />{apiService?.apiKeyMasked || '未设置'}</Space></Descriptions.Item>
                          </Descriptions>
                          <Space wrap className="ai-api-actions">
                            {apiService?.running ? <Button size="small" icon={<StopOutlined />} loading={apiAction === 'stop'} onClick={() => void apiActionRun('stop')}>停止</Button> : <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={apiAction === 'start'} onClick={() => void apiActionRun('start')}>启动</Button>}
                            <Button size="small" icon={<KeyOutlined />} loading={apiAction === 'rotate'} onClick={() => void apiActionRun('rotate')}>轮换 Key</Button>
                            <Button size="small" icon={<CheckCircleOutlined />} loading={apiAction === 'health'} onClick={() => void healthCheck()}>健康检查</Button>
                          </Space>
                          <Typography.Text type="secondary">{apiService?.message || 'API Key 只显示脱敏结果，完整 Key 不会返回渲染层。'}</Typography.Text>
                        </>
                      ) : <Typography.Text type="secondary">本机 API 服务跟随当前账号运行。切换到此账户后即可启动、停止或检查服务。</Typography.Text>}
                    </Card>
                    <Space wrap>
                      <Button size="small" onClick={() => setAccountDrawer(account)}>详情</Button>
                      {!account.active ? <Button size="small" icon={<SwapOutlined />} loading={accountAction === `activate:${account.id}`} onClick={() => void activateAccount(account)}>切换</Button> : null}
                      <Button size="small" icon={<LinkOutlined />} loading={accountAction === `login:${account.id}`} onClick={() => void accountLogin(account)}>登录</Button>
                      <Button size="small" icon={<CheckCircleOutlined />} loading={accountAction === `verify:${account.id}`} onClick={() => void verifyAccount(account)}>验证</Button>
                      <Popconfirm title="从 ForgeDesk 移除这个账户？" onConfirm={() => void removeAccount(account)}>
                        <Button size="small" danger icon={<DeleteOutlined />} loading={accountAction === `remove:${account.id}`}>移除</Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Card>
              </List.Item>
              )
            }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={accounts?.message || '还没有 Codex 账户'} />
        )}
      </Card>

      <Card title="Codex 项目" extra={binding ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag>}>
        {projectId ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text>{projectPath || '当前项目目录未设置'}</Typography.Text>
            <Typography.Text type="secondary">绑定关系只保存在 ForgeDesk，不会写入 Codex 私有项目数据。</Typography.Text>
            <Button icon={<LinkOutlined />} onClick={() => void bindCurrentProject()}>
              {binding ? '更新绑定目录' : '绑定当前项目'}
            </Button>
          </Space>
        ) : <Alert type="info" showIcon message="请先在项目模块选择一个项目" />}
      </Card>

      <Drawer title={accountDrawer ? `账户详情 · ${accountDrawer.name}` : '账户详情'} width={420} open={Boolean(accountDrawer)} onClose={() => setAccountDrawer(null)}>
        {accountDrawer ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="名称">{accountDrawer.name}</Descriptions.Item>
            <Descriptions.Item label="来源">{accountDrawer.source === 'local' ? '本机账户' : '导入账户'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{accountDrawer.email || '未读取'}</Descriptions.Item>
            <Descriptions.Item label="套餐">{quotaByAccountId[accountDrawer.id]?.planType || accountDrawer.planType || '未知'}</Descriptions.Item>
            <Descriptions.Item label="账户 ID">{accountDrawer.accountId || '未读取'}</Descriptions.Item>
            <Descriptions.Item label="Profile 目录">{accountDrawer.codexHome}</Descriptions.Item>
            <Descriptions.Item label="认证方式">{accountDrawer.authMode || '未知'}</Descriptions.Item>
            <Descriptions.Item label="最后更新">{formatDate(accountDrawer.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="Access Token">{accountDrawer.accessTokenConfigured ? '已配置（已隐藏）' : '未配置'}</Descriptions.Item>
            <Descriptions.Item label="Refresh Token">{accountDrawer.refreshTokenConfigured ? '已配置（已隐藏）' : '未配置'}</Descriptions.Item>
            <Descriptions.Item label="数据来源">{quotaSourceLabel(quotaByAccountId[accountDrawer.id])}</Descriptions.Item>
            <Descriptions.Item label="配额状态">{quotaByAccountId[accountDrawer.id]?.message || '尚未读取'}</Descriptions.Item>
            <Descriptions.Item label="Primary">{quotaByAccountId[accountDrawer.id]?.primary ? `${quotaByAccountId[accountDrawer.id]?.primary?.usedPercent ?? '未知'}% 已使用，${quotaByAccountId[accountDrawer.id]?.primary?.resetAt ? `重置于 ${formatDate(quotaByAccountId[accountDrawer.id]?.primary?.resetAt || '')}` : '重置时间未知'}` : '官方未提供'}</Descriptions.Item>
            <Descriptions.Item label="Secondary">{quotaByAccountId[accountDrawer.id]?.secondary ? `${quotaByAccountId[accountDrawer.id]?.secondary?.usedPercent ?? '未知'}% 已使用，${quotaByAccountId[accountDrawer.id]?.secondary?.resetAt ? `重置于 ${formatDate(quotaByAccountId[accountDrawer.id]?.secondary?.resetAt || '')}` : '重置时间未知'}` : '官方未提供'}</Descriptions.Item>
            {(quotaByAccountId[accountDrawer.id]?.limitBuckets || []).filter((bucket) => bucket.id !== 'codex').map((bucket) => <Descriptions.Item key={bucket.id} label={bucket.name || bucket.id}>{bucket.primary ? `${bucket.primary.usedPercent ?? '未知'}% 已使用${bucket.primary.resetAt ? ` · ${formatDate(bucket.primary.resetAt)}` : ''}` : '官方未提供'}</Descriptions.Item>)}
            <Descriptions.Item label="累计 Token">{formatTokenCount(quotaByAccountId[accountDrawer.id]?.usage?.summary?.lifetimeTokens)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal title="导入 Codex 账户" open={importOpen} confirmLoading={accountAction === 'import'} onCancel={() => setImportOpen(false)} onOk={() => void importAccount()} okText="导入">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="账户名称（可选）" value={importName} onChange={(event) => setImportName(event.target.value)} />
          <Input.Search placeholder="选择 auth.json 或 profile 目录" value={importPath} enterButton="选择" onChange={(event) => setImportPath(event.target.value)} onSearch={() => void chooseImportFile()} />
          <Typography.Text type="secondary">ForgeDesk 只读取必要的账户元数据并保存到自己的账户注册表，不会把 token 展示到界面。</Typography.Text>
        </Space>
      </Modal>
    </section>
  )
}
