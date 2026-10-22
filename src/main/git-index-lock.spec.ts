import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, it } from 'node:test'
import { getRepositoryIndexLockIssue } from './git-index-lock.js'

const execFileAsync = promisify(execFile)
async function runGit(localPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', localPath, ...args], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  })
  return stdout.trim()
}

describe('repository index lock preflight', () => {
  it('detects a lock that read-only merge analysis would miss, without deleting it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-index-lock-'))
    try {
      await runGit(root, ['init', '-b', 'main'])
      await runGit(root, ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'base'])
      await runGit(root, ['branch', 'incoming'])
      assert.equal(await getRepositoryIndexLockIssue(root, runGit), null)
      const lockPath = join(root, '.git', 'index.lock')
      await writeFile(lockPath, '')

      // These checks succeed despite a lock, which previously let the analysis pass.
      assert.equal(await runGit(root, ['status', '--porcelain']), '')
      await runGit(root, ['merge-tree', '--write-tree', 'main', 'incoming'])
      const issue = await getRepositoryIndexLockIssue(root, runGit)
      assert.ok(issue?.includes(lockPath))
      assert.match(issue!, /先确认没有 Git 进程/)
      assert.equal(await readFile(lockPath, 'utf8'), '')

      await rm(lockPath)
      assert.equal(await getRepositoryIndexLockIssue(root, runGit), null)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('resolves the worktree index instead of assuming .git is a directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-worktree-lock-'))
    try {
      const repo = join(root, 'repo')
      const worktree = join(root, 'linked')
      await runGit(root, ['init', '-b', 'main', repo])
      await runGit(repo, ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'base'])
      await runGit(repo, ['worktree', 'add', '-b', 'linked', worktree])
      const lockPath = resolve(worktree, await runGit(worktree, ['rev-parse', '--git-path', 'index.lock']))
      await writeFile(lockPath, 'active writer')
      assert.ok((await getRepositoryIndexLockIssue(worktree, runGit))?.includes(lockPath))
      assert.equal(await getRepositoryIndexLockIssue(repo, runGit), null)
      assert.equal(await readFile(lockPath, 'utf8'), 'active writer')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('propagates Git resolution failures', async () => {
    await assert.rejects(getRepositoryIndexLockIssue('/repo', async () => { throw new Error('not a git repository') }), /not a git repository/)
    await assert.rejects(getRepositoryIndexLockIssue('/repo', async () => ''), /无法确定 Git 索引锁路径/)
  })
})
