import { useEffect, useState } from 'react'
import { Alert, Button, Card, List, Tag, Typography } from 'antd'
import type { Project } from './data'
import type { AppRoute } from './workspace-navigation'
import { projectPage } from './workspace-navigation'
import { useWorkspaceVisible } from './workspace-visibility'

type Summary = { id: string; projectId: string; name: string; state: string; checkedAt: string | null; error?: string | null; stale: boolean }
export function WorkspaceRuntimeSummary({ projects, refreshKey, onNavigate }: { projects: Project[]; refreshKey: string; onNavigate: (route: AppRoute) => void }): JSX.Element {
  const visible = useWorkspaceVisible()
  const [rows, setRows] = useState<Summary[]>([]), [error, setError] = useState('')
  const ids = projects.map(project=>project.id).join('|')
  useEffect(()=>{
    if (!visible) return
    let disposed=false
    setRows([]);setError('')
    // Cache reads only. Visiting a dashboard never starts a server check or a poller.
    async function read(){
      const values:Summary[]=[]
      for(const project of projects){
        if(disposed)return
        const [cached,targets,services]=await Promise.all([window.forgeDesk.readProjectRuntime(project.id),window.forgeDesk.listProjectDeploymentTargets(project.id),window.forgeDesk.listProjectServices(project.id)])
        values.push(...cached.map(item=>({id:item.targetId,projectId:project.id,name:targets.find(target=>target.id===item.targetId)?.displayName||'服务器目标',state:item.error?'未知':({running:'运行中',stopped:'已停止',degraded:'健康异常',unknown:'未知'})[item.state],checkedAt:item.checkedAt,error:item.error,stale:item.stale})))
        for(const service of services){
          const domains=service.domains.filter(domain=>domain.enabled)
          if(!domains.length)values.push({id:service.id,projectId:project.id,name:service.name,state:'未配置健康检查',checkedAt:null,stale:true})
          for(const domain of domains)values.push({id:domain.id,projectId:project.id,name:domain.domain,state:domain.lastStatus==='online'?'在线':domain.lastStatus==='offline'?'离线':domain.lastStatus==='degraded'?'响应异常':'未知',checkedAt:domain.lastCheckedAt||null,error:domain.lastError,stale:!domain.lastCheckedAt||Date.now()-Date.parse(domain.lastCheckedAt)>90_000})
        }
      }
      if(!disposed)setRows(values)
    }
    void read().catch(error=>{if(!disposed)setError(String(error))})
    return()=>{disposed=true}
  },[ids,refreshKey,visible])
  return <Card title="线上状态 · 最近检查缓存"><Typography.Paragraph type="secondary">不会在工作台发起远程巡检。未配置、过期和读取失败均不代表正常。</Typography.Paragraph>{error?<Alert type="error" showIcon message="线上状态读取失败" description={error}/>:null}<List dataSource={rows.filter(item=>item.stale||item.error||!['在线','运行中'].includes(item.state)).slice(0,8)} locale={{emptyText:error?'暂无可靠运行数据':rows.length?'最近检查未发现异常；检查时间以运行页面为准':'尚未配置服务或部署目标'}} renderItem={item=><List.Item actions={[<Button key="open" onClick={()=>onNavigate(projectPage(item.projectId,'monitoring'))}>查看运行</Button>]}><List.Item.Meta title={item.name} description={`${projects.find(project=>project.id===item.projectId)?.name??''} · ${item.error|| (item.checkedAt?new Date(item.checkedAt).toLocaleString():'尚未检查')}`} /><Tag color={item.stale?'warning':undefined}>{item.stale?'未检查／过期':item.state}</Tag></List.Item>} /></Card>
}
