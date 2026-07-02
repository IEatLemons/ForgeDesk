import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, delimiter, join } from 'node:path'

export type ShellEnvironmentSnapshot = {
  path: string
  pnpmHome: string
}

export type ShellEnvironmentExecFileRunner = (
  file: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; maxBuffer: number; timeout: number },
  callback: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void
) => void

type ShellEnvironmentOptions = {
  env?: NodeJS.ProcessEnv
  execFileRunner?: ShellEnvironmentExecFileRunner
  homeDirectory?: string
  platform?: NodeJS.Platform
  shell?: string
  timeoutMs?: number
}

const shellEnvStart = '__FORGEDESK_SHELL_ENV_START__'
const shellEnvEnd = '__FORGEDESK_SHELL_ENV_END__'

export function splitPathValue(value: string | undefined): string[] {
  return (value ?? '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function mergePathValues(...values: Array<string | undefined>): string {
  const seen = new Set<string>()
  const paths: string[] = []

  for (const value of values) {
    for (const path of splitPathValue(value)) {
      if (!seen.has(path)) {
        seen.add(path)
        paths.push(path)
      }
    }
  }

  return paths.join(delimiter)
}

export function createGuiToolFallbackPath({
  homeDirectory = homedir(),
  platform = process.platform
}: {
  homeDirectory?: string
  platform?: NodeJS.Platform
} = {}): string {
  if (platform === 'win32') {
    return ''
  }

  const homePaths = [
    join(homeDirectory, 'Library', 'pnpm'),
    join(homeDirectory, '.local', 'share', 'pnpm'),
    join(homeDirectory, '.local', 'bin'),
    join(homeDirectory, '.volta', 'bin'),
    join(homeDirectory, '.asdf', 'shims'),
    join(homeDirectory, '.bun', 'bin'),
    join(homeDirectory, '.yarn', 'bin')
  ]
  const systemPaths = platform === 'darwin'
    ? ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
    : ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']

  return mergePathValues([...homePaths, ...systemPaths].join(delimiter))
}

export function parseShellEnvironmentOutput(output: string | Buffer): ShellEnvironmentSnapshot {
  const text = Buffer.isBuffer(output) ? output.toString('utf8') : output
  const lines = text.split(/\r?\n/)
  const startIndex = lines.findIndex((line) => line === shellEnvStart)
  const endIndex = startIndex >= 0 ? lines.findIndex((line, index) => index > startIndex && line === shellEnvEnd) : -1

  if (startIndex < 0 || endIndex < 0) {
    return { path: '', pnpmHome: '' }
  }

  return {
    path: lines[startIndex + 1] ?? '',
    pnpmHome: lines[startIndex + 2] ?? ''
  }
}

function createShellEnvironmentArgs(shell: string): string[] {
  if (basename(shell) === 'fish') {
    return ['-lic', `printf '${shellEnvStart}\\n'; string join : $PATH; printf '\\n%s\\n${shellEnvEnd}\\n' "$PNPM_HOME"`]
  }

  return ['-ilc', `printf '${shellEnvStart}\\n%s\\n%s\\n${shellEnvEnd}\\n' "$PATH" "\${PNPM_HOME:-}"`]
}

export async function readUserShellEnvironment(options: ShellEnvironmentOptions = {}): Promise<ShellEnvironmentSnapshot> {
  const platform = options.platform ?? process.platform

  if (platform === 'win32') {
    return { path: '', pnpmHome: '' }
  }

  const env = { ...process.env, ...options.env }
  const shell = options.shell ?? env.SHELL ?? (platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  const args = createShellEnvironmentArgs(shell)
  const runner: ShellEnvironmentExecFileRunner = options.execFileRunner ?? ((file, execArgs, execOptions, callback) => {
    execFile(file, execArgs, execOptions, (error, stdout, stderr) => callback(error, stdout, stderr))
  })

  return new Promise((resolveResult) => {
    try {
      runner(shell, args, { env, maxBuffer: 1024 * 1024, timeout: options.timeoutMs ?? 3000 }, (error, stdout) => {
        resolveResult(error ? { path: '', pnpmHome: '' } : parseShellEnvironmentOutput(stdout))
      })
    } catch {
      resolveResult({ path: '', pnpmHome: '' })
    }
  })
}

export async function createScriptExecutionEnv(extraEnv: NodeJS.ProcessEnv = {}, options: ShellEnvironmentOptions = {}): Promise<NodeJS.ProcessEnv> {
  const baseEnv = { ...process.env, ...extraEnv }
  const shellEnvironment = await readUserShellEnvironment({ ...options, env: baseEnv })
  const pnpmHome = extraEnv.PNPM_HOME || baseEnv.PNPM_HOME || shellEnvironment.pnpmHome
  const path = mergePathValues(
    extraEnv.PATH,
    shellEnvironment.path,
    pnpmHome,
    createGuiToolFallbackPath({ homeDirectory: options.homeDirectory, platform: options.platform }),
    process.env.PATH
  )

  return {
    ...baseEnv,
    ...(pnpmHome ? { PNPM_HOME: pnpmHome } : {}),
    PATH: path
  }
}
