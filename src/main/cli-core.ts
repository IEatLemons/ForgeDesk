import { parseControlledGitCommand } from './git-controls.js'

export type ForgeDeskCliCommand =
  | {
      command: 'help'
    }
  | {
      command: 'projects'
    }
  | {
      command: 'repos'
      project?: string
    }
  | {
      command: 'git'
      repo: string
      gitArgs: string[]
    }

export type CliProjectRow = {
  id: string
  name: string
  workspacePath: string
}

export type CliRepositoryRow = {
  id: string
  name: string
  projectId: string
  localPath: string
  currentBranch: string
}

function readOption(args: string[], option: string): string | undefined {
  const index = args.indexOf(option)

  if (index === -1) {
    return undefined
  }

  const value = args[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 需要参数`)
  }

  return value
}

export function parseCliArguments(args: string[]): ForgeDeskCliCommand {
  const [command = 'help', ...rest] = args

  if (command === 'help' || command === '--help' || command === '-h') {
    return { command: 'help' }
  }

  if (command === 'projects') {
    return { command: 'projects' }
  }

  if (command === 'repos') {
    return {
      command: 'repos',
      project: readOption(rest, '--project')
    }
  }

  if (command === 'git') {
    const repo = readOption(rest, '--repo')
    const separatorIndex = rest.indexOf('--')
    const gitArgs = separatorIndex === -1 ? [] : rest.slice(separatorIndex + 1)

    if (!repo) {
      throw new Error('git 需要 --repo 参数')
    }

    if (gitArgs.length === 0) {
      throw new Error('git 需要在 -- 后输入受控 Git 命令')
    }

    parseControlledGitCommand(gitArgs.join(' '))

    return {
      command: 'git',
      repo,
      gitArgs
    }
  }

  throw new Error(`不支持的 ForgeDesk 命令：${command}`)
}

export function formatCliHelp(): string {
  return [
    'ForgeDesk CLI',
    '',
    '用法:',
    '  forgedesk projects',
    '  forgedesk repos [--project <id-or-name>]',
    '  forgedesk git --repo <id-or-name> -- <controlled-git-command>',
    '',
    '示例:',
    '  forgedesk repos --project CardPIE',
    '  forgedesk git --repo uka -- status --short --branch',
    '  forgedesk git --repo uka -- fetch --prune'
  ].join('\n')
}

export function formatProjects(projects: CliProjectRow[]): string {
  if (projects.length === 0) {
    return '没有项目'
  }

  return projects.map((project) => `${project.name}\t${project.id}\t${project.workspacePath}`).join('\n')
}

export function formatRepositories(repositories: CliRepositoryRow[]): string {
  if (repositories.length === 0) {
    return '没有仓库'
  }

  return repositories.map((repository) => `${repository.name}\t${repository.id}\t${repository.currentBranch}\t${repository.localPath}`).join('\n')
}
