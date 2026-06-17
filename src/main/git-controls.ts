const REMOTE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/
const SAFE_REF_PATTERN = /^[A-Za-z0-9._/@:+-]+$/
const SHELL_SYNTAX_PATTERN = /[;&|<>`$\\\n\r]/

const STATUS_FLAGS = new Set(['--short', '-s', '--branch', '-b', '--porcelain', '--ignored', '--untracked-files=all', '--untracked-files=no', '--untracked-files=normal'])
const BRANCH_FLAGS = new Set(['-a', '--all', '-r', '--remotes', '-v', '-vv', '--verbose', '--list'])
const LOG_FLAGS = new Set(['--graph', '--decorate', '--oneline', '--all', '--stat'])

export function validateRepositoryRemoteName(value: string): string {
  const name = value.trim()

  if (!name) {
    throw new Error('请输入远端名称')
  }

  if (!REMOTE_NAME_PATTERN.test(name)) {
    throw new Error('远端名称只能包含字母、数字、点、下划线和短横线')
  }

  return name
}

function assertNoShellSyntax(command: string): void {
  if (SHELL_SYNTAX_PATTERN.test(command) || command.includes('&&') || command.includes('||')) {
    throw new Error('不支持 shell 语法，只能输入受控 Git 命令')
  }
}

function assertSafeRef(token: string): void {
  if (!SAFE_REF_PATTERN.test(token)) {
    throw new Error(`不支持的引用参数：${token}`)
  }
}

function assertPositiveLimit(value: string): void {
  const limit = Number(value)

  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error('log 数量限制必须是 1 到 200 的整数')
  }
}

function parseStatus(args: string[]): string[] {
  for (const arg of args) {
    if (!STATUS_FLAGS.has(arg)) {
      throw new Error(`status 不支持参数：${arg}`)
    }
  }

  return ['status', ...args]
}

function parseRemote(args: string[]): string[] {
  if (args.length === 1 && (args[0] === '-v' || args[0] === '--verbose')) {
    return ['remote', '-v']
  }

  throw new Error('remote 只支持 remote -v')
}

function parseBranch(args: string[]): string[] {
  for (const arg of args) {
    if (!BRANCH_FLAGS.has(arg)) {
      throw new Error(`branch 不支持参数：${arg}`)
    }
  }

  return ['branch', ...args]
}

function parseLog(args: string[]): string[] {
  const parsed: string[] = ['log']

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (LOG_FLAGS.has(arg)) {
      parsed.push(arg)
      continue
    }

    if (arg === '-n') {
      const limit = args[index + 1]

      if (!limit) {
        throw new Error('log -n 需要数量')
      }

      assertPositiveLimit(limit)
      parsed.push(arg, limit)
      index += 1
      continue
    }

    if (arg.startsWith('--max-count=')) {
      assertPositiveLimit(arg.slice('--max-count='.length))
      parsed.push(arg)
      continue
    }

    assertSafeRef(arg)
    parsed.push(arg)
  }

  return parsed
}

function parseStatCommand(command: 'show' | 'diff', args: string[]): string[] {
  if (!args.includes('--stat')) {
    throw new Error(`${command} 只支持带 --stat 的只读查看`)
  }

  for (const arg of args) {
    if (arg === '--stat') {
      continue
    }

    assertSafeRef(arg)
  }

  return [command, ...args]
}

function parseFetch(args: string[]): string[] {
  if (args.length === 1 && args[0] === '--prune') {
    return ['fetch', '--prune']
  }

  if (args.length === 2 && args[1] === '--prune') {
    return ['fetch', validateRepositoryRemoteName(args[0]), '--prune']
  }

  if (args.length === 2 && args[0] === '--prune') {
    return ['fetch', validateRepositoryRemoteName(args[1]), '--prune']
  }

  throw new Error('fetch 只支持 fetch --prune 或 fetch <remote> --prune')
}

export function parseControlledGitCommand(command: string): string[] {
  const trimmed = command.trim()

  if (!trimmed) {
    throw new Error('请输入 Git 命令')
  }

  assertNoShellSyntax(trimmed)

  const tokens = trimmed.split(/\s+/)

  if (tokens[0] === 'git') {
    tokens.shift()
  }

  const [subcommand, ...args] = tokens

  switch (subcommand) {
    case 'status':
      return parseStatus(args)
    case 'remote':
      return parseRemote(args)
    case 'branch':
      return parseBranch(args)
    case 'log':
      return parseLog(args)
    case 'show':
      return parseStatCommand('show', args)
    case 'diff':
      return parseStatCommand('diff', args)
    case 'fetch':
      return parseFetch(args)
    default:
      throw new Error(`不支持的 Git 命令：${subcommand || command}`)
  }
}
