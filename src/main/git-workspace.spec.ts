import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildGitAddArgs, buildGitCommitArgs, buildGitMergeArgs, buildGitPushArgs, parsePorcelainStatus } from './git-workspace.js'

describe('git workspace operations', () => {
  it('builds safe git add args', () => {
    assert.deepEqual(buildGitAddArgs({ mode: 'all', paths: [] }), ['add', '--all'])
    assert.deepEqual(buildGitAddArgs({ mode: 'paths', paths: ['src/main/index.ts'] }), ['add', '--', 'src/main/index.ts'])
    assert.throws(() => buildGitAddArgs({ mode: 'paths', paths: ['src/main/index.ts;rm'] }), /不支持的文件路径/)
  })

  it('builds safe commit, push, and merge args', () => {
    assert.deepEqual(buildGitCommitArgs({ message: 'feat: add git workflow' }), ['commit', '-m', 'feat: add git workflow'])
    assert.deepEqual(buildGitPushArgs({ remote: 'origin', branch: 'main' }), ['push', 'origin', 'main'])
    assert.deepEqual(buildGitMergeArgs({ source: 'origin/main' }), ['merge', '--no-edit', 'origin/main'])
    assert.throws(() => buildGitCommitArgs({ message: '' }), /请输入提交信息/)
    assert.throws(() => buildGitPushArgs({ remote: 'bad/name', branch: 'main' }), /远端名称/)
    assert.throws(() => buildGitMergeArgs({ source: 'main;rm' }), /不支持的分支/)
  })

  it('parses porcelain status rows', () => {
    assert.deepEqual(parsePorcelainStatus(' M src/App.tsx\nA  README.md\nUU src/conflict.ts\n'), [
      { path: 'src/App.tsx', oldPath: '', indexStatus: ' ', worktreeStatus: 'M', conflict: false },
      { path: 'README.md', oldPath: '', indexStatus: 'A', worktreeStatus: ' ', conflict: false },
      { path: 'src/conflict.ts', oldPath: '', indexStatus: 'U', worktreeStatus: 'U', conflict: true }
    ])
  })
})
