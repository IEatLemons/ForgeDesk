import { useState } from 'react'
import { Alert, Button, List, Modal, Select, Space, Typography } from 'antd'
import type { ProgressEntity, ProgressObject, ProjectProgressSnapshot, WorkScopeFields } from '../../shared/project-progress'
import { relatedDeliveryGoalIds } from './project-progress-view'

export function ProgressDelivery({ entity, snapshot, busy, run, onOpen, onCreateWork, onOpenWork }: {
  entity: ProgressEntity; snapshot: ProjectProgressSnapshot; busy: boolean
  run: (command: Record<string, unknown>) => Promise<void>; onOpen: (object: ProgressObject) => void
  onCreateWork: (scope: Partial<WorkScopeFields>) => void; onOpenWork: (id: string) => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [ids, setIds] = useState<string[]>([])
  const milestone = entity.kind === 'milestone'
  const linkedIds = snapshot.relations.filter(link => link.sourceId === entity.id).map(link => link.targetId)
  const targets = milestone ? snapshot.keyResults : snapshot.entities.filter(item => item.kind === 'milestone')
  const linked = targets.filter(target => linkedIds.includes(target.id))
  const tasks = snapshot.items.filter(task => !task.parentId && (milestone ? task.milestoneId : task.versionId) === entity.id)
  const goalIds = new Set(relatedDeliveryGoalIds(entity,snapshot.items,snapshot.keyResults,snapshot.relations))
  return <section>
    <Alert type="info" showIcon message={milestone ? '阶段检查点：检查所选关键结果与直接关联任务。' : '版本交付：本版任务与里程碑分别核对，不隐式加入里程碑下的其他任务。'} />
    <div className="progress-object-heading"><Typography.Title level={5}>{milestone ? '关联关键结果' : '发布检查点'}</Typography.Title><Button disabled={busy || !['active', 'planned'].includes(entity.status)} onClick={() => { setIds(linkedIds); setEditing(true) }}>管理关联</Button></div>
    <List dataSource={linked} locale={{ emptyText: milestone ? '尚未关联关键结果' : '尚未关联里程碑' }} renderItem={target => <List.Item><Button type="link" onClick={() => onOpen({ kind: milestone ? 'key_result' : 'milestone', id: target.id })}>{target.title}</Button><span>{target.status === 'achieved' ? '已验收' : target.status === 'cancelled' ? '已取消（检查未通过）' : '待验收'}</span></List.Item>} />
    <div className="progress-object-heading"><Typography.Title level={5}>直接关联任务</Typography.Title><Button onClick={() => onCreateWork({ projectId: entity.projectId, [milestone ? 'milestoneId' : 'versionId']: entity.id })}>新建交付任务</Button></div>
    <List dataSource={tasks} locale={{ emptyText: '暂无直接关联任务，可在任务的归属设置中加入已有任务' }} renderItem={task => <List.Item><Button type="link" onClick={() => onOpenWork(task.id)}>{task.title}</Button><span>{task.status === 'done' ? '已验收' : task.status === 'cancelled' ? '已取消' : '待验收'}</span></List.Item>} />
    <Typography.Title level={5}>相关目标</Typography.Title><Space wrap>{snapshot.entities.filter(goal => goal.kind === 'goal' && goalIds.has(goal.id)).map(goal => <Button key={goal.id} type="link" onClick={() => onOpen({ kind: 'goal', id: goal.id })}>{goal.title}</Button>)}</Space>
    {milestone ? <><Typography.Title level={5}>关联版本</Typography.Title><Space wrap>{snapshot.entities.filter(version => version.kind === 'version' && snapshot.relations.some(link => link.sourceId === version.id && link.targetId === entity.id)).map(version => <Button key={version.id} type="link" onClick={() => onOpen({ kind: 'version', id: version.id })}>{version.title}</Button>)}</Space></> : null}
    <Modal open={editing} title={milestone ? '关联同项目关键结果' : '关联同项目里程碑'} okText="保存关联" cancelText="取消" confirmLoading={busy} onCancel={() => setEditing(false)} onOk={async () => { try { await run({ type: 'set-progress-relations', id: entity.id, expectedVersion: entity.rowVersion, kind: milestone ? 'milestone_result' : 'version_milestone', targetIds: ids }); setEditing(false) } catch { /* Keep selection on failure. */ } }}>
      <Select aria-label="交付关联对象" mode="multiple" style={{ width: '100%' }} value={ids} onChange={setIds} options={targets.filter(target => target.projectId === entity.projectId).map(target => ({ value: target.id, label: `${target.title}${milestone ? ` · ${snapshot.entities.find(goal => goal.id === (target as { goalId?: string }).goalId)?.title || ''}` : ''}` }))} />
    </Modal>
  </section>
}
