import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { CodexSiteService, migrateCodexSiteTables } from './codex-sites.js'

class FakePreviewProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill(): boolean { return true }
}

describe('codex sites service', () => {
  it('stores site drafts, starts a local preview, and keeps the published link', async () => {
    const database = new DatabaseSync(':memory:')
    migrateCodexSiteTables(database as any)
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-codex-site-'))
    const calls: Array<{ command: string; args: string[]; cwd: string }> = []

    try {
      await writeFile(join(directory, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
      const service = new CodexSiteService({
        db: () => database as any,
        findPort: async () => 4173,
        now: () => new Date('2026-07-30T08:00:00.000Z'),
        spawnPreview: (command, args, options) => {
          calls.push({ args, command, cwd: options.cwd })
          return new FakePreviewProcess() as never
        }
      })

      const created = service.create({ name: '项目站点', prompt: '做一个发布看板', workspacePath: directory, linkedSessionId: 'session-1' })
      assert.equal(created.status, 'draft')
      const previewing = await service.startPreview(created.id)
      assert.equal(previewing.status, 'previewing')
      assert.match(previewing.previewUrl, /^http:\/\/127\.0\.0\.1:\d+$/)
      assert.deepEqual(calls[0]?.args.slice(0, 4), ['run', 'dev', '--', '--host'])
      assert.equal(calls[0]?.cwd, directory)

      const published = service.update({ id: created.id, publishedUrl: 'https://example.com/site' })
      assert.equal(published.status, 'published')
      assert.equal(published.publishedUrl, 'https://example.com/site')
      assert.equal(service.list().length, 1)
      service.delete(created.id)
      assert.equal(service.list().length, 0)
    } finally {
      database.close()
      await rm(directory, { force: true, recursive: true })
    }
  })
})
