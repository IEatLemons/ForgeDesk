import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createReleasePublishViewModel } from './release-publish-view.js'

describe('release publish view model', () => {
  it('enables publishing only when checks are clean and a token is present', () => {
    const view = createReleasePublishViewModel({
      plan: {
        repositoryName: 'ForgeDesk',
        currentVersion: '1.0.2',
        suggestedVersion: '1.0.3',
        suggestedTagName: 'v1.0.3',
        selectedScript: 'publish:mac',
        needsVersionBump: true,
        canPublish: true,
        issues: [],
        warnings: ['会先写入 package.json 版本号'],
        documentationSources: ['README.md']
      },
      githubToken: 'github_pat_123'
    })

    assert.equal(view.primaryLabel, '发布 v1.0.3')
    assert.equal(view.primaryDisabled, false)
    assert.equal(view.issueCount, 0)
    assert.equal(view.warningCount, 1)
  })

  it('blocks publishing when release checks fail', () => {
    const view = createReleasePublishViewModel({
      plan: {
        repositoryName: 'ForgeDesk',
        currentVersion: '1.0.2',
        suggestedVersion: '1.0.3',
        suggestedTagName: 'v1.0.3',
        selectedScript: 'publish:mac',
        needsVersionBump: true,
        canPublish: false,
        issues: ['远端 v1.0.2 已存在'],
        warnings: [],
        documentationSources: []
      },
      githubToken: 'github_pat_123'
    })

    assert.equal(view.primaryLabel, '先处理 1 个问题')
    assert.equal(view.primaryDisabled, true)
    assert.equal(view.issueCount, 1)
  })

  it('requires a GitHub token for GitHub release publishing', () => {
    const view = createReleasePublishViewModel({
      plan: {
        repositoryName: 'ForgeDesk',
        currentVersion: '1.0.2',
        suggestedVersion: '1.0.3',
        suggestedTagName: 'v1.0.3',
        selectedScript: 'publish:mac',
        needsVersionBump: true,
        canPublish: true,
        issues: [],
        warnings: [],
        documentationSources: []
      },
      githubToken: ''
    })

    assert.equal(view.primaryLabel, '填写 GitHub Token')
    assert.equal(view.primaryDisabled, true)
  })
})
