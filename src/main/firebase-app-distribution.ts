import { readFile } from 'node:fs/promises'

export type ProjectFirebaseReleaseSettingsInput = {
  projectId: string
  enabled?: boolean
  appId?: string
  artifactPath?: string
  buildScript?: string
  groups?: string[] | string
  testers?: string[] | string
  serviceAccountKey?: string
  serviceAccountKeyFilePath?: string
}

export type ProjectFirebaseReleaseSettings = {
  projectId: string
  enabled: boolean
  active: boolean
  appId: string
  artifactPath: string
  buildScript: string
  groups: string[]
  testers: string[]
  serviceAccountProjectId: string
  serviceAccountEmail: string
  serviceAccountKeyConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type ResolvedProjectFirebaseReleaseSettings = ProjectFirebaseReleaseSettings & {
  serviceAccountKey: string
}

type DatabaseStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

type DatabaseLike = {
  exec: (sql: string) => void
  prepare: (sql: string) => DatabaseStatement
}

type FirebaseServiceAccount = {
  type?: unknown
  project_id?: unknown
  client_email?: unknown
  private_key?: unknown
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseJsonArray(value: unknown): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed.map(trimText).filter(Boolean) : []
  } catch {
    return []
  }
}

function normalizeList(value: string[] | string | undefined): string[] {
  const values = Array.isArray(value) ? value : String(value ?? '').split(/[\n,]/)
  return Array.from(new Set(values.map(trimText).filter(Boolean)))
}

function assertProjectExists(db: DatabaseLike, projectId: string): string {
  const normalizedProjectId = trimText(projectId)

  if (!normalizedProjectId) {
    throw new Error('缺少 ForgeDesk 项目 ID')
  }

  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(normalizedProjectId)) {
    throw new Error('项目不存在')
  }

  return normalizedProjectId
}

function parseServiceAccountKey(value: string): { normalized: string; details: Required<Pick<FirebaseServiceAccount, 'project_id' | 'client_email' | 'private_key'>> } {
  let parsed: FirebaseServiceAccount

  try {
    parsed = JSON.parse(value) as FirebaseServiceAccount
  } catch {
    throw new Error('Firebase Service Account key 不是有效的 JSON')
  }

  const projectId = trimText(parsed.project_id)
  const clientEmail = trimText(parsed.client_email)
  const privateKey = trimText(parsed.private_key)

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Service Account key 缺少 project_id、client_email 或 private_key')
  }

  return {
    normalized: JSON.stringify(parsed),
    details: {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey
    }
  }
}

function mapSettingsRow(row: Record<string, unknown>, includeSecret = false): ProjectFirebaseReleaseSettings | ResolvedProjectFirebaseReleaseSettings {
  const serviceAccountKey = String(row.service_account_key ?? '')
  const serviceAccount = serviceAccountKey ? parseServiceAccountKey(serviceAccountKey).details : null
  const appId = String(row.app_id ?? '')
  const artifactPath = String(row.artifact_path ?? '')
  const active = Number(row.enabled ?? 0) === 1 && Boolean(appId && artifactPath && serviceAccountKey)
  const settings: ProjectFirebaseReleaseSettings = {
    projectId: String(row.project_id ?? ''),
    enabled: Number(row.enabled ?? 0) === 1,
    active,
    appId,
    artifactPath,
    buildScript: String(row.build_script ?? ''),
    groups: parseJsonArray(row.groups_json),
    testers: parseJsonArray(row.testers_json),
    serviceAccountProjectId: String(serviceAccount?.project_id ?? ''),
    serviceAccountEmail: String(serviceAccount?.client_email ?? ''),
    serviceAccountKeyConfigured: Boolean(serviceAccountKey),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }

  return includeSecret ? { ...settings, serviceAccountKey } : settings
}

