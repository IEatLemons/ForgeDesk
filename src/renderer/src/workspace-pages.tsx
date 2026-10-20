import { useState } from 'react'
import { Alert, Button, Card, Empty, Input, List, Space, Spin, Tag, Typography } from 'antd'
import { BranchesOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import type { Project, Repository } from './data'
import { useProjectProgress } from './use-project-progress'
import { useForgeDeskStore } from './store'
import { workStatusLabels } from './project-progress-view'
import { WorkspaceRuntimeSummary } from './workspace-runtime-summary'
import { globalPage, projectPage, type AppRoute, type DirectoryItem } from './workspace-navigation'
import { getRepositoryDirectoryRows, type RepositoryView } from './repository-workspace-view'

export function DirectoryLanding({ title, items, onSelect }: { title: string; items: DirectoryItem[]; onSelect: (key: string) => void }): JSX.Element {
  return <section><h1>{title}</h1><List dataSource={items} renderItem={item => <List.Item actions={[<Button key="open" onClick={() => onSelect(item.key)}>进入</Button>]}><List.Item.Meta title={item.label} description={item.children?.map(child => child.label).join(' · ')} /></List.Item>} /></section>
}

export function ProgressOverview({ project, onNavigate, onCreateProject }: { project?: Project; onNavigate: (route: AppRoute) => void; onCreateProject?: () => void }): JSX.Element {
  const { projects, repositories } = useForgeDeskStore()
  const { snapshot, error, loading, refresh } = useProjectProgress(project?.id)
  const visibleProjects = project ? [project] : projects.filter(item => !item.archivedAt)
  const visibleIds = new Set(visibleProjects.map(item => item.id))
  const repos = repositories.filter(repo => visibleIds.has(repo.projectId))
  const work = (snapshot?.items ?? []).filter(item => !item.archivedAt && item.trackingState==='tracked' && !['done', 'cancelled'].includes(item.status))
  const today = snapshot ? new Intl.DateTimeFormat('en-CA',{timeZone:snapshot.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(snapshot.asOf)) : ''
  const stats = snapshot?.stats
  const goals = snapshot?.entities.filter(entity => entity.kind === 'goal' && entity.status !== 'cancelled') ?? []
  const milestones = snapshot?.entities.filter(entity => entity.kind === 'milestone' && entity.status !== 'cancelled') ?? []
  const versions = snapshot?.entities.filter(entity => entity.kind === 'version' && !['cancelled','archived'].includes(entity.status)) ?? []
  const openTask = (id: string, projectId: string | null) => onNavigate(projectId ? { ...projectPage(projectId, 'tasks'), entityId: id } : { ...globalPage('workbench', 'tasks'), entityId: id })
  return <section className="workspace-overview"><div className="workspace-page-heading"><div><Typography.Title level={2}>{project?.name ?? '工作台'}</Typography.Title><Typography.Text type="secondary">{project?.description || (project ? project.workspacePath : '跨项目的待办、验收和异常；具体管理进入对应项目。')}</Typography.Text></div><Space><Button onClick={() => void refresh()}>刷新</Button>{!project ? <Button type="primary" onClick={onCreateProject}>创建项目</Button> : null}</Space></div>
    {error ? <Alert type="error" showIcon message="项目进度读取失败" description={error} /> : null}
    {loading && !snapshot ? <Spin /> : null}
    {snapshot && !snapshot.active ? <Alert type="info" showIcon message="原生进度尚未启用" description="历史数据未自动迁移。请在设置 → 数据与维护中核对并启用；此处不将未知进度显示为完成。" action={<Button onClick={() => onNavigate(globalPage('settings', 'migration'))}>前往核对</Button>} /> : null}
    <div className="workspace-stat-grid">{[['待办', stats?.todo], ['待验收', stats?.review], ['延期', stats?.overdue], ['阻塞', stats?.blocked]].map(([label, value]) => <Card size="small" key={String(label)}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Title level={3}>{snapshot?.active && !error ? value ?? 0 : '—'}</Typography.Title></Card>)}</div>
    <Card title="需要关注的工作" extra={<Button type="link" onClick={() => onNavigate(project ? projectPage(project.id, 'tasks') : globalPage('workbench', 'tasks'))}>全部任务</Button>}><List dataSource={work.filter(item => item.status === 'review' || item.blockers.some(blocker => !blocker.resolvedAt) || item.dependencyIds.some(id=>snapshot?.items.find(work=>work.id===id)?.status!=='done') || item.dueDate && item.dueDate < today).slice(0, 8)} locale={{ emptyText: snapshot?.active && !error ? '当前没有待验收或显式延期、阻塞的工作' : '尚无可用进度数据' }} renderItem={item => <List.Item actions={[<Button key="open" onClick={() => openTask(item.id, item.projectId)}>查看</Button>]}><List.Item.Meta title={item.title} description={project ? item.ownerRef || '未指定负责人' : projects.find(project => project.id === item.projectId)?.name ?? '收件箱'} /><Tag>{workStatusLabels[item.status]}</Tag></List.Item>} /></Card>
    {snapshot?.active && !error ? <Card title="目标与交付" extra={project ? <Button type="link" onClick={() => onNavigate(projectPage(project.id,'goals'))}>管理目标</Button> : null}>
      <Space wrap><Typography.Text>目标已达成 {goals.filter(goal=>goal.status==='achieved').length}/{goals.length}</Typography.Text><Typography.Text>里程碑已通过 {milestones.filter(item=>item.status==='achieved').length}/{milestones.length}</Typography.Text><Typography.Text>版本已收口 {versions.filter(item=>item.status==='closed').length}/{versions.length}</Typography.Text></Space>
      <List size="small" dataSource={goals.slice(0,5)} locale={{emptyText:'尚未定义目标；任务仍可独立管理'}} renderItem={goal=><List.Item actions={[<Button key="open" onClick={()=>onNavigate({...projectPage(goal.projectId,'goals'),progressObject:{kind:'goal',id:goal.id}})}>查看目标</Button>]}><List.Item.Meta title={goal.title} description={`${snapshot.goalStats[goal.id]?.percent==null?'尚未定义结果':`${snapshot.goalStats[goal.id].percent}%`}${goal.progressMode==='legacy_tasks'?' · 旧任务口径':` · 关键结果已验收 ${snapshot.goalStats[goal.id]?.achieved||0}/${snapshot.goalStats[goal.id]?.total||0}`}`}/></List.Item>}/>
    </Card> : null}
    <WorkspaceRuntimeSummary projects={visibleProjects} refreshKey={snapshot?.asOf??''} onNavigate={onNavigate}/>
    <Card title="代码状态" extra={project ? <Button type="link" onClick={() => onNavigate(projectPage(project.id, 'repositories'))}>代码管理</Button> : null}><List dataSource={repos.filter(repo => !repo.available || repo.hasChanges || repo.ahead > 0).slice(0, 6)} locale={{ emptyText: repos.length ? '当前扫描未发现待处理的本地代码；远端状态以最近 Fetch 为准' : '尚未添加仓库，不影响独立管理项目进度' }} renderItem={repo => <List.Item actions={[<Button key="open" onClick={() => onNavigate({ ...projectPage(repo.projectId, 'repositories'), repositoryId: repo.id })}>打开仓库</Button>]}><List.Item.Meta title={repo.name} description={repo.localPath} /><Tag color={!repo.available ? 'error' : 'warning'}>{!repo.available ? '不可用' : `变更 ${repo.hasChanges ? '有' : '无'} · 待推送 ${repo.ahead}`}</Tag></List.Item>} /></Card>
    <Card title={project ? '运行与部署' : '最近项目'}>{project ? <Space wrap><Typography.Text type="secondary">部署成功不代表服务当前在线。进入运行页面查看检查时间、错误和实时状态。</Typography.Text><Button onClick={() => onNavigate(projectPage(project.id, 'environments'))}>环境与服务</Button><Button onClick={() => onNavigate(projectPage(project.id, 'monitoring'))}>日志与监控</Button></Space> : <List dataSource={visibleProjects.slice(0, 6)} locale={{ emptyText: <Empty description="创建第一个项目后开始管理" /> }} renderItem={item => <List.Item actions={[<Button key="open" onClick={() => onNavigate(projectPage(item.id))}>进入项目</Button>]}><List.Item.Meta title={item.name} description={item.workspacePath} /></List.Item>} />}</Card>
  </section>
}

export function RepositoryDirectory({ repositories, onSelect, onConfigure, onRescan, rescanning, onInitialize }: {
  repositories: Repository[]
  onSelect: (id: string, view: RepositoryView) => void
  onConfigure: () => void
  onRescan: () => void
  rescanning: boolean
  onInitialize: () => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const rows = getRepositoryDirectoryRows(repositories, query)
  return <section className="repository-directory">
    <div className="workspace-page-heading">
      <div><h1>仓库</h1><p>查看提交树、管理分支与本地变更。</p></div>
      <Space size={4} wrap>
        <Button type="text" icon={<ReloadOutlined />} loading={rescanning} onClick={onRescan}>重新扫描</Button>
        <Button icon={<SettingOutlined />} onClick={onConfigure}>仓库设置</Button>
      </Space>
    </div>
    <div className="repository-directory-toolbar">
      <Typography.Text type="secondary">{repositories.length} 个仓库</Typography.Text>
      {repositories.length > 1 ? <Input.Search aria-label="搜索仓库" placeholder="搜索名称、路径或分支" allowClear value={query} onChange={event => setQuery(event.target.value)} /> : null}
    </div>
    <div className="repository-directory-list">
      {rows.length ? rows.map(({ repository: repo, depth }) => <article className="repository-directory-row" key={repo.id}>
        <div className="repository-directory-info" style={{ paddingInlineStart: Math.min(depth, 3) * 16 }}>
          <div className="repository-directory-name">
            <Button type="link" onClick={() => onSelect(repo.id, 'history')} aria-label={`查看仓库 ${repo.name} 的提交树`}>{depth ? <span aria-hidden="true">↳ </span> : null}{repo.name}</Button>
            <span className="repository-directory-kind">{repo.repositoryKind === 'submodule' ? '子模块' : repo.parentRepositoryId ? '嵌套仓库' : '主仓库'}</span>
          </div>
          <div className="repository-directory-path" title={repo.localPath}>{repo.localPath}</div>
          <div className="repository-directory-meta">
            {repo.available ? <><span><BranchesOutlined /> {repo.currentBranch || (repo.isDetached ? 'Detached HEAD' : '未识别分支')}</span>{repo.hasChanges ? <span className="has-changes">有未提交变更</span> : <span>工作区干净</span>}{repo.ahead > 0 ? <span>待推送 {repo.ahead}</span> : null}</> : <span className="is-unavailable" title={repo.scanError}>不可用{repo.scanError ? ` · ${repo.scanError}` : ' · 请检查本地目录'}</span>}
          </div>
        </div>
        <div className="repository-directory-shortcuts" aria-label={`${repo.name} 的代码操作`}>
          <Button onClick={() => onSelect(repo.id, 'history')}>提交树</Button>
          <Button type="text" disabled={!repo.available} onClick={() => onSelect(repo.id, 'branches')}>分支</Button>
          <Button type="text" disabled={!repo.available} onClick={() => onSelect(repo.id, 'changes')}>变更</Button>
        </div>
      </article>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={repositories.length ? '没有匹配的仓库' : '还没有本地 Git 仓库'}>
        {!repositories.length ? <Space wrap><Button type="primary" onClick={onInitialize}>初始化仓库</Button><Button onClick={onConfigure}>配置已有仓库</Button></Space> : null}
      </Empty>}
    </div>
  </section>
}
