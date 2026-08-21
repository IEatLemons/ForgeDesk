import { rebuild } from '@electron/rebuild'
import { createRequire } from 'node:module'
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const betterSqlitePath = join(root, 'node_modules', 'better-sqlite3')
const electronPackagePath = join(root, 'node_modules', 'electron', 'package.json')

function ensureNodePtySpawnHelperPermissions() {
  if (process.platform !== 'darwin') {
    return
  }

  let nodePtyPackagePath
  try {
    nodePtyPackagePath = require.resolve('node-pty/package.json', { paths: [root] })
  } catch {
    return
  }

  const helperPath = join(dirname(nodePtyPackagePath), 'prebuilds', `darwin-${process.arch}`, 'spawn-helper')

  if (!existsSync(helperPath)) {
    return
  }

  const mode = statSync(helperPath).mode
  const executableMode = mode | 0o755

  if ((mode & 0o755) !== 0o755) {
    chmodSync(helperPath, executableMode)
    console.warn(`Fixed node-pty spawn-helper permissions: ${helperPath}`)
  }
}

ensureNodePtySpawnHelperPermissions()

if (!existsSync(betterSqlitePath) || !existsSync(electronPackagePath)) {
  console.warn('Skipping native rebuild: dependencies are not installed yet.')
  process.exit(0)
}

const electronPackage = JSON.parse(readFileSync(electronPackagePath, 'utf8'))
const electronVersion = electronPackage.version

// better-sqlite3 does not publish a prebuilt binary for every Electron ABI.
// Rebuild it from source against the Electron version that will actually run
// the app, rather than failing the whole build when a download is unavailable.
await rebuild({
  arch: process.arch,
  buildFromSource: true,
  buildPath: root,
  electronVersion,
  force: true,
  mode: 'sequential',
  onlyModules: ['better-sqlite3']
})

ensureNodePtySpawnHelperPermissions()
