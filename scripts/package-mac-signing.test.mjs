import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdir, mkdtemp, readlink, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeMacFrameworks } from './package-mac-signing.mjs'

async function createFile(path) {
  await writeFile(path, '')
}

describe('legacy mac package signing helpers', () => {
  it('normalizes duplicated Electron framework entries back to version symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-package-mac-'))

    try {
      const appPath = join(root, 'ForgeDesk.app')
      const framework = join(appPath, 'Contents', 'Frameworks', 'ReactiveObjC.framework')
      const versionA = join(framework, 'Versions', 'A')
      const versionCurrent = join(framework, 'Versions', 'Current')

      await mkdir(join(versionA, 'Resources'), { recursive: true })
      await mkdir(join(versionCurrent, 'Resources'), { recursive: true })
      await createFile(join(versionA, 'ReactiveObjC'))
      await createFile(join(versionA, 'Resources', 'Info.plist'))
      await createFile(join(versionCurrent, 'ReactiveObjC'))
      await createFile(join(versionCurrent, 'Resources', 'Info.plist'))
      await createFile(join(framework, 'ReactiveObjC'))
      await mkdir(join(framework, 'Resources'), { recursive: true })

      const normalized = normalizeMacFrameworks(appPath)

      assert.deepEqual(normalized, [framework])
      assert.equal(await readlink(versionCurrent), 'A')
      assert.equal(await readlink(join(framework, 'ReactiveObjC')), join('Versions', 'Current', 'ReactiveObjC'))
      assert.equal(await readlink(join(framework, 'Resources')), join('Versions', 'Current', 'Resources'))
      assert.equal((await stat(join(framework, 'ReactiveObjC'))).isFile(), true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignores apps without a Frameworks directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-package-mac-'))

    try {
      const appPath = join(root, 'ForgeDesk.app')
      await mkdir(join(appPath, 'Contents'), { recursive: true })

      assert.deepEqual(normalizeMacFrameworks(appPath), [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
