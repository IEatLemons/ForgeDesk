import {
  CloseOutlined,
  CodeOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { Button, Empty, Space, Tooltip, Typography, message } from 'antd'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@xterm/xterm/css/xterm.css'
import { getErrorMessage as getNormalizedErrorMessage } from './error-messages'
import type { TerminalOpenRequest } from './terminal-panel-events'
import {
  closeTerminalTab,
  createTerminalPanelState,
  markTerminalTabExited,
  upsertTerminalTab,
  type TerminalPanelSession,
  type TerminalPanelState
} from './terminal-panel-state'

type TerminalHandle = {
  terminal: Terminal
  fitAddon: FitAddon
}

type TerminalWorkspaceProps = {
  defaultCwd?: string
  defaultTitle?: string
  openRequest?: TerminalOpenRequest | null
}

type TerminalPaneProps = {
  active: boolean
  session: TerminalPanelSession
  onDispose: (sessionId: string) => void
  onReady: (sessionId: string, handle: TerminalHandle) => void
  onResize: (sessionId: string, cols: number, rows: number) => void
  onWriteError: (error: unknown) => void
}

function getErrorMessage(error: unknown): string {
  return getNormalizedErrorMessage(error, '终端操作失败')
}

function TerminalPane({ active, session, onDispose, onReady, onResize, onWriteError }: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalRef = useRef<Terminal | null>(null)

  const fitAndReport = useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    if (!terminal || !fitAddon) {
      return
    }

    try {
      fitAddon.fit()
      onResize(session.id, terminal.cols, terminal.rows)
    } catch {
      // xterm can throw while the pane is hidden or before fonts settle.
    }
  }, [onResize, session.id])

  useEffect(() => {
    const container = containerRef.current

    if (!container || !window.forgeDesk) {
      return
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 1.2,
      macOptionIsMeta: true,
      scrollback: 6000,
      theme: {
        background: '#101318',
        black: '#111827',
        blue: '#60a5fa',
        brightBlack: '#6b7280',
        brightBlue: '#93c5fd',
        brightCyan: '#67e8f9',
        brightGreen: '#86efac',
        brightMagenta: '#f0abfc',
        brightRed: '#fca5a5',
        brightWhite: '#ffffff',
        brightYellow: '#fde68a',
        cursor: '#f8fafc',
        cyan: '#22d3ee',
        foreground: '#d8dee9',
        green: '#4ade80',
        magenta: '#d946ef',
        red: '#f87171',
        selectionBackground: '#334155',
        white: '#e5e7eb',
        yellow: '#facc15'
      }
    })
    const fitAddon = new FitAddon()
    const inputDisposable = terminal.onData((data) => {
      window.forgeDesk.writeTerminal(session.id, data).catch(onWriteError)
    })
    let resizeFrame = 0
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(fitAndReport)
    })

    terminal.loadAddon(fitAddon)
    terminal.open(container)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    resizeObserver.observe(container)
    onReady(session.id, { terminal, fitAddon })
    resizeFrame = window.requestAnimationFrame(fitAndReport)

    return () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      inputDisposable.dispose()
      onDispose(session.id)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [fitAndReport, onDispose, onReady, onWriteError, session.id])

  useEffect(() => {
    if (!active) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      fitAndReport()
      terminalRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [active, fitAndReport])

  return <div ref={containerRef} className={`terminal-pane${active ? ' is-active' : ''}`} aria-hidden={!active} />
}

function getActiveTerminalTab(state: TerminalPanelState): TerminalPanelSession | null {
  return state.tabs.find((tab) => tab.id === state.activeSessionId) ?? state.tabs[0] ?? null
}

function getTerminalRequestKey(request: TerminalOpenRequest): string {
  if (request.requestId !== undefined) {
    return `id:${request.requestId}`
  }

  return `value:${request.projectId ?? ''}:${request.repositoryId ?? ''}:${request.cwd ?? ''}:${request.reuseKey ?? ''}:${request.title ?? ''}`
}

