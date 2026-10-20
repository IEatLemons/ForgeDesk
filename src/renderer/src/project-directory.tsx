import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Dropdown, Empty, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BranchesOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, ExportOutlined, FileTextOutlined, FolderOpenOutlined, MoreOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, StarFilled, StarOutlined, UploadOutlined } from '@ant-design/icons'
import type { Project, ProjectGroup, Repository } from './data'
import type { AppMode } from './app-mode'
import { useForgeDeskStore } from './store'
import { createProjectListGroupFilterOptions, filterProjectsByGroup, sortProjectsByGroupForDisplay, type ProjectListGroupFilter } from './project-list-view'
import { buildProjectDirectoryRows, DirectoryRefreshQueue, type DirectoryAction, type ProjectDirectoryRow, type RepositoryCheck } from './project-directory-model'
import { mergeRepositoryWorkspaceStatus } from './git-action-state'

type CheckedRepository = { started: Repository; next: Repository }
type Queue = DirectoryRefreshQueue<CheckedRepository>
type Props = {
  visible: boolean; archived: boolean; mode: AppMode
  onCreate: () => void; onOpen: (id: string) => void; onArchiveList: () => void; onLogs: () => void
  onAction: (action: DirectoryAction, ids: string[]) => void
}

const DirectoryGitStatus = memo(function DirectoryGitStatus({ row, queue, simple }: { row: ProjectDirectoryRow; queue: Queue; simple: boolean }) {
  const readChecks = useMemo(() => {
    let previous: (RepositoryCheck | undefined)[] = []
    return () => {
      const checks = queue.getSnapshot()
      const next = row.repositories.map(repository => checks[repository.id])
      if (next.length !== previous.length || next.some((check, index) => check !== previous[index])) previous = next
      return previous
    }
  }, [row.repositories, queue])
  const states = useSyncExternalStore(queue.subscribe, readChecks)
  const checking = states.some(check => check?.state === 'checking')
  const failed = states.some(check => check?.state === 'error') || row.stats.unavailable > 0
  const checked = states.length > 0 && states.every(check => check?.checkedAt)
  const oldest = checked ? Math.min(...states.map(check => check!.checkedAt!)) : undefined
  const stamp = oldest ? new Date(oldest).toLocaleTimeString() : ''
  const label = checking ? '检查中' : failed ? '检查失败' : checked ? '缓存' : '尚未检查'
  return <Space direction="vertical" size={4}>
    <Space size={6} wrap>
      <Tag>{simple ? `${row.repositories.length} 个仓库` : `${row.stats.roots} 主仓库 / ${row.stats.subprojects} 子项目 / ${row.stats.submodules} 子模块`}</Tag>
      {checked && !failed ? <>
        <Tag color={row.changed ? 'orange' : 'green'}>{row.changed ? `${row.changed} 有改动` : '工作区干净'}</Tag>
        <Tag color={row.ahead ? 'blue' : undefined}>{row.ahead} 未推送</Tag>
        {!simple ? <Tag color={row.pushable ? 'purple' : undefined}>{row.pushable} 可推送</Tag> : null}
      </> : row.repositories.length ? <Typography.Text type="secondary">缓存：{row.changed} 有改动 · {row.ahead} 未推送</Typography.Text> : null}
    </Space>
    <Tooltip title={states.find(check => check?.error)?.error || (checked ? '本地 Git 检查时间；不代表远端已 Fetch' : '扫描缓存尚未经过本次本地检查')}>
      <Typography.Text type="secondary" className="project-directory-check-time">{row.repositories.length ? `${label}${stamp ? ` · ${stamp}` : ''}` : '尚未配置仓库'}</Typography.Text>
    </Tooltip>
  </Space>
})

