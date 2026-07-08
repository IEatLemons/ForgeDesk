import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  inspectCliEnvironment,
  repairCliEnvironment,
  type CliEnvironmentCommandCheck
} from './cli-environment.js'

const healthyGitCheck: CliEnvironmentCommandCheck = {
  name: 'git',
  available: true,
  path: '/usr/bin/git',
  version: 'git version 2.39.0',
  error: ''
}

function createCliEnvironmentTestOptions(homeDirectory: string) {
  return {
    commandChecks: [healthyGitCheck],
    env: { PATH: '/usr/bin' },
    homeDirectory,
    now: () => new Date('2026-07-06T08:00:00.000Z'),
    platform: 'darwin' as NodeJS.Platform,
    shell: '/bin/zsh',
    shellEnvironment: {
      path: '/opt/homebrew/bin:/usr/bin',
      pnpmHome: ''
    }
  }
}

describe('CLI environment tool', () => {
  it('detects when zsh does not load .profile and has no Git prompt', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forgedesk-cli-env-'))

    try {
      await writeFile(join(home, '.profile'), 'export PNPM_HOME="$HOME/Library/pnpm"\n', 'utf8')
      await writeFile(join(home, '.zprofile'), '# local login setup\n', 'utf8')
      await writeFile(join(home, '.zshrc'), '# local interactive setup\n', 'utf8')

      const snapshot = await inspectCliEnvironment(createCliEnvironmentTestOptions(home))

      assert.equal(snapshot.profileSourcedFromLoginFile, false)
      assert.equal(snapshot.promptConfigured, false)
      assert.equal(snapshot.listingColorsConfigured, false)
      assert.deepEqual(snapshot.repairableActions, ['source-profile-from-zprofile', 'install-zsh-dev-prompt', 'install-zsh-ls-colors'])
      assert.ok(snapshot.issues.some((issue) => issue.id === 'zprofile-missing-profile-source'))
      assert.ok(snapshot.issues.some((issue) => issue.id === 'zshrc-missing-dev-prompt'))
      assert.ok(snapshot.issues.some((issue) => issue.id === 'zshrc-missing-listing-colors'))
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('recognizes existing profile loading and prompt frameworks', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forgedesk-cli-env-'))

    try {
      await writeFile(join(home, '.profile'), 'export PATH="$HOME/bin:$PATH"\n', 'utf8')
      await writeFile(join(home, '.zprofile'), '[ -f ~/.profile ] && source ~/.profile\n', 'utf8')
      await writeFile(join(home, '.zshrc'), 'eval "$(starship init zsh)"\nexport CLICOLOR=1\n', 'utf8')

      const snapshot = await inspectCliEnvironment(createCliEnvironmentTestOptions(home))

      assert.equal(snapshot.profileSourcedFromLoginFile, true)
      assert.equal(snapshot.promptConfigured, true)
      assert.equal(snapshot.promptProvider, 'Starship')
      assert.equal(snapshot.listingColorsConfigured, true)
      assert.equal(snapshot.listingColorProvider, 'CLICOLOR')
      assert.deepEqual(snapshot.repairableActions, [])
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('repairs missing zsh profile loading and prompt setup without duplicating blocks', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forgedesk-cli-env-'))

    try {
      await writeFile(join(home, '.profile'), 'export PATH="$HOME/bin:$PATH"\n', 'utf8')
      await writeFile(join(home, '.zprofile'), 'export OLD_LOGIN_VALUE=1\n', 'utf8')
      await writeFile(join(home, '.zshrc'), '# existing prompt notes\n', 'utf8')

      const result = await repairCliEnvironment(createCliEnvironmentTestOptions(home))
      const zprofile = await readFile(join(home, '.zprofile'), 'utf8')
      const zshrc = await readFile(join(home, '.zshrc'), 'utf8')

      assert.deepEqual(result.appliedActions, ['source-profile-from-zprofile', 'install-zsh-dev-prompt', 'install-zsh-ls-colors'])
      assert.deepEqual(result.changedFiles.sort(), [join(home, '.zprofile'), join(home, '.zshrc')].sort())
      assert.equal(result.backupFiles.length, 2)
      assert.match(zprofile, /ForgeDesk shell profile loader/)
      assert.match(zprofile, /\. "\$HOME\/\.profile"/)
      assert.match(zshrc, /ForgeDesk developer prompt/)
      assert.match(zshrc, /forgedesk_git_prompt/)
      assert.match(zshrc, /ForgeDesk listing colors/)
      assert.match(zshrc, /alias ls='ls -G'/)
      assert.equal(result.snapshot.profileSourcedFromLoginFile, true)
      assert.equal(result.snapshot.promptProvider, 'ForgeDesk')
      assert.equal(result.snapshot.listingColorProvider, 'ForgeDesk')
      assert.equal(await readFile(result.backupFiles[0], 'utf8').then((content) => content.length > 0), true)

      const secondResult = await repairCliEnvironment(createCliEnvironmentTestOptions(home))

      assert.deepEqual(secondResult.appliedActions, [])
      assert.deepEqual(secondResult.changedFiles, [])
      assert.deepEqual(secondResult.backupFiles, [])
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
