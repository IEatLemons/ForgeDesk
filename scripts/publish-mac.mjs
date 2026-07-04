import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs'
import { request } from 'node:https'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  assertMacReleaseAssetsComplete,
  createPublishPlan,
  getExpectedMacReleaseAssetNames,
  getMissingReleaseAssetNames,
  getReleaseTagName
} from './publish-mac-helpers.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tagName = getReleaseTagName(packageJson)
const distDir = join(root, 'dist')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(output || `${command} ${args.join(' ')} failed`)
  }

  return String(result.stdout ?? '').trim()
}

function readOptional(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  })

  if (result.status === 0) {
    return String(result.stdout ?? '').trim()
  }

  return ''
}

function readRemoteTagCommit(tag) {
  const output = readOptional('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`])
  const rows = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const peeled = rows.find((line) => line.endsWith(`refs/tags/${tag}^{}`))
  const selected = peeled ?? rows.find((line) => line.endsWith(`refs/tags/${tag}`))
  return selected?.split(/\s+/)[0] ?? ''
}

function getGithubPublishConfig() {
  const publishers = Array.isArray(packageJson.build?.publish) ? packageJson.build.publish : []
  const githubPublisher = publishers.find((publisher) => publisher?.provider === 'github')
  const owner = String(githubPublisher?.owner ?? '').trim()
  const repo = String(githubPublisher?.repo ?? '').trim()

  if (!owner || !repo) {
    throw new Error('package.json build.publish 缺少 GitHub owner/repo 配置。')
  }

  return { owner, repo }
}

function getGithubToken() {
  const token = String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim()

  if (!token) {
    throw new Error('发布到 GitHub Releases 需要设置 GH_TOKEN 或 GITHUB_TOKEN。')
  }

  return token
}

function createGithubRequestError(method, url, statusCode, responseBody) {
  const parsedUrl = new URL(url)
  const message = responseBody.trim() || `HTTP ${statusCode}`
  return new Error(`GitHub API ${method} ${parsedUrl.pathname} 失败：HTTP ${statusCode} ${message}`)
}

function githubRequest(method, url, token, { headers = {}, body, streamPath } = {}) {
  return new Promise((resolve, reject) => {
    const requestHeaders = {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'ForgeDesk-release-publisher',
      'x-github-api-version': '2022-11-28',
      ...headers
    }
    const requestOptions = new URL(url)
    const requestBody = body === undefined ? undefined : Buffer.from(JSON.stringify(body))

    if (requestBody) {
      requestHeaders['content-type'] = 'application/json'
      requestHeaders['content-length'] = String(requestBody.byteLength)
    }

    if (streamPath) {
      requestHeaders['content-length'] = String(statSync(streamPath).size)
    }

    const req = request(
      {
        method,
        protocol: requestOptions.protocol,
        hostname: requestOptions.hostname,
        path: `${requestOptions.pathname}${requestOptions.search}`,
        headers: requestHeaders
      },
      (res) => {
        const chunks = []

        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8')
          const statusCode = res.statusCode ?? 0

          if (statusCode < 200 || statusCode >= 300) {
            reject(createGithubRequestError(method, url, statusCode, responseBody))
            return
          }

          resolve(responseBody ? JSON.parse(responseBody) : null)
        })
      }
    )

    req.on('error', reject)

    if (requestBody) {
      req.end(requestBody)
      return
    }

    if (streamPath) {
      createReadStream(streamPath).on('error', reject).pipe(req)
      return
    }

    req.end()
  })
}

async function readGithubRelease(owner, repo, token) {
  try {
    return await githubRequest('GET', `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tagName)}`, token)
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP 404')) {
      return null
    }

    throw error
  }
}

async function ensureGithubRelease(owner, repo, token) {
  const existingRelease = await readGithubRelease(owner, repo, token)

  if (existingRelease) {
    console.log(`Using existing GitHub Release ${tagName}`)
    return existingRelease
  }

  console.log(`Creating GitHub Release ${tagName}`)
  return githubRequest('POST', `https://api.github.com/repos/${owner}/${repo}/releases`, token, {
    body: {
      tag_name: tagName,
      name: packageJson.version,
      body: `v${packageJson.version}`,
      draft: false,
      prerelease: false
    }
  })
}

function getContentType(assetName) {
  if (assetName.endsWith('.yml') || assetName.endsWith('.yaml')) {
    return 'text/yaml'
  }

  if (assetName.endsWith('.zip')) {
    return 'application/zip'
  }

  return 'application/octet-stream'
}

