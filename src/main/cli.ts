#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseCliArguments, formatCliHelp, formatProjects, formatRepositories, type CliProjectRow, type CliRepositoryRow } from './cli-core.js'
import { readCliProjects, readCliRepositories } from './cli-sqlite.js'
import { parseControlledGitCommand } from './git-controls.js'
import { readSshPassphrases, withSshPassphraseAskpass } from './ssh-passphrases.js'

type GitCliResult = {
  stdout: string
  stderr: string
  exitCode: number
}

const appName = 'ForgeDesk'

function getDefaultUserDataPath(): string {
  if (process.env.FORGEDESK_USER_DATA) {
    return resolve(process.env.FORGEDESK_USER_DATA)
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName)
  }

  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), appName)
  }

  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), appName)
}

function resolveProjectId(projects: CliProjectRow[], projectSelector: string | undefined): string | undefined {
  if (!projectSelector) {
    return undefined
  }

  const rows = projects.filter((project) => project.id === projectSelector || project.name === projectSelector)

  if (rows.length === 0) {
    throw new Error(`找不到项目：${projectSelector}`)
  }

  if (rows.length > 1) {
    throw new Error(`项目名称不唯一，请使用项目 id：${projectSelector}`)
  }

  return rows[0].id
}

function filterRepositories(repositories: CliRepositoryRow[], projects: CliProjectRow[], projectSelector?: string): CliRepositoryRow[] {
  const projectId = resolveProjectId(projects, projectSelector)
  return projectId ? repositories.filter((repository) => repository.projectId === projectId) : repositories
}

function resolveRepository(repositories: CliRepositoryRow[], repoSelector: string): CliRepositoryRow {
  const matches = repositories.filter((repository) => repository.id === repoSelector || repository.name === repoSelector)

  if (matches.length === 0) {
    throw new Error(`找不到仓库：${repoSelector}`)
  }

  if (matches.length > 1) {
    throw new Error(`仓库名称不唯一，请使用仓库 id：${repoSelector}`)
  }

  return matches[0]
}

function runGit(localPath: string, args: string[], env: NodeJS.ProcessEnv): Promise<GitCliResult> {
  return new Promise((resolveResult) => {
    execFile('git', ['-C', localPath, ...args], { env: { ...process.env, ...env }, timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      resolveResult({
        stdout: stdout.trimEnd(),
        stderr: (stderr || error?.message || '').trimEnd(),
        exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0
      })
    })
  })
}

async function printGitResult(userDataPath: string, repository: CliRepositoryRow, gitArgs: string[]): Promise<number> {
  const controlledArgs = parseControlledGitCommand(gitArgs.join(' '))
  const result = await withSshPassphraseAskpass(await readSshPassphrases(userDataPath), (env) => runGit(repository.localPath, controlledArgs, env))
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n')

  if (output) {
    console.log(output)
  }

  return result.exitCode
}

async function main(): Promise<number> {
  const userDataPath = getDefaultUserDataPath()
  const [projects, repositories] = await Promise.all([readCliProjects(userDataPath), readCliRepositories(userDataPath)])
  const command = parseCliArguments(process.argv.slice(2))

  switch (command.command) {
    case 'help':
      console.log(formatCliHelp())
      return 0
    case 'projects':
      console.log(formatProjects(projects))
      return 0
    case 'repos':
      console.log(formatRepositories(filterRepositories(repositories, projects, command.project)))
      return 0
    case 'git':
      return printGitResult(userDataPath, resolveRepository(repositories, command.repo), command.gitArgs)
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
