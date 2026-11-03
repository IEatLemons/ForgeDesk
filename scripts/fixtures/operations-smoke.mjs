import assert from 'node:assert/strict'
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

// Only the isolated QA launcher installs these read-only platform responses.
// The application, SQLite database, preload bridge and renderer are the real build.
export function installOperationsFixtures() {
  const requests = []
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    requests.push({ url: url.href, method: init.method || 'GET' })
    if (!['GET', 'HEAD'].includes(init.method || 'GET')) throw new Error('QA blocks remote mutations')
    if (url.hostname === 'app.operations.test') return new Response('healthy', { status: 200 })
    if (url.hostname !== 'api.vercel.com') throw new Error('QA has no external network access')
    const now = Date.now()
    const active = { id: 'dpl-production-active', target: 'production', readyState: 'READY', url: 'production.operations.test', meta: { githubCommitSha: '7b53731-production', githubCommitRef: 'main' }, createdAt: now - 600_000 }
    const latest = { uid: 'dpl-production-failed', target: 'production', state: 'ERROR', url: 'failed.operations.test', meta: { githubCommitSha: 'f01ab23-failed', githubCommitRef: 'main' }, createdAt: now - 60_000 }
    if (url.pathname.endsWith('/custom-environments')) return Response.json({ environments: [] })
    if (url.pathname.endsWith('/domains')) return Response.json({ domains: [{ name: 'app.operations.test' }] })
    if (url.pathname.endsWith('/prj-operations-qa')) return Response.json({ targets: { production: active } })
    if (url.pathname === '/v7/deployments') return Response.json({ deployments: url.searchParams.get('target') === 'preview' ? [] : [latest, { ...active, state: 'READY' }] })
    if (url.pathname.endsWith('/events')) return Response.json([{ type: 'stdout', text: 'QA build log: isolated platform response', created: now }])
    if (url.pathname.endsWith('/runtime-logs')) return new Response(JSON.stringify({ message: 'QA runtime log: isolated platform response', timestamp: now, level: 'info' }))
    throw new Error(`Unexpected Vercel QA request ${url.pathname}`)
  }
  return requests
}

