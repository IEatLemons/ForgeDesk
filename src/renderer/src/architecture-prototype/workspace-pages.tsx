import { useState } from 'react'
import { Alert, Button, Descriptions, Input, Modal, Segmented, Select, Space, Tabs, Tag, Timeline } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CodeOutlined, PlusOutlined } from '@ant-design/icons'
import { usePrototype } from './context'
import { summarizeTasks } from './data'
import { globalRoute, projectRoute } from './navigation'
import { BlankState, PageHeader, Panel, ProjectLink, TaskRows } from './ui'

export function WorkbenchPage(): JSX.Element {
  const { data, navigate, openProject } = usePrototype()
  const summary = summarizeTasks(data.tasks)
  const attention = data.tasks.filter(task => !task.parentId && (task.status === 'review' || task.blocked))
  return <>
    <PageHeader eyebrow="跨项目工作台" title="先看需要你处理的事" description="从这里发现问题，进入对应项目处理。资讯和本机工具不再占据首页。" />
    <div className="ia-workbench-summary"><div><strong>{summary.review}</strong><span>任务待验收</span></div><div><strong>{summary.overdue}</strong><span>任务已延期</span></div><div><strong>{summary.blocked}</strong><span>任务有阻塞</span></div><button onClick={() => navigate({ scope: 'global', area: 'resources', page: 'services' })}><strong>{data.deployments.filter(item => item.status === '待检查').length}</strong><span>环境需要检查 →</span></button></div>
    <Panel title="需要关注" extra={<Button type="link" onClick={() => navigate(globalRoute('workbench', 'tasks'))}>跨项目待办 →</Button>}><TaskRows tasks={attention} showProject /></Panel>
    <Panel title="最近项目" extra={<Button type="link" onClick={() => navigate(globalRoute('projects'))}>全部项目 →</Button>}><div className="ia-project-list">{data.projects.filter(item => !item.archived).slice(0, 3).map(project => <button key={project.id} className="ia-project-link" onClick={() => openProject(project.id)}><span className="ia-project-avatar">{project.name.slice(0, 1)}</span><span><strong>{project.name}</strong><small>{project.description}</small></span><ArrowRightOutlined /></button>)}</div></Panel>
    <p className="ia-footnote">当前均为模拟状态。正式接入时，未配置或过期的状态将明确标记，不推断为正常。</p>
  </>
}

export function ProjectsPage(): JSX.Element {
  const { data, setData, openProject, create } = usePrototype()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('进行中')
  const projects = data.projects.filter(item => (view === '已归档' ? item.archived : !item.archived) && item.name.toLowerCase().includes(search.toLowerCase()))
  return <>
    <PageHeader eyebrow="项目入口" title="项目" description="选择一个项目，进入它的进度、代码和运行空间。" actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => create('project')}>创建项目</Button>} />
    <div className="ia-toolbar"><Input.Search aria-label="搜索项目" placeholder="搜索项目" value={search} onChange={event => setSearch(event.target.value)} allowClear /><Segmented value={view} onChange={value => setView(String(value))} options={['进行中', '已归档']} /></div>
    <Panel>{projects.length ? projects.map(project => { const stats = summarizeTasks(data.tasks.filter(task => task.projectId === project.id)); return <div key={project.id} className="ia-project-table-row"><div className="ia-project-avatar">{project.name.slice(0, 1)}</div><div><button className="ia-text-button" onClick={() => openProject(project.id)}>{project.name}</button><p className="ia-muted">{project.description}</p><span className="ia-meta">{project.repository ? `仓库 ${project.repository}` : '未绑定仓库'} · {stats.total} 项任务 · {stats.review} 待验收</span></div><Button onClick={() => setData(current => ({ ...current, projects: current.projects.map(item => item.id === project.id ? { ...item, archived: !item.archived } : item) }))}>{project.archived ? '恢复项目' : '归档'}</Button><Button onClick={() => openProject(project.id)}>进入项目 →</Button></div> }) : <BlankState title={view === '已归档' ? '暂无归档项目' : '没有匹配的项目'} description="可以创建不依赖仓库或外部系统的项目。" />}</Panel>
  </>
}

