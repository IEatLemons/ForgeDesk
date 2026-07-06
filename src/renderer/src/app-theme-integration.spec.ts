import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function readRendererSource(fileName: string): string {
  return readFileSync(join(process.cwd(), 'src/renderer/src', fileName), 'utf8')
}

function readCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = Array.from(styles.matchAll(new RegExp(`${escapedSelector}\\s*{[^}]*}`, 'gs')))

  assert.ok(matches.length > 0, `Missing CSS rule for ${selector}`)
  return matches.map((match) => match[0]).join('\n')
}

function readDarkCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = Array.from(styles.matchAll(new RegExp(`\\[data-theme='dark'\\][^{]*${escapedSelector}[^{]*{[^}]*}`, 'gs')))

  assert.ok(matches.length > 0, `Missing dark CSS rule for ${selector}`)
  return matches.map((match) => match[0]).join('\n')
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

  it('keeps repository detail and commit table surfaces theme-aware', () => {
    const styles = readRendererSource('styles.css')
    const themedSurfaceSelectors = [
      '.repository-summary-strip',
      '.remote-alignment-panel',
      '.remote-alignment-remote-card',
      '.source-tree-table',
      '.source-tree-table .ant-table-thead > tr > th',
      '.source-tree-table .commit-graph-column',
      '.source-tree-table .ant-table-tbody > tr.ant-table-row.working-tree-row > td',
      '.source-tree-table .ant-table-expanded-row > td',
      '.commit-detail-panel',
      '.commit-inline-detail',
      '.commit-expanded-detail-row',
      '.commit-expanded-graph-cell',
      '.source-tree-table .commit-inline-detail',
      '.commit-load-more'
    ]

    for (const selector of themedSurfaceSelectors) {
      const rule = readCssRule(styles, selector)

      assert.match(rule, /var\(--/, `${selector} should use theme variables`)
      assert.doesNotMatch(rule, /background:\s*#f(?:ff|[0-9a-f]{5})/i, `${selector} should not hard-code a light background`)
    }
  })

  it('adds dark-mode overrides for custom non-AntD surfaces', () => {
    const styles = readRendererSource('styles.css')
    const customSurfaceSelectors = [
      '.service-provider-entry-card',
      '.service-provider-section',
      '.deployment-list',
      '.tool-entry-card',
      '.password-output-row',
      '.file-picker-card',
      '.ssh-key-card',
      '.project-settings-entry-card',
      '.release-task-item',
      '.remote-manager',
      '.git-command-console',
      '.git-operation-box'
    ]

    for (const selector of customSurfaceSelectors) {
      assert.match(readDarkCssRule(styles, selector), /background:\s*var\(--/)
    }
  })
})
