import { isAbsolute, join, relative } from 'node:path'

export type RemoteProjectCreateInput = {
  name: string
  remoteUrl: string
  parentPath: string
}

export function deriveRemoteRepositoryName(remoteUrl: string): string {
  const normalizedUrl = remoteUrl.trim().replace(/[?#].*$/, '').replace(/[\\/]+$/, '')
  const lastSegment = normalizedUrl.split(/[\\/:]/).pop()?.trim() ?? ''
  const repositoryName = lastSegment.replace(/\.git$/i, '').trim()

  if (!repositoryName || repositoryName === '.' || repositoryName === '..' || repositoryName.startsWith('-')) {
    throw new Error('无法从远程地址识别仓库名称')
  }

  return repositoryName
}

export function resolveRemoteCloneTarget(parentPath: string, remoteUrl: string): string {
  return join(parentPath, deriveRemoteRepositoryName(remoteUrl))
}

export function findNearestRepositoryParent(localPath: string, repositoryPaths: string[]): string {
  return repositoryPaths
    .filter((candidate) => candidate !== localPath)
    .filter((candidate) => {
      const candidateRelativePath = relative(candidate, localPath)
      return Boolean(candidateRelativePath) && !candidateRelativePath.startsWith('..') && !isAbsolute(candidateRelativePath)
    })
    .sort((left, right) => right.length - left.length)[0] ?? ''
}

export function buildRemoteCloneArgs(remoteUrl: string, targetPath: string): string[] {
  const normalizedUrl = remoteUrl.trim()

  if (!normalizedUrl) {
    throw new Error('请输入远程仓库地址')
  }

  if (normalizedUrl.startsWith('-')) {
    throw new Error('远程仓库地址格式不受支持')
  }

  return ['clone', '--recurse-submodules', normalizedUrl, targetPath]
}
