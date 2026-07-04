import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerDockerIpc, type DockerIpcService } from './docker-ipc.js'
import type { DockerSnapshot } from './docker.js'

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
      'docker:note:save',
      'docker:note:delete',
      'docker:watch:start',
      'docker:watch:stop'
    ])
    assert.equal(await ipcMain.handlers.get('docker:snapshot')?.({}), snapshot)
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
      'save:image:image-tag:merchant-api:latest:Merchant API',
      'delete:image:image-tag:merchant-api:latest',
      'start',
      'stop'
    ])
  })
})
