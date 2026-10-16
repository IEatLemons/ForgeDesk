import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Drawer, Empty, Form, Input, List, Modal, Progress, Select, Space, Spin, Table, Tabs, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ProgressCommand, ProgressEntity, ProgressMigration, ProgressPlanDraft, ProgressPlanItem, ProgressScopeKind, ProjectWorkItem, WorkItemFields, WorkScopeFields, WorkStatus } from '../../shared/project-progress'
import { useForgeDeskStore } from './store'
import { useProjectProgress } from './use-project-progress'
import { describePlanChanges, filterProgressItems, progressEventLabels, progressTimeline, workStatusColors, workStatusLabels, type WorkTreeRow } from './project-progress-view'
import { ManagedTaskPanel } from './managed-task-panel'
import { TaskListPanel as LegacyTodoPanel } from './task-list-panel'
import { taskListStorageKey } from './task-list-view'
import './project-progress.css'

const commandId=()=>crypto.randomUUID()
const kindLabels:Record<ProgressScopeKind,string>={goal:'目标',milestone:'里程碑',version:'版本'}
const entityStatusLabels:Record<string,string>={draft:'草稿',active:'进行中',achieved:'已达成',cancelled:'已取消',planned:'计划中',closed:'已收口',archived:'已归档'}
const executionLabels:Record<string,string>={queued:'等待启动',running:'运行中',waiting:'等待输入',cancelling:'正在停止',succeeded:'执行结束',failed:'执行失败',cancelled:'已停止',unknown:'需要核对'}
const activeExecution=(status:string)=>['queued','running','waiting','cancelling','unknown'].includes(status)
function savedTaskView(projectId?:string){try{const value=localStorage.getItem(`forgedesk:task-view:v2:${projectId||'all'}`);return value&&['list','board','gantt'].includes(value)?value:'list'}catch{return 'list'}}

type WorkForm=WorkItemFields & WorkScopeFields
type EntityForm={projectId:string;title:string;description:string;criteriaText:string;ownerRef:string;targetDate:string|null;status:ProgressEntity['status']}
function ProgressDateInput({value,onChange,id}:{value?:string|null;onChange?:(value:string|null)=>void;id?:string}){return <Input id={id} value={value??''} placeholder="YYYY-MM-DD" maxLength={10} onChange={event=>onChange?.(event.target.value||null)}/>}