export const ProjectDirectory = memo(function ProjectDirectory(props: Props): JSX.Element {
  const projects = useForgeDeskStore(state => state.projects)
  const repositories = useForgeDeskStore(state => state.repositories)
  const selectedProjectId = useForgeDeskStore(state => state.selectedProjectId)
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProjectListGroupFilter>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [favoriteBusy, setFavoriteBusy] = useState<string>()
  const [fetching, setFetching] = useState<Set<string>>(new Set())
  const [groupOpen, setGroupOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ProjectGroup>()
  const [groupName, setGroupName] = useState('')
  const root = useRef<HTMLElement>(null)
  const scrollTop = useRef(0)
  const previousRows = useRef<ProjectDirectoryRow[]>([])
  const patchBuffer = useRef(new Map<string, { patch: CheckedRepository; resolve: (accepted: boolean) => void }>())
  const patchTimer = useRef<ReturnType<typeof setTimeout>>()
  const queue = useMemo(() => new DirectoryRefreshQueue(async id => {
    const started = useForgeDeskStore.getState().repositories.find(repository => repository.id === id)
    if (!started || !window.forgeDesk) throw new Error('仓库记录已失效')
    const status = await window.forgeDesk.getRepositoryWorkspaceStatus(id)
    return { started, next: mergeRepositoryWorkspaceStatus(started, status) }
  }, (id, result) => {
    if (useForgeDeskStore.getState().repositories.find(repository => repository.id === id) !== result.started) return false
    const accepted = new Promise<boolean>(resolve => patchBuffer.current.set(id, { patch: result, resolve }))
    if (!patchTimer.current) patchTimer.current = setTimeout(() => {
      patchTimer.current = undefined
      const current = new Map(useForgeDeskStore.getState().repositories.map(repository => [repository.id, repository]))
      const updates: CheckedRepository[] = []
      const resolutions: (() => void)[] = []
      for (const [id, { patch, resolve }] of patchBuffer.current) {
        const valid = current.get(id) === patch.started
        if (valid) updates.push(patch)
        else queue.invalidate([id])
        resolutions.push(() => resolve(valid))
      }
      patchBuffer.current.clear()
      if (updates.length) useForgeDeskStore.getState().applyRepositoryChecks(updates)
      resolutions.forEach(resolve => resolve())
    }, 80)
    return accepted
  }), [])
  const simple = props.mode === 'simple'
  const classified = useMemo(() => projects.filter(project => !!project.archivedAt === props.archived), [projects, props.archived])
  const options = useMemo(() => createProjectListGroupFilterOptions(classified, groups), [classified, groups])
  const activeFilter = options.some(option => option.key === filter) ? filter : 'all'
  const activeOption = options.find(option => option.key === activeFilter)!
  const rows = useMemo(() => {
    const next = buildProjectDirectoryRows(projects, repositories, previousRows.current)
    previousRows.current = next
    return next
  }, [projects, repositories])
  const filteredRows = useMemo(() => {
    const byId = new Map(rows.map(row => [row.id, row]))
    const query = search.trim().toLocaleLowerCase()
    return filterProjectsByGroup(sortProjectsByGroupForDisplay(classified, groups), activeFilter)
      .filter(project => !query || [project.name, project.workspacePath, project.description].some(value => value.toLocaleLowerCase().includes(query)))
      .map(project => byId.get(project.id)!)
  }, [rows, classified, groups, activeFilter, search])
  const groupOptions = useMemo(() => [{ label: '未分组', value: '__ungrouped__' }, ...groups.map(group => ({ label: group.name, value: group.id }))], [groups])
  const selectedRows = rows.filter(row => !!row.project.archivedAt === props.archived && selected.includes(row.id))
  const latest = useRef(props)
  latest.current = props
  const action = useCallback((kind: DirectoryAction, ids: string[]) => latest.current.onAction(kind, ids), [])
  const loadGroups = useCallback(async () => {
    try { if (window.forgeDesk) setGroups(await window.forgeDesk.listProjectGroups()) }
    catch { message.warning('读取项目分组失败，项目列表仍可使用') }
  }, [])
  useEffect(() => { void loadGroups() }, [loadGroups])
  useLayoutEffect(() => {
    if (!props.visible) return
    const container = root.current?.closest('.workspace-content')
    if (!container) return
    container.scrollTop = scrollTop.current
    const remember = () => { scrollTop.current = container.scrollTop }
    container.addEventListener('scroll', remember, { passive: true })
    return () => container.removeEventListener('scroll', remember)
  }, [props.visible])
  useEffect(() => {
    queue.resume()
    return () => { queue.dispose(); if (patchTimer.current) clearTimeout(patchTimer.current); patchTimer.current = undefined; for (const patch of patchBuffer.current.values()) patch.resolve(false); patchBuffer.current.clear() }
  }, [queue])
  useEffect(() => {
    if (!props.visible) { queue.setVisible([]); return }
    let alive = true, observer: IntersectionObserver | undefined, frame = 0
    // Two frames let cached rows paint before the first read is dispatched.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      if (!alive) return
      const visibleRows = new Set<string>()
      const byId = new Map(filteredRows.map(row => [row.id, row]))
      const update = () => {
        queue.setVisible([...visibleRows].flatMap(id => byId.get(id)?.repositories.filter(repository => repository.available).map(repository => repository.id) ?? []))
        queue.refresh()
      }
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.rowKey!
          if (entry.isIntersecting) visibleRows.add(id); else visibleRows.delete(id)
        }
        update()
      }, { root: root.current?.closest('.workspace-content') ?? null })
      root.current?.querySelectorAll('tr[data-row-key]').forEach(row => observer!.observe(row))
    }) })
    const timer = setInterval(() => queue.refresh(), 30_000)
    return () => { alive = false; cancelAnimationFrame(frame); observer?.disconnect(); clearInterval(timer); queue.setVisible([]) }
  }, [props.visible, filteredRows, queue])
  useEffect(() => window.forgeDesk?.onProjectGitTaskUpdated(task => {
    setFetching(current => {
      const next = new Set(current)
      if (task.action === 'fetch' && task.status === 'running') next.add(task.projectId); else next.delete(task.projectId)
      return next.size === current.size && [...next].every(id => current.has(id)) ? current : next
    })
    if (task.status !== 'running') queue.invalidate(useForgeDeskStore.getState().repositories.filter(repository => repository.projectId === task.projectId).map(repository => repository.id))
  }), [queue])
  const toggleFavorite = useCallback(async (project: Project) => {
    setFavoriteBusy(project.id)
    try { await useForgeDeskStore.getState().setProjectFavorite({ id: project.id, isFavorite: !project.isFavorite }) }
    catch { message.error('更新收藏失败') } finally { setFavoriteBusy(undefined) }
  }, [])
  const archive = useCallback(async (project: Project) => {
    try { await useForgeDeskStore.getState().setProjectArchived({ id: project.id, archived: !project.archivedAt }); message.success(project.archivedAt ? '项目已恢复' : '项目已归档，后台任务继续运行') }
    catch { message.error('更新归档状态失败') }
  }, [])
  const changeGroup = useCallback(async (id: string, groupId: string) => {
    try { await window.forgeDesk.setProjectGroup({ projectId: id, groupId: groupId === '__ungrouped__' ? null : groupId }); await useForgeDeskStore.getState().loadWorkspace(); await loadGroups() }
    catch { message.error('更新项目分组失败') }
  }, [loadGroups])
  const columns = useMemo<ColumnsType<ProjectDirectoryRow>>(() => [
    { title: '项目', key: 'project', width: simple ? undefined : 320,
      render: (_, { project }) => <Space direction="vertical" size={2} className="project-list-name-cell"><Space size={8} wrap>
        <Button type="text" size="small" className={`project-favorite-button${project.isFavorite ? ' is-active' : ''}`} icon={project.isFavorite ? <StarFilled /> : <StarOutlined />} loading={favoriteBusy === project.id} aria-label={`${project.isFavorite ? '取消收藏' : '收藏'}项目 ${project.name}`} aria-pressed={project.isFavorite} onClick={event => { event.stopPropagation(); void toggleFavorite(project) }} />
        <Typography.Text strong>{project.name}</Typography.Text>{project.isFavorite ? <Tag color="gold">已收藏</Tag> : null}{selectedProjectId === project.id ? <Tag color="blue">当前项目</Tag> : null}
      </Space><Typography.Text className="project-list-path" type="secondary" title={project.workspacePath}>{project.workspacePath}</Typography.Text></Space> },
    { title: '分组', key: 'group', width: simple ? 150 : 170, render: (_, row) => <Select size="small" value={row.project.groupId ?? '__ungrouped__'} options={groupOptions} onClick={event => event.stopPropagation()} onChange={value => void changeGroup(row.id, value)} /> },
    { title: 'Git 状态', key: 'gitStatus', width: simple ? 340 : 250, shouldCellUpdate: (row, old) => row !== old, render: (_, row) => <DirectoryGitStatus row={row} queue={queue} simple={simple} /> },
    ...(!simple ? [{ title: '分支', key: 'branches', width: 200, shouldCellUpdate: (row: ProjectDirectoryRow, old: ProjectDirectoryRow) => row !== old,
      render: (_: unknown, row: ProjectDirectoryRow) => row.branches.length ? <Space size={6} wrap>{row.branches.slice(0, 3).map(repository => <Tag key={repository.id} color={repository.repositoryKind === 'submodule' ? 'purple' : 'geekblue'}>{repository.name}: {repository.isDetached ? 'Detached HEAD' : repository.currentBranch}</Tag>)}{row.branches.length > 3 ? <Tag>+{row.branches.length - 3}</Tag> : null}</Space> : <Typography.Text type="secondary">未识别</Typography.Text> }] : []),
    { title: '操作', key: 'actions', width: simple ? 76 : 320, render: (_, row) => {
      const menu = [
        { key: 'fetch', label: 'Fetch', disabled: !row.repositories.length }, { key: 'window', label: '独立窗口' },
        { key: 'commit', label: '提交', disabled: !row.changed }, { key: 'merge', label: '合并', disabled: !row.repositories.length },
        { key: 'push', label: '推送', disabled: !row.canPush }, { key: 'delete', label: '删除项目', danger: true }
      ]
      return simple ? <Dropdown trigger={['click']} menu={{ items: menu, onClick: ({ key }) => action(key as DirectoryAction, [row.id]) }}><Button type="text" icon={<MoreOutlined />} aria-label={`更多项目操作：${row.project.name}`} onClick={event => event.stopPropagation()} /></Dropdown> : <Space size={8} wrap className="project-list-actions" onClick={event => event.stopPropagation()}>
        <Button size="small" icon={<DownloadOutlined />} loading={fetching.has(row.id)} disabled={!row.repositories.length} onClick={() => action('fetch', [row.id])}>Fetch</Button>
        <Button size="small" icon={<ExportOutlined />} onClick={() => action('window', [row.id])}>独立窗口</Button>
        <Button size="small" icon={<SaveOutlined />} disabled={!row.changed} onClick={() => action('commit', [row.id])}>提交</Button>
        <Button size="small" icon={<BranchesOutlined />} disabled={!row.repositories.length} onClick={() => action('merge', [row.id])}>合并</Button>
        <Button size="small" icon={<UploadOutlined />} disabled={!row.canPush} onClick={() => action('push', [row.id])}>推送</Button>
        <Button size="small" danger icon={<DeleteOutlined />} aria-label={`删除项目 ${row.project.name}`} onClick={() => action('delete', [row.id])} />
      </Space>
    } },
    { title: '归档', key: 'archive', width: 88, render: (_, row) => <Button size="small" onClick={event => { event.stopPropagation(); void archive(row.project) }}>{row.project.archivedAt ? '恢复' : '归档'}</Button> }
  ], [simple, groupOptions, favoriteBusy, selectedProjectId, fetching, toggleFavorite, changeGroup, archive, action, queue])
  const rowSelection = useMemo(() => simple ? undefined : { selectedRowKeys: selected, onChange: (keys: React.Key[]) => setSelected(keys.map(String)) }, [simple, selected])
  const onRow = useCallback((row: ProjectDirectoryRow) => ({ className: 'project-list-clickable-row', onClick: (event: React.MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select,[role="button"],.ant-select,.ant-checkbox-wrapper,.ant-table-selection-column')) return
    latest.current.onOpen(row.id)
  } }), [])
  async function saveGroup() {
    try { await window.forgeDesk.saveProjectGroup({ id: editingGroup?.id, name: groupName }); await loadGroups(); setEditingGroup(undefined); setGroupName(''); setGroupOpen(false) }
    catch { message.error('保存分组失败') }
  }
  async function deleteGroup(id: string) {
    try { await window.forgeDesk.deleteProjectGroup(id); await useForgeDeskStore.getState().loadWorkspace(); await loadGroups() }
    catch { message.error('删除分组失败') }
  }
  async function moveGroup(index: number, offset: number) {
    const ids = groups.map(group => group.id)
    ;[ids[index], ids[index + offset]] = [ids[index + offset], ids[index]]
    try { setGroups(await window.forgeDesk.reorderProjectGroups(ids)) } catch { message.error('调整分组顺序失败') }
  }
  const table = useMemo(() => <Table<ProjectDirectoryRow> key={simple ? 'simple' : 'full'} className={`project-list-table${simple ? ' simple-project-list-table' : ''}`} rowKey="id" size="middle" tableLayout="fixed" columns={columns} dataSource={filteredRows} pagination={false} rowSelection={rowSelection} onRow={onRow} scroll={{ x: simple ? 900 : 1380 }} locale={{ emptyText: <Empty description={projects.length ? '没有匹配的项目' : '还没有项目'}><Button onClick={props.onCreate}>创建项目</Button></Empty> }} />, [simple, columns, filteredRows, rowSelection, onRow, projects.length, props.onCreate])
  return <section ref={root} className="workspace-section project-workspace workspace-production-project" aria-label="项目列表页面">
    <div className="section-heading"><div><Typography.Title level={2}>{props.archived ? '已归档项目' : '项目'}</Typography.Title><Typography.Text type="secondary">{simple ? '项目、仓库和发布状态集中管理。' : '一行一个项目，直接管理 Fetch、提交、合并和推送任务。'}</Typography.Text></div><Space wrap>{!simple ? <Button icon={<FileTextOutlined />} onClick={props.onLogs}>任务日志</Button> : null}<Button onClick={props.onArchiveList}>{props.archived ? '当前项目' : '归档项目'}</Button><Button type="primary" icon={<PlusOutlined />} onClick={props.onCreate}>创建项目</Button></Space></div>
    <div className="project-list-page"><div className="project-list-panel"><div className="project-list-heading"><div><Typography.Title level={4}>项目列表 · {activeOption.label}</Typography.Title><Typography.Text type="secondary">{activeOption.projectCount} 个项目 · 缓存先显示，Git 状态后台检查</Typography.Text></div><Space wrap>
      {!simple ? <><Button icon={<DownloadOutlined />} loading={selectedRows.some(row => fetching.has(row.id))} disabled={!selectedRows.some(row => row.repositories.length)} onClick={() => action('fetch', selectedRows.map(row => row.id))}>Fetch 所选</Button><Button icon={<UploadOutlined />} disabled={!selectedRows.some(row => row.canPush)} onClick={() => action('push-selected', selectedRows.map(row => row.id))}>推送所选</Button></> : null}
      <Button icon={<ReloadOutlined />} onClick={() => queue.refresh(true)}>检查状态</Button><Button size="small" icon={<PlusOutlined />} onClick={props.onCreate} aria-label="创建项目" />
    </Space></div><div className="project-group-filter" aria-label="项目分组筛选"><Input.Search aria-label="查找项目" placeholder="搜索项目名称或目录" allowClear value={search} onChange={event => setSearch(event.target.value)} style={{ width: 240 }} />{options.map(option => <Button key={option.key} size="small" type={option.key === activeFilter ? 'primary' : 'default'} className="project-group-filter-option" onClick={() => setFilter(option.key)}>{option.label} <span>{option.projectCount}</span></Button>)}<Button size="small" icon={<FolderOpenOutlined />} onClick={() => { setEditingGroup(undefined); setGroupName(''); setGroupOpen(true) }}>管理分组</Button></div>
      {table}
    </div></div>
    <Modal title="项目分组" open={groupOpen} onCancel={() => setGroupOpen(false)} onOk={() => void saveGroup()} okText="保存" cancelText="取消"><Space direction="vertical" style={{ width: '100%' }}><Input placeholder="分组名称" value={groupName} onChange={event => setGroupName(event.target.value)} onPressEnter={() => void saveGroup()} />{groups.map((group, index) => <Space key={group.id}><Typography.Text>{group.name}</Typography.Text><Button size="small" disabled={!index} onClick={() => void moveGroup(index, -1)}>上移</Button><Button size="small" disabled={index === groups.length - 1} onClick={() => void moveGroup(index, 1)}>下移</Button><Button size="small" icon={<EditOutlined />} onClick={() => { setEditingGroup(group); setGroupName(group.name) }}>编辑</Button><Popconfirm title={`删除分组“${group.name}”？`} description="项目移到未分组，不删除项目。" onConfirm={() => deleteGroup(group.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>)}</Space></Modal>
  </section>
})
