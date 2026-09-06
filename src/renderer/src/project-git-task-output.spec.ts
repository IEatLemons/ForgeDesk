import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { isProjectGitTaskErrorLine } from './project-git-task-output.js'

describe('project Git task output', () => {
  it('keeps successful remote notices out of the error color', () => {
    assert.equal(isProjectGitTaskErrorLine('remote: Create a new pull request for v2-develop:'), false)
    assert.equal(isProjectGitTaskErrorLine('To github.com:example/project.git'), false)
  })

  it('recognizes common Git failure lines', () => {
    assert.equal(isProjectGitTaskErrorLine('remote: error: GH006: Protected branch update failed'), true)
    assert.equal(isProjectGitTaskErrorLine('! [rejected]        main -> main (non-fast-forward)'), true)
    assert.equal(isProjectGitTaskErrorLine('fatal: Could not read from remote repository.'), true)
  })
})
