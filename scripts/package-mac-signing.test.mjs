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
      const framework = join(root, 'ForgeDesk.app', 'Contents', 'Frameworks', 'Squirrel.framework')
      const versionA = join(framework, 'Versions', 'A')
      const versionCurrent = join(framework, 'Versions', 'Current')

      await mkdir(join(versionA, 'Resources'), { recursive: true })
      await mkdir(join(versionCurrent, 'Resources'), { recursive: true })
      await createFile(join(versionA, 'Squirrel'))
      await createFile(join(versionA, 'Resources', 'Info.plist'))
      await createFile(join(versionCurrent, 'Squirrel'))
      await createFile(join(versionCurrent, 'Resources', 'Info.plist'))
      await createFile(join(framework, 'Squirrel'))
      await mkdir(join(framework, 'Resources'), { recursive: true })

      await normalizeMacFrameworks(join(root, 'ForgeDesk.app'))

      assert.equal(await readlink(versionCurrent), 'A')
      assert.equal(await readlink(join(framework, 'Squirrel')), join('Versions', 'Current', 'Squirrel'))
      assert.equal(await readlink(join(framework, 'Resources')), join('Versions', 'Current', 'Resources'))
      assert.equal((await stat(join(framework, 'Squirrel'))).isFile(), true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does nothing when the app has no framework directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-package-mac-'))

    try {
      await mkdir(join(root, 'ForgeDesk.app', 'Contents'), { recursive: true })

      await normalizeMacFrameworks(join(root, 'ForgeDesk.app'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
