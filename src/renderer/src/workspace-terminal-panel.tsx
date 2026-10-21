import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons'
import { Button, Space, Tooltip, Typography } from 'antd'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

const heightStorageKey = 'forgedesk.workspace-terminal-height'
const minimumHeight = 160

type Props = {
  visible: boolean
  children: ReactNode
  onHide: () => void
  onOpenRemote: () => void
}

export function WorkspaceTerminalPanel({ visible, children, onHide, onOpenRemote }: Props): JSX.Element {
  const [height, setHeight] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(heightStorageKey))
      if (Number.isFinite(saved) && saved >= minimumHeight) return saved
    } catch { /* Use the default size when storage is unavailable. */ }
    return 290
  })
  const [maximumHeight, setMaximumHeight] = useState(minimumHeight)
  const [fullscreen, setFullscreen] = useState(false)
  const [resizing, setResizing] = useState(false)
  const hostRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ pointerId: number; y: number; height: number } | null>(null)
  const displayedHeight = Math.min(height, maximumHeight)
  const fullscreenLabel = fullscreen ? '还原终端' : '全屏终端'

  useEffect(() => {
    const parent = hostRef.current?.parentElement
    if (!parent) return
    // Keep the 46px toolbar and at least 120px of the page visible while docked.
    const updateBounds = () => setMaximumHeight(Math.max(minimumHeight, parent.clientHeight - 46 - 120))
    updateBounds()
    const observer = new ResizeObserver(updateBounds)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (resizing) return
    try { localStorage.setItem(heightStorageKey, String(height)) } catch { /* Size changes still work without storage. */ }
  }, [height, resizing])

  function finishResize(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <section
      ref={hostRef}
      aria-label="终端面板"
      className={`workspace-terminal-host${fullscreen ? ' is-fullscreen' : ''}${resizing ? ' is-resizing' : ''}`}
      hidden={!visible}
      style={fullscreen ? undefined : { height: displayedHeight }}
    >
      <div
        className="workspace-terminal-resize-handle"
        title="上下拖动或使用方向键调整终端高度"
        role="separator"
        aria-label="调整终端高度"
        aria-controls="workspace-terminal-content"
        aria-orientation="horizontal"
        aria-valuemin={minimumHeight}
        aria-valuemax={maximumHeight}
        aria-valuenow={displayedHeight}
        tabIndex={fullscreen ? -1 : 0}
        hidden={fullscreen}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          dragRef.current = { pointerId: event.pointerId, y: event.clientY, height: displayedHeight }
          setResizing(true)
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (drag?.pointerId !== event.pointerId) return
          setHeight(Math.max(minimumHeight, Math.min(maximumHeight, drag.height + drag.y - event.clientY)))
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onLostPointerCapture={finishResize}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 80 : 20
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const nextHeight = event.key === 'Home' ? minimumHeight : event.key === 'End' ? maximumHeight : displayedHeight + (event.key === 'ArrowUp' ? step : -step)
          setHeight(Math.max(minimumHeight, Math.min(maximumHeight, nextHeight)))
        }}
      />
      <div className="workspace-terminal-heading" onDoubleClick={() => setFullscreen((current) => !current)}>
        <Typography.Text strong>终端 · 导航切换时保持运行</Typography.Text>
        <Space onDoubleClick={(event) => event.stopPropagation()}>
          <Button size="small" onClick={onOpenRemote}>远程连接</Button>
          <Tooltip title={fullscreenLabel}>
            <Button size="small" aria-label={fullscreenLabel} aria-pressed={fullscreen} icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setFullscreen((current) => !current)}>
              {fullscreen ? '还原' : '全屏'}
            </Button>
          </Tooltip>
          <Button size="small" onClick={() => { setFullscreen(false); onHide() }}>收起</Button>
        </Space>
      </div>
      <div className="workspace-terminal-body" id="workspace-terminal-content">{children}</div>
    </section>
  )
}
