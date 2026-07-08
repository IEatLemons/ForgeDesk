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
    assert.match(source, /title: '个性化'[\s\S]*keys: \['appearance', 'log-refresh'\]/)
    assert.match(source, /title: 'Git 与 SSH'[\s\S]*keys: \['git', 'private', 'public', 'config'\]/)
    assert.match(source, /title: '集成与服务'[\s\S]*keys: \['github', 'codemagic', 'services', 'plane', 'ai'\]/)
    assert.match(source, /title: '应用维护'[\s\S]*keys: \['updates'\]/)
    assert.match(source, /settingsModuleByKey\.get\(key\)/)
    assert.match(source, /className="settings-category-list"/)
    assert.match(source, /className="settings-category-section"/)
  })

  it('styles settings categories without turning them into cards', () => {
    const styles = readRendererSource('styles.css')

    assert.match(styles, /\.settings-category-list \{[\s\S]*display: grid;[\s\S]*gap: 24px;/)
    assert.match(styles, /\.settings-category-section \{[\s\S]*display: grid;[\s\S]*gap: 12px;/)
    assert.match(styles, /\.settings-category-title\.ant-typography \{[\s\S]*font-size: 16px;/)
  })
})
