import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it } from 'node:test'
import { discoverSubmoduleTree, parseSubmoduleConfig } from './git-submodules.js'

describe('git submodule discovery', () => {
  it('parses gitmodules config entries grouped by submodule name', () => {
    const output = [
      'submodule.DispatchX.path\0DispatchX\0',
      'submodule.DispatchX.url\0git@github.com:org/DispatchX.git\0',
      'submodule.DispatchX.branch\0develop\0',
      'submodule.CardPIE.path\0CardPIE\0',
      'submodule.CardPIE.url\0git@github.com:org/CardPIE.git\0'
    ].join('')

    assert.deepEqual(parseSubmoduleConfig(output), [
      { name: 'CardPIE', path: 'CardPIE', url: 'git@github.com:org/CardPIE.git', branch: '' },
      { name: 'DispatchX', path: 'DispatchX', url: 'git@github.com:org/DispatchX.git', branch: 'develop' }
    ])
  })

  it('discovers nested submodules and ignores paths outside the parent repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-submodules-'))
    const dispatch = join(root, 'DispatchX')
    const nested = join(dispatch, 'Nested')
    await mkdir(nested, { recursive: true })

    const configOutput = [
      'submodule.DispatchX.path\0DispatchX\0',
      'submodule.DispatchX.url\0git@github.com:org/DispatchX.git\0',
      'submodule.Escape.path\0../outside\0',
      'submodule.Escape.url\0git@github.com:org/Escape.git\0'
    ].join('')
    const nestedConfigOutput = [
      'submodule.Nested.path\0Nested\0',
      'submodule.Nested.url\0git@github.com:org/Nested.git\0'
    ].join('')

    const runGit = async (localPath: string, args: string[]): Promise<string> => {
      if (localPath === root && args[0] === 'config') return configOutput
      if (localPath === root && args[0] === 'submodule') return ' abcdef1234567890 DispatchX\n'
      if (localPath === root && args[0] === 'ls-tree') return '160000 commit abcdef1234567890\tDispatchX\0'
      if (localPath === dispatch && args[0] === 'config') return nestedConfigOutput
      if (localPath === dispatch && args[0] === 'submodule') return ' abcdef9999999999 Nested\n'
      if (localPath === dispatch && args[0] === 'ls-tree') return '160000 commit abcdef9999999999\tNested\0'
      return ''
    }

    try {
      const descriptors = await discoverSubmoduleTree(root, root, runGit)

      assert.deepEqual(descriptors.map((descriptor) => descriptor.relativePath), ['DispatchX', 'DispatchX/Nested'])
      assert.equal(descriptors[0]?.parentRepositoryId, root)
      assert.equal(descriptors[1]?.parentRepositoryId, dispatch)
      assert.equal(descriptors[0]?.expectedCommit, 'abcdef1234567890')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

