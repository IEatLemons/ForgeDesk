import { useEffect, useRef, useState } from 'react'
import { App as AntApp, Alert, Breadcrumb, Button, Drawer, Form, Input, Menu, Modal, Select, Space, Tag, Tooltip } from 'antd'
import {
  ApartmentOutlined, AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, BookOutlined,
  BranchesOutlined, CheckCircleOutlined, CodeOutlined, DashboardOutlined, DatabaseOutlined,
  FolderOutlined, MenuOutlined, MoonOutlined, QuestionCircleOutlined, ReloadOutlined,
  RobotOutlined, SettingOutlined, SunOutlined, ToolOutlined
} from '@ant-design/icons'
import { PrototypeContext, usePrototype, type CreateKind, type PrototypeContextValue } from './context'
import { createDemoData, DEMO_TODAY, type DemoTask } from './data'
import {
  contextOrigin, createNavigation, currentRoute, enterProject, getPageLabel, getProjectGroup, GLOBAL_AREAS,
  globalRoute, moveHistory, navigate as navigateState, PROJECT_GROUPS, projectRoute,
  routeFromHash, routeToHash, type GlobalArea, type GlobalPage, type ProjectPage, type PrototypeNavigation, type PrototypeRoute
} from './navigation'
import { PlanPage, ProjectOverview, TaskPage } from './progress-pages'
import { AiPage, ContributionsPage, ProjectsPage, RepositoryPage, ResourcesPage, RuntimePage, SettingsPage, ToolboxPage, WorkbenchPage } from './workspace-pages'
import { OpenTaskButton, StatusTag } from './ui'

const AREA_ICONS = { workbench: <DashboardOutlined />, projects: <FolderOutlined />, ai: <RobotOutlined />, resources: <DatabaseOutlined />, toolbox: <ToolOutlined />, settings: <SettingOutlined /> }
const GROUP_ICONS: Record<string, JSX.Element> = { progress: <CheckCircleOutlined />, code: <BranchesOutlined />, runtime: <ApartmentOutlined />, 'project-settings': <SettingOutlined /> }

function usePrototypeNavigation(): { state: PrototypeNavigation; commit: (next: PrototypeNavigation) => void; back: () => void; forward: () => void } {
  const [state, setState] = useState(() => createNavigation(routeFromHash(window.location.hash)))
  const stateRef = useRef(state)
  const session = useRef(crypto.randomUUID())
  useEffect(() => {
    window.history.replaceState({ prototypeSession: session.current, index: stateRef.current.index }, '', routeToHash(currentRoute(stateRef.current)))
    function restore(): void {
      const decoded = routeFromHash(window.location.hash)
      if (!decoded || routeToHash(decoded) === routeToHash(currentRoute(stateRef.current))) return
      const index = window.history.state?.index
      const knownEntry = window.history.state?.prototypeSession === session.current && Number.isInteger(index) && stateRef.current.entries[index] && routeToHash(stateRef.current.entries[index]) === routeToHash(decoded)
      const next = knownEntry ? moveHistory(stateRef.current, index) : navigateState(stateRef.current, decoded)
      stateRef.current = next
      setState(next)
      window.history.replaceState({ prototypeSession: session.current, index: next.index }, '', routeToHash(decoded))
    }
    window.addEventListener('popstate', restore)
    window.addEventListener('hashchange', restore)
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore) }
  }, [])
  function commit(next: PrototypeNavigation): void {
    if (next === stateRef.current) return
    stateRef.current = next
    setState(next)
    window.history.pushState({ prototypeSession: session.current, index: next.index }, '', routeToHash(currentRoute(next)))
  }
  return { state, commit, back: () => { if (stateRef.current.index > 0) window.history.back() }, forward: () => { if (stateRef.current.index < stateRef.current.entries.length - 1) window.history.forward() } }
}