export type ProgressSection='tasks'|ProgressScopeKind|'maintenance'
export function ProjectProgressPanel({projectId,onOpenCodexSession,section,entityId,onSelectTask,onOpenMaintenance,maintenancePage,detailView,onDetailViewChange}:{projectId?:string;onOpenCodexSession?:(id:string)=>void;section?:ProgressSection;entityId?:string;onSelectTask?:(id:string|undefined)=>void;onOpenMaintenance?:()=>void;maintenancePage?:string;detailView?:'preview'|'overview'|'children'|'ai'|'history';onDetailViewChange?:(view:'overview'|'children'|'ai'|'history')=>void}):JSX.Element{
  const {projects,repositories}=useForgeDeskStore()
  const [projectFilter,setProjectFilter]=useState(projectId||'all')
  const currentProject=projectId||(projectFilter==='all'?undefined:projectFilter)
  const {snapshot,error,loading,refresh}=useProjectProgress(currentProject,section==='maintenance')
  const [busy,setBusy]=useState(''),[legacy,setLegacy]=useState(false),[preview,setPreview]=useState<ProgressMigration|null>(null),[migrationError,setMigrationError]=useState('')
  const [legacyTodos,setLegacyTodos]=useState(false),[rawRepair,setRawRepair]=useState<string|null>(null)
  const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[scopeId,setScopeId]=useState(''),[inbox,setInbox]=useState(false),[archived,setArchived]=useState(false),[view,setLocalView]=useState(()=>savedTaskView(currentProject))
  function setView(value:string){setLocalView(value);try{localStorage.setItem(`forgedesk:task-view:v2:${currentProject||'all'}`,value)}catch{/* preferences are best effort */}}
  useEffect(()=>setLocalView(savedTaskView(currentProject)),[currentProject])
  const [selectedId,setLocalSelectedId]=useState<string|null>(null),[editing,setEditing]=useState<ProjectWorkItem|null>(null),[parentId,setParentId]=useState<string|null>(null),[workModal,setWorkModal]=useState(false)
  const [fullDetail,setFullDetail]=useState(false),[detailTab,setDetailTab]=useState('overview')
  function setSelectedId(id:string|null){setLocalSelectedId(id);setFullDetail(false);setDetailTab('overview');onSelectTask?.(id??undefined)}
  const [scopeItem,setScopeItem]=useState<ProjectWorkItem|null>(null),[entityEdit,setEntityEdit]=useState<ProgressEntity|null>(null),[entityKind,setEntityKind]=useState<ProgressScopeKind>('goal'),[entityModal,setEntityModal]=useState(false)
  const [draftRoot,setDraftRoot]=useState<ProjectWorkItem|null>(null),[draftNodes,setDraftNodes]=useState<ProgressPlanItem[]>([]),[previewDraft,setPreviewDraft]=useState<ProgressPlanDraft|null>(null)
  const [repositoryId,setRepositoryId]=useState<string>(),[blockReason,setBlockReason]=useState(''),[blockNext,setBlockNext]=useState(''),[rawSession,setRawSession]=useState<CodexSessionDetail|null>(null)
  const [workForm]=Form.useForm<WorkForm>(),[scopeForm]=Form.useForm<WorkScopeFields>(),[entityForm]=Form.useForm<EntityForm>()
  const pendingCommand=useRef<{key:string;command:ProgressCommand}|null>(null)
  const workProject=Form.useWatch('projectId',workForm)
  const scopeProject=Form.useWatch('projectId',scopeForm)
  const selected=snapshot?.items.find(item=>item.id===selectedId)??null
  const items=snapshot?.items??[],entities=snapshot?.entities??[]
  const stats=(scopeId?snapshot?.scopeStats[scopeId]:null)??snapshot?.stats
  const today=snapshot?new Intl.DateTimeFormat('en-CA',{timeZone:snapshot.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(snapshot.asOf)):''
  const rows=useMemo(()=>filterProgressItems(items,{query,status,scopeId,inbox,archived}),[snapshot,query,status,scopeId,inbox,archived])
  const timeline=useMemo(()=>progressTimeline(rows),[rows])
  const projectOptions=projects.map(project=>({value:project.id,label:project.name}))
  const scopeOptions=(kind:ProgressScopeKind,id:string|null|undefined)=>entities.filter(entity=>entity.kind===kind&&entity.projectId===id).map(entity=>({value:entity.id,label:entity.title}))
  const nameOfProject=(id:string|null)=>id?projects.find(project=>project.id===id)?.name||'已删除项目':'收件箱'

  useEffect(()=>{setProjectFilter(projectId||'all');setScopeId('');setLocalSelectedId(entityId??null)},[projectId])
  useEffect(()=>{setLocalSelectedId(entityId??null);setFullDetail(!!detailView&&detailView!=='preview');setDetailTab(detailView&&detailView!=='preview'?detailView:'overview')},[entityId,detailView])
  useEffect(()=>{setLegacy(maintenancePage==='legacy-ai');setLegacyTodos(maintenancePage==='legacy-todos');if(maintenancePage==='repair')setRawRepair(legacyRaw()??'[]')},[maintenancePage])
  useEffect(()=>{let disposed=false;if(entityId&&snapshot&&!loading&&!busy&&!snapshot.items.some(item=>item.id===entityId))void refresh().then(next=>{if(!disposed&&next&&!next.items.some(item=>item.id===entityId)){message.warning('任务不存在或不属于当前项目，已返回任务列表');onSelectTask?.(undefined)}});return()=>{disposed=true}},[entityId,currentProject,snapshot?.active,loading,busy])
  useEffect(()=>{
    if(!selected)return
    const repository=repositories.find(repository=>repository.id===repositoryId&&repository.projectId===selected.projectId)||repositories.find(repository=>repository.projectId===selected.projectId)
    setRepositoryId(repository?.id)
  },[selected?.id,selected?.projectId,repositories])

  async function perform(name:string,action:()=>Promise<unknown>){
    if(busy)return
    setBusy(name)
    try{await action();await refresh()}
    catch(error){message.error(error instanceof Error?error.message:error&&typeof error==='object'&&'errorFields'in error?'请检查表单中的必填项':String(error))}
    finally{setBusy('')}
  }
  async function send(command:Omit<ProgressCommand,'commandId'>|Record<string,unknown>){
    const key=JSON.stringify(command)
    if(pendingCommand.current?.key!==key)pendingCommand.current={key,command:{...command,commandId:commandId()} as ProgressCommand}
    const result=await window.forgeDesk.runProjectProgressCommand(pendingCommand.current!.command)
    pendingCommand.current=null
    return result
  }
  function legacyRaw(){return window.localStorage.getItem(taskListStorageKey)}
  async function migrationPreview(){
    setMigrationError('')
    try{const value=await window.forgeDesk.previewProjectProgressMigration({legacyRaw:legacyRaw()});setPreview(value);return value}
    catch(error){setMigrationError(error instanceof Error?error.message:String(error));return null}
  }
  useEffect(()=>{
    if(snapshot&&!snapshot.active&&!preview&&!busy&&(!section||section==='maintenance'))void migrationPreview()
  },[snapshot?.active,section])
  async function activate(){
    if(!preview)return
    await window.forgeDesk.activateProjectProgressMigration({batchId:preview.id,inputHash:preview.inputHash,legacyRaw:legacyRaw()})
    message.success('核对完成，原生项目任务已启用；旧数据与数据库备份均已保留')
  }
  async function saveRawRepair(){
    if(rawRepair===null)return
    if(!Array.isArray(JSON.parse(rawRepair)))throw new Error('旧待办原文必须是 JSON 数组')
    const original=legacyRaw()
    if(original!==null)window.localStorage.setItem(`${taskListStorageKey}.recovery.${commandId()}`,original)
    window.localStorage.setItem(taskListStorageKey,rawRepair)
    setRawRepair(null);await migrationPreview();message.success('修复内容已保存，修改前原文已另外备份')
  }
  function editWork(item:ProjectWorkItem|null,parent:string|null=null){
    setEditing(item);setParentId(parent)
    const owner=parent?items.find(item=>item.id===parent):null
    workForm.resetFields();workForm.setFieldsValue(item??{title:'',description:'',acceptanceText:'',priority:'medium',ownerRef:'',startDate:null,dueDate:null,tags:[],projectId:owner?.projectId??currentProject??null,goalId:owner?.goalId??null,milestoneId:owner?.milestoneId??null,versionId:owner?.versionId??null})
    setWorkModal(true)
  }
  async function saveWork(){
    const values=await workForm.validateFields()
    const fields:WorkItemFields={title:values.title,description:values.description||'',acceptanceText:values.acceptanceText||'',priority:values.priority,ownerRef:values.ownerRef||'',startDate:values.startDate||null,dueDate:values.dueDate||null,tags:values.tags||[]}
    const result=editing?await send({type:'update',id:editing.id,expectedVersion:editing.rowVersion,patch:fields}):await send({type:'create',input:{...fields,projectId:values.projectId||null,goalId:values.goalId||null,milestoneId:values.milestoneId||null,versionId:values.versionId||null,parentId}})
    setWorkModal(false);setSelectedId(result.entityId)
  }
  function transition(item:ProjectWorkItem,action:string){
    const execute=(reason='')=>perform(action,()=>send({type:'transition',id:item.id,expectedVersion:item.rowVersion,action,reason}))
    if(['cancel','reopen','accept'].includes(action)){
      let reason=''
      Modal.confirm({title:action==='accept'?'确认已满足验收条件？':action==='cancel'?'取消这项业务工作？':'重新打开任务？',content:<Space direction="vertical" style={{width:'100%'}}><Typography.Text>{action==='accept'?item.acceptanceText||item.title:action==='cancel'?'取消父任务会同时取消尚未完成的节点。停止 AI 执行是另一个操作。':'原验收记录保留为历史，进度将重新计算。'}</Typography.Text><Input.TextArea placeholder="说明或验收依据（可选）" onChange={event=>{reason=event.target.value}}/></Space>,okText:'确认',cancelText:'返回',onOk:()=>execute(reason)})
    }else void execute()
  }
  function editScope(item:ProjectWorkItem){setScopeItem(item);scopeForm.setFieldsValue(item)}
  function editEntity(kind:ProgressScopeKind,item:ProgressEntity|null=null){setEntityKind(kind);setEntityEdit(item);entityForm.resetFields();entityForm.setFieldsValue(item??{projectId:currentProject??projects[0]?.id,title:'',description:'',criteriaText:'',ownerRef:'',targetDate:null,status:kind==='goal'?'active':'planned'});setEntityModal(true)}
  async function saveEntity(){const values=await entityForm.validateFields();await send({type:'save-entity',kind:entityKind,input:{...values,id:entityEdit?.id,targetDate:values.targetDate||null},expectedVersion:entityEdit?.rowVersion});setEntityModal(false)}
  function editPlan(item:ProjectWorkItem){setDraftRoot(item);setDraftNodes(items.filter(node=>node.parentId===item.id&&node.status!=='cancelled').map(node=>({id:node.id,existingWorkItemId:node.id,title:node.title,description:node.description,acceptanceText:node.acceptanceText,dependencyIds:node.dependencyIds})))}
  function resolveBlocker(item:ProjectWorkItem,blockerId:string){let resolution='';Modal.confirm({title:'解除阻塞',content:<Input.TextArea placeholder="说明处理结果" onChange={event=>{resolution=event.target.value}}/>,okText:'确认解除',cancelText:'返回',onOk:()=>perform('unblock',()=>send({type:'unblock',id:item.id,expectedVersion:item.rowVersion,blockerId,resolution}))})}
  async function savePlan(){
    if(!draftRoot)return
    await send({type:'save-draft',id:draftRoot.id,expectedVersion:draftRoot.rowVersion,items:draftNodes})
    setDraftRoot(null);message.success('草稿已保存，请核对差异后应用')
  }
  async function ai(action:'plan'|'execute'|'cancel'|'read-plan'|'sync',executionId?:string){
    if(!selected)return
    const result=await window.forgeDesk.runProjectProgressAi({action,workItemId:selected.id,repositoryId,executionId,commandId:commandId()})
    if(result&&'items'in result)setPreviewDraft(result)
  }
  const rowActions=(item:ProjectWorkItem)=><Space wrap size={4}>
    {item.archivedAt?<Button size="small" onClick={()=>transition(item,'unarchive')}>恢复</Button>:<>
      {item.status==='todo'?<Button size="small" disabled={!!busy} onClick={()=>transition(item,'start')}>开始</Button>:null}
      {!['done','cancelled'].includes(item.status)?<Button size="small" disabled={!!busy} onClick={()=>transition(item,'accept')}>验收完成</Button>:<Button size="small" disabled={!!busy} onClick={()=>transition(item,'reopen')}>重开</Button>}
      <Button size="small" onClick={()=>setSelectedId(item.id)}>详情</Button>
    </>}
  </Space>
  const columns=[
    {title:'工作项',key:'title',render:(_:unknown,item:WorkTreeRow)=><Space direction="vertical" size={2}><Button type="link" className="progress-title" onClick={()=>setSelectedId(item.id)}>{item.title}</Button><Space wrap size={4}>{!projectId?<Typography.Text type="secondary">{nameOfProject(item.projectId)}</Typography.Text>:null}{item.tags.map(tag=><Tag key={tag}>{tag}</Tag>)}{item.completionBasis==='legacy_user_marked'?<Tag>历史人工完成</Tag>:null}</Space></Space>},
    {title:'状态',key:'status',render:(_:unknown,item:WorkTreeRow)=><Space wrap size={4}><Tag color={workStatusColors[item.status]}>{workStatusLabels[item.status]}</Tag>{item.blockers.some(blocker=>!blocker.resolvedAt)||item.dependencyIds.some(id=>items.find(work=>work.id===id)?.status!=='done')?<Tag color="error">阻塞／等待依赖</Tag>:null}{item.dueDate&&item.dueDate<today&&!['done','cancelled'].includes(item.status)?<Tag color="error">已逾期</Tag>:null}</Space>},
    {title:'负责人',dataIndex:'ownerRef',key:'owner',render:(value:string)=>value||'未指定'},
    {title:'计划完成',dataIndex:'dueDate',key:'due',render:(value:string|null)=>value||'未安排'},
    {title:'操作',key:'actions',render:(_:unknown,item:WorkTreeRow)=>rowActions(item)}
  ]
  const changes=previewDraft?describePlanChanges(items,previewDraft):null
  if(legacyTodos)return <section><Button onClick={()=>{setLegacyTodos(false);void migrationPreview();void refresh()}}>返回迁移核对</Button><Alert showIcon type="warning" message="旧待办恢复入口" description="此处仍修改旧存储。修复后请返回重新预览；未通过迁移核对前不会切换首页统计。"/><LegacyTodoPanel/></section>
  if(legacy)return <section><Button onClick={()=>setLegacy(false)}>返回原生项目进度</Button><Alert type="info" showIcon message="历史 AI 工作流" description="保留原会话和代码交付操作。此处执行结束不会自动完成新的业务任务。"/><ManagedTaskPanel onOpenCodexSession={onOpenCodexSession??(id=>void window.forgeDesk.getCodexSession(id).then(setRawSession))}/><Drawer open={!!rawSession} onClose={()=>setRawSession(null)} title={rawSession?.title} width={760}>{rawSession?.items.filter(item=>['user','assistant'].includes(item.kind)).map(item=><Typography.Paragraph key={item.id} style={{whiteSpace:'pre-wrap'}}>{item.text}</Typography.Paragraph>)}</Drawer></section>
  if(loading&&!snapshot)return <div className="loading-panel"><Spin/></div>
  return <section className={`workspace-section progress-workspace${section?' progress-section-controlled':''}`}>
    <div className="section-heading"><div><Typography.Title level={projectId?3:2}>{section&&section in kindLabels?kindLabels[section as ProgressScopeKind]:section==='maintenance'?'任务数据与维护':'项目任务'}</Typography.Title><Typography.Text type="secondary">目标、节点与验收形成业务进度，AI 执行与代码交付分别追踪。</Typography.Text></div><Space wrap>{!section||section==='maintenance'?<Button onClick={()=>setLegacy(true)}>历史 AI 工作流</Button>:null}<Button icon={<ReloadOutlined/>} onClick={()=>void refresh()}>刷新</Button>{snapshot?.active&&section!=='maintenance'&&(!section||section==='tasks')?<Button type="primary" icon={<PlusOutlined/>} onClick={()=>editWork(null)}>新建任务</Button>:null}</Space></div>
    {error?<Alert type="error" showIcon message={error}/>:null}
    {section==='maintenance'&&snapshot?.active?<Space wrap style={{marginBottom:16}}><Button onClick={()=>setLegacyTodos(true)}>旧待办恢复</Button><Button onClick={()=>setRawRepair(legacyRaw()??'[]')}>原始记录修复</Button><Typography.Text type="secondary">原生读取已启用；旧存储仍保留，不会重复迁移。</Typography.Text></Space>:null}
    {!snapshot?.active&&section&&section!=='maintenance'?<Alert showIcon type="info" message="原生进度尚未启用" description="请先在设置 → 数据与维护中核对历史数据。此操作不会在进入项目时自动执行。" action={<Button onClick={onOpenMaintenance}>前往核对</Button>}/>:!snapshot?.active?<Card title="核对历史任务并启用原生进度"><Space direction="vertical" size={16} style={{width:'100%'}}>
      <Typography.Paragraph>先核对旧待办与 AI 托管记录。启用时保存数据库备份和原始快照，旧存储不会被清空；旧 AI 自动完成将转为业务待验收。</Typography.Paragraph>
      {migrationError?<Alert type="error" message={migrationError}/>:null}
      {preview?<><Space wrap><Tag>旧待办 {preview.legacyCount}</Tag><Tag>AI／托管 {preview.managedCount}</Tag><Tag>工作项及节点 {preview.workItemCount}</Tag><Tag>精确去重 {preview.duplicateCount}</Tag><Tag color="warning">待验收 {preview.reviewCount}</Tag></Space><List size="small" dataSource={preview.issues} pagination={{pageSize:8,hideOnSinglePage:true}} locale={{emptyText:'未发现迁移异常'}} renderItem={issue=><List.Item><Tag color={issue.severity==='error'?'error':'warning'}>{issue.severity==='error'?'需处理':'提示'}</Tag><Typography.Text>{issue.message}（{issue.sourceId}）</Typography.Text></List.Item>}/></>:<Spin/>}
      <Space><Button loading={busy==='preview'} onClick={()=>void perform('preview',migrationPreview)}>重新预览</Button><Button type="primary" disabled={!preview||preview.issues.some(issue=>issue.severity==='error')} loading={busy==='activate'} onClick={()=>void perform('activate',activate)}>核对并启用原生任务</Button></Space>
      <Space wrap><Button onClick={()=>setLegacyTodos(true)}>打开旧待办恢复入口</Button><Button onClick={()=>setRawRepair(legacyRaw()??'[]')}>检查／修复旧存储原文</Button></Space>
    </Space></Card>:<>
      <div className="progress-summary" aria-label="项目进度摘要"><span><strong>{stats?.done}／{stats?.total}</strong> 节点完成</span><span>待验收 {stats?.review}</span><span>阻塞 {stats?.blocked}</span><span>逾期 {stats?.overdue}</span><span>父任务待验收 {stats?.awaitingParentAcceptance}</span><span>收件箱 {snapshot.stats.inbox}</span><Progress percent={stats?.percent??0} format={()=>stats?.percent==null?'暂无有效工作':`${stats.percent}%`}/></div>
      <Tabs className={section?'progress-controlled-tabs':undefined} activeKey={section?(section==='tasks'?'tasks':section==='maintenance'?'activity':'plans'):undefined} items={[
        {key:'tasks',label:'任务与节点',children:<>
          <div className="progress-toolbar"><Input.Search allowClear placeholder="搜索任务、说明、标签或负责人" value={query} onChange={event=>setQuery(event.target.value)} style={{width:280,maxWidth:'100%'}}/>
            {!projectId?<Select aria-label="筛选项目" value={projectFilter} style={{minWidth:160}} options={[{value:'all',label:'全部项目'},...projectOptions]} onChange={value=>{setProjectFilter(value);setScopeId('');setSelectedId(null)}}/>:null}
            <Select aria-label="筛选状态" value={status} style={{minWidth:120}} onChange={setStatus} options={[{value:'',label:'全部状态'},...Object.entries(workStatusLabels).map(([value,label])=>({value,label}))]}/>
            <Select aria-label="筛选目标或计划" allowClear value={scopeId||undefined} placeholder="目标／里程碑／版本" style={{minWidth:190}} onChange={value=>setScopeId(value||'')} options={entities.map(entity=>({value:entity.id,label:`${kindLabels[entity.kind]} · ${entity.title}`}))}/>
            <Checkbox checked={inbox} onChange={event=>setInbox(event.target.checked)}>收件箱</Checkbox><Checkbox checked={archived} onChange={event=>setArchived(event.target.checked)}>含归档</Checkbox>
            <Select aria-label="任务视图" value={view} onChange={setView} options={[{value:'list',label:'列表'},{value:'board',label:'看板'},{value:'gantt',label:'甘特图'}]}/>
          </div>
          {view==='list'?<div className="progress-table"><Table<WorkTreeRow> rowKey="id" columns={columns} dataSource={rows} pagination={{pageSize:15}} scroll={{x:760}} locale={{emptyText:<Empty description={inbox?'暂无待归属工作':'暂无工作项，创建任务后开始跟踪'}/>}}/></div>:view==='board'?<div className="progress-board">{(Object.keys(workStatusLabels) as WorkStatus[]).map(state=><section key={state}><Typography.Title level={5}>{workStatusLabels[state]}</Typography.Title>{rows.flatMap(root=>[root,...(root.children??[])]).filter(item=>item.status===state).map(item=><Card size="small" key={item.id} onClick={()=>setSelectedId(item.id)}><Button type="link" className="progress-title">{item.title}</Button><div>{item.ownerRef||'未指定'} · {item.dueDate||'未安排'}</div></Card>)}</section>)}</div>:timeline?<div className="progress-gantt"><Typography.Text type="secondary">{timeline.startDate} 至 {timeline.endDate} · {timeline.days} 天</Typography.Text>{timeline.rows.map(row=><div className="progress-gantt-row" key={row.item.id}><Button type="link" className="progress-title" onClick={()=>setSelectedId(row.item.id)}>{row.item.parentId?'↳ ':''}{row.item.title}</Button><div className="progress-gantt-track">{row.duration?<div className={`progress-gantt-bar status-${row.item.status}`} style={{left:`${row.offset/timeline.days*100}%`,width:`${row.duration/timeline.days*100}%`}} aria-label={`${row.item.startDate||row.item.dueDate} 至 ${row.item.dueDate||row.item.startDate}`}/>:<Typography.Text type="secondary">未安排日期</Typography.Text>}</div></div>)}</div>:<Empty description="设置任务起止日期后显示甘特图"/>}
        </>},
        {key:'plans',label:'目标与计划',children:<><Space wrap style={{marginBottom:16}}>{(Object.keys(kindLabels) as ProgressScopeKind[]).filter(kind=>!section||section===kind).map(kind=><Button key={kind} icon={<PlusOutlined/>} onClick={()=>editEntity(kind)}>新建{kindLabels[kind]}</Button>)}</Space><Table rowKey="id" dataSource={entities.filter(entity=>!section||entity.kind===section)} pagination={{pageSize:10}} scroll={{x:700}} columns={[
          {title:'类型',dataIndex:'kind',render:(kind:ProgressScopeKind)=>kindLabels[kind]},
          {title:'名称',dataIndex:'title'},
          {title:'项目',dataIndex:'projectId',render:(id:string)=>nameOfProject(id)},
          {title:'节点完成',key:'progress',render:(_,entity)=><span>{snapshot.scopeStats[entity.id]?.done??0}／{snapshot.scopeStats[entity.id]?.total??0}</span>},
          {title:'目标日期',dataIndex:'targetDate',render:(value:string)=>value||'未安排'},
          {title:'状态',dataIndex:'status',render:(value:string)=>entityStatusLabels[value]},
          {title:'操作',key:'action',render:(_,entity)=><Button onClick={()=>editEntity(entity.kind,entity)}>编辑／确认达成</Button>}
        ]}/></>},
        {key:'activity',label:'活动与迁移',children:<><Alert type="info" showIcon message="业务活动与执行记录分别保留" description={snapshot.migration?.backupPath?`数据库备份：${snapshot.migration.backupPath}`:'原始迁移快照保存在本机数据库中。'}/><List pagination={{pageSize:15}} dataSource={snapshot.events} renderItem={event=><List.Item><Space direction="vertical"><Space wrap><Tag>{event.actorType}</Tag><Typography.Text>{items.find(item=>item.id===event.entityId)?.title||entities.find(entity=>entity.id===event.entityId)?.title} · {progressEventLabels[event.eventType]||event.eventType}</Typography.Text><Typography.Text type="secondary">{new Date(event.occurredAt).toLocaleString()}</Typography.Text></Space><details><summary>查看变更前后</summary><pre className="progress-event-detail">{JSON.stringify({before:event.before,after:event.after},null,2)}</pre></details></Space></List.Item>}/></>}
      ]}/>
    </>}

    <Drawer open={!!selected} onClose={()=>setSelectedId(null)} width={fullDetail?760:440} title={selected?.title} extra={!fullDetail?<Button onClick={()=>{setFullDetail(true);onDetailViewChange?.('overview')}}>完整详情</Button>:null}>
      {selected?<Space direction="vertical" size={18} style={{width:'100%'}}>
        {fullDetail?<Tabs activeKey={detailTab} onChange={view=>{setDetailTab(view);onDetailViewChange?.(view as 'overview'|'children'|'ai'|'history')}} items={[{key:'overview',label:'概况'},{key:'children',label:'子任务'},{key:'ai',label:'AI 执行'},{key:'history',label:'历史'}]}/>:null}
        {!fullDetail||detailTab==='overview'?<>
        <Space wrap><Tag color={workStatusColors[selected.status]}>{workStatusLabels[selected.status]}</Tag><Tag>{nameOfProject(selected.projectId)}</Tag><Button onClick={()=>editWork(selected)}>编辑资料</Button>{!selected.parentId?<Button onClick={()=>editScope(selected)}>调整归属与范围</Button>:null}{!selected.parentId&&!['done','cancelled'].includes(selected.status)?<Button onClick={()=>editWork(null,selected.id)}>添加节点</Button>:null}</Space>
        <Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{selected.description||'尚无说明'}</Typography.Paragraph><Typography.Text strong>验收条件</Typography.Text><Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{selected.acceptanceText||'完成时由你确认验收依据'}</Typography.Paragraph>
        <Typography.Text strong>来源追溯</Typography.Text><List size="small" dataSource={snapshot?.sourceLinks?.filter(link=>link.workItemId===selected.id)} locale={{emptyText:'ForgeDesk 原生创建'}} renderItem={link=><List.Item><Space wrap><Tag>{link.sourceSystem==='legacy'?'旧待办':link.sourceSystem==='managed'?'历史 AI 工作流':link.sourceSystem}</Tag><Typography.Text type="secondary">{link.sourceScope} · {link.sourceType}</Typography.Text><Typography.Text copyable>{link.sourceId}</Typography.Text></Space></List.Item>}/>
        <Space wrap>{rowActions(selected)}{!['done','cancelled'].includes(selected.status)?<><Button onClick={()=>transition(selected,'review')}>提交验收</Button><Button danger onClick={()=>transition(selected,'cancel')}>取消业务任务</Button></>:<Button onClick={()=>transition(selected,'archive')}>归档</Button>}</Space>
        </>:null}
        {fullDetail&&detailTab==='children'&&!selected.parentId?<><Typography.Text strong>任务节点</Typography.Text><List dataSource={items.filter(item=>item.parentId===selected.id)} locale={{emptyText:'尚未拆解'}} renderItem={item=><List.Item actions={[<Button key="open" onClick={()=>setSelectedId(item.id)}>查看</Button>]}><Tag color={workStatusColors[item.status]}>{workStatusLabels[item.status]}</Tag>{item.title}</List.Item>}/><Button onClick={()=>editPlan(selected)}>编辑计划草稿</Button></>:null}
        {fullDetail&&detailTab==='children'&&selected.parentId?<Typography.Text>这是子任务，不再嵌套下级节点。</Typography.Text>:null}
        {fullDetail&&detailTab==='overview'?<>
        <Typography.Text strong>依赖与阻塞</Typography.Text>
        <Select mode="multiple" style={{width:'100%'}} aria-label="前置依赖" placeholder="选择前置任务" value={selected.dependencyIds} disabled={!!busy} onChange={dependencyIds=>void perform('dependencies',()=>send({type:'dependencies',id:selected.id,expectedVersion:selected.rowVersion,dependencyIds}))} options={items.filter(item=>item.projectId===selected.projectId&&item.id!==selected.id&&item.id!==selected.parentId&&item.parentId!==selected.id&&item.status!=='cancelled').map(item=>({value:item.id,label:`${item.title} · ${workStatusLabels[item.status]}`}))}/>
        {selected.blockers.map(blocker=><Alert key={blocker.id} type={blocker.resolvedAt?'success':'warning'} message={blocker.reason} description={`${blocker.nextAction}${blocker.resolvedAt?` · 已解除：${blocker.resolution}`:''}`} action={!blocker.resolvedAt?<Button size="small" onClick={()=>resolveBlocker(selected,blocker.id)}>解除</Button>:undefined}/>)}
        {!['done','cancelled'].includes(selected.status)?<><Input value={blockReason} onChange={event=>setBlockReason(event.target.value)} placeholder="阻塞原因"/><Input value={blockNext} onChange={event=>setBlockNext(event.target.value)} placeholder="下一步行动"/><Button disabled={!blockReason.trim()} onClick={()=>void perform('block',async()=>{await send({type:'block',id:selected.id,expectedVersion:selected.rowVersion,reason:blockReason,nextAction:blockNext});setBlockReason('');setBlockNext('')})}>记录阻塞</Button></>:null}
        </>:null}
        {fullDetail&&detailTab==='ai'?<><Typography.Text strong>AI 辅助执行</Typography.Text><Typography.Text type="secondary">执行结束仅提供结果，业务是否完成由验收决定。</Typography.Text>
        <Select aria-label="AI 执行仓库" style={{width:'100%'}} placeholder="选择任务项目的仓库" value={repositoryId} onChange={setRepositoryId} options={repositories.filter(repository=>repository.projectId===selected.projectId).map(repository=>({value:repository.id,label:repository.name}))}/>
        <Space wrap>{!selected.parentId?<Button disabled={!repositoryId||!!busy} onClick={()=>void perform('ai-plan',()=>ai('plan'))}>AI 分析计划</Button>:null}<Button disabled={!repositoryId||!!busy} onClick={()=>void perform('ai-execute',()=>ai('execute'))}>执行当前工作</Button><Button disabled={!!busy} onClick={()=>void perform('ai-sync',()=>ai('sync'))}>同步核对</Button></Space>
        <List dataSource={snapshot?.executions.filter(run=>run.workItemId===selected.id).slice().reverse()} locale={{emptyText:'暂无执行记录，人工任务无需 AI'}} renderItem={run=><List.Item><Space direction="vertical" style={{width:'100%'}}><Space wrap><Tag>{run.phase==='context-imported'?'历史会话来源':executionLabels[run.status]}</Tag><span>{run.purpose==='planning'?'规划':'执行'} · 第 {run.attemptNo} 次</span><Typography.Text type="secondary">{run.phase}</Typography.Text></Space><Typography.Text>{run.errorMessage||run.resultSummary}</Typography.Text><Space wrap>{activeExecution(run.status)&&run.phase!=='context-imported'?<Button danger size="small" disabled={!!busy} onClick={()=>void perform('ai-cancel',()=>ai('cancel',run.id))}>停止此次执行</Button>:null}{run.purpose==='planning'&&run.threadId?<Button size="small" onClick={()=>void perform('read-plan',()=>ai('read-plan',run.id))}>读取计划草稿</Button>:null}{run.threadId?<Button size="small" onClick={()=>onOpenCodexSession?onOpenCodexSession(run.threadId!):void perform('session',async()=>setRawSession(await window.forgeDesk.getCodexSession(run.threadId!)))}>查看对话</Button>:null}</Space></Space></List.Item>}/>
        <Typography.Text strong>计划草稿</Typography.Text><List dataSource={snapshot?.drafts.filter(draft=>draft.workItemId===selected.id&&draft.status==='draft')} locale={{emptyText:'暂无待确认草稿'}} renderItem={draft=><List.Item actions={[<Button key="preview" onClick={()=>setPreviewDraft(draft)}>核对差异</Button>]}>{draft.items.length} 个节点 · {new Date(draft.createdAt).toLocaleString()}</List.Item>}/>
        <Typography.Text strong>代码交付与历史执行</Typography.Text>
        {snapshot?.executions.filter(run=>run.workItemId===selected.id&&run.delivery).map(run=><Card size="small" key={run.id} title={`第 ${run.attemptNo} 次${run.purpose==='planning'?'规划':'执行'}`}>
          <Typography.Paragraph copyable={!!run.delivery?.branch}>分支：{run.delivery?.branch||'尚未创建'} · 基线：{run.delivery?.baseBranch||'未指定'}</Typography.Paragraph>
          <Typography.Paragraph>提交：{run.delivery?.commitSha||'尚未提交'} · 目标：{run.delivery?.targetBranch||'尚未发布'}</Typography.Paragraph>
          <Space wrap>{run.threadLinks?.filter(link=>link.threadId!==run.threadId).map(link=><Button size="small" key={link.threadId} onClick={()=>onOpenCodexSession?onOpenCodexSession(link.threadId):void perform('session',async()=>setRawSession(await window.forgeDesk.getCodexSession(link.threadId)))}>查看节点会话</Button>)}</Space>
          <List size="small" pagination={{pageSize:5,hideOnSinglePage:true}} dataSource={run.delivery?.events} renderItem={event=><List.Item><Space direction="vertical" size={0}><Typography.Text>{event.message}</Typography.Text>{event.detail?<Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{event.detail}</Typography.Paragraph>:null}<Typography.Text type="secondary">{new Date(event.createdAt).toLocaleString()}</Typography.Text></Space></List.Item>}/>
        </Card>)}
        </>:null}
        {fullDetail&&detailTab==='history'?<><Typography.Text strong>变更历史</Typography.Text><List size="small" dataSource={snapshot?.events.filter(event=>event.entityId===selected.id)} renderItem={event=><List.Item><Space direction="vertical"><span>{progressEventLabels[event.eventType]||event.eventType} · {new Date(event.occurredAt).toLocaleString()}</span><details><summary>查看变更前后</summary><pre className="progress-event-detail">{JSON.stringify({before:event.before,after:event.after},null,2)}</pre></details></Space></List.Item>}/></>:null}
      </Space>:null}
    </Drawer>

    <Modal open={workModal} title={editing?'编辑任务':parentId?'添加任务节点':'新建原生任务'} okText="保存" cancelText="取消" confirmLoading={busy==='save'} onCancel={()=>setWorkModal(false)} onOk={()=>void perform('save',saveWork)}>
      <Form name="progress-work" form={workForm} layout="vertical"><Form.Item name="title" label="任务名称" rules={[{required:true,whitespace:true}]}><Input/></Form.Item><Form.Item name="description" label="工作说明"><Input.TextArea rows={3}/></Form.Item><Form.Item name="acceptanceText" label="验收条件"><Input.TextArea rows={2}/></Form.Item>
        {!parentId?<Form.Item name="projectId" label="项目"><Select allowClear disabled={!!editing} placeholder="未选择时进入收件箱" options={projectOptions} onChange={()=>workForm.setFieldsValue({goalId:null,milestoneId:null,versionId:null})}/></Form.Item>:null}
        {!editing&&!parentId?(Object.keys(kindLabels) as ProgressScopeKind[]).map(kind=><Form.Item key={kind} name={`${kind}Id`} label={kindLabels[kind]}><Select allowClear disabled={!workProject} options={scopeOptions(kind,workProject)}/></Form.Item>):null}
        <Form.Item name="ownerRef" label="负责人"><Input/></Form.Item><Form.Item name="priority" label="优先级"><Select options={[{value:'low',label:'低'},{value:'medium',label:'中'},{value:'high',label:'高'}]}/></Form.Item><div className="progress-form-dates"><Form.Item name="startDate" label="开始日期"><ProgressDateInput/></Form.Item><Form.Item name="dueDate" label="计划完成日期"><ProgressDateInput/></Form.Item></div><Form.Item name="tags" label="标签"><Select mode="tags" tokenSeparators={[',','，']}/></Form.Item>
      </Form>
    </Modal>
    <Modal open={!!scopeItem} title="调整项目与目标范围" okText="保存归属" cancelText="取消" onCancel={()=>setScopeItem(null)} onOk={()=>void perform('scope',async()=>{if(!scopeItem)return;const values=await scopeForm.validateFields();await send({type:'move',id:scopeItem.id,expectedVersion:scopeItem.rowVersion,scope:{projectId:values.projectId||null,goalId:values.goalId||null,milestoneId:values.milestoneId||null,versionId:values.versionId||null}});setScopeItem(null)})}>
      <Form name="progress-scope" form={scopeForm} layout="vertical"><Form.Item name="projectId" label="项目"><Select allowClear options={projectOptions} onChange={()=>scopeForm.setFieldsValue({goalId:null,milestoneId:null,versionId:null})}/></Form.Item>{(Object.keys(kindLabels) as ProgressScopeKind[]).map(kind=><Form.Item key={kind} name={`${kind}Id`} label={kindLabels[kind]}><Select allowClear disabled={!scopeProject} options={scopeOptions(kind,scopeProject)}/></Form.Item>)}</Form>
    </Modal>
    <Modal open={entityModal} title={`${entityEdit?'编辑':'新建'}${kindLabels[entityKind]}`} okText="保存" cancelText="取消" confirmLoading={busy==='entity'} onCancel={()=>setEntityModal(false)} onOk={()=>void perform('entity',saveEntity)}>
      <Form name="progress-entity" form={entityForm} layout="vertical"><Form.Item name="projectId" label="项目" rules={[{required:true}]}><Select disabled={!!entityEdit} options={projectOptions}/></Form.Item><Form.Item name="title" label="名称" rules={[{required:true,whitespace:true}]}><Input/></Form.Item><Form.Item name="description" label="说明"><Input.TextArea rows={3}/></Form.Item><Form.Item name="criteriaText" label="达成条件"><Input.TextArea/></Form.Item><Form.Item name="ownerRef" label="负责人"><Input/></Form.Item><Form.Item name="targetDate" label="目标日期"><ProgressDateInput/></Form.Item><Form.Item name="status" label="状态"><Select options={(entityKind==='goal'?['draft','active','achieved','cancelled']:entityKind==='milestone'?['planned','achieved','cancelled']:['planned','active','closed','archived']).map(value=>({value,label:entityStatusLabels[value]}))}/></Form.Item></Form>
    </Modal>
    <Modal open={!!draftRoot} title="编辑计划草稿" width={780} okText="保存草稿" cancelText="取消" onCancel={()=>setDraftRoot(null)} onOk={()=>void perform('draft',savePlan)}>
      <Typography.Paragraph type="secondary">草稿不直接改动任务。保存后核对新增、变更和移出项，再确认应用。</Typography.Paragraph>
      {draftNodes.map((node,index)=><Form.Item key={node.id} label={`节点 ${index+1} 关联已有工作（可选）`}><Select allowClear placeholder="作为新节点" value={node.existingWorkItemId} options={items.filter(item=>item.parentId===draftRoot?.id&&item.status!=='cancelled').map(item=>({value:item.id,label:`${item.title} · ${workStatusLabels[item.status]}`}))} onChange={existingWorkItemId=>setDraftNodes(nodes=>nodes.map(item=>item.id===node.id?{...item,existingWorkItemId}:item))}/></Form.Item>)}
      {draftNodes.map((node,index)=><Card size="small" key={node.id} className="progress-plan-node"><Space direction="vertical" style={{width:'100%'}}><Space><Typography.Text>节点 {index+1}</Typography.Text><Button size="small" onClick={()=>setDraftNodes(nodes=>nodes.filter(item=>item.id!==node.id).map(item=>({...item,dependencyIds:item.dependencyIds.filter(id=>id!==node.id)})))}>移出草稿</Button></Space><Input aria-label={`节点 ${index+1} 标题`} value={node.title} placeholder="节点名称" onChange={event=>setDraftNodes(nodes=>nodes.map(item=>item.id===node.id?{...item,title:event.target.value}:item))}/><Input.TextArea value={node.description} placeholder="说明" onChange={event=>setDraftNodes(nodes=>nodes.map(item=>item.id===node.id?{...item,description:event.target.value}:item))}/><Input value={node.acceptanceText} placeholder="验收条件" onChange={event=>setDraftNodes(nodes=>nodes.map(item=>item.id===node.id?{...item,acceptanceText:event.target.value}:item))}/><Select mode="multiple" style={{width:'100%'}} placeholder="前置节点" value={node.dependencyIds} options={draftNodes.filter(item=>item.id!==node.id).map(item=>({value:item.id,label:item.title||'未命名节点'}))} onChange={dependencyIds=>setDraftNodes(nodes=>nodes.map(item=>item.id===node.id?{...item,dependencyIds}:item))}/></Space></Card>)}
      <Button icon={<PlusOutlined/>} onClick={()=>setDraftNodes(nodes=>[...nodes,{id:commandId(),title:'',description:'',acceptanceText:'',dependencyIds:[]}])}>新增节点</Button>
    </Modal>
    <Modal open={!!previewDraft} title="确认计划差异" okText="确认应用" cancelText="暂不应用" onCancel={()=>setPreviewDraft(null)} onOk={()=>void perform('apply',async()=>{if(!previewDraft)return;const parent=items.find(item=>item.id===previewDraft.workItemId);if(!parent)throw new Error('父任务已变化，请刷新');await send({type:'apply-draft',draftId:previewDraft.id,draftVersion:previewDraft.draftVersion,expectedVersion:parent.rowVersion});setPreviewDraft(null)})}>
      <Space><Tag color="success">新增 {changes?.added.length}</Tag><Tag color="processing">修改 {changes?.changed.length}</Tag><Tag color="warning">移出 {changes?.removed.length}</Tag></Space>
      <Space wrap style={{marginTop:12}}><Button onClick={()=>{if(!previewDraft)return;setDraftRoot(items.find(item=>item.id===previewDraft.workItemId)??null);setDraftNodes(previewDraft.items);setPreviewDraft(null)}}>修改草稿／关联已有节点</Button><Button danger onClick={()=>void perform('discard',async()=>{if(!previewDraft)return;const root=items.find(item=>item.id===previewDraft.workItemId);if(!root)return;await send({type:'discard-draft',id:root.id,expectedVersion:root.rowVersion,draftId:previewDraft.id,draftVersion:previewDraft.draftVersion});setPreviewDraft(null)})}>放弃草稿</Button></Space>
      <List dataSource={previewDraft?.items} renderItem={item=><List.Item><Space direction="vertical"><Typography.Text strong>{item.title}</Typography.Text><Typography.Text>{item.acceptanceText||item.description}</Typography.Text></Space></List.Item>}/>
      {changes?.removed.length?<Alert type="warning" message={`移出：${changes.removed.map(item=>item.title).join('、')}`} description="保留历史，不会删除已执行记录；已验收节点需要先显式调整。"/>:null}
    </Modal>
    <Drawer open={!!rawSession} onClose={()=>setRawSession(null)} title={rawSession?.title} width={760}>{rawSession?.items.filter(item=>['user','assistant'].includes(item.kind)).map(item=><Typography.Paragraph key={item.id} style={{whiteSpace:'pre-wrap'}}><Tag>{item.kind==='user'?'你':'AI'}</Tag>{item.text}</Typography.Paragraph>)}</Drawer>
    <Modal open={rawRepair!==null} title="核对旧待办原文" width={800} okText="备份原文并保存修复" cancelText="不修改" onCancel={()=>setRawRepair(null)} onOk={()=>void perform('raw-repair',saveRawRepair)}><Alert showIcon type="warning" message="仅在迁移前修复异常记录" description="保存前会额外备份现有原文，历史迁移预览中的快照也不会被覆盖。确认 ID、状态、日期与子节点无误后再保存。"/><Input.TextArea aria-label="旧待办存储原文" rows={18} value={rawRepair??''} onChange={event=>setRawRepair(event.target.value)} style={{marginTop:16,fontFamily:'monospace'}}/></Modal>
  </section>
}
