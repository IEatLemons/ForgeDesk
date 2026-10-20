// Isolated desktop QA: npm run build, then node scripts/progress-smoke.mjs.
// Uses the real domain service, preload and panel, never the user's database or AI accounts.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import ts from 'typescript'
import electron from 'electron'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const browserOnly = process.argv.includes('--browser')
const smokeDirectory = await mkdtemp(join(tmpdir(), 'forgedesk-progress-qa-'))
await mkdir(join(smokeDirectory, 'profile'))
const source = await readFile(join(root, 'src/main/project-progress.ts'), 'utf8')
await writeFile(join(smokeDirectory, 'project-progress.mjs'), ts.transpileModule(source, {
  compilerOptions: { module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022 }
}).outputText)
const server = await createServer({
  configFile:false,root,plugins:[react()],
  server:{host:'127.0.0.1',port:5198,strictPort:true},
  appType:'custom'
})
let browserDb
if(browserOnly){
  const { DatabaseSync } = await import('node:sqlite')
  const { ProjectProgressService } = await import(pathToFileURL(join(smokeDirectory,'project-progress.mjs')).href)
  browserDb = new DatabaseSync(join(smokeDirectory,'qa.db'))
  browserDb.exec("CREATE TABLE projects(id TEXT PRIMARY KEY); INSERT INTO projects VALUES('qa-project');")
  const service = new ProjectProgressService(()=>browserDb)
  server.middlewares.use('/__progress_api',async (request,response)=>{
    try{
      if(request.method!=='POST')throw new Error('POST required')
      if(request.headers.origin && request.headers.origin!=='http://127.0.0.1:5198')throw new Error('仅允许隔离验收页面访问')
      let body='';for await(const chunk of request){body+=chunk;if(body.length>1024*1024)throw new Error('Payload too large')}
      const input=JSON.parse(body||'{}')
      let result
      if(request.url==='/snapshot')result=service.getSnapshot(input)
      else if(request.url==='/history')result=service.getHistory(input)
      else if(request.url==='/command')result=service.command(input)
      else if(request.url==='/preview')result=service.previewMigration(input.legacyRaw,[])
      else if(request.url==='/activate'){
        const backup=join(smokeDirectory,'before-migration.db')
        if(!service.isActive())browserDb.prepare('VACUUM INTO ?').run(backup)
        result=service.activateMigration(input.batchId,input.inputHash,input.legacyRaw,[],backup)
      }else if(request.url==='/managed')result=[]
      else throw new Error('此验收不启动真实 AI')
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify({result}))
    }catch(error){response.statusCode=400;response.end(JSON.stringify({error:error.message}))}
  })
}
server.middlewares.use('/__progress_smoke',async (_request,response,next)=>{
  try {
    const html = await server.transformIndexHtml('/__progress_smoke','<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ForgeDesk · 原生进度验收</title></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/progress-smoke.tsx"></script></body></html>')
    response.setHeader('Content-Type','text/html'); response.end(html)
  } catch(error) {next(error)}
})
try{
  await server.listen()
  console.log(`Isolated QA: http://127.0.0.1:5198/__progress_smoke · ${smokeDirectory}`)
  if(browserOnly){
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve)})
  }else{
    const child = spawn(electron,[join(root,'scripts/fixtures/progress-smoke-main.mjs'),root,smokeDirectory,'http://127.0.0.1:5198/__progress_smoke'],{stdio:'inherit'})
    process.on('SIGINT',()=>child.kill('SIGTERM'))
    process.on('SIGTERM',()=>child.kill('SIGTERM'))
    process.exitCode = await new Promise(resolve=>{child.once('exit',code=>resolve(code??0));child.once('error',error=>{console.error(error);resolve(1)})})
  }
}finally {await server.close();browserDb?.close();await rm(smokeDirectory,{recursive:true,force:true})}
