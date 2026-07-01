export type PlaneSettingsInput = {
  apiBaseUrl?: string
  webBaseUrl?: string
  apiToken?: string
}

export type PlaneSettings = {
  apiBaseUrl: string
  webBaseUrl: string
  apiToken: string
  tokenConfigured: boolean
}

export type PlaneConnectionTestResult = {
  ok: boolean
  message: string
  userName: string
  userEmail: string
}

export type PlaneProject = {
  id: string
  name: string
  identifier: string
  description: string
  totalMembers: number
  totalCycles: number
  totalModules: number
}

export type PlaneProjectBindingInput = {
  projectId: string
  workspaceSlug: string
  planeProjectId: string
  planeProjectName: string
  planeProjectIdentifier: string
}

export type PlaneProjectBinding = PlaneProjectBindingInput & {
  createdAt: string
  updatedAt: string
}

export type PlaneProjectSummary = {
  id: string
  name: string
  identifier: string
  counts: {
    members: number
    states: number
    labels: number
    cycles: number
    modules: number
    issues: number
    intakes: number
    pages: number
  }
}

export type PlaneWorkItem = {
  id: string
  name: string
  identifier: string
  sequenceId: string
  priority: string
  stateName: string
  stateGroup: string
  assigneeNames: string[]
  targetDate: string
  updatedAt: string
  url: string
}

export type PlaneCycle = {
  id: string
  name: string
  startDate: string
  endDate: string
  totalIssues: number
  completedIssues: number
  cancelledIssues: number
  updatedAt: string
  url: string
}

export type PlaneModule = {
  id: string
  name: string
  status: string
  targetDate: string
  totalIssues: number
  completedIssues: number
  cancelledIssues: number
  updatedAt: string
  url: string
}

export type PlaneProjectContent = {
  binding: PlaneProjectBinding
  projectUrl: string
  summary: PlaneProjectSummary
  workItems: PlaneWorkItem[]
  cycles: PlaneCycle[]
  modules: PlaneModule[]
  fetchedAt: string
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

export type PlaneFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

type PlaneListResponse = {
  results: unknown[]
  nextPage: boolean
  nextCursor: string
}

const defaultPlaneSettings: PlaneSettings = {
  apiBaseUrl: 'http://localhost:8000',
  webBaseUrl: 'http://localhost:3000',
  apiToken: '',
  tokenConfigured: false
}

function nowIso(): string {
  return new Date().toISOString()
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  const raw = trimText(value) || fallback

  try {
    const url = new URL(raw)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }

    url.pathname = url.pathname.replace(/\/+$/, '')
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new Error('请输入有效的 Plane URL')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return 0
}

function boolField(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => record[key] === true || record[key] === 'true')
}

function nestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(record[key])
}

function normalizeSettingsInput(input: PlaneSettingsInput, existing?: PlaneSettings): PlaneSettings {
  const apiToken = input.apiToken === undefined ? existing?.apiToken ?? '' : trimText(input.apiToken)
  const settings = {
    apiBaseUrl: normalizeBaseUrl(input.apiBaseUrl ?? existing?.apiBaseUrl, defaultPlaneSettings.apiBaseUrl),
    webBaseUrl: normalizeBaseUrl(input.webBaseUrl ?? existing?.webBaseUrl, defaultPlaneSettings.webBaseUrl),
    apiToken,
    tokenConfigured: Boolean(apiToken)
  }

  return settings
}

function readStoredSettings(db: DatabaseLike): PlaneSettings {
  const row = db.prepare('SELECT * FROM plane_settings WHERE id = ?').get('default') as Record<string, unknown> | undefined

  if (!row) {
    return defaultPlaneSettings
  }

  const apiToken = String(row.api_token ?? '')

  return {
    apiBaseUrl: String(row.api_base_url ?? defaultPlaneSettings.apiBaseUrl),
    webBaseUrl: String(row.web_base_url ?? defaultPlaneSettings.webBaseUrl),
    apiToken,
    tokenConfigured: Boolean(apiToken)
  }
}

function getSettingsSecret(db: DatabaseLike, input?: PlaneSettingsInput): PlaneSettings {
  const existing = readStoredSettings(db)
  return input ? normalizeSettingsInput(input, existing) : existing
}

function redactSettings(settings: PlaneSettings): PlaneSettings {
  return {
    ...settings,
    apiToken: '',
    tokenConfigured: Boolean(settings.apiToken)
  }
}

function createPlaneUrl(baseUrl: string, path: string, params: Record<string, string | number | undefined> = {}): URL {
  const url = new URL(path.replace(/^\/+/, ''), `${baseUrl}/`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

function createPlaneHeaders(settings: PlaneSettings): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': settings.apiToken
  }
}

