import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function readRendererSource(fileName: string): string {
  return readFileSync(join(process.cwd(), 'src/renderer/src', fileName), 'utf8')
}

describe('global settings layout', () => {
  it('groups settings entries by a single navigation model', () => {
    const source = readRendererSource('App.tsx')

    assert.match(source, /type SettingsOverviewCategory/)
    assert.match(source, /title: '界面与系统'[\s\S]*keys: \['appearance', 'menu-bar', 'log-refresh'\]/)
    assert.match(source, /title: '开发环境与凭据'[\s\S]*keys: \['git', 'github', 'private', 'public', 'gpg', 'config', 'codemagic'\]/)
    assert.match(source, /title: '外部集成'[\s\S]*keys: \['plane', 'oa', 'ai'\]/)
    assert.match(source, /title: '应用维护'[\s\S]*keys: \['updates'\]/)
    assert.match(source, /const settingsModuleDefinitions: SettingsModuleDefinition\[\]/)
    assert.match(source, /type SettingsStatusKind = 'loading'/)
    assert.match(source, /const settingsAttentionModules = settingsModules\.filter/)
    assert.match(source, /className="settings-navigation"/)
    assert.match(source, /className="settings-overview-summary"/)
    assert.match(source, /刷新设置状态/)
  })

  it('shows a detailed Lark setup guide from OA settings', () => {
    const source = readRendererSource('App.tsx')

    assert.match(source, /const feishuDeveloperConsoleUrl = 'https:\/\/open\.feishu\.cn\/app'/)
    assert.match(source, /const feishuDeveloperDocsUrl = 'https:\/\/open\.feishu\.cn\/document\/home\/index'/)
    assert.match(source, /Lark 接入教程/)
    assert.match(source, /打开开发者后台/)
    assert.match(source, /申请文档权限/)
    assert.match(source, /发布到企业/)
    assert.match(source, /Lark 云盘、文件夹或文档入口链接/)
  })

  it('offers a direct recovery path for missing GPG', () => {
    const source = readRendererSource('App.tsx')

    assert.match(source, /ForgeDesk 可以通过 Homebrew 自动安装 gnupg/)
    assert.match(source, /一键安装 GPG/)
    assert.match(source, /https:\/\/gpgtools\.org\//)
  })

  it('styles settings as a stable navigation and row layout', () => {
    const styles = readRendererSource('styles.css')

    assert.match(styles, /\.settings-layout \{[\s\S]*grid-template-columns: minmax\(250px, 292px\)/)
    assert.match(styles, /\.settings-navigation \{[\s\S]*height: 100%;[\s\S]*overflow-y: auto;/)
    assert.match(styles, /\.settings-main \{[\s\S]*height: 100%;[\s\S]*overflow-y: auto;/)
    assert.match(styles, /\.settings-entry-row \{[\s\S]*grid-template-columns: 32px minmax\(0, 1fr\) auto 14px;/)
    assert.match(styles, /\.settings-status-verified \{[\s\S]*var\(--success-text\)/)
    assert.match(styles, /\.settings-overview-summary \{[\s\S]*grid-template-columns: 42px minmax\(0, 1fr\) auto;/)
    assert.match(styles, /\.oa-guide-panel \{[\s\S]*display: grid;[\s\S]*gap: 14px;/)
    assert.match(styles, /\.oa-guide-steps \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/)
  })
})
