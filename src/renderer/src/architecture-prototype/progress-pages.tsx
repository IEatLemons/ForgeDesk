import { useState } from 'react'
import { Alert, Button, Descriptions, Input, Progress, Segmented, Select, Space, Tabs, Tag, Timeline } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { usePrototype } from './context'
import { acceptDemoTask, isOverdue, summarizeTasks, TASK_STATUSES, tasksForPlan, type DemoPlan, type DemoTask, type TaskStatus } from './data'
import { globalRoute, projectRoute, type TaskTab } from './navigation'
import { BlankState, PageHeader, Panel, StatusTag, SummaryProgress, TaskRows } from './ui'

export function ProjectOverview(): JSX.Element {
  const { data, route, navigate, create, openTerminal } = usePrototype()
  const projectId = route.scope === 'project' ? route.projectId : ''
  const project = data.projects.find(item => item.id === projectId)!
  const tasks = data.tasks.filter(task => task.projectId === projectId && !task.parentId)
  const summary = summarizeTasks(tasks)
  const deployments = data.deployments.filter(item => item.projectId === projectId)
  const environmentCount = new Set(deployments.map(item => item.environment)).size
  return <>
    <PageHeader eyebrow="项目工作空间" title={project.name} description={project.description} actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => create('task')}>新建任务</Button>} />
    <div className="ia-focus-summary">
      <button onClick={() => navigate(projectRoute(projectId, 'tasks'))}><span>项目进度</span><strong>{summary.percent}<small>%</small></strong><span>{summary.done} / {summary.total} 任务完成 · {summary.review} 待验收</span></button>
      <button onClick={() => navigate(projectRoute(projectId, 'repositories'))}><span>代码</span><strong>{project.repository ? '2 项变更' : '未绑定仓库'}</strong><span>{project.repository ? `${project.repository} · main` : '不影响目标和任务管理'}</span></button>
      <button onClick={() => navigate(projectRoute(projectId, 'environments'))}><span>线上运行</span><strong>{environmentCount ? `${environmentCount} 个环境` : '尚未配置'}</strong><span>{deployments.some(item => item.status === '待检查') ? '预览环境需要检查' : '进入后查看服务与部署'}</span></button>
    </div>
    <div className="ia-two-column"><Panel title="接下来要做" extra={<Button type="link" onClick={() => navigate(projectRoute(projectId, 'tasks'))}>全部任务 →</Button>}><TaskRows tasks={tasks.filter(task => task.status !== 'done' && task.status !== 'cancelled')} /></Panel>
      <Panel title="当前目标">{data.plans.filter(item => item.projectId === projectId && item.kind === 'goal').map(plan => { const stats = summarizeTasks(tasksForPlan(data.tasks, plan)); return <div key={plan.id} className="ia-plan-summary"><button className="ia-text-button" onClick={() => navigate(projectRoute(projectId, 'goals', plan.id))}>{plan.title}</button><p className="ia-muted">{plan.description}</p><SummaryProgress {...stats} /></div> })}{!data.plans.some(item => item.projectId === projectId && item.kind === 'goal') ? <BlankState title="先确定一个目标" description="无需绑定仓库、AI 或 Plane。" action="新建目标" onAction={() => create('goal')} /> : null}</Panel>
    </div>
    <div className="ia-context-actions"><span>项目上下文</span><Button size="small" onClick={openTerminal}>打开终端</Button><Button size="small" icon={<RobotOutlined />} onClick={() => navigate({ ...globalRoute('ai'), projectFilter: projectId })}>查看项目 AI 工作</Button></div>
  </>
}