export function PrototypeApp({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }): JSX.Element {
  const { message, modal } = AntApp.useApp()
  const [data, setData] = useState(createDemoData)
  const navigation = usePrototypeNavigation()
  const route = currentRoute(navigation.state)
  const [createKind, setCreateKind] = useState<CreateKind | null>(null)
  const [previewId, setPreviewId] = useState<string>()
  const [guideOpen, setGuideOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalContexts, setTerminalContexts] = useState<{ id: string; title: string; lines: string[] }[]>([])
  const [terminalId, setTerminalId] = useState('')
  const [command, setCommand] = useState('')
  const project = route.scope === 'project' ? data.projects.find(item => item.id === route.projectId) : undefined
  const preview = data.tasks.find(item => item.id === previewId)
  const terminal = terminalContexts.find(item => item.id === terminalId)
  const previousRoute = contextOrigin(navigation.state)
  function go(nextRoute: PrototypeRoute): void {
    setPreviewId(undefined)
    setMobileNav(false)
    navigation.commit(navigateState(navigation.state, nextRoute))
  }
  function openProject(id: string): void {
    setPreviewId(undefined)
    setMobileNav(false)
    navigation.commit(enterProject(navigation.state, id))
  }
  function openTerminal(): void {
    const id = project?.id ?? 'global'
    if (!terminalContexts.some(item => item.id === id)) setTerminalContexts(current => [...current, { id, title: project?.name ?? '通用终端', lines: [`${project ? `/demo/${project.name}` : '/demo'} · 模拟终端`, '不会执行命令或创建真实终端进程。切换页面不会丢失此处的记录。'] }])
    setTerminalId(id)
    setTerminalOpen(true)
  }
  function runDemoCommand(): void {
    if (!command.trim() || !terminal) return
    const text = command.trim()
    setTerminalContexts(current => current.map(item => item.id === terminal.id ? { ...item, lines: [...item.lines, `$ ${text}`, '→ 仅回显输入，未执行任何本机或远程命令。'] } : item))
    setCommand('')
  }
  function returnToContext(): void {
    if (!previousRoute) { navigation.back(); return }
    for (let index = navigation.state.index - 1; index >= 0; index--) {
      if (routeToHash(navigation.state.entries[index]) === routeToHash(previousRoute)) {
        window.history.go(index - navigation.state.index)
        return
      }
    }
  }
  const context: PrototypeContextValue = { data, setData, route, previousRoute, navigate: go, openProject, create: setCreateKind, previewTask: task => setPreviewId(task.id), openTerminal, notify: text => { void message.info(text) }, back: returnToContext }
  const projectGroup = route.scope === 'project' ? getProjectGroup(route.page) : undefined
  const area = route.scope === 'global' ? GLOBAL_AREAS.find(item => item.key === route.area) : undefined
  const breadcrumbs = route.scope === 'project' ? [
    { title: <button className="ia-breadcrumb-button" onClick={() => go(globalRoute('projects'))}>项目</button> },
    { title: <button className="ia-breadcrumb-button" onClick={() => go(projectRoute(route.projectId))}>{project?.name ?? '未找到项目'}</button> },
    ...(projectGroup ? [{ title: projectGroup.label }] : []),
    { title: getPageLabel(route) },
    ...(route.entityId ? [{ title: data.tasks.find(item => item.id === route.entityId)?.title ?? data.plans.find(item => item.id === route.entityId)?.title ?? route.entityId }] : [])
  ] : [
    { title: <button className="ia-breadcrumb-button" onClick={() => go(globalRoute(route.area))}>{area?.label}</button> },
    ...(getPageLabel(route) !== area?.label ? [{ title: getPageLabel(route) }] : []),
    ...(route.entityId ? [{ title: route.area === 'ai' ? '会话详情' : route.entityId === 'ai-accounts' ? 'AI 账号' : route.entityId }] : [])
  ]
  function renderPage(): JSX.Element {
    if (route.scope === 'project') {
      if (!project) return <Alert type="warning" showIcon message="此演示项目不存在" description="新建的模拟项目在刷新页面后重置。" action={<Button onClick={() => go(globalRoute('projects'))}>返回项目列表</Button>} />
      if (route.page === 'overview') return <ProjectOverview />
      if (route.page === 'tasks') return <TaskPage key={route.projectId} />
      if (['goals', 'milestones', 'versions'].includes(route.page)) return <PlanPage />
      if (route.page === 'repositories') return <RepositoryPage key={route.projectId} />
      if (route.page === 'contributions') return <ContributionsPage />
      if (route.page.startsWith('settings-')) return <SettingsPage key={`${route.projectId}-${route.page}-${route.entityId ?? ''}`} />
      return <RuntimePage key={`${route.projectId}-${route.page}`} />
    }
    if (route.area === 'projects') return <ProjectsPage />
    if (route.area === 'ai') return <AiPage />
    if (route.area === 'resources') return <ResourcesPage />
    if (route.area === 'toolbox') return <ToolboxPage />
    if (route.area === 'settings') return <SettingsPage key={`${route.page}-${route.entityId ?? ''}`} />
    return route.page === 'tasks' ? <TaskPage crossProject /> : <WorkbenchPage />
  }
  return <PrototypeContext.Provider value={context}><div className={`ia-app${dark ? ' ia-dark' : ''}`}>
    <div className="ia-prototype-banner"><span><span className="ia-preview-dot" />信息架构原型 <span className="ia-banner-detail">· 全部为模拟数据 · 未连接真实项目</span></span><Space size={4}><Button size="small" type="text" icon={<QuestionCircleOutlined />} onClick={() => setGuideOpen(true)}>验收路径</Button><Tooltip title="恢复初始模拟数据，不影响真实数据"><Button size="small" type="text" icon={<ReloadOutlined />} aria-label="重置模拟数据" onClick={() => modal.confirm({ title: '重置本次模拟数据？', content: '仅恢复原型中的模拟项目、任务、消息和终端记录，不影响 ForgeDesk 的真实数据。', okText: '重置模拟数据', cancelText: '取消', onOk: () => { setData(createDemoData()); setTerminalContexts([]); setTerminalOpen(false); setPreviewId(undefined); go(globalRoute('workbench')) } })} /></Tooltip></Space></div>
    <div className="ia-shell">
      <aside className="ia-sidebar"><PrototypeSidebar /></aside>
      <Drawer title="目录" placement="left" width={270} open={mobileNav} onClose={() => setMobileNav(false)} className="ia-navigation-drawer"><PrototypeSidebar /></Drawer>
      <div className="ia-main-shell"><header className="ia-topbar"><div className="ia-topbar-leading"><Button className="ia-mobile-trigger" type="text" icon={<MenuOutlined />} aria-label="打开导航目录" onClick={() => setMobileNav(true)} /><Space size={2}><Button type="text" aria-label="后退" icon={<ArrowLeftOutlined />} disabled={navigation.state.index === 0} onClick={navigation.back} /><Button type="text" aria-label="前进" icon={<ArrowRightOutlined />} disabled={navigation.state.index === navigation.state.entries.length - 1} onClick={navigation.forward} /></Space><Breadcrumb items={breadcrumbs} /></div><Space><Tooltip title="打开模拟终端"><Button type="text" aria-label="打开模拟终端" icon={<CodeOutlined />} onClick={openTerminal} /></Tooltip><Button type="text" aria-label={dark ? '切换浅色主题' : '切换深色主题'} icon={dark ? <SunOutlined /> : <MoonOutlined />} onClick={onToggleTheme} /><span className="ia-user-avatar" aria-label="演示用户 Stone">S</span></Space></header>
        <main className="ia-content" id="ia-main-content" key={route.scope === 'project' ? `${route.projectId}/${route.page}/${route.entityId ?? ''}` : `${route.area}/${route.page}/${route.entityId ?? ''}`}>{renderPage()}</main>
        {terminalOpen ? <section className="ia-terminal" aria-label="模拟终端工作面板"><div className="ia-terminal-header"><Space><CodeOutlined /><strong>终端</strong><Select aria-label="终端会话" size="small" value={terminalId} onChange={setTerminalId} options={terminalContexts.map(item => ({ value: item.id, label: item.title }))} /><span className="ia-terminal-hint">仅回显 · 切换目录不丢失记录</span></Space><Button size="small" onClick={() => setTerminalOpen(false)}>收起终端</Button></div><pre aria-live="polite">{terminal?.lines.join('\n')}</pre><form onSubmit={event => { event.preventDefault(); runDemoCommand() }}><label htmlFor="ia-terminal-command">$</label><Input id="ia-terminal-command" value={command} onChange={event => setCommand(event.target.value)} placeholder="输入内容，仅回显，不执行" autoComplete="off" /><Button htmlType="submit" disabled={!command.trim()}>模拟回显</Button></form></section> : null}
      </div>
    </div>
    {createKind ? <CreateDialog kind={createKind} onClose={() => setCreateKind(null)} /> : null}
    <Drawer title="任务预览" width="min(480px, 100vw)" open={!!preview} onClose={() => setPreviewId(undefined)}>{preview ? <><div className="ia-eyebrow">{preview.id}</div><h2>{preview.title}</h2><StatusTag status={preview.status} /><p className="ia-body-copy">{preview.description}</p><h3>验收标准</h3><p className="ia-body-copy">{preview.acceptance}</p><p className="ia-muted">截止日期：{preview.due || '未设置'}</p>{preview.blocked ? <Alert className="ia-preview-alert" type="warning" showIcon message={preview.blocked} /> : null}<OpenTaskButton task={preview} /><p className="ia-footnote">完整详情中再查看子任务、AI 执行和历史。</p></> : null}</Drawer>
    <Drawer title="原型验收路径" width="min(540px, 100vw)" open={guideOpen} onClose={() => setGuideOpen(false)}><Alert type="info" showIcon message="此阶段只确认目录、信息层级和跳转" description="所有数据保存在页面内存中，刷新即重置。不会访问生产数据、执行 Git、连接服务器或调用 AI。" /><ol className="ia-guide"><li><strong>从零建立一个项目</strong><p>项目 → 创建项目 → 进度 / 目标 → 新建目标 → 新建任务 → 提交验收。</p><Button onClick={() => { setGuideOpen(false); go(globalRoute('projects')) }}>从项目入口开始</Button></li><li><strong>找到代码操作</strong><p>项目 → 代码 / 仓库 → 工作区变更、提交历史、推送与合并。</p><Button onClick={() => { setGuideOpen(false); go(projectRoute('forgedesk', 'repositories')) }}>查看仓库工作区</Button></li><li><strong>找到线上状态</strong><p>项目 → 运行 → 环境、部署、日志、域名。</p><Button onClick={() => { setGuideOpen(false); go(projectRoute('forgedesk', 'environments')) }}>查看项目运行</Button></li><li><strong>AI 与业务任务往返</strong><p>AI 工作台 → 会话 → 查看关联任务 → 返回原会话。</p><Button onClick={() => { setGuideOpen(false); go({ scope: 'global', area: 'ai', page: 'conversations', entityId: 'session-navigation' }) }}>打开演示会话</Button></li><li><strong>找辅助功能</strong><p>数据库在共享资源；文档在工具箱；AI 账号在设置；终端是上下文面板。</p></li></ol><p className="ia-footnote">确认这些归属后，再进行第二阶段真实功能接入。现有界面尚未替换。</p></Drawer>
  </div></PrototypeContext.Provider>
}