async function parsePlaneError(response: Response): Promise<string> {
  try {
    const text = await response.text()
    const parsed = JSON.parse(text) as Record<string, unknown>
    const error = stringField(parsed, 'error', 'detail', 'message')

    if (error) {
      return error
    }

    return text || response.statusText
  } catch {
    return response.statusText
  }
}

async function fetchPlaneJson(settings: PlaneSettings, path: string, params: Record<string, string | number | undefined> = {}, fetcher: PlaneFetch = fetch): Promise<unknown> {
  if (!settings.apiToken) {
    throw new Error('请先配置 Plane API Token')
  }

  const response = await fetcher(createPlaneUrl(settings.apiBaseUrl, path, params), {
    headers: createPlaneHeaders(settings)
  })

  if (!response.ok) {
    const message = await parsePlaneError(response)
    throw new Error(`Plane API 请求失败（${response.status}）：${message}`)
  }

  return response.json()
}

function normalizeListResponse(value: unknown): PlaneListResponse {
  if (Array.isArray(value)) {
    return {
      results: value,
      nextPage: false,
      nextCursor: ''
    }
  }

  const record = asRecord(value)
  const results = asArray(record.results)

  return {
    results,
    nextPage: boolField(record, 'next_page_results', 'nextPageResults'),
    nextCursor: stringField(record, 'next_cursor', 'nextCursor')
  }
}

async function fetchPlaneList(settings: PlaneSettings, path: string, params: Record<string, string | number | undefined> = {}, fetcher: PlaneFetch = fetch): Promise<unknown[]> {
  const results: unknown[] = []
  let cursor = ''

  for (let page = 0; page < 20; page += 1) {
    const response = normalizeListResponse(
      await fetchPlaneJson(
        settings,
        path,
        {
          per_page: 50,
          ...params,
          cursor: cursor || undefined
        },
        fetcher
      )
    )
    results.push(...response.results)

    if (!response.nextPage || !response.nextCursor || response.nextCursor === cursor) {
      break
    }

    cursor = response.nextCursor
  }

  return results
}

function normalizePlaneProject(value: unknown): PlaneProject {
  const record = asRecord(value)

  return {
    id: stringField(record, 'id'),
    name: stringField(record, 'name'),
    identifier: stringField(record, 'identifier'),
    description: stringField(record, 'description'),
    totalMembers: numberField(record, 'total_members', 'totalMembers'),
    totalCycles: numberField(record, 'total_cycles', 'totalCycles'),
    totalModules: numberField(record, 'total_modules', 'totalModules')
  }
}

function normalizePlaneSummary(value: unknown): PlaneProjectSummary {
  const record = asRecord(value)
  const counts = asRecord(record.counts)

  return {
    id: stringField(record, 'id'),
    name: stringField(record, 'name'),
    identifier: stringField(record, 'identifier'),
    counts: {
      members: numberField(counts, 'members'),
      states: numberField(counts, 'states'),
      labels: numberField(counts, 'labels'),
      cycles: numberField(counts, 'cycles'),
      modules: numberField(counts, 'modules'),
      issues: numberField(counts, 'issues'),
      intakes: numberField(counts, 'intakes'),
      pages: numberField(counts, 'pages')
    }
  }
}

function getStateName(record: Record<string, unknown>): string {
  const state = nestedRecord(record, 'state_detail')
  return stringField(state, 'name') || stringField(nestedRecord(record, 'state'), 'name') || stringField(record, 'state')
}

function getStateGroup(record: Record<string, unknown>): string {
  const state = nestedRecord(record, 'state_detail')
  return stringField(state, 'group') || stringField(nestedRecord(record, 'state'), 'group')
}

function getAssigneeNames(record: Record<string, unknown>): string[] {
  const assignees = asArray(record.assignee_details || record.assignees)

  return assignees
    .map((item) => {
      const assignee = asRecord(item)
      return stringField(assignee, 'display_name', 'displayName', 'first_name', 'email', 'id') || String(item ?? '')
    })
    .filter(Boolean)
}

function buildPlaneWebPath(settings: PlaneSettings, binding: PlaneProjectBinding, suffix = 'issues'): string {
  return `${settings.webBaseUrl}/${encodeURIComponent(binding.workspaceSlug)}/projects/${encodeURIComponent(binding.planeProjectId)}/${suffix.replace(/^\/+/, '')}`
}