function getAssetUploadUrl(uploadUrl, assetName) {
  const baseUrl = uploadUrl.split('{')[0]
  return `${baseUrl}?name=${encodeURIComponent(assetName)}`
}

async function listGithubReleaseAssets(release, token) {
  return githubRequest('GET', release.assets_url, token)
}

function assertNoAssetSizeConflicts(expectedAssetNames, assetsByName) {
  for (const assetName of expectedAssetNames) {
    const asset = assetsByName.get(assetName)

    if (!asset) {
      continue
    }

    const localSize = statSync(join(distDir, assetName)).size
    const remoteSize = Number(asset.size ?? 0)

    if (remoteSize !== localSize) {
      throw new Error(`${tagName} 已存在资产 ${assetName}，但远端大小 ${remoteSize} 与本地大小 ${localSize} 不一致。请删除该半成品资产或 Release 后重试。`)
    }
  }
}

async function uploadGithubReleaseAsset(release, token, assetName) {
  const assetPath = join(distDir, assetName)
  console.log(`Uploading ${assetName}`)
  await githubRequest('POST', getAssetUploadUrl(release.upload_url, assetName), token, {
    headers: {
      'content-type': getContentType(assetName)
    },
    streamPath: assetPath
  })
}

async function publishMacReleaseArtifacts() {
  const { owner, repo } = getGithubPublishConfig()
  const token = getGithubToken()
  const expectedAssetNames = getExpectedMacReleaseAssetNames({
    version: packageJson.version,
    distFiles: readdirSync(distDir)
  })

  assertMacReleaseAssetsComplete({
    tagName,
    expectedAssetNames: ['latest-mac.yml'],
    existingAssetNames: expectedAssetNames
  })

  const release = await ensureGithubRelease(owner, repo, token)
  let assets = await listGithubReleaseAssets(release, token)
  let assetsByName = new Map(assets.map((asset) => [String(asset.name), asset]))
  assertNoAssetSizeConflicts(expectedAssetNames, assetsByName)

  const missingAssetNames = getMissingReleaseAssetNames({
    expectedAssetNames,
    existingAssetNames: Array.from(assetsByName.keys())
  })

  for (const assetName of missingAssetNames) {
    await uploadGithubReleaseAsset(release, token, assetName)
  }

  assets = await listGithubReleaseAssets(release, token)
  assetsByName = new Map(assets.map((asset) => [String(asset.name), asset]))
  assertNoAssetSizeConflicts(expectedAssetNames, assetsByName)
  assertMacReleaseAssetsComplete({
    tagName,
    expectedAssetNames,
    existingAssetNames: Array.from(assetsByName.keys())
  })
  console.log(`GitHub Release ${tagName} assets are complete`)
}

function ensureReleaseTag() {
  const headCommit = run('git', ['rev-parse', 'HEAD'], { capture: true })
  const status = run('git', ['status', '--porcelain'], { capture: true })
  const allowDirtyRelease = process.env.FORGEDESK_ALLOW_DIRTY_RELEASE === '1'

  if (status.length > 0 && !allowDirtyRelease) {
    createPublishPlan({
      version: packageJson.version,
      headCommit,
      isDirty: true,
      localTagCommit: '',
      remoteTagCommit: '',
      allowDirtyRelease
    })
  }

  const localTagCommit = readOptional('git', ['rev-parse', '-q', '--verify', `${tagName}^{}`])
  const remoteTagCommit = readRemoteTagCommit(tagName)
  const plan = createPublishPlan({
    version: packageJson.version,
    headCommit,
    isDirty: status.length > 0,
    localTagCommit,
    remoteTagCommit,
    allowDirtyRelease
  })

  if (plan.shouldCreateLocalTag) {
    run('git', ['tag', plan.tagName])
    console.log(`Created ${plan.tagName}`)
  } else {
    console.log(`${plan.tagName} already exists locally`)
  }

  if (plan.shouldPushTag) {
    run('git', ['push', 'origin', plan.tagName])
  } else {
    console.log(`${plan.tagName} already exists on origin`)
  }
}

ensureReleaseTag()
run(process.execPath, [join(root, 'scripts', 'rebuild-native.mjs')])
run(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'])
run(process.execPath, [join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'])
run(process.execPath, [join(root, 'node_modules', 'electron-builder', 'cli.js'), '--mac', '--publish', 'never'])
await publishMacReleaseArtifacts()