export function RepositoryPage(): JSX.Element {
  const { data, setData, route, navigate, openTerminal, notify } = usePrototype()
  const [tab, setTab] = useState('changes')
  const [commitOpen, setCommitOpen] = useState(false)
  const [commitTitle, setCommitTitle] = useState('')
  const project = data.projects.find(item => route.scope === 'project' && item.id === route.projectId)!
  if (!project.repository) return <><PageHeader eyebrow="代码" title="仓库" description="项目进度不依赖 Git 仓库。" /><Panel><BlankState title="尚未绑定仓库" description="需要管理代码时，再到项目设置中添加仓库。" action="前往仓库设置" onAction={() => navigate(projectRoute(project.id, 'settings-repositories'))} /></Panel></>
  function commit(): void {
    if (!commitTitle.trim()) return
    setData(current => ({ ...current, commits: [{ id: `demo-${crypto.randomUUID().slice(0, 6)}`, projectId: project.id, title: commitTitle.trim(), time: '刚刚 · 模拟提交' }, ...current.commits] }))
    setCommitOpen(false)
    setCommitTitle('')
    setTab('history')
    notify('已添加模拟提交记录。没有执行 Git 命令。')
  }
  return <>
    <PageHeader eyebrow="代码 / 仓库工作区" title={project.repository} description="仓库相关的变更、历史、分支和远程操作集中在这里。" actions={<Button icon={<CodeOutlined />} onClick={openTerminal}>打开项目终端</Button>} />
    <div className="ia-repository-bar"><Space wrap><Tag color="blue">main</Tag><span>2 项演示变更</span><span className="ia-muted">↑ 1 待推送 · ↓ 0</span></Space><Space><Button onClick={() => notify('演示推送确认入口；没有连接任何远程仓库。')}>推送</Button><Button onClick={() => notify('演示合并确认入口；正式接入时会先检查分支与工作区。')}>合并</Button><Button type="primary" onClick={() => setCommitOpen(true)}>提交变更</Button></Space></div>
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: 'changes', label: '工作区变更', children: <Panel title="待提交文件">{['src/navigation.ts', 'src/project-shell.tsx'].map((file, index) => <div className="ia-file-row" key={file}><Tag color={index ? 'green' : 'orange'}>{index ? 'A' : 'M'}</Tag><code>{file}</code><span className="ia-muted">+{index ? 84 : 26} / −{index ? 0 : 12}</span></div>)}<div className="ia-code-preview"><span className="ia-muted">变更预览 · 演示片段</span><pre>{'-  所有功能平铺\n+  项目 → 进度 / 代码 / 运行\n+  辅助功能 → 工具箱'}</pre></div></Panel> },
      { key: 'history', label: '提交历史', children: <Panel title="Log 树 / 提交历史"><Timeline items={data.commits.filter(item => item.projectId === project.id).map(item => ({ key: item.id, color: 'blue', children: <div><strong>{item.title}</strong><p className="ia-meta">{item.id} · {item.time}</p></div> }))} /></Panel> },
      { key: 'branches', label: '分支', children: <Panel title="本地分支">{['main · 当前分支', 'feature/navigation · 演示分支'].map(item => <div className="ia-file-row" key={item}><code>{item}</code></div>)}</Panel> },
      { key: 'remotes', label: '远程与多端对齐', children: <Panel title="远程状态"><p>origin / main · 已对齐（模拟状态）</p><p className="ia-muted">多端对齐属于仓库能力，不再与整个项目的进度、运行同级。</p><Button onClick={() => notify('仅演示拉取入口；未执行 fetch 或 pull。')}>检查远程差异</Button></Panel> }
    ]} />
    <Modal title="提交变更 · 仅模拟" open={commitOpen} onCancel={() => setCommitOpen(false)} onOk={commit} okText="创建模拟提交" okButtonProps={{ disabled: !commitTitle.trim() }} cancelText="取消"><Alert type="info" showIcon message="不会读取、暂存或提交真实文件" /><label className="ia-field-label" htmlFor="demo-commit-title">提交说明</label><Input id="demo-commit-title" value={commitTitle} onChange={event => setCommitTitle(event.target.value)} placeholder="描述本次变更" maxLength={200} /></Modal>
  </>
}

