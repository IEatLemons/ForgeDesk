import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const nodeBin = process.execPath
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const electronPackageJson = JSON.parse(readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf8'))
const appName = 'ForgeDesk'
const packageArch = 'arm64'
const artifactVersion = parseArtifactVersion(process.argv.slice(2))
const distDir = join(root, 'dist')
const builderApp = join(distDir, `mac-${packageArch}`, `${appName}.app`)
const tempApp = join(distDir, `${appName}.packaging.app`)
const finalAppName = artifactVersion ? `${appName}-${artifactVersion}-${packageArch}.app` : `${appName}.app`
const finalApp = join(distDir, finalAppName)

function parseArtifactVersion(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--version' || arg === '-v') {
      return args[index + 1]?.trim() ?? ''
    }

    if (arg.startsWith('--version=')) {
      return arg.slice('--version='.length).trim()
    }

    if (!arg.startsWith('-')) {
      return arg.trim()
    }
  }

  return ''
}

function findCachedElectronDist() {
  const electronVersion = String(electronPackageJson.version ?? '').replace(/^v/, '')

  if (!electronVersion) return ''

  const archiveName = `electron-v${electronVersion}-darwin-${packageArch}.zip`
  const cacheRoots = [process.env.ELECTRON_CACHE, join(homedir(), 'Library', 'Caches', 'electron')]
    .filter((cacheRoot, index, roots) => Boolean(cacheRoot) && roots.indexOf(cacheRoot) === index)

  for (const cacheRoot of cacheRoots) {
    const directArchive = join(cacheRoot, archiveName)

    if (existsSync(directArchive)) return directArchive

    try {
      for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue

        const cachedArchive = join(cacheRoot, entry.name, archiveName)

        if (existsSync(cachedArchive)) return cachedArchive
      }
    } catch {
      // The cache may not exist yet; electron-builder will use its normal download flow.
    }
  }

  return ''
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run(nodeBin, [join(root, 'scripts', 'build-menu-bar-helper.mjs')])
run(nodeBin, [join(root, 'scripts', 'rebuild-native.mjs')])
run(nodeBin, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'])
run(nodeBin, [join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'])
const electronBuilderArgs = [join(root, 'node_modules', 'electron-builder', 'cli.js'), '--mac', '--dir', '--publish', 'never', `--${packageArch}`]
const cachedElectronDist = findCachedElectronDist()

if (cachedElectronDist) {
  console.log(`Using cached Electron distribution: ${cachedElectronDist}`)
  electronBuilderArgs.push(`--config.electronDist=${cachedElectronDist}`)
}

run(nodeBin, electronBuilderArgs)

if (!existsSync(builderApp)) {
  throw new Error(`electron-builder did not create ${builderApp}`)
}

mkdirSync(distDir, { recursive: true })
rmSync(tempApp, { recursive: true, force: true })
rmSync(finalApp, { recursive: true, force: true })
run('ditto', [builderApp, tempApp])
renameSync(tempApp, finalApp)

console.log(`Packaged ${finalApp} using electron-builder ${packageJson.version}`)
