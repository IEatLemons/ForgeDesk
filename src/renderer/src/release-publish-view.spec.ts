import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createReleasePlatformOptions, createReleasePublishTaskView, createReleasePublishViewModel } from './release-publish-view.js'

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
        availableActions: [],
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
        availableActions: [],
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
        availableActions: [],
        documentationSources: []
      },
      githubToken: ''
    })

    assert.equal(view.primaryLabel, '选择 GitHub Token')
    assert.equal(view.primaryDisabled, true)
  })

  it('shows GitHub Releases as the first integrated release platform', () => {
    const platforms = createReleasePlatformOptions({
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
        availableActions: [],
        documentationSources: []
      }
    })

    assert.equal(platforms[0]?.key, 'github')
    assert.equal(platforms[0]?.name, 'GitHub Releases')
    assert.equal(platforms[0]?.statusLabel, '已对接')
    assert.equal(platforms[0]?.disabled, false)
  })

  it('allows publishing when every release issue is selected for publish-time handling', () => {
    const plan = {
      repositoryName: 'ForgeDesk',
      currentVersion: '1.0.3',
      suggestedVersion: '1.0.3',
      suggestedTagName: 'v1.0.3',
      selectedScript: 'publish:mac' as const,
      needsVersionBump: false,
      canPublish: false,
      issues: ['工作区还有 19 个未提交改动，请先提交后再发布', '本地 v1.0.3 已存在，但不是当前提交。请确认版本号后再发布。'],
      warnings: [],
      availableActions: [
        {
          key: 'commit-workspace-changes' as const,
          issue: '工作区还有 19 个未提交改动，请先提交后再发布',
          label: '发布时提交当前工作区改动',
          description: '会先暂存全部改动，并用版本提交信息创建提交。'
        },
        {
          key: 'replace-local-tag' as const,
          issue: '本地 v1.0.3 已存在，但不是当前提交。请确认版本号后再发布。',
          label: '发布时重建本地 v1.0.3',
          description: '会先删除本地旧 tag，让发布脚本在当前提交上重新创建。'
        }
      ],
      documentationSources: []
    }

    const blocked = createReleasePublishViewModel({
      plan,
      githubToken: 'github_pat_123',
      selectedActions: []
    })
    const allowed = createReleasePublishViewModel({
      plan,
      githubToken: 'github_pat_123',
      selectedActions: ['commit-workspace-changes', 'replace-local-tag']
    })

    assert.equal(blocked.primaryLabel, '先处理 2 个问题')
    assert.equal(blocked.primaryDisabled, true)
    assert.equal(allowed.primaryLabel, '发布 v1.0.3')
    assert.equal(allowed.primaryDisabled, false)
  })

  it('summarizes background publish task status and logs', () => {
    const running = createReleasePublishTaskView({
      task: {
        repositoryName: 'ForgeDesk',
        tagName: 'v1.0.5',
        status: 'running',
        log: '[12:00:00] 执行发布脚本',
        stdout: '',
        stderr: '',
        exitCode: null
      }
    })
    const failed = createReleasePublishTaskView({
      task: {
        repositoryName: 'ForgeDesk',
        tagName: 'v1.0.5',
        status: 'failed',
        log: '',
        stdout: '',
        stderr: 'HTTP 401',
        exitCode: 1,
        error: 'GitHub Token 无效'
      }
    })

    assert.equal(running.title, 'ForgeDesk v1.0.5')
    assert.equal(running.statusLabel, '发布中')
    assert.equal(running.active, true)
    assert.match(running.log, /执行发布脚本/)
    assert.equal(failed.statusLabel, '失败')
    assert.match(failed.log, /HTTP 401/)
    assert.match(failed.log, /GitHub Token 无效/)
  })
})
