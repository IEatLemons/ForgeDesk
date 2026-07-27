import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getProjectRepositoryStats,
  getNestedProjectRepositories,
  getRepositoryDisplayLabel,
  getRepositoryStateMeta,
  sortRepositoriesHierarchically
} from './repository-hierarchy.js'

const repositories = [
  {
    id: '/workspace/root',
    name: 'Root',
    repositoryKind: 'root' as const,
    parentRepositoryId: '',
    relativePath: '.',
    submoduleState: 'unknown' as const,
    available: true,
    isDetached: false
  },
  {
    id: '/workspace/root/CardPIE',
    name: 'CardPIE',
    repositoryKind: 'submodule' as const,
    parentRepositoryId: '/workspace/root',
    relativePath: 'CardPIE',
    submoduleState: 'aligned' as const,
    available: true,
    isDetached: true
  },
  {
    id: '/workspace/root/CardPIE/Nested',
    name: 'Nested',
    repositoryKind: 'submodule' as const,
    parentRepositoryId: '/workspace/root/CardPIE',
    relativePath: 'CardPIE/Nested',
    submoduleState: 'changed' as const,
    available: true,
    isDetached: false
  }
]

describe('repository hierarchy helpers', () => {
  it('orders repositories by parent before child', () => {
    const ordered = sortRepositoriesHierarchically([...repositories].reverse())

    assert.deepEqual(ordered.map((item) => `${item.depth}:${item.repository.name}`), ['0:Root', '1:CardPIE', '2:Nested'])
    assert.equal(getRepositoryDisplayLabel(repositories[1], 1), '　↳ CardPIE（子模块 · CardPIE）')
  })

  it('summarizes submodule counts and status labels', () => {
    assert.deepEqual(getProjectRepositoryStats(repositories), { total: 3, roots: 1, subprojects: 0, submodules: 2, unavailable: 0 })
    assert.deepEqual(getRepositoryStateMeta(repositories[1]), { label: '已对齐', color: 'green' })
    assert.deepEqual(getRepositoryStateMeta({ ...repositories[1], submoduleState: 'changed' }), { label: '提交不一致', color: 'orange' })
    assert.deepEqual(getRepositoryStateMeta({ ...repositories[1], available: false, submoduleState: 'uninitialized' }), { label: '未初始化', color: 'red' })
  })

  it('labels nested repositories as subprojects', () => {
    const nested = { ...repositories[0], id: '/workspace/root/apps/web', name: 'web', parentRepositoryId: repositories[0].id, relativePath: 'apps/web' }
    const ordered = sortRepositoriesHierarchically([nested, repositories[0]])

    assert.equal(getRepositoryDisplayLabel(nested, ordered[1]?.depth), '　↳ web（子项目 · apps/web）')
    assert.deepEqual(getProjectRepositoryStats([repositories[0], nested]), { total: 2, roots: 1, subprojects: 1, submodules: 0, unavailable: 0 })
  })

  it('returns all nested repositories, including Git submodules', () => {
    const nested = { ...repositories[0], id: '/workspace/root/apps/web', name: 'web', parentRepositoryId: repositories[0].id, relativePath: 'apps/web' }
    const nestedChild = { ...repositories[0], id: '/workspace/root/apps/web/admin', name: 'admin', parentRepositoryId: nested.id, relativePath: 'apps/web/admin' }
    const nestedSubmodule = { ...repositories[1], id: '/workspace/root/CardPIE', name: 'CardPIE', parentRepositoryId: repositories[0].id, relativePath: 'CardPIE' }

    assert.deepEqual(
      getNestedProjectRepositories([nestedSubmodule, nestedChild, nested, repositories[0]]).map((item) => ({
        name: item.repository.name,
        depth: item.depth,
        kind: item.repository.repositoryKind
      })),
      [
        { name: 'web', depth: 1, kind: 'root' },
        { name: 'admin', depth: 2, kind: 'root' },
        { name: 'CardPIE', depth: 1, kind: 'submodule' }
      ]
    )
  })
})
