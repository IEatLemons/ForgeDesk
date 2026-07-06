import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import {
  createGuiToolFallbackPath,
  mergePathValues,
  readUserShellEnvironment,
  type ShellEnvironmentExecFileRunner,
  type ShellEnvironmentSnapshot
} from './shell-environment.js'

export type CliEnvironmentIssueStatus = 'ok' | 'warning' | 'error'

export type CliEnvironmentRepairAction = 'source-profile-from-zprofile' | 'install-zsh-dev-prompt' | 'install-zsh-ls-colors'

export type CliEnvironmentIssue = {
  id: string
  status: CliEnvironmentIssueStatus
  title: string
  detail: string
  action?: CliEnvironmentRepairAction
}

export type CliEnvironmentConfigFile = {
  key: 'profile' | 'zprofile' | 'zshrc' | 'bashProfile' | 'bashrc'
  label: string
  path: string
  exists: boolean
  managed: boolean
}

export type CliEnvironmentCommandCheck = {
  name: string
  available: boolean
  path: string
  version: string
  error: string
}

export type CliEnvironmentSnapshot = {
  platform: NodeJS.Platform
  shell: string
  shellName: string
  homeDirectory: string
  checkedAt: string
  processPath: string
  loginShellPath: string
  mergedPath: string
  pnpmHome: string
  profileSourcedFromLoginFile: boolean
  promptConfigured: boolean
  promptProvider: string
  listingColorsConfigured: boolean
  listingColorProvider: string
  configFiles: CliEnvironmentConfigFile[]
  commands: CliEnvironmentCommandCheck[]
  issues: CliEnvironmentIssue[]
  repairableActions: CliEnvironmentRepairAction[]
}

export type CliEnvironmentRepairResult = {
  snapshot: CliEnvironmentSnapshot
  appliedActions: CliEnvironmentRepairAction[]
  changedFiles: string[]
  backupFiles: string[]
}

export type CliEnvironmentCommandRunner = (
  file: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; maxBuffer: number; timeout: number }
) => Promise<{ stdout: string; stderr: string }>

type CliEnvironmentOptions = {
  commandChecks?: CliEnvironmentCommandCheck[]
  commandRunner?: CliEnvironmentCommandRunner
  env?: NodeJS.ProcessEnv
  execFileRunner?: ShellEnvironmentExecFileRunner
  homeDirectory?: string
  now?: () => Date
  platform?: NodeJS.Platform
  shell?: string
  shellEnvironment?: ShellEnvironmentSnapshot
}

type FileState = {
  path: string
  content: string
  exists: boolean
}

const sourceProfileBlockStart = '# >>> ForgeDesk shell profile loader >>>'
const sourceProfileBlockEnd = '# <<< ForgeDesk shell profile loader <<<'
const promptBlockStart = '# >>> ForgeDesk developer prompt >>>'
const promptBlockEnd = '# <<< ForgeDesk developer prompt <<<'
const listingColorsBlockStart = '# >>> ForgeDesk listing colors >>>'
const listingColorsBlockEnd = '# <<< ForgeDesk listing colors <<<'

const sourceProfileBlock = [
  sourceProfileBlockStart,
  '# Load POSIX profile variables for ForgeDesk terminals.',
  'if [ -f "$HOME/.profile" ]; then',
  '  . "$HOME/.profile"',
  'fi',
  sourceProfileBlockEnd
].join('\n')

const zshDeveloperPromptBlock = [
  promptBlockStart,
  '# Compact prompt with current directory and Git branch state.',
  'if [ -n "$ZSH_VERSION" ]; then',
  '  autoload -Uz colors && colors',
  '  setopt PROMPT_SUBST',
  '  forgedesk_git_prompt() {',
  '    command git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0',
  '    local branch dirty',
  '    branch=$(command git symbolic-ref --quiet --short HEAD 2>/dev/null || command git rev-parse --short HEAD 2>/dev/null) || return 0',
  '    dirty=""',
  '    if ! command git diff --quiet --ignore-submodules -- 2>/dev/null || ! command git diff --cached --quiet --ignore-submodules -- 2>/dev/null; then',
  '      dirty="*"',
  '    fi',
  '    printf " git:(%s%s)" "$branch" "$dirty"',
  '  }',
  "  PROMPT='%F{cyan}%n@%m%f %F{blue}%~%f%F{magenta}$(forgedesk_git_prompt)%f %# '",
  'fi',
  promptBlockEnd
].join('\n')