export function TaskPage({ crossProject = false }: { crossProject?: boolean }): JSX.Element {
  const { data, route, create, previewTask } = usePrototype()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [scope, setScope] = useState('all')
  const [view, setView] = useState('列表')
  const projectId = route.scope === 'project' ? route.projectId : undefined
  const selectedTask = route.entityId ? data.tasks.find(item => item.id === route.entityId && (!projectId || item.projectId === projectId)) : undefined
  if (route.entityId && !selectedTask) return <BlankState title="演示任务不存在" description="新增的模拟数据只在本次页面会话中保留。请返回任务列表。" />
  if (selectedTask) return <TaskDetail task={selectedTask} />
  const tasks = data.tasks.filter(task => !task.parentId && (crossProject || task.projectId === projectId) && (status === 'all' || task.status === status) && (scope === 'all' || (scope === 'inbox' ? !task.projectId : task.projectId === scope)) && `${task.title} ${task.id}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <PageHeader eyebrow={crossProject ? '工作台 / 同一份项目任务数据' : '项目进度'} title={crossProject ? '跨项目待办' : '任务'} description="跟踪业务交付。AI 执行结束后，仍需人工验收。" actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => create('task')}>新建任务</Button>} />
    <div className="ia-toolbar"><Input.Search aria-label="搜索任务" placeholder="搜索标题或编号" value={search} onChange={event => setSearch(event.target.value)} allowClear />
      <Select aria-label="任务状态" value={status} onChange={setStatus} options={[{ value: 'all', label: '全部状态' }, ...TASK_STATUSES.map(item => ({ value: item.key, label: item.label }))]} />
      {crossProject ? <Select aria-label="任务项目" value={scope} onChange={setScope} options={[{ value: 'all', label: '全部项目' }, { value: 'inbox', label: '未归属收件箱' }, ...data.projects.map(item => ({ value: item.id, label: item.name }))]} /> : null}
      <Segmented aria-label="任务视图" value={view} onChange={value => setView(String(value))} options={['列表', '看板', '甘特图']} />
    </div>
    {view === '列表' ? <Panel><TaskRows tasks={tasks} showProject={crossProject} /></Panel> : view === '看板' ? <div className="ia-board">{TASK_STATUSES.filter(item => item.key !== 'cancelled' || tasks.some(task => task.status === 'cancelled')).map(item => <section key={item.key} className="ia-board-column"><h2><StatusTag status={item.key} /><span>{tasks.filter(task => task.status === item.key).length}</span></h2>{tasks.filter(task => task.status === item.key).map(task => <button key={task.id} className="ia-board-task" onClick={() => previewTask(task)}><span className="ia-meta">{task.id}</span><strong>{task.title}</strong><span className={isOverdue(task) ? 'ia-danger' : 'ia-muted'}>{task.due || '未设日期'}{task.blocked ? ' · 阻塞' : ''}</span></button>)}<div className="ia-board-empty">{tasks.some(task => task.status === item.key) ? '' : '暂无任务'}</div></section>)}</div> : <Panel title="任务日期"><div className="ia-gantt"><div className="ia-gantt-scale"><span>任务</span><span>10/10</span><span>10/15 · 演示今天</span><span>10/20</span><span>10/25</span></div>{tasks.map(task => { const start = task.start ? Math.max(0, Math.min(85, (Date.parse(task.start) - Date.parse('2026-10-10')) / 86400000 / 20 * 100)) : 0; const width = task.due ? Math.max(5, Math.min(100 - start, (Date.parse(task.due) - Date.parse(task.start)) / 86400000 / 20 * 100)) : 8; return <div key={task.id} className="ia-gantt-row"><button className="ia-text-button" onClick={() => previewTask(task)}>{task.title}</button><div className="ia-gantt-track"><button aria-label={`查看 ${task.title}`} className={`ia-gantt-bar ia-status-${task.status}`} style={{ marginLeft: `${start}%`, width: `${width}%` }} onClick={() => previewTask(task)} /></div></div> })}</div>{!tasks.length ? <BlankState title="没有符合筛选条件的任务" description="调整筛选或新建任务。" /> : null}</Panel>}
    <p className="ia-footnote">三个视图使用同一任务集合；子任务不重复计入项目完成率。日期以 2026-10-15 为演示基准。</p>
  </>
}

export function TaskDetail({ task }: { task: DemoTask }): JSX.Element {
  const { data, setData, route, previousRoute, navigate, back, notify } = usePrototype()
  const tab = route.scope === 'project' ? route.taskTab ?? 'overview' : 'overview'
  const children = data.tasks.filter(item => item.parentId === task.id)
  const project = data.projects.find(item => item.id === task.projectId)
  function changeStatus(status: TaskStatus): void {
    if (status === 'done') {
      const result = acceptDemoTask(data, task.id)
      if (result.error) { notify(result.error); return }
      setData(result.data)
      notify('已人工验收通过，仅更新模拟数据。')
      return
    }
    setData(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, status, events: [...item.events, `人工操作：${TASK_STATUSES.find(value => value.key === status)!.label}（演示）`] } : item) }))
  }
  const originAi = previousRoute?.scope === 'global' && previousRoute.area === 'ai'
  const overview = <div className="ia-two-column"><Panel title="任务内容"><p className="ia-body-copy">{task.description}</p><h3>验收标准</h3><p className="ia-body-copy">{task.acceptance}</p>{task.blocked ? <Alert type="warning" showIcon message="当前阻塞" description={task.blocked} /> : null}</Panel><Panel title="归属与计划"><Descriptions column={1} size="small" items={[{ key: 'project', label: '项目', children: project?.name ?? '未归属收件箱' }, { key: 'owner', label: '负责人', children: task.owner }, { key: 'due', label: '截止日期', children: <span className={isOverdue(task) ? 'ia-danger' : ''}>{task.due || '未设置'}</span> }, { key: 'goal', label: '目标', children: data.plans.find(item => item.id === task.goalId)?.title ?? '未关联' }, { key: 'version', label: '版本计划', children: data.plans.find(item => item.id === task.versionId)?.title ?? '未关联' }]} /></Panel></div>
  return <>
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => originAi ? back() : navigate(task.projectId ? projectRoute(task.projectId, 'tasks') : globalRoute('workbench', 'tasks'))}>{originAi ? '返回原 AI 会话' : '返回任务列表'}</Button>
    <PageHeader eyebrow={`${task.id} · 业务任务`} title={task.title} actions={<Space wrap><StatusTag status={task.status} />{task.status === 'review' ? <Button type="primary" onClick={() => changeStatus('done')}>验收通过</Button> : task.status === 'todo' ? <Button type="primary" onClick={() => changeStatus('doing')}>开始任务</Button> : task.status === 'doing' ? <Button type="primary" onClick={() => changeStatus('review')}>提交验收</Button> : <Button onClick={() => changeStatus('todo')}>重新打开</Button>}{task.status !== 'done' && task.status !== 'cancelled' ? <Button onClick={() => changeStatus('cancelled')}>取消任务</Button> : null}</Space>} />
    {task.projectId ? <Tabs activeKey={tab} onChange={value => navigate({ ...projectRoute(task.projectId, 'tasks', task.id), taskTab: value as TaskTab })} items={[
      { key: 'overview', label: '概况', children: overview },
      { key: 'children', label: `子任务${children.length ? ` · ${children.length}` : ''}`, children: <Panel><TaskRows tasks={children} /></Panel> },
      { key: 'execution', label: 'AI 执行', children: <Panel title="执行记录">{task.sessionId ? <><Alert type="info" showIcon message="执行已结束，业务任务仍需人工验收" description="规划、执行、停止和重试属于执行记录，不直接改变业务完成状态。" /><div className="ia-detail-block"><Tag>演示执行 #1</Tag><p>已产出交付说明；未触发真实模型调用或 Git 操作。</p><Button icon={<RobotOutlined />} onClick={() => navigate({ scope: 'global', area: 'ai', page: 'conversations', projectFilter: task.projectId, entityId: task.sessionId })}>打开关联 AI 会话</Button></div></> : <BlankState title="未关联 AI 执行" description="这是普通项目任务，可以完全由人工完成。" />}</Panel> },
      { key: 'history', label: '历史', children: <Panel title="任务活动"><Timeline items={task.events.map((event, index) => ({ key: index, children: event }))} /></Panel> }
    ]} /> : overview}
  </>
}

export function PlanPage(): JSX.Element {
  const { data, route, navigate, create } = usePrototype()
  if (route.scope !== 'project') return <></>
  const kind = route.page === 'goals' ? 'goal' : route.page === 'milestones' ? 'milestone' : 'version'
  const label = kind === 'goal' ? '目标' : kind === 'milestone' ? '里程碑' : '版本计划'
  const plans = data.plans.filter(item => item.projectId === route.projectId && item.kind === kind)
  const selected = plans.find(item => item.id === route.entityId)
  const page = route.page
  function planSummary(plan: DemoPlan): JSX.Element {
    const stats = summarizeTasks(tasksForPlan(data.tasks, plan))
    return <div className="ia-plan-row"><div><button className="ia-text-button" onClick={() => navigate(projectRoute(plan.projectId, page, plan.id))}>{plan.title}</button><p className="ia-muted">{plan.description}</p></div><SummaryProgress {...stats} /><span className="ia-muted">{plan.due || '未设日期'}</span><Button onClick={() => navigate(projectRoute(plan.projectId, page, plan.id))}>查看</Button></div>
  }
  return <>
    {selected ? <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(projectRoute(route.projectId, route.page))}>返回{label}</Button> : null}
    <PageHeader eyebrow="项目进度" title={selected?.title ?? label} description={selected?.description ?? (kind === 'goal' ? '先明确希望达成什么，再用业务任务跟踪交付。' : kind === 'milestone' ? '核对关键节点与截止日期，不另建一套任务。' : '安排交付范围；版本计划、Git 标签与线上发布各自独立。')} actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => create(selected ? 'task' : kind)}>{selected ? '新建关联任务' : `新建${label}`}</Button>} />
    {selected ? <><Panel title="完成情况"><Progress percent={summarizeTasks(tasksForPlan(data.tasks, selected)).percent} /><p className="ia-muted">关联任务统一统计，一级子任务不重复计数。</p></Panel><Panel title="关联任务"><TaskRows tasks={tasksForPlan(data.tasks, selected).filter(task => !task.parentId)} /></Panel></> : <Panel>{plans.length ? plans.map(plan => <div key={plan.id}>{planSummary(plan)}</div>) : <BlankState title={`还没有${label}`} description="从一条清晰的计划开始，稍后可以关联任务。" action={`新建${label}`} onAction={() => create(kind)} />}</Panel>}
  </>
}
