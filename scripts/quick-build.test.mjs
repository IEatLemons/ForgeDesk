import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { acquireBuildLock, cloneTree, hashPaths, inside, readJson, removeManaged, run, writeJson } from './quick-build-utils.mjs'
import { localBuildEnv } from './quick-build.mjs'

const directories = []
const temporary = () => { const path = mkdtempSync(join(tmpdir(), 'forgedesk-build-test-')); directories.push(path); return path }
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }) })
describe('quick build cache correctness', () => {
  it('hashes file contents, new untracked inputs, deletions and excludes generated resources', () => {
    const root = temporary(); mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src', 'a.ts'), 'one')
    const first = hashPaths(root, ['src'])
    writeFileSync(join(root, 'src', 'a.ts'), 'two'); assert.notEqual(hashPaths(root, ['src']), first)
    const second = hashPaths(root, ['src']); writeFileSync(join(root, 'src', 'b.ts'), 'new'); assert.notEqual(hashPaths(root, ['src']), second)
    mkdirSync(join(root, 'src', 'cache')); const excluded = hashPaths(root, ['src'], new Set(['cache']))
    writeFileSync(join(root, 'src', 'cache', 'x'), 'ignored'); assert.equal(hashPaths(root, ['src'], new Set(['cache'])), excluded)
    rmSync(join(root, 'src', 'b.ts')); assert.notEqual(hashPaths(root, ['src']), second)
  })
  it('clones a bundle without writable hard links and preserves framework symlinks', () => {
    const root = temporary(), source = join(root, 'source'), target = join(root, 'target')
    mkdirSync(source); writeFileSync(join(source, 'binary'), 'original'); symlinkSync('binary', join(source, 'Current'))
    cloneTree(source, target); writeFileSync(join(target, 'binary'), 'changed')
    assert.equal(readFileSync(join(source, 'binary'), 'utf8'), 'original')
    assert.equal(readFileSync(join(target, 'Current'), 'utf8'), 'changed')
  })
  it('writes manifests atomically and treats damaged JSON as a cache miss', () => {
    const root = temporary(), path = join(root, 'manifest.json')
    writeJson(path, { success: true }); assert.deepEqual(readJson(path), { success: true })
    writeFileSync(path, '{'); assert.equal(readJson(path), null)
  })
  it('refuses concurrent builds and releases only its own lock', () => {
    const root = temporary(), lock = join(root, 'build.lock'), release = acquireBuildLock(lock)
    assert.throws(() => acquireBuildLock(lock), /已有构建/)
    writeFileSync(lock, JSON.stringify({ pid: process.pid, nonce: 'other' })); release(); assert.ok(existsSync(lock))
  })
  it('recovers a stale lock without deleting other output', () => {
    const root = temporary(), lock = join(root, 'build.lock')
    writeFileSync(lock, JSON.stringify({ pid: 2147483647, nonce: 'stale' }))
    const release = acquireBuildLock(lock); release(); assert.equal(existsSync(lock), false)
  })
  it('refuses broad removal, traversal and top-level symlink deletion', () => {
    const root = temporary(); mkdirSync(join(root, 'child')); symlinkSync(join(root, 'child'), join(root, 'link'))
    assert.equal(inside(root, join(root, '..')), false)
    assert.throws(() => removeManaged(root, root), /unmanaged/)
    assert.throws(() => removeManaged(root, join(root, 'link')), /unmanaged/)
    removeManaged(root, join(root, 'child')); assert.equal(existsSync(join(root, 'child')), false)
  })
  it('does not inherit publishing credentials into local builds', () => {
    const env = localBuildEnv({ PATH: '/usr/bin', APPLE_ID: 'secret', CSC_LINK: 'secret', FORGEDESK_CODESIGN_IDENTITY: 'Developer ID' })
    assert.equal(env.APPLE_ID, undefined); assert.equal(env.CSC_LINK, undefined); assert.equal(env.FORGEDESK_CODESIGN_IDENTITY, '-'); assert.equal(env.PATH, '/usr/bin')
    assert.equal(env.pnpm_config_verify_deps_before_run, 'false')
    assert.equal(env.npm_config_manage_package_manager_versions, 'false')
    assert.equal(env.pnpm_config_pm_on_fail, 'error')
  })
  it('propagates a failed command and aborts a running child', async () => {
    await assert.rejects(run(process.execPath, ['-e', 'process.exit(7)'], { capture: true }), /failed \(7\)/)
    const controller = new AbortController()
    const pending = run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { capture: true, signal: controller.signal })
    controller.abort(); await assert.rejects(pending, /abort/i)
  })
})
