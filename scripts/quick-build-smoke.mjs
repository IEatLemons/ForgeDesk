// Exercise the real UI, preload and main process with an isolated profile.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electron from 'electron'
import { readJson } from './quick-build-utils.mjs'

const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), 'forgedesk-quick-build-qa-'))
const profile = join(directory, 'profile'), codex = join(directory, 'isolated-codex')
await Promise.all([mkdir(profile), mkdir(codex)])
await writeFile(join(profile, 'codex-accounts.json'), JSON.stringify({ activeAccountId: 'local', accounts: [{ id: 'local', name: '隔离构建验收', source: 'local', codexHome: codex, createdAt: new Date().toISOString(), lastUsedAt: '' }] }), { mode: 0o600 })
const latest = readJson(join(root, '.cache/quick-build/v1', `latest-${process.arch}.json`))
if (!latest?.artifactPath) throw new Error('请先运行 build:quick 生成待验收应用')
console.log(`QUICK_BUILD_QA_DIRECTORY ${directory}`)
const child = spawn(electron, [join(root, 'scripts/fixtures/quick-build-smoke-main.mjs'), root, directory, latest.artifactPath], { stdio: 'inherit', env: { ...process.env, FORGEDESK_PROJECT_ROOT: root } })
process.once('SIGINT', () => child.kill('SIGTERM'))
process.once('SIGTERM', () => child.kill('SIGTERM'))
process.exitCode = await new Promise(resolve => { child.once('exit', code => resolve(code ?? 1)); child.once('error', error => { console.error(error); resolve(1) }) })
