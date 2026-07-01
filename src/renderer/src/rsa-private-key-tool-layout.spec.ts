import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function getRsaPrivateKeyToolSource(): string {
  const appSource = readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
  const start = appSource.indexOf('function RsaPrivateKeyTool')
  const end = appSource.indexOf('\nfunction FileDiffTool', start)

  assert.notEqual(start, -1, 'RsaPrivateKeyTool should exist')
  assert.notEqual(end, -1, 'FileDiffTool should follow RsaPrivateKeyTool')

  return appSource.slice(start, end)
}

describe('RSA private key tool layout', () => {
  it('opens the generation form from a standalone button modal', () => {
    const source = getRsaPrivateKeyToolSource()

    assert.match(source, /setGenerationModalOpen\(true\)/)
    assert.match(source, /open=\{generationModalOpen\}/)
    assert.match(source, /className="rsa-generate-action"/)
    assert.match(source, /className="rsa-generation-modal-form"/)
    assert.doesNotMatch(source, /rsa-generation-panel/)
  })

  it('uses distinct icons for public and private key copy actions', () => {
    const source = getRsaPrivateKeyToolSource()

    assert.match(source, /<Tooltip title="复制公钥">[\s\S]*icon=\{<UnlockOutlined \/>\}/)
    assert.match(source, /<Tooltip title="复制私钥">[\s\S]*icon=\{<LockOutlined \/>\}/)
  })
})