export async function verifyOperations(initialWindow, directory, requests, ipcCalls) {
  const execute = (window, code) => window.webContents.executeJavaScript(code)
  const invoke = (window, name, ...args) => execute(window, `window.forgeDesk[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
  async function until(window, expression, label) {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (await execute(window, expression).catch(() => false)) return
      await new Promise(resolve => setTimeout(resolve, 120))
    }
    throw new Error(`Timed out: ${label}`)
  }
  async function click(window, selector, label) {
    const result = await execute(window, `(()=>{ const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.textContent.trim()===${JSON.stringify(label)}); if(!node)return false; node.click();return true })()`)
    assert.ok(result, `Missing ${label}`)
  }
  async function capture(window, name) {
    await new Promise(resolve => setTimeout(resolve, 450))
    await execute(window, 'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    await writeFile(join(directory, name), (await window.capturePage()).toPNG())
  }
  const snapshot = await invoke(initialWindow, 'createEmptyProject', { name: 'Vercel 运行验收', parentPath: directory })
  const project = snapshot.projects.find(project => project.name === 'Vercel 运行验收')
  const connection = await invoke(initialWindow, 'saveServiceConnection', { projectId: project.id, provider: 'vercel', name: '隔离 Vercel', token: 'qa-not-a-real-token', teamId: 'team-qa' })
  await invoke(initialWindow, 'saveProjectService', { projectId: project.id, provider: 'vercel', connectionId: connection.id, name: 'operations-web', externalProjectId: 'prj-operations-qa', environments: [{ name: 'production' }, { name: 'preview' }] })
  const result = await invoke(initialWindow, 'refreshProjectOperations', { projectId: project.id, force: true })
  await invoke(initialWindow, 'checkProjectServices', project.id)
  const serviceId = result.services[0].id
  assert.equal(result.states[serviceId].production.id, 'dpl-production-active')
  await invoke(initialWindow, 'openProjectWindow', project.id)
  let window
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    window = BrowserWindow.getAllWindows().find(window => window.id !== initialWindow.id && window.webContents.getURL().includes(project.id))
    if (window) break
    await new Promise(resolve => setTimeout(resolve, 120))
  }
  assert.ok(window, 'Project window')
  window.setSize(1440, 1040); window.show()
  await until(window, `!!document.querySelector('.operations-summary') && document.querySelector('.operations-summary').textContent.includes('7b53731')`, 'overview production card')
  const summary = await execute(window, `document.querySelector('.operations-summary').textContent`)
  for (const value of ['Vercel', '部署就绪', '部署失败', '与当前生产版本不同', '1 / 1 在线']) assert.ok(summary.includes(value), value)
  window.hide()
  await until(window, `document.visibilityState==='hidden'`, 'hidden project window')
  const readsBefore = ipcCalls.filter(call => call.channel.startsWith('project:operations:')).length
  await execute(window, `document.dispatchEvent(new Event('visibilitychange'))`)
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(ipcCalls.filter(call => call.channel.startsWith('project:operations:')).length, readsBefore, 'Hidden window does not refresh')
  window.show()
  await until(window, `document.visibilityState==='visible'`, 'visible project window')
  const visibleDeadline = Date.now() + 3000
  while (ipcCalls.filter(call => call.channel.startsWith('project:operations:')).length <= readsBefore && Date.now() < visibleDeadline) await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(ipcCalls.filter(call => call.channel.startsWith('project:operations:')).length > readsBefore, 'Re-entering refreshes cached operations')
  await capture(window, 'operations-overview-light.png')
  await click(window, '.ant-menu-submenu-title', '运行')
  await click(window, '[role="menuitem"]', '环境与服务')
  await until(window, `!!document.querySelector('.operations-environments .ant-table-tbody')`, 'environment table')
  assert.match(await execute(window, `document.querySelector('.operations-environments .ant-table-tbody tr[data-row-key]').textContent`), /^production/)
  assert.ok(!await execute(window, `document.body.textContent.includes('当前项目还没有绑定 Railway 服务')`))
  await capture(window, 'operations-environments-light.png')
  await click(window, '[role="menuitem"]', '部署与发布')
  await until(window, `!!document.querySelector('.operations-deployments .ant-table-tbody')`, 'deployment history')
  const history = await execute(window, `document.querySelector('.operations-deployments .ant-table-tbody').textContent`)
  assert.ok(history.includes('dpl-production-failed')); assert.ok(history.includes('当前生产指向'))
  await click(window, '.operations-heading button', '新建部署')
  await until(window, `[...document.querySelectorAll('.ant-drawer-content')].some(node=>node.textContent.includes('方式与目标'))`, 'existing deployment wizard')
  await execute(window, `document.querySelector('.ant-drawer-open .ant-drawer-close').click()`)
  await click(window, '[role="menuitem"]', '日志与监控')
  await until(window, `!!document.querySelector('.operations-monitoring .ant-table-tbody')`, 'monitoring view')
  await click(window, '.operations-monitoring button', '构建日志')
  await until(window, `document.body.textContent.includes('QA build log')`, 'build log from real IPC')
  await execute(window, `document.querySelector('.ant-drawer-open .ant-drawer-close').click()`)
  await click(window, '.operations-monitoring button', '运行日志')
  await until(window, `document.body.textContent.includes('QA runtime log')`, 'runtime log from real IPC')
  assert.ok(requests.some(request => request.url.includes('/dpl-production-active/runtime-logs')))
  await execute(window, `document.querySelector('.ant-drawer-open .ant-drawer-close').click()`)
  await click(window, '[role="menuitem"]', '域名')
  await until(window, `!!document.querySelector('.operations-domains .ant-table-tbody')`, 'domain view')
  assert.ok(await execute(window, `document.querySelector('.operations-domains').textContent.includes('app.operations.test')`))
  await click(window, '.operations-domains button', '验证与配置')
  await until(window, `!!document.querySelector('.ant-drawer-open .ant-tabs-tab-active') && document.querySelector('.ant-drawer-open .ant-tabs-tab-active').textContent.includes('域名监控')`, 'domain detail tab')
  await execute(window, `document.querySelector('.ant-drawer-open .ant-drawer-close').click()`)
  await execute(window, `localStorage.setItem('forgedesk:theme-preference:v1','dark');window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
  await until(window, `document.documentElement.dataset.theme==='dark'`, 'dark theme')
  await until(window, `!document.querySelector('.ant-drawer-open')`, 'drawers closed')
  await capture(window, 'operations-domains-dark.png')
  window.setSize(720, 960)
  await new Promise(resolve => setTimeout(resolve, 350))
  const layout = await execute(window, `({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})`)
  assert.ok(layout.scroll <= layout.width + 1, `Page overflow ${JSON.stringify(layout)}`)
  await capture(window, 'operations-domains-narrow.png')
  assert.ok(requests.filter(request => request.url.includes('api.vercel.com')).every(request => request.method === 'GET' && !/\/projects\?/.test(request.url)))
  console.log('OPERATIONS_QA_REPORT ' + JSON.stringify({ projectId: project.id, realIPC: true, productionSeparateFromLatest: true, healthyOverviewVisible: true, hiddenPausesRefresh: true, reenterRefreshes: true, environmentOrder: true, deploymentWizard: true, buildAndRuntimeLogs: true, domainDetail: true, darkTheme: true, narrowWindow: layout, platformMutations: 0, screenshots: directory }))
}