function PrototypeSidebar(): JSX.Element {
  const { data, route, navigate, openProject } = usePrototype()
  const project = route.scope === 'project' ? data.projects.find(item => item.id === route.projectId) : undefined
  const activeGroup = route.scope === 'project' ? getProjectGroup(route.page)?.key : undefined
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : [])
  const globalAreaKey = route.scope === 'global' ? route.area : undefined
  const [globalOpen, setGlobalOpen] = useState<string[]>(globalAreaKey ? [globalAreaKey] : [])
  const groupIdentity = route.scope === 'project' ? `${route.projectId}/${activeGroup ?? ''}` : route.area
  useEffect(() => { setOpenGroups(activeGroup ? [activeGroup] : []) }, [groupIdentity, activeGroup])
  useEffect(() => { setGlobalOpen(globalAreaKey ? [globalAreaKey] : []) }, [globalAreaKey])
  const currentArea = route.scope === 'global' ? GLOBAL_AREAS.find(item => item.key === route.area) : undefined
  function globalItems(placement: 'main' | 'footer'): NonNullable<Parameters<typeof Menu>[0]['items']> {
    return GLOBAL_AREAS.filter(item => item.placement === placement).map(item => ({
      key: item.key, icon: AREA_ICONS[item.key], label: item.label,
      ...(item.children.length ? { onTitleClick: () => { if (route.scope !== 'global' || route.area !== item.key) navigate(globalRoute(item.key)); else setGlobalOpen(current => current.includes(item.key) ? [] : [item.key]) }, children: item.children.map(child => ({ key: `${item.key}/${child.key}`, label: child.label })) } : {})
    }))
  }
  function globalClick(key: string): void {
    const [area, page] = key.split('/')
    const next = globalRoute(area as GlobalArea, page as GlobalPage | undefined)
    if (route.scope === 'global' && route.area === 'ai' && area === 'ai' && route.projectFilter) navigate({ ...next, projectFilter: route.projectFilter })
    else navigate(next)
  }
  return <div className="ia-sidebar-inner"><div className="ia-brand"><span className="ia-brand-mark"><AppstoreOutlined /></span><strong>ForgeDesk</strong><Tag>预览</Tag></div>{route.scope === 'project' ? <>
    <div className="ia-project-switch"><Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(globalRoute('projects'))}>项目列表</Button><label htmlFor="ia-project-switch">当前项目</label><Select id="ia-project-switch" aria-label="切换项目" value={project?.id} placeholder="选择项目" onChange={openProject} options={data.projects.filter(item => !item.archived || item.id === project?.id).map(item => ({ value: item.id, label: item.name }))} /></div>
    <nav aria-label="项目目录" className="ia-nav-scroll"><Menu mode="inline" selectedKeys={[route.page]} openKeys={openGroups} onOpenChange={keys => setOpenGroups(keys.filter(key => !openGroups.includes(key)).slice(-1))} onClick={({ key }) => navigate(projectRoute(route.projectId, key as ProjectPage))} items={[{ key: 'overview', label: '项目概览', icon: <DashboardOutlined /> }, ...PROJECT_GROUPS.map(group => ({ key: group.key, label: group.label, icon: GROUP_ICONS[group.key], children: group.children }))]} /></nav>
    <div className="ia-sidebar-bottom"><Button type="text" icon={<RobotOutlined />} onClick={() => navigate({ ...globalRoute('ai'), projectFilter: route.projectId })}>项目 AI 工作 ↗</Button><Button type="text" icon={<DashboardOutlined />} onClick={() => navigate(globalRoute('workbench'))}>返回工作台</Button></div>
  </> : <><nav aria-label="主导航" className="ia-nav-scroll"><Menu mode="inline" selectedKeys={[currentArea?.children.length ? `${route.area}/${route.page}` : route.area]} openKeys={currentArea?.placement === 'main' && currentArea.children.length ? globalOpen : []} onClick={({ key }) => globalClick(key)} items={globalItems('main')} /></nav><nav aria-label="辅助导航" className="ia-sidebar-bottom"><Menu mode="inline" selectedKeys={[`${route.area}/${route.page}`]} openKeys={currentArea?.placement === 'footer' ? globalOpen : []} onClick={({ key }) => globalClick(key)} items={globalItems('footer')} /></nav></>}
    <div className="ia-sidebar-note"><BookOutlined /> 目录验收阶段 · 无真实写入</div>
  </div>
}

