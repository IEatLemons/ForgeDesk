// Launch the actual built application with disposable business data and isolated AI credentials.
// No prototype server, API mocks, automatic migration of user data, or remote writes.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electron from 'electron'

const root = process.cwd()
const directory = await mkdtemp(join(tmpdir(), 'forgedesk-workspace-qa-'))
const profile = join(directory, 'profile'), codex = join(directory, 'isolated-codex')
await Promise.all([mkdir(profile), mkdir(codex)])
await writeFile(join(profile, 'codex-accounts.json'), JSON.stringify({ activeAccountId: 'local', accounts: [{ id:'local', name:'隔离验收（无登录凭据）', source:'local', codexHome:codex, createdAt:new Date().toISOString(), lastUsedAt:'' }] }), { mode: 0o600 })
console.log(`Workspace QA directory: ${directory}`)
const child = spawn(electron, [join(root, 'scripts/fixtures/workspace-smoke-main.mjs'), root, directory, ...process.argv.slice(2)], { stdio: 'inherit' })
process.once('SIGINT', () => child.kill('SIGTERM'))
process.once('SIGTERM', () => child.kill('SIGTERM'))
process.exitCode = await new Promise(resolve => { child.once('exit', code => resolve(code ?? 0)); child.once('error', error => { console.error(error); resolve(1) }) })
console.log(`Isolated QA data retained for inspection: ${directory}`)