export function ContributionsPage(): JSX.Element {
  const { data, route, navigate } = usePrototype()
  const project = data.projects.find(item => route.scope === 'project' && item.id === route.projectId)!
  return <><PageHeader eyebrow="代码" title="提交分析" description="原“数据”页：分析代码贡献，不是数据库，也不是业务任务完成率。" /><Panel title="最近 7 天 · 模拟数据">{project.repository ? <><div className="ia-workbench-summary"><div><strong>18</strong><span>提交</span></div><div><strong>2</strong><span>贡献者</span></div><div><strong>+842</strong><span>新增行</span></div><div><strong>−216</strong><span>删除行</span></div></div><div className="ia-chart" role="img" aria-label="最近七天演示提交数量：2、4、1、3、5、1、2">{[2, 4, 1, 3, 5, 1, 2].map((count, index) => <div key={index}><span style={{ height: count * 23 }}>{count}</span><small>10/{9 + index}</small></div>)}</div></> : <BlankState title="尚无仓库数据" description="绑定仓库后才展示提交分析，不影响任务管理。" action="前往仓库设置" onAction={() => navigate(projectRoute(project.id, 'settings-repositories'))} />}</Panel></>
}

export function RuntimePage(): JSX.Element {
  const { data, setData, route, navigate, notify } = usePrototype()
  const [environment, setEnvironment] = useState('全部环境')
  const [deployOpen, setDeployOpen] = useState(false)
  const [target, setTarget] = useState('自有服务器 · SSH / PM2')
  const [version, setVersion] = useState('')
  if (route.scope !== 'project') return <></>
  const projectId = route.projectId
  const page = route.page
  const deployments = data.deployments.filter(item => item.projectId === projectId)
  const visible = deployments.filter(item => environment === '全部环境' || item.environment === environment)
  const title = page === 'environments' ? '环境与服务' : page === 'deployments' ? '部署与发布' : page === 'monitoring' ? '日志与监控' : '域名'
  function deploy(): void {
    setData(current => ({ ...current, deployments: [{ id: `demo-deploy-${crypto.randomUUID()}`, projectId, environment: '预览', target, version: version.trim() || '演示构建', status: '运行正常', time: '刚刚 · 仅模拟' }, ...current.deployments] }))
    setDeployOpen(false)
    notify('已生成模拟发布记录，没有连接服务器或托管平台。')
  }
  return <>
    <PageHeader eyebrow="项目运行" title={title} description="查看和操作属于当前项目的运行资源；账号与绑定配置在设置中管理。" actions={page === 'deployments' && deployments.length ? <Button type="primary" onClick={() => setDeployOpen(true)}>发起部署</Button> : undefined} />
    {!deployments.length ? <Panel><BlankState title="尚未配置运行环境" description="可以先使用目标和任务；需要上线时再配置服务绑定或部署目标。" action="前往运行配置" onAction={() => navigate(projectRoute(projectId, 'settings-runtime'))} /></Panel> : <>
      <div className="ia-toolbar"><Select aria-label="运行环境" value={environment} onChange={setEnvironment} options={['全部环境', '生产', '预览'].map(value => ({ value, label: value }))} /><span className="ia-muted">云平台与自有服务器统一按环境组织</span></div>
      {page === 'environments' ? <Panel title="环境与绑定服务">{visible.map(item => <div className="ia-resource-row" key={item.id}><div><Space wrap><strong>{item.environment}环境</strong><Tag color={item.status === '待检查' ? 'orange' : 'green'}>{item.status}</Tag></Space><p className="ia-muted">{item.target} · {item.version}</p></div><Space wrap><Button onClick={() => navigate(projectRoute(projectId, 'monitoring'))}>查看日志</Button><Button onClick={() => navigate(projectRoute(projectId, 'deployments'))}>部署与发布 →</Button></Space></div>)}</Panel> : null}
      {page === 'deployments' ? <><Panel title="发布记录">{visible.map(item => <div className="ia-resource-row" key={item.id}><div><strong>{item.version}</strong><p className="ia-muted">{item.environment} · {item.target} · {item.time}</p></div><Tag color={item.status === '待检查' ? 'orange' : 'green'}>{item.status}</Tag></div>)}</Panel><Panel title="其他交付类型"><div className="ia-resource-row"><div><strong>移动端构建与分发</strong><p className="ia-muted">保留现有 Codemagic / Firebase 发布能力，与服务部署区分展示。</p></div><Button onClick={() => notify('这是移动端分发的演示入口；不会启动构建或上传产物。')}>查看分发入口</Button></div></Panel></> : null}
      {page === 'monitoring' ? <Panel title="服务日志 · 模拟内容"><Alert type="warning" showIcon message="预览环境需要检查" description="演示告警：健康检查超时。正式页面会标记数据来源、更新时间与未知状态。" /><pre className="ia-log">{'10:20:01  INFO  服务进程启动\n10:20:03  INFO  生产环境健康检查通过\n10:20:10  WARN  预览环境健康检查超时\n\n仅演示文本，未连接真实日志流。'}</pre><Button onClick={() => notify('日志刷新为模拟操作，没有请求远程服务。')}>刷新日志</Button></Panel> : null}
      {page === 'domains' ? <Panel title="项目域名"><div className="ia-resource-row"><div><strong>app.example.com</strong><p className="ia-muted">生产环境 · HTTPS 已配置（模拟）</p></div><Tag color="green">已绑定</Tag></div><Button onClick={() => notify('域名操作的演示入口；未修改任何 DNS 记录。')}>管理域名与 DNS</Button><p className="ia-footnote">日常域名操作在这里；项目级 Zone 与 Token 仍在运行配置中，不改变凭据归属。</p></Panel> : null}
    </>}
    <Modal title="发起部署 · 仅模拟" open={deployOpen} onCancel={() => setDeployOpen(false)} onOk={deploy} okText="生成模拟发布记录" cancelText="取消"><Alert type="info" showIcon message="不会执行构建、推送或连接服务器" /><label className="ia-field-label" htmlFor="demo-deploy-target">部署目标</label><Select id="demo-deploy-target" className="ia-full-width" value={target} onChange={setTarget} options={['自有服务器 · SSH / PM2', '自有服务器 · Docker Compose', '托管平台 · Vercel', '托管平台 · Railway'].map(value => ({ value, label: value }))} /><label className="ia-field-label" htmlFor="demo-deploy-version">交付版本</label><Input id="demo-deploy-version" value={version} onChange={event => setVersion(event.target.value)} placeholder="例如：预览构建 44" /></Modal>
  </>
}

