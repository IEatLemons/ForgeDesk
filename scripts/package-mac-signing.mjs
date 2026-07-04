import { existsSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'

function normalizeVersionedFramework(frameworkPath) {
  const versionsDir = join(frameworkPath, 'Versions')
  const versionA = join(versionsDir, 'A')

  if (!existsSync(versionA)) {
    return false
  }

  const rootEntries = readdirSync(frameworkPath, { withFileTypes: true }).filter((entry) => entry.name !== 'Versions')

  rmSync(join(versionsDir, 'Current'), { recursive: true, force: true })
  symlinkSync('A', join(versionsDir, 'Current'))

  for (const entry of rootEntries) {
    const versionedEntry = join(versionA, entry.name)

    if (!existsSync(versionedEntry)) {
      continue
    }

    const rootEntry = join(frameworkPath, entry.name)
    rmSync(rootEntry, { recursive: true, force: true })
    symlinkSync(join('Versions', 'Current', entry.name), rootEntry)
  }

  return true
}

export function normalizeMacFrameworks(appPath) {
  const frameworksDir = join(appPath, 'Contents', 'Frameworks')

  if (!existsSync(frameworksDir)) {
    return []
  }

  const normalized = []

  for (const entry of readdirSync(frameworksDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith('.framework')) {
      continue
    }

    const frameworkPath = join(frameworksDir, entry.name)

    if (normalizeVersionedFramework(frameworkPath)) {
      normalized.push(frameworkPath)
    }
  }

  return normalized
}
