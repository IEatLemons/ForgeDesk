import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

describe('brand assets', () => {
  it('keeps the sidebar logo compact and visually light', () => {
    const styles = readFileSync(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

    assert.match(styles, /\.brand-mark\s*{[^}]*width:\s*32px;/s)
    assert.match(styles, /\.brand-mark\s*{[^}]*height:\s*32px;/s)
    assert.match(styles, /\.brand-mark\s*{[^}]*box-shadow:\s*none;/s)
  })

  it('uses a simple flat SVG mark for the app logo', () => {
    const logo = readFileSync(join(process.cwd(), 'src/renderer/src/assets/forgedesk-logo.svg'), 'utf8')

    assert.doesNotMatch(logo, /linearGradient|radialGradient|filter|rgba\(/)
    assert.match(logo, /aria-label="ForgeDesk"/)
  })

  it('places the app version in the bottom status bar instead of the sidebar brand', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

    assert.doesNotMatch(source, /brand-version/)
    assert.match(source, /function AppStatusBar\(\{[\s\S]*versionLabel/)
    assert.match(source, /<AppStatusBar[\s\S]*versionLabel={appVersionLabel}/)
    assert.match(source, /app-status-bar-version/)
    assert.match(styles, /\.app-status-bar-version\s*{[^}]*font-weight:\s*600;/s)
  })

  it('places quick build in the bottom status bar instead of the sidebar footer', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

    assert.doesNotMatch(source, /quick-build-button/)
    assert.match(source, /function AppStatusBar\(\{[\s\S]*quickBuildState/)
    assert.match(source, /app-status-bar-quick-build/)
    assert.match(source, /showQuickBuildButton = appRuntimeInfo\?\.canQuickBuild === true/)
    assert.doesNotMatch(source, /showQuickBuildButton = appRuntimeInfo\?\.isDevelopmentBuild === true/)
    assert.match(source, /startQuickBuild\(\)/)
    assert.doesNotMatch(styles, /\.quick-build-button/)
    assert.match(styles, /\.app-status-bar-quick-build\s*{/)
  })
})
