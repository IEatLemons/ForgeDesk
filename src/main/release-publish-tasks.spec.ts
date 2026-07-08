import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  listReleasePublishTasks,
  migrateReleasePublishTaskTable,
  saveReleasePublishTask
} from './release-publish-tasks.js'

type TestDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
    get: (...params: unknown[]) => unknown
    run: (...params: unknown[]) => unknown
  }
}

function createTestDatabase(): TestDatabase {
  const tasks: Array<Record<string, unknown>> = []

  const db: TestDatabase = {
    exec: () => undefined,
    prepare: (sql: string) => {
      if (sql.includes('PRAGMA table_info(release_publish_tasks)')) {
        return {
          all: () => [
            { name: 'id' },
            { name: 'repository_id' },
            { name: 'repository_name' },
            { name: 'provider' },
            { name: 'external_build_id' },
            { name: 'external_build_url' },
            { name: 'external_status' },
            { name: 'external_workflow' },
            { name: 'external_branch' },
            { name: 'external_tag' },
            { name: 'artifacts_json' }
          ],
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('ALTER TABLE release_publish_tasks ADD COLUMN')) {
        return {
          all: () => [],
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('INSERT INTO release_publish_tasks')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (...params) => {
            const [
              id,
              repositoryId,
              repositoryName,
              provider,
              version,
              tagName,
              releaseTitle,
              selectedScript,
              status,
              phase,
              phaseIndex,
              phaseTotal,
              hint,
              lastOutputAt,
              processPid,
              startedAt,
              updatedAt,
              finishedAt,
              log,
              stdout,
              stderr,
              exitCode,
              error,
              externalBuildId,
              externalBuildUrl,
              externalStatus,
              externalWorkflow,
              externalBranch,
              externalTag,
              artifactsJson,
              planJson,
              repositoryJson
            ] = params
            const existing = tasks.find((task) => task.id === id)
            const row = {
              id,
              repository_id: repositoryId,
              repository_name: repositoryName,
              provider,
              version,
              tag_name: tagName,
              release_title: releaseTitle,
              selected_script: selectedScript,
              status,
              phase,
              phase_index: phaseIndex,
              phase_total: phaseTotal,
              hint,
              last_output_at: lastOutputAt,
              process_pid: processPid,
              started_at: startedAt,
              updated_at: updatedAt,
              finished_at: finishedAt,
              log,
              stdout,
              stderr,
              exit_code: exitCode,
              error,
              external_build_id: externalBuildId,
              external_build_url: externalBuildUrl,
              external_status: externalStatus,
              external_workflow: externalWorkflow,
              external_branch: externalBranch,
              external_tag: externalTag,
              artifacts_json: artifactsJson,
              plan_json: planJson,
              repository_json: repositoryJson
            }

            if (existing) {
              Object.assign(existing, row)
            } else {
              tasks.push(row)
            }
          }
        }
      }

      if (sql.includes('SELECT * FROM release_publish_tasks')) {
        return {
          all: (repositoryId?: unknown) => tasks
            .filter((task) => !repositoryId || task.repository_id === repositoryId)
            .sort((left, right) => String(right.started_at).localeCompare(String(left.started_at))),
          get: () => undefined,
          run: () => undefined
        }
      }

      if (sql.includes('DELETE FROM release_publish_tasks WHERE id = ?')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (taskId) => {
            const index = tasks.findIndex((task) => task.id === taskId)

            if (index >= 0) {
              tasks.splice(index, 1)
            }
          }
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }

  migrateReleasePublishTaskTable(db)
  return db
}

describe('release publish task persistence', () => {
  it('restores completed publish task logs from the database', () => {
    const db = createTestDatabase()

    saveReleasePublishTask(db, {
      id: 'task-1',
      repositoryId: 'repo-1',
      repositoryName: 'ForgeDesk',
      version: '1.0.9',
      tagName: 'v1.0.9',
      releaseTitle: 'ForgeDesk v1.0.9',
      provider: 'github',
      selectedScript: 'publish:mac',
      status: 'succeeded',
      phase: '发布完成',
      phaseIndex: 9,
      phaseTotal: 9,
      hint: '完成',
      lastOutputAt: '2026-07-02T10:00:01.000Z',
      startedAt: '2026-07-02T10:00:00.000Z',
      updatedAt: '2026-07-02T10:02:00.000Z',
      finishedAt: '2026-07-02T10:02:00.000Z',
      log: '[10:02:00] 发布流程已完成',
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      artifacts: [],
      plan: { selectedScript: 'publish:mac' },
      repository: { id: 'repo-1', name: 'ForgeDesk' }
    })

    const restored = listReleasePublishTasks(db, 'repo-1')

    assert.equal(restored.length, 1)
    assert.equal(restored[0]?.log, '[10:02:00] 发布流程已完成')
    assert.equal(restored[0]?.plan?.selectedScript, 'publish:mac')
    assert.equal(restored[0]?.repository?.name, 'ForgeDesk')
    assert.equal(restored[0]?.provider, 'github')
  })

  it('restores Codemagic build metadata and artifacts', () => {
    const db = createTestDatabase()

    saveReleasePublishTask(db, {
      id: 'task-2',
      repositoryId: 'repo-1',
      repositoryName: 'Mobile',
      provider: 'codemagic',
      version: '2.0.0',
      tagName: 'v2.0.0',
      releaseTitle: 'Mobile v2.0.0',
      selectedScript: '',
      status: 'succeeded',
      phase: 'Codemagic 构建完成',
      phaseIndex: 6,
      phaseTotal: 6,
      hint: '完成',
      lastOutputAt: '2026-07-02T10:00:01.000Z',
      startedAt: '2026-07-02T10:00:00.000Z',
      updatedAt: '2026-07-02T10:02:00.000Z',
      finishedAt: '2026-07-02T10:02:00.000Z',
      log: '[10:02:00] Codemagic 构建完成',
      stdout: '',
      stderr: '',
      exitCode: 0,
      externalBuildId: 'build-1',
      externalBuildUrl: 'https://codemagic.io/app/app-1/build/build-1',
      externalStatus: 'finished',
      externalWorkflow: 'release',
      externalBranch: 'main',
      artifacts: [
        {
          name: 'app-release.aab',
          type: 'aab',
          sizeInBytes: 1234,
          downloadUrl: 'https://example.com/app-release.aab',
          versionName: '2.0.0'
        }
      ],
      plan: { selectedScript: '' },
      repository: { id: 'repo-1', name: 'Mobile' }
    })

    const restored = listReleasePublishTasks(db, 'repo-1').find((task) => task.id === 'task-2')

    assert.equal(restored?.provider, 'codemagic')
    assert.equal(restored?.externalBuildId, 'build-1')
    assert.equal(restored?.artifacts[0]?.name, 'app-release.aab')
    assert.equal(restored?.artifacts[0]?.versionName, '2.0.0')
  })
})
