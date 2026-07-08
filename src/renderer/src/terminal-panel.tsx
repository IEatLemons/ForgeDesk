import {
  CloseOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { Button, Empty, Form, Input, Modal, Popconfirm, Space, Spin, Tooltip, Typography, message } from 'antd'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@xterm/xterm/css/xterm.css'
import { getErrorMessage as getNormalizedErrorMessage } from './error-messages'
import type { ProjectTerminalCommandRecord, TerminalSessionSnapshot } from './data'
import type { TerminalOpenRequest } from './terminal-panel-events'
import {
  closeTerminalTab,
  createTerminalPanelState,
  createTerminalPanelStateFromSessions,
  filterRestorableTerminalPanelSessions,
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
  defaultReuseKey?: string
  defaultTitle?: string
  openRequest?: TerminalOpenRequest | null
  projectId?: string
}

type TerminalCommandForm = {
  name: string
  command: string
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

  return `value:${request.projectId ?? ''}:${request.repositoryId ?? ''}:${request.cwd ?? ''}:${request.reuseKey ?? ''}:${request.title ?? ''}:${request.startupCommand ?? ''}`
}

function toTerminalPanelSession(snapshot: TerminalSessionSnapshot): TerminalPanelSession {
  const { output: _output, ...session } = snapshot
  return session
}

function getTerminalFocusRequest(
  openRequest: TerminalOpenRequest | null,
  defaultCwd?: string,
  defaultReuseKey?: string
): Pick<TerminalOpenRequest, 'cwd' | 'reuseKey'> {
  if (openRequest && shouldHandleTerminalOpenRequest(openRequest, defaultCwd, defaultReuseKey)) {
    return {
      cwd: openRequest.cwd ?? defaultCwd,
      reuseKey: openRequest.reuseKey ?? defaultReuseKey
    }
  }

  return {
    cwd: defaultCwd,
    reuseKey: defaultReuseKey
  }
}

function shouldHandleTerminalOpenRequest(request: TerminalOpenRequest, defaultCwd?: string, defaultReuseKey?: string): boolean {
  if (defaultReuseKey) {
    if (request.reuseKey) {
      return request.reuseKey === defaultReuseKey
    }

    return !request.cwd || request.cwd === defaultCwd
  }

  return !defaultCwd || !request.cwd || request.cwd === defaultCwd
}

export function TerminalWorkspace({ defaultCwd, defaultReuseKey, defaultTitle, openRequest, projectId }: TerminalWorkspaceProps): JSX.Element {
  const [state, setState] = useState<TerminalPanelState>(() => createTerminalPanelState())
  const [restored, setRestored] = useState(false)
  const [commandModalOpen, setCommandModalOpen] = useState(false)
  const [projectCommands, setProjectCommands] = useState<ProjectTerminalCommandRecord[]>([])
  const [commandsLoading, setCommandsLoading] = useState(false)
  const [savingCommand, setSavingCommand] = useState(false)
  const [editingCommand, setEditingCommand] = useState<ProjectTerminalCommandRecord | null>(null)
  const [commandForm] = Form.useForm<TerminalCommandForm>()
  const handledOpenRequestKeyRef = useRef<string | null>(null)
  const latestOpenRequestRef = useRef<TerminalOpenRequest | null>(openRequest ?? null)
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
        return null
      }

      try {
        const session = await window.forgeDesk.openTerminal({
          cols: 80,
          cwd: request.cwd ?? defaultCwd,
          reuseKey: request.reuseKey ?? defaultReuseKey,
          rows: 24,
          startupCommand: request.startupCommand,
          title: request.title ?? defaultTitle
        })
        setState((current) => upsertTerminalTab(current, session))
        return session
      } catch (error) {
        reportError(error)
        return null
      }
    },
    [defaultCwd, defaultReuseKey, defaultTitle, reportError]
  )

  useEffect(() => {
    latestOpenRequestRef.current = openRequest ?? null
  }, [openRequest])

  const loadProjectCommands = useCallback(async () => {
    if (!projectId || !window.forgeDesk) {
      setProjectCommands([])
      return
    }

    setCommandsLoading(true)

    try {
      setProjectCommands(await window.forgeDesk.listProjectTerminalCommands(projectId))
    } catch (error) {
      reportError(error)
    } finally {
      setCommandsLoading(false)
    }
  }, [projectId, reportError])

  useEffect(() => {
    loadProjectCommands().catch(reportError)
  }, [loadProjectCommands, reportError])

  useEffect(() => {
    let cancelled = false

    async function restoreTerminals(): Promise<void> {
      if (!window.forgeDesk) {
        setRestored(true)
        return
      }

      setRestored(false)
      setState(createTerminalPanelState())
      pendingOutputRef.current.clear()

      try {
        const snapshots = filterRestorableTerminalPanelSessions(await window.forgeDesk.listTerminals(), { defaultCwd, defaultReuseKey })

        if (cancelled) {
          return
        }

        if (snapshots.length > 0) {
          const focusRequest = getTerminalFocusRequest(latestOpenRequestRef.current, defaultCwd, defaultReuseKey)

          for (const snapshot of snapshots) {
            if (snapshot.output.length > 0) {
              pendingOutputRef.current.set(snapshot.id, [...snapshot.output])
            }
          }
          setState(createTerminalPanelStateFromSessions(snapshots.map(toTerminalPanelSession), focusRequest))
        } else if (!latestOpenRequestRef.current || !shouldHandleTerminalOpenRequest(latestOpenRequestRef.current, defaultCwd, defaultReuseKey)) {
          await openTerminal()
        } else {
          setState(createTerminalPanelState())
        }
      } catch (error) {
        if (!cancelled) {
          reportError(error)
        }
      } finally {
        if (!cancelled) {
          setRestored(true)
        }
      }
    }

    restoreTerminals().catch(reportError)

    return () => {
      cancelled = true
    }
  }, [defaultCwd, defaultReuseKey, openTerminal, reportError])

  useEffect(() => {
    if (!openRequest) {
      return
    }

    if (!shouldHandleTerminalOpenRequest(openRequest, defaultCwd, defaultReuseKey)) {
      return
    }

    const requestKey = getTerminalRequestKey(openRequest)

    if (handledOpenRequestKeyRef.current === requestKey) {
      return
    }

    handledOpenRequestKeyRef.current = requestKey
    openTerminal(openRequest).catch(reportError)
  }, [defaultCwd, defaultReuseKey, openRequest, openTerminal, reportError])

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

  const resetCommandForm = useCallback(() => {
    setEditingCommand(null)
    commandForm.resetFields()
  }, [commandForm])

  const saveProjectCommand = useCallback(
    async (values: TerminalCommandForm) => {
      if (!projectId || !window.forgeDesk) {
        return
      }

      setSavingCommand(true)

      try {
        await window.forgeDesk.saveProjectTerminalCommand({
          id: editingCommand?.id,
          projectId,
          name: values.name,
          command: values.command
        })
        await loadProjectCommands()
        resetCommandForm()
        message.success('常用命令已保存')
      } catch (error) {
        reportError(error)
      } finally {
        setSavingCommand(false)
      }
    },
    [editingCommand?.id, loadProjectCommands, projectId, reportError, resetCommandForm]
  )

  const deleteProjectCommand = useCallback(
    async (commandId: string) => {
      if (!projectId || !window.forgeDesk) {
        return
      }

      try {
        setProjectCommands(await window.forgeDesk.deleteProjectTerminalCommand(projectId, commandId))

        if (editingCommand?.id === commandId) {
          resetCommandForm()
        }

        message.success('常用命令已删除')
      } catch (error) {
        reportError(error)
      }
    },
    [editingCommand?.id, projectId, reportError, resetCommandForm]
  )

  const fillTerminalCommand = useCallback(
    async (command: ProjectTerminalCommandRecord) => {
      if (!window.forgeDesk) {
        return
      }

      let target = activeTab

      if (!target || target.exited) {
        target = await openTerminal()
      }

      if (!target) {
        return
      }

      try {
        await window.forgeDesk.writeTerminal(target.id, command.command)
        setState((current) => ({ ...current, activeSessionId: target.id }))
        setCommandModalOpen(false)
      } catch (error) {
        reportError(error)
      }
    },
    [activeTab, openTerminal, reportError]
  )

  const hasTabs = state.tabs.length > 0
  const showCommandSidebar = Boolean(projectId && projectCommands.length > 0)

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
          {projectId ? (
            <Tooltip title="新增、编辑、删除常用命令">
              <Button className="terminal-command-trigger" size="small" icon={<FileTextOutlined />} onClick={() => setCommandModalOpen(true)}>
                管理命令
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip title="新建终端">
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => openTerminal().catch(reportError)} />
          </Tooltip>
          <Tooltip title="重启终端">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => restartActiveTab().catch(reportError)} />
          </Tooltip>
        </Space>
      </div>
      <div className="terminal-workspace-body">
        <div className="terminal-pane-stack">
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
          ) : restored ? (
            <div className="terminal-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无终端会话">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openTerminal().catch(reportError)}>
                  新建终端
                </Button>
              </Empty>
            </div>
          ) : (
            <div className="terminal-empty" />
          )}
        </div>
        {showCommandSidebar ? (
          <aside className="terminal-command-sidebar" aria-label="快捷指令">
            <div className="terminal-command-sidebar-header">
              <Typography.Text className="terminal-command-sidebar-title">快捷指令</Typography.Text>
              <span className="terminal-command-sidebar-count">{projectCommands.length}</span>
            </div>
            <div className="terminal-command-shortcut-list">
              {projectCommands.map((command) => (
                <Tooltip key={command.id} title={command.command} placement="left">
                  <button
                    aria-label={`使用快捷指令 ${command.name}`}
                    className="terminal-command-shortcut"
                    type="button"
                    onClick={() => fillTerminalCommand(command).catch(reportError)}
                  >
                    <span className="terminal-command-shortcut-name">{command.name}</span>
                    <span className="terminal-command-shortcut-text">{command.command}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
      <Modal
        className="terminal-command-modal"
        title="管理常用命令"
        open={commandModalOpen}
        footer={null}
        width={720}
        onCancel={() => {
          setCommandModalOpen(false)
          resetCommandForm()
        }}
      >
        <Space direction="vertical" size={16} className="terminal-command-manager">
          <Form form={commandForm} layout="vertical" onFinish={saveProjectCommand}>
            <div className="terminal-command-form-grid">
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入命令名称' }]}>
                <Input placeholder="例如 Dev" />
              </Form.Item>
              <Form.Item name="command" label="命令" rules={[{ required: true, message: '请输入命令内容' }]}>
                <Input.TextArea rows={3} placeholder="例如 pnpm dev" />
              </Form.Item>
            </div>
            <Space>
              <Button type="primary" htmlType="submit" loading={savingCommand}>
                {editingCommand ? '保存修改' : '新增命令'}
              </Button>
              {editingCommand ? <Button onClick={resetCommandForm}>取消编辑</Button> : null}
            </Space>
          </Form>
          <Spin spinning={commandsLoading}>
            {projectCommands.length > 0 ? (
              <div className="terminal-command-list">
                {projectCommands.map((command) => (
                  <div className="terminal-command-row" key={command.id}>
                    <div className="terminal-command-record-copy">
                      <span className="terminal-command-name">{command.name}</span>
                      <span className="terminal-command-text">{command.command}</span>
                    </div>
                    <Space size={2} className="terminal-command-actions">
                      <Tooltip title="编辑">
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingCommand(command)
                            commandForm.setFieldsValue({ name: command.name, command: command.command })
                          }}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="删除这个常用命令？"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteProjectCommand(command.id).catch(reportError)}
                      >
                        <Tooltip title="删除">
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无常用命令" />
            )}
          </Spin>
        </Space>
      </Modal>
    </section>
  )
}
