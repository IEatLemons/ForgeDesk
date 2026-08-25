import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublishPlan, getReleaseTagName } from './publish-mac-helpers.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
    throw new Error(output || `${command} ${args.join(' ')} failed`)
  }
  return String(result.stdout || '').trim()
}

function readOptional(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  return result.status === 0 ? String(result.stdout || '').trim() : ''
}

function readRemoteTagCommit(tagName) {
  const rows = readOptional('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`, `refs/tags/${tagName}^{}`])
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
  const peeled = rows.find((row) => row.endsWith(`refs/tags/${tagName}^{}`))
  return (peeled ?? rows.find((row) => row.endsWith(`refs/tags/${tagName}`)))?.split(/\s+/)[0] ?? ''
}

export function ensureGithubReleaseTag({ projectRoot = root } = {}) {
  if (projectRoot !== root) throw new Error('当前发布脚本只能在 ForgeDesk 项目根目录执行。')

  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const tagName = getReleaseTagName(packageJson)
  const headCommit = run('git', ['rev-parse', 'HEAD'], true)
  const status = run('git', ['status', '--porcelain'], true)
  const localTagCommit = readOptional('git', ['rev-parse', '-q', '--verify', `${tagName}^{}`])
  const remoteTagCommit = readRemoteTagCommit(tagName)
  const plan = createPublishPlan({
    version: packageJson.version,
    headCommit,
    isDirty: Boolean(status),
    localTagCommit,
    remoteTagCommit,
    allowDirtyRelease: process.env.FORGEDESK_ALLOW_DIRTY_RELEASE === '1'
  })

  if (remoteTagCommit) {
    throw new Error(`${tagName} 已推送到 origin；请在 GitHub Actions 中重跑该标签的发布任务，或提高版本号后重新发布。`)
  }

  if (plan.shouldCreateLocalTag) run('git', ['tag', plan.tagName])
  run('git', ['push', 'origin', plan.tagName])
  console.log(`已推送 ${tagName}，GitHub Actions 正在构建 macOS、Windows 和 Linux 安装包。`)
}

if (process.argv[1] && process.argv[1].endsWith('trigger-github-release.mjs')) {
  ensureGithubReleaseTag()
}
