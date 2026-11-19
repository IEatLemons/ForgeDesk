import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Button, Popover, Tooltip } from 'antd'
import { gitGraphLayoutEvent, gitGraphLayoutKey, normalizeGraphWidth, graphParentPath } from './git-graph-preferences'
import { getGitGraphLayout, getGraphCellBottomLaneIndexes, getGraphLaneColor, type BranchColoredGitGraphRow, type GitGraphLayout, type GraphCommitInput } from './git-log-view'

function readWidth(): number | null {
  try { return normalizeGraphWidth(JSON.parse(localStorage.getItem(gitGraphLayoutKey) ?? '{}').graphWidth) } catch { return null }
}
export function useGitGraphLayout(rows: BranchColoredGitGraphRow[], context: string, repositoryId: string) {
  const [preferredWidth, setPreferredWidth] = useState(readWidth)
  const [focus, setFocus] = useState({ repositoryId, enabled: false })
  useEffect(() => setFocus({ repositoryId, enabled: false }), [repositoryId])
  const highWater = useRef({ context, width: 0 })
  const [reset, setReset] = useState(0)
  const key = `${context}:${reset}`
  if (highWater.current.context !== key) highWater.current = { context: key, width: 0 }
  const layout = useMemo(() => getGitGraphLayout(rows, { preferredWidth, minimumWidth: preferredWidth === null ? highWater.current.width : 0 }), [rows, preferredWidth, key])
  highWater.current.width = layout.columnWidth
  const saveWidth = useCallback((value: number | null) => {
    const graphWidth = normalizeGraphWidth(value)
    setPreferredWidth(graphWidth)
    if (value === null) setReset(count => count + 1)
    try { localStorage.setItem(gitGraphLayoutKey, JSON.stringify({ graphWidth })); window.dispatchEvent(new Event(gitGraphLayoutEvent)) } catch { /* UI preference is best effort. */ }
  }, [])
  useEffect(() => {
    const update = () => { setPreferredWidth(readWidth()); setReset(count => count + 1) }
    const storage = (event: StorageEvent) => { if (event.key === gitGraphLayoutKey || event.key === null) update() }
    window.addEventListener(gitGraphLayoutEvent, update); window.addEventListener('storage', storage)
    return () => { window.removeEventListener(gitGraphLayoutEvent, update); window.removeEventListener('storage', storage) }
  }, [])
  return { layout, preferredWidth, saveWidth, focused: focus.repositoryId === repositoryId && focus.enabled, setFocused: (enabled: boolean) => setFocus({ repositoryId, enabled }) }
}

type HeaderProps = HTMLAttributes<HTMLTableCellElement> & { graphLayout?: GitGraphLayout; onGraphResize?: (width: number | null) => void; graphWidthPreference?: number | null }
export function GitGraphHeader({ graphLayout, onGraphResize, graphWidthPreference, children, ...props }: HeaderProps) {
  const cleanup = useRef<(() => void) | undefined>()
  const [dragging, setDragging] = useState(false)
  useEffect(() => () => cleanup.current?.(), [])
  if (!graphLayout || !onGraphResize) return <th {...props}>{children}</th>
  const { minimumWidth, maximumWidth, columnWidth } = graphLayout
  const resize = (width: number) => onGraphResize(Math.max(minimumWidth, Math.min(maximumWidth, width)))
  return <th {...props}>{children}<Tooltip title="拖动调整图谱宽度；方向键微调；双击恢复自动">
    <button type="button" role="separator" aria-label="调整图谱宽度" aria-orientation="vertical" aria-valuemin={minimumWidth} aria-valuemax={maximumWidth} aria-valuenow={Math.round(columnWidth)} className={`git-graph-resize${dragging ? ' is-dragging' : ''}`} onDoubleClick={() => onGraphResize(null)} onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); resize(columnWidth + (event.key === 'ArrowRight' ? 10 : -10)) }
      if (event.key === 'Home') { event.preventDefault(); onGraphResize(null) }
    }} onPointerDown={event => {
      if (event.button !== 0) return
      cleanup.current?.(); event.preventDefault(); event.stopPropagation()
      const start = event.clientX, previous = graphWidthPreference ?? null, previousSelect = document.body.style.userSelect
      setDragging(true); document.body.style.userSelect = 'none'
      const move = (next: PointerEvent) => resize(columnWidth + next.clientX - start)
      const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key); document.body.style.userSelect = previousSelect; setDragging(false); cleanup.current = undefined }
      const cancel = () => { onGraphResize(previous); end() }
      const key = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel() } }
      cleanup.current = end
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel); window.addEventListener('keydown', key)
    }} />
  </Tooltip></th>
}

