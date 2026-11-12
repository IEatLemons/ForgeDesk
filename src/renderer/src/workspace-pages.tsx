import { useState } from 'react'
import { Alert, Button, Card, Empty, Input, List, Space, Spin, Tag, Typography } from 'antd'
import { BranchesOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import type { Project, Repository } from './data'
import { useTaskWorkspace } from './use-task-workspace'
import { taskOverdue } from '../../shared/task-workspace'
import { useForgeDeskStore } from './store'
import { WorkspaceRuntimeSummary } from './workspace-runtime-summary'
import { ProjectOperationsPanel } from './project-operations-panel'
import { globalPage, projectPage, type AppRoute, type DirectoryItem } from './workspace-navigation'
import { getRepositoryDirectoryRows, type RepositoryView } from './repository-workspace-view'

export function DirectoryLanding({ title, items, onSelect }: { title: string; items: DirectoryItem[]; onSelect: (key: string) => void }): JSX.Element {
  return <section><h1>{title}</h1><List dataSource={items} renderItem={item => <List.Item actions={[<Button key="open" onClick={() => onSelect(item.key)}>进入</Button>]}><List.Item.Meta title={item.label} description={item.children?.map(child => child.label).join(' · ')} /></List.Item>} /></section>
}

export function ProgressOverview({ project, onNavigate, onCreateProject }: { project?: Project; onNavigate: (route: AppRoute) => void; onCreateProject?: () => void }): JSX.Element {
  const { projects, repositories } = useForgeDeskStore()
  const { snapshot, error, loading, refresh } = useTaskWorkspace()
  const visibleProjects = project ? [project] : projects.filter(item => !item.archivedAt)
  const visibleIds = new Set(visibleProjects.map(item => item.id))
  const repos = repositories.filter(repo => visibleIds.has(repo.projectId))
  const tasks = snapshot?.tasks ?? []
  const openTasks = () => onNavigate({ ...globalPage('tasks'), taskScope: 'all' })
  return <section className="workspace-overview"><div className="workspace-page-heading"><div><Typography.Title level={2}>{project?.name ?? '概览'}</Typography.Title><Typography.Text type="secondary">{project?.description || (project ? project.workspacePath : '任务、项目与本机运行概览')}</Typography.Text></div><Space><Button onClick={() => void refresh()}>刷新</Button>{project
    ? <Button onClick={() => onNavigate(projectPage(project.id, 'tasks'))}>关联任务{snapshot ? `（${tasks.filter(task => task.projectIds.includes(project.id)).length}）` : ''}</Button>
    : <Button type="primary" onClick={onCreateProject}>创建项目</Button>}</Space></div>
    {project ? <><ProjectOperationsPanel projectId={project.id} view="summary" onNavigate={onNavigate} /><WorkspaceRuntimeSummary projects={visibleProjects} refreshKey="" onNavigate={onNavigate} serversOnly /></> : <>
      {error ? <Alert type="error" message={error} /> : null}{loading && !snapshot ? <Spin /> : null}
      <div className="workspace-stat-grid">{[['全部任务', tasks.length], ['未完成', tasks.filter(task => !task.done).length], ['已完成', tasks.filter(task => task.done).length], ['已逾期', tasks.filter(task => taskOverdue(task)).length]].map(([label, value]) => <Card size="small" key={String(label)} onClick={openTasks}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Title level={3}>{snapshot ? value : '—'}</Typography.Title></Card>)}</div>
      <Card title="需要关注的任务" extra={<Button type="link" onClick={openTasks}>全部任务</Button>}><List dataSource={tasks.filter(task => !task.done && (task.starred || taskOverdue(task))).slice(0, 8)} locale={{ emptyText: '当前没有关注或逾期任务' }} renderItem={task => <List.Item actions={[<Button key="open" onClick={() => onNavigate({ ...globalPage('tasks'), taskScope: 'all', entityId: task.id })}>查看</Button>]}><List.Item.Meta title={task.title} description={task.dueDate || '未安排日期'} />{taskOverdue(task) ? <Tag color="red">已逾期</Tag> : null}</List.Item>} /></Card><WorkspaceRuntimeSummary projects={visibleProjects} refreshKey="" onNavigate={onNavigate} />
    </>}
    <Card title="代码状态"><List dataSource={repos.filter(repo => !repo.available || repo.hasChanges || repo.ahead > 0).slice(0, 6)} locale={{ emptyText: '当前没有待处理的本地代码' }} renderItem={repo => <List.Item actions={[<Button key="open" onClick={() => onNavigate({ ...projectPage(repo.projectId, 'repositories'), repositoryId: repo.id })}>打开仓库</Button>]}><List.Item.Meta title={repo.name} description={repo.localPath} /><Tag>{!repo.available ? '不可用' : `变更 ${repo.hasChanges ? '有' : '无'} · 待推送 ${repo.ahead}`}</Tag></List.Item>} /></Card>
    {!project ? <Card title="最近项目"><List dataSource={visibleProjects.slice(0, 6)} renderItem={item => <List.Item actions={[<Button key="open" onClick={() => onNavigate(projectPage(item.id))}>进入项目</Button>]}><List.Item.Meta title={item.name} description={item.workspacePath} /></List.Item>} /></Card> : null}
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