function getProjectFirebaseReleaseSettingsSecret(db: DatabaseLike, projectId: string): ResolvedProjectFirebaseReleaseSettings | null {
  const row = db.prepare('SELECT * FROM project_firebase_release_settings WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined
  return row ? mapSettingsRow(row, true) as ResolvedProjectFirebaseReleaseSettings : null
}

export function migrateProjectFirebaseReleaseTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_firebase_release_settings (
      project_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      app_id TEXT NOT NULL DEFAULT '',
      artifact_path TEXT NOT NULL DEFAULT '',
      build_script TEXT NOT NULL DEFAULT 'package:android',
      groups_json TEXT NOT NULL DEFAULT '[]',
      testers_json TEXT NOT NULL DEFAULT '[]',
      service_account_key TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export function getProjectFirebaseReleaseSettings(db: DatabaseLike, projectId: string): ProjectFirebaseReleaseSettings | null {
  const normalizedProjectId = assertProjectExists(db, projectId)
  const row = db.prepare('SELECT * FROM project_firebase_release_settings WHERE project_id = ?').get(normalizedProjectId) as Record<string, unknown> | undefined
  return row ? mapSettingsRow(row) as ProjectFirebaseReleaseSettings : null
}

export async function saveProjectFirebaseReleaseSettings(
  db: DatabaseLike,
  input: ProjectFirebaseReleaseSettingsInput
): Promise<ProjectFirebaseReleaseSettings> {
  const projectId = assertProjectExists(db, input.projectId)
  const existing = getProjectFirebaseReleaseSettingsSecret(db, projectId)
  const appId = trimText(input.appId ?? existing?.appId)
  const artifactPath = trimText(input.artifactPath ?? existing?.artifactPath)
  const buildScript = input.buildScript === undefined ? (existing?.buildScript ?? 'package:android') : trimText(input.buildScript)
  const groups = input.groups === undefined ? (existing?.groups ?? []) : normalizeList(input.groups)
  const testers = input.testers === undefined ? (existing?.testers ?? []) : normalizeList(input.testers)
  const enabled = input.enabled === undefined ? (existing?.enabled ?? false) : input.enabled === true
  let serviceAccountKey = existing?.serviceAccountKey ?? ''

  if (input.serviceAccountKeyFilePath) {
    try {
      serviceAccountKey = await readFile(input.serviceAccountKeyFilePath, 'utf8')
    } catch {
      throw new Error('无法读取 Firebase Service Account key 文件')
    }
  } else if (trimText(input.serviceAccountKey)) {
    serviceAccountKey = trimText(input.serviceAccountKey)
  }

  if (serviceAccountKey) {
    serviceAccountKey = parseServiceAccountKey(serviceAccountKey).normalized
  }

  if (enabled && !appId) {
    throw new Error('启用 Firebase 发布前请输入 Firebase App ID')
  }

  if (enabled && !artifactPath) {
    throw new Error('启用 Firebase 发布前请输入构建产物路径')
  }

  if (enabled && !serviceAccountKey) {
    throw new Error('启用 Firebase 发布前请选择或粘贴 Service Account key')
  }

  const now = nowIso()

  if (existing) {
    db.prepare(
      `
        UPDATE project_firebase_release_settings
        SET enabled = ?, app_id = ?, artifact_path = ?, build_script = ?, groups_json = ?, testers_json = ?, service_account_key = ?, updated_at = ?
        WHERE project_id = ?
      `
    ).run(enabled ? 1 : 0, appId, artifactPath, buildScript, JSON.stringify(groups), JSON.stringify(testers), serviceAccountKey, now, projectId)
  } else {
    db.prepare(
      `
        INSERT INTO project_firebase_release_settings (
          project_id, enabled, app_id, artifact_path, build_script, groups_json, testers_json, service_account_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(projectId, enabled ? 1 : 0, appId, artifactPath, buildScript, JSON.stringify(groups), JSON.stringify(testers), serviceAccountKey, now, now)
  }

  const settings = getProjectFirebaseReleaseSettings(db, projectId)

  if (!settings) {
    throw new Error('Firebase 发布配置保存失败')
  }

  return settings
}

export function deleteProjectFirebaseReleaseSettings(db: DatabaseLike, projectId: string): void {
  const normalizedProjectId = assertProjectExists(db, projectId)
  db.prepare('DELETE FROM project_firebase_release_settings WHERE project_id = ?').run(normalizedProjectId)
}

export function resolveProjectFirebaseReleaseSettings(db: DatabaseLike, projectId: string): ResolvedProjectFirebaseReleaseSettings {
  const normalizedProjectId = assertProjectExists(db, projectId)
  const settings = getProjectFirebaseReleaseSettingsSecret(db, normalizedProjectId)

  if (!settings || !settings.active) {
    throw new Error('请先在项目设置里启用并完成 Firebase App Distribution 配置')
  }

  return settings
}
