import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTerminalRemoteGroupSections, filterTerminalRemoteHosts, formatTerminalRemoteTarget } from './terminal-remote-shortcuts-view.js'

const groups: TerminalRemoteGroupRecord[] = [
  { id: 'default', name: '默认', sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'prod', name: '生产', sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'stage', name: '测试', sortOrder: 2, createdAt: '', updatedAt: '' }
]

const hosts: TerminalRemoteHostRecord[] = [
  {
    id: 'api-2',
    groupId: 'prod',
    name: 'API 02',
    host: 'api-02.example.com',
    username: 'deploy',
    port: 2222,
    identityFile: '',
    notes: '',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'api-1',
    groupId: 'prod',
    name: 'API 01',
    host: 'api-01.example.com',
    username: 'deploy',
    port: 22,
    identityFile: '',
    notes: '',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'web',
    groupId: 'stage',
    name: 'Web',
    host: 'web-stage.example.com',
    username: '',
    port: 22,
    identityFile: '',
    notes: 'frontend',
    createdAt: '',
    updatedAt: ''
  }
]

describe('terminal remote shortcut view helpers', () => {
  it('groups hosts under their remote groups', () => {
    const sections = createTerminalRemoteGroupSections(groups, hosts)

    assert.deepEqual(
      sections.map((section) => ({ group: section.group.name, hosts: section.hosts.map((host) => host.name) })),
      [
        { group: '默认', hosts: [] },
        { group: '生产', hosts: ['API 01', 'API 02'] },
        { group: '测试', hosts: ['Web'] }
      ]
    )
  })

  it('filters hosts by name, host, user, and notes', () => {
    assert.deepEqual(
      filterTerminalRemoteHosts(hosts, 'deploy').map((host) => host.name),
      ['API 01', 'API 02']
    )
    assert.deepEqual(
      filterTerminalRemoteHosts(hosts, 'frontend').map((host) => host.name),
      ['Web']
    )
  })

  it('formats remote targets for compact display', () => {
    assert.equal(formatTerminalRemoteTarget(hosts[0]), 'deploy@api-02.example.com:2222')
    assert.equal(formatTerminalRemoteTarget(hosts[2]), 'web-stage.example.com:22')
  })
})
