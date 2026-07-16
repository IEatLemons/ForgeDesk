import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

describe('deployment approval view', () => {
  it('exposes repository-only configuration, cumulative review and risk confirmation', () => {
    const source = readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

    assert.match(source, /快速审核上线/)
    assert.match(source, /添加目录/)
    assert.match(source, /目标目录和触发文件完全由当前仓库配置决定/)
    assert.match(source, /分析目标分支/)
    assert.match(source, /确认审核并推送/)
    assert.match(source, /当前工作区不会被切换/)
    assert.match(source, /我已检查上述风险文件及 diff/)
    assert.doesNotMatch(source, /DEPLOYMENT_BLOCKED/)
    assert.doesNotMatch(source, /initialServiceId/)
    assert.match(source, /listRepositoryDeploymentApprovals/)
    assert.match(source, /executeRepositoryDeploymentApproval/)
    assert.match(styles, /\.deployment-approval-patch/)
    assert.match(styles, /max-height: 420px/)
  })
})
