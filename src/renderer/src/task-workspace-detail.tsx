import { useEffect, useState } from 'react'
import { Button, Checkbox, Drawer, Dropdown, Empty, Input, List, Modal, Select, Space, Spin, Tabs, Tag, Tooltip, message } from 'antd'
import { CheckOutlined, CopyOutlined, DeleteOutlined, ExpandOutlined, MoreOutlined, PaperClipOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons'
import type { TaskEvent, TaskWorkspaceSnapshot, WorkspaceTask } from '../../shared/task-workspace'
import { taskOverdue } from '../../shared/task-workspace'
import { sendTaskCommand } from './use-task-workspace'
import { TaskAttachmentImage, TaskDateControl, TaskFieldEditor, TaskPersonBadge, TaskRichText, priorityLabels, taskSave } from './task-workspace-controls'

export async function toggleWorkspaceTask(task: WorkspaceTask, snapshot: TaskWorkspaceSnapshot) {
  const children = snapshot.tasks.filter(item => item.parentId === task.id && !item.done)
  if (!task.done && children.length) Modal.confirm({ zIndex: 1400, title: `还有 ${children.length} 个子任务未完成`, content: '只将父任务标记为完成，子任务保持当前状态。', okText: '完成父任务', cancelText: '返回', onOk: () => taskSave(task, { done: true }).then(() => undefined) })
  else await taskSave(task, { done: !task.done })
}
function eventChanges(event: TaskEvent, snapshot?: TaskWorkspaceSnapshot): string[] {
  if (!event.before || !event.after) return []
  const before = event.before as Record<string, unknown>, after = event.after as Record<string, unknown>
  const labels: Record<string, string> = { title: '名称', name: '姓名', ownerId: '负责人', creatorId: '创建人', assignerId: '分配人', priority: '优先级', startDate: '开始时间', dueDate: '截止时间', parentId: '父任务', dependencyIds: '前置任务', personalGroupId: '个人分组', starred: '关注', milestone: '里程碑标记', archived: '归档', pinned: '置顶', reminderMinutes: '提前提醒（分钟）', recurrence: '重复规则', theme: '主题', color: '颜色', avatar: '头像', folderId: '清单分组' }
  const ignored = new Set(['id', 'rowVersion', 'createdAt', 'updatedAt', 'completedAt', 'reminderSentFor', 'seriesId', 'previousId'])
  const format = (value: unknown): string => {
    if (value == null || value === '') return '未设置'
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (Array.isArray(value)) return value.map(format).join('、') || '无'
    if (typeof value === 'object') return '已更新'
    return snapshot?.people.find(person => person.id === value)?.name ?? snapshot?.tasks.find(task => task.id === value)?.title ?? snapshot?.groups.find(group => group.id === value)?.title ?? snapshot?.folders.find(folder => folder.id === value)?.title ?? String(value).slice(0, 120)
  }
  return Object.keys(after).filter(key => !ignored.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => {
    if (key === 'done') return after.done ? '标记为已完成' : '重新打开任务'
    if (key === 'description') return '更新了任务描述'
    if (key === 'links') return `所属清单：${(after.links as WorkspaceTask['links']).map(link => snapshot?.lists.find(list => list.id === link.listId)?.title ?? '清单').join('、') || '无'}`
    if (key === 'projectIds') {
      const names = (after.projectIds as string[]).map(id => snapshot?.projects.find(project => project.id === id)?.name ?? '已删除项目')
      return `关联项目：${names.join('、') || '无'}`
    }
    if (key === 'values') return '更新了自定义字段内容'
    if (key === 'order') return '调整了排列顺序'
    if (key === 'options') return '更新了字段选项'
    if (key === 'fieldIds' || key === 'visibleFields') return '更新了字段配置'
    if (key === 'widgets') return '更新了仪表盘组件'
    if (key === 'filters') return '更新了筛选条件'
    if (key === 'sorts') return '更新了排序方式'
    if (key === 'priority') return `优先级：${priorityLabels[after.priority as WorkspaceTask['priority']]}`
    return labels[key] ? `${labels[key]}：${format(after[key])}` : '更新了设置'
  })
}
export function TaskWorkspaceHistory({ entityId, listId, revision, snapshot }: { entityId?: string; listId?: string; revision?: string; snapshot?: TaskWorkspaceSnapshot }) {
  const [events, setEvents] = useState<TaskEvent[]>([]), [loading, setLoading] = useState(true), [more, setMore] = useState(false), [error, setError] = useState('')
  useEffect(() => { let disposed = false; setLoading(true); void window.forgeDesk.getTaskHistory({ entityId, listId, limit: 50 }).then(values => { if (!disposed) { setEvents(values); setMore(values.length === 50); setError('') } }).catch(error => { if (!disposed) setError(String(error)) }).finally(() => { if (!disposed) setLoading(false) }); return () => { disposed = true } }, [entityId, listId, revision])
  async function loadMore() { const last = events.at(-1); if (!last) return; const values = await window.forgeDesk.getTaskHistory({ entityId, listId, limit: 50, before: `${last.createdAt}/${last.id}` }); setEvents(old => [...old, ...values]); setMore(values.length === 50) }
  return <div className="tw-history">{loading ? <Spin /> : error ? <div role="alert">{error}</div> : !events.length ? <Empty description="暂无操作记录" /> : events.map(event => <article key={event.id}><time>{new Date(event.createdAt).toLocaleString('zh-CN')}</time><div className="tw-history-dot" /><div><span className="tw-muted">{event.title}</span><p>我 {event.action}</p>{event.before && event.after ? <ul className="tw-history-changes">{eventChanges(event, snapshot).map((change, index) => <li key={index}>{change}</li>)}</ul> : null}</div></article>)}{more ? <Button onClick={() => void loadMore().catch(error => message.error(String(error)))}>加载更多</Button> : null}</div>
}

export function TaskWorkspaceDetail({ task, snapshot, onClose, onSelect, onOpenProject }: { task: WorkspaceTask | null; snapshot: TaskWorkspaceSnapshot; onClose: () => void; onSelect: (id: string) => void; onOpenProject?: (projectId: string) => void }) {
  const [full, setFull] = useState(false), [tab, setTab] = useState('detail'), [relation, setRelation] = useState<'parent' | 'before' | 'after' | null>(null)
  const [relatedId, setRelatedId] = useState<string>(), [childTitle, setChildTitle] = useState('')
  const [projectEdit, setProjectEdit] = useState<{ task: WorkspaceTask; projectIds: string[] } | null>(null)
  const [savingProjects, setSavingProjects] = useState(false)
  useEffect(() => { setTab('detail'); setChildTitle(''); setRelation(null); setProjectEdit(null) }, [task?.id])
  async function saveProjects() {
    if (!projectEdit || savingProjects) return
    setSavingProjects(true)
    try {
      if (await taskSave(projectEdit.task, { projectIds: projectEdit.projectIds })) setProjectEdit(null)
    } finally {
      setSavingProjects(false)
    }
  }
  async function relate() {
    if (!task || !relation) return
    if (relation === 'parent') await taskSave(task, { parentId: relatedId ?? null })
    else if (relatedId) {
      if (relation === 'before') await taskSave(task, { dependencyIds: [...new Set([...task.dependencyIds, relatedId])] })
      else { const successor = snapshot.tasks.find(item => item.id === relatedId)!; await taskSave(successor, { dependencyIds: [...new Set([...successor.dependencyIds, task.id])] }) }
    }
    setRelation(null)
  }
  async function createChild() {
    if (!task || !childTitle.trim()) return
    const id = await sendTaskCommand({ type: 'save-task', input: { title: childTitle, parentId: task.id, links: task.links, projectIds: task.projectIds, ownerId: task.ownerId } })
    if (id) setChildTitle('')
  }
  const groups = snapshot.groups.filter(group => group.scope === 'personal')
  return <><Drawer className="tw-detail" width={full ? 'min(1100px, 95vw)' : 640} open={!!task} onClose={onClose} title={task ? <Space><Button type={task.done ? 'primary' : 'default'} className="tw-complete-button" icon={<CheckOutlined />} onClick={() => void toggleWorkspaceTask(task, snapshot)}>{task.done ? '已完成 · 重新打开' : '完成任务'}</Button>{task.milestone ? <Tag color="red">◆ 里程碑</Tag> : null}</Space> : ''} extra={task ? <Space size={2}><Tooltip title={task.starred ? '取消关注' : '关注任务'}><Button type="text" aria-label="关注任务" icon={task.starred ? <StarFilled style={{ color: '#245bff' }} /> : <StarOutlined />} onClick={() => void taskSave(task, { starred: !task.starred })} /></Tooltip><Button type="text" aria-label="复制任务" icon={<CopyOutlined />} onClick={() => void sendTaskCommand({ type: 'copy-task', id: task.id, expectedVersion: task.rowVersion }).then(id => { if (id) onSelect(id) })} /><Button type="text" aria-label="展开任务详情" icon={<ExpandOutlined />} onClick={() => setFull(value => !value)} /><Dropdown trigger={['click']} menu={{ items: [{ key: 'parent', label: '设置父任务' }, { key: 'milestone', label: task.milestone ? '取消里程碑标记' : '设为里程碑' }, { key: 'before', label: '添加前置任务' }, { key: 'after', label: '添加后置任务' }, { type: 'divider' }, { key: 'history', label: '查看历史记录' }, { key: 'delete', label: '删除', danger: true }], onClick: ({ key }) => {
      if (key === 'milestone') void taskSave(task, { milestone: !task.milestone })
      else if (key === 'history') setTab('history')
      else if (key === 'delete') Modal.confirm({ zIndex: 1400, title: '删除任务？', content: '子任务将成为独立任务，相关依赖会解除。', onOk: async () => { if (await sendTaskCommand({ type: 'delete', kind: 'task', id: task.id, expectedVersion: task.rowVersion })) onClose() } })
      else { setRelatedId(key === 'parent' ? task.parentId ?? undefined : undefined); setRelation(key as 'parent' | 'before' | 'after') }
    } }}><Button type="text" aria-label="任务更多操作" icon={<MoreOutlined />} /></Dropdown></Space> : null}>
    {task ? <><Tabs activeKey={tab} onChange={setTab} items={[{ key: 'detail', label: '任务详情' }, { key: 'history', label: '历史记录' }]} />{tab === 'history' ? <TaskWorkspaceHistory snapshot={snapshot} entityId={task.id} revision={task.updatedAt} /> : <div className="tw-detail-content" key={task.id}>
      <Input.TextArea className={`tw-detail-title ${task.done ? 'is-done' : ''}`} aria-label="任务标题" variant="borderless" autoSize defaultValue={task.title} key={task.title} onBlur={event => { if (event.target.value.trim() && event.target.value !== task.title) void taskSave(task, { title: event.target.value }) }} />
      {task.parentId ? <button className="tw-plain tw-parent-link" onClick={() => onSelect(task.parentId!)}>↳ 父任务：{snapshot.tasks.find(item => item.id === task.parentId)?.title}</button> : null}
      <div className="tw-detail-line"><span className="tw-label">负责人</span><Select aria-label="任务负责人" allowClear value={task.ownerId} onChange={ownerId => void taskSave(task, { ownerId: ownerId ?? null })} options={snapshot.people.map(person => ({ value: person.id, label: <TaskPersonBadge id={person.id} snapshot={snapshot} /> }))} style={{ minWidth: 160 }} /><Select aria-label="个人任务分组" allowClear placeholder="个人分组：未分组" value={task.personalGroupId} onChange={id => void taskSave(task, { personalGroupId: id ?? null })} options={groups.map(group => ({ value: group.id, label: group.title }))} popupRender={menu => <>{menu}<Button type="text" block onClick={() => { let title = ''; Modal.confirm({ zIndex: 1400, title: '新建个人任务分组', content: <Input onChange={event => { title = event.target.value }} />, onOk: async () => { const id = await sendTaskCommand({ type: 'save-group', input: { title, scope: 'personal' } }); if (id) await taskSave(task, { personalGroupId: id }) } }) }}>＋ 新建分组</Button></>} /></div>
      <div className={`tw-detail-line ${taskOverdue(task) ? 'is-overdue' : ''}`}><TaskDateControl task={task} onChange={patch => void taskSave(task, patch)} /></div>
      <div className="tw-detail-lists"><span className="tw-label">所属清单</span>{task.links.map(link => { const list = snapshot.lists.find(list => list.id === link.listId); return <div className="tw-detail-line" key={link.listId}><Tag>{list?.title}{list?.archived ? ' · 已归档' : ''}</Tag><Select aria-label={`${list?.title}的分组`} value={link.groupId} allowClear placeholder="未分组" options={snapshot.groups.filter(group => group.scope === link.listId).map(group => ({ value: group.id, label: group.title }))} onChange={groupId => void taskSave(task, { links: task.links.map(item => item.listId === link.listId ? { ...item, groupId: groupId ?? null } : item) })} style={{ minWidth: 130 }} /><Button type="text" aria-label={`移出${list?.title}`} onClick={() => void taskSave(task, { links: task.links.filter(item => item.listId !== link.listId) })}>×</Button></div> })}<Select<string> aria-label="添加至任务清单" placeholder="＋ 添加至任务清单" value={undefined} options={snapshot.lists.filter(list => !list.archived && !task.links.some(link => link.listId === list.id)).map(list => ({ value: list.id, label: list.title }))} onChange={listId => void taskSave(task, { links: [...task.links, { listId, groupId: null, order: snapshot.tasks.length }] })} style={{ minWidth: 200 }} /></div>
      <div className="tw-detail-line">
        <span className="tw-label">关联项目</span>
        <Space size={[8, 4]} wrap>
          {task.projectIds.map(id => {
            const project = snapshot.projects.find(item => item.id === id)
            if (!project) return null
            const label = project.archivedAt ? `${project.name}（已归档）` : project.name
            return onOpenProject
              ? <Button key={id} type="link" size="small" onClick={() => onOpenProject(id)}>{label}</Button>
              : <Tag key={id}>{label}</Tag>
          })}
          <Button size="small" icon={<PlusOutlined />} onClick={() => setProjectEdit({ task, projectIds: task.projectIds })}>
            {task.projectIds.length ? '编辑关联项目' : '关联项目'}
          </Button>
        </Space>
      </div>
      <div className="tw-detail-line"><span className="tw-label">优先级</span><Select value={task.priority} aria-label="任务优先级" options={Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))} onChange={priority => void taskSave(task, { priority })} style={{ width: 120 }} /></div>
      {snapshot.fields.filter(field => task.links.some(link => snapshot.lists.find(list => list.id === link.listId)?.fieldIds.includes(field.id)) || task.values[field.id] != null).map(field => <div className="tw-detail-line" key={field.id}><span className="tw-label">{field.title}</span><TaskFieldEditor field={field} value={task.values[field.id] ?? null} snapshot={snapshot} onChange={value => void taskSave(task, { values: { ...task.values, [field.id]: value } })} /></div>)}
      <TaskRichText value={task.description} onChange={description => void taskSave(task, { description })} />
      <div className="tw-subtasks"><h4>子任务 <span className="tw-muted">{snapshot.tasks.filter(item => item.parentId === task.id && item.done).length} / {snapshot.tasks.filter(item => item.parentId === task.id).length}</span></h4>{snapshot.tasks.filter(item => item.parentId === task.id).map(child => <div className="tw-detail-line" key={child.id}><Checkbox checked={child.done} onChange={() => void toggleWorkspaceTask(child, snapshot)} /><button className={`tw-plain ${child.done ? 'is-done' : ''}`} onClick={() => onSelect(child.id)}>{child.title}</button><Button type="text" size="small" onClick={() => void taskSave(child, { parentId: null })}>解除父子关系</Button></div>)}<Input prefix={<PlusOutlined />} placeholder="添加子任务，回车确认" value={childTitle} onChange={event => setChildTitle(event.target.value)} onPressEnter={() => void createChild()} /></div>
      {(['before', 'after'] as const).map(kind => { const linked = kind === 'before' ? snapshot.tasks.filter(item => task.dependencyIds.includes(item.id)) : snapshot.tasks.filter(item => item.dependencyIds.includes(task.id)); return <div key={kind}><h4>{kind === 'before' ? '前置任务' : '后置任务'}</h4>{linked.map(item => <div className="tw-detail-line" key={item.id}><span>{item.done ? '✓' : '○'}</span><button className="tw-plain" onClick={() => onSelect(item.id)}>{item.title}</button><Button type="text" size="small" onClick={() => void (kind === 'before' ? taskSave(task, { dependencyIds: task.dependencyIds.filter(id => id !== item.id) }) : taskSave(item, { dependencyIds: item.dependencyIds.filter(id => id !== task.id) }))}>解除</Button></div>)}<Button type="text" onClick={() => { setRelatedId(undefined); setRelation(kind) }}>＋ 添加{kind === 'before' ? '前置' : '后置'}任务</Button></div> })}
      <div className="tw-attachments"><h4>附件</h4>{snapshot.attachments.filter(file => file.taskId === task.id).map(file => <div className="tw-detail-line" key={file.id}>{file.mime.startsWith('image/') ? <TaskAttachmentImage id={file.id} alt={file.name} /> : <PaperClipOutlined />}<button className="tw-plain" onClick={() => void window.forgeDesk.openTaskAttachment(file.id).catch(error => message.error(String(error)))}>{file.name}</button><small className="tw-muted">{(file.size / 1024).toFixed(1)} KB</small><Button aria-label={`删除附件${file.name}`} type="text" icon={<DeleteOutlined />} onClick={() => void sendTaskCommand({ type: 'delete', kind: 'attachment', id: file.id, expectedVersion: file.rowVersion })} /></div>)}<Button type="text" icon={<PaperClipOutlined />} onClick={() => void window.forgeDesk.addTaskAttachments(task.id).catch(error => message.error(String(error)))}>添加附件</Button></div>
      <div className="tw-detail-meta">创建人：{snapshot.people.find(person => person.id === task.creatorId)?.name} · {new Date(task.createdAt).toLocaleString('zh-CN')}<br />任务 ID：{task.id}</div>
    </div>}</> : null}
  </Drawer>
  <Modal centered zIndex={1200} title="关联项目" open={!!projectEdit} onCancel={() => setProjectEdit(null)}
    onOk={() => void saveProjects()} confirmLoading={savingProjects} okText="保存">
    <Select mode="multiple" placement="topLeft" listHeight={176} aria-label="选择关联项目" placeholder="搜索或选择项目"
      style={{ width: '100%' }} optionFilterProp="label" value={projectEdit?.projectIds ?? []}
      onChange={projectIds => setProjectEdit(current => current ? { ...current, projectIds } : null)}
      options={snapshot.projects.map(project => ({
        value: project.id,
        label: project.archivedAt ? `${project.name}（已归档）` : project.name
      }))} />
  </Modal>
  <Modal zIndex={1200} title={relation === 'parent' ? '设置父任务' : relation === 'before' ? '添加前置任务' : '添加后置任务'} open={!!relation} onCancel={() => setRelation(null)} onOk={() => void relate()}><Select showSearch allowClear optionFilterProp="label" placeholder="搜索任务" value={relatedId} onChange={setRelatedId} style={{ width: '100%' }} options={snapshot.tasks.filter(item => item.id !== task?.id).map(item => ({ value: item.id, label: item.title }))} /></Modal></>
}
