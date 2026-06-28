import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  chooseTerminalShortcutProject,
  createProjectDetailTabs,
  createProjectTerminalOpenRequest,
  createRepositorySummaryFields,
  createRepositoryTerminalOpenRequest,
  PROJECT_DETAIL_TABS,
  resolveProjectDetailTab,
  shouldShowRepositorySummary,
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

describe('project detail view helpers', () => {
  it('keeps the repository summary visible across all project detail tabs', () => {
    const tabs: ProjectDetailTabKey[] = ['data', 'log-tree', 'remote-alignment', 'service-monitor', 'terminal']

    assert.deepEqual(
      tabs.map((tab) => shouldShowRepositorySummary(tab, true)),
      [true, true, true, true, true]
    )
    assert.equal(shouldShowRepositorySummary('data', false), false)
  })

  it('places the terminal tab after service monitoring', () => {
    assert.deepEqual(
      PROJECT_DETAIL_TABS.map((tab) => tab.key),
      ['data', 'log-tree', 'remote-alignment', 'service-monitor', 'terminal']
    )
  })

  it('shows service monitoring only after the project has bound services', () => {
    assert.deepEqual(
      createProjectDetailTabs(false).map((tab) => tab.key),
      ['data', 'log-tree', 'remote-alignment', 'terminal']
    )

    assert.deepEqual(
      createProjectDetailTabs(true).map((tab) => tab.key),
      ['data', 'log-tree', 'remote-alignment', 'service-monitor', 'terminal']
    )
  })

  it('moves away from service monitoring when the project has no bound services', () => {
    assert.equal(resolveProjectDetailTab('service-monitor', false), 'data')
    assert.equal(resolveProjectDetailTab('service-monitor', true), 'service-monitor')
    assert.equal(resolveProjectDetailTab('terminal', false), 'terminal')
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
