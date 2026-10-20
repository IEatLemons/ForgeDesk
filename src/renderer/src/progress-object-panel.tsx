import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Empty, Form, Input, List, Modal, Progress, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import type { KeyResultInput, ProgressEntity, ProgressKeyResult, ProgressObject, ProgressScopeKind, ProjectProgressSnapshot, WorkScopeFields } from '../../shared/project-progress'
import { KeyResultDetail, KeyResultEditor, resultStatusLabels, type ProgressSend } from './progress-key-result'
import { ProgressDelivery } from './progress-delivery'
import { ProgressHistory } from './progress-history'
import { relatedDeliveryGoalIds } from './project-progress-view'

const labels: Record<ProgressScopeKind, string> = { goal: '目标', milestone: '里程碑', version: '版本计划' }
const statuses: Record<string, string> = { draft: '草稿', active: '进行中', planned: '计划中', achieved: '已达成', closed: '已收口', cancelled: '已取消', archived: '已归档' }
type EntityForm = { projectId: string; title: string; description: string; criteriaText: string; ownerRef: string; targetDate: string }

export function ProgressObjectPanel({ snapshot, projectId, projects, section, object, onObjectChange, onSend, onRefresh, onCreateWork, onOpenWork }: {
  snapshot: ProjectProgressSnapshot; projectId?: string; projects: Array<{ id: string; name: string }>; section?: ProgressScopeKind
  object?: ProgressObject; onObjectChange?: (object?: ProgressObject) => void; onSend: ProgressSend; onRefresh: () => Promise<unknown>
  onCreateWork: (scope: Partial<WorkScopeFields>) => void; onOpenWork: (id: string) => void
}): JSX.Element {
  const [local, setLocal] = useState<ProgressObject>()
  const [listKind, setListKind] = useState<ProgressScopeKind>('goal')
  const [tab, setTab] = useState('overview')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [editing, setEditing] = useState<ProgressEntity | 'new' | null>(null)
  const [resultEdit, setResultEdit] = useState<ProgressKeyResult | 'new' | 'upgrade' | null>(null)
  const [linkResult, setLinkResult] = useState<ProgressKeyResult | null>(null)
  const [taskId, setTaskId] = useState<string>()
  const [form] = Form.useForm<EntityForm>()
  const focus = onObjectChange ? object : local
  const currentResult = focus?.kind === 'key_result' ? snapshot.keyResults.find(result => result.id === focus.id) : undefined
  const selected = snapshot.entities.find(entity => entity.id === (currentResult?.goalId || focus?.id) && (currentResult ? entity.kind === 'goal' : entity.kind === focus?.kind))
  const kind = selected?.kind || section || listKind
  const goal = selected?.kind === 'goal' ? selected : undefined
  const goalStats = goal ? snapshot.goalStats[goal.id] : undefined
  const results = snapshot.keyResults.filter(result => result.goalId === goal?.id)
  const tasks = snapshot.items.filter(task => !task.parentId && (selected?.kind === 'goal' ? task.goalId === selected.id : selected?.kind === 'milestone' ? task.milestoneId === selected.id : task.versionId === selected?.id))
  const relatedDelivery = goal ? snapshot.entities.filter(entity => entity.kind !== 'goal' && relatedDeliveryGoalIds(entity,snapshot.items,snapshot.keyResults,snapshot.relations).includes(goal.id)) : []
  function open(next?: ProgressObject) { setLocal(next); onObjectChange?.(next); setTab(next?.kind === 'key_result' ? 'results' : 'overview') }
  useEffect(() => { setTab(focus?.kind === 'key_result' ? 'results' : 'overview'); setEditing(null); setResultEdit(null); setLinkResult(null) }, [focus?.id, focus?.kind, projectId])
  useEffect(() => { if (focus && focus.kind !== 'task' && !selected) { message.warning('进度对象不存在或不属于当前项目，已返回对应列表'); open(undefined) } }, [focus?.id, focus?.kind, selected?.id])
  async function execute(command: Record<string, unknown>) {
    if (locked.current) throw new Error('操作进行中，请稍候')
    locked.current = true; setBusy(true)
    try { const result = await onSend(command); await onRefresh(); return result }
    catch (error) { message.error(error instanceof Error ? error.message : String(error)); throw error }
    finally { locked.current = false; setBusy(false) }
  }
  async function run(command: Record<string, unknown>) { await execute(command) }
  function edit(entity?: ProgressEntity) { form.resetFields(); form.setFieldsValue(entity ? { ...entity, targetDate: entity.targetDate || '' } : { projectId: projectId || projects[0]?.id, title: '', description: '', criteriaText: '', ownerRef: '', targetDate: '' }); setEditing(entity || 'new') }
  function transition(action: 'accept' | 'reopen' | 'cancel' | 'archive') {
    if (!selected) return
    Modal.confirm({ title: action === 'accept' ? `确认${labels[selected.kind]}达成？` : action === 'reopen' ? '重新打开并保留历史？' : action === 'cancel' ? '取消这项目标或计划？' : '归档版本计划？', content: action === 'accept' && goal?.progressMode === 'key_results' ? `以关键结果验收为准。还有 ${goalStats?.unfinishedTasks || 0} 个支撑任务未完成，它们会继续保留。` : '修改会记录历史；任务、AI 执行与代码交付不会被自动完成或停止。', okText: '确认', cancelText: '返回', onOk: () => run({ type: 'transition-entity', id: selected.id, kind: selected.kind, expectedVersion: selected.rowVersion, action }) })
  }
  const canEdit = selected && !['achieved', 'closed', 'cancelled', 'archived'].includes(selected.status)
  const ready = selected?.kind === 'goal' ? goalStats?.readyForAcceptance : selected ? snapshot.deliveryStats[selected.id]?.readyForAcceptance : undefined
  const entityModal = <Modal open={!!editing} title={`${editing === 'new' ? '新建' : '编辑'}${labels[kind]}`} okText="保存" cancelText="取消" confirmLoading={busy} onCancel={() => setEditing(null)} onOk={async () => {
    try {
      const values = await form.validateFields()
      const result = await execute({ type: 'save-entity', kind, input: { ...values, id: editing && editing !== 'new' ? editing.id : undefined, targetDate: values.targetDate || null }, expectedVersion: editing && editing !== 'new' ? editing.rowVersion : undefined })
      setEditing(null); open({ kind, id: result.entityId })
    } catch { /* Keep the form and validation visible. */ }
  }}><Form name="progress-object-editor" form={form} layout="vertical"><Form.Item name="projectId" label="项目" rules={[{ required: true }]}><Select disabled={editing !== 'new' || !!projectId} options={projects.map(project => ({ value: project.id, label: project.name }))} /></Form.Item><Form.Item name="title" label="名称" rules={[{ required: true, whitespace: true }]}><Input autoFocus /></Form.Item><Form.Item name="description" label="说明"><Input.TextArea rows={3} /></Form.Item><Form.Item name="criteriaText" label="达成说明"><Input.TextArea rows={2} /></Form.Item><Form.Item name="ownerRef" label="负责人"><Input /></Form.Item><Form.Item name="targetDate" label="目标日期"><Input type="date" /></Form.Item></Form></Modal>

  if (!selected) return <section aria-label={`${labels[kind]}列表`}>
    <div className="progress-object-heading"><div><Typography.Text type="secondary">{kind === 'goal' ? '从目标定义结果，再拆解支撑任务。' : kind === 'milestone' ? '跨目标检查阶段成果。' : '安排本次交付任务和发布检查点。'}</Typography.Text></div><Space>{!section ? <Select aria-label="计划类型" value={listKind} onChange={setListKind} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} /> : null}<Button type="primary" disabled={busy} onClick={() => edit()}>新建{labels[kind]}</Button></Space></div>
    <Table<ProgressEntity> rowKey="id" dataSource={snapshot.entities.filter(entity => entity.kind === kind)} pagination={{ pageSize: 12, hideOnSinglePage: true }} scroll={{ x: 640 }} locale={{ emptyText: <Empty description={`暂无${labels[kind]}，创建后开始管理`} /> }} columns={[
      { title: labels[kind], key: 'name', render: (_, entity) => <Button type="link" className="progress-title" onClick={() => open({ kind: entity.kind, id: entity.id })}>{entity.title}</Button> },
      ...(!projectId ? [{ title: '项目', key: 'project', render: (_: unknown, entity: ProgressEntity) => projects.find(project => project.id === entity.projectId)?.name || '已删除项目' }] : []),
      { title: kind === 'goal' ? '目标达成度' : '验收进度', key: 'progress', render: (_, entity) => { const stats = snapshot.goalStats[entity.id], delivery = snapshot.deliveryStats[entity.id]; return kind === 'goal' ? <Space direction="vertical" size={0}><span>{stats?.percent == null ? '尚未定义' : `${stats.percent}%`}{entity.progressMode === 'legacy_tasks' ? ' · 旧任务口径' : ` · 已验收 ${stats?.achieved || 0}/${stats?.total || 0} 个结果`}</span>{stats?.overdue || stats?.blocked ? <Typography.Text type="danger">结果逾期 {stats.overdue} · 支撑任务阻塞 {stats.blocked}</Typography.Text> : null}</Space> : <Space direction="vertical" size={0}><span>任务验收 {delivery?.tasksAccepted || 0}/{delivery?.tasksTotal || 0}</span><span>检查点通过 {delivery?.checkpointsAccepted || 0}/{delivery?.checkpointsTotal || 0}</span></Space> } },
      { title: '目标日期', dataIndex: 'targetDate', render: value => value || '未安排' }, { title: '状态', dataIndex: 'status', render: value => statuses[value] }
    ]} />{entityModal}
  </section>

  const overview = <section><Typography.Paragraph>{selected.description || '尚未填写说明'}</Typography.Paragraph><Typography.Paragraph>达成说明：{selected.criteriaText || '请通过关键结果或交付检查点明确验收条件。'}</Typography.Paragraph><Typography.Paragraph type="secondary">负责人：{selected.ownerRef || '未指定'} · 目标日期：{selected.targetDate || '未安排'}</Typography.Paragraph>
    {goal ? <><Typography.Title level={5}>{goal.progressMode === 'legacy_tasks' ? '任务完成度（旧口径）' : '目标达成度'}</Typography.Title>{goalStats?.percent == null ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未定义关键结果" /> : <Progress percent={goalStats.percent} status={goal.status === 'achieved' ? 'success' : 'normal'} />}<Typography.Paragraph>关键结果已验收 {goalStats?.achieved || 0}/{goalStats?.total || 0} · 支撑任务未完成 {goalStats?.unfinishedTasks || 0}</Typography.Paragraph>
      {goal.progressMode === 'legacy_tasks' ? <Alert showIcon type="info" message="此目标保留旧任务口径" description="升级前预览原状态、关联任务和新关键结果；不会自动修改旧数据。" action={<Button disabled={!canEdit && goal.status !== 'achieved'} onClick={() => setResultEdit('upgrade')}>预览升级</Button>} /> : <Button disabled={!canEdit} onClick={() => { setTab('results'); setResultEdit('new') }}>定义关键结果</Button>}
      <Typography.Title level={5}>相关交付</Typography.Title><Space wrap>{relatedDelivery.map(entity => <Button key={entity.id} onClick={() => open({ kind: entity.kind, id: entity.id })}>{labels[entity.kind]} · {entity.title}</Button>)}</Space>
    </> : <ProgressDelivery entity={selected} snapshot={snapshot} busy={busy} run={run} onOpen={open} onCreateWork={onCreateWork} onOpenWork={onOpenWork} />}
  </section>
  const resultPanel = goal ? <section><div className="progress-object-heading"><Typography.Text type="secondary">结果衡量是否成功；支撑任务记录执行情况。</Typography.Text>{goal.progressMode === 'key_results' ? <Button disabled={!canEdit} onClick={() => setResultEdit('new')}>新建关键结果</Button> : <Button onClick={() => setResultEdit('upgrade')}>预览升级旧目标</Button>}</div>
    {currentResult ? <><Button type="text" onClick={() => { open({ kind: 'goal', id: goal.id }); setTab('results') }}>← 全部关键结果</Button><KeyResultDetail key={currentResult.id} result={currentResult} snapshot={snapshot} busy={busy} run={run} onEdit={() => setResultEdit(currentResult)} onCreateWork={onCreateWork} onLinkWork={() => { setTaskId(undefined); setLinkResult(currentResult) }} onOpenWork={onOpenWork} /></> : <List dataSource={results} locale={{ emptyText: '尚未定义关键结果' }} renderItem={result => <List.Item actions={[<Button key="open" onClick={() => open({ kind: 'key_result', id: result.id })}>查看与管理</Button>]}><List.Item.Meta title={result.title} description={result.criteriaText} /><Space><Tag>{resultStatusLabels[result.status]}</Tag><span>{snapshot.keyResultStats[result.id]?.percent || 0}%</span></Space></List.Item>} />}
  </section> : null
  return <section className="progress-object-detail">
    <Button type="text" onClick={() => open(undefined)}>← 返回{labels[kind]}列表</Button>
    <div className="progress-object-heading"><div><Typography.Title level={3}>{selected.title}</Typography.Title><Tag>{statuses[selected.status]}</Tag>{goal?.progressMode === 'legacy_tasks' ? <Tag>旧任务口径</Tag> : null}</div><Space wrap>{canEdit ? <><Button disabled={busy} onClick={() => edit(selected)}>编辑资料</Button><Button type="primary" disabled={busy || ready === false} onClick={() => transition('accept')}>{kind === 'version' ? '确认版本收口' : '确认达成'}</Button><Button danger disabled={busy} onClick={() => transition('cancel')}>取消</Button></> : <Button disabled={busy} onClick={() => transition('reopen')}>重开</Button>}{kind === 'version' && selected.status === 'closed' ? <Button onClick={() => transition('archive')}>归档版本</Button> : null}</Space></div>
    <Tabs activeKey={tab} onChange={setTab} items={[{ key: 'overview', label: '概况', children: overview }, ...(goal ? [{ key: 'results', label: `关键结果 ${results.length}`, children: resultPanel }] : []), { key: 'work', label: '关联工作', children: <><Button onClick={() => onCreateWork({ projectId: selected.projectId, ...(goal ? { goalId: goal.id } : selected.kind === 'milestone' ? { milestoneId: selected.id } : { versionId: selected.id }) })}>新建关联任务</Button><List dataSource={tasks} locale={{ emptyText: '暂无关联任务' }} renderItem={task => <List.Item><Button type="link" onClick={() => onOpenWork(task.id)}>{task.title}</Button><span>{task.status === 'done' ? '已验收' : task.status === 'cancelled' ? '已取消' : '未完成'}</span></List.Item>} /></> }, { key: 'history', label: '历史', children: <ProgressHistory key={selected.updatedAt} object={{ kind: selected.kind, id: selected.id }} projectId={selected.projectId} /> }]} />
    {entityModal}
    {resultEdit && goal ? <KeyResultEditor key={typeof resultEdit === 'string' ? resultEdit : resultEdit.id} goal={goal} result={typeof resultEdit === 'string' ? undefined : resultEdit} upgrade={resultEdit === 'upgrade'} snapshot={snapshot} busy={busy} onCancel={() => setResultEdit(null)} onSave={async (input: KeyResultInput) => { const result = await execute(resultEdit === 'upgrade' ? { type: 'upgrade-goal', id: goal.id, expectedVersion: goal.rowVersion, keyResults: [input] } : { type: 'save-key-result', input, expectedVersion: typeof resultEdit === 'string' ? undefined : resultEdit.rowVersion }); setResultEdit(null); open({ kind: resultEdit === 'upgrade' ? 'goal' : 'key_result', id: result.entityId }) }} /> : null}
    <Modal open={!!linkResult} title="关联已有支撑任务" okText="确认归属" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !taskId }} onCancel={() => setLinkResult(null)} onOk={async () => { const task = snapshot.items.find(item => item.id === taskId); if (!task || !linkResult) return; try { await run({ type: 'move', id: task.id, expectedVersion: task.rowVersion, scope: { projectId: task.projectId, goalId: linkResult.goalId, keyResultId: linkResult.id, milestoneId: task.milestoneId, versionId: task.versionId } }); setLinkResult(null) } catch { /* Keep selection on failure. */ } }}>
      <Alert type="info" message="调整整个父任务及子任务的主要归属，不复制任务。已验收任务需先重开，活动 AI 执行需先停止或核对。" />
      <Select aria-label="选择支撑任务" style={{ width: '100%', marginTop: 16 }} value={taskId} onChange={setTaskId} options={snapshot.items.filter(task => !task.parentId && task.projectId === linkResult?.projectId).map(task => { const blocked = !!task.archivedAt || task.authority !== 'native' || ['done', 'cancelled'].includes(task.status) || snapshot.executions.some(run => (run.workItemId === task.id || snapshot.items.some(child => child.parentId === task.id && child.id === run.workItemId)) && run.phase !== 'context-imported' && ['queued','running','waiting','cancelling','unknown'].includes(run.status)); return { value: task.id, label: `${task.title}${blocked ? '（请先重开、恢复归档或处理活动执行）' : task.keyResultId ? '（将调整原结果归属）' : ''}`, disabled: blocked } })} />
    </Modal>
  </section>
}
