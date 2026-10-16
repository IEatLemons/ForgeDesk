import type { ReactNode } from 'react'
import { Button, Empty, Progress, Tag } from 'antd'
import { ArrowRightOutlined, FolderOutlined } from '@ant-design/icons'
import { usePrototype } from './context'
import { isOverdue, TASK_STATUSES, type DemoTask, type TaskStatus } from './data'
import { projectRoute } from './navigation'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }): JSX.Element {
  return <header className="ia-page-header"><div>{eyebrow ? <div className="ia-eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions ? <div className="ia-page-actions">{actions}</div> : null}</header>
}

export function Panel({ title, extra, children, className = '' }: { title?: string; extra?: ReactNode; children: ReactNode; className?: string }): JSX.Element {
  return <section className={`ia-panel ${className}`}>{title ? <header className="ia-panel-header"><h2>{title}</h2>{extra}</header> : null}<div className="ia-panel-body">{children}</div></section>
}

export function BlankState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }): JSX.Element {
  return <div className="ia-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><h3>{title}</h3><p>{description}</p></>}>{action ? <Button type="primary" onClick={onAction}>{action}</Button> : null}</Empty></div>
}

export function StatusTag({ status }: { status: TaskStatus }): JSX.Element {
  const meta = TASK_STATUSES.find(item => item.key === status)!
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function TaskRows({ tasks, showProject = false }: { tasks: DemoTask[]; showProject?: boolean }): JSX.Element {
  const { data, previewTask } = usePrototype()
  if (!tasks.length) return <BlankState title="这里还没有任务" description="可以新建任务，或调整筛选条件。" />
  return <div className="ia-task-list">{tasks.map(task => <div key={task.id} className="ia-task-row">
    <span className={`ia-status-dot ia-status-${task.status}`} />
    <div className="ia-task-title"><button className="ia-text-button" onClick={() => previewTask(task)}>{task.title}</button><div className="ia-meta">{task.id}{showProject ? ` · ${data.projects.find(project => project.id === task.projectId)?.name ?? '收件箱'}` : ''}{task.blocked ? <Tag color="red">阻塞</Tag> : null}{isOverdue(task) ? <Tag color="orange">延期</Tag> : null}</div></div>
    <StatusTag status={task.status} /><span className="ia-task-owner">{task.owner}</span><span className={isOverdue(task) ? 'ia-danger' : 'ia-muted'}>{task.due || '未设日期'}</span>
  </div>)}</div>
}

export function SummaryProgress({ done, total, percent }: { done: number; total: number; percent: number }): JSX.Element {
  return <div className="ia-summary-progress"><Progress percent={percent} size="small" showInfo={false} /><span>{done} / {total} 已完成</span></div>
}

export function ProjectLink({ projectId }: { projectId?: string }): JSX.Element {
  const { data, openProject } = usePrototype()
  const project = data.projects.find(item => item.id === projectId)
  return project ? <Button type="link" size="small" icon={<FolderOutlined />} onClick={() => openProject(project.id)}>{project.name}</Button> : <span className="ia-muted">未关联项目</span>
}

export function OpenTaskButton({ task }: { task: DemoTask }): JSX.Element {
  const { navigate } = usePrototype()
  return <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(task.projectId ? projectRoute(task.projectId, 'tasks', task.id) : { scope: 'global', area: 'workbench', page: 'tasks', entityId: task.id })}>打开完整详情</Button>
}
