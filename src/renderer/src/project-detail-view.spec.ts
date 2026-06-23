import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRepositorySummaryFields, PROJECT_DETAIL_TABS, shouldShowRepositorySummary, type ProjectDetailTabKey } from './project-detail-view.js'

const repository = {
  currentBranch: 'main',
  latestCommit: 'ad70531 chore: bump ios build',
  localPath: '/Users/stone/Dev/uka',
  name: 'uka'
}

describe('project detail view helpers', () => {
  it('keeps the repository summary visible across all project detail tabs', () => {
    const tabs: ProjectDetailTabKey[] = ['data', 'log-tree', 'remote-alignment', 'service-monitor']

    assert.deepEqual(
      tabs.map((tab) => shouldShowRepositorySummary(tab, true)),
      [true, true, true, false]
    )
    assert.equal(shouldShowRepositorySummary('data', false), false)
  })

  it('places service monitoring after multi-remote alignment', () => {
    assert.deepEqual(
      PROJECT_DETAIL_TABS.map((tab) => tab.key),
      ['data', 'log-tree', 'remote-alignment', 'service-monitor']
    )
  })

  it('omits duplicate repository name and local path fields from the summary strip', () => {
    const fields = createRepositorySummaryFields(repository, 1137)

    assert.deepEqual(
      fields.map((field) => field.label),
      ['当前分支', '最近提交', '提交总数']
    )
    assert.equal(fields.some((field) => field.value === repository.localPath), false)
    assert.equal(fields.some((field) => field.value === repository.name), false)
  })
})
