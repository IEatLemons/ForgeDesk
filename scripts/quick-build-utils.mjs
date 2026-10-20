import { createHash, randomUUID } from 'node:crypto'
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

export const readJson = path => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 2))
  renameSync(temporary, path)
}
export function hashPaths(root, paths, excluded = new Set()) {
  const hash = createHash('sha256')
  function walk(path, name) {
    hash.update(name + '\0')
    if (!existsSync(path)) { hash.update('missing\0'); return }
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) { hash.update(`link:${readlinkSync(path)}\0`); return }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) if (!excluded.has(entry)) walk(join(path, entry), `${name}/${entry}`)
    } else { hash.update(String(stat.mode & 0o111)); hash.update(readFileSync(path)); hash.update('\0') }
  }
  for (const path of paths) walk(resolve(root, path), path)
  return hash.digest('hex')
}
export function cloneTree(source, target) {
  const stat = lstatSync(source)
  if (stat.isSymbolicLink()) { mkdirSync(dirname(target), { recursive: true }); symlinkSync(readlinkSync(source), target); return }
  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true, mode: stat.mode })
    for (const name of readdirSync(source)) cloneTree(join(source, name), join(target, name))
  } else {
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target, constants.COPYFILE_FICLONE)
  }
}
export function inside(root, path) {
  const child = relative(resolve(root), resolve(path))
  return !!child && child !== '..' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(child)
}
export function removeManaged(root, path) {
  if (!inside(root, path) || lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Refusing to remove unmanaged path: ${path}`)
  rmSync(path, { recursive: true, force: true })
}
export function acquireBuildLock(path) {
  mkdirSync(dirname(path), { recursive: true })
  const contents = JSON.stringify({ pid: process.pid, nonce: randomUUID() })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const descriptor = openSync(path, 'wx', 0o600)
      try { writeFileSync(descriptor, contents) } finally { closeSync(descriptor) }
      return () => { if (existsSync(path) && readFileSync(path, 'utf8') === contents) unlinkSync(path) }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const previous = readFileSync(path, 'utf8'), owner = JSON.parse(previous)
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw new Error('构建锁无效，请确认没有其他构建后手动处理')
      try { process.kill(owner.pid, 0); throw new Error('此源码目录已有构建任务在运行') }
      catch (error) {
        if (error.code === 'EPERM') throw new Error('此源码目录已有构建任务在运行（无权检查其进程）')
        if (error.code !== 'ESRCH') throw error
      }
      if (readFileSync(path, 'utf8') === previous) unlinkSync(path)
    }
  }
  throw new Error('无法取得构建锁')
}
export function runtimeFingerprint(root) {
  const pkg = readJson(join(root, 'package.json'))
  const packages = new Map()
  function locate(name, from) {
    const req = createRequire(join(from, 'package.json'))
    try { return dirname(req.resolve(`${name}/package.json`)) } catch { /* Package export maps may hide package.json. */ }
    let path = dirname(req.resolve(name))
    while (dirname(path) !== path) {
      if (readJson(join(path, 'package.json'))?.name === name) return path
      path = dirname(path)
    }
    throw new Error(`Cannot locate dependency ${name}`)
  }
  function visit(name, from, optional) {
    let path
    try { path = realpathSync(locate(name, from)) } catch (error) { if (optional) return; throw error }
    if (packages.has(path)) return
    const manifest = readJson(join(path, 'package.json'))
    packages.set(path, `${manifest.name}@${manifest.version}:${hashPaths(path, ['.'], new Set(['node_modules', '.git', 'build', '.DS_Store']))}:${hashPaths(path, ['build/Release'], new Set(['.deps', 'obj.target', '.forge-meta']))}`)
    for (const name of Object.keys(manifest.dependencies ?? {})) visit(name, path, !!manifest.optionalDependencies?.[name])
    for (const name of Object.keys({ ...manifest.optionalDependencies, ...manifest.peerDependencies })) visit(name, path, true)
  }
  for (const name of Object.keys(pkg.dependencies ?? {})) visit(name, root, !!pkg.optionalDependencies?.[name])
  for (const name of Object.keys(pkg.optionalDependencies ?? {})) visit(name, root, true)
  const versions = ['electron', 'electron-builder', '@electron/rebuild'].map(name => `${name}:${readJson(join(locate(name, root), 'package.json'))?.version}`)
  return createHash('sha256').update(JSON.stringify({ platform: process.platform, arch: process.arch, versions, dependencies: [...packages.values()].sort(), manifest: hashPaths(root, ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package-lock.json', 'yarn.lock', '.npmrc']) })).digest('hex')
}
export function run(command, args, { cwd, env = process.env, signal, capture = false, timeout = 0 } = {}) {
  return new Promise((yes, no) => {
    const child = spawn(command, args, { cwd, env, signal, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
    let stdout = '', stderr = '', timer
    // Keep stdout/stderr ordering deterministic for compiler-version cache keys.
    if (capture) {
      child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-128000) })
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-128000) })
    }
    if (timeout) timer = setTimeout(() => child.kill('SIGKILL'), timeout)
    child.once('error', error => { clearTimeout(timer); no(error) })
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      const output = stdout + (stderr ? '\n' + stderr : '')
      if (code === 0) yes(output)
      else no(new Error(`${command} failed (${signal || code}): ${output.slice(-4000)}`))
    })
  })
}
