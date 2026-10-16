import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runInNewContext } from 'node:vm'
import { ProjectRuntimeService, runtimeCollector, runtimeSshArgs } from './project-runtime.js'
import type { ProjectDeploymentTarget } from './project-deployment.js'

const target = (id = 'one'): ProjectDeploymentTarget => ({ id, projectId: 'p', provider: 'ssh-pm2', config: { remoteHost: 'deploy@example.com', appName: 'app', port: '3000', healthPath: '/', remotePath: '/srv/app', composeService: 'web', extra: { runtimeMonitoring: 'true' } } } as unknown as ProjectDeploymentTarget)
const result = (state = 'running', health = 'not-configured') => JSON.stringify({ units: [{ id: '1', name: 'app', state, detail: state }], health })

describe('read-only project runtime', () => {
  it('requires opt-in, validates every target, and refuses shell or SSH option injection', () => {
    const t = target(); t.config.extra = {}
    assert.throws(() => runtimeSshArgs(t), /未启用/)
    for (const host of ['-oProxyCommand=evil', 'host; touch /tmp/x', 'user@host\ncommand']) { const t = target(); t.config.remoteHost = host; assert.throws(() => runtimeSshArgs(t), /SSH/)}
    const t2 = target(); t2.config.appName = '$(evil)'; assert.throws(() => runtimeSshArgs(t2), /应用名/)
    const t3 = target(); t3.config.extra.runtimeHealthCheck = 'true'; t3.config.healthPath = '//elsewhere'; assert.throws(() => runtimeSshArgs(t3), /健康检查/)
    const args = runtimeSshArgs(target())
    assert.ok(args.includes('StrictHostKeyChecking=yes')); assert.ok(args.includes('UpdateHostKeys=no')); assert.ok(args.includes('PasswordAuthentication=no'))
    assert.ok(!args.some(arg => /StrictHostKeyChecking=no/.test(arg)))
  })
  it('deduplicates requests, limits global concurrency to two and expires cached data', async () => {
    let active = 0, max = 0, calls = 0, now = Date.now()
    const service = new ProjectRuntimeService(async () => { calls++; active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 10)); active--; return result() }, () => now)
    const a = service.refresh(target()), b = service.refresh(target())
    assert.equal(a, b)
    await Promise.all([a, b, ...['two','three','four'].map(id => service.refresh(target(id)))])
    assert.equal(calls, 4); assert.equal(max, 2)
    assert.equal(service.read(target()).state, 'running')
    now += 90_001; assert.equal(service.read(target()).stale, true)
    const changed = target(); changed.config.appName = 'other'; assert.equal(service.read(changed).state, 'unknown')
  })
  it('keeps process state, health and deployment result separate, including failures', async () => {
    for (const [state, health, expected] of [['running','unhealthy','degraded'],['stopped','not-configured','stopped'],['unknown','unknown','unknown']]) {
      const service = new ProjectRuntimeService(async () => result(state, health)); assert.equal((await service.refresh(target())).state, expected)
    }
    const service = new ProjectRuntimeService(async () => { throw new Error('检查超时（15 秒）') })
    const t = {...target(), lastStatus:'succeeded'}
    const snapshot = await service.refresh(t)
    assert.equal(snapshot.state, 'unknown'); assert.equal(snapshot.health, 'unknown'); assert.match(snapshot.error!, /超时/)
    assert.ok(!('config' in snapshot)); assert.ok(!('env' in snapshot))
    const disabled = target(); disabled.config.extra = {}
    let called = false; const off = new ProjectRuntimeService(async () => { called = true; return result() })
    assert.equal((await off.refresh(disabled)).state, 'unknown'); assert.equal(called,false)
  })
  it('bounds logs to 200 lines and 64 KiB and rejects malformed output', async () => {
    const service = new ProjectRuntimeService(async () => JSON.stringify({ text: Array.from({length:300},(_,i)=>`${i} ${'x'.repeat(400)}`).join('\n') }))
    const log = await service.logs(target()); assert.ok(log.text.length <= 65536); assert.ok(log.text.split('\n').length <= 200); assert.equal(log.truncated,true)
    await assert.rejects(new ProjectRuntimeService(async () => '{}').logs(target()), /无法识别/)
  })
  it('a missing PM2 daemon never invokes the PM2 CLI or creates any remote files', () => {
    let output = '', commands = 0
    runInNewContext(runtimeCollector, {
      require(name: string) { if(name==='fs')return {statSync(){throw new Error('missing')}}; if(name==='path')return {join:(...args:string[])=>args.join('/')};if(name==='os')return {homedir:()=>'/qa'};if(name==='child_process')return {execFileSync(){commands++;throw new Error('unexpected')}};throw new Error(`unexpected ${name}`) },
      process: { argv: ['node',JSON.stringify({provider:'ssh-pm2',appName:'app'})],env:{},stdout:{write:(value:string)=>output+=value},exit(){} }, setTimeout(){}
    })
    assert.equal(commands, 0); assert.match(JSON.parse(output).error,/无法安全读取/)
    assert.ok(!runtimeCollector.includes("require('pm2')")); assert.ok(!/pm2\s+(jlist|start|restart|status)/.test(runtimeCollector))
  })
  it('only reads existing PM2 RPC and whitelists returned fields, including stopped processes', async()=>{
    for(const status of ['online','stopped','errored']){
      let calls=0,output=''
      const events:Record<string,()=>void>={}
      const sock={on(){},once(name:string,handler:()=>void){events[name]=handler},close(){},connect(){events.connect()}}
      const done=new Promise<string>(resolve=>{
        runInNewContext(runtimeCollector,{
          require(name:string){
            if(name==='fs')return {statSync:()=>({isSocket:()=>true}),realpathSync:()=>'/opt/pm2/bin/pm2'}
            if(name==='path')return {join:(...args:string[])=>args.join('/'),dirname:()=>'/opt/pm2/bin',resolve:()=>'/opt/pm2'}
            if(name==='os')return {homedir:()=>'/qa'}
            if(name==='child_process')return {execFileSync(command:string,args:string[]){assert.equal(command,'sh');assert.deepEqual(Array.from(args),['-c','command -v pm2']);return '/opt/pm2/bin/pm2'}}
            if(name.endsWith('pm2-axon'))return {socket:()=>sock}
            if(name.endsWith('pm2-axon-rpc'))return {Client:class{call(method:string,_input:unknown,callback:(error:null,items:unknown[])=>void){calls++;assert.equal(method,'getMonitorData');callback(null,[{pm_id:1,name:'app',pm2_env:{name:'app',status,SECRET:'must-not-return',env:{PASSWORD:'must-not-return'}}}])}}}
            throw Error(`unexpected module ${name}`)
          },process:{argv:['node',JSON.stringify({provider:'ssh-pm2',appName:'app'})],env:{},stdout:{write:(text:string)=>{output+=text;resolve(output)}},exit(){}},setTimeout(){}
        })
      })
      const value=JSON.parse(await done)
      assert.equal(calls,1);assert.equal(value.units[0].state,status==='online'?'running':'stopped');assert.ok(!output.includes('must-not-return'))
    }
  })
  it('Docker checks only ps/inspect and preserves unknown health while containers start',async()=>{
    for(const health of ['starting','healthy','unhealthy']){
      const calls:string[]=[]
      const output=await new Promise<string>(resolve=>runInNewContext(runtimeCollector,{
        require(name:string){if(name==='child_process')return {execFileSync(command:string,args:string[]){assert.equal(command,'docker');calls.push(args[0]);if(args[0]==='ps')return '0123456789ab';assert.equal(args[0],'inspect');return JSON.stringify({Running:true,Status:'running',Health:{Status:health,Log:[{Output:'SECRET=hidden'}]}})}};return {}},
        process:{argv:['node',JSON.stringify({provider:'docker-compose',service:'web',remotePath:'/srv/app'})],stdout:{write:resolve},exit(){}},setTimeout(){}
      }))
      assert.deepEqual(calls,['ps','inspect']);assert.equal(JSON.parse(output).health,health==='starting'?'unknown':health);assert.ok(!output.includes('SECRET'))
    }
  })
})
