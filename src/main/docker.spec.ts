import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createDockerSnapshot,
  deleteDockerResourceNote,
  listDockerResourceNotes,
  migrateDockerTables,
  parseDockerContainerLines,
  parseDockerImageLines,
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
