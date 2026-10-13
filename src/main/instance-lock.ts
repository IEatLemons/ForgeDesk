import { execFileSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

type InstanceLockFs = {
  closeSync: typeof closeSync
  mkdirSync: typeof mkdirSync
  openSync: typeof openSync
  readFileSync: typeof readFileSync
  unlinkSync: typeof unlinkSync
  writeFileSync: typeof writeFileSync
}

export type SingleProcessFileLockOptions = {
  fs?: InstanceLockFs
  isProcessAlive?: (pid: number) => boolean
  isLockOwner?: (pid: number) => boolean
  pid?: number
}

const defaultFs: InstanceLockFs = { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync }

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function readOwnerPid(lockPath: string, fs: InstanceLockFs): number | null {
  try {
    const value = fs.readFileSync(lockPath, 'utf8').trim()
    const pid = Number.parseInt(value, 10)
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

export function isForgeDeskLockOwnerCommand(command: string): boolean {
  return /forgedesk/i.test(command)
}

function readProcessCommand(pid: number): string | null {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
        { encoding: 'utf8', timeout: 5000, windowsHide: true }
      )
      return output.trim() || null
    }

    const output = execFileSync('ps', ['-ww', '-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, LC_ALL: 'C' }
    })
    return output.trim() || null
  } catch {
    return null
  }
}

function defaultIsLockOwner(pid: number): boolean {
  const command = readProcessCommand(pid)
  if (!command) return true
  return isForgeDeskLockOwnerCommand(command)
}

/**
 * Acquires a file lock that is shared by development and packaged Electron
 * builds. Electron's own single-instance lock is not reliable across its
 * major versions, while this lock keeps all builds out of the same SQLite
 * profile. A recycled PID is ignored unless that process is actually
 * ForgeDesk. Returns a release function, or null when a live owner exists.
 */
export function acquireSingleProcessFileLock(
  lockPath: string,
  { fs = defaultFs, isProcessAlive = isPidAlive, isLockOwner, pid = process.pid }: SingleProcessFileLockOptions = {}
): (() => void) | null {
  const ownerCheck = isLockOwner ?? (isProcessAlive === isPidAlive ? defaultIsLockOwner : () => true)
  fs.mkdirSync(dirname(lockPath), { recursive: true })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = fs.openSync(lockPath, 'wx', 0o600)
      try {
        fs.writeFileSync(descriptor, `${pid}\n`, 'utf8')
      } finally {
        fs.closeSync(descriptor)
      }

      let released = false
      return () => {
        if (released) return
        released = true

        if (readOwnerPid(lockPath, fs) !== pid) return

        try {
          fs.unlinkSync(lockPath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }

    const ownerPid = readOwnerPid(lockPath, fs)
    if (ownerPid && isProcessAlive(ownerPid) && ownerCheck(ownerPid)) {
      return null
    }

    try {
      fs.unlinkSync(lockPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  return null
}
