import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createDockerDevContainerCliArgs,
  createDockerDevEnvironment,
  createDockerDevEnvironmentConfig,
  createDockerDevEnvironmentRunSteps,
  createDockerSnapshot,
  createDockerCommandRunner,
  deleteDockerResourceNote,
  formatDockerProcessCommand,
  listDockerResourceNotes,
  migrateDockerTables,
  parseDockerContainerLines,
  parseDockerImageLines,
  readDockerContainerDetail,
  saveDockerResourceNote
} from './docker.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function createDatabase(): TestDatabase {
  const notes: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    exec: () => undefined,
    prepare: (sql: string) => {
      if (sql.includes('SELECT * FROM docker_resource_notes ORDER BY resource_type ASC, resource_key ASC')) {
        return {
          all: () =>
            [...notes].sort((left, right) => {
              const typeCompare = String(left.resource_type).localeCompare(String(right.resource_type))
              return typeCompare || String(left.resource_key).localeCompare(String(right.resource_key))
            }),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('SELECT * FROM docker_resource_notes WHERE resource_type = ? AND resource_key = ?')) {
        return {
          all: () => [],
          get: (resourceType, resourceKey) => notes.find((note) => note.resource_type === resourceType && note.resource_key === resourceKey),
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO docker_resource_notes')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (resourceType, resourceKey, displayName, noteText, createdAt, updatedAt) => {
            const existing = notes.find((note) => note.resource_type === resourceType && note.resource_key === resourceKey)

            if (existing) {
              existing.display_name = displayName
              existing.notes = noteText
              existing.updated_at = updatedAt
              return
            }

            notes.push({
              resource_type: resourceType,
              resource_key: resourceKey,
              display_name: displayName,
              notes: noteText,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('DELETE FROM docker_resource_notes')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (resourceType, resourceKey) => {
            const index = notes.findIndex((note) => note.resource_type === resourceType && note.resource_key === resourceKey)

            if (index >= 0) {
              notes.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateDockerTables(db)
  return db
}

describe('docker local inventory', () => {
  it('creates a root devcontainer config with Docker-in-Docker enabled by default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-docker-dev-env-'))

    try {
      const result = await createDockerDevEnvironment({
        hostPath: root,
        name: 'API Dev',
        workspaceFolder: '/workspace',
        system: 'ubuntu-24.04'
      })
      const config = JSON.parse(await readFile(result.configPath, 'utf8'))

      assert.equal(result.configPath, join(root, '.devcontainer', 'devcontainer.json'))
      assert.equal(config.name, 'API Dev')
      assert.equal(config.image, 'mcr.microsoft.com/devcontainers/base:ubuntu-24.04')
      assert.equal(config.remoteUser, 'root')
      assert.equal(config.containerUser, 'root')
      assert.equal(config.updateRemoteUserUID, false)
      assert.equal(config.workspaceFolder, '/workspace')
      assert.equal(config.workspaceMount, 'source=${localWorkspaceFolder},target=/workspace,type=bind,consistency=cached')
      assert.match(result.containerName, /^forgedesk-dev-api-dev-[a-f0-9]{8}$/)
      assert.equal(config.privileged, true)
      assert.deepEqual(config.features, {
        'ghcr.io/devcontainers/features/docker-in-docker:2': {
          version: 'latest',
          moby: true
        }
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('builds devcontainer config without Docker-in-Docker when disabled', () => {
    const result = createDockerDevEnvironmentConfig({
      hostPath: '/Users/stone/project',
      workspaceFolder: '/workspaces/project',
      system: 'node-22',
      enableDockerInDocker: false
    })

    assert.equal(result.image, 'mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm')
    assert.equal('features' in result.config, false)
    assert.equal('privileged' in result.config, false)
    assert.match(result.content, /"remoteUser": "root"/)
  })

  it('builds devcontainer and docker run commands for a visible root container', () => {
    const result = createDockerDevEnvironmentConfig({
      hostPath: '/Users/stone/project',
      name: 'Project Dev',
      workspaceFolder: '/workspace',
      system: 'ubuntu-24.04'
    })
    const cliArgs = createDockerDevContainerCliArgs(result)
    const steps = createDockerDevEnvironmentRunSteps(result)
    const runStep = steps.at(-1)

    assert.deepEqual(cliArgs.slice(0, 5), ['up', '--workspace-folder', '/Users/stone/project', '--config', '/Users/stone/project/.devcontainer/devcontainer.json'])
    assert.ok(cliArgs.includes('--remove-existing-container'))
    assert.equal(steps[0].args.join(' '), 'pull mcr.microsoft.com/devcontainers/base:ubuntu-24.04')
    assert.equal(steps[1].allowMissingContainer, true)
    assert.ok(runStep)
    assert.ok(runStep.args.includes('-d'))
    assert.ok(runStep.args.includes('--name'))
    assert.ok(runStep.args.includes(result.containerName))
    assert.ok(runStep.args.includes('--user'))
    assert.ok(runStep.args.includes('root'))
    assert.ok(runStep.args.includes('--privileged'))
    assert.ok(runStep.args.includes(`type=bind,source=/Users/stone/project,target=/workspace`))
    assert.ok(runStep.args.includes('forgedesk.dev-environment=true'))
    assert.match(formatDockerProcessCommand(runStep.file, runStep.args), /docker run -d/)
  })

  it('does not overwrite an existing devcontainer config unless requested', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forgedesk-docker-dev-env-'))

    try {
      const devcontainerDir = join(root, '.devcontainer')
      await mkdir(devcontainerDir, { recursive: true })
      await writeFile(join(devcontainerDir, 'devcontainer.json'), '{}')

      await assert.rejects(
        () =>
          createDockerDevEnvironment({
            hostPath: root,
            system: 'debian-12'
          }),
        /已存在/
      )

      await createDockerDevEnvironment({
        hostPath: root,
        system: 'debian-12',
        overwrite: true
      })
      const config = JSON.parse(await readFile(join(devcontainerDir, 'devcontainer.json'), 'utf8'))

      assert.equal(config.image, 'mcr.microsoft.com/devcontainers/base:debian-12')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('adds command context and Docker-specific hints when a Docker command fails', async () => {
    const runner = createDockerCommandRunner((_file, _args, _options, callback) => {
      callback(new Error('Command failed: docker container ls --all'), '', 'permission denied while trying to connect to the docker API')
    })

    await assert.rejects(
      () => runner(['container', 'ls', '--all']),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /docker container ls --all/)
        assert.match(error.message, /permission denied while trying to connect/)
        assert.match(error.message, /Docker Desktop/)
        return true
      }
    )
  })

  it('parses Docker image json lines and skips malformed rows', () => {
    const images = parseDockerImageLines(
      [
        JSON.stringify({
          ID: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          Repository: 'merchant-api',
          Tag: 'latest',
          Digest: 'sha256:digest-a',
          Size: '128MB',
          CreatedAt: '2026-07-03 10:00:00 +0800 HKT',
          CreatedSince: '2 hours ago'
        }),
        '{not json',
        JSON.stringify({
          ID: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
          Repository: '<none>',
          Tag: '<none>',
          Digest: '<none>',
          Size: '0B',
          CreatedAt: '',
          CreatedSince: ''
        })
      ].join('\n')
    )

    assert.deepEqual(
      images.map((image) => ({
        id: image.id,
        shortId: image.shortId,
        repository: image.repository,
        tag: image.tag,
        reference: image.reference,
        noteResourceKey: image.noteResourceKey
      })),
      [
        {
          id: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          shortId: '111111111111',
          repository: 'merchant-api',
          tag: 'latest',
          reference: 'merchant-api:latest',
          noteResourceKey: 'image-tag:merchant-api:latest'
        },
        {
          id: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
          shortId: '222222222222',
          repository: '',
          tag: '',
          reference: '<untagged>',
          noteResourceKey: 'image-id:sha256:2222222222222222222222222222222222222222222222222222222222222222'
        }
      ]
    )
  })

  it('parses Docker container json lines and builds stable container note keys', () => {
    const containers = parseDockerContainerLines(
      [
        JSON.stringify({
          ID: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          Names: 'merchant-api-1',
          Image: 'merchant-api:latest',
          State: 'running',
          Status: 'Up 4 minutes',
          Ports: '0.0.0.0:3000->3000/tcp',
          CreatedAt: '2026-07-03 10:00:00 +0800 HKT',
          RunningFor: '4 minutes ago'
        }),
        'not-json'
      ].join('\n')
    )

    assert.deepEqual(
      containers.map((container) => ({
        id: container.id,
        shortId: container.shortId,
        name: container.name,
        image: container.image,
        state: container.state,
        noteResourceKey: container.noteResourceKey
      })),
      [
        {
          id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          shortId: 'abcdef123456',
          name: 'merchant-api-1',
          image: 'merchant-api:latest',
          state: 'running',
          noteResourceKey: 'container:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        }
      ]
    )
  })

  it('reads Docker container inspect data into a detailed view model', async () => {
    const calls: string[][] = []
    const detail = await readDockerContainerDetail('abcdef1234567890', async (args) => {
      calls.push(args)
      return JSON.stringify([
        {
          Id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          Name: '/merchant-api-1',
          Created: '2026-07-03T02:00:00.000000000Z',
          Path: 'docker-entrypoint.sh',
          Args: ['node', 'server.js'],
          Image: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          Platform: 'linux',
          Driver: 'overlay2',
          RestartCount: 1,
          State: {
            Status: 'running',
            Running: true,
            Paused: false,
            Restarting: false,
            Pid: 31822,
            ExitCode: 0,
            StartedAt: '2026-07-03T02:01:00.000000000Z',
            FinishedAt: '0001-01-01T00:00:00Z'
          },
          Config: {
            Hostname: 'abcdef123456',
            Image: 'merchant-api:latest',
            User: 'node',
            Env: ['NODE_ENV=development', 'PORT=3000'],
            Entrypoint: ['docker-entrypoint.sh'],
            Cmd: ['node', 'server.js'],
            WorkingDir: '/app',
            Labels: {
              'com.docker.compose.project': 'merchant'
            }
          },
          HostConfig: {
            NetworkMode: 'bridge',
            RestartPolicy: { Name: 'unless-stopped' }
          },
          Mounts: [
            {
              Type: 'bind',
              Source: '/Users/stone/merchant-api',
              Destination: '/app',
              Mode: 'rw',
              RW: true,
              Name: ''
            }
          ],
          NetworkSettings: {
            Ports: {
              '3000/tcp': [{ HostIp: '0.0.0.0', HostPort: '3000' }],
              '9229/tcp': null
            },
            Networks: {
              bridge: {
                NetworkID: 'network-123',
                IPAddress: '172.17.0.2',
                Gateway: '172.17.0.1',
                MacAddress: '02:42:ac:11:00:02'
              }
            }
          }
        }
      ])
    })

    assert.deepEqual(calls, [['container', 'inspect', 'abcdef1234567890']])
    assert.equal(detail.id, 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    assert.equal(detail.name, 'merchant-api-1')
    assert.equal(detail.imageName, 'merchant-api:latest')
    assert.equal(detail.status, 'running')
    assert.equal(detail.running, true)
    assert.equal(detail.pid, 31822)
    assert.deepEqual(detail.command, ['node', 'server.js'])
    assert.deepEqual(detail.entrypoint, ['docker-entrypoint.sh'])
    assert.deepEqual(detail.env, ['NODE_ENV=development', 'PORT=3000'])
    assert.deepEqual(detail.ports, [
      { privatePort: '3000', type: 'tcp', hostIp: '0.0.0.0', hostPort: '3000' },
      { privatePort: '9229', type: 'tcp', hostIp: '', hostPort: '' }
    ])
    assert.deepEqual(detail.mounts, [
      { type: 'bind', source: '/Users/stone/merchant-api', destination: '/app', mode: 'rw', rw: true, name: '' }
    ])
    assert.deepEqual(detail.networks, [
      { name: 'bridge', networkId: 'network-123', ipAddress: '172.17.0.2', gateway: '172.17.0.1', macAddress: '02:42:ac:11:00:02' }
    ])
    assert.deepEqual(detail.labels, { 'com.docker.compose.project': 'merchant' })
    assert.match(detail.rawJson, /"Config"/)
  })

  it('stores, updates and deletes Docker resource notes', () => {
    const db = createDatabase()

    const saved = saveDockerResourceNote(db, {
      resourceType: 'image',
      resourceKey: 'image-tag:merchant-api:latest',
      displayName: ' Merchant API ',
      notes: ' Latest local build '
    })

    assert.equal(saved.displayName, 'Merchant API')
    assert.equal(saved.notes, 'Latest local build')

    saveDockerResourceNote(db, {
      resourceType: 'image',
      resourceKey: 'image-tag:merchant-api:latest',
      displayName: 'Merchant API latest',
      notes: ''
    })
    saveDockerResourceNote(db, {
      resourceType: 'container',
      resourceKey: 'container:abcdef',
      displayName: 'API dev container',
      notes: 'local run'
    })

    assert.deepEqual(
      listDockerResourceNotes(db).map((note) => ({
        resourceType: note.resourceType,
        resourceKey: note.resourceKey,
        displayName: note.displayName,
        notes: note.notes
      })),
      [
        {
          resourceType: 'container',
          resourceKey: 'container:abcdef',
          displayName: 'API dev container',
          notes: 'local run'
        },
        {
          resourceType: 'image',
          resourceKey: 'image-tag:merchant-api:latest',
          displayName: 'Merchant API latest',
          notes: ''
        }
      ]
    )

    deleteDockerResourceNote(db, 'image', 'image-tag:merchant-api:latest')

    assert.deepEqual(listDockerResourceNotes(db).map((note) => note.resourceKey), ['container:abcdef'])
  })

  it('applies image notes by tag before image id and applies container notes by full id', () => {
    const tagNote = {
      resourceType: 'image' as const,
      resourceKey: 'image-tag:merchant-api:latest',
      displayName: 'API latest tag',
      notes: 'preferred display',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z'
    }
    const imageIdNote = {
      resourceType: 'image' as const,
      resourceKey: 'image-id:sha256:1111111111111111111111111111111111111111111111111111111111111111',
      displayName: 'API exact image',
      notes: 'fallback display',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z'
    }
    const containerNote = {
      resourceType: 'container' as const,
      resourceKey: 'container:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      displayName: 'API dev runtime',
      notes: 'started from docker run',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z'
    }
    const images = parseDockerImageLines(
      JSON.stringify({
        ID: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        Repository: 'merchant-api',
        Tag: 'latest',
        Digest: '<none>',
        Size: '128MB'
      })
    )
    const containers = parseDockerContainerLines(
      JSON.stringify({
        ID: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        Names: 'merchant-api-1',
        Image: 'merchant-api:latest',
        State: 'running',
        Status: 'Up 4 minutes'
      })
    )

    const snapshot = createDockerSnapshot({
      images,
      containers,
      notes: [imageIdNote, tagNote, containerNote],
      checkedAt: '2026-07-03T02:00:00.000Z'
    })

    assert.equal(snapshot.images[0].displayName, 'API latest tag')
    assert.equal(snapshot.images[0].note?.resourceKey, 'image-tag:merchant-api:latest')
    assert.equal(snapshot.containers[0].displayName, 'API dev runtime')
    assert.equal(snapshot.containers[0].note?.resourceKey, 'container:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    assert.equal(snapshot.checkedAt, '2026-07-03T02:00:00.000Z')
  })
})
