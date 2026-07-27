import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function readRendererSource(fileName: string): string {
  return readFileSync(join(process.cwd(), 'src/renderer/src', fileName), 'utf8')
}

describe('global settings layout', () => {
  it('groups settings overview entries by category', () => {
    const source = readRendererSource('App.tsx')

    assert.match(source, /type SettingsOverviewCategory/)
    assert.match(source, /title: '个性化'[\s\S]*keys: \['appearance', 'menu-bar'\]/)
    assert.match(source, /title: 'Git 与仓库'[\s\S]*keys: \['git'\]/)
    assert.match(source, /title: '集成与服务'[\s\S]*keys: \['codemagic', 'services', 'plane', 'oa', 'ai'\]/)
    assert.match(source, /title: '应用维护'[\s\S]*keys: \['updates'\]/)
    assert.match(source, /title: '菜单栏整理'/)
    assert.match(source, /settingsModuleByKey\.get\(key\)/)
    assert.match(source, /className="settings-category-list"/)
    assert.match(source, /className="settings-category-section"/)
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

  it('styles settings categories without turning them into cards', () => {
    const styles = readRendererSource('styles.css')

    assert.match(styles, /\.settings-category-list \{[\s\S]*display: grid;[\s\S]*gap: 24px;/)
    assert.match(styles, /\.settings-category-section \{[\s\S]*display: grid;[\s\S]*gap: 12px;/)
    assert.match(styles, /\.settings-category-title\.ant-typography \{[\s\S]*font-size: 16px;/)
    assert.match(styles, /\.oa-guide-panel \{[\s\S]*display: grid;[\s\S]*gap: 14px;/)
    assert.match(styles, /\.oa-guide-steps \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/)
  })
})