export function GitGraphScroll({ children, width }: { children: ReactNode; width: number }) {
  const root = useRef<HTMLDivElement>(null), top = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState({ content: 0, viewport: 0 })
  useLayoutEffect(() => {
    const frame = root.current, bar = top.current
    const content = frame?.querySelector<HTMLElement>('.source-tree-table > .ant-spin-nested-loading .ant-table-content')
    if (!frame || !bar || !content) return
    const update = () => setSizes(previous => previous.content === content.scrollWidth && previous.viewport === content.clientWidth ? previous : { content: content.scrollWidth, viewport: content.clientWidth })
    const fromTop = () => { if (Math.abs(content.scrollLeft - bar.scrollLeft) > 1) content.scrollLeft = bar.scrollLeft }
    const fromContent = () => { if (Math.abs(bar.scrollLeft - content.scrollLeft) > 1) bar.scrollLeft = content.scrollLeft }
    const observer = new ResizeObserver(update)
    observer.observe(content); const table = content.querySelector('table'); if (table) observer.observe(table)
    bar.addEventListener('scroll', fromTop); content.addEventListener('scroll', fromContent); update(); fromContent()
    return () => { observer.disconnect(); bar.removeEventListener('scroll', fromTop); content.removeEventListener('scroll', fromContent) }
  }, [width])
  return <div ref={root} className="git-graph-scroll-frame"><div ref={top} role="region" tabIndex={0} aria-label="提交树横向滚动" className="git-graph-top-scroll" style={{ width: sizes.viewport || undefined }} hidden={sizes.content <= sizes.viewport + 1}><div style={{ width: sizes.content, height: 1 }} /></div>{children}</div>
}

