import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { getExpectedReleaseAssetNames } from './release-assets.mjs'

function getArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

const platform = getArgument('--platform')
const sourceDirectory = resolve(getArgument('--source') || 'dist')
const targetDirectory = resolve(getArgument('--target') || `release-assets/${platform}`)
const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version

rmSync(targetDirectory, { recursive: true, force: true })
mkdirSync(targetDirectory, { recursive: true })
for (const name of getExpectedReleaseAssetNames(version, platform)) {
  cpSync(resolve(sourceDirectory, name), resolve(targetDirectory, name))
}
console.log(`Staged ${platform} release assets in ${targetDirectory}`)
