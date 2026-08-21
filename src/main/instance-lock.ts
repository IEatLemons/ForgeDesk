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

/**
 * Acquires a file lock that is shared by development and packaged Electron
 * builds. Electron's own single-instance lock is not reliable across its
 * major versions, while this lock keeps all builds out of the same SQLite
 * profile. Returns a release function, or null when a live owner exists.
 */
export function acquireSingleProcessFileLock(
  lockPath: string,
  { fs = defaultFs, isProcessAlive = isPidAlive, pid = process.pid }: SingleProcessFileLockOptions = {}
): (() => void) | null {
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
    if (!ownerPid || isProcessAlive(ownerPid)) {
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
