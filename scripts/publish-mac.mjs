import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createPublishPlan, getReleaseTagName } from './publish-mac-helpers.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tagName = getReleaseTagName(packageJson)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(output || `${command} ${args.join(' ')} failed`)
  }

  return String(result.stdout ?? '').trim()
}

function readOptional(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  })

  if (result.status === 0) {
    return String(result.stdout ?? '').trim()
  }

  return ''
}

function readRemoteTagCommit(tag) {
  const output = readOptional('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`])
  const rows = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const peeled = rows.find((line) => line.endsWith(`refs/tags/${tag}^{}`))
  const selected = peeled ?? rows.find((line) => line.endsWith(`refs/tags/${tag}`))
  return selected?.split(/\s+/)[0] ?? ''
}

function ensureReleaseTag() {
  const headCommit = run('git', ['rev-parse', 'HEAD'], { capture: true })
  const status = run('git', ['status', '--porcelain'], { capture: true })
  const allowDirtyRelease = process.env.FORGEDESK_ALLOW_DIRTY_RELEASE === '1'

  if (status.length > 0 && !allowDirtyRelease) {
    createPublishPlan({
      version: packageJson.version,
      headCommit,
      isDirty: true,
      localTagCommit: '',
      remoteTagCommit: '',
      allowDirtyRelease
    })
  }

  const localTagCommit = readOptional('git', ['rev-parse', '-q', '--verify', `${tagName}^{}`])
  const remoteTagCommit = readRemoteTagCommit(tagName)
  const plan = createPublishPlan({
    version: packageJson.version,
    headCommit,
    isDirty: status.length > 0,
    localTagCommit,
    remoteTagCommit,
    allowDirtyRelease
  })

  if (plan.shouldCreateLocalTag) {
    run('git', ['tag', plan.tagName])
    console.log(`Created ${plan.tagName}`)
  } else {
    console.log(`${plan.tagName} already exists locally`)
  }

  if (plan.shouldPushTag) {
    run('git', ['push', 'origin', plan.tagName])
  } else {
    console.log(`${plan.tagName} already exists on origin`)
  }
}

ensureReleaseTag()
run(process.execPath, [join(root, 'scripts', 'rebuild-native.mjs')])
run(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'])
run(process.execPath, [join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'])
run(process.execPath, [join(root, 'node_modules', 'electron-builder', 'cli.js'), '--mac', '--publish', 'always'])
