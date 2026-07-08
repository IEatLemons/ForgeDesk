import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

describe('env file diff tool layout', () => {
  it('keeps paste areas visible while allowing file imports', () => {
    const appSource = readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

    assert.match(appSource, /环境 A（基准）/)
    assert.match(appSource, /环境 B/)
    assert.match(appSource, /导入环境 A 文件/)
    assert.match(appSource, /导入环境 B 文件/)
    assert.match(appSource, /复制环境 A/)
    assert.match(appSource, /复制环境 B/)
    assert.match(appSource, /对比任务/)
    assert.match(appSource, /新建对比/)
    assert.match(appSource, /搜索任务、文件或变量/)
    assert.match(appSource, /任务名称/)
    assert.match(appSource, /删除这个对比任务/)
    assert.match(appSource, /对比结果表格/)
    assert.match(appSource, /Table<EnvFileDiffRow>/)
    assert.match(appSource, /Input\.TextArea/)
    assert.match(appSource, /env-diff-value-input/)
    assert.match(appSource, /readStoredEnvFileDiffTasks/)
    assert.match(appSource, /pagination=\{false\}/)
    assert.doesNotMatch(appSource, /const \[inputMode/)
    assert.doesNotMatch(appSource, /const \[sourceText, setSourceText\]/)
    assert.match(styles, /\.env-diff-task-list/)
    assert.match(styles, /\.env-diff-task-item/)
    assert.match(styles, /\.env-diff-main-stack/)
    assert.match(styles, /\.env-diff-current-task/)
    assert.match(styles, /\.env-file-import-button/)
    assert.match(styles, /\.env-diff-value-input/)
  })
})