function normalizePlaneWorkItem(value: unknown, settings: PlaneSettings, binding: PlaneProjectBinding): PlaneWorkItem {
  const record = asRecord(value)
  const id = stringField(record, 'id')
  const sequenceId = stringField(record, 'sequence_id', 'sequenceId')
  const issueIdentifier = binding.planeProjectIdentifier && sequenceId ? `${binding.planeProjectIdentifier}-${sequenceId}` : sequenceId

  return {
    id,
    name: stringField(record, 'name'),
    identifier: issueIdentifier,
    sequenceId,
    priority: stringField(record, 'priority'),
    stateName: getStateName(record),
    stateGroup: getStateGroup(record),
    assigneeNames: getAssigneeNames(record),
    targetDate: stringField(record, 'target_date', 'targetDate'),
    updatedAt: stringField(record, 'updated_at', 'updatedAt'),
    url: `${settings.webBaseUrl}/${encodeURIComponent(binding.workspaceSlug)}/projects/${encodeURIComponent(binding.planeProjectId)}/issues/${encodeURIComponent(id)}`
  }
}

function normalizePlaneCycle(value: unknown, settings: PlaneSettings, binding: PlaneProjectBinding): PlaneCycle {
  const record = asRecord(value)
  const id = stringField(record, 'id')

  return {
    id,
    name: stringField(record, 'name'),
    startDate: stringField(record, 'start_date', 'startDate'),
    endDate: stringField(record, 'end_date', 'endDate'),
    totalIssues: numberField(record, 'total_issues', 'totalIssues'),
    completedIssues: numberField(record, 'completed_issues', 'completedIssues'),
    cancelledIssues: numberField(record, 'cancelled_issues', 'cancelledIssues'),
    updatedAt: stringField(record, 'updated_at', 'updatedAt'),
    url: `${settings.webBaseUrl}/${encodeURIComponent(binding.workspaceSlug)}/projects/${encodeURIComponent(binding.planeProjectId)}/cycles/${encodeURIComponent(id)}`
  }
}

function normalizePlaneModule(value: unknown, settings: PlaneSettings, binding: PlaneProjectBinding): PlaneModule {
  const record = asRecord(value)
  const id = stringField(record, 'id')

  return {
    id,
    name: stringField(record, 'name'),
    status: stringField(record, 'status'),
    targetDate: stringField(record, 'target_date', 'targetDate'),
    totalIssues: numberField(record, 'total_issues', 'totalIssues'),
    completedIssues: numberField(record, 'completed_issues', 'completedIssues'),
    cancelledIssues: numberField(record, 'cancelled_issues', 'cancelledIssues'),
    updatedAt: stringField(record, 'updated_at', 'updatedAt'),
    url: `${settings.webBaseUrl}/${encodeURIComponent(binding.workspaceSlug)}/projects/${encodeURIComponent(binding.planeProjectId)}/modules/${encodeURIComponent(id)}`
  }
}

