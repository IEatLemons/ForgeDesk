import { memo, useState } from 'react'
import { Button, Card, Dropdown, Popover, Select, Tag, Tooltip, Typography } from 'antd'
import { ArrowRightOutlined, BranchesOutlined, CloudOutlined, DownOutlined, InfoCircleOutlined, MoreOutlined, StarFilled, StarOutlined, WarningOutlined } from '@ant-design/icons'
import type { ProjectDirectoryRow } from './project-directory-model'
import type { PortfolioAssessment } from './project-portfolio-view'
import type { ProjectDirectorySummary } from '../../shared/project-directory'
import { taskSummaryLabels, type TaskSummaryFilter } from '../../shared/project-directory'
import { isOperationsStale } from '../../shared/project-operations'
import { runtimeStaleAfterMs } from '../../shared/project-runtime'
import type { Project, ProjectService, ServiceDeploymentSummary } from './data'
import { deploymentLabel, domainHealth, latestDeployment, operationsEnvironmentOrder, operationsServiceOrder, operationsUrl } from './project-operations-view'
import { getMonitorableServiceDomains } from './service-monitor-view'
import { globalPage, projectPage, type AppRoute } from './workspace-navigation'

const stamp = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '尚未同步'
function shortStamp(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '尚未同步'
  const date = new Date(value)
  return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
}
function DeploymentState({ deployment, unconfirmed = false }: { deployment?: ServiceDeploymentSummary | null; unconfirmed?: boolean }) {
  const state = deploymentLabel(deployment?.state || '')
  return <span className={`directory-deployment-state tone-${unconfirmed ? 'default' : state.color}`}><i />{unconfirmed ? '生产指向未确认' : state.label}</span>
}
function ServiceSummary({ service, summary, onNavigate }: { service: ProjectService; summary: ProjectDirectorySummary; onNavigate: (route: AppRoute) => void }) {
  const operations = summary.operations!, state = operations.states[service.id], deployments = operations.deployments[service.id] ?? []
  const names = new Set([...(service.provider === 'vercel' ? ['production'] : []), ...service.environments.map(env => env.name), ...deployments.map(deployment => deployment.target).filter(Boolean)])
  const environments = operationsEnvironmentOrder([...names].map(name => ({ name })))
  const sourceErrors = Object.values(state?.sources ?? {}).filter(source => source.error)
  const errorText = [...new Set(sourceErrors.map(source => source.error + (source.retryAt && Date.parse(source.retryAt) > Date.now() ? `（等待至 ${stamp(source.retryAt)}）` : '')))].join('；')
  const go = (page: 'environments' | 'deployments' | 'monitoring' | 'domains', environmentName = 'production') => onNavigate({ ...projectPage(summary.projectId, page), serviceId: service.id, environmentName })
  function renderEnvironment(name: string) {
    const latest = latestDeployment(deployments, name), production = name === 'production'
    const current = production && service.provider === 'vercel' ? state?.production : latest
    const updatedAt = production && service.provider === 'vercel' ? state?.sources.production.updatedAt : state?.sources.deployments.updatedAt
    const hasSyncTime = !!updatedAt && Number.isFinite(Date.parse(updatedAt))
    const syncLabel = hasSyncTime ? `${shortStamp(updatedAt)}${isOperationsStale(updatedAt) ? ' · 已过期' : ''}` : '未同步'
    const visitUrl = operationsUrl(service.domains.find(domain => (domain.environmentName || 'production') === name && domain.enabled)?.url || current?.url || '')
    const domains = getMonitorableServiceDomains(service).filter(domain => (domain.environmentName || 'production') === name)
    const healthy = domains.filter(domain => domainHealth(domain).label === '在线').length
    const abnormal = domains.filter(domain => ['响应异常', '离线', '检查异常'].includes(domainHealth(domain).label)).length
    const unknown = domains.length - healthy - abnormal
    const lastCheck = domains.map(domain => domain.lastCheckedAt).filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    const differentDeployment = production && latest && latest.id !== current?.id
    return <div className="directory-environment" key={name} data-environment={name}>
      <div className="directory-environment-status">
        <Tooltip title={production && service.provider === 'vercel' ? '当前生产版本 · 通过平台生产指向确认' : `环境：${name} · 环境部署结果`}><button className="directory-environment-name" onClick={() => go('environments', name)}>{name}</button></Tooltip>
        <DeploymentState deployment={current} unconfirmed={production && service.provider === 'vercel' && !current} />
        {current?.commitSha ? <Typography.Text code className="directory-commit">{current.commitSha.slice(0, 7)}</Typography.Text> : null}
      </div>
      {differentDeployment ? <Tooltip title={`最新部署（与当前生产版本不同） · ${latest.commitSha || latest.id}`}><button aria-label="最新部署（与当前生产版本不同）" className={`directory-latest-deployment${deploymentLabel(latest.state).color === 'red' ? ' is-failed' : ''}`} onClick={() => go('deployments', name)}><WarningOutlined />最新部署：{deploymentLabel(latest.state).label}<ArrowRightOutlined /></button></Tooltip> : null}
      <div className="directory-health-row"><button className="directory-health-link" onClick={() => go('domains', name)}><CloudOutlined /><span>域名</span>{domains.length ? <><span className="directory-health-online">{healthy} 在线</span>{abnormal ? <span className="directory-health-error">{abnormal} 异常</span> : null}{unknown ? <span className="directory-health-unknown">{unknown} 未检查／过期</span> : null}</> : <span>未配置检查</span>}</button>{lastCheck ? <Tooltip title={`最后检查：${stamp(lastCheck)}`}><span className="directory-inline-time">检查：{shortStamp(lastCheck)}</span></Tooltip> : null}</div>
      <div className="directory-service-bottom"><Tooltip title={`同步：${stamp(updatedAt)}`}><span className={`directory-inline-time${isOperationsStale(updatedAt) ? ' is-stale' : ''}`}>同步：{syncLabel}</span></Tooltip><div className="directory-service-links">{visitUrl ? <Button type="link" size="small" onClick={() => void window.forgeDesk.openExternalUrl(visitUrl)}>站点 ↗</Button> : null}<Button type="link" size="small" onClick={() => go('deployments', name)}>部署详情</Button><Button type="link" size="small" onClick={() => go('monitoring', name)}>日志</Button></div></div>
      {domains.length ? <details className="directory-domain-details"><summary>域名详情 <span>{domains.length}</span></summary><div>{domains.map(domain => { const health = domainHealth(domain); return <div className="directory-domain" key={domain.id}><Tooltip title={domain.domain}><span className="directory-domain-name">{domain.domain}</span></Tooltip><span className={`directory-domain-state tone-${health.color}`}>{health.label}</span><span className="directory-inline-time" title={stamp(domain.lastCheckedAt)}>检查：{domain.lastCheckedAt ? shortStamp(domain.lastCheckedAt) : '尚未检查'}</span></div> })}</div></details> : null}
    </div>
  }
  return <section className="directory-service" aria-label={`${service.name} 运行摘要`}>
    <div className="directory-summary-line"><span className="directory-provider-label">{service.provider === 'vercel' ? '▲ Vercel' : 'Railway'}</span><Typography.Text ellipsis={{ tooltip: service.name }} strong>{service.name}</Typography.Text>{!service.enabled ? <span className="directory-muted-label">已停用</span> : null}</div>
    {sourceErrors.length ? <div className="directory-inline-notice is-warning"><Tooltip title={`同步异常，显示最近缓存：${errorText}`}><span><WarningOutlined />同步异常，显示缓存</span></Tooltip><Button type="link" size="small" onClick={() => onNavigate(projectPage(summary.projectId, 'settings-runtime'))}>检查服务配置</Button></div> : null}
    {environments.length ? renderEnvironment(environments[0].name) : <div className="directory-inline-notice"><span>尚未同步环境</span><Button type="link" size="small" onClick={() => go('environments', '')}>查看环境</Button></div>}
    {environments.length > 1 ? <details className="directory-other-environments"><summary>其他环境 <span>{environments.length - 1}</span></summary><div>{environments.slice(1).map(env => renderEnvironment(env.name))}</div></details> : null}
  </section>
}