export function AiPage(): JSX.Element {
  const { data, setData, route, navigate, previousRoute, back } = usePrototype()
  const [tool, setTool] = useState('全部工具')
  const [draft, setDraft] = useState('')
  if (route.scope !== 'global') return <></>
  const projectFilter = route.projectFilter ?? 'all'
  const sessions = data.sessions.filter(item => (projectFilter === 'all' || item.projectId === projectFilter) && (tool === '全部工具' || item.tool === tool))
  const selected = route.page === 'conversations' ? sessions.find(item => item.id === route.entityId) : undefined
  const title = selected?.title ?? (route.page === 'activity' ? '运行动态' : route.page === 'directories' ? '工作目录' : '会话')
  function send(): void {
    if (!selected || !draft.trim()) return
    const sessionId = selected.id
    const content = draft.trim()
    setData(current => ({ ...current, messages: { ...current.messages, [sessionId]: [...(current.messages[sessionId] ?? []), { role: 'user', content }, { role: 'assistant', content: '这是本地模拟回复。未调用模型，也没有自动创建或完成业务任务。' }] } }))
    setDraft('')
  }
  return <>
    {selected ? <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => previousRoute?.scope === 'project' ? back() : navigate({ ...route, entityId: undefined })}>{previousRoute?.scope === 'project' ? '返回原项目任务' : '返回会话列表'}</Button> : null}
    <PageHeader eyebrow="AI 工作台" title={title} description="跨项目查看 AI 活动。会话、执行与业务任务不是同一个概念。" actions={<Button onClick={() => navigate({ scope: 'global', area: 'settings', page: 'credentials', entityId: 'ai-accounts' })}>账号设置</Button>} />
    <div className="ia-toolbar"><Select aria-label="AI 项目筛选" value={projectFilter} onChange={value => navigate({ ...route, projectFilter: value === 'all' ? undefined : value, entityId: undefined })} options={[{ value: 'all', label: '全部项目' }, ...data.projects.map(item => ({ value: item.id, label: item.name }))]} /><Select aria-label="AI 工具筛选" value={tool} onChange={setTool} options={['全部工具', 'Codex', 'Cursor', '通用助手'].map(value => ({ value, label: value }))} /><span className="ia-muted">当前：{data.activeAccount}</span></div>
    {route.entityId && route.page === 'conversations' && !selected ? <BlankState title="该筛选条件下没有此会话" description="调整项目或工具筛选后再查看。" /> : selected ? <div className="ia-conversation-layout"><Panel title="会话内容"><div className="ia-messages">{(data.messages[selected.id] ?? []).map((item, index) => <div key={`${selected.id}-${index}`} className={`ia-message ia-message-${item.role}`}><small>{item.role === 'user' ? '你' : `${selected.tool} · 演示`}</small><p>{item.content}</p></div>)}</div><div className="ia-chat-composer"><Input.TextArea aria-label="模拟会话消息" value={draft} onChange={event => setDraft(event.target.value)} placeholder="输入消息，仅生成本地模拟回复" autoSize={{ minRows: 2, maxRows: 5 }} /><Button type="primary" disabled={!draft.trim()} onClick={send}>发送模拟消息</Button></div></Panel><Panel title="关联上下文"><ProjectLink projectId={selected.projectId} /><p className="ia-muted">{selected.cwd}</p><Tag>{selected.status}</Tag>{selected.taskId && selected.projectId ? <Button className="ia-full-width" onClick={() => navigate(projectRoute(selected.projectId!, 'tasks', selected.taskId))}>查看关联任务</Button> : <p className="ia-footnote">普通会话，不自动创建业务任务。</p>}<p className="ia-footnote">进入关联任务后，可返回本会话，保留模拟消息。</p></Panel></div> : <Panel title={route.page === 'directories' ? '关联工作目录' : route.page === 'activity' ? '执行与关注事项' : '全部会话'}>{sessions.map(session => <div className="ia-resource-row" key={session.id}><div><Space wrap><strong>{route.page === 'directories' ? session.cwd : session.title}</strong><Tag>{session.tool}</Tag></Space><p className="ia-muted">{session.status}</p><ProjectLink projectId={session.projectId} /></div><Space wrap>{session.taskId && session.projectId ? <Button onClick={() => navigate(projectRoute(session.projectId!, 'tasks', session.taskId))}>关联任务</Button> : null}<Button onClick={() => navigate({ ...route, page: 'conversations', entityId: session.id })}>打开会话 →</Button></Space></div>)}{!sessions.length ? <BlankState title="暂无关联 AI 活动" description="项目可以完全不使用 AI。普通任务依然可正常管理。" /> : null}</Panel>}
  </>
}

