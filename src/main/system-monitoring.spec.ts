import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectSystemMonitorSnapshot,
  normalizeClashControllerUrl,
  normalizeDiskVolumesForDisplay,
  parseClashConfig,
  parseDfOutput,
  parseNetstatRouteOutput,
  parseRouteOutput,
  parseScutilProxyOutput,
  resolveSystemMonitorStatus,
  type ExecFileRunner,
  type SystemMonitorAppContext
} from './system-monitoring.js'

const appContext: SystemMonitorAppContext = {
  appPath: '/Applications/ForgeDesk.app',
  isDevelopmentBuild: false,
  isDevServer: false,
  isPackaged: true,
  projectRoot: '/Users/stone/Dev/ForgeDesk',
  version: '1.0.8'
}

describe('system monitoring', () => {
  it('parses df output into disk volumes', () => {
    const volumes = parseDfOutput(`Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/disk3s5 976490576 512000 900000000 1% /
/dev/disk3s1 976490576 800000000 176490576 82% /System/Volumes/Data
`)

    assert.equal(volumes.length, 2)
    assert.deepEqual(volumes[0], {
      availableBytes: 900000000 * 1024,
      filesystem: '/dev/disk3s5',
      mount: '/',
      totalBytes: 976490576 * 1024,
      usagePercent: 1,
      usedBytes: 512000 * 1024
    })
    assert.equal(volumes[1].usagePercent, 82)
  })

  it('filters invalid and zero-size df rows', () => {
    const volumes = parseDfOutput(`Filesystem 1024-blocks Used Available Capacity Mounted on
map auto_home 0 0 0 100% /System/Volumes/Data/home
broken row
/dev/disk3s5 nope 512000 900000000 1% /
/dev/disk3s1 976490576 800000000 176490576 82% /System/Volumes/Data
`)

    assert.deepEqual(volumes.map((volume) => volume.mount), ['/System/Volumes/Data'])
  })

  it('normalizes macOS APFS system volumes into a user-visible disk', () => {
    const volumes = normalizeDiskVolumesForDisplay(
      parseDfOutput(`Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/disk2s1s1 239362496 12270072 110394652 11% /
devfs 198 198 0 100% /dev
/dev/disk2s6 239362496 1048600 110394652 1% /System/Volumes/VM
/dev/disk2s2 239362496 8874624 110394652 8% /System/Volumes/Preboot
/dev/disk2s5 239362496 105377952 110394652 49% /System/Volumes/Data
map auto_home 0 0 0 100% /System/Volumes/Data/home
`)
    )

    assert.equal(volumes.length, 1)
    assert.equal(volumes[0].mount, '/')
    assert.equal(volumes[0].totalBytes, 239362496 * 1024)
    assert.equal(volumes[0].availableBytes, 110394652 * 1024)
    assert.equal(volumes[0].usedBytes, (239362496 - 110394652) * 1024)
    assert.equal(Math.round(volumes[0].usagePercent), 54)
  })

  it('resolves resource status from memory and disk thresholds', () => {
    assert.equal(resolveSystemMonitorStatus({ usagePercent: 74 }, [{ usagePercent: 10 }]), 'healthy')
    assert.equal(resolveSystemMonitorStatus({ usagePercent: 75 }, [{ usagePercent: 10 }]), 'warning')
    assert.equal(resolveSystemMonitorStatus({ usagePercent: 10 }, [{ usagePercent: 90 }]), 'critical')
  })

  it('parses macOS proxy output', () => {
    const proxy = parseScutilProxyOutput(`<dictionary> {
  HTTPEnable : 1
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7890
  HTTPSProxy : 127.0.0.1
  SOCKSEnable : 1
  SOCKSPort : 7891
  SOCKSProxy : 127.0.0.1
}`)

    assert.equal(proxy.enabled, true)
    assert.deepEqual(proxy.http, { enabled: true, host: '127.0.0.1', port: 7890 })
    assert.deepEqual(proxy.socks, { enabled: true, host: '127.0.0.1', port: 7891 })
  })

  it('parses default route output', () => {
    assert.deepEqual(
      parseRouteOutput(`   route to: default
destination: default
       mask: default
    gateway: 192.168.31.1
  interface: en0
`),
      { error: '', gateway: '192.168.31.1', interface: 'en0' }
    )
  })

  it('parses default route from netstat fallback output', () => {
    assert.deepEqual(
      parseNetstatRouteOutput(`Routing tables

Internet:
Destination        Gateway            Flags               Netif Expire
default            192.168.1.1        UGScg                 en1
`),
      { error: '', gateway: '192.168.1.1', interface: 'en1' }
    )
  })

  it('parses ClashX Meta config and normalizes controller addresses', () => {
    const config = parseClashConfig(`mixed-port: 7890
socks-port: 7891
external-controller: 0.0.0.0:9090
secret: "local-secret"
allow-lan: true
mode: rule
`)

    assert.equal(config.mixedPort, 7890)
    assert.equal(config.socksPort, 7891)
    assert.equal(config.secret, 'local-secret')
    assert.equal(config.allowLan, true)
    assert.equal(normalizeClashControllerUrl(config.externalController), 'http://127.0.0.1:9090')
  })

  it('returns a renderable snapshot when disk collection fails', async () => {
    const execFileRunner: ExecFileRunner = (_file, _args, callback) => {
      callback(new Error('df exploded'), '', 'df failed')
    }

    const snapshot = await collectSystemMonitorSnapshot(appContext, {
      currentPlatform: 'darwin',
      execFileRunner,
      fetchImpl: async () => {
        throw new Error('not running')
      },
      now: new Date('2026-07-15T08:00:00.000Z')
    })

    assert.equal(snapshot.checkedAt, '2026-07-15T08:00:00.000Z')
    assert.equal(snapshot.diskError, 'df failed')
    assert.deepEqual(snapshot.disks, [])
    assert.equal(snapshot.app.version, '1.0.8')
  })
})
