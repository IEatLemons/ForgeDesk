import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import {
  executeCleanupToTrash,
  getStorageOverview,
  importLegacyResourceHistory,
  listLatestProcesses,
  listStorageDirectories,
  migrateResourceGovernanceTables,
  parsePsProcessOutput,
  recordResourceSample,
  runResourceRetention,
  saveStorageRoot,
  startStorageScan,
  verifyDuplicateGroup
} from './resource-governance.js'
import type { ResourceDatabase } from './resource-governance.js'

function createDatabase(): ResourceDatabase {
  const db = new DatabaseSync(':memory:') as unknown as ResourceDatabase
  migrateResourceGovernanceTables(db)
  return db
}

describe('resource governance', () => {
  it('parses process identity, resources, parent pid and start instance from ps output', () => {
    const processes = parsePsProcessOutput(`  123 1 stone 88.5 1048576 2097152 01:02:03 S /Applications/Figma.app/Contents/MacOS/Figma --flag
  456 123 stone 2.5 524288 1048576 2-03:04:05 R /Applications/Figma.app/Contents/Frameworks/Figma Helper.app/Contents/MacOS/Figma Helper
`, new Date('2026-07-16T12:00:00.000Z'))

    assert.equal(processes.length, 2)
    assert.equal(processes[0].appName, 'Figma')
    assert.equal(processes[0].parentPid, 1)
    assert.equal(processes[0].memoryBytes, 1024 ** 3)
    assert.equal(processes[0].elapsedSeconds, 3723)
    assert.notEqual(processes[0].instanceKey, processes[1].instanceKey)
  })

  it('stores process samples without joining reused pids into one instance', () => {
    const db = createDatabase()
    const base = parsePsProcessOutput('123 1 stone 10 100 200 00:10 S /Applications/Test.app/Contents/MacOS/Test', new Date('2026-07-16T12:00:00.000Z'))[0]
    const reused = { ...base, instanceKey: '123:reused', memoryBytes: 999999 }
    recordResourceSample(db, { capturedAt: '2026-07-16T12:00:00.000Z', cpuPercent: 20, memoryUsagePercent: 50, memoryUsedBytes: 1000, swapUsedBytes: 0, storageUsagePercent: 40, processes: [base] })
    recordResourceSample(db, { capturedAt: '2026-07-16T12:01:00.000Z', cpuPercent: 30, memoryUsagePercent: 60, memoryUsedBytes: 2000, swapUsedBytes: 10, storageUsagePercent: 41, processes: [reused] })

    const instances = db.prepare('SELECT DISTINCT instance_key FROM system_process_samples WHERE pid = 123').all() as Array<{ instance_key: string }>
    assert.equal(instances.length, 2)
    assert.equal(listLatestProcesses(db)[0].memoryBytes, 999999)
    db.close()
  })

  it('imports legacy history once and removes raw samples older than seven days', () => {
    const db = createDatabase()
    const imported = importLegacyResourceHistory(db, [{ capturedAt: '2026-07-01T00:00:00.000Z', cpuPercent: 20, memoryUsagePercent: 30, memoryUsedBytes: 0, swapUsedBytes: 0, storageUsagePercent: 40 }])
    assert.equal(imported, 1)
    assert.equal(importLegacyResourceHistory(db, [{ capturedAt: '2026-07-01T00:00:00.000Z', cpuPercent: 20, memoryUsagePercent: 30, memoryUsedBytes: 0, swapUsedBytes: 0, storageUsagePercent: 40 }]), 0)
    runResourceRetention(db, new Date('2026-07-16T00:00:00.000Z'))
    assert.equal((db.prepare('SELECT COUNT(*) count FROM system_resource_samples').get() as { count: number }).count, 0)
    db.close()
  })

  it('scans authorized roots without following symlinks and requires duplicate hashes before cleanup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-storage-'))
    const outside = await mkdtemp(join(tmpdir(), 'forgedesk-outside-'))
    try {
      await mkdir(join(directory, 'files'))
      await writeFile(join(directory, 'files', 'large.bin'), '')
      await truncate(join(directory, 'files', 'large.bin'), 1024 ** 3)
      await writeFile(join(directory, 'files', 'copy-a.bin'), Buffer.alloc(10 * 1024 ** 2, 7))
      await writeFile(join(directory, 'files', 'copy-b.bin'), Buffer.alloc(10 * 1024 ** 2, 7))
      await writeFile(join(outside, 'private.txt'), 'must not scan')
      await symlink(outside, join(directory, 'outside-link'))
      const db = createDatabase()
      saveStorageRoot(db, directory)
      const run = await startStorageScan(db, 'deep')
      assert.equal(run.status, 'completed')
      const overview = getStorageOverview(db)
      assert.ok(overview.items.some((item) => item.name === 'large.bin'))
      assert.equal(overview.items.some((item) => item.path.includes('private.txt')), false)
      const duplicate = overview.items.find((item) => item.duplicateKey)
      assert.ok(duplicate)
      await assert.rejects(() => executeCleanupToTrash(db, [duplicate.id], async () => undefined), /哈希校验/)
      const verified = await verifyDuplicateGroup(db, duplicate.id)
      assert.equal(new Set(verified.map((item) => item.verifiedHash)).size, 1)
      const trashed: string[] = []
      const records = await executeCleanupToTrash(db, [verified[0].id], async (path) => { trashed.push(path) })
      assert.equal(records[0].status, 'success')
      assert.deepEqual(trashed, [verified[0].path])
      db.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('records every accessible directory with deep size and count details', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-directory-tree-'))
    const outside = await mkdtemp(join(tmpdir(), 'forgedesk-directory-outside-'))
    try {
      await mkdir(join(directory, 'empty'))
      await mkdir(join(directory, 'parent', 'nested', 'empty-child'), { recursive: true })
      await writeFile(join(directory, 'parent', 'small.txt'), 'abc')
      await writeFile(join(directory, 'parent', 'nested', 'tiny.txt'), 'hello')
      await writeFile(join(outside, 'secret.txt'), 'outside')
      await symlink(outside, join(directory, 'outside-link'))
      const db = createDatabase()
      saveStorageRoot(db, directory)
      const run = await startStorageScan(db, 'deep')

      const roots = listStorageDirectories(db, { scanId: run.id, parentPath: '', limit: 10 })
      assert.equal(roots.total, 1)
      assert.equal(roots.directories[0].path, directory)
      assert.equal(roots.directories[0].sizeBytes, 8)
      assert.equal(roots.directories[0].fileCount, 2)
      assert.equal(roots.directories[0].directoryCount, 4)
      assert.equal(roots.directories[0].childDirectoryCount, 2)
      assert.equal(roots.directories[0].parentPath, '')
      assert.equal(roots.directories[0].rootPercent, 100)

      const children = listStorageDirectories(db, { scanId: run.id, rootId: roots.directories[0].rootId, parentPath: directory, limit: 10 })
      assert.deepEqual(children.directories.map((item) => item.name).sort(), ['empty', 'parent'])
      const empty = children.directories.find((item) => item.name === 'empty')
      assert.ok(empty)
      assert.equal(empty.sizeBytes, 0)
      assert.equal(empty.fileCount, 0)
      assert.equal(empty.directoryCount, 0)

      const nested = listStorageDirectories(db, { scanId: run.id, search: 'nested', limit: 10 })
      assert.ok(nested.directories.some((item) => item.path === join(directory, 'parent', 'nested')))
      assert.equal(nested.directories.some((item) => item.path.includes('secret.txt')), false)
      db.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('reports directory growth against the previous completed scan', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-directory-growth-'))
    try {
      await mkdir(join(directory, 'workspace'))
      await writeFile(join(directory, 'workspace', 'data.txt'), 'one')
      const db = createDatabase()
      saveStorageRoot(db, directory)
      await startStorageScan(db, 'deep')
      await new Promise((resolve) => setTimeout(resolve, 5))
      await writeFile(join(directory, 'workspace', 'more.txt'), 'larger')
      const run = await startStorageScan(db, 'deep')

      const result = listStorageDirectories(db, { scanId: run.id, search: 'workspace', limit: 10 })
      const workspace = result.directories.find((item) => item.path === join(directory, 'workspace'))
      assert.ok(workspace)
      assert.equal(workspace.sizeBytes, 9)
      assert.equal(workspace.growthBytes, 6)
      db.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('refuses whole-home and root scan authorization', () => {
    const db = createDatabase()
    assert.throws(() => saveStorageRoot(db, '/'), /不能直接扫描/)
    db.close()
  })
})
