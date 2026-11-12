import { useEffect, useState, type ReactNode } from 'react'
import { Breadcrumb, Button, Drawer, Dropdown, Menu, Select, Tag, Tooltip, type MenuProps } from 'antd'
import {
  AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, BookOutlined,
  BranchesOutlined, CheckSquareOutlined, CodeOutlined, DashboardOutlined, DatabaseOutlined, FolderOpenOutlined,
  HistoryOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, MessageOutlined,
  RocketOutlined, SafetyOutlined, SettingOutlined, SwapOutlined, ToolOutlined, RobotOutlined
} from '@ant-design/icons'
import type { Project } from './data'
import { directoryParents, findDirectory, GLOBAL_DIRECTORY, globalPage, PROJECT_DIRECTORY, projectPage, routeLabel, type AppRoute, type DirectoryItem, type ProjectPage, type WorkspaceArea } from './workspace-navigation'
import { readWorkspaceSidebarCollapsed, saveWorkspaceSidebarCollapsed } from './workspace-sidebar-preference'
import { TaskWorkspaceNavigation } from './task-workspace-navigation'
import './workspace-shell.css'
import './task-workspace.css'

const icons: Record<string, ReactNode> = {
  workbench: <DashboardOutlined />, projects: <FolderOpenOutlined />, ai: <RobotOutlined />,
  resources: <DatabaseOutlined />, toolbox: <ToolOutlined />, settings: <SettingOutlined />,
  overview: <DashboardOutlined />, tasks: <CheckSquareOutlined />, code: <BranchesOutlined />,
  runtime: <RocketOutlined />, 'project-settings': <SettingOutlined />,
  activity: <HistoryOutlined />, sessions: <MessageOutlined />, directories: <FolderOpenOutlined />,
  services: <RocketOutlined />, 'data-sources': <DatabaseOutlined />, docker: <AppstoreOutlined />,
  security: <SafetyOutlined />, development: <CodeOutlined />, data: <DatabaseOutlined />,
  reading: <BookOutlined />, diagnostics: <DashboardOutlined />, display: <AppstoreOutlined />,
  credentials: <SafetyOutlined />, integrations: <BranchesOutlined />, maintenance: <ToolOutlined />
}

function directoryItems(items: DirectoryItem[], prefix = ''): MenuProps['items'] {
  return items.map(item => ({
    key: `${prefix}${item.key}`, label: item.label, icon: icons[item.key],
    ...(item.children ? { children: directoryItems(item.children, prefix) } : {})
  }))
}

type Props = {
  route: AppRoute; projects: Project[]; children: ReactNode; terminal: ReactNode
  onNavigate: (route: AppRoute) => void; onOpenProject: (id: string) => void; onOpenTerminal: () => void
  onBack: () => void; onForward: () => void; canBack: boolean; canForward: boolean; projectWindow?: boolean
  chromeControls?: ReactNode; macWindowControls?: boolean; banner?: ReactNode
}

