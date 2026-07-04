import { basename } from 'node:path'

export function getReleaseTagName(packageJson) {
  const version = String(packageJson.version ?? '').trim()

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json version 不是有效版本号：${version || '(empty)'}`)
  }

  return `v${version}`
}

export function createPublishPlan({ version, headCommit, isDirty, localTagCommit, remoteTagCommit, allowDirtyRelease }) {
  const tagName = getReleaseTagName({ version })
  const normalizedHead = String(headCommit ?? '').trim()
  const normalizedLocalTagCommit = String(localTagCommit ?? '').trim()
  const normalizedRemoteTagCommit = String(remoteTagCommit ?? '').trim()

  if (!normalizedHead) {
    throw new Error('无法读取当前 Git 提交。')
  }

  if (isDirty && !allowDirtyRelease) {
    throw new Error('工作区还有未提交的改动。请先提交代码，再发布；临时绕过可设置 FORGEDESK_ALLOW_DIRTY_RELEASE=1。')
  }

  if (normalizedLocalTagCommit && normalizedLocalTagCommit !== normalizedHead) {
    throw new Error(`${tagName} 已存在，但不是当前提交。请确认版本号或移动 tag 后再发布。`)
  }

  if (normalizedRemoteTagCommit && normalizedRemoteTagCommit !== normalizedHead) {
    throw new Error(`远端 ${tagName} 已存在，但不是当前提交。请确认版本号后再发布。`)
  }

  return {
    tagName,
    shouldCreateLocalTag: !normalizedLocalTagCommit,
    shouldPushTag: !normalizedRemoteTagCommit
  }
}

function uniqueSortedAssetNames(assetNames) {
  return Array.from(new Set(assetNames)).sort((left, right) => {
    if (left === 'latest-mac.yml') {
      return 1
    }

    if (right === 'latest-mac.yml') {
      return -1
    }

    return left.localeCompare(right)
  })
}

export function getExpectedMacReleaseAssetNames({ version, distFiles, productName = 'ForgeDesk' }) {
  getReleaseTagName({ version })

  const normalizedVersion = String(version).trim()
  const artifactPrefix = `${productName}-${normalizedVersion}-`
  const artifactPattern = /\.(?:dmg|zip)(?:\.blockmap)?$/
  const assetNames = distFiles
    .map((file) => basename(String(file)))
    .filter((file) => file === 'latest-mac.yml' || (file.startsWith(artifactPrefix) && artifactPattern.test(file)))

  return uniqueSortedAssetNames(assetNames)
}

export function getMissingReleaseAssetNames({ expectedAssetNames, existingAssetNames }) {
  const existing = new Set(existingAssetNames.map((name) => String(name).trim()).filter(Boolean))
  return uniqueSortedAssetNames(expectedAssetNames.map((name) => String(name).trim()).filter(Boolean).filter((name) => !existing.has(name)))
}

export function assertMacReleaseAssetsComplete({ tagName, expectedAssetNames, existingAssetNames }) {
  const missing = getMissingReleaseAssetNames({ expectedAssetNames, existingAssetNames })

  if (missing.length > 0) {
    throw new Error(`${tagName} GitHub Release 资产不完整，缺少：${missing.join(', ')}。请重新运行发布脚本补齐资产，或删除半成品 Release 后重试。`)
  }
}
