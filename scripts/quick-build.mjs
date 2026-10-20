import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireBuildLock, cloneTree, hashPaths, inside, readJson, removeManaged, run, runtimeFingerprint, writeJson } from './quick-build-utils.mjs'

const formatVersion = 1
const event = value => console.log('@@FORGEDESK_BUILD@@' + JSON.stringify(value))
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const rootDefault = dirname(dirname(fileURLToPath(import.meta.url)))
const sourceInputs = ['src', 'native', 'scripts', 'electron.vite.config.ts', 'vite.prototype.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc']
const resourceHash = root => hashPaths(root, ['resources'], new Set(['MenuBarHelper', '.DS_Store']))
const sourceHash = root => digest([hashPaths(root, sourceInputs, new Set(['.DS_Store'])), resourceHash(root)])

export function localBuildEnv(env = process.env) {
  const result = {
    ...env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', FORGEDESK_CODESIGN_IDENTITY: '-',
    // pnpm 11 otherwise installs automatically before run/exec. Besides network
    // delays its install output can corrupt electron-builder's workspace query.
    pnpm_config_verify_deps_before_run: 'false', npm_config_verify_deps_before_run: 'false',
    pnpm_config_pm_on_fail: 'error', npm_config_manage_package_manager_versions: 'false'
  }
  for (const name of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'CSC_INSTALLER_LINK', 'CSC_INSTALLER_KEY_PASSWORD', 'CSC_NAME', 'CSC_KEYCHAIN', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER']) delete result[name]
  return result
}

export async function quickBuild({ root = rootDefault, force = false } = {}) {
  root = realpathSync(root)
  if (process.platform !== 'darwin' || !['arm64', 'x64'].includes(process.arch)) throw new Error('本机快速 .app 构建仅支持 macOS arm64 / x64')
  if (process.env.FORGEDESK_QUICK_ARCH && process.env.FORGEDESK_QUICK_ARCH !== process.arch) throw new Error('Node 与 ForgeDesk 架构不同，请使用同架构的 Node 后再构建')
  const packageJson = readJson(join(root, 'package.json'))
  if (packageJson?.name !== 'forgedesk') throw new Error('请选择 ForgeDesk 源码目录')
  const architecture = process.arch, id = randomUUID(), cache = join(root, '.cache', 'quick-build', 'v1'), outputs = join(root, 'dist', 'quick-build')
  mkdirSync(cache, { recursive: true }); mkdirSync(outputs, { recursive: true })
  const release = acquireBuildLock(join(cache, 'build.lock'))
  const staging = join(cache, 'staging', id), artifactDirectory = join(outputs, id), artifactPath = join(artifactDirectory, 'ForgeDesk.app')
  const controller = new AbortController(), env = localBuildEnv(), require = createRequire(join(root, 'package.json'))
  const abort = () => controller.abort()
  process.once('SIGTERM', abort); process.once('SIGINT', abort)
  const started = performance.now(), stages = []
  let reportedArtifactPath = artifactPath
  const reportPath = join(cache, 'runs', `${id}.json`)
  const report = () => writeJson(reportPath, { formatVersion, id, root, architecture, artifactPath: reportedArtifactPath, stages, elapsedMs: Math.round(performance.now() - started) })
  const execute = (command, args, options = {}) => run(command, args, { cwd: root, env, signal: controller.signal, ...options })
  async function stage(id, title, work) {
    const record = { id, title, status: 'running', elapsedMs: 0 }
    stages.push(record); event({ stage: record }); report()
    const begin = performance.now()
    try { record.cacheHit = !!(await work()); record.status = 'succeeded' }
    catch (error) { record.status = 'failed'; throw error }
    finally { record.elapsedMs = Math.round(performance.now() - begin); event({ stage: record }); report() }
  }
  const verify = app => execute('codesign', ['--verify', '--deep', '--strict', app], { capture: true, timeout: 30000 })
  async function validApp(app) {
    try { if (!existsSync(join(app, 'Contents', 'MacOS', 'ForgeDesk'))) return false; await verify(app); return true } catch { return false }
  }
  async function sign(app, full) {
    if (full) {
      const walk = async path => {
        if (lstatSync(path).isSymbolicLink()) return
        if (lstatSync(path).isDirectory()) { for (const name of readdirSync(path)) await walk(join(path, name)); return }
        if (!path.endsWith('.node') && !path.endsWith('spawn-helper')) return
        const magic = readFileSync(path).subarray(0, 4).toString('hex')
        if (['cffaedfe', 'cefaedfe', 'cafebabe', 'bebafeca'].includes(magic)) await execute('codesign', ['--force', '--sign', '-', '--timestamp=none', path], { capture: true })
      }
      await walk(join(app, 'Contents', 'Resources', 'app', 'node_modules'))
      await execute('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', join(app, 'Contents', 'Resources', 'MenuBarHelper', 'ForgeDeskMenuBarHelper.app')], { capture: true })
    }
    await execute('codesign', ['--force', ...(full ? ['--deep'] : []), '--sign', '-', '--timestamp=none', app], { capture: true })
    await verify(app)
  }
  let published = false
  try {
    let inputs, runtime, helperKey, shellKey
    await stage('inputs', '检查源码与依赖', async () => {
      inputs = sourceHash(root); runtime = runtimeFingerprint(root)
      const toolchain = await execute('xcrun', ['swiftc', '--version'], { capture: true, timeout: 15000 })
      const sdk = await execute('xcrun', ['--sdk', 'macosx', '--show-sdk-version'], { capture: true, timeout: 15000 })
      helperKey = digest([hashPaths(root, ['native/MenuBarHelper']), architecture, toolchain, sdk, '-O/AppKit/ApplicationServices'])
      shellKey = digest([formatVersion, runtime, resourceHash(root), hashPaths(root, ['scripts/after-pack.cjs', 'scripts/quick-build.mjs', 'scripts/quick-build-utils.mjs'])])
      return false
    })
    const latest = readJson(join(cache, `latest-${architecture}.json`))
    let reuse = false
    await stage('reuse', '检查上次成功应用', async () => {
      const manifest = latest?.artifactPath && readJson(join(latest.artifactPath, 'Contents', 'Resources', 'quick-build.json'))
      reuse = !force && latest?.inputs === inputs && latest?.runtime === runtime && latest?.helperKey === helperKey && inside(outputs, latest.artifactPath) && existsSync(latest.artifactPath) && realpathSync(latest.artifactPath) === latest.artifactPath && manifest?.sourceRoot === root && manifest?.inputs === inputs && await validApp(latest.artifactPath)
      return reuse
    })
    if (reuse) {
      if (controller.signal.aborted || sourceHash(root) !== inputs || runtimeFingerprint(root) !== runtime) throw new Error('构建输入已变化或构建已取消，请重试')
      reportedArtifactPath = latest.artifactPath
      event({ artifactPath: latest.artifactPath, reportPath, architecture, elapsedMs: Math.round(performance.now() - started), reused: true })
      return { artifactPath: latest.artifactPath, reportPath, reused: true }
    }
    mkdirSync(staging, { recursive: true })
    const electron = require('electron')
    const smoke = join(root, 'scripts', 'quick-build-native-check.cjs')
    await stage('native', '检查原生依赖', async () => {
      // A successful require alone is insufficient: exercise SQLite and PTY in
      // the target Electron, never the Node process running this script.
      let compatible = false
      try { await execute(electron, [smoke, root, architecture], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, capture: true, timeout: 15000 }); compatible = true } catch { /* Rebuild exactly once, then fail closed. */ }
      if (!compatible) {
        await execute(process.execPath, [join(root, 'scripts', 'rebuild-native.mjs'), '--quick'])
        await execute(electron, [smoke, root, architecture], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, capture: true, timeout: 15000 })
        runtime = runtimeFingerprint(root)
        shellKey = digest([formatVersion, runtime, resourceHash(root), hashPaths(root, ['scripts/after-pack.cjs', 'scripts/quick-build.mjs', 'scripts/quick-build-utils.mjs'])])
      }
      return compatible
    })
    const helperDirectory = join(cache, 'helpers', helperKey), helperApp = join(helperDirectory, 'ForgeDeskMenuBarHelper.app')
    await stage('swift', '准备菜单栏辅助程序', async () => {
      const meta = readJson(join(helperDirectory, 'manifest.json'))
      if (!force && meta?.hash === hashPaths(helperDirectory, ['ForgeDeskMenuBarHelper.app']) && existsSync(join(helperApp, 'Contents', 'MacOS', 'ForgeDeskMenuBarHelper'))) return true
      await execute(process.execPath, [join(root, 'scripts', 'build-menu-bar-helper.mjs')], { env: { ...env, FORGEDESK_MAC_UNIVERSAL: '' } })
      const temporary = join(staging, 'helper')
      cloneTree(join(root, 'resources', 'MenuBarHelper', 'ForgeDeskMenuBarHelper.app'), join(temporary, 'ForgeDeskMenuBarHelper.app'))
      writeJson(join(temporary, 'manifest.json'), { helperKey, hash: hashPaths(temporary, ['ForgeDeskMenuBarHelper.app']) })
      if (existsSync(helperDirectory)) removeManaged(cache, helperDirectory)
      mkdirSync(dirname(helperDirectory), { recursive: true }); renameSync(temporary, helperDirectory)
      return false
    })
    const business = join(cache, 'business', inputs), out = join(business, 'out'), businessMeta = readJson(join(business, 'manifest.json'))
    const businessValid = !force && businessMeta?.inputs === inputs && existsSync(join(out, 'main', 'index.js')) && businessMeta?.hash === hashPaths(business, ['out'])
    await stage('types', '增量类型检查', async () => {
      if (businessValid) return true
      mkdirSync(join(cache, 'types'), { recursive: true })
      await execute(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--incremental', '--tsBuildInfoFile', join(cache, 'types', `${architecture}.tsbuildinfo`)])
      return false
    })
    await stage('business', '构建业务代码', async () => {
      if (businessValid) return true
      const temporary = join(staging, 'business')
      await execute(process.execPath, [join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'], { env: { ...env, FORGEDESK_QUICK_OUTPUT_DIR: join(temporary, 'out') } })
      writeJson(join(temporary, 'manifest.json'), { inputs, hash: hashPaths(temporary, ['out']) })
      if (sourceHash(root) !== inputs) throw new Error('构建期间源码发生变化，请重新构建；未更新成功缓存')
      if (existsSync(business)) removeManaged(cache, business)
      mkdirSync(dirname(business), { recursive: true }); renameSync(temporary, business)
      return false
    })
    const shell = join(cache, 'shells', shellKey, 'ForgeDesk.app')
    await stage('shell', '准备本机应用运行壳', async () => {
      if (!force && await validApp(shell)) return true
      const { build, Platform, Arch } = await import('electron-builder')
      const seed = join(staging, 'seed')
      // electron-builder also reads process.env internally. Do not expose release
      // credentials even though all spawned commands already use the local env.
      const previousEnv = { ...process.env }
      for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name]
      Object.assign(process.env, env)
      try { await build({ targets: Platform.MAC.createTarget('dir', architecture === 'arm64' ? Arch.arm64 : Arch.x64), publish: 'never', projectDir: root, config: {
        ...packageJson.build, directories: { ...packageJson.build.directories, output: seed }, electronDist: resolve(dirname(electron), '../../..'),
        asar: false, npmRebuild: false, afterSign: null, forceCodeSigning: false, publish: null,
        mac: { ...packageJson.build.mac, identity: null, notarize: false, extraResources: [] },
        files: [{ from: out, to: 'out', filter: ['**/*'] }, 'package.json'],
        extraResources: [{ from: join(root, 'resources', 'forgedesk.png'), to: 'forgedesk.png' }, { from: helperApp, to: 'MenuBarHelper/ForgeDeskMenuBarHelper.app' }]
      } }) } finally {
        for (const name of Object.keys(process.env)) if (!(name in previousEnv)) delete process.env[name]
        Object.assign(process.env, previousEnv)
      }
      const built = join(seed, architecture === 'arm64' ? 'mac-arm64' : 'mac', 'ForgeDesk.app')
      await sign(built, true)
      if (existsSync(shell)) removeManaged(cache, shell)
      mkdirSync(dirname(shell), { recursive: true }); renameSync(built, shell)
      return false
    })
    const assembled = join(staging, 'ForgeDesk.app')
    await stage('assemble', '更新独立应用副本', async () => {
      cloneTree(shell, assembled)
      const appRoot = join(assembled, 'Contents', 'Resources', 'app'), targetOut = join(appRoot, 'out')
      removeManaged(assembled, targetOut); cloneTree(out, targetOut)
      const targetHelper = join(assembled, 'Contents', 'Resources', 'MenuBarHelper', 'ForgeDeskMenuBarHelper.app')
      removeManaged(assembled, targetHelper); cloneTree(helperApp, targetHelper)
      await execute('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', targetHelper], { capture: true })
      writeJson(join(assembled, 'Contents', 'Resources', 'quick-build.json'), { formatVersion, sourceRoot: root, inputs, runtime, architecture, helperKey, builtAt: new Date().toISOString(), localOnly: true })
      return false
    })
    await stage('sign', '本地签名与完整性验证', async () => {
      await sign(assembled, false)
      await execute(join(assembled, 'Contents', 'MacOS', 'ForgeDesk'), [smoke, join(assembled, 'Contents', 'Resources', 'app'), architecture], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, capture: true, timeout: 15000 })
      return false
    })
    await stage('publish', '验证并登记成功产物', async () => {
      if (controller.signal.aborted) throw new Error('构建已取消')
      if (sourceHash(root) !== inputs || runtimeFingerprint(root) !== runtime) throw new Error('构建输入已变化，请重新构建；保留上次成功应用')
      // The independent artifact is only made visible after every check passed.
      mkdirSync(artifactDirectory)
      renameSync(assembled, artifactPath)
      writeJson(join(cache, `latest-${architecture}.json`), { id, inputs, runtime, helperKey, architecture, artifactPath })
      published = true
      return false
    })
    event({ artifactPath, reportPath, architecture, elapsedMs: Math.round(performance.now() - started), reused: false })
    return { artifactPath, reportPath, reused: false }
  } finally {
    try {
      report()
      if (existsSync(staging)) removeManaged(cache, staging)
      if (!published && existsSync(artifactDirectory)) removeManaged(outputs, artifactDirectory)
    } finally {
      release(); process.removeListener('SIGTERM', abort); process.removeListener('SIGINT', abort)
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  quickBuild({ force: process.argv.includes('--force') }).catch(error => { console.error(error.stack || error); process.exitCode = 1 })
}
