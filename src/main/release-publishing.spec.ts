import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createReleasePlan,
  createReleaseTagName,
  createReleaseVersionRecommendation,
  incrementReleaseVersion,
  selectReleaseScript
} from './release-publishing.js'

describe('release publishing planning', () => {
  it('bumps semantic versions for release suggestions', () => {
    assert.equal(incrementReleaseVersion('1.0.2', 'patch'), '1.0.3')
    assert.equal(incrementReleaseVersion('1.0.2', 'minor'), '1.1.0')
    assert.equal(incrementReleaseVersion('1.0.2', 'major'), '2.0.0')
    assert.throws(() => incrementReleaseVersion('1.0', 'patch'), /有效版本号/)
  })

  it('creates normalized release tag names', () => {
    assert.equal(createReleaseTagName('1.0.3'), 'v1.0.3')
    assert.throws(() => createReleaseTagName('v1.0.3'), /有效版本号/)
  })

  it('recommends the next patch tag from package version and historical release tags', () => {
    const recommendation = createReleaseVersionRecommendation({
      currentVersion: '1.0.2',
      tagNames: ['v1.0.4', 'v1.0.3', 'v1.0.0', '1.0.2', '1.0.1', 'feature-preview']
    })

    assert.equal(recommendation.suggestedVersion, '1.0.5')
    assert.equal(recommendation.suggestedTagName, 'v1.0.5')
    assert.deepEqual(recommendation.historicalTags.map((tag) => tag.tagName), ['v1.0.4', 'v1.0.3', '1.0.2', '1.0.1', 'v1.0.0'])
  })

  it('uses a higher package version when it is ahead of release tags', () => {
    const recommendation = createReleaseVersionRecommendation({
      currentVersion: '1.2.0',
      tagNames: ['v1.1.9', 'v1.1.8']
    })

    assert.equal(recommendation.suggestedVersion, '1.2.1')
    assert.equal(recommendation.suggestedTagName, 'v1.2.1')
  })

  it('prefers the repository mac publish script over generic packaging scripts', () => {
    assert.equal(selectReleaseScript({ build: 'vite build', 'package:mac': 'electron-builder --mac', 'publish:mac': 'node scripts/publish-mac.mjs' }), 'publish:mac')
    assert.equal(selectReleaseScript({ build: 'vite build', 'package:mac': 'electron-builder --mac' }), 'package:mac')
    assert.equal(selectReleaseScript({ build: 'vite build' }), 'build')
    assert.equal(selectReleaseScript({ test: 'node --test' }), '')
  })

  it('suggests the next patch version when the current remote tag belongs to another commit', () => {
    const plan = createReleasePlan({
      repositoryName: 'ForgeDesk',
      currentVersion: '1.0.2',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 0,
      localTagCommit: '',
      remoteTagCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      scripts: { 'publish:mac': 'node scripts/publish-mac.mjs' }
    })

    assert.equal(plan.currentVersion, '1.0.2')
    assert.equal(plan.suggestedVersion, '1.0.3')
    assert.equal(plan.suggestedTagName, 'v1.0.3')
    assert.equal(plan.needsVersionBump, true)
    assert.match(plan.issues.join('\n'), /远端 v1\.0\.2 已存在/)
    assert.equal(plan.canPublish, false)
  })

  it('requires a clean workspace and a release-capable script', () => {
    const dirty = createReleasePlan({
      repositoryName: 'ForgeDesk',
      currentVersion: '1.0.3',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 2,
      localTagCommit: '',
      remoteTagCommit: '',
      scripts: { 'publish:mac': 'node scripts/publish-mac.mjs' }
    })
    const noScript = createReleasePlan({
      repositoryName: 'ForgeDesk',
      currentVersion: '1.0.3',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 0,
      localTagCommit: '',
      remoteTagCommit: '',
      scripts: {}
    })

    assert.match(dirty.issues.join('\n'), /工作区还有 2 个未提交改动/)
    assert.deepEqual(dirty.availableActions.map((action) => action.key), ['commit-workspace-changes'])
    assert.match(noScript.issues.join('\n'), /没有找到可用于发布的脚本/)
    assert.equal(dirty.canPublish, false)
    assert.equal(noScript.canPublish, false)
  })

  it('allows Codemagic release plans without a local publish script', () => {
    const plan = createReleasePlan({
      repositoryName: 'Mobile',
      currentVersion: '2.0.0',
      provider: 'codemagic',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 0,
      localTagCommit: '',
      remoteTagCommit: '',
      scripts: {}
    })

    assert.equal(plan.provider, 'codemagic')
    assert.equal(plan.canPublish, true)
    assert.equal(plan.selectedScript, '')
    assert.match(plan.warnings.join('\n'), /Codemagic/)
  })

  it('uses the build script for Next.js PM2 release plans', () => {
    const plan = createReleasePlan({
      repositoryName: 'Portal',
      currentVersion: '1.4.0',
      provider: 'nextjs-pm2',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 0,
      localTagCommit: '',
      remoteTagCommit: '',
      scripts: { build: 'next build' }
    })

    assert.equal(plan.provider, 'nextjs-pm2')
    assert.equal(plan.selectedScript, 'build')
    assert.equal(plan.canPublish, true)
    assert.match(plan.warnings.join('\n'), /PM2/)
  })

  it('requires a build script for Next.js PM2 release plans', () => {
    const plan = createReleasePlan({
      repositoryName: 'Portal',
      currentVersion: '1.4.0',
      provider: 'nextjs-pm2',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 0,
      localTagCommit: '',
      remoteTagCommit: '',
      scripts: { start: 'next start' }
    })

    assert.equal(plan.canPublish, false)
    assert.match(plan.issues.join('\n'), /配置 build/)
  })

  it('offers publish-time handling for dirty workspaces and stale local tags', () => {
    const plan = createReleasePlan({
      repositoryName: 'ForgeDesk',
      currentVersion: '1.0.3',
      targetVersion: '1.0.3',
      headCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      statusFileCount: 19,
      localTagCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      remoteTagCommit: '',
      scripts: { 'publish:mac': 'node scripts/publish-mac.mjs' }
    })

    assert.equal(plan.canPublish, false)
    assert.deepEqual(
      plan.availableActions.map((action) => action.key),
      ['commit-workspace-changes', 'replace-local-tag']
    )
    assert.match(plan.availableActions[0]?.label ?? '', /提交当前工作区改动/)
    assert.match(plan.availableActions[1]?.label ?? '', /重建本地 v1\.0\.3/)
  })
})
