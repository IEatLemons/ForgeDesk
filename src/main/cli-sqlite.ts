import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CliProjectRow, CliRepositoryRow } from './cli-core.js'

type SqliteProjectRow = {
  id?: unknown
  name?: unknown
  workspace_path?: unknown
}

type SqliteRepositoryRow = {
  id?: unknown
  name?: unknown
  project_id?: unknown
  local_path?: unknown
  current_branch?: unknown
}

function parseSqliteJsonRows<T>(content: string): T[] {
  if (!content.trim()) {
    return []
  }

  const parsed = JSON.parse(content) as unknown
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

function getDatabasePath(userDataPath: string): string {
  return join(userDataPath, 'forgedesk.db')
}

function runSqliteJson(databasePath: string, sql: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(process.env.SQLITE3_PATH || 'sqlite3', ['-json', databasePath, sql], { timeout: 10000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout)
    })
  })
}

async function readSqliteJson(userDataPath: string, sql: string): Promise<string> {
  const databasePath = getDatabasePath(userDataPath)

  if (!existsSync(databasePath)) {
    return ''
  }

  try {
    return await runSqliteJson(databasePath, sql)
  } catch (error) {
    if (error instanceof Error && error.message.includes('no such table')) {
      return ''
    }

    throw error
  }
}

export function mapSqliteProjects(content: string): CliProjectRow[] {
  return parseSqliteJsonRows<SqliteProjectRow>(content).map((project) => ({
    id: String(project.id ?? ''),
    name: String(project.name ?? ''),
    workspacePath: String(project.workspace_path ?? '')
  }))
}

export function mapSqliteRepositories(content: string): CliRepositoryRow[] {
  return parseSqliteJsonRows<SqliteRepositoryRow>(content).map((repository) => ({
    id: String(repository.id ?? ''),
    name: String(repository.name ?? ''),
    projectId: String(repository.project_id ?? ''),
    localPath: String(repository.local_path ?? ''),
    currentBranch: String(repository.current_branch ?? '')
  }))
}

export async function readCliProjects(userDataPath: string): Promise<CliProjectRow[]> {
  const content = await readSqliteJson(userDataPath, 'SELECT id, name, workspace_path FROM projects ORDER BY created_at DESC')
  return mapSqliteProjects(content)
}

export async function readCliRepositories(userDataPath: string): Promise<CliRepositoryRow[]> {
  const content = await readSqliteJson(userDataPath, 'SELECT id, name, project_id, local_path, current_branch FROM repositories ORDER BY name ASC')
  return mapSqliteRepositories(content)
}
