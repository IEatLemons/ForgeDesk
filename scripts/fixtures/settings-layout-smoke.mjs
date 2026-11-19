import assert from 'node:assert/strict'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

export async function verifyStandaloneSettings(window, directory) {
  const execute = code => window.webContents.executeJavaScript(code)
  async function until(expression, label) {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (await execute(expression).catch(() => false)) return
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Timed out: ${label}`)
  }
  async function click(selector, label) {
    assert.ok(await execute(`(()=>{const normalize=text=>text.split(' ').join('').trim();const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>normalize(node.textContent)===normalize(${JSON.stringify(label)}));if(!node)return false;node.click();return true})()`), `Missing ${label}`)
  }
  window.show()
  window.focus()
  window.webContents.reload()
  await until(`!!document.querySelector('.workspace-sidebar nav[aria-label="辅助导航"]')`, 'global workspace')
  await click('nav[aria-label="辅助导航"] [role="menuitem"]', '设置')
  await until(`!!document.querySelector('.workspace-secondary-directory')`, 'settings navigation')
  await click('.workspace-secondary-directory .ant-menu-submenu-title', '外部集成')
  await click('.workspace-secondary-directory [role="menuitem"]', 'AI 模型配置')
  await until(`!!document.querySelector('.workspace-content .settings-workspace [role="tab"]')`, 'standalone AI settings')
  await click('.workspace-content .settings-workspace [role="tab"]', 'Codex 账号与 API')
  await until(`!!document.querySelector('.workspace-content #codex-account-management .ai-account-card')`, 'standalone account cards')
  const reports = []
  for (const [width, height, theme] of [[1360, 900, 'light'], [960, 700, 'light'], [960, 700, 'dark']]) {
    window.setSize(width, height)
    await execute(`localStorage.setItem('forgedesk:theme-preference:v1',${JSON.stringify(theme)});window.dispatchEvent(new Event('forgedesk:theme-preference-changed'))`)
    await new Promise(resolve => setTimeout(resolve, 400))
    // Exercise a real Chromium wheel gesture over the settings content, so a
    // nested scroll trap cannot pass just by scrolling both ancestors in code.
    await execute(`document.querySelector('.workspace-content').scrollTop=0`)
    window.webContents.debugger.attach('1.3')
    try {
      await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', x: width - 100, y: height - 140, deltaX: 0, deltaY: 10000 })
      await new Promise(resolve => setTimeout(resolve, 450))
    } finally { window.webContents.debugger.detach() }
    const metrics = await execute(`(()=>{
      const content=document.querySelector('.workspace-content'),inner=content.querySelector('.settings-main');
      const last=[...content.querySelectorAll('.ai-account-card')].at(-1);
      return {innerOverflow:getComputedStyle(inner).overflowY,innerClientHeight:inner.clientHeight,innerScrollHeight:inner.scrollHeight,contentBottom:content.getBoundingClientRect().bottom,statusTop:document.querySelector('.app-status-bar').getBoundingClientRect().top,lastBottom:last.getBoundingClientRect().bottom,contentWidth:content.clientWidth,scrollWidth:content.scrollWidth};
    })()`)
    reports.push({ width, height, theme, ...metrics })
    await writeFile(join(directory, `settings-page-${width}-${height}-${theme}.png`), (await window.capturePage()).toPNG())
    // Bottom screenshots and raw metrics are kept even when a check fails.
    console.log('SETTINGS_LAYOUT_METRICS ' + JSON.stringify(reports.at(-1)))
    assert.ok(metrics.contentBottom <= metrics.statusTop + 1, 'Workspace ends above the status bar')
    assert.ok(metrics.lastBottom <= metrics.contentBottom - 8, 'A wheel gesture reaches the last card with visible space below it')
    assert.ok(metrics.scrollWidth <= metrics.contentWidth + 1, 'No horizontal content clipping')
    await execute(`document.querySelector('.workspace-content').scrollTop=0`)
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(await execute(`(()=>{const heading=document.querySelector('.workspace-content .settings-workspace .section-heading');return heading.getBoundingClientRect().top>=document.querySelector('.workspace-content').getBoundingClientRect().top})()`), 'Page heading remains reachable')
  }
  await writeFile(join(directory, 'settings-layout-report.json'), JSON.stringify(reports, null, 2))
}
