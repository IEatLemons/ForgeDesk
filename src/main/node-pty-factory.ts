import { createRequire } from 'node:module'
import { chmodSync, existsSync, statSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import type { TerminalPtyFactory } from './terminal-service'

type NodePtyModule = {
  spawn: TerminalPtyFactory
}

const require = createRequire(import.meta.url)

type SpawnHelperPermissionFs = {
  chmodSync: (path: string, mode: number) => void
  existsSync: (path: string) => boolean
  statSync: (path: string) => { mode: number }
}

export type SpawnHelperPermissionOptions = {
  arch?: NodeJS.Architecture
  fs?: SpawnHelperPermissionFs
  nodePtyPackagePath?: string
  platform?: NodeJS.Platform
}

const ASAR_SEGMENT = `${sep}app.asar${sep}`
const ASAR_UNPACKED_SEGMENT = `${sep}app.asar.unpacked${sep}`

export function resolveNodePtyPackageJsonPath(nodePtyPackagePath?: string): string {
  const packageJsonPath = nodePtyPackagePath ?? require.resolve('node-pty/package.json')

  if (packageJsonPath.includes(ASAR_SEGMENT)) {
    return packageJsonPath.replace(ASAR_SEGMENT, ASAR_UNPACKED_SEGMENT)
  }

  return packageJsonPath
}

export function getNodePtySpawnHelperPath(packageJsonPath: string, arch = process.arch): string {
  return join(dirname(packageJsonPath), 'prebuilds', `darwin-${arch}`, 'spawn-helper')
}

export function getNodePtySpawnHelperPaths(packageJsonPath: string, arch = process.arch): string[] {
  const packageDir = dirname(packageJsonPath)

  return [
    getNodePtySpawnHelperPath(packageJsonPath, arch),
    join(packageDir, 'build', 'Release', 'spawn-helper')
  ]
}

function repairSpawnHelperPermissions(helperPath: string, fs: SpawnHelperPermissionFs): string {
  const mode = fs.statSync(helperPath).mode
  const executableMode = mode | 0o755

  if ((mode & 0o755) !== 0o755) {
    fs.chmodSync(helperPath, executableMode)
  }

  return helperPath
}

export function ensureNodePtySpawnHelperPermissions({
  arch = process.arch,
  fs = { chmodSync, existsSync, statSync },
  nodePtyPackagePath,
  platform = process.platform
}: SpawnHelperPermissionOptions = {}): string | null {
  if (platform !== 'darwin') {
    return null
  }

  const packageJsonPath = resolveNodePtyPackageJsonPath(nodePtyPackagePath)
  let repairedPath: string | null = null

  for (const helperPath of getNodePtySpawnHelperPaths(packageJsonPath, arch)) {
    if (!fs.existsSync(helperPath)) {
      continue
    }

    repairedPath = repairSpawnHelperPermissions(helperPath, fs)
  }

  return repairedPath
}

export function createNodePtyFactory(): TerminalPtyFactory {
  try {
    ensureNodePtySpawnHelperPermissions()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`终端运行时初始化失败：无法修复 node-pty spawn-helper 执行权限。${message}`)
  }

  const nodePty = require('node-pty') as NodePtyModule

  return (file, args, options) => nodePty.spawn(file, args, options)
}
