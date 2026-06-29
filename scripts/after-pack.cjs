const { chmodSync, existsSync, readdirSync, rmSync, statSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

function makeExecutable(path) {
  if (!existsSync(path)) {
    return
  }

  const mode = statSync(path).mode
  const executableMode = mode | 0o755

  if ((mode & 0o755) !== 0o755) {
    chmodSync(path, executableMode)
  }
}

function pruneUnusedNodePtyPrebuilds(root, archName) {
  const prebuildsDir = join(root, 'prebuilds')

  if (!existsSync(prebuildsDir)) {
    return
  }

  for (const entry of readdirSync(prebuildsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const keep = entry.name === `darwin-${archName}`

    if (!keep) {
      rmSync(join(prebuildsDir, entry.name), { recursive: true, force: true })
    }
  }
}

function signIfExists(path) {
  if (existsSync(path)) {
    run('codesign', ['--force', '--sign', '-', path])
  }
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const resourcesDir = join(context.appOutDir, appName, 'Contents', 'Resources')
  const archName = context.arch === 3 || context.appOutDir.includes('arm64') ? 'arm64' : 'x64'
  const nodePtyRoots = [
    join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'node-pty'),
    join(resourcesDir, 'app', 'node_modules', 'node-pty')
  ]

  for (const root of nodePtyRoots) {
    pruneUnusedNodePtyPrebuilds(root, archName)
    makeExecutable(join(root, 'prebuilds', `darwin-${archName}`, 'spawn-helper'))
    makeExecutable(join(root, 'build', 'Release', 'spawn-helper'))
    signIfExists(join(root, 'prebuilds', `darwin-${archName}`, 'pty.node'))
    signIfExists(join(root, 'prebuilds', `darwin-${archName}`, 'spawn-helper'))
    signIfExists(join(root, 'build', 'Release', 'pty.node'))
    signIfExists(join(root, 'build', 'Release', 'spawn-helper'))
  }

  signIfExists(join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'))
  signIfExists(join(resourcesDir, 'app', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'))
}
