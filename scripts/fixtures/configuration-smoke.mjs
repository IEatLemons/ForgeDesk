import assert from 'node:assert/strict'
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

export async function verifyConfiguration(initialWindow, directory, ipcCalls) {
  const execute = (window, code) => window.webContents.executeJavaScript(code)
  const invoke = (window, name, ...args) => execute(window, `window.forgeDesk[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
  async function until(window, expression, label) {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (await execute(window, expression).catch(() => false)) return
      await new Promise(resolve => setTimeout(resolve, 120))
    }
    await writeFile(join(directory, 'configuration-failure.png'), (await window.capturePage()).toPNG())
    throw new Error(`Timed out: ${label}`)
  }
  async function click(window, selector, label) {
    const found = await execute(window, `(()=>{const normalize=value=>value.split(' ').join('').trim();const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>normalize(node.textContent)===normalize(${JSON.stringify(label)}));if(!node)return false;node.click();return true})()`)
    assert.ok(found, `Missing ${label}`)
  }
  async function capture(window, name) {
    await new Promise(resolve => setTimeout(resolve, 450))
    await writeFile(join(directory, name), (await window.capturePage()).toPNG())
  }
  const snapshot = await invoke(initialWindow, 'createEmptyProject', { name: '配置连续性验收', parentPath: directory })
  const project = snapshot.projects.find(project => project.name === '配置连续性验收')
  await invoke(initialWindow, 'initializeProjectRepository', project.id)
  await invoke(initialWindow, 'saveAiSettings', { enabled: false, provider: 'openai-compatible', baseUrl: 'https://ai.configuration.test/v1', model: 'fixture-model', apiKey: 'isolated-test-key', temperature: 0.2 })
  await invoke(initialWindow, 'openProjectWindow', project.id)
  let window
  for (let attempt = 0; attempt < 100; attempt++) {
    window = BrowserWindow.getAllWindows().find(window => window.id !== initialWindow.id && window.webContents.getURL().includes(project.id))
    if (window) break
    await new Promise(resolve => setTimeout(resolve, 120))
  }
  assert.ok(window)
  window.show(); window.setSize(1400, 1000)
  await until(window, `!!document.querySelector('.workspace-directory')`, 'workspace directory')
  await click(window, '.ant-menu-submenu-title', '项目设置')
  await click(window, '[role="menuitem"]', '运行配置')
  await until(window, `!!document.querySelector('.project-deployment-panel') && !!document.querySelector('.project-deployment-panel .ant-select-selection-item')`, 'deployment configuration')
  await click(window, '.project-deployment-panel button', '继续，让 AI 分析')
  await until(window, `[...document.querySelectorAll('.project-deployment-panel .ant-alert')].some(node=>node.textContent.includes('前往 AI 设置'))`, 'actionable missing-AI notice')
  await capture(window, 'configuration-ai-required.png')
  const requestCount = ipcCalls.filter(call => call.channel === 'project:deployment:suggest').length
  await click(window, '.project-deployment-panel button', '扫描项目并填写配置')
  await until(window, `[...document.querySelectorAll('.project-deployment-panel .ant-alert button')].some(node=>node.textContent.trim()==='前往 AI 设置')`, 'AI notice after scan preflight')
  assert.equal(ipcCalls.filter(call => call.channel === 'project:deployment:suggest').length, requestCount, 'Missing AI configuration must not scan/send source')
  await click(window, '.project-deployment-panel .ant-alert button', '前往 AI 设置')
  await until(window, `!!document.querySelector('.configuration-drawer #enabled') && document.querySelector('.configuration-drawer').textContent.includes('保存 AI 设置')`, 'real AI settings form')
  assert.ok(await execute(window, `document.querySelector('.project-deployment-panel').textContent.includes('扫描项目并填写配置')`), 'Origin workflow remains mounted')
  await execute(window, `document.querySelector('.configuration-drawer #enabled').closest('.ant-select').querySelector('.ant-select-selector').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await until(window, `[...document.querySelectorAll('.ant-select-item-option')].some(node=>node.textContent.trim()==='启用')`, 'enabled option')
  await click(window, '.ant-select-item-option', '启用')
  await click(window, '.configuration-drawer button', '保存 AI 设置')
  await until(window, `(async()=>{const settings=await window.forgeDesk.getAiSettings();return settings.enabled&&settings.apiKeyConfigured})()`, 'saved AI configuration')
  await capture(window, 'configuration-ai-settings.png')
  await click(window, '.configuration-drawer [role="tab"]', 'Codex 账号与 API')
  await until(window, `!!document.querySelector('.configuration-drawer #codex-account-management')`, 'unified Codex account management')
  const cockpitSource = join(directory, 'cockpit-source')
  await mkdir(join(cockpitSource, 'codex_accounts'), { recursive: true })
  await writeFile(join(cockpitSource, 'codex_accounts.json'), JSON.stringify({ current_account_id: 'qa', accounts: [{ id: 'qa', email: 'qa@cockpit.test' }] }))
  await writeFile(join(cockpitSource, 'codex_local_access.json'), JSON.stringify({ port: 50549, apiKey: 'fictional-client-api-key', enabled: true }))
  await writeFile(join(cockpitSource, 'codex_accounts/qa.json'), JSON.stringify({ id: 'qa', email: 'qa@cockpit.test', account_id: 'qa-cockpit-team', account_name: 'QA Team', plan_type: 'pro_200', tokens: { access_token: 'fictional-access', refresh_token: 'fictional-refresh' }, subscription_active_until: '2026-12-01T00:00:00Z', quota: { weekly_percentage: 99, hourly_percentage: 80, reset_credits_available: 3 }, usage_updated_at: 1794000000 }))
  await click(window, '.configuration-drawer button', '从 Cockpit 导入')
  await until(window, `!!document.querySelector('input[aria-label="Cockpit 数据路径"]')`, 'Cockpit import dialog')
  await execute(window, `(()=>{const node=document.querySelector('input[aria-label="Cockpit 数据路径"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(cockpitSource)});node.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await click(window, '.ant-modal button', '读取预览')
  await until(window, `document.querySelector('.ant-modal').textContent.includes('qa@cockpit.test')`, 'Cockpit preview through real IPC')
  await execute(initialWindow, `window.__codexConfigurationEvents=0;void window.forgeDesk.onCodexConfigurationChanged(()=>window.__codexConfigurationEvents++)`)
  await execute(window, `(()=>{const label=[...document.querySelectorAll('.ant-modal .ant-checkbox-wrapper')].find(node=>node.textContent.includes('同时导入'));if(!label)throw Error('Missing API settings selection');if(label.querySelector('input').checked)throw Error('API import must be opt in');label.click()})()`)
  await capture(window, 'configuration-cockpit-preview.png')
  const liveReadsBeforeImport = ipcCalls.filter(call => call.channel === 'ai-providers:account-snapshots').length
  await click(window, '.ant-modal button', '导入所选内容')
  await until(window, `document.querySelector('.ant-modal').textContent.includes('已导入 1 个账号')`, 'Cockpit imported')
  await until(window, `!document.querySelector('.ant-modal .ant-modal-footer button').disabled`, 'import callback completed')
  await click(window, '.ant-modal button', '关闭')
  await until(window, `document.querySelector('.configuration-drawer').textContent.includes('QA Team')`, 'import metadata visible')
  const importedService = await invoke(window, 'getCodexApiService')
  assert.equal(importedService.port, 50549)
  assert.equal(importedService.running, false)
  assert.equal(importedService.enabled, false)
  assert.equal(ipcCalls.filter(call => call.channel === 'ai-providers:account-snapshots').length, liveReadsBeforeImport, 'Import must not automatically validate credentials or read live quota')
  assert.ok(await execute(initialWindow, `window.__codexConfigurationEvents>0`), 'Other windows receive account/API updates')
  assert.equal(await execute(window, `document.body.textContent.includes('fictional-client-api-key')`), false, 'Client secret never rendered')
  window.setSize(960, 700)
  await new Promise(resolve => setTimeout(resolve, 500))
  const layout = await execute(window, `(()=>{
    const card=document.querySelector('.configuration-drawer #codex-account-management');
    const body=card.closest('.ant-drawer-body');body.scrollTop=body.scrollHeight;
    const root=document.querySelector('.configuration-drawer-root');
    return {drawerBottom:root.getBoundingClientRect().bottom,statusTop:document.querySelector('.app-status-bar').getBoundingClientRect().top,scrollable:body.scrollHeight>body.clientHeight,mainOverflow:getComputedStyle(document.querySelector('.configuration-drawer .settings-main')).overflowY};
  })()`)
  assert.ok(layout.drawerBottom <= layout.statusTop + 1, 'Drawer ends above application status bar')
  assert.equal(layout.mainOverflow, 'visible', 'No nested viewport scroll traps')
  assert.ok(layout.scrollable)
  await execute(window, `document.querySelector('.configuration-drawer #codex-account-management').scrollIntoView({block:'end'})`)
  await capture(window, 'configuration-codex-narrow-light.png')
  const bottomReachable = await execute(window, `(()=>{const card=document.querySelector('.configuration-drawer #codex-account-management'),body=card.closest('.ant-drawer-body');body.scrollTop=body.scrollHeight;return card.getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom+1})()`)
  assert.ok(bottomReachable, 'Last account card is fully reachable at the bottom')
  await execute(window, `localStorage.setItem('forgedesk:theme-preference:v1','dark');window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
  await capture(window, 'configuration-codex-narrow-dark.png')
  await execute(window, `localStorage.setItem('forgedesk:theme-preference:v1','light');window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
  window.setSize(1400, 1000)
  await click(window, '.configuration-drawer button', '返回刚才的操作')
  await until(window, `!document.querySelector('.configuration-drawer') && !document.querySelector('.project-deployment-panel').textContent.includes('前往 AI 设置')`, 'return with prerequisite resolved')
  assert.ok(await execute(window, `document.querySelector('.project-deployment-panel .ant-steps-item-process').textContent.includes('AI 分析')`), 'Current step preserved')
  assert.equal(ipcCalls.filter(call => call.channel === 'project:deployment:suggest').length, requestCount, 'Return never automatically runs AI')
  await click(window, '.project-deployment-panel button', '手动配置（无需 AI）')
  await until(window, `!!document.querySelector('.project-deployment-panel input[placeholder="例如 apps/web"]')`, 'manual configuration')
  await execute(window, `(()=>{const node=document.querySelector('.project-deployment-panel input[placeholder="例如 apps/web"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'draft/apps/web');node.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await capture(window, 'configuration-returned-draft.png')
  assert.equal(await execute(window, `document.querySelector('.project-deployment-panel input[placeholder="例如 apps/web"]').value`), 'draft/apps/web')
  await click(window, '.project-deployment-panel button', '运行预检')
  await until(window, `[...document.querySelectorAll('.project-deployment-panel .ant-alert button')].some(node=>node.textContent.trim()==='配置平台连接')`, 'platform prerequisite entry')
  await click(window, '.project-deployment-panel .ant-alert button', '配置平台连接')
  await until(window, `!!document.querySelector('.configuration-drawer #project-service-settings')`, 'scoped platform settings')
  assert.ok(await execute(window, `document.querySelector('.configuration-drawer .ant-drawer-title').textContent.includes('配置连续性验收')`), 'Settings retain project scope')
  await click(window, '.configuration-drawer button', '返回刚才的操作')
  await until(window, `!document.querySelector('.configuration-drawer')`, 'return from platform settings')
  assert.equal(await execute(window, `document.querySelector('.project-deployment-panel input[placeholder="例如 apps/web"]').value`), 'draft/apps/web', 'Draft preserved across configuration')
  // Trigger a configuration prerequisite from a different subsystem and verify
  // that its persistent feedback contains an actual settings action.
  await click(window, '[role="menuitem"]', '外部绑定')
  await until(window, `document.body.textContent.includes('配置 Plane 连接')`, 'Plane prerequisite entry')
  await click(window, '.project-plane-settings .ant-alert button', '配置 Plane 连接')
  await until(window, `!!document.querySelector('.configuration-drawer') && document.querySelector('.configuration-drawer').textContent.includes('Plane')`, 'Plane settings destination')
  await click(window, '.configuration-drawer button', '返回刚才的操作')
  await (await import('./settings-layout-smoke.mjs')).verifyStandaloneSettings(initialWindow, directory)
  console.log('CONFIGURATION_QA_REPORT ' + JSON.stringify({ projectId: project.id, realIPC: true, cockpitImport: true, apiSettingsOptIn: true, importedServiceStopped: true, crossWindowUpdates: true, narrowDrawerBottomReachable: true, lightAndDark: true, proactiveAiNotice: true, settingsAction: true, settingsSaved: true, sameStepOnReturn: true, manualConfiguration: true, noAutomaticAiRequest: true, platformSettingsAction: true, projectScopePreserved: true, draftPreserved: true, planeSettingsAction: true, screenshots: directory }))
}
