import { useId, useState } from 'react'
import { Button, Dropdown, Empty, Input, Modal, Select, Space, Spin } from 'antd'
import { BookOutlined, CheckSquareOutlined, ClockCircleOutlined, DownOutlined, FolderOutlined, MoreOutlined, PlusOutlined, PushpinFilled, StarOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import type { TaskFolder, TaskList } from '../../shared/task-workspace'
import { useTaskWorkspace } from './use-task-workspace'

export const taskScopeLabels: Record<string, string> = { mine: '我负责的', starred: '我关注的', activity: '动态', all: '全部任务', created: '我创建的', assigned: '我分配的', done: '已完成', lists: '任务清单', archived: '已归档清单', people: '本地人员' }
export function TaskWorkspaceNavigation({ scope = 'mine', onChange, embedded = false }: { scope?: string; onChange: (scope: string) => void; embedded?: boolean }) {
  const { snapshot, loading, send } = useTaskWorkspace()
  const quickAccessId = useId()
  const [quickAccessExpanded, setQuickAccessExpanded] = useState(true)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [edit, setEdit] = useState<{ kind: 'list' | 'folder'; record?: TaskList | TaskFolder; folderId?: string | null } | null>(null), [title, setTitle] = useState(''), [template, setTemplate] = useState('')
  const [drag, setDrag] = useState<{ kind: 'list' | 'folder'; id: string } | null>(null)
  function open(kind: 'list' | 'folder', record?: TaskList | TaskFolder, folderId?: string | null) { setEdit({ kind, record, folderId }); setTitle(record?.title ?? ''); setTemplate('') }
  async function save() {
    if (!edit || !title.trim()) return
    const id = template && edit.kind === 'list' && !edit.record ? await send({ type: 'apply-template', templateId: template, title, folderId: edit.folderId }) : edit.kind === 'list' ? await send({ type: 'save-list', input: { id: edit.record?.id, title, ...(!edit.record ? { folderId: edit.folderId ?? null } : {}) }, expectedVersion: edit.record?.rowVersion }) : await send({ type: 'save-folder', input: { id: edit.record?.id, title }, expectedVersion: edit.record?.rowVersion })
    if (id) { setEdit(null); if (edit.kind === 'list') onChange(id) }
  }
  const activeLists = snapshot?.lists.filter(list => !list.archived) ?? []
  const folders = [...(snapshot?.folders ?? [])].sort((a, b) => a.order - b.order)
  const nav = (id: string, icon?: React.ReactNode, count?: number) => <button className={`tw-nav-item ${scope === id ? 'is-active' : ''}`} onClick={() => onChange(id)} key={id}>{icon}<span>{taskScopeLabels[id]}</span>{count != null ? <small>{count}</small> : null}</button>
  function dropList(listId: string, folderId: string | null, before?: TaskList) {
    const record = snapshot?.lists.find(list => list.id === listId)
    if (!record) return
    const same = activeLists.filter(list => list.folderId === folderId && list.id !== listId).sort((a, b) => a.order - b.order)
    const index = before ? same.findIndex(list => list.id === before.id) : same.length
    const next = same[index]?.order ?? (same.at(-1)?.order ?? 0) + 2, previous = same[index - 1]?.order ?? next - 2
    void send({ type: 'save-list', input: { id: listId, folderId, order: (previous + next) / 2 }, expectedVersion: record.rowVersion })
    setDrag(null)
  }
  const listNode = (list: TaskList) => <div className="tw-nav-list" key={list.id} draggable onDragStart={event => { event.stopPropagation(); setDrag({ kind: 'list', id: list.id }) }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); if (drag?.kind === 'list') dropList(drag.id, list.folderId, list) }}>
    <button className={`tw-nav-item ${scope === list.id ? 'is-active' : ''}`} onClick={() => onChange(list.id)}><CheckSquareOutlined /><span>{list.title}</span>{list.pinned ? <PushpinFilled className="tw-pin" /> : null}</button>
    <Dropdown menu={{ items: [{ key: 'pin', label: list.pinned ? '取消置顶' : '置顶' }, { key: 'rename', label: '重命名' }, { key: 'template', label: '保存为模板' }, { key: 'archive', label: list.archived ? '恢复清单' : '归档' }, { key: 'delete', label: '删除', danger: true }], onClick: ({ key }) => {
      if (key === 'rename') open('list', list)
      else if (key === 'template') void send({ type: 'save-template', listId: list.id, title: list.title })
      else if (key === 'delete') Modal.confirm({ zIndex: 1400, title: `删除清单“${list.title}”？`, content: '任务本身保留，只移除此清单及其分组。', onOk: async () => { if (await send({ type: 'delete', kind: 'list', id: list.id, expectedVersion: list.rowVersion })) onChange('lists') } })
      else void send({ type: 'save-list', input: { id: list.id, ...(key === 'pin' ? { pinned: !list.pinned } : { archived: !list.archived }) }, expectedVersion: list.rowVersion })
    } }} trigger={['click']}><Button type="text" size="small" aria-label={`${list.title}的更多操作`} icon={<MoreOutlined />} /></Dropdown>
  </div>
  return <div className={embedded ? "tw-navigation tw-navigation-embedded" : "tw-navigation"}>
    {!embedded ? <div className="tw-nav-heading"><CheckSquareOutlined /><strong>任务</strong><Dropdown menu={{ items: [{ key: 'archived', label: '已归档清单' }, { key: 'people', label: '管理本地人员' }], onClick: ({ key }) => onChange(key) }}><Button type="text" aria-label="任务设置" icon={<MoreOutlined />} /></Dropdown></div> : null}
    {nav('mine', <UserOutlined />, snapshot?.tasks.filter(task => task.ownerId === snapshot.selfId && !task.done).length)}
    {nav('starred', <StarOutlined />)}{nav('activity', <ClockCircleOutlined />)}
    <div className="tw-nav-section">
      <div className="tw-nav-section-title">
        <button className="tw-plain tw-nav-section-toggle" type="button" aria-controls={quickAccessId}
          aria-expanded={quickAccessExpanded} onClick={() => setQuickAccessExpanded(expanded => !expanded)}>
          <DownOutlined aria-hidden="true" rotate={quickAccessExpanded ? 0 : -90} />
          快速访问
        </button>
      </div>
      <div id={quickAccessId} hidden={!quickAccessExpanded}>
        {['all', 'created', 'assigned', 'done'].map(id => nav(id))}
      </div>
    </div>
    <div className="tw-nav-section"><div className="tw-nav-section-title"><button className="tw-plain" onClick={() => onChange('lists')}><CheckSquareOutlined /> 任务清单</button><Dropdown trigger={['click']} menu={{ items: [{ key: 'list', label: '＋ 空白清单' }, { key: 'template', label: '使用模板' }, { key: 'folder', label: '清单分组' }], onClick: ({ key }) => { open(key === 'folder' ? 'folder' : 'list'); if (key === 'template') setTemplate('builtin-week') } }}><Button type="text" size="small" aria-label="新建任务清单" icon={<PlusOutlined />} /></Dropdown></div>
      {loading && !snapshot ? <Spin size="small" /> : null}
      {activeLists.filter(list => list.pinned).sort((a, b) => a.order - b.order).map(listNode)}
      {folders.map(folder => <div className="tw-folder" key={folder.id} draggable onDragStart={() => setDrag({ kind: 'folder', id: folder.id })} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (drag?.kind === 'list') dropList(drag.id, folder.id); else if (drag?.kind === 'folder') { const moved = folders.find(item => item.id === drag.id)!; void send({ type: 'save-folder', input: { id: moved.id, order: folder.order - 0.5 }, expectedVersion: moved.rowVersion }); setDrag(null) } }}>
        <div className="tw-folder-heading"><button className="tw-plain" onClick={() => setCollapsed(values => values.includes(folder.id) ? values.filter(id => id !== folder.id) : [...values, folder.id])}><DownOutlined rotate={collapsed.includes(folder.id) ? -90 : 0} /> {folder.title}</button><Dropdown menu={{ items: [{ key: 'add', label: '新建清单' }, { key: 'rename', label: '重命名分组' }, { key: 'delete', label: '删除分组', danger: true }], onClick: ({ key }) => key === 'add' ? open('list', undefined, folder.id) : key === 'rename' ? open('folder', folder) : void send({ type: 'delete', kind: 'folder', id: folder.id, expectedVersion: folder.rowVersion }) }}><Button type="text" size="small" aria-label={`${folder.title}的更多操作`} icon={<MoreOutlined />} /></Dropdown></div>
        {!collapsed.includes(folder.id) ? activeLists.filter(list => list.folderId === folder.id && !list.pinned).sort((a, b) => a.order - b.order).map(listNode) : null}
      </div>)}
      <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (drag?.kind === 'list') dropList(drag.id, null) }}>{activeLists.filter(list => !list.folderId && !list.pinned).sort((a, b) => a.order - b.order).map(listNode)}<button className="tw-nav-item tw-muted" onClick={() => open('list')}><PlusOutlined /> 新建清单</button></div>
      <button className="tw-nav-item tw-muted" onClick={() => open('folder')}><PlusOutlined /> 新建分组</button>
    </div><div className="tw-nav-bottom">{nav('people', <TeamOutlined />)}{nav('archived', <BookOutlined />)}</div>
    <Modal zIndex={1200} title={edit?.record ? '重命名' : edit?.kind === 'folder' ? '新建清单分组' : '新建任务清单'} open={!!edit} onCancel={() => setEdit(null)} onOk={() => void save()} okButtonProps={{ disabled: !title.trim() }}><Space direction="vertical" style={{ width: '100%', paddingBlock: 16 }}><Input autoFocus aria-label="名称" placeholder="输入名称" value={title} onChange={event => setTitle(event.target.value)} onPressEnter={() => void save()} />{edit?.kind === 'list' && !edit.record ? <Select aria-label="清单模板" value={template} onChange={setTemplate} style={{ width: '100%' }} options={[{ value: '', label: '空白清单' }, { value: 'builtin-week', label: '每周计划' }, { value: 'builtin-project', label: '项目执行清单' }, ...(snapshot?.templates ?? []).map(item => ({ value: item.id, label: item.title }))]} /> : null}</Space></Modal>
  </div>
}
