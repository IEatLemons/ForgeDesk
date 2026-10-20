// Disposable, real-Electron benchmark. Never opens the user's profile or remote repositories.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'

export async function measureProjectList(window, directory, ipcCalls) {
  const js = source => window.webContents.executeJavaScript(source)
  const invoke = (name, ...args) => js(`window.forgeDesk[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
  const exec = promisify(execFile)
  for (let index = 0; index < 19; index++) {
    const snapshot = await invoke('createEmptyProject', { name: `性能验收项目-${String(index + 1).padStart(2, '0')}`, parentPath: directory })
    const project = snapshot.projects.find(item => item.name === `性能验收项目-${String(index + 1).padStart(2, '0')}`)
    await invoke('initializeProjectRepository', project.id)
    if (index === 0) {
      const nested = join(project.workspacePath, 'nested')
      await mkdir(nested)
      await exec('git', ['init', nested])
      await invoke('rescanProjectRepositories', project.id)
    }
  }
  await js(`(async()=>{const snapshot=await window.forgeDesk.listProjects();for(let i=0;i<206;i++)await window.forgeDesk.saveProjectGitTask({id:'perf-log-'+i,projectId:snapshot.projects[i%19].id,projectName:snapshot.projects[i%19].name,action:'fetch',status:'success',startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),summary:'隔离历史记录',repositoryResults:[]})})()`)
  await js(`localStorage.setItem('forgedesk:app-mode:v1','full');localStorage.setItem('forgedesk:workspace-layout:v2','hierarchical')`)
  window.setSize(1360, 900)
  window.show(); window.focus(); app.focus({ steal: true })
  await window.webContents.debugger.attach('1.3')
  await window.webContents.debugger.sendCommand('Page.enable')
  await window.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__listPerf={commits:0,longTasks:[]};
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>1,onCommitFiberRoot:()=>window.__listPerf.commits++,onCommitFiberUnmount:()=>{}};
    new PerformanceObserver(list=>window.__listPerf.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  ` })
  await new Promise(resolve => { window.webContents.once('did-finish-load', resolve); window.webContents.reload() })
  await new Promise(resolve => setTimeout(resolve, 1500))
  const samples = []
  for (let index = 0; index < 20; index++) {
    window.focus()
    await js(`document.querySelector('[aria-label="主导航"] [data-menu-id$="workbench"]')?.click()`)
    await new Promise(resolve => setTimeout(resolve, 100))
    const start = ipcCalls.length
    const sample = await js(`(async()=>{
      const menu=[...document.querySelectorAll('[aria-label="主导航"] [role="menuitem"]')].find(e=>e.textContent.trim()==='项目');
      if(!menu)throw Error('Projects navigation missing');
      const perf=window.__listPerf,commits=perf.commits,body=document.querySelector('.project-list-table tbody'),started=performance.now();menu.click();
      while(!document.querySelector('.project-list-table')?.getClientRects().length || document.querySelectorAll('.project-list-table .ant-table-tbody > tr[data-row-key]').length!==19) {
        if(performance.now()-started>10000)throw Error('List did not render 19 projects');
        await new Promise(requestAnimationFrame);
      }
      await new Promise(requestAnimationFrame);
      return {ms:performance.now()-started,commits:perf.commits-commits,preservedTable:!!body&&body===document.querySelector('.project-list-table tbody')};
    })()`)
    samples.push({ ...sample, ipc: ipcCalls.slice(start).map(item => item.channel) })
    await new Promise(resolve => setTimeout(resolve, 120))
  }
  const workspace = await invoke('listProjects')
  const sorted = samples.map(item => item.ms).sort((a, b) => a - b)
  const report = { projects:workspace.projects.length,repositories:workspace.repositories.length,samples,p50:sorted[9],p95:sorted[18],longTasks:await js('window.__listPerf.longTasks'),ipc:ipcCalls }
  await writeFile(join(directory, 'project-list-performance.json'), JSON.stringify(report, null, 2))
  await writeFile(join(directory, 'project-list.png'), (await window.capturePage()).toPNG())
  console.log('PROJECT_LIST_PERFORMANCE '+JSON.stringify({directory,projects:report.projects,repositories:report.repositories,p50:report.p50,p95:report.p95,commits:samples.map(item=>item.commits),entryIpc:samples.map(item=>item.ipc)}))
  if (process.argv.includes('--interactions')) await verifyInteractions(window, directory, ipcCalls)
  window.webContents.debugger.detach()
}

