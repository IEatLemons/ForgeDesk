import assert from 'node:assert/strict'
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import Database from 'better-sqlite3'
import { execFileSync } from 'node:child_process'

export async function verifyProjectCards(window, directory, requests, ipcCalls) {
  const js = code => window.webContents.executeJavaScript(code)
  const invoke = (name,...args) => js(`window.forgeDesk[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
  const delay = ms=>new Promise(resolve=>setTimeout(resolve,ms))
  async function until(expression,label) { const deadline=Date.now()+15000; while(Date.now()<deadline) { if(await js(expression).catch(()=>false))return; await delay(90) } throw Error(`Timed out: ${label}`) }
  async function click(selector,label) { await until(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(node=>node.getClientRects().length&&!node.disabled&&node.textContent.replaceAll(' ','').trim()===${JSON.stringify(label.replaceAll(' ',''))})`,`enabled ${label}`); assert.ok(await js(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.getClientRects().length&&!node.disabled&&node.textContent.replaceAll(' ','').trim()===${JSON.stringify(label.replaceAll(' ',''))});if(!node)return false;node.click();return true})()`),`Missing ${label}`); await delay(150) }
  async function input(selector,value) { await js(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}))})()`); await delay(200) }
  async function reload() { await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload()}); await until(`!!document.querySelector('.project-directory-grid')`,'default project cards') }
  const commonSelectors=['.project-directory-heading','.project-group-filter','.portfolio-overview','.portfolio-view-bar']
  async function commonSnapshot(remember=false) {
    await js(`document.querySelector('.workspace-content').scrollTop=0`)
    await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    return js(`(()=>{const selectors=${JSON.stringify(commonSelectors)},nodes=selectors.map(selector=>document.querySelector(selector));if(${remember})window.__qaCommonLayoutNodes=nodes;return nodes.map((node,index)=>{const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return {selector:selectors[index],sameNode:window.__qaCommonLayoutNodes[index]===node,rect:[rect.left,rect.top,rect.width,rect.height].map(value=>Math.round(value*100)/100),style:['display','gap','padding','margin','fontSize','color','backgroundColor','borderRadius'].map(name=>style[name])}})})()`)
  }
  async function verifySharedLayout(label) {
    const cards=await commonSnapshot(true)
    const ids=await js(`[...document.querySelectorAll('.project-directory-card')].map(card=>card.dataset.projectId)`)
    await click('.ant-segmented-item-label','列表')
    await until(`!!document.querySelector('.project-list-table')`,'shared list result')
    const list=await commonSnapshot()
    assert.deepEqual(list,cards,`${label}: common controls retain nodes, styles and position`)
    assert.deepEqual(await js(`[...document.querySelectorAll('.project-list-table tr[data-row-key]')].map(row=>row.dataset.rowKey)`),ids,`${label}: same filtered projects and ordering`)
    assert.equal(await js(`document.querySelectorAll('[aria-label="项目展示方式"]').length`),1,'One shared view switch')
    await writeFile(join(directory,`project-shared-layout-${label}-list.png`),(await window.capturePage()).toPNG())
    await click('.ant-segmented-item-label','卡片')
    await until(`!!document.querySelector('.project-directory-grid')`,'shared card result')
    assert.deepEqual(await commonSnapshot(),cards,`${label}: shared layout after return`)
    await writeFile(join(directory,`project-shared-layout-${label}-cards.png`),(await window.capturePage()).toPNG())
    return cards
  }
  async function measureRows(label) {
    await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    const result=await js(`(()=>{
      const rows=new Map();
      for(const card of document.querySelectorAll('.project-directory-card')) {
        const rect=card.getBoundingClientRect(),footer=card.querySelector('.directory-card-footer').getBoundingClientRect(),key=Math.round(rect.top);
        const row=rows.get(key)||[];row.push({id:card.dataset.projectId,height:rect.height,bottom:rect.bottom,footerBottom:footer.bottom,configured:!!card.querySelector('.directory-service')});rows.set(key,row);
        for(const child of card.querySelectorAll('.directory-card-heading,.directory-group-label,.directory-environment-status,.directory-service-links,.directory-service-bottom > .directory-inline-time')) {
          if(!child.getClientRects().length)continue;
          const bounds=child.getBoundingClientRect();if(bounds.left<rect.left-1||bounds.right>rect.right+1)throw Error('Card content overflows: '+child.className);
        }
        for(const links of card.querySelectorAll('.directory-service-links')) {
          if(!links.getClientRects().length)continue;
          const time=links.parentElement.querySelector('.directory-inline-time');
          if(time&&links.getBoundingClientRect().top<time.getBoundingClientRect().bottom-1)throw Error('Freshness and actions overlap');
        }
      }
      return [...rows.values()];
    })()`)
    for(const row of result) {
      assert.ok(Math.max(...row.map(card=>card.height))-Math.min(...row.map(card=>card.height))<1,`${label}: equal row heights`)
      assert.ok(Math.max(...row.map(card=>card.footerBottom))-Math.min(...row.map(card=>card.footerBottom))<1,`${label}: aligned card footers`)
    }
    return result
  }
  const longName='线上项目与任务运行情况验收 · 较长的项目名称用于检查窄窗口自动换行'
  let workspace=await invoke('createEmptyProject',{name:longName,parentPath:directory})
  const project=workspace.projects.find(item=>item.name===longName)
  workspace=await invoke('createEmptyProject',{name:'未配置线上信息 QA-empty',parentPath:directory})
  const other=workspace.projects.find(item=>item.name==='未配置线上信息 QA-empty')
  workspace=await invoke('createEmptyProject',{name:'归档项目 QA-archived',parentPath:directory})
  const archived=workspace.projects.find(item=>item.name==='归档项目 QA-archived')
  await invoke('setProjectArchived',{id:archived.id,archived:true})
  await invoke('saveProjectGroup',{name:'卡片分组验收'})
  const designProjects=[]
  for(let index=1;index<=4;index++) {
    const name=`视觉验收 QA-design-${index}`
    const workspace=await invoke('createEmptyProject',{name,parentPath:directory})
    designProjects.push(workspace.projects.find(item=>item.name===name).id)
  }
  execFileSync('git',['init','--initial-branch=main',other.workspacePath])
  await writeFile(join(other.workspacePath,'qa-development.txt'),'isolated development change')
  await invoke('rescanProjectRepositories',other.id)
  const connection=await invoke('saveServiceConnection',{projectId:project.id,provider:'vercel',name:'隔离 Vercel',token:'qa-not-a-real-token',teamId:'team-qa'})
  for(const name of ['operations-web','第二个线上服务'])await invoke('saveProjectService',{projectId:project.id,provider:'vercel',connectionId:connection.id,name,externalProjectId:'prj-operations-qa',environments:[{name:'preview'},{name:'production'}]})
  const operations=await invoke('refreshProjectOperations',{projectId:project.id,force:true})
  await invoke('checkProjectServices',project.id)
  await js(`localStorage.setItem('forgedesk:app-mode:v1','full');localStorage.removeItem('forgedesk:project-directory-view:v1');localStorage.setItem('forgedesk:theme-preference:v1','light')`)
  window.setSize(1440,1000);window.show();window.focus()
  await reload()
  assert.ok(!(await js(`document.querySelector('[aria-label="主导航"]').textContent`)).includes('工作台工作台'))
  assert.deepEqual(await js(`[...document.querySelectorAll('[aria-label="主导航"] > .ant-menu > .ant-menu-item')].map(node=>node.textContent.trim())`),['概览','项目','任务','AI 工作台'])
  const card=`.project-directory-card[data-project-id="${project.id}"]`
  await until(`document.querySelector(${JSON.stringify(card)})?.textContent.includes('尚未初始化')`,'inactive summary')
  assert.ok(await js(`document.querySelector(${JSON.stringify(card)})?.textContent.includes('前往核对')`))
  await until(`document.querySelectorAll('.project-directory-card').length===6`,'six project cards')
  assert.equal(await js(`document.querySelectorAll('.directory-task-metric').length`),0,'No empty metrics when task progress is disabled')
  assert.equal(await js(`document.querySelectorAll('.project-directory-card .ant-select').length`),0,'Group editors are tucked away')
  await new Promise(requestAnimationFrame => setTimeout(requestAnimationFrame,300))
  await writeFile(join(directory,'project-cards-six-projects.png'),(await window.capturePage()).toPNG())
  await writeFile(join(directory,'project-cards-preview.png'),(await window.capturePage({x:232,y:280,width:1198,height:535})).toPNG())
  const compact=await js(`(()=>{const cards=[...document.querySelectorAll('.project-directory-card')];return {columns:getComputedStyle(document.querySelector('.project-directory-grid')).gridTemplateColumns,unconfiguredHeights:cards.filter(card=>!card.querySelector('.directory-service')).map(card=>card.getBoundingClientRect().height)}})()`)
  const initialRows=await measureRows('six projects with mixed content')
  assert.ok(initialRows.flat().every(card=>card.height<600),'Decision summaries remain bounded with runtime detail collapsed')
  assert.ok(await js(`document.querySelector('.portfolio-overview').textContent.includes('信息待完善')`))
  assert.ok(await js(`document.querySelector('.project-directory-card[data-project-id="${other.id}"] .portfolio-development').textContent.includes('1 仓库有改动')`))
  for(const id of designProjects)await invoke('setProjectArchived',{id,archived:true})
  await until(`document.querySelectorAll('.project-directory-card').length===2`,'active fixture projects')
  async function selectCardGroup(label) {
    await js(`document.querySelector(${JSON.stringify(card+' button[aria-label="更改项目分组：'+longName+'"]')}).click()`)
    await until(`!!document.querySelector('.ant-popover .ant-select-selector')`,'inline group editor')
    await js(`document.querySelector('.ant-popover .ant-select-selector').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
    await click('.ant-select-item-option-content',label)
    await until(`document.querySelector(${JSON.stringify(card+' .directory-group-label')})?.textContent.includes(${JSON.stringify(label)})`,'group changed without navigation')
    assert.ok(await js(`!!document.querySelector('.project-directory-grid')?.getClientRects().length`))
  }
  await selectCardGroup('卡片分组验收')
  await measureRows('group editing')
  await selectCardGroup('未分组')
  await invoke('initializeTaskWorkspace',{})
  const create=async(title,patch={})=>(await invoke('runTaskCommand',{type:'save-task',commandId:crypto.randomUUID(),input:{title,projectIds:[project.id],...patch}})).entityId
  const parent=await create('父任务',{priority:'high'})
  await create('紧急子任务',{parentId:parent,priority:'high'})
  await create('普通子任务',{parentId:parent})
  await create('逾期任务',{dueDate:'2026-01-01'})
  const task=await create('紧急任务',{priority:'high'})
  const finish=await create('待收尾父任务')
  await create('已完成子任务',{parentId:finish,done:true})
  await until(`document.querySelector(${JSON.stringify(card+' [aria-label="'+longName+' 紧急 2"]')})`,'live progress broadcast')
  const text=await js(`document.querySelector(${JSON.stringify(card)}).textContent`)
  for(const label of ['2 个服务','production','部署就绪','7b53731','部署失败','1 在线','同步：','检查：'])assert.ok(text.includes(label),label)
  assert.ok(await js(`!!document.querySelector(${JSON.stringify(card+' [aria-label="最新部署（与当前生产版本不同）"]')})`))
  assert.equal(await js(`document.querySelectorAll('.project-directory-card').length`),2)
  assert.ok(await js(`document.querySelector('.project-directory-card[data-project-id="${other.id}"]').textContent.includes('配置线上服务')`))
  await js(`document.querySelector(${JSON.stringify(card+' button[aria-label="收藏项目 '+longName+'"]')}).click()`)
  await until(`!!document.querySelector(${JSON.stringify(card+' button[aria-label="取消收藏项目 '+longName+'"]')})`,'favorite update without navigation')
  assert.ok(await js(`!!document.querySelector('.project-directory-grid')?.getClientRects().length`))
  const before=requests.length
  await click(`${card} button`,'进入项目')
  await until(`document.querySelector('[aria-label="项目目录"]')`,'project opened')
  await click('[aria-label="主导航"] .ant-menu-item','项目')
  await until(`document.querySelector('.project-directory-grid')?.getClientRects().length`,'returned projects')
  // Card reads are local. Do not include project-overview refreshes in this count.
  const directoryRequests=requests.length
  await click('.project-list-heading button,.section-heading button','刷新摘要');await delay(300)
  assert.equal(requests.length,directoryRequests,'Directory refresh does not contact providers')
  await click(`${card} .directory-task-metric`,'紧急2')
  await until(`document.querySelector('[aria-label="项目任务列表"]')?.textContent.includes('全部关联任务')`,'urgent destination')
  const taskText=await js(`document.querySelector('[aria-label="项目任务列表"] .ant-list').textContent`)
  assert.ok(taskText.includes('紧急任务'));assert.ok(!taskText.includes('逾期任务'))
  await click('[aria-label="项目任务列表"] button','全部关联任务')
  await until(`!document.querySelector('[aria-label="项目任务列表"]')?.textContent.includes('全部关联任务')`,'filter cleared')
  await click('[aria-label="主导航"] .ant-menu-item','项目')
  await js(`document.querySelector(${JSON.stringify(card+' .portfolio-runtime-details')}).open=true`)
  const logService=await js(`document.querySelector(${JSON.stringify(card+' .directory-service .directory-summary-line .ant-typography')}).textContent`)
  await click(`${card} button`,'日志')
  await until(`document.querySelector('.operations-monitoring')`,'context logs')
  assert.ok((await js(`document.querySelector('[aria-label="筛选服务"]').textContent`)).includes(logService))
  assert.match(await js(`document.querySelector('[aria-label="筛选环境"]').textContent`),/production/)
  await click('[aria-label="主导航"] .ant-menu-item','项目')
  // Search changes while an older summary reply is in flight.
  ipcCalls.directoryControl={delayOnce:true}
  await click('.project-list-heading button,.section-heading button','刷新摘要')
  await input('[aria-label="查找项目"]','未配置线上信息 QA-empty')
  await until(`document.querySelectorAll('.project-directory-card').length===1`,'search isolated')
  await delay(1000)
  assert.equal(await js(`document.querySelector('.project-directory-card').dataset.projectId`),other.id)
  await input('[aria-label="查找项目"]','')
  await until(`document.querySelectorAll('.project-directory-card').length===2`,'search restored')
  await click('.ant-segmented-item-label','列表')
  await until(`!!document.querySelector('.project-list-table')`,'list view')
  assert.ok(await js(`document.querySelector('.project-list-heading').textContent.includes('Fetch 所选')`))
  await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload()})
  await until(`!!document.querySelector('.project-list-table')`,'remembered list view')
  await click('.ant-segmented-item-label','卡片')
  await click('.section-heading button','归档项目')
  await until(`[...document.querySelectorAll('.project-directory-card')].some(card=>card.dataset.projectId===${JSON.stringify(archived.id)})`,'archive view')
  await click('.section-heading button','当前项目')
  await until(`document.querySelectorAll('.project-directory-card').length===2`,'active projects')
  window.hide();await until(`document.visibilityState==='hidden'`,'window hidden')
  const readsBefore=ipcCalls.filter(call=>call.channel==='project:directory:summaries').length
  await js(`window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))`);await delay(300)
  assert.equal(ipcCalls.filter(call=>call.channel==='project:directory:summaries').length,readsBefore)
  window.show();window.focus();await until(`document.visibilityState==='visible'`,'window visible');await delay(500)
  assert.ok(ipcCalls.filter(call=>call.channel==='project:directory:summaries').length>readsBefore)
  const otherConnection=await invoke('saveServiceConnection',{projectId:other.id,provider:'vercel',name:'长内容排版隔离连接',token:'qa-not-a-real-token',teamId:'team-qa'})
  await invoke('saveProjectService',{projectId:other.id,provider:'vercel',connectionId:otherConnection.id,name:'global-search-intelligence-web-with-a-very-long-service-name-for-layout',externalProjectId:'prj-operations-qa',environments:[{name:'production'},{name:'preview-feature-user-management-and-permission-migration'}],domains:[{domain:'a-very-long-service-domain-name-for-layout-verification.operations.test',environmentName:'production',kind:'manual',enabled:true}]})
  await until(`!!document.querySelector('.project-directory-card[data-project-id="${other.id}"] .directory-service')`,'long service metadata')
  // Owner filters count projects rather than adding overlapping task badges.
  await js(`document.querySelector('.portfolio-stat.stat-attention').click()`)
  await until(`document.querySelectorAll('.project-directory-card').length>=1 && [...document.querySelectorAll('.project-directory-card')].every(card=>card.classList.contains('status-3'))`,'owner attention filter')
  assert.ok(await js(`[...document.querySelectorAll('.project-directory-card')].every(card=>card.classList.contains('status-3'))`))
  await js(`document.querySelector('.portfolio-stat.stat-review').click()`)
  await until(`document.querySelectorAll('.project-directory-card').length===1`,'owner acceptance filter')
  await verifySharedLayout('review')
  await js(`document.querySelector('.portfolio-stat.stat-all').click()`)
  await until(`document.querySelectorAll('.project-directory-card').length===2`,'owner all filter')
  await input('[aria-label="查找项目"]','QA-empty')
  await verifySharedLayout('search')
  await click('.ant-segmented-item-label','列表')
  await js(`document.querySelector('.project-list-table tr[data-row-key] .ant-checkbox-input').click()`)
  await until(`document.querySelector('.project-list-table tr[data-row-key] .ant-checkbox-input')?.checked`,'selection before shared filtering')
  await input('[aria-label="查找项目"]','')
  await js(`document.querySelector('.portfolio-stat.stat-review').click()`)
  await until(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===1`,'list status filter')
  assert.ok(await js(`[...document.querySelectorAll('[aria-label="列表 Git 操作"] button')].find(button=>button.textContent.includes('Fetch 所选')).disabled`),'Hidden selected projects cannot enter batch Git actions')
  await js(`document.querySelector('.portfolio-stat.stat-all').click()`)
  await until(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===2`,'restore shared filter')
  assert.ok(await js(`document.querySelector('.project-list-table tr[data-row-key="${other.id}"] .ant-checkbox-input')?.checked`),'List selection survives shared filtering')
  await js(`document.querySelector('[aria-label="项目排序"] .ant-select-selector').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await click('.ant-select-item-option-content','按原分组顺序')
  await click('.ant-segmented-item-label','卡片')
  await verifySharedLayout('group-order')
  await js(`document.querySelector('[aria-label="项目排序"] .ant-select-selector').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await click('.ant-select-item-option-content','需要关注的优先')
  assert.ok(await js(`document.querySelector('.project-directory-card').classList.contains('status-3')`),'Needs attention sorts first')
  assert.ok(await js(`[...document.querySelectorAll('.portfolio-runtime-details')].every(details=>!details.open)`),'Technical details collapsed by default')
  const layouts=[]
  window.setMinimumSize(520,500)
  for(const theme of ['light','dark'])for(const width of [1440,760,560]) {
    window.setSize(width,1000)
    await js(`localStorage.setItem('forgedesk:theme-preference:v1',${JSON.stringify(theme)});window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
    await until(`document.documentElement.dataset.theme===${JSON.stringify(theme)} && getComputedStyle(document.querySelector('.project-directory-card')).backgroundColor===${JSON.stringify(theme==='dark'?'rgb(16, 23, 33)':'rgb(255, 255, 255)')}`,'theme styles applied')
    await until(`(parseFloat(getComputedStyle(document.querySelector('.ant-segmented-item-selected')).color.match(/[0-9.]+/)[0])>100)===${theme==='dark'}`,'theme control styles applied')
    await delay(200)
    const layout=await js(`(()=>{const card=document.querySelector('.project-directory-card'),body=card.querySelector('.ant-card-body'),grid=document.querySelector('.project-directory-grid');return {width:innerWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(grid).gridTemplateColumns,gap:getComputedStyle(body).gap}})()`)
    assert.equal(layout.width,layout.scroll,'No page horizontal overflow');layouts.push({theme,...layout,rows:await measureRows(`${theme} ${width}`)})
    await writeFile(join(directory,`project-cards-${theme}-${width}.png`),(await window.capturePage()).toPNG())
    await verifySharedLayout(`${theme}-${width}`)
  }
  window.setSize(1440,1000)
  await delay(200)
  window.webContents.sendInputEvent({type:'mouseMove',x:300,y:100})
  await js(`document.querySelector('.section-heading').click();document.activeElement?.blur()` )
  // An actual six-project owner view: urgent, acceptance, pending tracking,
  // local Git changes and configured/unconfigured production services together.
  for(const id of designProjects)await invoke('setProjectArchived',{id,archived:false})
  await invoke('runTaskCommand',{type:'save-task',commandId:crypto.randomUUID(),input:{title:'开发中的功能',projectIds:[designProjects[0]]}})
  await until(`document.querySelectorAll('.project-directory-card').length===6`,'owner portfolio preview')
  await js(`document.querySelector('.workspace-content').scrollTop=0`)
  await writeFile(join(directory,'project-portfolio-dark.png'),(await window.capturePage()).toPNG())
  await js(`localStorage.setItem('forgedesk:theme-preference:v1','light');window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
  await until(`document.documentElement.dataset.theme==='light'`,'owner light preview')
  await delay(300)
  await writeFile(join(directory,'project-portfolio-light.png'),(await window.capturePage()).toPNG())
  await js(`localStorage.setItem('forgedesk:theme-preference:v1','dark');window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
  for(const id of designProjects)await invoke('setProjectArchived',{id,archived:true})
  await until(`document.querySelectorAll('.project-directory-card').length===2`,'owner preview restored')
  // Actual SQLite cache staleness, source errors and per-project corrupt task data.
  const db=new Database(join(directory,'profile','forgedesk.db'))
  try {
    const service=operations.services[0]
    const row=db.prepare('SELECT state_json FROM project_service_operations WHERE service_id=?').get(service.id)
    const state=JSON.parse(row.state_json)
    state.sources.production.updatedAt='2026-01-01T00:00:00Z';state.sources.domains.error='认证失败，请检查连接'
    db.prepare('UPDATE project_service_operations SET state_json=? WHERE service_id=?').run(JSON.stringify(state),service.id)
    window.__qaOriginalTask=db.prepare('SELECT data_json FROM task_workspace_task WHERE id=?').get(task).data_json
    db.prepare('UPDATE task_workspace_task SET data_json=? WHERE id=?').run(JSON.stringify({...JSON.parse(window.__qaOriginalTask),projectIds:null}),task)
  }finally{db.close()}
  assert.equal((await invoke('readProjectDirectorySummaries',{projectIds:[project.id,other.id]}))[0].tasks.counts,null)
  await click('.project-list-heading button,.section-heading button','刷新摘要')
  await until(`document.querySelector(${JSON.stringify(card)})?.textContent.includes('任务状态未知')`,'corrupt project isolated')
  const failureText=await js(`document.querySelector(${JSON.stringify(card)}).textContent`)
  assert.ok(failureText.includes('已过期'));assert.ok(failureText.includes('检查服务配置'))
  assert.ok(await js(`document.querySelector('.project-directory-card[data-project-id="${other.id}"]').textContent.includes('任务状态未知')`),'A corrupt shared task store invalidates every project task count')
  const unevenRows=await measureRows('partial failure and stale cache')
  await js(`[...document.querySelectorAll('.portfolio-runtime-details')].forEach(details=>details.open=true)`)
  await js(`(()=>{const details=document.querySelector(${JSON.stringify(card+' .directory-domain-details')});if(!details)throw Error('Domain disclosure missing');details.open=true})()`)
  await js(`document.querySelector('.project-directory-card[data-project-id="${other.id}"] .directory-other-environments').open=true`)
  const expandedRows=await measureRows('expanded runtime details and long environment name')
  await js(`document.querySelector(${JSON.stringify(card+' .directory-domain-details')}).open=false;document.querySelector('.project-directory-card[data-project-id="${other.id}"] .directory-other-environments').open=false`)
  window.setSize(760,800)
  await delay(200)
  await js(`document.querySelector('[aria-label="打开终端面板"]').click()`)
  await until(`!!document.querySelector('.workspace-terminal-host')?.getClientRects().length`,'terminal panel open')
  const terminalLayout=await js(`(()=>{const content=document.querySelector('.workspace-content');content.scrollTop=content.scrollHeight;return {lastCardBottom:Math.max(...[...document.querySelectorAll('.project-directory-card')].map(card=>card.getBoundingClientRect().bottom)),terminalTop:document.querySelector('.workspace-terminal-host').getBoundingClientRect().top}})()`)
  assert.ok(terminalLayout.lastCardBottom<=terminalLayout.terminalTop+1,'Last card stays reachable above the terminal')
  await writeFile(join(directory,'project-cards-aligned-terminal.png'),(await window.capturePage()).toPNG())
  const repaired=new Database(join(directory,'profile','forgedesk.db'));try{repaired.prepare('UPDATE task_workspace_task SET data_json=? WHERE id=?').run(window.__qaOriginalTask,task)}finally{repaired.close()}
  // Existing independent window restores its own project location.
  await invoke('openProjectWindow',other.id)
  let child;for(let attempt=0;attempt<80;attempt++){child=BrowserWindow.getAllWindows().find(item=>item.id!==window.id);if(child)break;await delay(100)}
  assert.ok(child)
  await delay(900)
  assert.ok(await child.webContents.executeJavaScript(`!!document.querySelector('[aria-label="项目目录"]')`))
  await child.webContents.executeJavaScript(`window.forgeDesk.deleteServiceConnection(${JSON.stringify(connection.id)})`)
  await until(`!document.querySelector(${JSON.stringify(card+' .directory-service')}) && document.querySelector(${JSON.stringify(card)})?.textContent.includes('配置线上服务')`,'cross-window connection removal')
  child.destroy()
  const report={projectId:project.id,defaultProjects:true,ownerFilters:true,sharedLayout:true,sharedFilters:true,sharedSorting:true,hiddenSelectionSafe:true,developmentCache:true,cardAndList:true,rememberedView:true,taskCounts:true,urgentContext:true,sourceIsolation:true,cacheOnly:true,hiddenPaused:true,staleReplyIsolation:true,productionSeparate:true,serviceContext:true,archivedFilter:true,connectionRemovalBroadcast:true,groupEditor:true,compact,initialRows,unevenRows,expandedRows,terminalLayout,layouts,platformMutations:requests.filter(item=>!['GET','HEAD'].includes(item.method)).length}
  await writeFile(join(directory,'project-cards-report.json'),JSON.stringify(report,null,2))
  console.log('PROJECT_CARDS_QA_REPORT '+JSON.stringify(report))
}
