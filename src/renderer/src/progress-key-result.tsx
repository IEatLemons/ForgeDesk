import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, List, Modal, Progress, Select, Space, Tag, Typography } from 'antd'
import type { KeyResultInput, ProgressEntity, ProgressKeyResult, ProjectProgressSnapshot, ProgressCommandResult, WorkScopeFields } from '../../shared/project-progress'
import { ProgressHistory } from './progress-history'

export type ProgressSend = (command: Record<string, unknown>) => Promise<ProgressCommandResult>
export const resultStatusLabels = { active: '进行中', achieved: '已验收', cancelled: '已取消' }

export function KeyResultEditor({ goal, result, upgrade, snapshot, onSave, onCancel, busy }: {
  goal: ProgressEntity; result?: ProgressKeyResult; upgrade?: boolean; snapshot: ProjectProgressSnapshot
  onSave: (input: KeyResultInput) => Promise<void>; onCancel: () => void; busy: boolean
}): JSX.Element {
  const [form] = Form.useForm<KeyResultInput>()
  const measurement = Form.useWatch('measurement', form)
  return <Modal open title={upgrade ? '升级目标：预览与确认' : result ? '编辑关键结果' : '新建关键结果'} okText={upgrade ? '确认升级并创建结果' : '保存'} cancelText="取消" confirmLoading={busy} onCancel={onCancel} onOk={async () => {
    try {
      const values = await form.validateFields()
      await onSave({ ...values, id: result?.id, goalId: goal.id, projectId: goal.projectId, targetDate: values.targetDate || null })
    } catch { /* Field errors and command failures are shown by the form / command owner. */ }
  }}>
    {upgrade ? <><Alert showIcon type="warning" message="原任务和旧验收历史保持不变" description={`原状态：${goal.status === 'achieved' ? '已达成；升级后回到进行中' : goal.status === 'draft' ? '草稿' : '进行中'}。新口径按关键结果验收，不自动把任务变成结果。`} /><List size="small" header="将保留的关联任务" dataSource={snapshot.items.filter(item => !item.parentId && item.goalId === goal.id)} locale={{ emptyText: '暂无关联任务' }} renderItem={item => <List.Item>{item.title} · {item.status === 'done' ? '已验收' : item.status === 'cancelled' ? '已取消' : '未完成'}</List.Item>} /><Typography.Paragraph>先定义第一个关键结果；升级后可继续补充。</Typography.Paragraph></> : null}
    <Form form={form} name="key-result-editor" layout="vertical" initialValues={result || { measurement: 'deliverable', title: '', criteriaText: '', ownerRef: '', direction: 'increase', baselineValue: 0, unit: '' }}>
      <Form.Item name="title" label="关键结果名称" rules={[{ required: true, whitespace: true }]}><Input autoFocus /></Form.Item>
      <Form.Item name="measurement" label="衡量方式" rules={[{ required: true }]}><Select disabled={!!result} options={[{ value: 'deliverable', label: '交付验收：按条件验证结果' }, { value: 'numeric', label: '数值指标：记录基线、当前值与目标值' }]} /></Form.Item>
      <Form.Item name="criteriaText" label="如何判断结果达成" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={3} placeholder="明确验收标准，而不是重复任务列表" /></Form.Item>
      {measurement === 'numeric' ? <><Form.Item name="direction" label="指标方向"><Select options={[{ value: 'increase', label: '越高越好' }, { value: 'decrease', label: '越低越好' }]} /></Form.Item><div className="progress-form-dates"><Form.Item name="baselineValue" label="基线值" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item><Form.Item name="targetValue" label="目标值" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></div><Form.Item name="unit" label="单位"><Input placeholder="例如 %、ms、个" /></Form.Item></> : null}
      <Form.Item name="ownerRef" label="负责人"><Input /></Form.Item><Form.Item name="targetDate" label="目标日期"><Input type="date" /></Form.Item>
    </Form>
  </Modal>
}

