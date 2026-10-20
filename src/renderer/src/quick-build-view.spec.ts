import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createQuickBuildCompletionPrompt, createQuickBuildLogDownload, getQuickBuildLogOutput, shouldSelectQuickBuildDirectory } from './quick-build-view.js'

describe('quick build view model', () => {
  it('offers to restart into the new app after a successful quick build', () => {
    const prompt = createQuickBuildCompletionPrompt({
      command: 'pnpm package:mac:legacy',
      cwd: '/Users/stone/develop/stone/ForgeDesk',
      artifactPath: '/tmp/ForgeDesk.app',
      status: 'succeeded'
    })

    assert.equal(prompt?.title, '快速构建完成，可以直接重启')
    assert.match(prompt?.description ?? '', /直接重启/)
    assert.match(prompt?.detail ?? '', /pnpm package:mac:legacy/)
    assert.equal(prompt?.restartText, '直接重启')
    assert.equal(prompt?.cancelText, '稍后手动打开')
  })

  it('does not show a reopen prompt for unfinished or unsuccessful quick builds', () => {
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm build:quick', cwd: '/tmp/ForgeDesk', status: 'succeeded' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'running' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'failed' }), null)
    assert.equal(createQuickBuildCompletionPrompt({ command: 'pnpm package:mac:legacy', cwd: '/tmp/ForgeDesk', status: 'cancelled' }), null)
  })

  it('allows replacing an invalid quick build directory after an error', () => {
    assert.equal(shouldSelectQuickBuildDirectory(true, 'error'), true)
    assert.equal(shouldSelectQuickBuildDirectory(false, 'idle'), true)
    assert.equal(shouldSelectQuickBuildDirectory(true, 'success'), false)
  })

  it('shows all retained output rather than only the recent 24000 characters', () => {
    const log = 'EARLY_OUTPUT\n' + 'build output\n'.repeat(4000) + 'LATEST_OUTPUT'
    const task = { command: 'pnpm build:quick', cwd: '/source', status: 'running', log, stdout: 'normal output', stderr: 'compiler diagnostic' }
    assert.equal(getQuickBuildLogOutput(task, 'log'), log)
    assert.equal(getQuickBuildLogOutput(task, 'stdout'), 'normal output')
    assert.equal(getQuickBuildLogOutput(task, 'stderr'), 'compiler diagnostic')
    assert.equal(getQuickBuildLogOutput({ ...task, stderr: undefined }, 'stderr'), '')
  })

  it('exports the selected retained stream with build context and a safe filename', () => {
    const task = { command: 'pnpm build:quick', cwd: '/path with spaces/source', status: 'error', startedAt: '2026-10-19T02:00:00.123Z', log: 'combined output', stdout: 'normal output', stderr: 'error\n'.repeat(6000) }
    const download = createQuickBuildLogDownload(task, 'stderr')
    assert.match(download.fileName, /^forgedesk-build-[\dTZ]+-stderr\.log$/)
    assert.ok(download.content.endsWith(task.stderr))
    assert.match(download.content, /pnpm build:quick/)
    assert.match(download.content, /\/path with spaces\/source/)
    assert.match(download.content, /缓冲上限/)
    assert.equal(download.content.includes('normal output'), false)
    assert.equal(createQuickBuildLogDownload({ command: '', cwd: '', status: 'idle' }, 'log').fileName, 'forgedesk-build-current-log.log')
  })
})
