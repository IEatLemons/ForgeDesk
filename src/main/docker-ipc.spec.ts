import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerDockerIpc, type DockerIpcService } from './docker-ipc.js'
import type { DockerContainerDetail, DockerSnapshot } from './docker.js'

type TestIpcMain = {
  handlers: Map<string, (event: unknown, ...args: any[]) => unknown>
  handle: (channel: string, listener: (event: unknown, ...args: any[]) => unknown) => void
}

const snapshot: DockerSnapshot = {
  images: [],
  containers: [],
  notes: [],
  checkedAt: '2026-07-03T00:00:00.000Z'
}

const containerDetail: DockerContainerDetail = {
  id: 'abcdef1234567890',
  shortId: 'abcdef123456',
  name: 'merchant-api-1',
  image: 'sha256:111111111111',
  imageName: 'merchant-api:latest',
  createdAt: '2026-07-03T02:00:00.000000000Z',
  startedAt: '2026-07-03T02:01:00.000000000Z',
  finishedAt: '',
  status: 'running',
  running: true,
  paused: false,
  restarting: false,
  pid: 31822,
  exitCode: 0,
  restartCount: 1,
  platform: 'linux',
  driver: 'overlay2',
  hostname: 'abcdef123456',
  user: 'node',
  workingDir: '/app',
  entrypoint: ['docker-entrypoint.sh'],
  command: ['node', 'server.js'],
  env: ['NODE_ENV=development'],
  ports: [{ privatePort: '3000', type: 'tcp', hostIp: '0.0.0.0', hostPort: '3000' }],
  mounts: [{ type: 'bind', source: '/Users/stone/merchant-api', destination: '/app', mode: 'rw', rw: true, name: '' }],
  networks: [{ name: 'bridge', networkId: 'network-123', ipAddress: '172.17.0.2', gateway: '172.17.0.1', macAddress: '02:42:ac:11:00:02' }],
  labels: { 'com.docker.compose.project': 'merchant' },
  networkMode: 'bridge',
  restartPolicy: 'unless-stopped',
  rawJson: '{}'
}

function createIpcMain(): TestIpcMain {
  const handlers = new Map<string, (event: unknown, ...args: any[]) => unknown>()

  return {
    handlers,
    handle: (channel, listener) => handlers.set(channel, listener)
  }
}

describe('docker ipc', () => {
  it('registers Docker snapshot, note and watch handlers', async () => {
    const ipcMain = createIpcMain()
    const calls: string[] = []
    const service: DockerIpcService = {
      getSnapshot: async () => {
        calls.push('snapshot')
        return snapshot
      },
      getContainerDetail: async (containerId) => {
        calls.push(`detail:${containerId}`)
        return containerDetail
      },
      saveResourceNote: async (input) => {
        calls.push(`save:${input.resourceType}:${input.resourceKey}:${input.displayName}`)
        return snapshot
      },
      deleteResourceNote: async (resourceType, resourceKey) => {
        calls.push(`delete:${resourceType}:${resourceKey}`)
        return snapshot
      },
      startWatch: () => calls.push('start'),
      stopWatch: () => calls.push('stop')
    }

    registerDockerIpc(ipcMain, service)

    assert.deepEqual(Array.from(ipcMain.handlers.keys()), [
      'docker:snapshot',
      'docker:container:detail',
      'docker:note:save',
      'docker:note:delete',
      'docker:watch:start',
      'docker:watch:stop'
    ])
    assert.equal(await ipcMain.handlers.get('docker:snapshot')?.({}), snapshot)
    assert.equal(await ipcMain.handlers.get('docker:container:detail')?.({}, 'abcdef1234567890'), containerDetail)
    assert.equal(
      await ipcMain.handlers.get('docker:note:save')?.({}, {
        resourceType: 'image',
        resourceKey: 'image-tag:merchant-api:latest',
        displayName: 'Merchant API'
      }),
      snapshot
    )
    assert.equal(await ipcMain.handlers.get('docker:note:delete')?.({}, 'image', 'image-tag:merchant-api:latest'), snapshot)
    await ipcMain.handlers.get('docker:watch:start')?.({})
    await ipcMain.handlers.get('docker:watch:stop')?.({})

    assert.deepEqual(calls, [
      'snapshot',
      'detail:abcdef1234567890',
      'save:image:image-tag:merchant-api:latest:Merchant API',
      'delete:image:image-tag:merchant-api:latest',
      'start',
      'stop'
    ])
  })
})
