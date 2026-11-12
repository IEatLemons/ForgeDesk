import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Select, Space, Switch } from 'antd'
import dayjs from 'dayjs'
import type { WorkspaceTask } from '../../shared/task-workspace'
import { taskDateInZone } from '../../shared/task-workspace'
import { taskSave } from './task-workspace-controls'

export type TaskSection = { id: string; title: string; tasks: WorkspaceTask[] }
export function TaskWorkspaceGantt({ sections, collapsed = [], onToggle, onSelect, compact = false }: { sections: TaskSection[]; collapsed?: string[]; onToggle?: (id: string) => void; onSelect: (id: string) => void; compact?: boolean }) {
  const [scale, setScale] = useState('month'), [timeline, setTimeline] = useState(false), [center, setCenter] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [dragging, setDragging] = useState<{ id: string; days: number; mode: string } | null>(null)
  const scroll = useRef<HTMLDivElement>(null), cleanup = useRef<() => void>(), moved = useRef(false)
  useEffect(() => () => cleanup.current?.(), [])
  const cell = scale === 'day' ? 100 : scale === 'week' ? 64 : 40, days = scale === 'day' ? 14 : scale === 'week' ? 35 : 62
  const start = dayjs(center).subtract(scale === 'day' ? 3 : 7, 'day').startOf('day'), today = dayjs().startOf('day').diff(start, 'day')
  const rows = sections.flatMap(section => [{ type: 'group' as const, section }, ...(!collapsed.includes(section.id) ? section.tasks.map(task => ({ type: 'task' as const, task })) : [])])
  const taskRows = new Map(rows.flatMap((row, index) => row.type === 'task' ? [[row.task.id, index] as const] : []))
  const offset = (value: string, zone: string) => dayjs(taskDateInZone(value, zone)).diff(start, 'day')
  function begin(event: React.PointerEvent, task: WorkspaceTask, mode: 'move' | 'start' | 'end') {
    event.preventDefault(); event.stopPropagation(); cleanup.current?.(); moved.current = false
    if (!task.startDate && !task.dueDate) return
    const x = event.clientX
    let delta = 0
    const move = (event: PointerEvent) => { delta = Math.round((event.clientX - x) / cell); if (delta) moved.current = true; setDragging({ id: task.id, days: delta, mode }) }
    const end = () => { cleanup.current?.(); setDragging(null); if (!delta) return
      const shift = (value: string | null) => value ? value.length === 10 ? dayjs(value).add(delta, 'day').format('YYYY-MM-DD') : dayjs(value).add(delta, 'day').toISOString() : null
      const patch = mode === 'move' ? { startDate: shift(task.startDate), dueDate: shift(task.dueDate) } : mode === 'start' ? { startDate: shift(task.startDate || task.dueDate) } : { dueDate: shift(task.dueDate || task.startDate) }
      void taskSave(task, patch)
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end, { once: true })
    cleanup.current = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end) }
  }
  return <div className={`tw-gantt ${compact ? 'is-compact' : ''}`}><div className="tw-gantt-toolbar"><Space><Switch size="small" checked={timeline} onChange={setTimeline} /> 时间线模式</Space><Space><strong>{dayjs(center).format('YYYY年M月')}</strong><Select aria-label="甘特图时间尺度" value={scale} onChange={setScale} options={[{ value: 'day', label: '按日显示' }, { value: 'week', label: '按周显示' }, { value: 'month', label: '按月显示' }]} /><Button onClick={() => { setCenter(dayjs().format('YYYY-MM-DD')); scroll.current?.scrollTo({ left: 0 }) }}>今天</Button><Button aria-label="上一时间段" onClick={() => setCenter(dayjs(center).subtract(scale === 'month' ? 1 : 7, scale === 'month' ? 'month' : 'day').format('YYYY-MM-DD'))}>‹</Button><Button aria-label="下一时间段" onClick={() => setCenter(dayjs(center).add(scale === 'month' ? 1 : 7, scale === 'month' ? 'month' : 'day').format('YYYY-MM-DD'))}>›</Button></Space></div>
    <div className="tw-gantt-scroll" ref={scroll}><div className="tw-gantt-canvas" style={{ width: days * cell + (timeline ? 180 : 360), gridTemplateColumns: `${timeline ? 180 : 360}px ${days * cell}px` }}>
      <div className="tw-gantt-title-head">任务标题</div><div className="tw-gantt-dates">{Array.from({ length: days }, (_, index) => <span key={index} style={{ width: cell }} className={start.add(index, 'day').isSame(dayjs(), 'day') ? 'is-today' : ''}>{start.add(index, 'day').format(scale === 'day' ? 'M/D ddd' : 'D')}</span>)}</div>
      {rows.map((row, index) => row.type === 'group' ? <div className="tw-gantt-group" key={`group-${row.section.id}`} style={{ gridColumn: '1 / 3' }}><button className="tw-plain" onClick={() => onToggle?.(row.section.id)}>{collapsed.includes(row.section.id) ? '▸' : '▾'} {row.section.title} <span className="tw-muted">{row.section.tasks.length}</span></button></div> : <GanttRow key={row.task.id} task={row.task} cell={cell} index={index} days={days} offset={offset} dragging={dragging} onBegin={begin} onClick={() => { if (!moved.current) onSelect(row.task.id); moved.current = false }} />)}
      <div className="tw-gantt-lines" style={{ left: timeline ? 180 : 360, width: days * cell, height: rows.length * 52, top: 50, pointerEvents: 'none', backgroundSize: `${cell}px 100%` }}>{today >= 0 && today < days ? <div className="tw-today-line" style={{ left: (today + 0.5) * cell }} /> : null}<svg width={days * cell} height={rows.length * 52}><defs><marker id="task-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#9ba9ca" /></marker></defs>{rows.flatMap((row, index) => row.type !== 'task' || !row.task.startDate ? [] : row.task.dependencyIds.flatMap(id => { const fromIndex = taskRows.get(id), source = rows.find(item => item.type === 'task' && item.task.id === id); if (fromIndex == null || source?.type !== 'task' || !source.task.dueDate) return []; const x1 = (offset(source.task.dueDate, source.task.timezone) + 1) * cell, x2 = offset(row.task.startDate!, row.task.timezone) * cell, y1 = fromIndex * 52 + 26, y2 = index * 52 + 26; return [<path key={`${id}/${row.task.id}`} d={`M${x1},${y1} H${x1 + 12} V${y2} H${x2 - 2}`} stroke="#9ba9ca" fill="none" markerEnd="url(#task-arrow)" />] }))}</svg></div>
    </div></div></div>
}
function GanttRow({ task, cell, offset, dragging, onBegin, onClick }: { task: WorkspaceTask; cell: number; days: number; index: number; offset: (value: string, zone: string) => number; dragging: { id: string; days: number; mode: string } | null; onBegin: (event: React.PointerEvent, task: WorkspaceTask, mode: 'move' | 'start' | 'end') => void; onClick: () => void }) {
  const start = task.startDate || task.dueDate, end = task.dueDate || task.startDate
  let left = start ? offset(start, task.timezone) : 0, right = end ? offset(end, task.timezone) + 1 : 0
  if (dragging?.id === task.id) { if (dragging.mode !== 'end') left += dragging.days; if (dragging.mode !== 'start') right += dragging.days }
  return <><div className="tw-gantt-task-title"><button className={`tw-plain ${task.done ? 'is-done' : ''}`} onClick={onClick}>{task.parentId ? '↳ ' : ''}{task.title}</button></div><div className="tw-gantt-track">{start ? task.milestone ? <button aria-label={`里程碑：${task.title}`} className="tw-gantt-milestone" style={{ left: (end ? offset(end, task.timezone) : left) * cell + cell / 2 }} onClick={onClick}>◆</button> : <div className={`tw-gantt-bar ${task.done ? 'is-done' : ''}`} style={{ left: left * cell + 2, width: Math.max(12, (right - left) * cell - 4) }} onPointerDown={event => onBegin(event, task, 'move')} onClick={onClick}><span className="tw-gantt-handle" onPointerDown={event => onBegin(event, task, 'start')} /><span>{task.title}</span><small>{Math.max(1, right - left)} 天</small><span className="tw-gantt-handle" onPointerDown={event => onBegin(event, task, 'end')} /></div> : <span className="tw-muted">未安排日期</span>}</div></>
}
