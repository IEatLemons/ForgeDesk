import { execFile } from 'node:child_process'
import type { ProjectDeploymentTarget } from './project-deployment'
import { runtimeOutputLimit, runtimeStaleAfterMs, type ProjectRuntimeLog, type ProjectRuntimeSnapshot, type RuntimeHealth, type RuntimeState, type RuntimeUnit } from '../shared/project-runtime.js'

const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`
type Runner = (args: string[], env?: NodeJS.ProcessEnv) => Promise<string>
export function runRuntimeSsh(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => execFile('ssh', args, { env: { ...process.env, ...env }, timeout: 15_000, maxBuffer: runtimeOutputLimit, killSignal: 'SIGKILL' }, (error, stdout) => {
    // SSH output may contain authentication details: never expose stderr or command strings.
    if (error) reject(new Error(error.killed ? '检查超时（15 秒）' : 'SSH 检查失败，请检查主机信任、身份权限、连接及远程 Node / Docker 环境'))
    else resolve(stdout)
  }))
}

// Runs directly against an EXISTING PM2 RPC socket. Never import PM2's API/Client:
// their initialization can create files and start a daemon. Only whitelisted fields leave SSH.
// Upstream protocol: https://github.com/Unitech/pm2/blob/master/lib/Client.js (launchRPC).
export const runtimeCollector = String.raw`
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const c=JSON.parse(process.argv[1]);let finished=false;
const finish=(v)=>{if(finished)return;finished=true;process.stdout.write(JSON.stringify(v));process.exit(0)};
setTimeout(()=>finish({error:'远程采集超时'}),12000);
function redact(text){return text.replace(/-----BEGIN [\s\S]*?PRIVATE KEY-----[\s\S]*?-----END [\s\S]*?PRIVATE KEY-----/g,'[私钥已隐藏]').split('\n').filter(line=>!/(authorization|password|passwd|secret|token|api[_-]?key|private[_-]?key)["']?\s*[:=]/i.test(line)).join('\n')}
function safeLog(text){return redact(text).split('\n').slice(-200).join('\n').slice(-10000)}
function tail(file){const s=fs.statSync(file);if(!s.isFile())throw Error('日志不是普通文件');const fd=fs.openSync(file,'r');try{const n=Math.min(s.size,32768),buf=Buffer.alloc(n);fs.readSync(fd,buf,0,n,Math.max(0,s.size-n));let text=buf.toString('utf8');if(s.size>n)text=text.slice(text.indexOf('\n')+1);return redact(text).split('\n').slice(-100).join('\n')}finally{fs.closeSync(fd)}}
async function health(){if(!c.health)return 'not-configured';try{return await new Promise(resolve=>{const req=require('http').get({hostname:'127.0.0.1',port:c.port,path:c.healthPath,timeout:3000},res=>{res.resume();resolve(res.statusCode>=200&&res.statusCode<400?'healthy':'unhealthy')});req.on('timeout',()=>{req.destroy();resolve('unknown')});req.on('error',()=>resolve('unknown'))})}catch{return 'unknown'}}
const run=(args)=>cp.execFileSync('docker',args,{timeout:5000,maxBuffer:65536,encoding:'utf8',stdio:['ignore','pipe','pipe']});
async function docker(){
  const ids=run(['ps','--all','--filter','label=com.docker.compose.project.working_dir='+c.remotePath,'--filter','label=com.docker.compose.service='+c.service,'--format','{{.ID}}']).trim().split(/\s+/).filter(Boolean);
  if(ids.some(id=>!/^\w{12,64}$/.test(id))||ids.length>16)throw Error('无法安全识别容器');
  if(!ids.length)return finish({units:[],health:'unknown',error:'未找到匹配的 Compose 容器'});
  if(c.logs){
    const text=ids.map(id=>{const value=cp.spawnSync('docker',['logs','--tail','100','--since','24h',id],{timeout:5000,maxBuffer:32768,encoding:'utf8',stdio:['ignore','pipe','pipe']});if(value.error||value.status!==0)throw Error('日志读取失败');return String(value.stdout||'')+'\n'+String(value.stderr||'')}).join('\n');
    return finish({text:safeLog(text),truncated:true});
  }
  const units=[],healthStates=[];
  for(const id of ids){const state=JSON.parse(run(['inspect','--format','{{json .State}}',id]));units.push({id,name:c.service,state:state.Running?'running':state.Status==='exited'||state.Status==='dead'?'stopped':'unknown',detail:String(state.Status||'unknown')});if(state.Health)healthStates.push(state.Health.Status)}
  const http=c.health?await health():'not-configured';
  const containerHealth=healthStates.length?(healthStates.includes('unhealthy')?'unhealthy':healthStates.every(state=>state==='healthy')?'healthy':'unknown'):'not-configured';
  finish({units,health:http==='unhealthy'||containerHealth==='unhealthy'?'unhealthy':c.health?http:containerHealth});
}
function pm2(){
  const home=process.env.PM2_HOME||path.join(os.homedir(),'.pm2'),socket=path.join(home,'rpc.sock');
  if(!fs.statSync(socket).isSocket())throw Error('PM2 守护进程未运行');
  const pm2bin=cp.execFileSync('sh',['-c','command -v pm2'],{encoding:'utf8'}).trim();
  const root=path.resolve(path.dirname(fs.realpathSync(pm2bin)),'..');
  const axon=require(path.join(root,'modules/pm2-axon')),rpc=require(path.join(root,'modules/pm2-axon-rpc')),sock=axon.socket('req'),client=new rpc.Client(sock);
  sock.on('error',()=>finish({error:'PM2 RPC 权限或连接失败'}));
  sock.on('reconnect attempt',()=>{sock.close();finish({error:'PM2 RPC 不可用；未启动守护进程'})});
  sock.once('connect',()=>client.call('getMonitorData',{},async(err,list)=>{
    try{
      if(err||!Array.isArray(list))throw Error('PM2 返回无法识别');
      const selected=list.filter(p=>p.name===c.appName||p.pm2_env&&p.pm2_env.name===c.appName);sock.close();
      if(!selected.length)return finish({units:[],health:'unknown',error:'未找到匹配的 PM2 进程'});
      if(c.logs){const files=[...new Set(selected.flatMap(p=>[p.pm2_env.pm_out_log_path,p.pm2_env.pm_err_log_path]).filter(Boolean))];if(files.length>4)throw Error('日志文件过多，无法安全读取');return finish({text:safeLog(files.map(tail).join('\n')),truncated:true})}
      finish({units:selected.map(p=>({id:String(p.pm_id),name:c.appName,state:p.pm2_env.status==='online'?'running':['stopped','errored'].includes(p.pm2_env.status)?'stopped':'unknown',detail:String(p.pm2_env.status)})),health:await health()});
    }catch{finish({error:'PM2 只读采集失败，未修改远程服务'})}
  }));
  sock.connect(socket);
}
try{if(c.provider==='ssh-pm2')pm2();else docker().catch(()=>finish({error:'Docker 只读检查失败，请检查权限和目标配置'}))}catch{finish({error:'无法安全读取运行状态，请检查既有 PM2 守护进程与权限'})}
`

export function runtimeSshArgs(target: ProjectDeploymentTarget, logs = false): string[] {
  const c = target.config
  if (!['ssh-pm2', 'docker-compose'].includes(target.provider)) throw new Error('该部署目标请使用云平台监控')
  if (c.extra.runtimeMonitoring !== 'true') throw new Error('此目标尚未启用只读监控')
  if (!/^(?:[A-Za-z0-9_.-]+@)?[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(c.remoteHost)) throw new Error('请配置 SSH 主机别名或 user@host，不能填写命令或选项')
  if (target.provider === 'ssh-pm2' && !/^[\w.-]{1,100}$/.test(c.appName)) throw new Error('缺少可安全识别的 PM2 应用名')
  if (target.provider === 'docker-compose' && (!c.remotePath.startsWith('/') || /[\r\n\0]/.test(c.remotePath) || !/^[\w.-]{1,100}$/.test(c.composeService))) throw new Error('请配置绝对远程目录和明确的 Compose 服务名')
  const health = c.extra.runtimeHealthCheck === 'true'
  if (health && (!/^\d{1,5}$/.test(c.port) || +c.port < 1 || +c.port > 65535 || !/^\/(?!\/)[^\r\n\0]*$/.test(c.healthPath))) throw new Error('健康检查需要有效的本机端口和 / 开头的路径')
  const input = JSON.stringify({ provider: target.provider, appName: c.appName, remotePath: c.remotePath, service: c.composeService, logs, health, port: +c.port, healthPath: c.healthPath })
  return ['-T', '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no', '-o', 'PermitLocalCommand=no', '-o', 'ClearAllForwardings=yes', '-o', 'ConnectTimeout=5', '-o', 'ConnectionAttempts=1', '-o', 'NumberOfPasswordPrompts=0', '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no', '--', c.remoteHost, `node -e ${quote(runtimeCollector)} ${quote(input)}`]
}

export class ProjectRuntimeService {
  private cache = new Map<string, { fingerprint: string; value: ProjectRuntimeSnapshot }>()
  private inflight = new Map<string, Promise<ProjectRuntimeSnapshot>>()
  private logsInflight = new Map<string, Promise<ProjectRuntimeLog>>()
  private active = 0
  private waiting: Array<() => void> = []
  constructor(private runner: Runner = runRuntimeSsh, private now = () => Date.now()) {}
  private fingerprint(target: ProjectDeploymentTarget): string { return JSON.stringify([target.provider, target.config]) }
  private async limit<T>(action: () => Promise<T>): Promise<T> {
    if (this.active >= 2) await new Promise<void>(resolve => this.waiting.push(resolve))
    else this.active++
    try { return await action() } finally { const next = this.waiting.shift(); if (next) next(); else this.active-- }
  }
  read(target: ProjectDeploymentTarget): ProjectRuntimeSnapshot {
    const enabled = target.config.extra.runtimeMonitoring === 'true'
    const cached = this.cache.get(target.id)
    const value = cached?.fingerprint === this.fingerprint(target) ? cached.value : undefined
    return value ? { ...value, stale: this.now() - Date.parse(value.checkedAt!) > runtimeStaleAfterMs } : { targetId: target.id, projectId: target.projectId, enabled, state: 'unknown', health: 'unknown', units: [], checkedAt: null, stale: true, error: enabled ? '尚未检查' : '未启用只读监控' }
  }
  refresh(target: ProjectDeploymentTarget, env?: NodeJS.ProcessEnv): Promise<ProjectRuntimeSnapshot> {
    const key = `${target.id}:${this.fingerprint(target)}`
    const existing = this.inflight.get(key)
    if (existing) return existing
    const pending = this.limit(async () => {
      const value: ProjectRuntimeSnapshot = { ...this.read(target), state: 'unknown', health: 'unknown', units: [], checkedAt: new Date(this.now()).toISOString(), stale: false, error: null }
      try {
        const result = JSON.parse(await this.runner(runtimeSshArgs(target), env))
        if (result.error) throw new Error(String(result.error).slice(0, 200))
        if (!Array.isArray(result.units) || result.units.length > 32) throw new Error('采集结果无法识别')
        value.units = result.units.map((unit: RuntimeUnit) => ({ id: String(unit.id).slice(0, 64), name: String(unit.name).slice(0, 100), state: ['running', 'stopped', 'unknown'].includes(unit.state) ? unit.state : 'unknown', detail: String(unit.detail).slice(0, 100) }))
        value.health = (['healthy', 'unhealthy', 'not-configured', 'unknown'].includes(result.health) ? result.health : 'unknown') as RuntimeHealth
        value.state = (value.units.length && value.units.every(unit => unit.state === 'running') ? value.health === 'unhealthy' ? 'degraded' : 'running' : value.units.some(unit => unit.state === 'stopped') ? 'stopped' : 'unknown') as RuntimeState
      } catch (error) { value.error = error instanceof Error ? error.message : '运行检查失败' }
      value.checkedAt = new Date(this.now()).toISOString()
      this.cache.set(target.id, { fingerprint: this.fingerprint(target), value }); return value
    }).finally(() => this.inflight.delete(key))
    this.inflight.set(key, pending); return pending
  }
  logs(target: ProjectDeploymentTarget, env?: NodeJS.ProcessEnv): Promise<ProjectRuntimeLog> {
    const key = `${target.id}:${this.fingerprint(target)}`
    const existing = this.logsInflight.get(key); if (existing) return existing
    const pending = this.limit(async () => {
      const result = JSON.parse(await this.runner(runtimeSshArgs(target, true), env))
      if (result.error) throw new Error(String(result.error).slice(0, 200))
      if (typeof result.text !== 'string') throw new Error('日志结果无法识别')
      return { targetId: target.id, checkedAt: new Date(this.now()).toISOString(), text: Buffer.from(result.text,'utf8').subarray(-runtimeOutputLimit/2).toString('utf8').split('\n').slice(-200).join('\n'), truncated: !!result.truncated || Buffer.byteLength(result.text,'utf8') > runtimeOutputLimit/2 }
    }).finally(() => this.logsInflight.delete(key))
    this.logsInflight.set(key, pending); return pending
  }
}
