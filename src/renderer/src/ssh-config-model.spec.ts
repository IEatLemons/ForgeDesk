import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEmptySshConfigEntry, parseSshConfigEntries, serializeSshConfigEntries } from './ssh-config-model.js'

describe('ssh config model', () => {
  it('parses host blocks into editable entries', () => {
    const entries = parseSshConfigEntries(
      [
        'Host github.com',
        '  HostName ssh.github.com',
        '  PreferredAuthentications publickey',
        '  IdentityFile ~/.ssh/github-IEatLemons',
        'Host ssh.cardpie.pro',
        '  HostName zephyr.proxy-rlwy.net',
        '  Port 58951',
        '  User git',
        '  IdentityFile ~/.ssh/cardpie.git.pem',
        '  IdentitiesOnly yes',
        '  ServerAliveInterval 10',
        '  ServerAliveCountMax 30',
        '  ConnectTimeout 120',
        '  TCPKeepAlive yes',
        '  IPQoS lowdelay throughput',
        ''
      ].join('\n')
    )

    assert.equal(entries.length, 2)
    assert.equal(entries[0].host, 'github.com')
    assert.equal(entries[0].hostName, 'ssh.github.com')
    assert.equal(entries[0].preferredAuthentications, 'publickey')
    assert.equal(entries[0].identityFile, '~/.ssh/github-IEatLemons')
    assert.equal(entries[1].host, 'ssh.cardpie.pro')
    assert.equal(entries[1].port, '58951')
    assert.equal(entries[1].identitiesOnly, 'yes')
    assert.equal(entries[1].ipQoS, 'lowdelay throughput')
  })

  it('serializes editable entries into ssh config text', () => {
    const entry = {
      ...createEmptySshConfigEntry(),
      host: 'ssh.cardpie.pro',
      hostName: 'zephyr.proxy-rlwy.net',
      user: 'git',
      port: '58951',
      identityFile: '~/.ssh/cardpie.git.pem',
      identitiesOnly: 'yes' as const,
      serverAliveInterval: '10',
      serverAliveCountMax: '30',
      connectTimeout: '120',
      tcpKeepAlive: 'yes' as const,
      ipQoS: 'lowdelay throughput'
    }

    assert.equal(
      serializeSshConfigEntries([entry]),
      [
        'Host ssh.cardpie.pro',
        '  HostName zephyr.proxy-rlwy.net',
        '  User git',
        '  Port 58951',
        '  IdentityFile ~/.ssh/cardpie.git.pem',
        '  PreferredAuthentications publickey',
        '  IdentitiesOnly yes',
        '  ServerAliveInterval 10',
        '  ServerAliveCountMax 30',
        '  ConnectTimeout 120',
        '  TCPKeepAlive yes',
        '  IPQoS lowdelay throughput',
        ''
      ].join('\n')
    )
  })
})