export function DirectoryRuntimeSummary({ summary, projectId, onNavigate }: { summary?: ProjectDirectorySummary; projectId: string; onNavigate: (route: AppRoute) => void }) {
  if (!summary) return <div className="directory-empty-runtime"><CloudOutlined /><span>正在读取线上状态…</span></div>
  const services = operationsServiceOrder(summary.operations?.services ?? [])
  const abnormal = services.filter(service => {
    const state = summary.operations?.states[service.id]
    return Object.values(state?.sources ?? {}).some(source => !!source.error) || (summary.operations?.deployments[service.id] ?? []).some(deployment => deploymentLabel(deployment.state).color === 'red') || service.domains.some(domain => ['离线', '响应异常', '检查异常'].includes(domainHealth(domain).label))
  }).length
  const hasRuntime = services.length > 0 || summary.servers.length > 0
  return <div className={`directory-runtime-summary${!hasRuntime ? ' is-empty' : ''}`}>
    {summary.operationsError || summary.serversError ? <div className="directory-inline-notice is-warning"><Tooltip title={[summary.operationsError, summary.serversError].filter(Boolean).join('；')}><span><WarningOutlined />运行摘要读取失败，已有数据保留</span></Tooltip><Button type="link" size="small" onClick={() => onNavigate(projectPage(projectId, 'settings-runtime'))}>检查配置</Button></div> : null}
    {services.length ? <><div className="directory-runtime-heading"><span>线上运行 <small>{services.length} 个服务</small></span>{abnormal ? <span className="directory-attention-count">{abnormal} 个服务需关注</span> : null}</div><ServiceSummary service={services[0]} summary={summary} onNavigate={onNavigate} />{services.length > 1 ? <details className="directory-more-services"><summary>其余服务 <span>{services.length - 1}</span></summary><div>{services.slice(1).map(service => <ServiceSummary key={service.id} service={service} summary={summary} onNavigate={onNavigate} />)}</div></details> : null}</> : null}
    {summary.servers.map(server => { const stale = server.stale || !server.checkedAt || !Number.isFinite(Date.parse(server.checkedAt)) || Date.now() - Date.parse(server.checkedAt) > runtimeStaleAfterMs; const label = stale || server.error ? '未知／缓存过期' : ({ running: '运行中', stopped: '已停止', degraded: '健康异常', unknown: '未知' })[server.state]; return <div className="directory-server" key={server.targetId}><div className="directory-summary-line"><Typography.Text ellipsis={{ tooltip: server.name }} strong>{server.name}</Typography.Text><span className={`directory-domain-state tone-${!stale && !server.error && server.state === 'running' ? 'green' : 'default'}`}>{label}</span></div><div className="directory-service-bottom"><Tooltip title={`${stamp(server.checkedAt)}${server.error ? ` · ${server.error}` : ''}`}><span className="directory-inline-time">检查：{server.checkedAt ? shortStamp(server.checkedAt) : '尚未检查'}</span></Tooltip><Button type="link" size="small" onClick={() => onNavigate(projectPage(projectId, 'environments'))}>查看服务器</Button></div></div> })}
    {!hasRuntime && !summary.operationsError && !summary.serversError ? <div className="directory-empty-runtime"><CloudOutlined /><span>未接入线上服务</span><Button type="link" size="small" onClick={() => onNavigate(projectPage(projectId, 'settings-runtime'))}>配置线上服务</Button></div> : null}
  </div>
}

