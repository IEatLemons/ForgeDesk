import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const nodeBin = process.execPath
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const appName = 'ForgeDesk'
const artifactVersion = parseArtifactVersion(process.argv.slice(2))
const distDir = join(root, 'dist')
const builderApp = join(distDir, 'mac-arm64', `${appName}.app`)
const tempApp = join(distDir, `${appName}.packaging.app`)
const finalAppName = artifactVersion ? `${appName}-${artifactVersion}-arm64.app` : `${appName}.app`
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
run(nodeBin, [join(root, 'node_modules', 'electron-builder', 'cli.js'), '--mac', '--dir', '--publish', 'never'])

if (!existsSync(builderApp)) {
  throw new Error(`electron-builder did not create ${builderApp}`)
}

mkdirSync(distDir, { recursive: true })
rmSync(tempApp, { recursive: true, force: true })
rmSync(finalApp, { recursive: true, force: true })
run('ditto', [builderApp, tempApp])
renameSync(tempApp, finalApp)

console.log(`Packaged ${finalApp} using electron-builder ${packageJson.version}`)