type GraphCommit = GraphCommitInput & { isWorkingTreeCommit?: boolean; message?: string }
export const CommitGraphCell = memo(function CommitGraphCell({ commit, layout, active, origin, inspected, relationContent, onDismiss, onInspect, onHighlight }: { commit: BranchColoredGitGraphRow<GraphCommit>; layout: GitGraphLayout; active: boolean; origin: boolean; inspected: boolean; relationContent: ReactNode; onDismiss: () => void; onInspect: (hash: string) => void; onHighlight: (hash: string) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(46)
  const [tipOpen, setTipOpen] = useState(false)
  useLayoutEffect(() => {
    if (!root.current) return
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.height; if (next) setHeight(previous => Math.abs(previous - next) > .5 ? next : previous) })
    observer.observe(root.current); return () => observer.disconnect()
  }, [])
  const middle = height / 2, bottom = getGraphCellBottomLaneIndexes(commit), bottomSet = new Set(bottom)
  const x = (lane: number) => layout.laneOffset + lane * layout.laneWidth
  const color = (lane: number) => commit.isWorkingTreeCommit ? '#98a2b3' : commit.graphLaneColors[lane] ?? getGraphLaneColor(lane)
  const missing = commit.graphHiddenParentHashes.length
  return <div ref={root} className={`commit-graph-cell${commit.isWorkingTreeCommit ? ' is-working-tree' : ''}${active ? ' is-related' : ''}${origin ? ' is-origin' : ''}`} onMouseEnter={() => onHighlight(commit.hash)} onMouseLeave={() => onHighlight('')}>
    <svg aria-hidden="true" className="commit-graph-svg" width={layout.columnWidth} height="100%">
      {commit.graphTopLaneIndexes.map(lane => <line key={`t${lane}`} className="commit-graph-line" stroke={color(lane)} x1={x(lane)} x2={x(lane)} y1={-2} y2={middle} />)}
      {bottom.map(lane => <line key={`b${lane}`} className={`commit-graph-line${origin && commit.graphParentEdges.some(edge => edge.fromLaneIndex === lane && edge.toLaneIndex === lane) ? ' is-parent-connection' : ''}`} stroke={color(lane)} x1={x(lane)} x2={x(lane)} y1={middle} y2={height + 2} />)}
      {commit.graphBottomLaneIndexes.filter(lane => !bottomSet.has(lane)).map(lane => <line key={`s${lane}`} className="commit-graph-line" stroke={color(lane)} x1={x(lane)} x2={x(lane)} y1={height - 2} y2={height + 2} />)}
      {commit.graphParentEdges.filter(edge => edge.fromLaneIndex !== edge.toLaneIndex).map(edge => <path key={`${edge.fromLaneIndex}-${edge.toLaneIndex}`} className="commit-graph-parent-edge" stroke={color(edge.toLaneIndex)} d={graphParentPath(x(edge.fromLaneIndex), x(edge.toLaneIndex), height)} />)}
      {missing > 0 ? <path className="commit-graph-boundary" stroke={color(commit.graphLaneIndex)} d={`M ${x(commit.graphLaneIndex) + 6} ${middle} l 12 10 l 0 8`} /> : null}
      {commit.parentHashes.length > 1 ? <rect className="commit-graph-dot merge" x={x(commit.graphLaneIndex) - 4.5} y={middle - 4.5} width={9} height={9} rx={1} transform={`rotate(45 ${x(commit.graphLaneIndex)} ${middle})`} fill={color(commit.graphLaneIndex)} stroke="#fff" /> : <circle className="commit-graph-dot" cx={x(commit.graphLaneIndex)} cy={middle} r={3.8} fill={color(commit.graphLaneIndex)} stroke="#fff" />}
    </svg>
    <Tooltip open={tipOpen && !inspected} placement="right" title={<div>{commit.parentHashes.length > 1 ? '合并提交' : commit.isWorkingTreeCommit ? '工作区' : '提交'} · {commit.parentHashes.length} 个父提交{missing ? ` · ${missing} 个在当前范围外` : ''}{commit.parentHashes.map(hash => <div key={hash}><code>{hash}</code></div>)}<div>点击查看关系</div></div>}><span aria-hidden="true" className="git-graph-tip-anchor" style={{ left: x(commit.graphLaneIndex), top: middle }} /></Tooltip>
    <Popover destroyOnHidden trigger="click" placement="rightTop" open={inspected} onOpenChange={open => open ? onInspect(commit.hash) : onDismiss()} content={relationContent}><button className="git-graph-node" style={{ left: x(commit.graphLaneIndex), top: middle }} aria-label={`查看提交关系 ${commit.hash}`} aria-description={`${commit.parentHashes.length} 个父提交：${commit.parentHashes.join('、')}${missing ? `，${missing} 个在当前范围外` : ''}`} onClick={event => { event.stopPropagation(); onInspect(commit.hash) }} onMouseEnter={() => setTipOpen(true)} onMouseLeave={() => setTipOpen(false)} onFocus={() => { onHighlight(commit.hash); setTipOpen(true) }} onBlur={() => { onHighlight(''); setTipOpen(false) }} /></Popover>
    {missing ? <button className="git-graph-boundary-label" style={{ top: Math.min(height - 17, middle + 10) }} onClick={event => { event.stopPropagation(); onInspect(commit.hash) }} aria-label={`${missing} 个父提交在当前范围外`}>范围外 {missing}</button> : null}
  </div>
})

export function GitParentRelations({ commit, rows, onLocate, onClear, onOlder, canClear, canLoadOlder }: { commit: GraphCommit | null; rows: GraphCommit[]; onLocate: (hash: string) => void; onClear: () => void; onOlder: () => void; canClear: boolean; canLoadOlder: boolean }) {
  if (!commit) return null
  const byHash = new Map(rows.map(row => [row.hash, row]))
  return <div className="git-parent-relations" onClick={event => event.stopPropagation()}><strong>{commit.parentHashes.length > 1 ? '合并提交' : '提交关系'} · {commit.parentHashes.length} 个父提交</strong>{commit.isWorkingTreeCommit ? <span>工作区尚未提交</span> : <code>{commit.hash}</code>}<p>{commit.message}</p>{commit.parentHashes.length ? commit.parentHashes.map((hash, index) => <div className="git-parent-row" key={hash}><div><span>父提交 {index + 1}</span><code>{hash}</code><small>{byHash.get(hash)?.message || '不在当前显示范围，可能被筛选或尚未加载'}</small></div>{byHash.has(hash) ? <Button size="small" onClick={() => onLocate(hash)}>定位</Button> : <span>范围外</span>}</div>) : <span>根提交，没有父提交</span>}<div className="git-parent-actions">{canClear ? <Button size="small" onClick={onClear}>清除筛选</Button> : null}{canLoadOlder ? <Button size="small" onClick={onOlder}>加载更早历史</Button> : null}</div></div>
}
