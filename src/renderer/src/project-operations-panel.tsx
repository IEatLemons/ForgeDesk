import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Collapse, Drawer, Empty, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { ExportOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ProjectService, ProjectServiceDomain, ServiceDeploymentSummary, ServiceEnvironmentLogLine } from './data'
import type { ColumnsType } from 'antd/es/table'
import { emptyServiceOperations, isOperationsStale, type OperationsSourceState } from '../../shared/project-operations'
import { deploymentLabel, domainHealth, latestDeployment, operationsEnvironmentOrder, operationsServiceOrder, operationsUrl } from './project-operations-view'
import { useProjectOperations } from './use-project-operations'
import { projectPage, type AppRoute, type ProjectPage } from './workspace-navigation'
import { getErrorMessage } from './error-messages'
import { OperationsHealthHistory } from './operations-health-history'
import './project-operations.css'

export type OperationsView = 'summary' | 'environments' | 'deployments' | 'monitoring' | 'domains'
type Props = {
  projectId: string
  view: OperationsView
  serviceId?: string
  environmentName?: string
  onNavigate: (route: AppRoute) => void
  onInspect?: (service: ProjectService, tab: string) => void
  onNewDeployment?: () => void
}
const titles: Record<OperationsView, string> = { summary: '部署与运行', environments: '环境与服务', deployments: '部署与发布', monitoring: '日志与监控', domains: '平台域名' }
const sourceLabels = { deployments: '部署历史', environments: '环境', production: '生产指向', domains: '域名' }
const time = (value?: string) => value ? new Date(value).toLocaleString() : '尚未同步'

function DeploymentState({ state }: { state: string }): JSX.Element {
  const meta = deploymentLabel(state)
  return <Tag color={meta.color}>{meta.label}</Tag>
}
function SiteLink({ url, label }: { url?: string; label?: string }): JSX.Element | null {
  const safeUrl = operationsUrl(url || '')
  return safeUrl ? <Button type="link" className="operations-site-link" icon={<ExportOutlined />} title={safeUrl} onClick={() => void window.forgeDesk.openExternalUrl(safeUrl)}>{label || new URL(safeUrl).host}</Button> : null
}
function Freshness({ source }: { source: OperationsSourceState }): JSX.Element {
  return <Typography.Text type={source.error || isOperationsStale(source.updatedAt) ? 'warning' : 'secondary'} className="operations-time">{isOperationsStale(source.updatedAt) ? (source.updatedAt ? '缓存已过期 · ' : '') : ''}同步：{time(source.updatedAt)}{source.retryAt && Date.parse(source.retryAt) > Date.now() ? ` · ${time(source.retryAt)} 后重试` : ''}</Typography.Text>
}

