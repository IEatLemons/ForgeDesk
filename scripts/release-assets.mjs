import { existsSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const platforms = ['mac', 'win', 'linux']

export function getExpectedReleaseAssetNames(version, platform, productName = 'ForgeDesk') {
  const prefix = `${productName}-${String(version).trim()}`
  const expectedByPlatform = {
    mac: [`${prefix}-universal.dmg`, `${prefix}-universal.dmg.blockmap`, `${prefix}-universal.zip`, `${prefix}-universal.zip.blockmap`, 'latest-mac.yml'],
    win: [`${prefix}-x64.exe`, `${prefix}-x64.exe.blockmap`, 'latest.yml'],
    linux: [`${prefix}-x64.AppImage`, `${prefix}-x64.AppImage.blockmap`, 'latest-linux.yml']
  }

  if (!platforms.includes(platform)) throw new Error(`未知发布平台：${platform}`)
  return expectedByPlatform[platform]
}

export function getMissingReleaseAssets({ version, platform, directory, productName }) {
  return getExpectedReleaseAssetNames(version, platform, productName).filter((name) => {
    const path = join(directory, name)
    return !existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0
  })
}

export function assertReleaseAssets(options) {
  const missing = getMissingReleaseAssets(options)
  if (missing.length > 0) throw new Error(`${options.platform} 发布资产不完整：${missing.join(', ')}`)
}

export function listReleaseAssetBasenames(directory, filePaths) {
  return filePaths.map((path) => basename(join(directory, path)))
}
