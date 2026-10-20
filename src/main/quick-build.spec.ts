import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { QuickBuildOutputReader, validateQuickBuildArtifact } from './quick-build.js'
import { parseQuickBuildEvent, QUICK_BUILD_EVENT_PREFIX } from '../shared/quick-build.js'

describe('quick build task protocol and artifact binding', () => {
  it('accepts valid stage events but ignores arbitrary output and malformed values', () => {
    const line = QUICK_BUILD_EVENT_PREFIX + JSON.stringify({ stage: { id: 'types', title: '类型检查', status: 'succeeded', elapsedMs: 123, cacheHit: true } })
    assert.equal(parseQuickBuildEvent(line)?.stage?.cacheHit, true)
    assert.equal(parseQuickBuildEvent('ordinary compiler output'), null)
    assert.equal(parseQuickBuildEvent(QUICK_BUILD_EVENT_PREFIX + '{'), null)
    assert.equal(parseQuickBuildEvent(QUICK_BUILD_EVENT_PREFIX + JSON.stringify({stage:{id:'x',title:'x',status:'succeeded',elapsedMs:-1}})), null)
  })
  it('handles chunked JSON, several lines, and oversized log lines', () => {
    const reader = new QuickBuildOutputReader()
    const line = QUICK_BUILD_EVENT_PREFIX + JSON.stringify({ artifactPath: '/tmp/a.app', reportPath: '/tmp/report.json', architecture: 'arm64', elapsedMs: 20, reused: true })
    assert.deepEqual(reader.push(line.slice(0, 20)), [])
    assert.equal(reader.push(line.slice(20) + '\n')[0].reused, true)
    reader.push('x'.repeat(20000)); assert.equal(reader.push('\n' + line + '\n').length, 1)
  })
  it('binds restart to a success manifest in the correct source directory', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'forgedesk-artifact-test-')))
    const app = join(root, 'dist', 'quick-build', 'one', 'ForgeDesk.app')
    try {
      mkdirSync(join(app, 'Contents', 'Resources'), { recursive: true }); mkdirSync(join(app, 'Contents', 'MacOS'))
      writeFileSync(join(app, 'Contents', 'MacOS', 'ForgeDesk'), '')
      const manifest = { formatVersion: 1, sourceRoot: root, localOnly: true, architecture: 'arm64' }
      writeFileSync(join(app, 'Contents', 'Resources', 'quick-build.json'), JSON.stringify(manifest))
      assert.equal(validateQuickBuildArtifact({ cwd: root, artifactPath: app, architecture: 'arm64' }), app)
      assert.throws(() => validateQuickBuildArtifact({ cwd: root }), /不能打开旧应用/)
      assert.throws(() => validateQuickBuildArtifact({ cwd: root, artifactPath: app, architecture: 'x64' }), /不匹配/)
      const alias = join(root, 'dist', 'quick-build', 'alias.app'); symlinkSync(app, alias)
      assert.throws(() => validateQuickBuildArtifact({ cwd: root, artifactPath: alias, architecture: 'arm64' }), /不属于/)
      writeFileSync(join(app, 'Contents', 'Resources', 'quick-build.json'), JSON.stringify({ ...manifest, sourceRoot: '/another-project' }))
      assert.throws(() => validateQuickBuildArtifact({ cwd: root, artifactPath: app, architecture: 'arm64' }), /不匹配/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