function mapBindingRow(row: Record<string, unknown>): PlaneProjectBinding {
  return {
    projectId: String(row.project_id ?? ''),
    workspaceSlug: String(row.workspace_slug ?? ''),
    planeProjectId: String(row.plane_project_id ?? ''),
    planeProjectName: String(row.plane_project_name ?? ''),
    planeProjectIdentifier: String(row.plane_project_identifier ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

export function migratePlaneIntegrationTables(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plane_settings (
      id TEXT PRIMARY KEY,
      api_base_url TEXT NOT NULL,
      web_base_url TEXT NOT NULL,
      api_token TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_plane_bindings (
      project_id TEXT PRIMARY KEY,
      workspace_slug TEXT NOT NULL,
      plane_project_id TEXT NOT NULL,
      plane_project_name TEXT NOT NULL DEFAULT '',
      plane_project_identifier TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export function getPlaneSettings(db: DatabaseLike): PlaneSettings {
  return redactSettings(readStoredSettings(db))
}

export function savePlaneSettings(db: DatabaseLike, input: PlaneSettingsInput): PlaneSettings {
  const settings = normalizeSettingsInput(input, readStoredSettings(db))
  const existing = db.prepare('SELECT id FROM plane_settings WHERE id = ?').get('default')
  const now = nowIso()

  if (existing) {
    db.prepare('UPDATE plane_settings SET api_base_url = ?, web_base_url = ?, api_token = ?, updated_at = ? WHERE id = ?').run(
      settings.apiBaseUrl,
      settings.webBaseUrl,
      settings.apiToken,
      now,
      'default'
    )
  } else {
    db.prepare('INSERT INTO plane_settings (id, api_base_url, web_base_url, api_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'default',
      settings.apiBaseUrl,
      settings.webBaseUrl,
      settings.apiToken,
      now,
      now
    )
  }

  return getPlaneSettings(db)
}

export async function testPlaneConnection(db: DatabaseLike, input?: PlaneSettingsInput, fetcher: PlaneFetch = fetch): Promise<PlaneConnectionTestResult> {
  try {
    const settings = getSettingsSecret(db, input)
    const user = asRecord(await fetchPlaneJson(settings, '/api/v1/users/me/', {}, fetcher))
    const userName = stringField(user, 'display_name', 'displayName', 'first_name', 'email', 'id')
    const userEmail = stringField(user, 'email')

    return {
      ok: true,
      message: userName ? `Plane 连接成功：${userName}` : 'Plane 连接成功',
      userName,
      userEmail
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Plane 连接失败',
      userName: '',
      userEmail: ''
    }
  }
}

export async function listPlaneProjects(db: DatabaseLike, workspaceSlug: string, fetcher: PlaneFetch = fetch): Promise<PlaneProject[]> {
  const slug = trimText(workspaceSlug)

  if (!slug) {
    throw new Error('请输入 Plane workspace slug')
  }

  const settings = getSettingsSecret(db)
  const projects = await fetchPlaneList(settings, `/api/v1/workspaces/${encodeURIComponent(slug)}/projects/`, {}, fetcher)
  return projects.map(normalizePlaneProject).filter((project) => project.id)
}

export function getProjectPlaneBinding(db: DatabaseLike, projectId: string): PlaneProjectBinding | null {
  const row = db.prepare('SELECT * FROM project_plane_bindings WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined
  return row ? mapBindingRow(row) : null
}

export function saveProjectPlaneBinding(db: DatabaseLike, input: PlaneProjectBindingInput): PlaneProjectBinding {
  const projectId = trimText(input.projectId)
  const workspaceSlug = trimText(input.workspaceSlug)
  const planeProjectId = trimText(input.planeProjectId)

  if (!projectId) {
    throw new Error('缺少 ForgeDesk 项目 ID')
  }

  if (!workspaceSlug) {
    throw new Error('请输入 Plane workspace slug')
  }

  if (!planeProjectId) {
    throw new Error('请选择 Plane 项目')
  }

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)

  if (!project) {
    throw new Error('项目不存在')
  }

  const existing = getProjectPlaneBinding(db, projectId)
  const now = nowIso()

  if (existing) {
    db.prepare(
      `
      UPDATE project_plane_bindings
      SET workspace_slug = ?, plane_project_id = ?, plane_project_name = ?, plane_project_identifier = ?, updated_at = ?
      WHERE project_id = ?
    `
    ).run(workspaceSlug, planeProjectId, trimText(input.planeProjectName), trimText(input.planeProjectIdentifier), now, projectId)
  } else {
    db.prepare(
      `
      INSERT INTO project_plane_bindings (project_id, workspace_slug, plane_project_id, plane_project_name, plane_project_identifier, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(projectId, workspaceSlug, planeProjectId, trimText(input.planeProjectName), trimText(input.planeProjectIdentifier), now, now)
  }

  const binding = getProjectPlaneBinding(db, projectId)

  if (!binding) {
    throw new Error('Plane 绑定保存失败')
  }

  return binding
}

export function deleteProjectPlaneBinding(db: DatabaseLike, projectId: string): void {
  db.prepare('DELETE FROM project_plane_bindings WHERE project_id = ?').run(projectId)
}

export async function getPlaneProjectContent(db: DatabaseLike, projectId: string, fetcher: PlaneFetch = fetch): Promise<PlaneProjectContent> {
  const settings = getSettingsSecret(db)
  const binding = getProjectPlaneBinding(db, projectId)

  if (!binding) {
    throw new Error('请先在项目设置里绑定 Plane 项目')
  }

  const basePath = `/api/v1/workspaces/${encodeURIComponent(binding.workspaceSlug)}/projects/${encodeURIComponent(binding.planeProjectId)}`
  const [summary, workItems, cycles, modules] = await Promise.all([
    fetchPlaneJson(settings, `${basePath}/summary/`, {}, fetcher).then(normalizePlaneSummary),
    fetchPlaneList(settings, `${basePath}/work-items/`, { order_by: '-updated_at' }, fetcher).then((items) =>
      items.map((item) => normalizePlaneWorkItem(item, settings, binding)).filter((item) => item.id)
    ),
    fetchPlaneList(settings, `${basePath}/cycles/`, { order_by: '-updated_at' }, fetcher).then((items) =>
      items.map((item) => normalizePlaneCycle(item, settings, binding)).filter((item) => item.id)
    ),
    fetchPlaneList(settings, `${basePath}/modules/`, { order_by: '-updated_at' }, fetcher).then((items) =>
      items.map((item) => normalizePlaneModule(item, settings, binding)).filter((item) => item.id)
    )
  ])

  return {
    binding,
    projectUrl: buildPlaneWebPath(settings, binding, 'issues'),
    summary,
    workItems,
    cycles,
    modules,
    fetchedAt: nowIso()
  }
}

export function getPlaneProjectWebUrl(db: DatabaseLike, projectId: string): string {
  const settings = getSettingsSecret(db)
  const binding = getProjectPlaneBinding(db, projectId)

  if (!binding) {
    return settings.webBaseUrl
  }

  return buildPlaneWebPath(settings, binding, 'issues')
}
