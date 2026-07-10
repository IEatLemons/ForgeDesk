import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createQuickBuildCompletionPrompt } from './quick-build-view.js'

describe('quick build view model', () => {
  it('asks the user to reopen the app after a successful quick build', () => {
    const prompt = createQuickBuildCompletionPrompt({
      command: 'pnpm package:mac:legacy',
      cwd: '/Users/stone/develop/stone/ForgeDesk',
      status: 'succeeded'
    })

    assert.equal(prompt?.title, '快速构建完成，请重新打开 app')
    assert.match(prompt?.description ?? '', /重新打开 app/)
    assert.match(prompt?.detail ?? '', /pnpm package:mac:legacy/)
  })

  it('does not show a reopen prompt for unfinished or unsuccessful quick builds', () => {
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'running' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'failed' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'cancelled' }), null)
  })
})
