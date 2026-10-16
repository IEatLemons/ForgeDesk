import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import ts from 'typescript'
import { hasRunningProjectGitTask, updateRunningProjectGitTasks, type RunningProjectGitTask } from './project-git-task-state.js'

const firstPush: RunningProjectGitTask = { id: 'push-1', projectId: 'project-1', action: 'push' }
const secondPush: RunningProjectGitTask = { ...firstPush, id: 'push-2' }

describe('concurrent project Git task state', () => {
  it('tracks two pushes to the same project independently, including out-of-order completion', () => {
    let tasks = updateRunningProjectGitTasks([], firstPush, true)
    tasks = updateRunningProjectGitTasks(tasks, secondPush, true)
    assert.deepEqual(tasks.map((task) => task.id), ['push-1', 'push-2'])

    tasks = updateRunningProjectGitTasks(tasks, secondPush, false)
    assert.equal(hasRunningProjectGitTask(tasks, 'project-1', 'push'), true)
    assert.deepEqual(tasks, [firstPush])

    tasks = updateRunningProjectGitTasks(tasks, firstPush, false)
    assert.equal(hasRunningProjectGitTask(tasks, 'project-1', 'push'), false)
  })

  it('does not clear another push when cancellation and finally both remove the first task', () => {
    let tasks = updateRunningProjectGitTasks([firstPush, secondPush], firstPush, false)
    tasks = updateRunningProjectGitTasks(tasks, firstPush, false)
    assert.deepEqual(tasks, [secondPush])
    assert.equal(hasRunningProjectGitTask(tasks, 'project-1', 'push'), true)
  })

  it('keeps project and action status separate and ignores repeated starts', () => {
    const fetch: RunningProjectGitTask = { ...firstPush, id: 'fetch-1', action: 'fetch' }
    const otherProject: RunningProjectGitTask = { ...firstPush, id: 'push-3', projectId: 'project-2' }
    let tasks = updateRunningProjectGitTasks([firstPush, fetch, otherProject], firstPush, true)
    assert.equal(tasks.length, 3)
    tasks = updateRunningProjectGitTasks(tasks, firstPush, false)
    assert.equal(hasRunningProjectGitTask(tasks, 'project-1', 'push'), false)
    assert.equal(hasRunningProjectGitTask(tasks, 'project-1', 'fetch'), true)
    assert.equal(hasRunningProjectGitTask(tasks, 'project-2', 'push'), true)
  })
})

describe('background push entry points', () => {
  it('keeps detail, list and batch push buttons clickable while background tasks run', () => {
    const source = ts.createSourceFile('App.tsx', readFileSync(join(process.cwd(), 'src/renderer/src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const overview = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'ProjectOverview')
    assert.ok(overview)
    const disabledExpressions: string[] = []
    function visit(node: ts.Node): void {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Button') {
        const label = node.children.filter(ts.isJsxText).map((child) => child.text.trim()).join('')
        if (label === '推送' || label === '推送所选') {
          const attributes = node.openingElement.attributes.properties.filter(ts.isJsxAttribute)
          assert.equal(attributes.some((attribute) => attribute.name.getText(source) === 'loading'), false, `${label} must not use blocking loading state`)
          const disabled = attributes.find((attribute) => attribute.name.getText(source) === 'disabled')
          assert.ok(disabled?.initializer)
          disabledExpressions.push(disabled.initializer.getText(source))
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(overview)
    assert.deepEqual(disabledExpressions, [
      '{!canPushProject}',
      '{selectedProjectRows.length === 0 || !selectedProjectsHavePushRepositories}',
      '{projectRepositories.length === 0}',
      '{!selectedProjectGitRepository.available}'
    ])
  })
})