export function TerminalWorkspace({ defaultCwd, defaultTitle, openRequest }: TerminalWorkspaceProps): JSX.Element {
  const [state, setState] = useState<TerminalPanelState>(() => createTerminalPanelState())
  const handledOpenRequestKeyRef = useRef<string | null>(null)
  const pendingOutputRef = useRef(new Map<string, string[]>())
  const terminalHandlesRef = useRef(new Map<string, TerminalHandle>())
  const activeTab = useMemo(() => getActiveTerminalTab(state), [state])

  const reportError = useCallback((error: unknown) => {
    message.error(getErrorMessage(error))
  }, [])

  const resizeTerminal = useCallback((sessionId: string, cols: number, rows: number) => {
    window.forgeDesk?.resizeTerminal(sessionId, cols, rows).catch(() => undefined)
  }, [])

  const disposeTerminal = useCallback((sessionId: string) => {
    terminalHandlesRef.current.delete(sessionId)
    pendingOutputRef.current.delete(sessionId)
  }, [])

  const registerTerminal = useCallback((sessionId: string, handle: TerminalHandle) => {
    terminalHandlesRef.current.set(sessionId, handle)

    const pendingOutput = pendingOutputRef.current.get(sessionId)
    if (pendingOutput) {
      for (const chunk of pendingOutput) {
        handle.terminal.write(chunk)
      }
      pendingOutputRef.current.delete(sessionId)
    }
  }, [])

  const openTerminal = useCallback(
    async (request: TerminalOpenRequest = {}) => {
      if (!window.forgeDesk) {
        return
      }

      try {
        const session = await window.forgeDesk.openTerminal({
          cols: 80,
          cwd: request.cwd ?? defaultCwd,
          reuseKey: request.reuseKey,
          rows: 24,
          title: request.title ?? defaultTitle
        })
        setState((current) => upsertTerminalTab(current, session))
      } catch (error) {
        reportError(error)
      }
    },
    [defaultCwd, defaultTitle, reportError]
  )

  useEffect(() => {
    if (!openRequest) {
      return
    }

    const requestKey = getTerminalRequestKey(openRequest)

    if (handledOpenRequestKeyRef.current === requestKey) {
      return
    }

    handledOpenRequestKeyRef.current = requestKey
    openTerminal(openRequest).catch(reportError)
  }, [openRequest, openTerminal, reportError])

  useEffect(() => {
    if (!window.forgeDesk) {
      return
    }

    const unsubscribeData = window.forgeDesk.onTerminalData((event) => {
      const handle = terminalHandlesRef.current.get(event.sessionId)

      if (handle) {
        handle.terminal.write(event.data)
        return
      }

      const pendingOutput = pendingOutputRef.current.get(event.sessionId) ?? []
      pendingOutput.push(event.data)
      pendingOutputRef.current.set(event.sessionId, pendingOutput)
    })
    const unsubscribeExit = window.forgeDesk.onTerminalExit((event) => {
      setState((current) => markTerminalTabExited(current, event.sessionId, event.exitCode, event.signal))
    })

    return () => {
      unsubscribeData()
      unsubscribeExit()
    }
  }, [])

  const closeTab = useCallback(
    async (sessionId: string) => {
      try {
        await window.forgeDesk?.closeTerminal(sessionId)
      } catch (error) {
        reportError(error)
      } finally {
        setState((current) => closeTerminalTab(current, sessionId))
      }
    },
    [reportError]
  )

  const restartActiveTab = useCallback(async () => {
    const tab = activeTab

    if (!tab) {
      await openTerminal()
      return
    }

    if (!tab.exited) {
      try {
        await window.forgeDesk?.closeTerminal(tab.id)
      } catch {
        // The session may already be gone; restarting should still create a fresh terminal.
      }
      setState((current) => closeTerminalTab(current, tab.id))
    }

    await openTerminal({ cwd: tab.cwd, reuseKey: tab.reuseKey, title: tab.title })
  }, [activeTab, openTerminal])

  const hasTabs = state.tabs.length > 0

  return (
    <section className="terminal-workspace" aria-label="项目终端">
      <div className="terminal-workspace-header">
        <div className="terminal-tab-list" role="tablist" aria-label="终端会话">
          {hasTabs ? (
            state.tabs.map((tab) => (
              <div
                aria-selected={tab.id === state.activeSessionId}
                className={`terminal-tab${tab.id === state.activeSessionId ? ' is-active' : ''}${tab.exited ? ' is-exited' : ''}`}
                key={tab.id}
                role="tab"
              >
                <button
                  className="terminal-tab-main"
                  onClick={() => setState((current) => ({ ...current, activeSessionId: tab.id }))}
                  type="button"
                >
                  <CodeOutlined />
                  <span>{tab.title}</span>
                  {tab.exited ? <span className="terminal-tab-status">退出</span> : null}
                </button>
                <button
                  aria-label={`关闭 ${tab.title}`}
                  className="terminal-tab-close"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTab(tab.id).catch(reportError)
                  }}
                  type="button"
                >
                  <CloseOutlined />
                </button>
              </div>
            ))
          ) : (
            <Typography.Text className="terminal-workspace-title">终端</Typography.Text>
          )}
        </div>
        <Space size={4} className="terminal-workspace-actions">
          <Tooltip title="新建终端">
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => openTerminal().catch(reportError)} />
          </Tooltip>
          <Tooltip title="重启终端">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => restartActiveTab().catch(reportError)} />
          </Tooltip>
        </Space>
      </div>
      <div className="terminal-workspace-body">
        {hasTabs ? (
          state.tabs.map((tab) => (
            <TerminalPane
              active={tab.id === state.activeSessionId}
              key={tab.id}
              onDispose={disposeTerminal}
              onReady={registerTerminal}
              onResize={resizeTerminal}
              onWriteError={reportError}
              session={tab}
            />
          ))
        ) : (
          <div className="terminal-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无终端会话">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openTerminal().catch(reportError)}>
                新建终端
              </Button>
            </Empty>
          </div>
        )}
      </div>
    </section>
  )
}
