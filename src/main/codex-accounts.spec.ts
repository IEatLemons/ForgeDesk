import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { activateCodexAccount, importCodexAccount, listCodexAccounts, readCodexAccountInfo, removeCodexAccount } from './codex-accounts.js'

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: string): string => Buffer.from(value).toString('base64url')
  return `${encode('{"alg":"none"}')}.${encode(JSON.stringify(payload))}.signature`
}

describe('codex account reader', () => {
  it('reads safe account metadata without returning token values', async () => {
    const homeDirectory = join(tmpdir(), `forgedesk-codex-account-${Date.now()}`)
    await mkdir(join(homeDirectory, '.codex'), { recursive: true })

    try {
      await writeFile(join(homeDirectory, '.codex', 'auth.json'), JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: {
          access_token: jwt({
            email: 'user@example.com',
            account_id: 'account-123456789',
            'https://api.openai.com/auth': { chatgpt_plan_type: 'plus' }
          }),
          refresh_token: 'refresh-secret'
        }
      }))

      const account = await readCodexAccountInfo(homeDirectory)

      assert.equal(account.available, true)
      assert.equal(account.authMode, 'chatgpt')
      assert.equal(account.email, 'user@example.com')
      assert.equal(account.planType, 'plus')
      assert.equal(account.accountIdSuffix, '…23456789')
      assert.equal(account.accessTokenConfigured, true)
      assert.equal(account.refreshTokenConfigured, true)
      assert.equal('refresh-secret' in account, false)
    } finally {
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  it('reports a missing local login file safely', async () => {
    const account = await readCodexAccountInfo(join(tmpdir(), `forgedesk-missing-codex-${Date.now()}`))

    assert.equal(account.available, false)
    assert.match(account.message, /未找到本机 Codex 登录文件/)
  })

  it('manages isolated profiles without exposing token values', async () => {
    const homeDirectory = join(tmpdir(), `forgedesk-codex-managed-home-${Date.now()}`)
    const userDataPath = join(tmpdir(), `forgedesk-codex-managed-data-${Date.now()}`)
    const sourceHome = join(tmpdir(), `forgedesk-codex-source-${Date.now()}`)
    const previousCodexHome = process.env.CODEX_HOME
    delete process.env.CODEX_HOME
    await mkdir(join(sourceHome, '.codex'), { recursive: true })

    try {
      await writeFile(join(sourceHome, '.codex', 'auth.json'), JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: {
          access_token: jwt({ email: 'managed@example.com', account_id: 'managed-account-123456' }),
          refresh_token: 'managed-refresh-secret'
        }
      }))

      const initial = await listCodexAccounts(userDataPath, homeDirectory)
      assert.equal(initial.activeAccountId, 'local')
      assert.equal(initial.accounts.length, 1)

      const imported = await importCodexAccount(userDataPath, {
        name: '工作账户',
        sourcePath: join(sourceHome, '.codex', 'auth.json')
      }, homeDirectory)
      const managed = imported.accounts.find((account) => account.name === '工作账户')
      assert.ok(managed)
      assert.equal(managed?.email, 'managed@example.com')
      assert.equal(managed?.active, false)
      assert.equal('refreshToken' in (managed ?? {}), false)

      const activated = await activateCodexAccount(userDataPath, managed?.id ?? '', homeDirectory)
      assert.equal(activated.activeAccountId, managed?.id)
      assert.equal(process.env.CODEX_HOME, managed?.codexHome)

      const removed = await removeCodexAccount(userDataPath, managed?.id ?? '', homeDirectory)
      assert.equal(removed.activeAccountId, 'local')
      assert.equal(removed.accounts.length, 1)
    } finally {
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME
      else process.env.CODEX_HOME = previousCodexHome
      await rm(homeDirectory, { recursive: true, force: true })
      await rm(userDataPath, { recursive: true, force: true })
      await rm(sourceHome, { recursive: true, force: true })
    }
  })

  it('imports a single-account export by its content instead of its file name', async () => {
    const homeDirectory = join(tmpdir(), `forgedesk-codex-import-home-${Date.now()}`)
    const userDataPath = join(tmpdir(), `forgedesk-codex-import-data-${Date.now()}`)
    const exportPath = join(tmpdir(), `forgedesk-account-export-${Date.now()}.json`)
    const accessToken = jwt({ email: 'exported@example.com', account_id: 'exported-account-123456' })

    try {
      await writeFile(exportPath, JSON.stringify([{
        account_id: 'exported-account-123456',
        access_token: accessToken,
        email: 'exported@example.com',
        id_token: jwt({ email: 'exported@example.com' }),
        last_refresh: '2026-08-07T00:00:00.000Z',
        refresh_token: 'exported-refresh-secret'
      }]))

      const imported = await importCodexAccount(userDataPath, { name: '导出账户', sourcePath: exportPath }, homeDirectory)
      const account = imported.accounts.find((item) => item.name === '导出账户')
      assert.ok(account)
      assert.equal(account?.available, true)
      assert.equal(account?.email, 'exported@example.com')

      const storedAuth = JSON.parse(await readFile(join(account?.codexHome ?? '', 'auth.json'), 'utf8'))
      assert.equal(Array.isArray(storedAuth), false)
      assert.equal(storedAuth.tokens.access_token, accessToken)
      assert.equal(storedAuth.tokens.refresh_token, 'exported-refresh-secret')
    } finally {
      await rm(homeDirectory, { recursive: true, force: true })
      await rm(userDataPath, { recursive: true, force: true })
      await rm(exportPath, { force: true })
    }
  })
})