function RuntimePulse({ summary, projectId, onNavigate }: { summary?: ProjectDirectorySummary; projectId: string; onNavigate: (route: AppRoute) => void }) {
  const boundServices = summary?.operations?.services ?? []
  const services = operationsServiceOrder(boundServices).filter(service => service.enabled)
  const primary = services[0]
  const go = (page: 'environments' | 'deployments' | 'domains') => onNavigate({ ...projectPage(projectId, page), ...(primary ? { serviceId: primary.id, environmentName: 'production' } : {}) })
  if (!summary) return <div className="portfolio-runtime-pulse"><span className="portfolio-secondary">正在读取运行状态…</span></div>
  if (!services.length && !summary.servers.length) return <div className="portfolio-runtime-pulse"><div className="portfolio-empty-line"><span className="portfolio-secondary">{summary.operationsError || summary.serversError ? '运行状态暂不可用' : boundServices.length ? '线上服务已停用' : '未接入线上服务'}</span><Button type="link" size="small" onClick={() => onNavigate(projectPage(projectId, 'settings-runtime'))}>配置线上服务</Button></div><span className="portfolio-caption">接入后展示生产部署与可用性</span></div>
  const production = services.map(service => service.provider === 'vercel' ? summary.operations?.states[service.id]?.production : latestDeployment(summary.operations?.deployments[service.id] ?? [], 'production'))
  const ready = production.filter(item => item && deploymentLabel(item.state).color === 'green').length
  const failed = production.filter(item => item && deploymentLabel(item.state).color === 'red').length
  const unknown = production.filter(item => !item).length
  const pending = production.filter(item => item && ['blue', 'gold'].includes(deploymentLabel(item.state).color)).length
  const other = production.length - ready - failed - unknown - pending
  const domains = services.flatMap(getMonitorableServiceDomains).filter(domain => domain.enabled)
  const online = domains.filter(domain => domainHealth(domain).label === '在线').length
  const unhealthy = domains.filter(domain => ['离线', '响应异常', '检查异常'].includes(domainHealth(domain).label)).length
  const unchecked = domains.length - online - unhealthy
  const lastCheck = domains.map(domain => domain.lastCheckedAt).filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
  const syncs = services.map(service => { const sources = summary.operations?.states[service.id]?.sources; return service.provider === 'vercel' ? sources?.production.updatedAt : sources?.deployments.updatedAt })
  const stale = syncs.some(value => isOperationsStale(value))
  const synced = syncs.length && syncs.every(value => value && Number.isFinite(Date.parse(value))) ? syncs.reduce((a, b) => Date.parse(a!) < Date.parse(b!) ? a : b) : undefined
  const knownServers = summary.servers.filter(server => !server.stale && !server.error && !isOperationsStale(server.checkedAt ?? undefined, Date.now(), runtimeStaleAfterMs) && server.state !== 'unknown')
  const runningServers = knownServers.filter(server => server.state === 'running').length
  return <div className="portfolio-runtime-pulse">
    {primary ? <Tooltip title={`${services.length} 个服务 · ${services.map(service => service.name).join('、')}`}><button className="portfolio-service-identity" onClick={() => go('environments')}><span className="directory-provider-label">{primary.provider === 'vercel' ? '▲ Vercel' : 'Railway'}</span><span>{primary.name}</span>{services.length > 1 ? <small>+{services.length - 1}</small> : null}</button></Tooltip> : null}
    {services.length ? <div className="portfolio-signal-row"><span>生产部署</span><button onClick={() => go('deployments')} className={failed ? 'portfolio-danger' : ''}>{[ready ? `${ready} 就绪` : '', failed ? `${failed} 失败` : '', pending ? `${pending} 进行中` : '', other ? `${other} 已停止／其他` : '', unknown ? `${unknown} 未确认` : ''].filter(Boolean).join(' · ')}</button></div> : null}
    {services.length ? <div className="portfolio-signal-row"><span>域名健康</span><button onClick={() => go('domains')} className={unhealthy ? 'portfolio-danger' : online && !unchecked ? 'portfolio-success' : ''}>{domains.length ? [online ? `${online} 在线` : '', unhealthy ? `${unhealthy} 异常` : '', unchecked ? `${unchecked} 待检查／过期` : ''].filter(Boolean).join(' · ') : '未配置检查'}</button></div> : null}
    {summary.servers.length ? <div className="portfolio-signal-row"><span>自有服务器</span><button onClick={() => go('environments')}>{[runningServers ? `${runningServers} 运行中` : '', knownServers.length > runningServers ? `${knownServers.length - runningServers} 异常／停止` : '', summary.servers.length > knownServers.length ? `${summary.servers.length - knownServers.length} 未知／过期` : ''].filter(Boolean).join(' · ')}</button></div> : null}
    <div className="portfolio-runtime-stamp">{services.length ? <Tooltip title={`各服务最早的生产同步时间：${stamp(synced)}；部署就绪不等于服务在线。`}><span className={stale ? 'is-stale' : ''}>同步：{synced ? shortStamp(synced) : '未同步'}{stale && synced ? ' · 已过期' : ''}</span></Tooltip> : null}<Tooltip title={`域名最近检查：${stamp(lastCheck)}；各域名检查时间见运行明细。`}><span>检查：{lastCheck ? shortStamp(lastCheck) : '尚未检查'}</span></Tooltip></div>
  </div>
}