export function ResourcesPage(): JSX.Element {
  const { data, route, navigate, notify } = usePrototype()
  if (route.scope !== 'global') return <></>
  const title = route.page === 'services' ? '服务与部署总览' : route.page === 'data' ? '数据库与存储' : '本机容器'
  return <><PageHeader eyebrow="共享资源" title={title} description="这里只管理跨项目共享的资源，不为没有归属关系的数据源虚构项目绑定。" />
    {route.page === 'services' ? <Panel title="跨项目部署状态">{data.deployments.map(item => <div className="ia-resource-row" key={item.id}><div><strong>{item.environment} · {item.target}</strong><p className="ia-muted">{item.version} · {item.status}</p><ProjectLink projectId={item.projectId} /></div><Button onClick={() => navigate(projectRoute(item.projectId, 'environments'))}>进入项目运行 →</Button></div>)}</Panel> : route.page === 'data' ? <Panel title="连接目录">{['PostgreSQL · 本地开发', 'MySQL · 测试实例', 'Redis · 开发缓存', 'S3 · 演示对象存储'].map(item => <div className="ia-resource-row" key={item}><div><strong>{item}</strong><p className="ia-muted">连接参数与内容均为模拟数据</p></div><Button onClick={() => notify(`${item}：这是连接和浏览内容的演示入口，未发起网络连接。`)}>浏览</Button></div>)}</Panel> : <Panel title="容器与镜像">{['postgres-dev · 运行中', 'redis-dev · 运行中', 'api-preview · 已停止'].map(item => <div className="ia-resource-row" key={item}><code>{item}</code><Button onClick={() => notify('容器详情演示：配置、挂载、网络、日志。未连接 Docker。')}>查看详情</Button></div>)}</Panel>}
  </>
}

