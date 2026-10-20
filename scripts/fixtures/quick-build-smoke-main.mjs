import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const [root, directory, artifact] = process.argv.slice(2)
app.setPath('userData', join(directory, 'profile'))
app.disableHardwareAcceleration()
process.once('SIGTERM', () => app.exit(0))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const errors = [], updates = []
let relaunchOptions
// Record a real restart request without restarting any running user application.
app.relaunch = options => { relaunchOptions = options }
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', event => { if (event.level === 'error') { errors.push(String(event.message)); console.error('QUICK_BUILD_QA_RENDER_ERROR ' + event.message) } })
  const send = contents.send.bind(contents)
  contents.send = (channel, ...args) => { if (channel === 'quick-build:task-updated') updates.push({ at: performance.now(), status: args[0]?.status }); return send(channel, ...args) }
})
const timeout = setTimeout(() => { console.error('QUICK_BUILD_QA_TIMEOUT'); app.exit(1) }, 120000)
async function verify() { try {
  await import(pathToFileURL(join(artifact, 'Contents/Resources/app/out/main/index.js')).href)
  await app.whenReady()
  let window
  for (let attempt = 0; attempt < 150; attempt++) {
    window = BrowserWindow.getAllWindows()[0]
    if (window && !window.webContents.isLoading() && await window.webContents.executeJavaScript('!!window.forgeDesk && !!document.querySelector("#root")').catch(() => false)) break
    await delay(200)
  }
  assert.ok(window)
  const invoke = (name, ...args) => window.webContents.executeJavaScript(`window.forgeDesk[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
  const runtime = await invoke('getAppRuntimeInfo')
  assert.equal(runtime.canQuickBuild, true)
  assert.equal(runtime.projectRoot, root)
  // Finish the empty-profile onboarding before checking workspace UI. A button
  // can briefly exist before the initialization query switches to the wizard.
  await invoke('createEmptyProject', { name: '快速构建隔离验收', parentPath: directory })
  window.webContents.reload()
  await delay(600)
  for (let attempt = 0; attempt < 150; attempt++) {
    if (!window.webContents.isLoading() && await window.webContents.executeJavaScript('!!document.querySelector(".workspace-production-root .app-status-bar-quick-build")').catch(() => false)) break
    await delay(200)
  }
  assert.equal(await window.webContents.executeJavaScript('!!document.querySelector(".app-status-bar-quick-build")'), true, `Quick build button missing after onboarding; errors: ${JSON.stringify(errors)}`)
  const openLogs = () => window.webContents.executeJavaScript('document.querySelector(".app-status-bar-build-log").click()')
  const closeLogs = () => window.webContents.executeJavaScript('document.querySelector(".ant-drawer-close")?.click()')
  await openLogs(); await delay(250)
  assert.equal(await invoke('getQuickBuildTask'), null, 'Opening logs must not start a build')
  assert.match(await window.webContents.executeJavaScript('document.querySelector(".quick-build-log-output").textContent'), /暂无编译输出/)
  await closeLogs(); await delay(250)
  const started = performance.now()
  await window.webContents.executeJavaScript('document.querySelector(".app-status-bar-quick-build").click()')
  let task
  for (let attempt = 0; attempt < 300; attempt++) {
    task = await invoke('getQuickBuildTask')
    if (task && task.status !== 'running') break
    if (task && attempt === 1) {
      assert.equal((await invoke('startQuickBuild', { cwd: root })).id, task.id)
      await closeLogs(); await openLogs()
      assert.equal((await invoke('getQuickBuildTask')).id, task.id, 'Opening logs must preserve the running task')
    }
    await delay(200)
  }
  assert.equal(task?.status, 'succeeded', task?.log)
  assert.match(task.command, /^pnpm build:quick/)
  assert.ok(task.artifactPath && task.stages.length >= 2)
  const durationMs = Math.round(performance.now() - started)
  await delay(400)
  assert.match(await window.webContents.executeJavaScript('document.body.innerText'), /本机快速构建 · 阶段与耗时/)
  await writeFile(join(directory, 'desktop.png'), (await window.capturePage()).toPNG())
  // Dismiss only the completion prompt, never accept a user-data close prompt.
  await window.webContents.executeJavaScript('Array.from(document.querySelectorAll(".ant-modal button")).find(button=>button.textContent.includes("稍后手动打开"))?.click()')
  await closeLogs(); await delay(250); await openLogs(); await delay(250)
  assert.equal((await invoke('getQuickBuildTask')).id, task.id, 'Opening completed logs must not rebuild')
  const selectChannel = value => window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.quick-build-log-toolbar .ant-segmented-item')).find(item=>item.textContent===${JSON.stringify({log:'全部日志',stdout:'标准输出',stderr:'错误输出'}[value])}).click()`)
  const displayedOutput = () => window.webContents.executeJavaScript('document.querySelector(".quick-build-log-output").textContent')
  await selectChannel('stderr'); await delay(250)
  assert.equal(await displayedOutput(), task.stderr || '暂无错误输出')
  await selectChannel('stdout'); await delay(250)
  assert.equal(await displayedOutput(), task.stdout)
  const downloaded = new Promise(resolve => window.webContents.session.once('will-download', (_event, item) => {
    item.setSavePath(join(directory, 'build-stdout.log'))
    item.once('done', (_event, state) => resolve(state))
  }))
  await window.webContents.executeJavaScript('Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes("导出日志")).click()')
  assert.equal(await Promise.race([downloaded, delay(5000).then(() => 'timeout')]), 'completed')
  assert.ok((await readFile(join(directory, 'build-stdout.log'), 'utf8')).endsWith(task.stdout))
  await selectChannel('log'); await delay(250)
  assert.equal(await displayedOutput(), task.log)
  window.setSize(760, 800); await delay(400)
  await writeFile(join(directory, 'narrow.png'), (await window.capturePage()).toPNG())
  await assert.rejects(invoke('restartQuickBuildApp', { cwd: root, taskId: 'wrong-task' }), /本次成功构建/)
  const result = await invoke('restartQuickBuildApp', { cwd: root, taskId: task.id })
  assert.equal(result.restarted, true)
  assert.equal(relaunchOptions.execPath, join(task.artifactPath, 'Contents/MacOS/ForgeDesk'))
  assert.deepEqual(relaunchOptions.args, [])
  const report = { durationMs, task, eventCount: updates.length, errors, profile: app.getPath('userData'), relaunchOptions, actualRestartSuppressed: true, logs: { visibleEntry: true, opensWithoutBuilding: true, preservesRunningTask: true, streamSwitching: true, exported: true } }
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2))
  console.log('QUICK_BUILD_QA_PASSED ' + JSON.stringify({ directory, durationMs, eventCount: updates.length, reused: task.reused, artifactPath: task.artifactPath, errors }))
  assert.deepEqual(errors, [])
  clearTimeout(timeout); app.exit(0)
} catch (error) {
  clearTimeout(timeout); console.error('QUICK_BUILD_QA_FAILED ' + error.stack); app.exit(1)
} }
void verify()
