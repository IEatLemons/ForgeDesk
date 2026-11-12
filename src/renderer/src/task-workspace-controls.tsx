import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Checkbox, DatePicker, Input, InputNumber, Modal, Popover, Select, Space, Tag, Tooltip } from 'antd'
import { CalendarOutlined, ClockCircleOutlined, LinkOutlined, PaperClipOutlined, RetweetOutlined, SmileOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { TaskField, TaskFilter, TaskRecurrence, TaskValue, TaskWorkspaceSnapshot, WorkspaceTask } from '../../shared/task-workspace'
import { taskBuiltinFields } from '../../shared/task-workspace'
import { sendTaskCommand } from './use-task-workspace'

export const priorityLabels = { low: '低', medium: '中', high: '高' }
export function TaskPriorityBadge({ value }: { value: WorkspaceTask['priority'] }) { return <span className={`tw-priority tw-priority-${value}`}>{priorityLabels[value]}</span> }
export function TaskPersonBadge({ id, snapshot }: { id: string | null; snapshot: TaskWorkspaceSnapshot }) {
  const person = snapshot.people.find(person => person.id === id)
  return person ? <span className="tw-person"><Avatar size={25} style={{ background: person.color }} src={person.avatar || undefined}>{person.name.slice(0, 1)}</Avatar><span>{person.name}</span></span> : <span className="tw-muted"><UserOutlined /> 未指定</span>
}
export function taskDateLabel(value: string | null): string {
  if (!value) return '未设置'
  const date = dayjs(value), today = dayjs().startOf('day')
  const diff = date.startOf('day').diff(today, 'day')
  const label = diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : date.format('M月D日')
  return value.length > 10 ? `${label} ${date.format('HH:mm')}` : label
}
export function TaskDateControl({ task, onChange, compact }: { task: WorkspaceTask; onChange: (patch: Partial<WorkspaceTask>) => void; compact?: 'startDate' | 'dueDate' }) {
  const [open, setOpen] = useState(false), [custom, setCustom] = useState(false)
  const [start, setStart] = useState(task.startDate), [due, setDue] = useState(task.dueDate), [timed, setTimed] = useState(Boolean(task.dueDate && task.dueDate.length > 10))
  const [reminder, setReminder] = useState(task.reminderMinutes), [rule, setRule] = useState<TaskRecurrence | null>(task.recurrence)
  const [month, setMonth] = useState(() => dayjs(task.dueDate || task.startDate || undefined).startOf('month')), [endpoint, setEndpoint] = useState<'start' | 'due'>('start')
  const [interval, setIntervalValue] = useState(1), [unit, setUnit] = useState<TaskRecurrence['unit']>('day')
  useEffect(() => { if (open) { setStart(task.startDate); setDue(task.dueDate); setTimed(Boolean(task.dueDate && task.dueDate.length > 10)); setReminder(task.reminderMinutes); setRule(task.recurrence) } }, [open])
  const dateValue = (value: dayjs.Dayjs | null) => value ? timed ? value.toISOString() : value.format('YYYY-MM-DD') : null
  const setRepeat = (value: string) => { if (value === 'custom') { setCustom(true); return } setRule(value === 'none' ? null : { unit: value as TaskRecurrence['unit'], interval: 1, anchor: due || dayjs().format('YYYY-MM-DD'), timezone: task.timezone }) }
  const apply = () => { onChange({ startDate: start, dueDate: due, reminderMinutes: reminder, recurrence: rule ? { ...rule, anchor: task.recurrence && task.dueDate === due ? task.recurrence.anchor : due! } : null }); setOpen(false) }
  return <><Popover trigger="click" open={open} onOpenChange={setOpen} placement="bottomLeft" content={<div className="tw-date-popover">
    <div className="tw-date-calendar-heading"><strong>{month.format('YYYY年 M月')}</strong><Button type="text" aria-label="上个月" onClick={() => setMonth(month.subtract(1, 'month'))}>‹</Button><Button type="text" aria-label="下个月" onClick={() => setMonth(month.add(1, 'month'))}>›</Button></div>
    <div className="tw-date-calendar">{['日', '一', '二', '三', '四', '五', '六'].map(day => <small key={day}>{day}</small>)}{Array.from({ length: 42 }, (_, index) => { const day = month.startOf('week').add(index, 'day'), date = day.format('YYYY-MM-DD'), selected = date === start?.slice(0, 10) || date === due?.slice(0, 10), between = start && due && date > start.slice(0, 10) && date < due.slice(0, 10); return <button key={date} className={`${selected ? 'is-selected' : ''} ${between ? 'is-between' : ''} ${day.isSame(dayjs(), 'day') ? 'is-today' : ''} ${day.month() !== month.month() ? 'tw-muted' : ''}`} aria-label={date} onClick={() => { if (endpoint === 'start') { setStart(dateValue(day)); if (due && date > due.slice(0, 10)) setDue(null); setEndpoint('due') } else if (start && date < start.slice(0, 10)) { setStart(dateValue(day)); setEndpoint('due') } else { setDue(dateValue(day)); setEndpoint('start') } }}>{day.date()}</button> })}</div>
    <input aria-label="开始日期" className="tw-date-input" type={timed ? 'datetime-local' : 'date'} value={start ? dayjs(start).format(timed ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD') : ''} onFocus={() => setEndpoint('start')} onChange={event => setStart(event.target.value ? dateValue(dayjs(event.target.value)) : null)} />
    <input aria-label="截止日期" className="tw-date-input" type={timed ? 'datetime-local' : 'date'} value={due ? dayjs(due).format(timed ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD') : ''} onFocus={() => setEndpoint('due')} onChange={event => setDue(event.target.value ? dateValue(dayjs(event.target.value)) : null)} />
    <Checkbox checked={timed} onChange={event => { setTimed(event.target.checked); if (event.target.checked) { setStart(start ? dayjs(start).hour(9).toISOString() : null); setDue(due ? dayjs(due).hour(18).toISOString() : null) } else { setStart(start ? dayjs(start).format('YYYY-MM-DD') : null); setDue(due ? dayjs(due).format('YYYY-MM-DD') : null) } }}>具体时间</Checkbox>
    <Space><ClockCircleOutlined /><Select aria-label="到期提醒" value={reminder ?? -1} onChange={value => setReminder(value < 0 ? null : value)} options={[[-1, '不提醒'], [0, '到期时提醒'], [5, '提前 5 分钟'], [30, '提前 30 分钟'], [60, '提前 1 小时'], [1440, '提前 1 天']].map(([value, label]) => ({ value: value as number, label }))} style={{ width: 190 }} /></Space>
    <Space><RetweetOutlined /><Select aria-label="重复规则" value={rule ? rule.interval === 1 ? rule.unit : 'custom' : 'none'} onChange={setRepeat} options={[['none', '不重复'], ['day', '每天重复'], ['week', '每周重复'], ['month', '每月重复'], ['year', '每年重复'], ['workday', '每个工作日重复'], ['custom', '自定义重复']].map(([value, label]) => ({ value, label }))} style={{ width: 190 }} /></Space>
    {rule ? <small>完成后生成下一条 · 每 {rule.interval} {({ day: '天', week: '周', month: '月', year: '年', workday: '工作日' })[rule.unit]}</small> : null}
    <Space style={{ justifyContent: 'space-between' }}><Button type="text" onClick={() => { onChange({ startDate: null, dueDate: null, recurrence: null, reminderMinutes: null }); setOpen(false) }}>全部清除</Button><Button type="primary" disabled={Boolean(rule && !due) || Boolean(start && due && start > due)} onClick={apply}>确定</Button></Space>
  </div>}><button className="tw-plain tw-date-button" aria-label="设置起止日期"><CalendarOutlined /> {compact ? taskDateLabel(task[compact]) : task.startDate || task.dueDate ? `${taskDateLabel(task.startDate)} — ${taskDateLabel(task.dueDate)}` : '设置起止日期'}</button></Popover>
    <Modal zIndex={1200} title="自定义重复" open={custom} onCancel={() => setCustom(false)} onOk={() => { setRule({ unit, interval, anchor: due || dayjs().format('YYYY-MM-DD'), timezone: task.timezone }); setCustom(false) }}><Space style={{ paddingBlock: 30 }}>重复频率：<InputNumber min={1} max={999} value={interval} onChange={value => setIntervalValue(value || 1)} /><Select value={unit} onChange={setUnit} options={[['day', '天'], ['week', '周'], ['month', '月'], ['year', '年'], ['workday', '工作日']].map(([value, label]) => ({ value, label }))} style={{ width: 100 }} /></Space></Modal>
  </>
}

export function TaskFieldEditor({ field, value, snapshot, onChange }: { field: TaskField; value: TaskValue; snapshot: TaskWorkspaceSnapshot; onChange: (value: TaskValue) => void }) {
  if (field.type === 'single' || field.type === 'multi') return <Select<string | string[]> aria-label={field.title} allowClear mode={field.type === 'multi' ? 'multiple' : undefined} value={value == null ? undefined : value as string | string[]} onChange={value => onChange(value ?? null)} options={field.options.map(option => ({ value: option.id, label: <Tag color={option.color}>{option.label}</Tag> }))} style={{ minWidth: 130, width: '100%' }} />
  if (field.type === 'person') return <Select aria-label={field.title} mode="multiple" value={Array.isArray(value) ? value : []} onChange={onChange} options={snapshot.people.map(person => ({ value: person.id, label: person.name }))} style={{ minWidth: 130, width: '100%' }} />
  if (field.type === 'number') return <InputNumber aria-label={field.title} value={typeof value === 'number' ? value : null} onChange={onChange} style={{ width: '100%' }} />
  if (field.type === 'date') return <DatePicker aria-label={field.title} value={typeof value === 'string' ? dayjs(value) : null} onChange={date => onChange(date?.format('YYYY-MM-DD') ?? null)} />
  return <Input aria-label={field.title} defaultValue={String(value ?? '')} key={String(value)} onBlur={event => { if (event.target.value !== String(value ?? '')) onChange(event.target.value) }} onPressEnter={event => event.currentTarget.blur()} />
}

export function TaskFilterEditor({ filters, snapshot, onChange, deferred = false }: { filters: TaskFilter[]; snapshot: TaskWorkspaceSnapshot; onChange: (filters: TaskFilter[]) => void; deferred?: boolean }) {
  const [draft, setDraft] = useState(filters)
  useEffect(() => setDraft(filters), [filters])
  const active = deferred ? draft : filters
  const change = (value: TaskFilter[]) => { setDraft(value); if (!deferred) onChange(value) }
  const patch = (index: number, value: Partial<TaskFilter>) => change(active.map((item, n) => n === index ? { ...item, ...value } : item))
  const fields = [{ value: 'title', label: '任务标题' }, { value: 'description', label: '任务描述' }, ...taskBuiltinFields.map(([value, label]) => ({ value, label: String(label) })), { value: 'done', label: '是否完成' }, { value: '_overdue', label: '是否逾期' }, ...snapshot.fields.map(field => ({ value: field.id, label: field.title }))]
  function valueControl(filter: TaskFilter, index: number) {
    const field = snapshot.fields.find(field => field.id === filter.field)
    let options: { value: string; label: string }[] | null = null
    if (['ownerId', 'creatorId', 'assignerId'].includes(filter.field) || field?.type === 'person') options = snapshot.people.map(person => ({ value: person.id, label: person.name }))
    else if (filter.field === 'projectIds') options = snapshot.projects.map(project => ({ value: project.id, label: project.name }))
    else if (filter.field === 'lists') options = snapshot.lists.map(list => ({ value: list.id, label: list.title }))
    else if (filter.field === 'priority') options = Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))
    else if (filter.field === 'source') options = [{ value: 'local', label: '本地创建' }, { value: 'repeat', label: '重复任务' }, { value: 'template', label: '清单模板' }]
    else if (field?.type === 'single' || field?.type === 'multi') options = field.options.map(option => ({ value: option.id, label: option.label }))
    if (['done', 'starred', '_overdue'].includes(filter.field)) return <Select aria-label="筛选值" value={String(filter.value)} options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]} onChange={value => patch(index, { value: value === 'true' })} style={{ width: 130 }} />
    if (options) return <Select aria-label="筛选值" showSearch optionFilterProp="label" value={String(filter.value ?? '') || undefined} options={options} onChange={value => patch(index, { value })} style={{ width: 130 }} />
    if (field?.type === 'number') return <InputNumber aria-label="筛选值" value={typeof filter.value === 'number' ? filter.value : null} onChange={value => patch(index, { value })} style={{ width: 130 }} />
    if (field?.type === 'date' || ['startDate', 'dueDate'].includes(filter.field)) return <DatePicker aria-label="筛选值" value={typeof filter.value === 'string' && filter.value ? dayjs(filter.value) : null} onChange={date => patch(index, { value: date?.format('YYYY-MM-DD') ?? null })} />
    return <Input aria-label="筛选值" value={String(filter.value ?? '')} onChange={event => patch(index, { value: event.target.value })} style={{ width: 130 }} />
  }
  return <div className="tw-filter-editor">{active.map((filter, index) => <Space key={index} align="start"><Select aria-label="筛选字段" value={filter.field} options={fields} onChange={field => patch(index, { field, value: null })} style={{ width: 130 }} /><Select aria-label="筛选条件" value={filter.operator} options={[['eq', '等于'], ['ne', '不等于'], ['contains', '包含'], ['gt', '大于'], ['lt', '小于'], ['empty', '为空']].map(([value, label]) => ({ value, label }))} onChange={operator => patch(index, { operator })} style={{ width: 105 }} />{filter.operator === 'empty' ? null : valueControl(filter, index)}<Button aria-label="删除筛选条件" onClick={() => change(active.filter((_, n) => n !== index))}>×</Button></Space>)}<Button type="text" onClick={() => change([...active, { field: 'title', operator: 'contains', value: '' }])}>＋ 添加条件（同时满足）</Button>{deferred ? <Space><Button onClick={() => { change([]); onChange([]) }}>清除筛选</Button><Button type="primary" onClick={() => onChange(draft)}>应用</Button></Space> : null}</div>
}

export function sanitizeTaskHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const element of Array.from(doc.body.querySelectorAll('*'))) {
    if (!['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'P', 'BR', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN'].includes(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue }
    for (const attribute of Array.from(element.attributes)) if (!(element.tagName === 'A' && attribute.name === 'href' && /^(https?:|mailto:)/i.test(attribute.value))) element.removeAttribute(attribute.name)
    if (element.tagName === 'A') { element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer') }
  }
  return doc.body.innerHTML
}
export function TaskRichText({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null), [link, setLink] = useState(false), [href, setHref] = useState('')
  const range = useRef<Range | null>(null)
  useEffect(() => { if (editor.current && document.activeElement !== editor.current) editor.current.innerHTML = sanitizeTaskHtml(value) }, [value])
  const execute = (command: string, argument?: string) => { editor.current?.focus(); document.execCommand(command, false, argument); if (editor.current) onChange(sanitizeTaskHtml(editor.current.innerHTML)) }
  return <div className="tw-rich-editor"><div ref={editor} role="textbox" aria-label="任务描述" aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder="添加描述" onBlur={() => { if (editor.current) { const html = sanitizeTaskHtml(editor.current.innerHTML); if (html !== value) onChange(html) } }} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')) }} /><div className="tw-rich-toolbar">{[['bold', 'B', '加粗'], ['strikeThrough', 'S', '删除线'], ['italic', 'I', '斜体'], ['underline', 'U', '下划线'], ['insertOrderedList', '☷', '有序列表'], ['insertUnorderedList', '☷', '无序列表'], ['formatBlock', '❝', '引用']].map(([command, label, title]) => <Tooltip title={title} key={command}><button aria-label={title} onMouseDown={event => event.preventDefault()} onClick={() => execute(command, command === 'formatBlock' ? 'blockquote' : undefined)}>{label}</button></Tooltip>)}<Button type="text" aria-label="添加链接" icon={<LinkOutlined />} onMouseDown={event => { event.preventDefault(); const selection = window.getSelection(); range.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null }} onClick={() => setLink(true)} /><Button type="text" aria-label="插入表情" icon={<SmileOutlined />} onMouseDown={event => event.preventDefault()} onClick={() => execute('insertText', '🙂')} /></div><Modal zIndex={1200} open={link} title="添加链接" onCancel={() => setLink(false)} onOk={() => { if (/^https?:\/\//i.test(href)) { editor.current?.focus(); const selection = window.getSelection(); selection?.removeAllRanges(); if (range.current) selection?.addRange(range.current); execute('createLink', href); setLink(false) } }}><Input value={href} onChange={event => setHref(event.target.value)} placeholder="https://" /></Modal></div>
}

export function TaskAttachmentImage({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let active = true; void window.forgeDesk.readTaskAttachment(id).then(value => { if (active) setUrl(value) }).catch(() => undefined); return () => { active = false } }, [id])
  return url ? <img src={url} alt={alt} /> : <PaperClipOutlined />
}
export function taskSave(task: WorkspaceTask, patch: Partial<WorkspaceTask>) { return sendTaskCommand({ type: 'save-task', input: { id: task.id, ...patch }, expectedVersion: task.rowVersion }) }