export function WorkspaceShell(props: Props): JSX.Element {
  const { route, projects } = props
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readWorkspaceSidebarCollapsed)
  const [compactWindow, setCompactWindow] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  const [popupKeys, setPopupKeys] = useState<string[]>([])
  const go = (next: AppRoute) => { setMobileOpen(false); setPopupKeys([]); props.onNavigate(next) }
  const area = route.scope === 'global' ? GLOBAL_DIRECTORY.find(item => item.key === route.area) : undefined
  const parents = route.scope === 'project' ? directoryParents(PROJECT_DIRECTORY, route.page) : directoryParents(area?.children ?? [], route.page)
  const parentPath = parents.join('/')
  const [expanded, setExpanded] = useState<string[]>(parents)
  const identity = route.scope === 'project' ? route.projectId : route.area

  useEffect(() => {
    setExpanded(parentPath ? parentPath.split('/') : [])
    setMobileOpen(false)
    setPopupKeys([])
  }, [identity, route.page, parentPath])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)')
    const onChange = () => { setCompactWindow(query.matches); setMobileOpen(false); setPopupKeys([]) }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  function toggleSidebar(): void {
    if (compactWindow) { setMobileOpen(open => !open); return }
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    setPopupKeys([])
    saveWorkspaceSidebarCollapsed(next)
  }

  const project = route.scope === 'project' ? projects.find(item => item.id === route.projectId) : undefined
  const projectOptions = projects.filter(item => !item.archivedAt || item.id === project?.id).map(item => ({ value: item.id, label: item.name }))
  const selectGlobalPage = (key: string) => {
    const [areaKey, pageKey] = key.split('/') as [WorkspaceArea, string | undefined]
    if (pageKey === 'terminal') { setMobileOpen(false); setPopupKeys([]); props.onOpenTerminal(); return }
    go(pageKey && route.scope === 'global' && route.area === areaKey
      ? { ...route, page: pageKey, entityId: undefined }
      : globalPage(areaKey, pageKey))
  }

  function renderSidebar(inDrawer = false): JSX.Element {
    const collapsed = sidebarCollapsed && !inDrawer && !compactWindow
    const menuState = { mode: 'inline' as const, inlineCollapsed: collapsed, triggerSubMenuAction: 'click' as const }
    const groupState = { ...menuState, openKeys: collapsed ? popupKeys : expanded, onOpenChange: collapsed ? setPopupKeys : setExpanded }
    const globalItems = (footer: boolean): MenuProps['items'] => GLOBAL_DIRECTORY.filter(item => item.footer === footer).map(item => ({
      key: item.key, label: item.label, icon: icons[item.key],
      ...(collapsed && item.children ? { children: directoryItems(item.children, `${item.key}/`) } : {})
    }))
    const projectOnly = props.projectWindow && route.scope === 'project'
    const globalSelected = route.scope === 'project'
      ? ['projects']
      : [route.area, ...(collapsed && area?.children ? [`${route.area}/${route.page}`] : [])]
    const popupState = collapsed ? { openKeys: popupKeys, onOpenChange: setPopupKeys } : {}

    return <div className={`workspace-sidebar-inner${collapsed ? ' is-collapsed' : ''}`}>
      <div className="workspace-brand"><FolderOpenOutlined />{collapsed ? null : <strong>ForgeDesk</strong>}</div>
      {!projectOnly ? <nav aria-label="主导航" className="workspace-primary-nav">
        <Menu {...menuState} {...popupState} selectedKeys={globalSelected}
          items={globalItems(false)} onClick={({ key }) => selectGlobalPage(key)} />
      </nav> : null}
      {route.scope === 'project' ? <nav aria-label="项目目录" className="workspace-secondary-directory">
        <div className="workspace-project-switch">
          {collapsed ? <Dropdown trigger={['click']} menu={{
            selectable: true, selectedKeys: project ? [project.id] : [],
            items: projectOptions.length ? projectOptions.map(item => ({ key: item.value, label: item.label })) : [{ key: 'empty', label: '暂无项目', disabled: true }],
            onClick: ({ key }) => props.onOpenProject(key)
          }}><Button type="text" icon={<SwapOutlined />} aria-label="切换项目" title={`切换项目 · ${project?.name ?? '未找到项目'}`} /></Dropdown>
            : <Select aria-label="切换项目" value={project?.id} onChange={props.onOpenProject} options={projectOptions} />}
        </div>
        <Menu {...groupState} selectedKeys={[route.page]} items={directoryItems(PROJECT_DIRECTORY)}
          onClick={({ key }) => go(projectPage(route.projectId, key as ProjectPage))} />
        <Tooltip title={collapsed ? '项目 AI 工作' : undefined} placement="right">
          <Button type="text" className="workspace-project-ai" icon={<RobotOutlined />} aria-label="项目 AI 工作"
            onClick={() => go({ ...globalPage('ai'), projectFilter: route.projectId })}>
            {collapsed ? null : '项目 AI 工作 ↗'}
          </Button>
        </Tooltip>
      </nav> : !collapsed && route.area === 'tasks' ? <nav aria-label="任务目录" className="workspace-secondary-directory">
        <TaskWorkspaceNavigation embedded scope={route.taskScope} onChange={taskScope => go({ ...route, taskScope, entityId: undefined })} />
      </nav> : !collapsed && area?.children ? <nav aria-label={`${area.label}目录`} className="workspace-secondary-directory">
        {area.footer ? <div className="workspace-directory-label">{area.label}</div> : null}
        <Menu mode="inline" selectedKeys={[route.page]} openKeys={expanded} onOpenChange={setExpanded}
          items={directoryItems(area.children)} onClick={({ key }) => selectGlobalPage(`${route.area}/${key}`)} />
      </nav> : <div className="workspace-sidebar-spacer" />}
      {!projectOnly ? <nav aria-label="辅助导航" className="workspace-sidebar-footer">
        <Menu {...menuState} {...popupState} selectedKeys={globalSelected}
          items={globalItems(true)} onClick={({ key }) => selectGlobalPage(key)} />
      </nav> : null}
    </div>
  }

  const ancestors = parents.map(key => route.scope === 'project' ? findDirectory(PROJECT_DIRECTORY, key)?.label : findDirectory(area?.children ?? [], key)?.label).filter(Boolean)
  const breadcrumbs = route.scope === 'project'
    ? [{ title: <button onClick={() => go(globalPage('projects'))}>项目</button> }, { title: <button onClick={() => go(projectPage(route.projectId))}>{project?.name ?? '未找到项目'}</button> }, ...ancestors.map(title => ({ title })), ...(route.page === 'overview' ? [] : [{ title: routeLabel(route) }])]
    : [{ title: area?.label }, ...ancestors.map(title => ({ title })), ...(routeLabel(route) !== area?.label ? [{ title: routeLabel(route) }] : [])]
  const toggleLabel = compactWindow ? '打开导航目录' : sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'

  return <div className={`workspace-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
    <header className={`workspace-topbar${props.macWindowControls ? ' with-mac-controls' : ''}`}>
      <div className="workspace-topbar-leading">
        <Tooltip title={toggleLabel}><Button type="text" icon={compactWindow ? <MenuOutlined /> : sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} aria-label={toggleLabel} aria-expanded={compactWindow ? mobileOpen : !sidebarCollapsed} aria-controls={compactWindow ? 'workspace-drawer-directory' : 'workspace-desktop-directory'} onClick={toggleSidebar} /></Tooltip>
        <Button type="text" aria-label="后退" icon={<ArrowLeftOutlined />} disabled={!props.canBack} onClick={props.onBack} />
        <Button type="text" aria-label="前进" icon={<ArrowRightOutlined />} disabled={!props.canForward} onClick={props.onForward} />
        <Breadcrumb items={breadcrumbs} />
      </div>
      <div className="workspace-topbar-actions">
        {project?.archivedAt ? <Tag className="workspace-archived-tag">已归档 · 仍可管理</Tag> : null}
        {props.chromeControls}
        <Tooltip title="打开终端面板"><Button type="text" icon={<CodeOutlined />} aria-label="打开终端面板" onClick={props.onOpenTerminal} /></Tooltip>
      </div>
    </header>
    {props.banner}
    <div className="workspace-body">
      <aside id="workspace-desktop-directory" className="workspace-sidebar">{renderSidebar()}</aside>
      <Drawer title="目录" placement="left" open={mobileOpen} onClose={() => setMobileOpen(false)} width={272} className="workspace-navigation-drawer"><div id="workspace-drawer-directory">{renderSidebar(true)}</div></Drawer>
      <div className="workspace-main"><main className="workspace-content">{props.children}</main>{props.terminal}</div>
    </div>
  </div>
}
