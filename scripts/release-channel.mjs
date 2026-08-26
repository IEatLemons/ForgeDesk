/**
 * A release tag is pre-release only when its semver version has a prerelease
 * identifier. Build metadata (for example +build.7) does not make a release
 * a prerelease.
 */
export function getReleaseChannel(tagName) {
  const tag = String(tagName ?? '').trim()
  const version = tag.startsWith('v') ? tag.slice(1) : tag

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release tag: ${tag || '(empty)'}`)
  }

  return /^\d+\.\d+\.\d+-/.test(version) ? 'prerelease' : 'stable'
}

if (process.argv[1] && process.argv[1].endsWith('release-channel.mjs')) {
  process.stdout.write(getReleaseChannel(process.argv[2]) + '\n')
}