async function verifyInteractions(window, directory, ipcCalls) {
  const js = async source => {
    const result = await window.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await eval(${JSON.stringify(source)})}}catch(error){return {ok:false,message:String(error),stack:error.stack}}})()`)
    if (!result.ok) {
      await writeFile(join(directory, 'interaction-failed.png'), (await window.capturePage()).toPNG())
      throw new Error(`${result.message}\n${result.stack}\nIn ${source.slice(0,240)}`)
    }
    return result.value
  }
  const wait = async predicate => js(`(async()=>{const start=performance.now();while(!(${predicate})){if(performance.now()-start>10000)throw Error('Timed out: '+${JSON.stringify(predicate)});await new Promise(resolve=>setTimeout(resolve,30))}})()`)
  const click = async (selector, text) => js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&e.textContent.replace(/\\s+/g,'')===${JSON.stringify(text.replace(/\s+/g, ''))});if(!e)throw Error('Missing control: '+${JSON.stringify(text)});e.click()})()`)
  const input = async (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await wait(`document.querySelector('.project-directory-check-time')?.textContent.includes('缓存')`)
  await input('[aria-label="查找项目"]', '-19')
  await wait(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===1`)
  await js(`document.querySelector('.project-list-table .project-favorite-button').click()`)
  await wait(`document.querySelector('.project-list-table .project-favorite-button')?.getAttribute('aria-pressed')==='true'`)
  await js(`document.querySelector('.project-list-table tr[data-row-key] .ant-checkbox-input').click()`)
  await wait(`document.querySelector('.project-list-table tr[data-row-key] .ant-checkbox-input')?.checked`)
  // The retained terminal must survive actual project/list navigation.
  await js(`document.querySelector('[aria-label="打开终端面板"]').click()`)
  await wait(`document.querySelector('.workspace-terminal-host button')`)
  await click('.workspace-terminal-host button', '新建终端')
  await wait(`document.querySelector('.workspace-terminal-host .xterm')`)
  await js(`(async()=>{const sessions=await window.forgeDesk.listTerminals();if(sessions.length!==1)throw Error('Expected one terminal');window.__qaTerminalId=sessions[0].id;await window.forgeDesk.writeTerminal(sessions[0].id,'echo PROJECT_LIST_QA\\r')})()`)
  await js(`document.querySelector('.project-list-table tr[data-row-key] strong').click()`)
  await wait(`document.querySelector('[aria-label="项目目录"]')`)
  // Open the code category explicitly (progress may be the first collapsed group).
  await click('[aria-label="项目目录"] .ant-menu-submenu-title', '代码管理')
  await click('[aria-label="项目目录"] [role="menuitem"]', '仓库')
  await wait(`document.querySelector('.repository-directory-list')`)
  await click('.repository-directory-shortcuts button', '提交树')
  await wait(`document.querySelector('.project-log-tree')`)
  await new Promise(resolve => setTimeout(resolve, 1000))
  const beforeReturn = ipcCalls.length
  const returned = await js(`(async()=>{const started=performance.now();[...document.querySelectorAll('.workspace-project-switch button')].find(e=>e.textContent.trim()==='项目列表').click();while(!document.querySelector('.project-list-table')?.getClientRects().length)await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);return {ms:performance.now()-started,query:document.querySelector('[aria-label="查找项目"]').value,selected:document.querySelector('.project-list-table tr[data-row-key] .ant-checkbox-input').checked}})()`)
  if (returned.query !== '-19' || !returned.selected) throw Error('Search/selection was lost on return')
  await new Promise(resolve => setTimeout(resolve, 6000))
  const forbidden = ipcCalls.slice(beforeReturn).filter(item => /commit-graph|project:summary|project:services:list|branch-tags:list|plane:.*binding/.test(item.channel))
  if (forbidden.length) throw Error('Hidden details kept reading: '+JSON.stringify(forbidden))
  await js(`(async()=>{const sessions=await window.forgeDesk.listTerminals();if(sessions.length!==1||sessions[0].id!==window.__qaTerminalId||!sessions[0].output.join('').includes('PROJECT_LIST_QA'))throw Error('Terminal was restarted or output lost')})()`)
  await click('.project-list-table button', '归档')
  await wait(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===0`)
  await click('.section-heading button', '归档项目')
  await wait(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===1`)
  await click('.project-list-table button', '恢复')
  await wait(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===0`)
  await click('.section-heading button', '当前项目')
  await wait(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===1`)
  await input('[aria-label="查找项目"]', '')
  await wait(`document.querySelectorAll('.project-list-table tr[data-row-key]').length===19`)
  await click('.project-list-table button', '合并')
  await wait(`document.querySelector('.ant-modal-wrap:not([style*="display: none"]) .ant-modal')`)
  await js(`document.querySelector('.ant-modal-wrap:not([style*="display: none"]) .ant-modal-close')?.click()`)
  window.setSize(900, 760)
  await new Promise(resolve => setTimeout(resolve, 500))
  await writeFile(join(directory, 'project-list-narrow.png'), (await window.capturePage()).toPNG())
  const interaction = { returned, hiddenDetailReads: forbidden.length, terminalRetained:true,searchRetained:true,selectionRetained:true,favorite:true,archiveRestore:true,mergeEntry:true,narrow:true }
  await writeFile(join(directory, 'project-list-interactions.json'), JSON.stringify(interaction, null, 2))
  console.log('PROJECT_LIST_INTERACTIONS '+JSON.stringify(interaction))
}
