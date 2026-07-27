import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAiChatReuseKey,
  createCodexTaskTitle,
  formatCodexChangeStat,
  getCodexTaskStatusTone,
  groupCodexTasks,
  upsertCodexTask
} from './ai-chat-view.js'
import type { CodexTaskRecord, Project } from './data.js'

function createTask(patch: Partial<CodexTaskRecord> = {}): CodexTaskRecord {
  return {
    additions: 0,
    branch: '',
    createdAt: '2026-07-21T08:00:00.000Z',
    cwd: '/Users/stone/develop/stone/ForgeDesk',
    deletions: 0,
    environment: {
      additions: 0,
      branch: '',
      checkedAt: '2026-07-21T08:00:00.000Z',
      cwd: '/Users/stone/develop/stone/ForgeDesk',
      deletions: 0,
      filesChanged: 0,
      hasChanges: false,
      repositoryAvailable: true
    },
    errorMessage: '',
    filesChanged: 0,
    finishedAt: '',
    id: 'task-a',
    messages: [],
    model: '',
    projectId: '',
    runLog: '',
    status: 'idle',
    title: 'Task A',
    updatedAt: '2026-07-21T08:00:00.000Z',
    ...patch
  }
}

const project: Project = {
  createdAt: '2026-07-21T00:00:00.000Z',
  description: '',
  id: 'project-a',
  name: 'ForgeDesk',
  owner: '',
  status: 'ready',
  workspacePath: '/Users/stone/develop/stone/ForgeDesk',
  isFavorite: false
}

describe('AI chat view helpers', () => {
  it('creates stable AI chat reuse keys per context', () => {
    assert.equal(createAiChatReuseKey({ kind: 'home' }), 'ai-chat:home:home')
    assert.equal(createAiChatReuseKey({ kind: 'project', id: 'project-a', path: '/Users/stone/project-a' }), 'ai-chat:project:project-a')
    assert.equal(createAiChatReuseKey({ kind: 'directory', path: '/Users/stone/scratch' }), 'ai-chat:directory:/Users/stone/scratch')
  })

  it('creates concise task titles from prompts', () => {
    assert.equal(createCodexTaskTitle('  修复 ForgeDesk Codex 工作台\n补充测试'), '修复 ForgeDesk Codex 工作台')
    assert.equal(createCodexTaskTitle('   '), '新对话')
    assert.equal(createCodexTaskTitle('a'.repeat(80)), 'a'.repeat(64))
  })

  it('upserts tasks and keeps the newest task first', () => {
    const older = createTask({ id: 'older', updatedAt: '2026-07-21T08:00:00.000Z' })
    const newer = createTask({ id: 'newer', title: 'Newer', updatedAt: '2026-07-21T09:00:00.000Z' })
    const updatedOlder = createTask({ id: 'older', title: 'Updated', updatedAt: '2026-07-21T10:00:00.000Z' })

    assert.deepEqual(upsertCodexTask([older], newer).map((task) => task.id), ['newer', 'older'])
    assert.deepEqual(upsertCodexTask([older, newer], updatedOlder).map((task) => `${task.id}:${task.title}`), ['older:Updated', 'newer:Newer'])
  })

  it('groups tasks by project with a local fallback group', () => {
    const groups = groupCodexTasks([
      createTask({ id: 'local-task', projectId: '', title: 'Local' }),
      createTask({ id: 'project-task', projectId: 'project-a', title: 'Project' })
    ], [project])

    assert.deepEqual(groups.map((group) => `${group.key}:${group.label}:${group.tasks.length}`), ['local:本地:1', 'project-a:ForgeDesk:1'])
  })

  it('maps task status and change stats for compact display', () => {
    assert.equal(getCodexTaskStatusTone('running'), 'processing')
    assert.equal(getCodexTaskStatusTone('failed'), 'error')
    assert.equal(formatCodexChangeStat(createTask()), '无变更')
    assert.equal(formatCodexChangeStat(createTask({ additions: 12, deletions: 3, filesChanged: 2 })), '2 个文件  +12 -3')
  })
})