const zshListingColorsBlock = [
  listingColorsBlockStart,
  '# Colorize directory listings on macOS/BSD ls and GNU coreutils.',
  'if [ -n "$ZSH_VERSION" ]; then',
  '  export CLICOLOR=1',
  '  export LSCOLORS="${LSCOLORS:-ExFxBxDxCxegedabagacad}"',
  '  if command ls --color=auto -d . >/dev/null 2>&1; then',
  "    alias ls='ls --color=auto'",
  '  else',
  "    alias ls='ls -G'",
  '  fi',
  "  alias ll='ls -alF'",
  "  alias la='ls -A'",
  "  alias l='ls -CF'",
  'fi',
  listingColorsBlockEnd
].join('\n')

function createDefaultCommandRunner(): CliEnvironmentCommandRunner {
  return (file, args, options) =>
    new Promise((resolveResult, reject) => {
      execFile(file, args, options, (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }

        resolveResult({
          stdout: Buffer.isBuffer(stdout) ? stdout.toString('utf8') : stdout,
          stderr: Buffer.isBuffer(stderr) ? stderr.toString('utf8') : stderr
        })
      })
    })
}

function createEmptyCommandCheck(name: string, error: string): CliEnvironmentCommandCheck {
  return {
    name,
    available: false,
    path: '',
    version: '',
    error
  }
}

async function inspectCommand(name: string, env: NodeJS.ProcessEnv, runner: CliEnvironmentCommandRunner, platform: NodeJS.Platform): Promise<CliEnvironmentCommandCheck> {
  if (platform === 'win32') {
    return createEmptyCommandCheck(name, 'Windows command inspection is not supported yet.')
  }

  try {
    const pathResult = await runner('/usr/bin/which', [name], { env, maxBuffer: 1024 * 1024, timeout: 3000 })
    const versionResult = await runner(name, ['--version'], { env, maxBuffer: 1024 * 1024, timeout: 3000 })

    return {
      name,
      available: true,
      path: pathResult.stdout.trim().split(/\r?\n/)[0] ?? '',
      version: versionResult.stdout.trim().split(/\r?\n/)[0] ?? '',
      error: ''
    }
  } catch (error) {
    return createEmptyCommandCheck(name, error instanceof Error ? error.message : String(error))
  }
}

async function readFileState(path: string): Promise<FileState> {
  try {
    return {
      path,
      content: await readFile(path, 'utf8'),
      exists: true
    }
  } catch {
    return {
      path,
      content: '',
      exists: false
    }
  }
}

function hasManagedBlock(content: string, start: string, end: string): boolean {
  return content.includes(start) && content.includes(end)
}

function shellContentSourcesProfile(content: string): boolean {
  if (hasManagedBlock(content, sourceProfileBlockStart, sourceProfileBlockEnd)) {
    return true
  }

  return /(?:source|\.)\s+(?:"\$HOME\/\.profile"|'[^']*\/\.profile'|\$HOME\/\.profile|~\/\.profile)/.test(content)
}

function detectPromptProvider(content: string): string {
  if (hasManagedBlock(content, promptBlockStart, promptBlockEnd)) {
    return 'ForgeDesk'
  }

  if (/starship\s+init\s+zsh/.test(content)) {
    return 'Starship'
  }

  if (/oh-my-zsh\.sh|ZSH_THEME=/.test(content)) {
    return 'Oh My Zsh'
  }

  if (/powerlevel10k|p10k/.test(content)) {
    return 'Powerlevel10k'
  }

  if (/vcs_info|git_prompt_info|parse_git_branch|__git_ps1|PROMPT=.*git/.test(content)) {
    return 'Git prompt'
  }

  return ''
}

