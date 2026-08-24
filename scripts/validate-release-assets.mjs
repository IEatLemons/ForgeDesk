import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertReleaseAssets } from './release-assets.mjs'

function getArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

const platform = getArgument('--platform')
const directory = resolve(getArgument('--dir') || 'dist')
const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version

for (const currentPlatform of platform === 'all' ? ['mac', 'win', 'linux'] : [platform]) {
  assertReleaseAssets({ version, platform: currentPlatform, directory })
  console.log(`Validated ${currentPlatform} release assets in ${directory}`)
}