export function KeyResultDetail({ result, snapshot, busy, run, onEdit, onCreateWork, onLinkWork, onOpenWork }: {
  result: ProgressKeyResult; snapshot: ProjectProgressSnapshot; busy: boolean
  run: (command: Record<string, unknown>) => Promise<void>; onEdit: () => void
  onCreateWork: (scope: Partial<WorkScopeFields>) => void; onLinkWork: () => void; onOpenWork: (id: string) => void
}): JSX.Element {
  const [dialog, setDialog] = useState<'measure' | 'accept' | 'reopen' | 'cancel' | null>(null)
  const [evidence, setEvidence] = useState('')
  const [value, setValue] = useState<number | null>(result.currentValue)
  const [history, setHistory] = useState(false)
  const stats = snapshot.keyResultStats[result.id]
  const goal = snapshot.entities.find(entity => entity.id === result.goalId)
  const editable = result.status === 'active' && !['achieved', 'cancelled'].includes(goal?.status || '')
  const tasks = snapshot.items.filter(item => !item.parentId && item.keyResultId === result.id)
  const open = (action: NonNullable<typeof dialog>) => { setEvidence(''); setValue(result.currentValue); setDialog(action) }
  return <section className="progress-result-detail" aria-label={`关键结果 ${result.title}`}>
    <div className="progress-object-heading"><div><Typography.Title level={4}>{result.title}</Typography.Title><Space wrap><Tag>{resultStatusLabels[result.status]}</Tag><Typography.Text type="secondary">{result.ownerRef || '未指定负责人'} · {result.targetDate || '未安排日期'}</Typography.Text></Space></div><Space wrap><Button onClick={() => setHistory(current => !current)}>{history ? '返回结果' : '历史'}</Button>{editable ? <Button disabled={busy} onClick={onEdit}>编辑结果</Button> : null}</Space></div>
    {history ? <ProgressHistory object={{ kind: 'key_result', id: result.id }} projectId={result.projectId} /> : <>
      <Typography.Paragraph>{result.criteriaText}</Typography.Paragraph>
      {result.measurement === 'numeric' ? <Typography.Paragraph>基线 {result.baselineValue}{result.unit} → 当前 {result.currentValue}{result.unit} → 目标 {result.direction === 'increase' ? '≥' : '≤'}{result.targetValue}{result.unit}</Typography.Paragraph> : null}
      <Progress percent={stats?.percent || 0} status={result.status === 'achieved' ? 'success' : 'normal'} />
      {stats?.readyForAcceptance ? <Alert type="info" message="指标已达标，仍需填写依据并人工验收" /> : null}
      {result.evidence ? <Typography.Paragraph className="progress-evidence">最近依据：{result.evidence}</Typography.Paragraph> : null}
      <Space wrap>{editable && result.measurement === 'numeric' ? <Button disabled={busy} onClick={() => open('measure')}>记录测量</Button> : null}{editable ? <><Button type="primary" disabled={busy || (result.measurement === 'numeric' && !stats?.readyForAcceptance)} onClick={() => open('accept')}>验收关键结果</Button><Button danger disabled={busy} onClick={() => open('cancel')}>取消结果</Button></> : result.status !== 'active' ? <Button disabled={busy || goal?.status === 'cancelled'} onClick={() => open('reopen')}>重开结果</Button> : <Typography.Text type="secondary">请先重开目标再调整结果。</Typography.Text>}</Space>
      <div className="progress-object-heading"><Typography.Title level={5}>支撑任务 · 执行完成 {stats?.support.done || 0}／{stats?.support.total || 0}</Typography.Title><Space wrap><Button onClick={() => onCreateWork({ projectId: result.projectId, goalId: result.goalId, keyResultId: result.id })}>新建支撑任务</Button><Button onClick={onLinkWork}>关联已有任务</Button></Space></div>
      <List dataSource={tasks} locale={{ emptyText: '暂无支撑任务；结果也可以凭独立证据验收' }} renderItem={task => <List.Item><Button type="link" onClick={() => onOpenWork(task.id)}>{task.title}</Button><Tag>{task.status === 'done' ? '已验收' : task.status === 'cancelled' ? '已取消' : '未完成'}</Tag></List.Item>} />
    </>}
    <Modal open={!!dialog} title={dialog === 'measure' ? '记录测量' : dialog === 'accept' ? '验收关键结果' : dialog === 'reopen' ? '重开关键结果' : '取消关键结果'} okText="确认" cancelText="取消" confirmLoading={busy} onCancel={() => setDialog(null)} okButtonProps={{ disabled: !evidence.trim() || (dialog === 'measure' && value === null) }} onOk={async () => {
      try {
        await run(dialog === 'measure' ? { type: 'measure-key-result', id: result.id, expectedVersion: result.rowVersion, value, evidence } : { type: 'transition-key-result', id: result.id, expectedVersion: result.rowVersion, action: dialog, evidence })
        setDialog(null)
      } catch { /* Keep input open; command owner reports the failure. */ }
    }}>
      {dialog === 'reopen' ? <Alert type="warning" message="关联目标及交付检查点的当前达成确认会撤销，历史保留。" /> : null}
      {dialog === 'measure' ? <Form layout="vertical"><Form.Item label={`当前值（${result.unit || '数值'}）`}><InputNumber aria-label="本次测量值" value={value} onChange={setValue} style={{ width: '100%' }} /></Form.Item></Form> : null}
      <label>依据或说明（必填）<Input.TextArea aria-label="结果操作依据" value={evidence} onChange={event => setEvidence(event.target.value)} rows={3} placeholder="测量记录、验收说明或证据链接" /></label>
    </Modal>
  </section>
}
