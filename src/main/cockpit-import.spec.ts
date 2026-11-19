import assert from 'node:assert/strict'
import { createCipheriv, randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { importCockpitData, previewCockpitImport } from './cockpit-import.js'
import { listCodexAccounts } from './codex-accounts.js'
import { getCodexApiService, getCodexApiServiceIntegrationSettings, saveCodexApiServiceSettings } from './codex-api-service.js'

async function fixture(run: (root: string, source: string, data: string, home: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'forgedesk-cockpit-import-'))
  try {
    const source = join(root, 'source'), data = join(root, 'forgedesk'), home = join(root, 'home')
    await mkdir(join(source, 'codex_accounts'), { recursive: true })
    await mkdir(data, { recursive: true })
    await writeFile(join(data, 'codex-accounts.json'), JSON.stringify({ activeAccountId: 'local', accounts: [{ id: 'local', name: 'Isolated local', source: 'local', codexHome: join(home, '.codex') }] }))
    await run(root, source, data, home)
  } finally { await rm(root, { recursive: true, force: true }) }
}
const account = (id = 'one') => ({ id, email: `${id}@example.test`, account_id: `team-${id}`, account_name: `Team ${id}`, plan_type: 'pro_200', account_note: 'Imported note', tags: ['work'], subscription_active_until: '2026-12-01T10:00:00Z', tokens: { access_token: `access-secret-${id}`, refresh_token: `refresh-secret-${id}`, id_token: `id-secret-${id}` }, quota: { weekly_percentage: 99, hourly_percentage: 80, weekly_reset_time: 1795000000, reset_credits_available: 3 }, usage_updated_at: 1794000000 })

