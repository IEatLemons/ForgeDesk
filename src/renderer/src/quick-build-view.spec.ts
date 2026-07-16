import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createQuickBuildCompletionPrompt } from './quick-build-view.js'

describe('quick build view model', () => {
  it('offers to restart into the new app after a successful quick build', () => {
    const prompt = createQuickBuildCompletionPrompt({
      command: 'pnpm package:mac:legacy',
      cwd: '/Users/stone/develop/stone/ForgeDesk',
      status: 'succeeded'
    })

    assert.equal(prompt?.title, '快速构建完成，可以直接重启')
    assert.match(prompt?.description ?? '', /直接重启/)
    assert.match(prompt?.detail ?? '', /pnpm package:mac:legacy/)
    assert.equal(prompt?.restartText, '直接重启')
    assert.equal(prompt?.cancelText, '稍后手动打开')
  })

  it('does not show a reopen prompt for unfinished or unsuccessful quick builds', () => {
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'running' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'failed' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'cancelled' }), null)
  })
})
