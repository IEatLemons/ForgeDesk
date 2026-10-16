import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const [root, directory] = process.argv.slice(2)
app.setPath('userData', join(directory, 'profile'))
app.disableHardwareAcceleration()
// Only this disposable QA launcher bypasses close prompts on termination.
process.once('SIGTERM',()=>app.exit(0))
const errors = []
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', event => { if (event.level === 'error') errors.push(String(event.message)) })
  contents.on('render-process-gone', (_event, details) => errors.push(`Renderer gone: ${details.reason}`))
})
void import(pathToFileURL(join(root, 'out/main/index.js')).href).then(() => app.whenReady()).then(() => {
const timer = setInterval(async () => {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window || window.webContents.isLoading()) return
  const ready = await window.webContents.executeJavaScript('!!window.forgeDesk && !!document.querySelector("#root")').catch(()=>false)
  if (!ready) return
  clearInterval(timer)
  window.setTitle('ForgeDesk · 正式界面隔离验收')
  console.log(`WORKSPACE_QA_READY ${directory}`)
  if (process.argv.includes('--automated')) {
    try {
      const report = await window.webContents.executeJavaScript(`(async()=>{
        const api=window.forgeDesk;
        const snapshot=await api.createEmptyProject({name:'工作空间验收项目',parentPath:${JSON.stringify(directory)}});
        const project=snapshot.projects.find(p=>p.name==='工作空间验收项目');
        const preview=await api.previewProjectProgressMigration({legacyRaw:null});
        await api.activateProjectProgressMigration({batchId:preview.id,inputHash:preview.inputHash,legacyRaw:null});
        const created=await api.runProjectProgressCommand({type:'create',commandId:crypto.randomUUID(),input:{title:'无需 AI 的原生验收任务',projectId:project.id,acceptanceText:'人工确认完成'}});
        await api.setProjectArchived({id:project.id,archived:true});
        const global=await api.getProjectProgress(),archived=await api.getProjectProgress({projectId:project.id});
        if(global.items.some(item=>item.id===created.entityId)||!archived.items.some(item=>item.id===created.entityId))throw Error('Archive query mismatch');
        await api.setProjectArchived({id:project.id,archived:false});
        await api.runProjectProgressCommand({type:'transition',commandId:crypto.randomUUID(),id:created.entityId,expectedVersion:1,action:'start'});
        const current=await api.getProjectProgress({projectId:project.id});
        if(current.items[0].status!=='doing')throw Error('Native task transition failed');
        return {projectId:project.id,taskId:created.entityId,stats:current.stats,realBridge:true,url:location.href};
      })()`)
      console.log(`WORKSPACE_QA_REPORT ${JSON.stringify(report)}`)
      const invoke = (name, ...args) => window.webContents.executeJavaScript(`window.forgeDesk[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
      const exec = promisify(execFile)
      const workspace = await invoke('initializeProjectRepository', report.projectId)
      const repository = workspace.repositories.find(repo=>repo.projectId===report.projectId)
      const git = (...args) => exec('git',['-C',repository.localPath,...args],{timeout:10000})
      await git('config','user.name','ForgeDesk QA');await git('config','user.email','qa@example.invalid');await git('config','commit.gpgSign','false')
      await writeFile(join(repository.localPath,'qa.txt'),'base\n')
      await invoke('gitAdd',repository.id,{mode:'all',paths:[]})
      await invoke('gitCommit',repository.id,{message:'test: isolated base'})
      const base=(await git('branch','--show-current')).stdout.trim()
      await invoke('switchRepositoryBranch',repository.id,{branchName:'qa/feature',create:true})
      await writeFile(join(repository.localPath,'qa.txt'),'feature\n')
      await invoke('gitAdd',repository.id,{mode:'all',paths:[]});await invoke('gitCommit',repository.id,{message:'test: isolated feature'})
      const remote=join(directory,'local-only.git')
      await exec('git',['init','--bare',remote])
      await invoke('saveRepositoryRemote',{repositoryId:repository.id,name:'qa-local',fetchUrl:remote,pushUrl:remote})
      await invoke('gitPush',repository.id,{remote:'qa-local',branch:'qa/feature'})
      await invoke('fetchRepositoryRemote',repository.id,'qa-local')
      await invoke('switchRepositoryBranch',repository.id,{branchName:base})
      await writeFile(join(repository.localPath,'qa.txt'),'main\n')
      await invoke('gitAdd',repository.id,{mode:'all',paths:[]});await invoke('gitCommit',repository.id,{message:'test: isolated conflict'})
      try { await invoke('gitMerge',repository.id,{source:'qa/feature'}) } catch { /* A real merge conflict is expected. */ }
      const status=await invoke('getRepositoryWorkspaceStatus',repository.id)
      if(!status.files.some(file=>file.conflict))throw Error('Expected real merge conflict was not detected')
      await git('merge','--abort')
      await invoke('fetchRepositoryRemote',repository.id,'qa-local')
      await invoke('switchRepositoryBranch',repository.id,{branchName:'qa/pull',create:true})
      await writeFile(join(repository.localPath,'pull.txt'),'fast-forward\n')
      await invoke('gitAdd',repository.id,{mode:'all',paths:[]});await invoke('gitCommit',repository.id,{message:'test: isolated pull'})
      await invoke('gitPush',repository.id,{remote:'qa-local',branch:'qa/pull'})
      await invoke('switchRepositoryBranch',repository.id,{branchName:base})
      const pulled=await invoke('gitPull',repository.id,{remote:'qa-local',branch:'qa/pull'})
      if(!pulled.ok)throw Error('Fast-forward pull failed')
      await invoke('saveRepositoryRemote',{repositoryId:repository.id,name:'qa-missing',fetchUrl:join(directory,'missing.git'),pushUrl:join(directory,'missing.git')})
      const partial=await invoke('gitPushTask',repository.id,{remotes:['qa-local','qa-missing'],branch:'qa/feature'},'qa-partial')
      if(partial.ok||!partial.operationResults.some(result=>result.ok)||!partial.operationResults.some(result=>!result.ok))throw Error('Expected partial failure not preserved')
      await invoke('deleteRepositoryRemote',repository.id,'qa-missing')
      await writeFile(join(remote,'hooks','pre-receive'),'#!/bin/sh\nsleep 10\nexit 0\n',{mode:0o755})
      const pending=invoke('gitPushTask',repository.id,{remote:'qa-local',branch:'qa/feature',targetBranch:'qa/cancel'},'qa-cancel').then(()=>false,error=>/终止/.test(String(error)))
      await new Promise(resolve=>setTimeout(resolve,600));await invoke('cancelRepositoryGitOperation','qa-cancel')
      if(!await pending)throw Error('Git cancellation not reported')
      await writeFile(join(remote,'hooks','pre-receive'),'#!/bin/sh\nexit 0\n',{mode:0o755})
      await git('-c','protocol.file.allow=always','submodule','add','-b','qa/feature',remote,'deps/sub')
      const nested=join(repository.localPath,'nested');await mkdir(nested);await exec('git',['init',nested])
      const rescanned=await invoke('rescanProjectRepositories',report.projectId)
      if(!rescanned.repositories.some(repo=>repo.projectId===report.projectId&&repo.repositoryKind==='submodule'))throw Error('Submodule missing from repository scan')
      await rename(join(nested,'.git'),join(directory,'nested-git-disabled'))
      const missing=await invoke('rescanProjectRepositories',report.projectId)
      if(!missing.repositories.some(repo=>repo.localPath===nested&&!repo.available&&!repo.active))throw Error('Unavailable repository record was lost')
      await rename(join(directory,'nested-git-disabled'),join(nested,'.git'))
      await invoke('rescanProjectRepositories',report.projectId)
      console.log('WORKSPACE_QA_GIT_REPORT '+JSON.stringify({repositoryId:repository.id,localRemote:remote,staging:true,commit:true,branch:true,push:true,fetch:true,pull:true,mergeConflict:true,conflictAbort:true,partialFailure:true,cancellation:true,submodule:true,unavailablePreserved:true,repositories:rescanned.repositories.filter(repo=>repo.projectId===report.projectId).length}))
      await invoke('createEmptyProject',{name:'用于验证项目切换与长名称展示的独立空项目（不配置仓库与外部系统）',parentPath:directory})
      await window.webContents.reload()
      setTimeout(async () => { await writeFile(join(directory,'desktop.png'),(await window.capturePage()).toPNG()); console.log(`WORKSPACE_QA_RENDER_ERRORS ${JSON.stringify(errors)}`) }, 3000)
    } catch (error) { console.error(`WORKSPACE_QA_FAILED ${error.message}`); window.webContents.reload() }
  }
}, 300)
}).catch(error=>console.error(`WORKSPACE_QA_BOOT_FAILED ${error.stack}`))
