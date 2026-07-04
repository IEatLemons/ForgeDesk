import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  chooseTerminalShortcutProject,
  createProjectDetailTabs,
  createProjectTerminalOpenRequest,
  createRepositorySummaryFields,
  createRepositoryTerminalOpenRequest,
  getRepositoryRemoteCount,
  hasProjectRemoteAlignment,
  PROJECT_DETAIL_TABS,
  resolveProjectDetailTab,
  shouldShowRepositorySummary,
  type ProjectDetailTabAvailability,
  type ProjectDetailTabKey
} from './project-detail-view.js'

const repository = {
  currentBranch: 'main',
  id: 'repo-1',
  latestCommit: 'ad70531 chore: bump ios build',
  localPath: '/Users/stone/Dev/uka',
  name: 'uka',
  projectId: 'project-1'
}

const projects = [
  {
    id: 'project-1',
    name: 'ForgeDesk',
    workspacePath: '/Users/stone/Dev/ForgeDesk'
  },
  {
    id: 'project-2',
    name: 'CardPIE',
    workspacePath: '/Users/stone/Dev/CardPIE'
  }
]

const repositorySummary = {
  currentBranch: repository.currentBranch,
  latestCommit: repository.latestCommit,
  localPath: repository.localPath,
  name: repository.name
}

const allProjectDetailFeatures: ProjectDetailTabAvailability = {
  hasBoundServices: true,
  hasRemoteAlignment: true,
  hasPlane: true
}

describe('project detail view helpers', () => {
  it('keeps the repository summary visible across all project detail tabs', () => {
    const tabs: ProjectDetailTabKey[] = ['data', 'log-tree', 'remote-alignment', 'plane', 'service-monitor', 'terminal']

    assert.deepEqual(
      tabs.map((tab) => shouldShowRepositorySummary(tab, true)),
      [true, true, true, true, true, true]
    )
    assert.equal(shouldShowRepositorySummary('data', false), false)
  })

  it('orders project detail tabs around the branch tree workflow', () => {
    assert.deepEqual(
      PROJECT_DETAIL_TABS.map((tab) => tab.key),
      ['log-tree', 'data', 'terminal', 'remote-alignment', 'plane', 'service-monitor']
    )

    assert.equal(PROJECT_DETAIL_TABS[0]?.key, 'log-tree')
  })

  it('shows service monitoring only after the project has bound services', () => {
    assert.deepEqual(
      createProjectDetailTabs({
        ...allProjectDetailFeatures,
        hasBoundServices: false
      }).map((tab) => tab.key),
      ['log-tree', 'data', 'terminal', 'remote-alignment', 'plane']
    )

    assert.deepEqual(
      createProjectDetailTabs(allProjectDetailFeatures).map((tab) => tab.key),
      ['log-tree', 'data', 'terminal', 'remote-alignment', 'plane', 'service-monitor']
    )
  })

  it('shows feature tabs only when their backing configuration is available', () => {
    assert.deepEqual(
      createProjectDetailTabs({
        hasBoundServices: false,
        hasRemoteAlignment: false,
        hasPlane: false
      }).map((tab) => tab.key),
      ['log-tree', 'data', 'terminal']
    )

    assert.deepEqual(
      createProjectDetailTabs({
        hasBoundServices: false,
        hasRemoteAlignment: true,
        hasPlane: false
      }).map((tab) => tab.key),
      ['log-tree', 'data', 'terminal', 'remote-alignment']
    )
  })

  it('detects project remote alignment only when a repository has at least two remotes', () => {
    assert.equal(getRepositoryRemoteCount({ remoteUrl: 'git@github.com:IEatLemons/ForgeDesk.git' }), 1)
    assert.equal(getRepositoryRemoteCount({ remoteCount: 1, remotes: [{ name: 'origin' }, { name: 'backup' }] }), 2)
    assert.equal(hasProjectRemoteAlignment([{ remoteCount: 1 }, { remoteCount: 1 }]), false)
    assert.equal(hasProjectRemoteAlignment([{ remoteCount: 1 }, { remotes: [{ name: 'origin' }, { name: 'backup' }] }]), true)
  })

  it('moves away from unavailable project detail tabs', () => {
    assert.equal(resolveProjectDetailTab('service-monitor', { ...allProjectDetailFeatures, hasBoundServices: false }), 'log-tree')
    assert.equal(resolveProjectDetailTab('service-monitor', allProjectDetailFeatures), 'service-monitor')
    assert.equal(resolveProjectDetailTab('remote-alignment', { ...allProjectDetailFeatures, hasRemoteAlignment: false }), 'log-tree')
    assert.equal(resolveProjectDetailTab('plane', { ...allProjectDetailFeatures, hasPlane: false }), 'log-tree')
    assert.equal(resolveProjectDetailTab('terminal', { ...allProjectDetailFeatures, hasPlane: false, hasRemoteAlignment: false }), 'terminal')
  })

  it('omits duplicate repository name and local path fields from the summary strip', () => {
    const fields = createRepositorySummaryFields(repositorySummary, 1137)

    assert.deepEqual(
      fields.map((field) => field.label),
      ['当前分支', '最近提交', '提交总数']
    )
    assert.equal(fields.some((field) => field.value === repositorySummary.localPath), false)
    assert.equal(fields.some((field) => field.value === repositorySummary.name), false)
  })

  it('builds stable project and repository terminal requests', () => {
    assert.deepEqual(createProjectTerminalOpenRequest(projects[0]), {
      cwd: '/Users/stone/Dev/ForgeDesk',
      projectId: 'project-1',
      reuseKey: 'project:project-1',
      title: 'ForgeDesk'
    })
    assert.deepEqual(createRepositoryTerminalOpenRequest(repository), {
      cwd: '/Users/stone/Dev/uka',
      projectId: 'project-1',
      repositoryId: 'repo-1',
      reuseKey: 'repository:repo-1',
      title: 'uka'
    })
  })

  it('chooses the current project for the global terminal shortcut before falling back to the first project', () => {
    assert.equal(chooseTerminalShortcutProject(projects, 'project-2')?.id, 'project-2')
    assert.equal(chooseTerminalShortcutProject(projects, 'missing')?.id, 'project-1')
    assert.equal(chooseTerminalShortcutProject([], 'missing'), null)
  })
})
