import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { TaskWorkspacePanel } from './task-workspace-panel'
import { WorkspaceShell } from './workspace-shell'
import type { AppRoute } from './workspace-navigation'
import './styles.css'

const api = ['initializeTaskWorkspace', 'getTaskWorkspace', 'runTaskCommand', 'getTaskHistory', 'addTaskAttachments', 'openTaskAttachment', 'readTaskAttachment']
Object.assign(window, { forgeDesk: Object.fromEntries([...api.map(method => [method, async (...args: unknown[]) => { const response = await fetch('/__tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) }); const value = await response.json(); if (!response.ok) throw new Error(value.error); return value.result }]), ['onTaskWorkspaceUpdated', () => () => undefined], ['onTaskFocus', () => () => undefined]]) })
function Preview() {
  const [route, setRoute] = useState<AppRoute>({ scope: 'global', area: 'tasks', page: 'list', taskScope: 'lists' })
  const dark = new URLSearchParams(location.search).has('dark')
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  return <ConfigProvider locale={zhCN} theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm, cssVar: true, token: { colorPrimary: '#245bff', borderRadius: 6 } }}><div className="workspace-production-root"><WorkspaceShell route={route} projects={[]} terminal={null} onNavigate={setRoute} onOpenProject={() => undefined} onOpenTerminal={() => undefined} onBack={() => undefined} onForward={() => undefined} canBack={false} canForward={false}><TaskWorkspacePanel embedded scope={route.taskScope} entityId={route.entityId} onScopeChange={taskScope => setRoute({ ...route, taskScope, entityId: undefined })} onSelectTask={entityId => setRoute({ ...route, entityId })} /></WorkspaceShell></div></ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
