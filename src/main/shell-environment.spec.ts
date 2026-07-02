import assert from 'node:assert/strict'
import { delimiter } from 'node:path'
import { describe, it } from 'node:test'
import {
  createGuiToolFallbackPath,
  createScriptExecutionEnv,
  mergePathValues,
  parseShellEnvironmentOutput,
  splitPathValue,
  type ShellEnvironmentExecFileRunner
} from './shell-environment.js'

describe('shell environment helpers', () => {
  it('merges path values without duplicates or empty segments', () => {
    assert.equal(mergePathValues(`/usr/bin${delimiter}/bin`, `/bin${delimiter}/opt/homebrew/bin`, ''), `/usr/bin${delimiter}/bin${delimiter}/opt/homebrew/bin`)
    assert.deepEqual(splitPathValue(`${delimiter}/usr/bin${delimiter}${delimiter}/bin${delimiter}`), ['/usr/bin', '/bin'])
  })

  it('adds macOS GUI fallback tool paths', () => {
    const paths = splitPathValue(createGuiToolFallbackPath({ homeDirectory: '/Users/dev', platform: 'darwin' }))

    assert.ok(paths.includes('/Users/dev/Library/pnpm'))
    assert.ok(paths.includes('/opt/homebrew/bin'))
    assert.ok(paths.includes('/usr/local/bin'))
    assert.ok(paths.includes('/usr/bin'))
  })

  it('parses shell environment output between sentinels', () => {
    const parsed = parseShellEnvironmentOutput([
      'startup noise',
      '__FORGEDESK_SHELL_ENV_START__',
      `/Users/dev/Library/pnpm${delimiter}/opt/homebrew/bin`,
      '/Users/dev/Library/pnpm',
      '__FORGEDESK_SHELL_ENV_END__',
      'shutdown noise'
    ].join('\n'))

    assert.deepEqual(parsed, {
      path: `/Users/dev/Library/pnpm${delimiter}/opt/homebrew/bin`,
      pnpmHome: '/Users/dev/Library/pnpm'
    })
  })

  it('builds script environments from the interactive shell path', async () => {
    const execFileRunner: ShellEnvironmentExecFileRunner = (_file, _args, _options, callback) => {
      callback(
        null,
        [
          '__FORGEDESK_SHELL_ENV_START__',
          `/Users/dev/Library/pnpm${delimiter}/opt/homebrew/bin${delimiter}/usr/bin`,
          '/Users/dev/Library/pnpm',
          '__FORGEDESK_SHELL_ENV_END__'
        ].join('\n'),
        ''
      )
    }
    const env = await createScriptExecutionEnv(
      { GITHUB_TOKEN: 'token', PATH: '/custom/bin' },
      { execFileRunner, homeDirectory: '/Users/dev', platform: 'darwin', shell: '/bin/zsh' }
    )
    const paths = splitPathValue(env.PATH)

    assert.equal(env.GITHUB_TOKEN, 'token')
    assert.equal(env.PNPM_HOME, '/Users/dev/Library/pnpm')
    assert.deepEqual(paths.slice(0, 4), ['/custom/bin', '/Users/dev/Library/pnpm', '/opt/homebrew/bin', '/usr/bin'])
  })

  it('keeps useful fallback paths when shell lookup fails', async () => {
    const execFileRunner: ShellEnvironmentExecFileRunner = (_file, _args, _options, callback) => {
      callback(new Error('shell failed'), '', '')
    }
    const env = await createScriptExecutionEnv(
      { PATH: '/usr/bin' },
      { execFileRunner, homeDirectory: '/Users/dev', platform: 'darwin', shell: '/bin/zsh' }
    )
    const paths = splitPathValue(env.PATH)

    assert.ok(paths.includes('/Users/dev/Library/pnpm'))
    assert.ok(paths.includes('/opt/homebrew/bin'))
    assert.ok(paths.includes('/usr/bin'))
  })
})
