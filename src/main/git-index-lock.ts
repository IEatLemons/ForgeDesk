import { lstat } from 'node:fs/promises'
import { resolve } from 'node:path'

type RunGit = (localPath: string, args: string[]) => Promise<string>

export async function getRepositoryIndexLockIssue(localPath: string, runGit: RunGit): Promise<string | null> {
  // Git resolves the correct index location for regular repos, worktrees and submodules.
  const gitPath = (await runGit(localPath, ['rev-parse', '--git-path', 'index.lock'])).trim()
  if (!gitPath) throw new Error('无法确定 Git 索引锁路径')
  const lockPath = resolve(localPath, gitPath)

  try {
    await lstat(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }

  return `检测到 Git 索引锁 index.lock：${lockPath}。请等待正在运行的 Git 操作结束；如果仍然存在，请先确认没有 Git 进程使用该仓库，再清理遗留锁文件并重试。`
}
