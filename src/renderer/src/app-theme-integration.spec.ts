import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function readRendererSource(fileName: string): string {
  return readFileSync(join(process.cwd(), 'src/renderer/src', fileName), 'utf8')
}

describe('app theme integration', () => {
  it('configures Ant Design algorithms and document theme attributes at the renderer root', () => {
    const source = readRendererSource('main.tsx')

    assert.match(source, /defaultAlgorithm/)
    assert.match(source, /darkAlgorithm/)
    assert.match(source, /data-theme/)
    assert.match(source, /colorScheme/)
  })

  it('exposes appearance mode controls in global settings', () => {
    const source = readRendererSource('App.tsx')

    assert.match(source, /外观/)
    assert.match(source, /跟随系统/)
    assert.match(source, /白天模式/)
    assert.match(source, /黑夜模式/)
    assert.match(source, /DesktopOutlined/)
    assert.match(source, /SunOutlined/)
    assert.match(source, /MoonOutlined/)
  })

  it('defines light and dark CSS variable blocks for shared app surfaces', () => {
    const styles = readRendererSource('styles.css')

    assert.match(styles, /:root\s*{[\s\S]*--app-bg:/)
    assert.match(styles, /\[data-theme='dark'\]\s*{[\s\S]*--app-bg:/)
    assert.match(styles, /body\s*{[\s\S]*background:\s*var\(--app-bg\)/)
    assert.match(styles, /\.panel\s*{[\s\S]*background:\s*var\(--panel-bg\)/)
  })
})