export function ProjectOperationsPanel({ projectId, view, serviceId, environmentName, onNavigate, onInspect, onNewDeployment }: Props): JSX.Element {
  const { data, loading, refreshing, error, refresh } = useProjectOperations(projectId)
  const [serviceFilter, setServiceFilter] = useState(serviceId || '')
  const [environmentFilter, setEnvironmentFilter] = useState(environmentName || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [log, setLog] = useState<{ serviceId: string; title: string; lines: ServiceEnvironmentLogLine[]; error: string; loading: boolean } | null>(null)
  const [logRequest, setLogRequest] = useState(0)
  const logRevision = useRef(0)
  useEffect(() => { setServiceFilter(serviceId || ''); setEnvironmentFilter(environmentName || ''); setStatusFilter(''); setQuery(''); setLog(null) }, [projectId, serviceId, environmentName, view])
  // Drawer unmounts on project changes; stale requests cannot replace a newer selection.
  useEffect(() => () => { logRevision.current++ }, [projectId])
  const services = operationsServiceOrder(data?.services || [])
  const visibleServices = services.filter(service => !serviceFilter || service.id === serviceFilter)
  const environmentNames = [...new Set(visibleServices.flatMap(service => service.environments.map(environment => environment.name)))].sort((a, b) => (a === 'production' ? -1 : b === 'production' ? 1 : a.localeCompare(b)))
  const navigate = (page: ProjectPage, service?: ProjectService, environment?: string) => onNavigate({ ...projectPage(projectId, page), serviceId: service?.id, environmentName: environment })
  const configure = () => navigate('settings-runtime')
  const stateFor = (service: ProjectService) => data?.states[service.id] ?? emptyServiceOperations()
  const environments = services.flatMap(service => service.environments.map(environment => ({ ...environment, source: stateFor(service).sources.environments })))
  const freshEnvironments = environments.filter(environment => !environment.source.error && !isOperationsStale(environment.source.updatedAt))
  const readyCount = freshEnvironments.filter(environment => ['READY', 'SUCCESS'].includes(environment.deploymentStatus)).length
  const failedCount = freshEnvironments.filter(environment => ['ERROR', 'FAILED', 'CRASHED'].includes(environment.deploymentStatus)).length
  const buildingCount = freshEnvironments.filter(environment => ['BUILDING', 'INITIALIZING', 'DEPLOYING', 'QUEUED', 'PENDING'].includes(environment.deploymentStatus)).length
  const unknownCount = environments.length - freshEnvironments.filter(environment => Boolean(environment.deploymentStatus)).length
  const domains = visibleServices.flatMap(service => service.domains.map(domain => ({ ...domain, service }))).filter(domain => !environmentFilter || domain.environmentName === environmentFilter)
  const deployments = visibleServices.flatMap(service => (data?.deployments[service.id] || []).map(deployment => ({ ...deployment, service })))
    .filter(deployment => (!environmentFilter || deployment.target === environmentFilter) && (!statusFilter || deploymentLabel(deployment.state).label === statusFilter) && (!query || `${deployment.service.name} ${deployment.commitSha} ${deployment.url} ${JSON.stringify(deployment.meta)}`.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const metrics = [
    { label: '已绑定服务', value: services.length },
    { label: '环境部署 · 就绪 / 失败', value: `${readyCount} / ${failedCount}` },
    { label: '环境部署 · 进行中 / 未确认', value: `${buildingCount} / ${unknownCount}` },
    { label: '域名健康', value: `${domains.filter(domain => domainHealth(domain).label === '在线').length} / ${domains.filter(domain => domain.enabled).length} 在线` }
  ]

  async function openLogs(service: ProjectService, environment: string, mode: 'build' | 'runtime') {
    const revision = ++logRevision.current
    setLogRequest(revision)
    const production = environment === 'production' ? stateFor(service).production : null
    const title = `${service.name} / ${environment} · ${mode === 'build' ? '最近部署的构建日志' : production ? '生产运行日志' : '最近部署的运行日志'}${mode === 'runtime' && production ? ` · ${production.id}` : ''}`
    setLog({ serviceId: service.id, title, lines: [], error: '', loading: true })
    try {
      const lines = await (mode === 'build' ? window.forgeDesk.listServiceEnvironmentLogs(service.id, environment) : window.forgeDesk.listServiceRuntimeLogs(service.id, environment, production?.id))
      if (revision === logRevision.current) setLog({ serviceId: service.id, title, lines, error: '', loading: false })
    } catch (error) { if (revision === logRevision.current) setLog({ serviceId: service.id, title, lines: [], error: getErrorMessage(error), loading: false }) }
  }
  function sourceErrors(service: ProjectService): JSX.Element | null {
    const errors = Object.entries(stateFor(service).sources).filter(([, source]) => source.error)
    return errors.length ? <Alert showIcon type="warning" className="operations-source-error" message="部分数据同步失败，保留最近结果" description={<Space direction="vertical" size={2}>{errors.map(([key, source]) => <Typography.Text key={key}>{sourceLabels[key as keyof typeof sourceLabels]}：{source.error}<br /><Freshness source={source} /></Typography.Text>)}</Space>} action={<Button size="small" onClick={configure}>检查连接</Button>} /> : null
  }
  function serviceSummary(service: ProjectService): JSX.Element {
    const state = stateFor(service)
    const production = state.production
    const latest = latestDeployment(data?.deployments[service.id] || [])
    const cachedEnvironment = service.environments.find(environment => environment.name === 'production' && environment.latestDeploymentId)
    const healthy = service.domains.filter(domain => domainHealth(domain).label === '在线').length
    const productionUrl = service.domains.find(domain => domain.enabled && domain.environmentName === 'production')?.url || production?.url
    return <Card key={service.id} size="small" className="operations-service-card" title={<Space wrap><Tag>{service.provider === 'vercel' ? '▲ Vercel' : 'Railway'}</Tag><span>{service.externalProjectAlias || service.name}</span>{!service.enabled ? <Tag>已停用</Tag> : null}</Space>} extra={<Button type="link" onClick={() => navigate('environments', service)}>服务详情</Button>}>
      <div className="operations-production">
        <div><Typography.Text type="secondary">当前生产版本</Typography.Text><div className="operations-production-state">{production ? <><DeploymentState state={production.state} />{state.sources.production.error || isOperationsStale(state.sources.production.updatedAt) ? <Tag color="warning">上次确认</Tag> : null}</> : <Tag>未确认</Tag>}{production?.commitSha ? <Typography.Text code copyable>{production.commitSha.slice(0, 7)}</Typography.Text> : null}</div><Freshness source={state.sources.production} /></div>
        <div className="operations-production-address"><SiteLink url={productionUrl} /><Typography.Text type="secondary">{service.domains.some(domain => domain.enabled) ? `域名健康：${healthy} / ${service.domains.filter(domain => domain.enabled).length} 在线` : '尚未配置域名健康检查'}</Typography.Text></div>
        <Space wrap><Button onClick={() => navigate('deployments', service, 'production')}>部署详情</Button><Button icon={<FileTextOutlined />} onClick={() => navigate('monitoring', service, 'production')}>日志</Button></Space>
      </div>
      <div className="operations-latest"><Typography.Text type="secondary">最近一次部署</Typography.Text>{latest ? <><Tag>{latest.target}</Tag><DeploymentState state={latest.state} /><Typography.Text code>{latest.commitSha.slice(0, 7) || '无提交信息'}</Typography.Text><Typography.Text type="secondary">{time(latest.createdAt)}</Typography.Text>{production && production.id !== latest.id ? <Typography.Text type="secondary">与当前生产版本不同</Typography.Text> : null}</> : cachedEnvironment ? <><Tag>production · 环境缓存</Tag><DeploymentState state={cachedEnvironment.deploymentStatus} /><Typography.Text code>{cachedEnvironment.latestCommit.slice(0, 7) || '无提交信息'}</Typography.Text></> : <Typography.Text type="secondary">暂无部署记录</Typography.Text>}<Freshness source={state.sources.deployments} /></div>
      {sourceErrors(service)}
    </Card>
  }
  const domainColumns: ColumnsType<ProjectServiceDomain & { service: ProjectService }> = [
    { title: '域名 / 访问地址', key: 'domain', render: (_, domain) => <div><SiteLink url={domain.url || domain.domain} /><div><Typography.Text type="secondary">{domain.service.name} · {domain.service.provider}</Typography.Text></div></div> },
    { title: '环境', key: 'environment', render: (_, domain) => domain.environmentName || '未关联' },
    { title: '健康状态', key: 'health', render: (_, domain) => <Tag color={domainHealth(domain).color}>{domainHealth(domain).label}</Tag> },
    { title: 'HTTP / 耗时', key: 'response', render: (_, domain) => `${domain.lastStatusCode || '—'} / ${domain.lastCheckedAt ? `${domain.lastResponseMs} ms` : '—'}` },
    { title: '最近检查', key: 'checked', render: (_, domain) => <div>{domain.lastCheckedAt ? time(domain.lastCheckedAt) : '尚未检查'}{domain.lastError ? <div><Typography.Text type="danger">{domain.lastError}</Typography.Text></div> : null}</div> },
    ...(view === 'domains' ? [{ title: '操作', key: 'actions', render: (_: unknown, domain: ProjectServiceDomain & { service: ProjectService }) => <Button size="small" onClick={() => onInspect?.(domain.service, 'domains')}>验证与配置</Button> }] : [])
  ]
  const deploymentColumns: ColumnsType<ServiceDeploymentSummary & { service: ProjectService }> = [
    { title: '部署', key: 'deployment', render: (_, deployment) => <Space direction="vertical" size={2}><Typography.Text strong>{deployment.service.name}</Typography.Text><Typography.Text type="secondary">{deployment.id}</Typography.Text><SiteLink url={deployment.url} /></Space> },
    { title: '环境 / 状态', key: 'state', render: (_, deployment) => <Space wrap><Tag>{deployment.target}</Tag><DeploymentState state={deployment.state} />{stateFor(deployment.service).production?.id === deployment.id ? <Tag color="cyan">当前生产指向</Tag> : null}</Space> },
    { title: '提交 / 分支', key: 'commit', render: (_, deployment) => <Space direction="vertical" size={2}><Typography.Text code copyable={Boolean(deployment.commitSha)}>{deployment.commitSha.slice(0, 7) || '—'}</Typography.Text><Typography.Text>{String(deployment.meta.githubCommitRef || deployment.meta.gitlabCommitRef || deployment.meta.bitbucketCommitRef || '')}</Typography.Text></Space> },
    { title: '创建时间', key: 'created', render: (_, deployment) => time(deployment.createdAt) },
    { title: '操作', key: 'actions', render: (_, deployment) => <Button onClick={() => onInspect?.(deployment.service, 'deployments')}>详情与操作</Button> }
  ]
  const filters = view !== 'summary' ? <div className="operations-filters">
    <Select aria-label="筛选服务" value={serviceFilter} onChange={setServiceFilter} options={[{ value: '', label: '全部服务' }, ...services.map(service => ({ value: service.id, label: `${service.provider} · ${service.name}` }))]} />
    <Select aria-label="筛选环境" value={environmentFilter} onChange={setEnvironmentFilter} options={[{ value: '', label: '全部环境' }, ...environmentNames.map(name => ({ value: name, label: name }))]} />
    {view === 'deployments' ? <><Select aria-label="筛选部署状态" value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: '全部状态' }, ...['部署就绪', '构建 / 部署中', '排队中', '部署失败', '已取消 / 停止'].map(label => ({ value: label, label }))]} /><Input.Search aria-label="搜索部署" placeholder="搜索提交、服务或地址" allowClear value={query} onChange={event => setQuery(event.target.value)} /></> : null}
  </div> : null

  return <section className={`project-operations operations-${view}`} aria-label={titles[view]}>
    <div className="operations-heading"><div><Typography.Title level={view === 'summary' ? 4 : 2}>{titles[view]}</Typography.Title><Typography.Text type="secondary">{view === 'summary' ? '生产指向、最近部署与域名健康' : '平台部署与服务可用性分别展示，状态以最近同步时间为准'}</Typography.Text></div><Space wrap><Button onClick={configure}>运行配置</Button>{onNewDeployment ? <Button type="primary" onClick={onNewDeployment}>新建部署</Button> : null}<Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refresh(true)}>立即刷新</Button></Space></div>
    {error ? <Alert type="error" showIcon message="运行数据读取失败" description={error} action={<Button onClick={() => void refresh(true)}>重试</Button>} /> : null}
    <Spin spinning={loading && !data}>
      {!services.length && !loading ? <Card size="small"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未绑定平台服务"><Button onClick={configure}>绑定 Vercel 或其他服务</Button></Empty></Card> : null}
      {filters}
      {view === 'summary' || view === 'deployments' ? <div className="operations-service-list">{visibleServices.map(serviceSummary)}</div> : null}
      {view === 'environments' || view === 'monitoring' ? <>
        <div className="operations-metrics">{metrics.map(({ label, value }) => <Card size="small" key={label}><Typography.Text type="secondary">{label}</Typography.Text><div className="operations-metric-value">{value}</div></Card>)}</div>
        <Collapse key={services.map(service => service.id).join('|')} defaultActiveKey={services.filter(service => service.enabled).map(service => service.id)} items={visibleServices.map(service => ({ key: service.id, label: <Space wrap><Tag>{service.provider === 'vercel' ? '▲ Vercel' : 'Railway'}</Tag><Typography.Text strong>{service.externalProjectAlias || service.name}</Typography.Text><Typography.Text type="secondary">{service.environments.length} 个环境 · {service.domains.length} 个域名</Typography.Text>{!service.enabled ? <Tag>已停用</Tag> : null}</Space>, children: <>
          {sourceErrors(service)}
          <div className="operations-section-heading"><Typography.Text strong>{view === 'monitoring' ? '环境日志' : '环境与最近部署'}</Typography.Text><Freshness source={stateFor(service).sources.environments} /></div>
          <Table rowKey="id" size="small" pagination={false} scroll={{ x: 760 }} dataSource={operationsEnvironmentOrder(service.environments).filter(environment => !environmentFilter || environment.name === environmentFilter)} columns={[
            { title: '环境', key: 'name', render: (_, environment) => <Tag color={environment.name === 'production' ? 'blue' : undefined}>{environment.name}</Tag> },
            { title: '最近部署', key: 'status', render: (_, environment) => <DeploymentState state={environment.deploymentStatus} /> },
            { title: '提交', key: 'commit', render: (_, environment) => <Typography.Text code>{environment.latestCommit.slice(0, 7) || '—'}</Typography.Text> },
            { title: '访问地址', key: 'url', render: (_, environment) => <SiteLink url={environment.latestDeploymentUrl} /> },
            { title: '操作', key: 'actions', render: (_, environment) => <Space wrap>{view === 'monitoring' ? <><Button size="small" disabled={!environment.latestDeploymentId} onClick={() => void openLogs(service, environment.name, 'build')}>构建日志</Button><Button size="small" disabled={service.provider === 'railway' ? !environment.externalEnvironmentId : !environment.latestDeploymentId && !(environment.name === 'production' && stateFor(service).production)} onClick={() => void openLogs(service, environment.name, 'runtime')}>运行日志</Button></> : <><Button size="small" onClick={() => navigate('deployments', service, environment.name)}>部署</Button><Button size="small" onClick={() => navigate('monitoring', service, environment.name)}>日志</Button></>}</Space> }
          ]} locale={{ emptyText: '尚无环境数据' }} />
          <div className="operations-section-heading"><Typography.Text strong>当前生产指向</Typography.Text><Freshness source={stateFor(service).sources.production} /></div>
          <Space wrap>{stateFor(service).production ? <><DeploymentState state={stateFor(service).production!.state} /><Typography.Text code>{stateFor(service).production!.commitSha.slice(0, 7) || stateFor(service).production!.id}</Typography.Text><SiteLink url={stateFor(service).production!.url} /></> : <Tag>未确认</Tag>}<Button size="small" onClick={() => onInspect?.(service, 'environments')}>服务详情与配置</Button></Space>
        </> }))} />
      </> : null}
      {view === 'deployments' ? <Card title="近期部署历史"><Table rowKey={row => `${row.service.id}:${row.id}`} size="small" dataSource={deployments} columns={deploymentColumns} scroll={{ x: 960 }} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: '没有符合条件的部署记录' }} />{visibleServices.map(service => <div key={service.id} className="operations-section-heading"><Typography.Text type="secondary">{service.name} · 部署历史同步</Typography.Text><Freshness source={stateFor(service).sources.deployments} /></div>)}</Card> : null}
      {view === 'domains' || view === 'monitoring' ? <Card title="域名健康检查" extra={view === 'monitoring' ? <Button onClick={() => navigate('domains')}>管理域名</Button> : null}><Typography.Paragraph type="secondary">由现有后台巡检更新；部署就绪与域名在线分别统计。</Typography.Paragraph>{view === 'domains' ? visibleServices.map(service => <div key={service.id}>{sourceErrors(service)}<div className="operations-section-heading"><Typography.Text type="secondary">{service.name} · 域名同步</Typography.Text><Freshness source={stateFor(service).sources.domains} /></div></div>) : null}<Table rowKey={domain => `${domain.service.id}:${domain.id}`} columns={domainColumns} dataSource={domains} size="small" pagination={false} scroll={{ x: 900 }} locale={{ emptyText: '尚无平台域名，可在服务详情中绑定' }} /></Card> : null}
      {view === 'monitoring' ? <OperationsHealthHistory projectId={projectId} domainIds={domains.filter(domain => domain.enabled).map(domain => domain.id)} /> : null}
    </Spin>
    {view !== 'summary' ? <div className="operations-other-platforms"><Typography.Text type="secondary">添加运行平台</Typography.Text>{!services.some(service => service.provider === 'vercel') ? <Button size="small" onClick={configure}>绑定 Vercel</Button> : null}{!services.some(service => service.provider === 'railway') ? <Button size="small" onClick={configure}>绑定 Railway</Button> : null}</div> : null}
    <Drawer key={logRequest} title={log?.title || '日志'} open={Boolean(log)} width="min(850px, 100vw)" onClose={() => { logRevision.current++; setLog(null) }}><Spin spinning={log?.loading}>{log?.error ? <Alert showIcon type="warning" message="日志暂不可用" description={log.error} /> : !log?.loading && !log?.lines.length ? <Empty description="暂无日志" /> : null}<div className="operations-logs">{log?.lines.map((line, index) => <div key={index}><Typography.Text type="secondary">{time(line.timestamp)}</Typography.Text> <Tag>{line.level || line.source || 'log'}</Tag><pre>{line.message}</pre></div>)}</div></Spin></Drawer>
  </section>
}
