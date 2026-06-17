import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGitErrorGuidance } from './git-error-guidance.js'

describe('git error guidance', () => {
  it('explains SSH public key permission failures in Chinese', () => {
    const guidance = createGitErrorGuidance(
      new Error(
        "Error invoking remote method 'repository:remote:fetch': Error: git@ssh.github.com: Permission denied (publickey). fatal: Could not read from remote repository."
      ),
      '同步远端'
    )

    assert.equal(guidance.title, '同步远端失败：SSH 公钥无权限')
    assert.match(guidance.summary, /当前 SSH 公钥没有访问这个远端仓库的权限/)
    assert.ok(guidance.actions.some((action) => action.includes('复制到 GitHub')))
    assert.ok(guidance.actions.some((action) => action.includes('SSH config')))
    assert.ok(guidance.actions.some((action) => action.includes('远端地址')))
  })

  it('explains missing remote configuration failures', () => {
    const guidance = createGitErrorGuidance(new Error('缺少 company 内部 Gitea 远端'), '检查远端对齐')

    assert.equal(guidance.title, '检查远端对齐失败：缺少远端配置')
    assert.ok(guidance.actions.some((action) => action.includes('新增远端')))
    assert.ok(guidance.actions.some((action) => action.includes('Fetch 全部')))
  })

  it('keeps the original error for generic git failures', () => {
    const guidance = createGitErrorGuidance('fatal: unexpected remote disconnect', '读取仓库')

    assert.equal(guidance.title, '读取仓库失败')
    assert.equal(guidance.rawMessage, 'fatal: unexpected remote disconnect')
    assert.ok(guidance.actions.length > 0)
  })
})
