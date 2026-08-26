import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createProjectListGroupFilterOptions,
  filterProjectsByGroup,
  getProjectRepositoriesForDisplay,
  sortProjectsByGroupForDisplay,
  sortProjectsForDisplay
} from './project-list-view.js'

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

  it('keeps configured group order while preserving favorite-first ordering inside each group', () => {
    const projects = [
      { ...baseProject, id: 'backend-regular', name: 'Backend regular', createdAt: '2026-07-03T00:00:00.000Z', isFavorite: false, groupId: 'backend' },
      { ...baseProject, id: 'frontend-regular', name: 'Frontend regular', createdAt: '2026-07-03T00:00:00.000Z', isFavorite: false, groupId: 'frontend' },
      { ...baseProject, id: 'backend-favorite', name: 'Backend favorite', createdAt: '2026-07-01T00:00:00.000Z', isFavorite: true, groupId: 'backend' },
      { ...baseProject, id: 'ungrouped', name: 'Ungrouped', createdAt: '2026-07-04T00:00:00.000Z', isFavorite: true, groupId: null }
    ]
    const groups = [
      { id: 'frontend', name: '前端', projectCount: 1, sortOrder: 0, createdAt: '', updatedAt: '' },
      { id: 'backend', name: '后端', projectCount: 2, sortOrder: 1, createdAt: '', updatedAt: '' }
    ]

    assert.deepEqual(sortProjectsByGroupForDisplay(projects, groups).map((project) => project.id), [
      'frontend-regular',
      'backend-favorite',
      'backend-regular',
      'ungrouped'
    ])
  })

  it('creates counts and filters for all, favorite, ungrouped, and named groups', () => {
    const projects = [
      { ...baseProject, id: 'a', name: 'A', createdAt: '2026-07-01T00:00:00.000Z', isFavorite: true, groupId: 'frontend' },
      { ...baseProject, id: 'b', name: 'B', createdAt: '2026-07-02T00:00:00.000Z', isFavorite: false, groupId: 'backend' },
      { ...baseProject, id: 'c', name: 'C', createdAt: '2026-07-03T00:00:00.000Z', isFavorite: false, groupId: null }
    ]
    const groups = [
      { id: 'backend', name: '后端', projectCount: 1, sortOrder: 0, createdAt: '', updatedAt: '' },
      { id: 'frontend', name: '前端', projectCount: 1, sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'empty', name: '空分组', projectCount: 0, sortOrder: 2, createdAt: '', updatedAt: '' }
    ]

    assert.deepEqual(createProjectListGroupFilterOptions(projects, groups), [
      { key: 'all', label: '全部', projectCount: 3 },
      { key: 'favorites', label: '已收藏', projectCount: 1 },
      { key: 'ungrouped', label: '未分组', projectCount: 1 },
      { key: 'group:backend', label: '后端', projectCount: 1 },
      { key: 'group:frontend', label: '前端', projectCount: 1 },
      { key: 'group:empty', label: '空分组', projectCount: 0 }
    ])
    assert.deepEqual(filterProjectsByGroup(projects, 'all').map((project) => project.id), ['a', 'b', 'c'])
    assert.deepEqual(filterProjectsByGroup(projects, 'favorites').map((project) => project.id), ['a'])
    assert.deepEqual(filterProjectsByGroup(projects, 'ungrouped').map((project) => project.id), ['c'])
    assert.deepEqual(filterProjectsByGroup(projects, 'group:backend').map((project) => project.id), ['b'])
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
