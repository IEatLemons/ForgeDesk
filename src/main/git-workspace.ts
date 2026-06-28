const SAFE_PATH_PATTERN = /^[^\0\r\n;&|<>`$\\]+$/
const SAFE_REF_PATTERN = /^[A-Za-z0-9._/@:+-]+$/
const REMOTE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/
const CONFLICT_STATUSES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

export type GitAddInput = {
  mode: 'all' | 'paths'
  paths: string[]
}

export type GitCommitInput = {
  message: string
  paths?: string[]
  tagName?: string
}

export type GitPushInput = {
  remote?: string
  remotes?: string[]
  branch: string
}

export type GitPushTarget = {
  remote: string
  branch: string
  ahead: number
  hasRemoteBranch: boolean
}

export type GitMergeInput = {
  source: string
}

export type GitBranchSwitchInput = {
  branchName: string
  create?: boolean
  startPoint?: string
  track?: boolean
}

export type GitMergeAnalysisInput = {
  source: string
  target: string
}

export type GitStatusFile = {
  path: string
  oldPath: string
  indexStatus: string
  worktreeStatus: string
  conflict: boolean
}

function assertSafePath(path: string): string {
  const trimmed = path.trim()

  if (!trimmed || !SAFE_PATH_PATTERN.test(trimmed) || trimmed.startsWith('/') || trimmed.split('/').includes('..')) {
    throw new Error(`不支持的文件路径：${path}`)
  }

  return trimmed
}

function assertSafeRef(value: string, label: string): string {
  const trimmed = value.trim()

  if (!trimmed || !SAFE_REF_PATTERN.test(trimmed)) {
    throw new Error(`不支持的${label}：${value}`)
  }

  return trimmed
}

function assertRemoteName(value: string): string {
  const trimmed = value.trim()

  if (!trimmed || !REMOTE_NAME_PATTERN.test(trimmed)) {
    throw new Error('远端名称只能包含字母、数字、点、下划线和短横线')
  }

  return trimmed
}

export function buildGitAddArgs(input: GitAddInput): string[] {
  if (input.mode === 'all') {
    return ['add', '--all']
  }

  const paths = input.paths.map(assertSafePath)

  if (paths.length === 0) {
    throw new Error('请选择要暂存的文件')
  }

  return ['add', '--', ...paths]
}

export function buildGitDiffStatArgs(paths: string[]): string[] {
  const safePaths = paths.map(assertSafePath)

  if (safePaths.length === 0) {
    throw new Error('请选择文件')
  }

  return ['diff', '--stat', '--', ...safePaths]
}

export function buildGitCommitArgs(input: GitCommitInput): string[] {
  const message = input.message.trim()

  if (!message) {
    throw new Error('请输入提交信息')
  }

  const paths = input.paths?.map(assertSafePath) ?? []

  return paths.length > 0 ? ['commit', '-m', message, '--', ...paths] : ['commit', '-m', message]
}

export function buildGitTagArgs(tagName: string): string[] {
  return ['tag', assertSafeRef(tagName, 'Tag')]
}

export function buildGitPushArgs(input: GitPushInput): string[] {
  const args = buildGitPushOperationArgs(input)

  if (args.length !== 1) {
    throw new Error('请选择一个远端')
  }

  return args[0]
}

export function buildGitPushOperationArgs(input: GitPushInput): string[][] {
  const branch = assertSafeRef(input.branch, '分支')
  const remoteNames = input.remotes?.length ? input.remotes : input.remote ? [input.remote] : []
  const uniqueRemoteNames = Array.from(new Set(remoteNames.map(assertRemoteName)))

  if (uniqueRemoteNames.length === 0) {
    throw new Error('请选择要推送的远端')
  }

  return uniqueRemoteNames.map((remote) => ['push', remote, branch])
}

export function buildGitPushTargetRemoteRefArgs(remote: string, branch: string): string[] {
  return [`refs/remotes/${assertRemoteName(remote)}/${assertSafeRef(branch, '分支')}`]
}

export function buildGitPushTargetRemoteRefVerifyArgs(remote: string, branch: string): string[] {
  return ['rev-parse', '--verify', ...buildGitPushTargetRemoteRefArgs(remote, branch)]
}

export function buildGitPushTargetCommitCountArgs(remote: string, branch: string): string[] {
  const safeBranch = assertSafeRef(branch, '分支')
  const [remoteRef] = buildGitPushTargetRemoteRefArgs(remote, safeBranch)
  return ['rev-list', '--count', `${remoteRef}..${safeBranch}`]
}

export function buildGitPushTargetLocalCommitCountArgs(branch: string): string[] {
  return ['rev-list', '--count', assertSafeRef(branch, '分支')]
}

export function buildGitMergeArgs(input: GitMergeInput): string[] {
  return ['merge', '--no-edit', assertSafeRef(input.source, '分支')]
}

export function buildGitSwitchBranchArgs(input: GitBranchSwitchInput): string[] {
  const branchName = assertSafeRef(input.branchName, '分支')
  const startPoint = input.startPoint ? assertSafeRef(input.startPoint, '起点') : ''

  if (!input.create) {
    if (startPoint || input.track) {
      throw new Error('切换已有分支不需要起点')
    }

    return ['switch', branchName]
  }

  if (input.track) {
    if (!startPoint) {
      throw new Error('创建跟踪分支需要远端起点')
    }

    return ['switch', '--track', '-c', branchName, startPoint]
  }

  return startPoint ? ['switch', '-c', branchName, startPoint] : ['switch', '-c', branchName]
}

export function buildGitVerifyRefArgs(ref: string): string[] {
  return ['rev-parse', '--verify', assertSafeRef(ref, '分支')]
}

export function buildGitRevListCountArgs(fromRef: string, toRef: string): string[] {
  return ['rev-list', '--count', `${assertSafeRef(fromRef, '分支')}..${assertSafeRef(toRef, '分支')}`]
}

export function buildGitMergeBaseArgs(input: GitMergeAnalysisInput): string[] {
  return ['merge-base', assertSafeRef(input.target, '分支'), assertSafeRef(input.source, '分支')]
}

export function buildGitFastForwardCheckArgs(input: GitMergeAnalysisInput): string[] {
  return ['merge-base', '--is-ancestor', assertSafeRef(input.target, '分支'), assertSafeRef(input.source, '分支')]
}

export function buildGitMergeTreeArgs(input: GitMergeAnalysisInput): string[] {
  return ['merge-tree', '--write-tree', assertSafeRef(input.target, '分支'), assertSafeRef(input.source, '分支')]
}

export function parsePorcelainStatus(output: string): GitStatusFile[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const usesSingleStatusColumn = line[1] === ' ' && line[2] !== ' '
      const indexStatus = line[0] || ' '
      const worktreeStatus = usesSingleStatusColumn ? ' ' : line[1] || ' '
      const rawPath = line.slice(usesSingleStatusColumn ? 2 : 3)
      const [oldPath, path] = rawPath.includes(' -> ') ? rawPath.split(' -> ') : ['', rawPath]

      return {
        path,
        oldPath,
        indexStatus,
        worktreeStatus,
        conflict: CONFLICT_STATUSES.has(`${indexStatus}${worktreeStatus}`)
      }
    })
}
