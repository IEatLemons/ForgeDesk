import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getProjectRepositoriesForDisplay, sortProjectsForDisplay } from './project-list-view.js'

const baseProject = {
  description: '',
  owner: '',
  status: 'ready' as const,
  workspacePath: '/tmp/project'
}

describe('project list view helpers', () => {
  it('places favorites before regular projects while keeping creation order within each group', () => {
    const projects = [
      { ...baseProject, id: 'regular-old', name: 'Regular old', createdAt: '2026-07-01T00:00:00.000Z', isFavorite: false },
      { ...baseProject, id: 'favorite-old', name: 'Favorite old', createdAt: '2026-07-01T00:00:00.000Z', isFavorite: true },
      { ...baseProject, id: 'regular-new', name: 'Regular new', createdAt: '2026-07-03T00:00:00.000Z', isFavorite: false },
      { ...baseProject, id: 'favorite-new', name: 'Favorite new', createdAt: '2026-07-03T00:00:00.000Z', isFavorite: true }
    ]

    assert.deepEqual(sortProjectsForDisplay(projects).map((project) => project.id), [
      'favorite-new',
      'favorite-old',
      'regular-new',
      'regular-old'
    ])
  })

  it('does not mutate the source project list', () => {
    const projects = [{ ...baseProject, id: 'project-a', name: 'Project A', createdAt: '2026-07-01T00:00:00.000Z', isFavorite: true }]

    assert.notEqual(sortProjectsForDisplay(projects), projects)
    assert.deepEqual(projects.map((project) => project.id), ['project-a'])
  })

  it('includes repositories physically nested under a project even when they were registered separately', () => {
    const project = { id: 'ucard', workspacePath: '/Users/stone/develop/project/UCard' }
    const repositories = [
      { id: project.workspacePath, projectId: project.id, localPath: project.workspacePath, parentRepositoryId: '', relativePath: '.' },
      { id: '/Users/stone/develop/project/UCard/CardPIE', projectId: project.id, localPath: '/Users/stone/develop/project/UCard/CardPIE', parentRepositoryId: project.workspacePath, relativePath: 'CardPIE' },
      { id: '/Users/stone/develop/project/UCard/DispatchX', projectId: 'dispatchx', localPath: '/Users/stone/develop/project/UCard/DispatchX', parentRepositoryId: '', relativePath: '.' }
    ]

    const scoped = getProjectRepositoriesForDisplay(project, repositories)

    assert.deepEqual(scoped.map((repository) => repository.id), [
      project.workspacePath,
      '/Users/stone/develop/project/UCard/CardPIE',
      '/Users/stone/develop/project/UCard/DispatchX'
    ])
    assert.equal(scoped[2]?.parentRepositoryId, project.workspacePath)
    assert.equal(scoped[2]?.relativePath, 'DispatchX')
  })
})
