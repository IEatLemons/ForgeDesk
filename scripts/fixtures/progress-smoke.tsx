import React from 'react'
import { createRoot } from 'react-dom/client'
import { Alert, ConfigProvider } from 'antd'
import { ProjectProgressPanel } from '../../src/renderer/src/project-progress-panel'
import { useForgeDeskStore } from '../../src/renderer/src/store'
import { taskListStorageKey } from '../../src/renderer/src/task-list-view'
import '../../src/renderer/src/styles.css'

// Browser fallback exercises the same SQLite service through a loopback-only QA bridge.
if(!window.forgeDesk){
  const listeners=new Set<()=>void>()
  const invoke=async(operation:string,input:unknown={})=>{
    const response=await fetch(`/__progress_api/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})
    const value=await response.json();if(value.error)throw new Error(value.error)
    if(operation==='command'||operation==='activate')for(const listener of listeners)listener()
    return value.result
  }
  window.forgeDesk={getProjectProgress:query=>invoke('snapshot',query),getProjectProgressHistory:query=>invoke('history',query),runProjectProgressCommand:command=>invoke('command',command),previewProjectProgressMigration:input=>invoke('preview',input),activateProjectProgressMigration:input=>invoke('activate',input),runProjectProgressAi:input=>invoke('ai',input),onProjectProgressUpdated:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},listManagedTasks:()=>invoke('managed')} as typeof window.forgeDesk
}
useForgeDeskStore.setState({projects:[{id:'qa-project',name:'隔离验收项目',description:'无仓库、无 AI 的人工项目',status:'ready',owner:'QA',workspacePath:'/tmp/qa-project',createdAt:new Date().toISOString(),isFavorite:false}],repositories:[],loadingWorkspace:false})
if(!localStorage.getItem(taskListStorageKey))localStorage.setItem(taskListStorageKey,JSON.stringify([{id:'qa-legacy',title:'历史人工待办',notes:'迁移后日期、标签与原文均应保留',status:'todo',priority:'high',projectId:'qa-project',startDate:'2026-10-14',dueDate:'2026-10-16',tags:['历史'],subtasks:[],createdAt:'2026-10-14T00:00:00Z',updatedAt:'2026-10-14T00:00:00Z'}]))
createRoot(document.getElementById('root')!).render(<ConfigProvider><div style={{padding:24}}><Alert showIcon type="info" message="隔离验收环境：只使用临时数据库，不访问实际任务库，不启动 AI。关闭窗口即清理。"/><ProjectProgressPanel/></div></ConfigProvider>)
