import { useEffect, useState, type ReactNode } from 'react'
import { Breadcrumb, Button, Drawer, Menu, Select, Tag } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CheckSquareOutlined, CodeOutlined, DashboardOutlined, DatabaseOutlined, FolderOpenOutlined, MenuOutlined, RobotOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons'
import type { Project } from './data'
import { directoryParents, findDirectory, GLOBAL_DIRECTORY, globalPage, PROJECT_DIRECTORY, projectPage, routeLabel, type AppRoute, type DirectoryItem, type ProjectPage } from './workspace-navigation'
import './workspace-shell.css'
import { TaskWorkspaceNavigation } from './task-workspace-navigation'
import './task-workspace.css'

const icons: Record<string, ReactNode> = { workbench: <DashboardOutlined />, projects: <FolderOpenOutlined />, tasks: <CheckSquareOutlined />, ai: <RobotOutlined />, resources: <DatabaseOutlined />, toolbox: <ToolOutlined />, settings: <SettingOutlined /> }
type Props = {
  route: AppRoute; projects: Project[]; children: ReactNode; terminal: ReactNode
  onNavigate: (route: AppRoute) => void; onOpenProject: (id: string) => void; onOpenTerminal: () => void
  onBack: () => void; onForward: () => void; canBack: boolean; canForward: boolean; projectWindow?: boolean
}
export function WorkspaceShell(props: Props): JSX.Element {
  const { route, projects } = props
  const [mobileOpen, setMobileOpen] = useState(false)
  const go = (next: AppRoute) => { setMobileOpen(false); props.onNavigate(next) }
  const area = route.scope === 'global' ? GLOBAL_DIRECTORY.find(item => item.key === route.area) : undefined
  const parents = route.scope === 'project' ? directoryParents(PROJECT_DIRECTORY, route.page) : directoryParents(area?.children ?? [], route.page)
  const [expanded, setExpanded] = useState<string[]>(parents)
  const identity = route.scope === 'project' ? `${route.projectId}/${parents[0] ?? ''}` : `${route.area}/${parents[0] ?? ''}`
  useEffect(() => { setExpanded(parents); setMobileOpen(false) }, [identity, route.page])
  const project = route.scope === 'project' ? projects.find(item => item.id === route.projectId) : undefined
  const leafItems = (items: DirectoryItem[]): NonNullable<React.ComponentProps<typeof Menu>['items']> => items.map(item => ({ key: item.key, label: item.label, ...(item.children ? { children: leafItems(item.children) } : {}) }))
  const projectOnly = props.projectWindow && route.scope === 'project'
  const activeArea = route.scope === 'project' ? 'projects' : route.area
  const areaItems = (footer: boolean) => GLOBAL_DIRECTORY.filter(item => item.footer === footer)
    .map(item => ({ key: item.key, label: item.label, icon: icons[item.key] }))
  const openArea = ({ key }: { key: string }) => go(globalPage(key as typeof activeArea))
  const sidebar = <div className="workspace-sidebar-inner">
    <div className="workspace-brand"><FolderOpenOutlined /><strong>ForgeDesk</strong></div>
    {!projectOnly ? <nav aria-label="主导航" className="workspace-primary-nav">
      <Menu mode="inline" selectedKeys={[activeArea]} items={areaItems(false)} onClick={openArea} />
    </nav> : null}
    {route.scope === 'project' ? <nav aria-label="项目目录" className="workspace-secondary-directory">
      <div className="workspace-project-switch">
        <label>当前项目</label>
        <Select aria-label="切换项目" value={project?.id} onChange={props.onOpenProject}
          options={projects.filter(item => !item.archivedAt || item.id === project?.id).map(item => ({ value: item.id, label: item.name }))} />
      </div>
      <Menu mode="inline" selectedKeys={[route.page]} openKeys={expanded} onOpenChange={setExpanded}
        items={leafItems(PROJECT_DIRECTORY)} onClick={({ key }) => go(projectPage(route.projectId, key as ProjectPage))} />
      <Button type="text" className="workspace-project-ai" icon={<RobotOutlined />}
        onClick={() => go({ ...globalPage('ai'), projectFilter: route.projectId })}>项目 AI 工作 ↗</Button>
    </nav> : route.area === 'tasks' ? <nav aria-label="任务目录" className="workspace-secondary-directory">
      <TaskWorkspaceNavigation embedded scope={route.taskScope} onChange={taskScope => go({ ...route, taskScope, entityId: undefined })} />
    </nav> : area?.children ? <nav aria-label={`${area.label}目录`} className="workspace-secondary-directory">
      {area.footer ? <div className="workspace-directory-label">{area.label}</div> : null}
      <Menu mode="inline" selectedKeys={[route.page]} openKeys={expanded} onOpenChange={setExpanded} items={leafItems(area.children)}
        onClick={({ key }) => key === 'terminal' ? props.onOpenTerminal() : go({ ...route, page: key, entityId: undefined })} />
    </nav> : <div className="workspace-sidebar-spacer" />}
    {!projectOnly ? <nav aria-label="辅助导航" className="workspace-sidebar-footer">
      <Menu mode="inline" selectedKeys={[activeArea]} items={areaItems(true)} onClick={openArea} />
    </nav> : null}
  </div>
  const ancestors = parents.map(key=>route.scope==='project'?findDirectory(PROJECT_DIRECTORY,key)?.label:findDirectory(area?.children??[],key)?.label).filter(Boolean)
  const breadcrumbs = route.scope === 'project' ? [{ title: <button onClick={() => go(globalPage('projects'))}>项目</button> }, { title: <button onClick={() => go(projectPage(route.projectId))}>{project?.name ?? '未找到项目'}</button> },...ancestors.map(title=>({title})), ...(route.page === 'overview' ? [] : [{ title: routeLabel(route) }])] : [{ title: area?.label },...ancestors.map(title=>({title})), ...(routeLabel(route) !== area?.label ? [{ title: routeLabel(route) }] : [])]
  return <div className="workspace-shell"><aside className="workspace-sidebar">{sidebar}</aside><Drawer title="目录" placement="left" open={mobileOpen} onClose={() => setMobileOpen(false)} width={272} className="workspace-navigation-drawer">{sidebar}</Drawer><div className="workspace-main"><header className="workspace-topbar"><div className="workspace-topbar-leading"><Button className="workspace-mobile-button" type="text" icon={<MenuOutlined />} aria-label="打开导航目录" onClick={() => setMobileOpen(true)} /><Button type="text" aria-label="后退" icon={<ArrowLeftOutlined />} disabled={!props.canBack} onClick={props.onBack} /><Button type="text" aria-label="前进" icon={<ArrowRightOutlined />} disabled={!props.canForward} onClick={props.onForward} /><Breadcrumb items={breadcrumbs} /></div><div>{project?.archivedAt ? <Tag>已归档 · 仍可管理</Tag> : null}<Button type="text" icon={<CodeOutlined />} aria-label="打开终端面板" onClick={props.onOpenTerminal} /></div></header><main className="workspace-content">{props.children}</main>{props.terminal}</div></div>
}
