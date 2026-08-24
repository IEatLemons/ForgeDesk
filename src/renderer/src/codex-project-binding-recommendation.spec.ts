import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCodexBindingRecommendations } from './codex-project-binding-recommendation.js'
import type { CodexProjectMonitorItem } from './data.js'

function codexProject(cwd: string, linkSource: CodexProjectMonitorItem['linkSource'] = 'unlinked'): CodexProjectMonitorItem {
  return {
    completedCount: 0,
    cwd,
    failedCount: 0,
    forgeProjectId: null,
    forgeProjectName: '',
    git: { additions: 0, branch: '', checkedAt: '', cwd, deletions: 0, filesChanged: 0, hasChanges: false, repositoryAvailable: false, repositoryRoot: '' },
    groupId: null,
    groupName: '',
    key: cwd,
    linkSource,
    openAlert: null,
    regularSessionIds: [],
    regularTaskIds: [],
    runningCount: 0,
    sessionCount: 0,
    sessions: [],
    status: 'clean',
    tasks: [],
    worktrees: []
  }
}

describe('Codex project binding recommendations', () => {
  it('recommends an unlinked Codex directory with the same project directory name', () => {
    const recommendations = getCodexBindingRecommendations(
      { name: 'Omni', workspacePath: '/Users/stone/develop/project/UCard/OmniVault' },
      [codexProject('/Users/stone/develop/project/CardPIE/OmniVault')]
    )

    assert.deepEqual(recommendations, [{
      cwd: '/Users/stone/develop/project/CardPIE/OmniVault',
      reason: '项目目录名“OmniVault”一致',
      score: 90
    }])
  })

  it('does not recommend a directory already linked to another project', () => {
    const recommendations = getCodexBindingRecommendations(
      { name: 'Omni', workspacePath: '/Users/stone/develop/project/UCard/OmniVault' },
      [codexProject('/Users/stone/develop/project/CardPIE/OmniVault', 'manual')]
    )

    assert.deepEqual(recommendations, [])
  })
})
