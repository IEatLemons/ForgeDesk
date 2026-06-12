import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const betterSqlitePath = join(root, 'node_modules', 'better-sqlite3')
const prebuildInstallBin = join(root, 'node_modules', 'prebuild-install', 'bin.js')
const electronPackagePath = join(root, 'node_modules', 'electron', 'package.json')
const nativeCachePath = join(root, '.cache', 'native')

if (!existsSync(betterSqlitePath) || !existsSync(prebuildInstallBin) || !existsSync(electronPackagePath)) {
  console.warn('Skipping native rebuild: dependencies are not installed yet.')
  process.exit(0)
}

const electronPackage = JSON.parse(readFileSync(electronPackagePath, 'utf8'))
const electronVersion = electronPackage.version

const result = spawnSync(
  process.execPath,
  [prebuildInstallBin, '--runtime', 'electron', '--target', electronVersion, '--arch', process.arch],
  {
    cwd: betterSqlitePath,
    env: {
      ...process.env,
      npm_config_cache: nativeCachePath
    },
    stdio: 'inherit'
  }
)

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 0)
