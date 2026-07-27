import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRemoteCloneArgs, deriveRemoteRepositoryName, findNearestRepositoryParent, resolveRemoteCloneTarget } from './project-creation.js'

describe('remote project creation helpers', () => {
  it('derives repository names from HTTPS and SSH URLs', () => {
    assert.equal(deriveRemoteRepositoryName('https://github.com/org/ForgeDesk.git'), 'ForgeDesk')
    assert.equal(deriveRemoteRepositoryName('git@github.com:org/ForgeDesk.git/'), 'ForgeDesk')
    assert.equal(deriveRemoteRepositoryName('ssh://git@example.com/org/ForgeDesk.git?ref=main'), 'ForgeDesk')
  })

  it('rejects remote URLs that cannot produce a safe destination name', () => {
    assert.throws(() => deriveRemoteRepositoryName(''), /无法从远程地址识别仓库名称/)
    assert.throws(() => deriveRemoteRepositoryName('https://github.com/org/-private.git'), /无法从远程地址识别仓库名称/)
    assert.throws(() => buildRemoteCloneArgs('-bad-url', '/tmp/ForgeDesk'), /远程仓库地址格式不受支持/)
  })

  it('builds recursive clone arguments and a parent-directory target', () => {
    assert.equal(resolveRemoteCloneTarget('/Users/stone/Dev', 'git@github.com:org/ForgeDesk.git'), '/Users/stone/Dev/ForgeDesk')
    assert.deepEqual(buildRemoteCloneArgs('https://github.com/org/ForgeDesk.git', '/Users/stone/Dev/ForgeDesk'), [
      'clone',
      '--recurse-submodules',
      'https://github.com/org/ForgeDesk.git',
      '/Users/stone/Dev/ForgeDesk'
    ])
  })

  it('finds the nearest parent repository for nested projects', () => {
    const repositories = ['/workspace', '/workspace/apps', '/workspace/apps/web', '/workspace/tools']

    assert.equal(findNearestRepositoryParent('/workspace/apps/web/packages/ui', repositories), '/workspace/apps/web')
    assert.equal(findNearestRepositoryParent('/workspace/tools', repositories), '/workspace')
    assert.equal(findNearestRepositoryParent('/other/project', repositories), '')
  })
})
