import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const projectRoot = resolve(scriptDirectory, '..')
const androidRoot = resolve(projectRoot, 'android')
const rendererOutput = resolve(projectRoot, 'out/renderer')
const androidAssets = resolve(androidRoot, 'app/src/main/assets/renderer')

function resolveAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    resolve(homedir(), 'Library/Android/sdk'),
    resolve(homedir(), 'Android/Sdk')
  ].filter(Boolean)

  return candidates.find((candidate) => candidate) || ''
}

function run(command, args, cwd, env = process.env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'))
console.log(`Building ForgeDesk Android shell v${packageJson.version}`)

await run(resolve(projectRoot, 'node_modules/.bin/electron-vite'), ['build'], projectRoot)
await rm(androidAssets, { recursive: true, force: true })
await mkdir(androidAssets, { recursive: true })
await cp(rendererOutput, androidAssets, { recursive: true })

const gradleCommand = process.env.FORGEDESK_GRADLE_CMD || (process.platform === 'win32' ? 'gradlew.bat' : './gradlew')
const androidSdk = resolveAndroidSdk()
const gradleEnvironment = {
  ...process.env,
  ...(androidSdk
    ? {
        ANDROID_HOME: process.env.ANDROID_HOME || androidSdk,
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || androidSdk
      }
    : {}),
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || resolve(androidRoot, '.gradle-home')
}
await run(gradleCommand, ['assembleDebug'], androidRoot, gradleEnvironment)

console.log(`APK ready at ${resolve(androidRoot, 'app/build/outputs/apk/debug/app-debug.apk')}`)
