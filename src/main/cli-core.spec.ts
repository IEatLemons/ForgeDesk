import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatCliHelp, formatProjects, parseCliArguments } from './cli-core.js'

describe('forgedesk cli core', () => {
  it('parses project and repository listing commands', () => {
    assert.deepEqual(parseCliArguments(['projects']), { command: 'projects' })
    assert.deepEqual(parseCliArguments(['repos', '--project', 'CardPIE']), { command: 'repos', project: 'CardPIE' })
  })

  it('parses git commands after -- and reuses the controlled Git parser', () => {
    assert.deepEqual(parseCliArguments(['git', '--repo', 'uka', '--', 'status', '--short', '--branch']), {
      command: 'git',
      repo: 'uka',
      gitArgs: ['status', '--short', '--branch']
    })

    assert.throws(() => parseCliArguments(['git', '--repo', 'uka', '--', 'reset', '--hard']), /不支持的 Git 命令/)
    assert.throws(() => parseCliArguments(['git', '--repo', 'uka', '--', 'status;rm']), /不支持 shell 语法/)
  })

  it('formats CLI output for humans', () => {
    assert.match(formatCliHelp(), /forgedesk projects/)
    assert.equal(formatProjects([{ id: 'p1', name: 'CardPIE', workspacePath: '/Users/stone/Dev/uka' }]), 'CardPIE\tp1\t/Users/stone/Dev/uka')
    assert.equal(formatProjects([]), '没有项目')
  })
})