describe('Cockpit compatibility import', () => {
  it('previews and selectively imports legacy data without secrets, activation or source changes', async () => fixture(async (_root, source, data, home) => {
    const original = JSON.stringify(account())
    await writeFile(join(source, 'codex_accounts.json'), JSON.stringify({ current_account_id: 'one', accounts: [{ id: 'one', email: 'one@example.test' }, { id: 'two' }] }))
    await writeFile(join(source, 'codex_accounts/one.json'), original)
    await writeFile(join(source, 'codex_accounts/two.json'), JSON.stringify(account('two')))
    const preview = await previewCockpitImport(data, source, home)
    assert.equal(preview.accounts.length, 2)
    assert.equal(preview.accounts[0].current, true)
    assert.equal(JSON.stringify(preview).includes('secret'), false)
    assert.equal((await importCockpitData(data, { sourcePath: source, accountIds: ['one'] }, home)).imported, 1)
    const registry = await listCodexAccounts(data, home)
    assert.equal(registry.activeAccountId, 'local')
    assert.equal(registry.accounts.length, 2)
    const imported = registry.accounts.find(value => value.source === 'imported')!
    assert.equal(imported.cockpit?.teamName, 'Team one')
    assert.equal(imported.cockpit?.quota?.weeklyRemaining, 99)
    assert.equal(imported.cockpit?.quota?.resetCredits, 3)
    assert.equal(imported.planType, 'pro_200')
    assert.equal(imported.subscriptionRenewsAt, '', 'Observed expiration must not become a manual renewal date')
    assert.equal(JSON.stringify(registry).includes('access-secret'), false)
    const auth = JSON.parse(await readFile(join(imported.codexHome, 'auth.json'), 'utf8'))
    assert.equal(auth.tokens.account_id, 'team-one')
    assert.equal(auth.tokens.refresh_token, 'refresh-secret-one')
    assert.equal((await stat(join(imported.codexHome, 'auth.json'))).mode & 0o777, 0o600)
    assert.equal(await readFile(join(source, 'codex_accounts/one.json'), 'utf8'), original)
    assert.equal((await importCockpitData(data, { sourcePath: source, accountIds: ['one'] }, home)).skipped, 1)
    assert.equal((await previewCockpitImport(data, source, home)).accounts[0].duplicate, true)
  }))

  it('reads AES-256-GCM account envelopes using the source key without rotating it', async () => fixture(async (_root, source, data, home) => {
    const key = randomBytes(32), nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(account()), 'utf8'), cipher.final(), cipher.getAuthTag()])
    await writeFile(join(source, 'secure-account-storage.key'), key.toString('base64'))
    await writeFile(join(source, 'codex_accounts.json'), JSON.stringify({ accounts: [{ id: 'one' }] }))
    await writeFile(join(source, 'codex_accounts/one.json'), JSON.stringify({ version: 1, kind: 'codex', algorithm: 'AES-256-GCM', nonce: nonce.toString('base64'), ciphertext: ciphertext.toString('base64') }))
    assert.equal((await previewCockpitImport(data, source, home)).accounts[0].email, 'one@example.test')
    assert.equal((await importCockpitData(data, { sourcePath: source, accountIds: ['one'] }, home)).imported, 1)
    assert.equal(await readFile(join(source, 'secure-account-storage.key'), 'utf8'), key.toString('base64'))
    await writeFile(join(source, 'secure-account-storage.key'), randomBytes(32).toString('base64'))
    const broken = await previewCockpitImport(data, source, home)
    assert.equal(broken.accounts[0].importable, false)
    assert.match(broken.accounts[0].error, /无法解密/)
  }))

  it('isolates broken and unsupported accounts and refuses path traversal', async () => fixture(async (_root, source, data, home) => {
    await writeFile(join(source, 'codex_accounts.json'), JSON.stringify({ accounts: [{ id: '../outside' }, { id: 'missing' }, { ...account(), api_provider_mode: 'custom', api_base_url: 'https://example.test' }, account('valid')] }))
    const preview = await previewCockpitImport(data, source, home)
    assert.deepEqual(preview.accounts.map(value => value.importable), [false, false, false, true])
    const result = await importCockpitData(data, { sourcePath: source, accountIds: preview.accounts.map(value => value.id) }, home)
    assert.equal(result.imported, 1)
    assert.equal(result.errors.length, 3)
    await assert.rejects(importCockpitData(data, { sourcePath: source, accountIds: ['changed'] }, home), /重新预览/)
  }))

  it('supports portable exports and keeps accounts with distinct team identities', async () => fixture(async (root, _source, data, home) => {
    const file = join(root, 'export.json')
    await writeFile(file, JSON.stringify([account(), { ...account('two'), email: 'one@example.test' }]))
    const preview = await previewCockpitImport(data, file, home)
    assert.equal(preview.api, null)
    const results = await Promise.all([1, 2].map(() => importCockpitData(data, { sourcePath: file, accountIds: ['one', 'two'] }, home)))
    assert.equal(results.reduce((sum, result) => sum + result.imported, 0), 2)
    assert.equal((await listCodexAccounts(data, home)).accounts.length, 3)
  }))

  it('imports API configuration only on request and keeps it stopped and loopback-only', async () => fixture(async (_root, source, data, home) => {
    await writeFile(join(source, 'codex_accounts.json'), JSON.stringify({ accounts: [] }))
    await writeFile(join(source, 'codex_local_access.json'), JSON.stringify({ port: 50549, apiKey: 'client-secret', enabled: true, accessScope: 'all', routingStrategy: 'round-robin' }))
    const preview = await previewCockpitImport(data, source, home)
    assert.deepEqual(preview.api, { port: 50549, keyConfigured: true })
    assert.ok(preview.warnings.length)
    assert.equal(JSON.stringify(preview).includes('client-secret'), false)
    await importCockpitData(data, { sourcePath: source, accountIds: [] }, home)
    assert.equal((await getCodexApiService(data)).port, 55914)
    const result = await importCockpitData(data, { sourcePath: source, accountIds: [], importApiSettings: true }, home)
    assert.equal(result.apiSettingsImported, true)
    const service = await getCodexApiService(data)
    assert.equal(service.host, '127.0.0.1'); assert.equal(service.port, 50549)
    assert.equal(service.enabled, false); assert.equal(service.running, false)
    assert.equal((await getCodexApiServiceIntegrationSettings(data)).apiKey, 'client-secret')
    await assert.rejects(saveCodexApiServiceSettings(data, { port: 70000 }), /端口/)
    await assert.rejects(saveCodexApiServiceSettings(data, { model: ' ' }), /模型/)
  }))

  it('never includes malformed JSON contents in error messages', async () => fixture(async (root, _source, data, home) => {
    const file = join(root, 'bad.json')
    await writeFile(file, '{ "access_token": "sensitive-fragment", broken')
    await assert.rejects(previewCockpitImport(data, file, home), error => error instanceof Error && !error.message.includes('sensitive-fragment'))
    await assert.rejects(importCockpitData(data, { sourcePath: file, accountIds: [] }, home), error => error instanceof Error && !error.message.includes('sensitive-fragment'))
  }))
})
