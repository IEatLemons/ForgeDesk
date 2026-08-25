import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

export function resolveDesktopPackaging(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin') {
    return { platform, arch, builderArgs: ['--mac', '--universal'], universalMacHelper: true }
  }

  if (platform === 'win32' && arch === 'x64') {
    return { platform, arch, builderArgs: ['--win', '--x64'], universalMacHelper: false }
  }

  if (platform === 'linux' && arch === 'x64') {
    return { platform, arch, builderArgs: ['--linux', '--x64'], universalMacHelper: false }
  }

  throw new Error(`当前系统不支持 ForgeDesk 发布打包：${platform}/${arch}。支持 macOS（Universal）、Windows x64、Linux x64。`)
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' })

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}

export function packageDesktop(spec = resolveDesktopPackaging()) {
  const menuHelperEnv = {
    ...process.env,
    FORGEDESK_MAC_UNIVERSAL: spec.universalMacHelper ? '1' : ''
  }

  run(process.execPath, [resolve(root, 'scripts/build-menu-bar-helper.mjs')], menuHelperEnv)
  run(process.execPath, [resolve(root, 'scripts/rebuild-native.mjs')])
  run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit'])
  run(process.execPath, [resolve(root, 'node_modules/electron-vite/bin/electron-vite.js'), 'build'])
  run(process.execPath, [resolve(root, 'node_modules/electron-builder/cli.js'), ...spec.builderArgs, '--publish', 'never'])
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageDesktop()
}