const TOOL_CATEGORIES: Record<string, { title: string; items: [string, string][] }> = {
  reading: { title: '资料资讯', items: [['文档与资料', '查看现有 Lark 文档与资料入口。'], ['市场资讯', '关注行情和行业资讯，不占据项目首页。']] },
  diagnostics: { title: '本机诊断', items: [['电脑监控', '查看 CPU、内存及本机运行状态。'], ['系统信息', '查看硬件和系统环境。'], ['命令行环境诊断', '检查本机开发工具是否可用。']] },
  development: { title: '开发辅助', items: [['通用终端', '没有指定项目时使用的命令行工作面板。'], ['环境变量比较', '比较不同环境的配置差异。']] },
  utilities: { title: '安全与数据工具', items: [['密码工具', '生成或检查密码。'], ['RSA 工具', '处理通用密钥格式；实际 SSH 身份管理在设置中。'], ['Excel 工具', '处理表格与数据转换。']] }
}

export function ToolboxPage(): JSX.Element {
  const { route, openTerminal, navigate } = usePrototype()
  if (route.scope !== 'global') return <></>
  const category = TOOL_CATEGORIES[route.page] ?? TOOL_CATEGORIES.reading
  const selected = category.items.find(item => item[0] === route.entityId)
  return <><PageHeader eyebrow="工具箱" title={selected?.[0] ?? category.title} description={selected?.[1] ?? '先选择用途分类，再进入具体工具。辅助能力全部保留。'} />
    {selected ? <><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate({ ...route, entityId: undefined })}>返回{category.title}</Button><Panel title={selected[0]}><Alert type="info" showIcon message="这是工具所在位置的交互原型" description="真实工具未在本阶段接入，不读取文档、本机指标、密钥或文件。" /><div className="ia-detail-block">{route.page === 'reading' ? <div className="ia-file-row"><strong>{selected[0] === '文档与资料' ? '项目需求说明 · 演示文档' : '行业动态 · 演示资讯'}</strong><Tag>示例</Tag></div> : <Descriptions column={1} items={[{ key: 'scope', label: '使用范围', children: '跨项目通用工具' }, { key: 'status', label: '数据来源', children: '仅模拟，未连接外部系统' }]} />}</div></Panel></> : <Panel title="选择工具">{category.items.map(([title, description]) => <div className="ia-resource-row" key={title}><div><strong>{title}</strong><p className="ia-muted">{description}</p></div><Button onClick={() => title === '通用终端' ? openTerminal() : navigate({ ...route, entityId: title })}>打开 →</Button></div>)}</Panel>}
  </>
}

