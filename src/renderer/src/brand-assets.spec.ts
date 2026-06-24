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
})
