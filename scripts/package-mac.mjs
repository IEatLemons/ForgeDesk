import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const nodeBin = process.execPath
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const appName = 'ForgeDesk'
const appId = 'app.forgedesk.desktop'
const version = packageJson.version
const distDir = join(root, 'dist')
const electronApp = join(root, 'node_modules', 'electron', 'dist', 'Electron.app')
const tempApp = join(distDir, `${appName}.packaging.app`)
const finalApp = join(distDir, `${appName}-${version}-arm64.app`)

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

function plistEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function removeBinDirectories(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name)

    if (entry.isDirectory() && entry.name === '.bin') {
      rmSync(entryPath, { recursive: true, force: true })
      continue
    }

    if (entry.isDirectory()) {
      removeBinDirectories(entryPath)
    }
  }
}

if (!existsSync(electronApp)) {
  throw new Error('Electron app shell was not found. Run dependency installation first.')
}

run(nodeBin, [join(root, 'scripts', 'rebuild-native.mjs')])
run(nodeBin, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'])
run(nodeBin, [join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'])

mkdirSync(distDir, { recursive: true })
rmSync(tempApp, { recursive: true, force: true })
run('ditto', [electronApp, tempApp])

const resourcesDir = join(tempApp, 'Contents', 'Resources')
const appResourceDir = join(resourcesDir, 'app')
rmSync(appResourceDir, { recursive: true, force: true })
mkdirSync(appResourceDir, { recursive: true })

for (const entry of ['out', 'node_modules', 'package.json', 'package-lock.json']) {
  cpSync(join(root, entry), join(appResourceDir, entry), { recursive: true })
}

rmSync(join(appResourceDir, 'node_modules', 'electron'), { recursive: true, force: true })
removeBinDirectories(join(appResourceDir, 'node_modules'))

writeFileSync(
  join(appResourceDir, 'package.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version,
      description: packageJson.description,
      main: packageJson.main,
      type: packageJson.type,
      dependencies: packageJson.dependencies
    },
    null,
    2
  )}\n`
)

writeFileSync(
  join(tempApp, 'Contents', 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${plistEscape(appName)}</string>
  <key>CFBundleExecutable</key>
  <string>Electron</string>
  <key>CFBundleIconFile</key>
  <string>electron.icns</string>
  <key>CFBundleIdentifier</key>
  <string>${plistEscape(appId)}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${plistEscape(appName)}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${plistEscape(version)}</string>
  <key>CFBundleVersion</key>
  <string>${plistEscape(version)}</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSMainNibFile</key>
  <string>MainMenu</string>
  <key>NSPrincipalClass</key>
  <string>AtomApplication</string>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
`
)

rmSync(finalApp, { recursive: true, force: true })
renameSync(tempApp, finalApp)
run('codesign', ['--force', '--deep', '--sign', '-', finalApp])

console.log(`Packaged ${finalApp}`)