function detectListingColorProvider(content: string): string {
  if (hasManagedBlock(content, listingColorsBlockStart, listingColorsBlockEnd)) {
    return 'ForgeDesk'
  }

  if (/alias\s+ls=(['"])ls\s+(?:-[A-Za-z]*G[A-Za-z]*|--color(?:=auto)?)/.test(content)) {
    return 'ls alias'
  }

  if (/(?:^|\n)\s*(?:export\s+)?CLICOLOR=1(?:\s|$)/.test(content)) {
    return 'CLICOLOR'
  }

  if (/(?:^|\n)\s*(?:export\s+)?LS_COLORS=/.test(content)) {
    return 'LS_COLORS'
  }

  return ''
}

function createConfigFiles(files: Record<string, FileState>): CliEnvironmentConfigFile[] {
  return [
    { key: 'profile', label: '.profile', path: files.profile.path, exists: files.profile.exists, managed: false },
    { key: 'zprofile', label: '.zprofile', path: files.zprofile.path, exists: files.zprofile.exists, managed: hasManagedBlock(files.zprofile.content, sourceProfileBlockStart, sourceProfileBlockEnd) },
    {
      key: 'zshrc',
      label: '.zshrc',
      path: files.zshrc.path,
      exists: files.zshrc.exists,
      managed:
        hasManagedBlock(files.zshrc.content, promptBlockStart, promptBlockEnd) ||
        hasManagedBlock(files.zshrc.content, listingColorsBlockStart, listingColorsBlockEnd)
    },
    { key: 'bashProfile', label: '.bash_profile', path: files.bashProfile.path, exists: files.bashProfile.exists, managed: false },
    { key: 'bashrc', label: '.bashrc', path: files.bashrc.path, exists: files.bashrc.exists, managed: false }
  ]
}

function uniqueRepairActions(issues: CliEnvironmentIssue[]): CliEnvironmentRepairAction[] {
  return Array.from(new Set(issues.map((issue) => issue.action).filter(Boolean) as CliEnvironmentRepairAction[]))
}

function createBackupPath(path: string, now: Date): string {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `${path}.forgedesk-backup-${timestamp}`
}

function replaceManagedBlock(content: string, start: string, end: string, block: string): string {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`)

  if (pattern.test(content)) {
    return content.replace(pattern, block)
  }

  const prefix = content.trimEnd()

  return `${prefix}${prefix ? '\n\n' : ''}${block}\n`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function writeManagedBlock(path: string, block: string, start: string, end: string, options: CliEnvironmentOptions): Promise<{ changed: boolean; backupPath: string }> {
  return writeManagedBlocks(path, [{ block, end, start }], options)
}

async function writeManagedBlocks(
  path: string,
  blocks: Array<{ block: string; start: string; end: string }>,
  options: CliEnvironmentOptions
): Promise<{ changed: boolean; backupPath: string }> {
  const file = await readFileState(path)
  const nextContent = blocks.reduce((content, block) => replaceManagedBlock(content, block.start, block.end, block.block), file.content)

  if (file.content === nextContent) {
    return { changed: false, backupPath: '' }
  }

  let backupPath = ''

  if (file.exists) {
    backupPath = createBackupPath(path, options.now?.() ?? new Date())
    await writeFile(backupPath, file.content, 'utf8')
  }

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, nextContent, 'utf8')

  return { changed: true, backupPath }
}

export async function inspectCliEnvironment(options: CliEnvironmentOptions = {}): Promise<CliEnvironmentSnapshot> {
  const platform = options.platform ?? process.platform
  const env = { ...process.env, ...options.env }
  const homeDirectory = options.homeDirectory ?? homedir()
  const shell = options.shell ?? env.SHELL ?? (platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  const shellName = basename(shell)
  const files = {
    profile: await readFileState(join(homeDirectory, '.profile')),
    zprofile: await readFileState(join(homeDirectory, '.zprofile')),
    zshrc: await readFileState(join(homeDirectory, '.zshrc')),
    bashProfile: await readFileState(join(homeDirectory, '.bash_profile')),
    bashrc: await readFileState(join(homeDirectory, '.bashrc'))
  }
  const shellEnvironment = options.shellEnvironment ?? await readUserShellEnvironment({
    env,
    execFileRunner: options.execFileRunner,
    homeDirectory,
    platform,
    shell
  })
  const fallbackPath = createGuiToolFallbackPath({ homeDirectory, platform })
  const mergedPath = mergePathValues(shellEnvironment.path, fallbackPath, env.PATH)
  const commandEnv = { ...env, PATH: mergedPath }
  const commands = options.commandChecks ?? [await inspectCommand('git', commandEnv, options.commandRunner ?? createDefaultCommandRunner(), platform)]
  const profileSourcedFromLoginFile =
    shellName === 'zsh'
      ? shellContentSourcesProfile(files.zprofile.content)
      : shellContentSourcesProfile(files.bashProfile.content) || shellContentSourcesProfile(files.bashrc.content)
  const promptProvider = shellName === 'zsh' ? detectPromptProvider(files.zshrc.content) : ''
  const listingColorProvider = shellName === 'zsh' ? detectListingColorProvider(files.zshrc.content) : ''
  const issues: CliEnvironmentIssue[] = []

  if (platform === 'win32') {
    issues.push({
      id: 'unsupported-platform',
      status: 'warning',
      title: '暂不支持 Windows 自动修复',
      detail: '当前检测工具主要面向 macOS/Linux shell 配置。'
    })
  }

  if (shellName === 'zsh' && files.profile.exists && !profileSourcedFromLoginFile) {
    issues.push({
      id: 'zprofile-missing-profile-source',
      status: 'warning',
      title: '.zprofile 没有加载 .profile',
      detail: 'zsh 登录终端不会自动读取 .profile，需要在 .zprofile 中显式 source。',
      action: 'source-profile-from-zprofile'
    })
  }

  if (shellName === 'zsh' && !promptProvider) {
    issues.push({
      id: 'zshrc-missing-dev-prompt',
      status: 'warning',
      title: '.zshrc 没有 Git 开发提示符',
      detail: '可以追加一个轻量提示符，显示当前目录、Git 分支和未提交状态。',
      action: 'install-zsh-dev-prompt'
    })
  }

  if (shellName === 'zsh' && !listingColorProvider) {
    issues.push({
      id: 'zshrc-missing-listing-colors',
      status: 'warning',
      title: 'ls 没有开启目录颜色',
      detail: '可以在 .zshrc 中开启 macOS/BSD 的 CLICOLOR，并给 ls 添加兼容 GNU coreutils 的彩色别名。',
      action: 'install-zsh-ls-colors'
    })
  }

  for (const command of commands) {
    if (!command.available) {
      issues.push({
        id: `${command.name}-missing`,
        status: 'warning',
        title: `${command.name} 不在当前命令行 PATH 中`,
        detail: command.error || `无法通过 PATH 找到 ${command.name}。`
      })
    }
  }

  return {
    platform,
    shell,
    shellName,
    homeDirectory,
    checkedAt: (options.now?.() ?? new Date()).toISOString(),
    processPath: env.PATH ?? '',
    loginShellPath: shellEnvironment.path,
    mergedPath,
    pnpmHome: shellEnvironment.pnpmHome,
    profileSourcedFromLoginFile,
    promptConfigured: Boolean(promptProvider),
    promptProvider,
    listingColorsConfigured: Boolean(listingColorProvider),
    listingColorProvider,
    configFiles: createConfigFiles(files),
    commands,
    issues,
    repairableActions: uniqueRepairActions(issues)
  }
}

export async function repairCliEnvironment(options: CliEnvironmentOptions = {}): Promise<CliEnvironmentRepairResult> {
  const snapshot = await inspectCliEnvironment(options)
  const appliedActions: CliEnvironmentRepairAction[] = []
  const changedFiles: string[] = []
  const backupFiles: string[] = []

  if (snapshot.shellName !== 'zsh') {
    return { snapshot, appliedActions, changedFiles, backupFiles }
  }

  if (snapshot.repairableActions.includes('source-profile-from-zprofile')) {
    const result = await writeManagedBlock(join(snapshot.homeDirectory, '.zprofile'), sourceProfileBlock, sourceProfileBlockStart, sourceProfileBlockEnd, options)

    if (result.changed) {
      changedFiles.push(join(snapshot.homeDirectory, '.zprofile'))
    }

    if (result.backupPath) {
      backupFiles.push(result.backupPath)
    }

    appliedActions.push('source-profile-from-zprofile')
  }

  const zshrcBlocks: Array<{ block: string; start: string; end: string }> = []

  if (snapshot.repairableActions.includes('install-zsh-dev-prompt')) {
    zshrcBlocks.push({ block: zshDeveloperPromptBlock, start: promptBlockStart, end: promptBlockEnd })
    appliedActions.push('install-zsh-dev-prompt')
  }

  if (snapshot.repairableActions.includes('install-zsh-ls-colors')) {
    zshrcBlocks.push({ block: zshListingColorsBlock, start: listingColorsBlockStart, end: listingColorsBlockEnd })
    appliedActions.push('install-zsh-ls-colors')
  }

  if (zshrcBlocks.length > 0) {
    const result = await writeManagedBlocks(join(snapshot.homeDirectory, '.zshrc'), zshrcBlocks, options)

    if (result.changed) {
      changedFiles.push(join(snapshot.homeDirectory, '.zshrc'))
    }

    if (result.backupPath) {
      backupFiles.push(result.backupPath)
    }
  }

  return {
    snapshot: await inspectCliEnvironment(options),
    appliedActions,
    changedFiles,
    backupFiles
  }
}
