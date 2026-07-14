import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const sourcePath = join(root, 'native', 'MenuBarHelper', 'Sources', 'ForgeDeskMenuBarHelper', 'main.swift')
const plistPath = join(root, 'native', 'MenuBarHelper', 'Info.plist')
const appPath = join(root, 'resources', 'MenuBarHelper', 'ForgeDeskMenuBarHelper.app')
const executablePath = join(appPath, 'Contents', 'MacOS', 'ForgeDeskMenuBarHelper')
const outputPlistPath = join(appPath, 'Contents', 'Info.plist')
const moduleCachePath = join(root, '.cache', 'swift-module-cache')

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLANG_MODULE_CACHE_PATH: moduleCachePath
    }
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

if (process.platform !== 'darwin') {
  console.log('Skipping ForgeDesk menu bar helper build: only macOS needs the helper.')
  process.exit(0)
}

if (!existsSync(sourcePath) || !existsSync(plistPath)) {
  throw new Error('ForgeDesk menu bar helper sources are missing.')
}

rmSync(appPath, { recursive: true, force: true })
mkdirSync(dirname(executablePath), { recursive: true })
mkdirSync(dirname(outputPlistPath), { recursive: true })
mkdirSync(moduleCachePath, { recursive: true })
cpSync(plistPath, outputPlistPath)

run('swiftc', [
  sourcePath,
  '-O',
  '-framework',
  'AppKit',
  '-framework',
  'ApplicationServices',
  '-o',
  executablePath
])

chmodSync(executablePath, 0o755)
console.log(`Built ForgeDesk menu bar helper at ${appPath}`)