type CreateValues = { title: string; description?: string; projectId?: string; goalId?: string; due?: string }

function CreateDialog({ kind, onClose }: { kind: CreateKind; onClose: () => void }): JSX.Element {
  const { data, setData, route, navigate, notify } = usePrototype()
  const [form] = Form.useForm<CreateValues>()
  const projectId = Form.useWatch('projectId', form)
  const label = kind === 'project' ? '项目' : kind === 'task' ? '任务' : kind === 'goal' ? '目标' : kind === 'milestone' ? '里程碑' : '版本计划'
  const defaultProject = route.scope === 'project' ? route.projectId : kind === 'task' ? '' : data.projects.find(item => !item.archived)?.id
  const defaultGoal = route.scope === 'project' && route.page === 'goals' ? route.entityId : undefined
  function finish(values: CreateValues): void {
    const id = `demo-${crypto.randomUUID().slice(0, 8)}`
    if (kind === 'project') {
      setData(current => ({ ...current, projects: [...current.projects, { id, name: values.title.trim(), description: values.description?.trim() || '从目标和任务开始。' }] }))
      navigate(projectRoute(id))
    } else if (kind === 'task') {
      const task: DemoTask = { id, projectId: values.projectId ?? '', title: values.title.trim(), description: values.description?.trim() || '尚未补充任务说明。', status: 'todo', owner: 'Stone', start: DEMO_TODAY, due: values.due ?? '', goalId: values.goalId, ...(route.scope === 'project' && route.projectId === values.projectId && route.entityId ? { milestoneId: route.page === 'milestones' ? route.entityId : undefined, versionId: route.page === 'versions' ? route.entityId : undefined } : {}), acceptance: '由人工确认交付结果是否符合任务目标。', events: ['人工创建业务任务（演示）'] }
      setData(current => ({ ...current, tasks: [...current.tasks, task] }))
      navigate(task.projectId ? projectRoute(task.projectId, 'tasks', id) : { scope: 'global', area: 'workbench', page: 'tasks', entityId: id })
    } else {
      if (!values.projectId) return
      setData(current => ({ ...current, plans: [...current.plans, { id, projectId: values.projectId!, kind, title: values.title.trim(), description: values.description?.trim() ?? '', due: values.due ?? '' }] }))
      navigate(projectRoute(values.projectId, kind === 'goal' ? 'goals' : kind === 'milestone' ? 'milestones' : 'versions', id))
    }
    notify(`已创建模拟${label}，刷新后会重置。`)
    onClose()
  }
  return <Modal title={`新建${label} · 仅模拟`} open onCancel={onClose} onOk={() => form.submit()} okText={`创建${label}`} cancelText="取消" destroyOnHidden><Form form={form} layout="vertical" initialValues={{ projectId: defaultProject, goalId: defaultGoal, due: '2026-10-22' }} onFinish={finish} onValuesChange={changed => { if ('projectId' in changed) form.setFieldValue('goalId', undefined) }}>
    <Form.Item name="title" label={`${label}名称`} rules={[{ required: true, whitespace: true, message: `请输入${label}名称` }]}><Input autoFocus maxLength={120} placeholder={`输入${label}名称`} /></Form.Item>
    <Form.Item name="description" label="说明"><Input.TextArea rows={3} maxLength={1000} placeholder="描述目标或交付内容" /></Form.Item>
    {kind !== 'project' ? <Form.Item name="projectId" label="所属项目" rules={kind !== 'task' ? [{ required: true, message: '请选择所属项目' }] : []}><Select options={[...(kind === 'task' ? [{ value: '', label: '未归属收件箱' }] : []), ...data.projects.filter(item => !item.archived).map(item => ({ value: item.id, label: item.name }))]} /></Form.Item> : null}
    {kind === 'task' ? <Form.Item name="goalId" label="关联目标"><Select allowClear placeholder="可不关联目标" options={data.plans.filter(item => item.kind === 'goal' && item.projectId === projectId).map(item => ({ value: item.id, label: item.title }))} /></Form.Item> : null}
    {kind !== 'project' ? <Form.Item name="due" label="截止日期"><Input type="date" /></Form.Item> : null}
    <p className="ia-footnote">仅保存在原型内存中，不创建目录、仓库或数据库记录。</p>
  </Form></Modal>
}
