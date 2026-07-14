const { existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

function getExistingSigningIdentity(appPath) {
  const result = spawnSync('codesign', ['-dv', '--verbose=4', appPath], {
    encoding: 'utf8'
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const authority = output.match(/^Authority=(.+)$/m)?.[1]?.trim()

  return authority || null
}

function collectSignableFiles(directory, files = []) {
  if (!existsSync(directory)) {
    return files
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      collectSignableFiles(entryPath, files)
    } else if (entry.name.endsWith('.node') || entry.name === 'spawn-helper') {
      files.push(entryPath)
    }
  }

  return files
}

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = join(context.appOutDir, appName)
  const identity = process.env.FORGEDESK_CODESIGN_IDENTITY || getExistingSigningIdentity(appPath) || '-'
  const unpackedNodeModules = join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules')
  const menuBarHelperPath = join(appPath, 'Contents', 'Resources', 'MenuBarHelper', 'ForgeDeskMenuBarHelper.app')

  for (const file of collectSignableFiles(unpackedNodeModules)) {
    run('codesign', ['--force', '--sign', identity, file])
  }

  if (existsSync(menuBarHelperPath)) {
    run('codesign', ['--force', '--deep', '--sign', identity, menuBarHelperPath])
  }

  run('codesign', ['--force', '--deep', '--sign', identity, appPath])
}
