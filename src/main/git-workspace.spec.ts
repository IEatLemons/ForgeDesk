import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildGitAddArgs,
  buildGitCommitArgs,
  buildGitDiffStatArgs,
  buildGitFastForwardCheckArgs,
  buildGitMergeArgs,
  buildGitMergeBaseArgs,
  buildGitMergeTreeArgs,
  buildGitPushArgs,
  buildGitRevListCountArgs,
  buildGitTagArgs,
  buildGitVerifyRefArgs,
  parsePorcelainStatus
} from './git-workspace.js'

describe('git workspace operations', () => {
  it('builds safe git add args', () => {
    assert.deepEqual(buildGitAddArgs({ mode: 'all', paths: [] }), ['add', '--all'])
    assert.deepEqual(buildGitAddArgs({ mode: 'paths', paths: ['src/main/index.ts'] }), ['add', '--', 'src/main/index.ts'])
    assert.throws(() => buildGitAddArgs({ mode: 'paths', paths: ['src/main/index.ts;rm'] }), /不支持的文件路径/)
  })

  it('builds safe git diff stat args for selected files', () => {
    assert.deepEqual(buildGitDiffStatArgs(['src/main/index.ts', 'src/renderer/src/App.tsx']), ['diff', '--stat', '--', 'src/main/index.ts', 'src/renderer/src/App.tsx'])
    assert.throws(() => buildGitDiffStatArgs([]), /请选择文件/)
    assert.throws(() => buildGitDiffStatArgs(['../outside.ts']), /不支持的文件路径/)
  })

  it('builds safe commit, push, and merge args', () => {
    assert.deepEqual(buildGitCommitArgs({ message: 'feat: add git workflow' }), ['commit', '-m', 'feat: add git workflow'])
    assert.deepEqual(buildGitCommitArgs({ message: 'feat: add git workflow', paths: ['src/main/index.ts'] }), ['commit', '-m', 'feat: add git workflow', '--', 'src/main/index.ts'])
    assert.deepEqual(buildGitTagArgs('v1.2.3'), ['tag', 'v1.2.3'])
    assert.deepEqual(buildGitTagArgs(' release/1.2.3 '), ['tag', 'release/1.2.3'])
    assert.deepEqual(buildGitPushArgs({ remote: 'origin', branch: 'main' }), ['push', 'origin', 'main'])
    assert.deepEqual(buildGitMergeArgs({ source: 'origin/main' }), ['merge', '--no-edit', 'origin/main'])
    assert.throws(() => buildGitCommitArgs({ message: '' }), /请输入提交信息/)
    assert.throws(() => buildGitCommitArgs({ message: 'feat: bad path', paths: ['src/main/index.ts;rm'] }), /不支持的文件路径/)
    assert.throws(() => buildGitTagArgs('v1.2.3;rm'), /不支持的Tag/)
    assert.throws(() => buildGitPushArgs({ remote: 'bad/name', branch: 'main' }), /远端名称/)
    assert.throws(() => buildGitMergeArgs({ source: 'main;rm' }), /不支持的分支/)
  })

  it('builds safe merge analysis args', () => {
    assert.deepEqual(buildGitVerifyRefArgs('origin/main'), ['rev-parse', '--verify', 'origin/main'])
    assert.deepEqual(buildGitRevListCountArgs('main', 'origin/main'), ['rev-list', '--count', 'main..origin/main'])
    assert.deepEqual(buildGitMergeBaseArgs({ target: 'main', source: 'origin/main' }), ['merge-base', 'main', 'origin/main'])
    assert.deepEqual(buildGitFastForwardCheckArgs({ target: 'main', source: 'origin/main' }), ['merge-base', '--is-ancestor', 'main', 'origin/main'])
    assert.deepEqual(buildGitMergeTreeArgs({ target: 'main', source: 'origin/main' }), ['merge-tree', '--write-tree', 'main', 'origin/main'])
    assert.throws(() => buildGitVerifyRefArgs('main;rm'), /不支持的分支/)
    assert.throws(() => buildGitRevListCountArgs('main', 'feature bad'), /不支持的分支/)
  })

  it('parses porcelain status rows', () => {
    assert.deepEqual(parsePorcelainStatus(' M src/App.tsx\nA  README.md\nUU src/conflict.ts\n'), [
      { path: 'src/App.tsx', oldPath: '', indexStatus: ' ', worktreeStatus: 'M', conflict: false },
      { path: 'README.md', oldPath: '', indexStatus: 'A', worktreeStatus: ' ', conflict: false },
      { path: 'src/conflict.ts', oldPath: '', indexStatus: 'U', worktreeStatus: 'U', conflict: true }
    ])
  })

  it('keeps the first path character when status output has one status column', () => {
    assert.deepEqual(parsePorcelainStatus('M src/main/ai-conflict-assistant.ts\n'), [
      { path: 'src/main/ai-conflict-assistant.ts', oldPath: '', indexStatus: 'M', worktreeStatus: ' ', conflict: false }
    ])
  })
})