function DevelopmentPulse({ row, onNavigate }: { row: ProjectDirectoryRow; onNavigate: (route: AppRoute) => void }) {
  const roots = row.repositories.filter(repository => repository.repositoryKind === 'root')
  const main = roots[0] ?? row.repositories[0]
  return <section className="portfolio-development" aria-label="开发摘要"><div className="portfolio-section-heading"><span><BranchesOutlined />开发</span><Button type="link" size="small" onClick={() => onNavigate(projectPage(row.id, 'repositories'))}>{row.repositories.length ? '查看代码' : '配置仓库'}</Button></div>{main ? <><div className="portfolio-development-metrics"><span><strong>{row.stats.unavailable === row.repositories.length ? '—' : row.changed}</strong> 仓库有改动</span><span><strong>{row.stats.unavailable === row.repositories.length ? '—' : row.ahead}</strong> 仓库未推送</span></div><Tooltip title={`${row.repositories.length} 个仓库 · 最近扫描缓存，未主动 Fetch${main.scanError ? ` · ${main.scanError}` : ''}`}><span className="portfolio-caption portfolio-branch">{row.stats.unavailable ? `${row.stats.unavailable} 个仓库无法读取` : `${row.repositories.length} 个仓库`}{main.currentBranch ? ` · ${main.currentBranch}` : ''} · 扫描缓存</span></Tooltip>{main.latestCommit && !['No commits yet', '不可用'].includes(main.latestCommit) ? <Tooltip title={`最近扫描到的提交：${main.latestCommit}`}><span className="portfolio-caption portfolio-branch">提交：{main.latestCommit}</span></Tooltip> : null}</> : <span className="portfolio-secondary">尚未识别代码仓库</span>}</section>
}

