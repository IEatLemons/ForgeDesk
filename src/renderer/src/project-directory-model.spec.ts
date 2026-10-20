import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildProjectDirectoryRows, DirectoryRefreshQueue } from './project-directory-model.js'
import type { Project, Repository } from './data'

const project = (id: string): Project => ({ id, name: id, workspacePath: `/tmp/${id}`, description: '', status: 'ready', owner: '', createdAt: '', isFavorite: false })
const repository = (id: string, projectId: string, extra: Partial<Repository> = {}): Repository => ({ id, projectId, localPath: `/tmp/${projectId}`, name: id, repositoryKind: 'root', parentRepositoryId: '', relativePath: '.', available: true, currentBranch: 'main', hasChanges: false, ahead: 0, pushTargets: [], remotes: [], ...extra } as Repository)
const tick = () => new Promise(resolve => setImmediate(resolve))

describe('project directory row models', () => {
  it('indexes ownership once and keeps unaffected rows stable', () => {
    const projects = [project('a'), project('b')], repos = [repository('ra', 'a'), repository('rb', 'b')]
    const old = buildProjectDirectoryRows(projects, repos)
    const same = buildProjectDirectoryRows(projects, repos, old)
    assert.equal(same[0], old[0]); assert.equal(same[1], old[1])
    const changed = buildProjectDirectoryRows(projects, [{ ...repos[0], hasChanges: true }, repos[1]], old)
    assert.equal(changed[0].changed, 1); assert.equal(changed[1], old[1])
  })
  it('does not include another project merely because its path is nested', () => {
    const rows = buildProjectDirectoryRows([project('a')], [repository('other', 'b', { localPath: '/tmp/a/other' })])
    assert.equal(rows[0].repositories.length, 0)
  })
  it('counts pushability per repository, not per branch or remote', () => {
    const row = buildProjectDirectoryRows([project('a')], [repository('ra', 'a', { pushTargets: [{ remote: 'x', branch: 'main', ahead: 2, hasRemoteBranch: true }, { remote: 'y', branch: 'feat', ahead: 1, hasRemoteBranch: true }] })])[0]
    assert.equal(row.pushable, 1)
  })
  it('retains synthesized nested hierarchy and unavailable records', () => {
    const root = repository('r', 'a'), nested = repository('n', 'a', { localPath: '/tmp/a/n', available: false })
    const old = buildProjectDirectoryRows([project('a')], [root, nested])
    assert.equal(old[0].stats.subprojects, 1); assert.equal(old[0].stats.unavailable, 1)
    assert.equal(buildProjectDirectoryRows([old[0].project], [root, nested], old)[0], old[0])
  })
  it('keeps 100 projects / 300 repositories stable during unrelated updates', () => {
    const projects = Array.from({ length: 100 }, (_, i) => project(String(i)))
    const repos = projects.flatMap(item => Array.from({ length: 3 }, (_, i) => repository(`${item.id}-${i}`, item.id)))
    const old = buildProjectDirectoryRows(projects, repos)
    const next = buildProjectDirectoryRows(projects, [{ ...repos[0], ahead: 1 }, ...repos.slice(1)], old)
    assert.equal(next.filter((row, i) => row === old[i]).length, 99)
    assert.equal(next.reduce((sum, row) => sum + row.repositories.length, 0), 300)
  })
})

describe('visible directory read queue', () => {
  it('limits concurrency to two, deduplicates and drops hidden queued reads', async () => {
    const started: string[] = [], pending = new Map<string, (value: string) => void>()
    const queue = new DirectoryRefreshQueue(id => { started.push(id); return new Promise<string>(resolve => pending.set(id, resolve)) }, () => {})
    queue.setVisible(['a', 'b', 'c']); queue.refresh(); queue.refresh(true); await tick()
    assert.deepEqual(started, ['a', 'b'])
    queue.setVisible([]); pending.get('a')!('a'); pending.get('b')!('b'); await tick()
    assert.deepEqual(started, ['a', 'b'])
  })
  it('refreshes only stale data and force refresh never duplicates an in-flight read', async () => {
    let time = 100_000, reads = 0
    const queue = new DirectoryRefreshQueue(async () => ++reads, () => {}, () => time)
    queue.setVisible(['a']); queue.refresh(); queue.refresh(true); await tick()
    assert.equal(reads, 1); assert.equal(queue.getSnapshot().a.checkedAt, time)
    time += 29_999; queue.refresh(); await tick(); assert.equal(reads, 1)
    time++; queue.refresh(); await tick(); assert.equal(reads, 2)
    queue.refresh(true); await tick(); assert.equal(reads, 3)
  })
  it('keeps last success and error separate when a check fails', async () => {
    let fail = false
    const queue = new DirectoryRefreshQueue(async () => { if (fail) throw new Error('denied'); return 1 }, () => {}, () => 50_000)
    queue.setVisible(['a']); queue.refresh(); await tick(); fail = true; queue.refresh(true); await tick()
    assert.equal(queue.getSnapshot().a.state, 'error'); assert.equal(queue.getSnapshot().a.checkedAt, 50_000)
    assert.equal(queue.getSnapshot().a.error, 'denied')
  })
  it('does not mark a rejected late result as a new successful check', async () => {
    const queue = new DirectoryRefreshQueue(async () => 1, () => false, () => 50_000)
    queue.setVisible(['a']); queue.refresh(); await tick()
    assert.equal(queue.getSnapshot().a.checkedAt, undefined); assert.equal(queue.getSnapshot().a.attemptedAt, 0)
  })
  it('survives StrictMode effect cleanup without accepting disposed results', async () => {
    let accepted = 0
    const queue = new DirectoryRefreshQueue(async () => 1, () => { accepted++ })
    queue.setVisible(['a']); queue.refresh(); queue.dispose(); await tick(); assert.equal(accepted, 0)
    queue.resume(); queue.setVisible(['b']); queue.refresh(); await tick(); assert.equal(accepted, 1)
  })
})
