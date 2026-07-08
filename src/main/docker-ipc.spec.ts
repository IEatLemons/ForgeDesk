import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { registerDockerIpc, type DockerIpcService } from './docker-ipc.js'
import type { DockerContainerDetail, DockerDevEnvironmentResult, DockerDevEnvironmentTaskSnapshot, DockerSnapshot } from './docker.js'

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

const devEnvironmentResult: DockerDevEnvironmentResult = {
  configPath: '/Users/stone/project/.devcontainer/devcontainer.json',
  hostPath: '/Users/stone/project',
  name: 'Project Dev',
  workspaceFolder: '/workspaces/project',
  system: 'ubuntu-24.04',
  image: 'mcr.microsoft.com/devcontainers/base:ubuntu-24.04',
  dockerInDocker: true,
  containerName: 'forgedesk-dev-project-dev-12345678',
  content: '{}\n'
}

const devEnvironmentTask: DockerDevEnvironmentTaskSnapshot = {
  taskId: 'task-1',
  status: 'running',
  runMode: 'devcontainer-cli',
  progressPercent: 20,
  stage: '使用 Dev Containers CLI 构建并启动',
  title: 'Project Dev',
  hostPath: '/Users/stone/project',
  configPath: devEnvironmentResult.configPath,
  containerName: devEnvironmentResult.containerName,
  command: 'devcontainer up --workspace-folder /Users/stone/project',
  startedAt: '2026-07-06T07:30:00.000Z',
  updatedAt: '2026-07-06T07:30:01.000Z',
  finishedAt: '',
  exitCode: null,
  error: '',
  logs: ['已写入配置'],
  result: devEnvironmentResult
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
      createDevEnvironment: async (input) => {
        calls.push(`dev:${input.hostPath}:${input.system}:${input.enableDockerInDocker}`)
        return devEnvironmentTask
      },
      listDevEnvironmentTasks: () => {
        calls.push('dev-tasks')
        return [devEnvironmentTask]
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
      'docker:dev-environment:create',
      'docker:dev-environment:tasks',
      'docker:note:save',
      'docker:note:delete',
      'docker:watch:start',
      'docker:watch:stop'
    ])
    assert.equal(await ipcMain.handlers.get('docker:snapshot')?.({}), snapshot)
    assert.equal(await ipcMain.handlers.get('docker:container:detail')?.({}, 'abcdef1234567890'), containerDetail)
    assert.equal(
      await ipcMain.handlers.get('docker:dev-environment:create')?.({}, {
        hostPath: '/Users/stone/project',
        system: 'ubuntu-24.04',
        enableDockerInDocker: true
      }),
      devEnvironmentTask
    )
    assert.deepEqual(await ipcMain.handlers.get('docker:dev-environment:tasks')?.({}), [devEnvironmentTask])
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
      'dev:/Users/stone/project:ubuntu-24.04:true',
      'dev-tasks',
      'save:image:image-tag:merchant-api:latest:Merchant API',
      'delete:image:image-tag:merchant-api:latest',
      'start',
      'stop'
    ])
  })
})