export function SettingsPage(): JSX.Element {
  const { data, setData, route, navigate, notify } = usePrototype()
  const [draftValue, setDraftValue] = useState('')
  if (route.scope === 'project') {
    const project = data.projects.find(item => item.id === route.projectId)!
    const groups: Record<string, [string, string][]> = {
      'settings-general': [['项目基本信息', project.name], ['人员映射', '项目成员与 Git 身份映射']],
      'settings-repositories': [['仓库绑定', project.repository ?? '尚未绑定'], ['仓库默认行为', 'Git 操作默认值、远程与分支显示']],
      'settings-runtime': [['部署目标与服务绑定', '云平台、自有服务器与容器目标'], ['发布配置', 'Firebase 分发与产物设置'], ['域名连接配置', '项目级 Cloudflare Zone 与 Token']],
      'settings-integrations': [['Plane 绑定', '外部进度来源映射，不实施双向写回'], ['Codex 工作目录绑定', '关联已有原生工作目录与会话']]
    }
    const items = groups[route.page] ?? []
    return <><PageHeader eyebrow={`${project.name} / 项目设置`} title={route.page === 'settings-general' ? '基本信息与人员' : route.page === 'settings-repositories' ? '仓库设置' : route.page === 'settings-runtime' ? '运行配置' : '外部绑定'} description="只配置当前项目；日常工作在进度、代码和运行中完成。" /><Panel>{items.map(([title, description]) => <div className="ia-resource-row" key={title}><div><strong>{title}</strong><p className="ia-muted">{description}</p></div><Button onClick={() => navigate({ ...route, entityId: title })}>配置</Button></div>)}</Panel>{route.entityId ? <Panel title={`${route.entityId} · 模拟配置`}><Alert type="info" showIcon message="不改变真实配置与凭据" /><div className="ia-detail-block"><label className="ia-field-label" htmlFor="demo-project-setting">演示配置值</label><Input id="demo-project-setting" value={draftValue} onChange={event => setDraftValue(event.target.value)} placeholder="不填写真实凭据" /><Button className="ia-save-setting" onClick={() => notify('已演示配置保存操作，未修改真实项目。')}>模拟保存</Button></div></Panel> : null}</>
  }
  const groups: Record<string, { title: string; items: [string, string, string][] }> = {
    appearance: { title: '界面与系统', items: [['appearance', '外观与显示', '主题、菜单栏、刷新和高级内容折叠。']] },
    credentials: { title: '身份凭据', items: [['ai-accounts', 'AI 账号', '登录、导入、额度及账号切换。'], ['git-identity', 'Git 身份与签名', '用户名、邮箱和 GPG 签名。'], ['ssh', 'SSH 身份与连接', '私钥、公钥与 SSH config。'], ['platform-tokens', '平台访问凭据', 'GitHub、Codemagic 与托管平台凭据。']] },
    integrations: { title: '外部集成', items: [['plane', 'Plane', '连接信息与项目映射。'], ['lark', 'Lark / 飞书', '文档、监听与通知配置。'], ['ai-provider', 'AI 模型与本地服务', '通用助手、模型连接和本地 API 服务。']] },
    maintenance: { title: '数据与维护', items: [['migration', '历史任务迁移', '预览、核对报告、备份与恢复入口。'], ['legacy', '旧待办与 AI 工作流', '保留历史追溯和未迁移用户的恢复路径。'], ['repair', '原始记录修复', '保留原始快照；本原型不会运行修复。'], ['updates', '应用更新', '版本信息、检查更新和系统日志。']] }
  }
  const category = groups[route.page] ?? groups.appearance
  const selected = category.items.find(item => item[0] === route.entityId)
  return <><PageHeader eyebrow="全局设置" title={selected?.[1] ?? category.title} description={selected?.[2] ?? '全局连接与凭据在这里管理，不与项目内的日常操作混在一起。'} />{selected ? <>
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate({ ...route, entityId: undefined })}>返回{category.title}</Button>
    <Panel title={selected[1]}>{selected[0] === 'ai-accounts' ? <>{['个人账号（演示）', '团队账号（演示）'].map(account => <div className="ia-resource-row" key={account}><div><strong>{account}</strong><p className="ia-muted">模拟账号 · 未读取真实登录态或额度</p></div><Button type={data.activeAccount === account ? 'primary' : 'default'} onClick={() => setData(current => ({ ...current, activeAccount: account }))}>{data.activeAccount === account ? '当前账号' : '模拟切换'}</Button></div>)}</> : <Alert type="info" showIcon message="设置页面骨架，未接入真实配置" description={route.page === 'maintenance' ? '不会启动迁移、激活新读取、修改旧存储或访问备份文件。真实恢复入口在第二阶段保留并接入。' : '本轮仅确认功能归属；请勿输入真实密钥或凭据。'} />}</Panel>
    </> : <Panel title="设置项目">{category.items.map(([id, title, description]) => <div className="ia-resource-row" key={id}><div><strong>{title}</strong><p className="ia-muted">{description}</p></div><Button onClick={() => navigate({ ...route, entityId: id })}>管理 →</Button></div>)}</Panel>}</>
}
