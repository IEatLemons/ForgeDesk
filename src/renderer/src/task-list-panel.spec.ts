import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

function getTaskListPanelSource(): string {
  return readFileSync(join(process.cwd(), 'src/renderer/src/task-list-panel.tsx'), 'utf8')
}

describe('task list panel', () => {
  it('defaults new tasks to no project while keeping project choices available', () => {
    const source = getTaskListPanelSource()

    assert.match(source, /projectId: unassignedTaskProjectValue/)
    assert.match(source, /label: '未关联项目', value: unassignedTaskProjectValue/)
    assert.match(source, /projects\.map\(\(project\) => \(\{ label: project\.name, value: project\.id \}\)\)/)
    assert.doesNotMatch(source, /selectedProjectId/)
  })
})
