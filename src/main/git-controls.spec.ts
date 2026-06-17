import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseControlledGitCommand, validateRepositoryRemoteName } from './git-controls.js'

describe('git controls', () => {
  it('parses safe git commands for repository command console', () => {
    assert.deepEqual(parseControlledGitCommand('git status --short --branch'), ['status', '--short', '--branch'])
    assert.deepEqual(parseControlledGitCommand('remote -v'), ['remote', '-v'])
    assert.deepEqual(parseControlledGitCommand('log --graph --decorate --oneline --all -n 80'), [
      'log',
      '--graph',
      '--decorate',
      '--oneline',
      '--all',
      '-n',
      '80'
    ])
    assert.deepEqual(parseControlledGitCommand('fetch origin --prune'), ['fetch', 'origin', '--prune'])
  })

  it('rejects shell syntax and destructive git commands', () => {
    assert.throws(() => parseControlledGitCommand('status; rm -rf .'), /不支持 shell 语法/)
    assert.throws(() => parseControlledGitCommand('git reset --hard'), /不支持的 Git 命令/)
    assert.throws(() => parseControlledGitCommand('git push origin main'), /不支持的 Git 命令/)
    assert.throws(() => parseControlledGitCommand('git checkout main'), /不支持的 Git 命令/)
  })

  it('validates repository remote names', () => {
    assert.equal(validateRepositoryRemoteName('origin'), 'origin')
    assert.equal(validateRepositoryRemoteName('company.mirror-1'), 'company.mirror-1')
    assert.throws(() => validateRepositoryRemoteName('origin/main'), /远端名称只能包含/)
    assert.throws(() => validateRepositoryRemoteName(''), /请输入远端名称/)
  })
})