type Props = { row: ProjectDirectoryRow; assessment: PortfolioAssessment; project: Project; summary?: ProjectDirectorySummary; groups: { label: string; value: string }[]; favoriteBusy: boolean; onOpen: (id: string) => void; onNavigate: (route: AppRoute) => void; onFavorite: (project: Project) => void; onGroup: (id: string, group: string) => void; onArchive: (project: Project) => void; onWindow: (id: string) => void; onDelete: (id: string) => void; readError: string }
export const ProjectDirectoryCard = memo(function ProjectDirectoryCard(props: Props) {
  const { project, summary, onNavigate, assessment } = props
  const [groupOpen, setGroupOpen] = useState(false)
  const tasks = summary?.tasks, tasksError = props.readError || tasks?.error
  const group = props.groups.find(item => item.value === (project.groupId ?? '__ungrouped__'))?.label || '未分组'
  const active = !!tasks?.active && !!tasks.counts && !tasksError
  const taskLink = (filter: TaskSummaryFilter) => onNavigate({ ...projectPage(project.id, 'tasks'), taskSummaryFilter: filter })
  const tone = [...project.id].reduce((hash, char) => hash + char.charCodeAt(0), 0) % 4
  const concerns = [...assessment.concerns].sort((a, b) => a.priority - b.priority)
  const concernList = <div className="portfolio-concern-list">{concerns.map((concern, index) => <button key={index} onClick={() => onNavigate(concern.route)}>{concern.label}<ArrowRightOutlined /></button>)}</div>
  const hasRuntime = !!summary && (!!summary.operations?.services.length || !!summary.servers.length)
  return <Card className={`project-directory-card portfolio-project-card status-${assessment.rank}`} data-project-id={project.id}>
    <header className="directory-card-heading"><div className={`directory-project-avatar avatar-tone-${tone}`}>{(Array.from(project.name)[0] || 'P').toLocaleUpperCase()}</div><div className="directory-project-identity"><Tooltip title={<>{project.name}<br />{project.workspacePath}</>}><button className="directory-project-title" onClick={() => props.onOpen(project.id)}>{project.name}</button></Tooltip><div className="portfolio-identity-meta"><Popover title="项目分组" trigger="click" open={groupOpen} onOpenChange={setGroupOpen} content={<Select aria-label={`项目分组：${project.name}`} style={{ width: 200 }} value={project.groupId ?? '__ungrouped__'} options={props.groups} onChange={value => { props.onGroup(project.id, value); setGroupOpen(false) }} />}><button className="directory-group-label" title={group} aria-label={`更改项目分组：${project.name}`}><span>{group}</span><DownOutlined /></button></Popover><span className={`portfolio-status-pill status-${assessment.rank}`}><i />{assessment.label}</span></div></div><div className="directory-card-tools"><Tooltip title={project.isFavorite ? '取消收藏' : '收藏'}><Button size="small" aria-label={`${project.isFavorite ? '取消收藏' : '收藏'}项目 ${project.name}`} aria-pressed={project.isFavorite} type="text" icon={project.isFavorite ? <StarFilled /> : <StarOutlined />} loading={props.favoriteBusy} onClick={() => props.onFavorite(project)} /></Tooltip><Dropdown trigger={['click']} menu={{ items: [{ key: 'window', label: '独立窗口' }, { key: 'archive', label: project.archivedAt ? '恢复项目' : '归档项目' }, { key: 'delete', label: '删除项目', danger: true }], onClick: ({ key }) => key === 'window' ? props.onWindow(project.id) : key === 'archive' ? props.onArchive(project) : props.onDelete(project.id) }}><Button size="small" type="text" icon={<MoreOutlined />} aria-label={`更多项目操作：${project.name}`} /></Dropdown></div></header>

    {concerns.length ? <div className="portfolio-card-concern"><Tooltip title={concerns[0].label}><button className={`concern-${concerns[0].kind}`} onClick={() => onNavigate(concerns[0].route)}>{concerns[0].kind === 'attention' ? <WarningOutlined /> : <InfoCircleOutlined />}<span>{concerns[0].label}</span><ArrowRightOutlined /></button></Tooltip>{concerns.length > 1 ? <Popover title="项目关注事项" trigger="click" content={concernList}><Button type="text" size="small">另 {concerns.length - 1} 项</Button></Popover> : null}</div> : <div className="portfolio-card-concern portfolio-caption">{summary ? '当前记录中暂无需要处理的事项' : '正在读取项目摘要…'}</div>}
    <section className={`directory-task-section${!active ? ' is-unavailable' : ''}`} aria-label="任务摘要">
      <div className="portfolio-section-heading"><span>任务交付</span>{active ? <Button type="link" size="small" onClick={() => onNavigate(projectPage(project.id, 'tasks'))}>全部任务</Button> : null}</div>
      {tasksError ? <div className="directory-inline-notice is-warning"><Tooltip title={tasksError}><span><WarningOutlined />任务状态未知</span></Tooltip><Button type="link" size="small" onClick={() => onNavigate(projectPage(project.id, 'tasks'))}>查看任务</Button></div> : !tasks ? <div className="directory-inline-notice"><span>正在读取任务…</span></div> : !active ? <div className="directory-inline-notice"><span>任务工作区尚未初始化</span><Button type="link" size="small" onClick={() => onNavigate(globalPage('tasks'))}>前往核对</Button></div> : <>
        <div className="directory-task-metrics">{(['todo', 'doing', 'done'] as TaskSummaryFilter[]).map(filter => <button key={filter} className="directory-task-metric" onClick={() => taskLink(filter)} aria-label={`${project.name} ${taskSummaryLabels[filter]} ${tasks.counts![filter]}`}><span>{taskSummaryLabels[filter]}</span><strong>{tasks.counts![filter]}</strong></button>)}</div>
        <div className="directory-task-attention">{(['urgent', 'overdue', 'blocked'] as TaskSummaryFilter[]).filter(filter => tasks.counts![filter] > 0).map(filter => <button key={filter} className="directory-task-metric is-secondary needs-attention" onClick={() => taskLink(filter)} aria-label={`${project.name} ${taskSummaryLabels[filter]} ${tasks.counts![filter]}`}><span>{taskSummaryLabels[filter]}</span><strong>{tasks.counts![filter]}</strong></button>)}{tasks.counts!.awaitingParentCompletion ? <Button type="link" size="small" onClick={() => taskLink('awaitingParentCompletion')}>待完成父任务 {tasks.counts!.awaitingParentCompletion}</Button> : null}</div>
      </>}
    </section>
    <DevelopmentPulse row={props.row} onNavigate={onNavigate} />
    <section className="portfolio-runtime" aria-label="运行概况"><div className="portfolio-section-heading"><span><CloudOutlined />线上运行{hasRuntime ? <small>{(summary?.operations?.services.length ?? 0) + (summary?.servers.length ?? 0)} 个服务</small> : null}</span><Button type="link" size="small" onClick={() => onNavigate(projectPage(project.id, 'environments'))}>查看运行</Button></div><RuntimePulse summary={summary} projectId={project.id} onNavigate={onNavigate} />{hasRuntime ? <details className="portfolio-runtime-details"><summary>运行明细<span>部署 · 环境 · 域名 · 日志</span></summary><DirectoryRuntimeSummary summary={summary} projectId={project.id} onNavigate={onNavigate} /></details> : null}</section>
    <footer className="directory-card-footer"><Tooltip title={active ? `任务读取：${stamp(tasks.updatedAt)}` : project.workspacePath}><span className="directory-check-stamp">{project.owner ? `负责人 · ${project.owner}` : active ? `任务 · ${shortStamp(tasks.updatedAt)}` : '项目空间'}</span></Tooltip><Button type="link" size="small" onClick={() => props.onOpen(project.id)}>进入项目<ArrowRightOutlined /></Button></footer>
  </Card>
})
