import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getProjectFirebaseReleaseSettings,
  migrateProjectFirebaseReleaseTables,
  resolveProjectFirebaseReleaseSettings,
  saveProjectFirebaseReleaseSettings
} from './firebase-app-distribution.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

const serviceAccountKey = JSON.stringify({
  type: 'service_account',
  project_id: 'firebase-project',
  client_email: 'release@firebase-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n'
})

function createDatabase(): TestDatabase {
  const settingsRows: Array<Record<string, unknown>> = []
  const db: TestDatabase = {
    exec: () => undefined,
    prepare: (sql: string) => {
      if (sql.includes('SELECT id FROM projects')) {
        return { all: () => [], get: (projectId) => (projectId === 'project-a' ? { id: projectId } : undefined), run: () => undefined }
      }

      if (sql.includes('SELECT * FROM project_firebase_release_settings')) {
        return { all: () => [], get: (projectId) => settingsRows.find((row) => row.project_id === projectId), run: () => undefined }
      }

      if (sql.includes('INSERT INTO project_firebase_release_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (projectId, enabled, appId, artifactPath, buildScript, groupsJson, testersJson, key, createdAt, updatedAt) => {
            settingsRows.push({
              project_id: projectId,
              enabled,
              app_id: appId,
              artifact_path: artifactPath,
              build_script: buildScript,
              groups_json: groupsJson,
              testers_json: testersJson,
              service_account_key: key,
              created_at: createdAt,
              updated_at: updatedAt
            })
          }
        }
      }

      if (sql.includes('UPDATE project_firebase_release_settings')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (enabled, appId, artifactPath, buildScript, groupsJson, testersJson, key, updatedAt, projectId) => {
            const row = settingsRows.find((item) => item.project_id === projectId)
            if (row) {
              Object.assign(row, {
                enabled,
                app_id: appId,
                artifact_path: artifactPath,
                build_script: buildScript,
                groups_json: groupsJson,
                testers_json: testersJson,
                service_account_key: key,
                updated_at: updatedAt
              })
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateProjectFirebaseReleaseTables(db)
  return db
}

describe('project Firebase App Distribution settings', () => {
  it('keeps the service account key in the main process and exposes only readiness metadata', async () => {
    const db = createDatabase()
    const saved = await saveProjectFirebaseReleaseSettings(db, {
      projectId: 'project-a',
      enabled: true,
      appId: '1:123:android:abc',
      artifactPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      groups: 'qa-team, trusted-testers',
      testers: 'qa@example.com, owner@example.com',
      serviceAccountKey
    })

    assert.equal(saved.active, true)
    assert.equal(saved.serviceAccountKeyConfigured, true)
    assert.equal(saved.serviceAccountEmail, 'release@firebase-project.iam.gserviceaccount.com')
    assert.deepEqual(saved.groups, ['qa-team', 'trusted-testers'])
    assert.deepEqual(saved.testers, ['qa@example.com', 'owner@example.com'])
    assert.equal(JSON.stringify(settingsRowsFor(db)[0]).includes('private_key'), true)
    assert.equal(JSON.stringify(saved).includes('private_key'), false)
  })

  it('requires complete configuration only when the project platform is enabled', async () => {
    const db = createDatabase()
    const disabled = await saveProjectFirebaseReleaseSettings(db, { projectId: 'project-a', enabled: false })

    assert.equal(disabled.active, false)
    await assert.rejects(
      () => saveProjectFirebaseReleaseSettings(db, { projectId: 'project-a', enabled: true }),
      /Firebase App ID/
    )
  })

  it('preserves a saved key when the form submits blank secret fields', async () => {
    const db = createDatabase()
    await saveProjectFirebaseReleaseSettings(db, {
      projectId: 'project-a',
      enabled: true,
      appId: '1:123:android:abc',
      artifactPath: 'app.apk',
      serviceAccountKey
    })

    const updated = await saveProjectFirebaseReleaseSettings(db, {
      projectId: 'project-a',
      enabled: true,
      appId: '1:123:android:updated',
      artifactPath: 'app-release.aab',
      serviceAccountKey: ''
    })

    assert.equal(updated.active, true)
    assert.equal(updated.appId, '1:123:android:updated')
    assert.equal(updated.serviceAccountKeyConfigured, true)
    assert.equal(resolveProjectFirebaseReleaseSettings(db, 'project-a').serviceAccountKey, serviceAccountKey)
    assert.equal(getProjectFirebaseReleaseSettings(db, 'project-a')?.serviceAccountKeyConfigured, true)
  })

  it('rejects malformed service account keys and inactive release settings', async () => {
    const db = createDatabase()
    await assert.rejects(
      () => saveProjectFirebaseReleaseSettings(db, { projectId: 'project-a', enabled: false, serviceAccountKey: '{"project_id":"missing"}' }),
      /缺少 project_id、client_email 或 private_key/
    )
    await assert.rejects(async () => resolveProjectFirebaseReleaseSettings(db, 'project-a'), /启用并完成 Firebase App Distribution 配置/)
  })
})

function settingsRowsFor(db: TestDatabase): Array<Record<string, unknown>> {
  const row = db.prepare('SELECT * FROM project_firebase_release_settings WHERE project_id = ?').get('project-a') as Record<string, unknown> | undefined
  return row ? [row] : []
}
