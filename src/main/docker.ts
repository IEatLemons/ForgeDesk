import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { createGuiToolFallbackPath, mergePathValues } from './shell-environment.js'

export type DockerResourceType = 'image' | 'container'

export type DockerResourceNoteRecord = {
  resourceType: DockerResourceType
  resourceKey: string
  displayName: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type DockerResourceNoteInput = {
  resourceType: DockerResourceType
  resourceKey: string
  displayName?: string
  notes?: string
}

export type DockerImageSummary = {
  id: string
  shortId: string
  repository: string
  tag: string
  digest: string
  size: string
  createdAt: string
  createdSince: string
  reference: string
  tagResourceKey: string
  imageIdResourceKey: string
  noteResourceKey: string
  displayName: string
  note: DockerResourceNoteRecord | null
}

export type DockerContainerSummary = {
  id: string
  shortId: string
  name: string
  image: string
  state: string
  status: string
  ports: string
  createdAt: string
  runningFor: string
  noteResourceKey: string
  displayName: string
  note: DockerResourceNoteRecord | null
}

export type DockerContainerPortDetail = {
  privatePort: string
  type: string
  hostIp: string
  hostPort: string
}

export type DockerContainerMountDetail = {
  type: string
  source: string
  destination: string
  mode: string
  rw: boolean
  name: string
}

export type DockerContainerNetworkDetail = {
  name: string
  networkId: string
  ipAddress: string
  gateway: string
  macAddress: string
}

export type DockerContainerDetail = {
  id: string
  shortId: string
  name: string
  image: string
  imageName: string
  createdAt: string
  startedAt: string
  finishedAt: string
  status: string
  running: boolean
  paused: boolean
  restarting: boolean
  pid: number
  exitCode: number
  restartCount: number
  platform: string
  driver: string
  hostname: string
  user: string
  workingDir: string
  entrypoint: string[]
  command: string[]
  env: string[]
  ports: DockerContainerPortDetail[]
  mounts: DockerContainerMountDetail[]
  networks: DockerContainerNetworkDetail[]
  labels: Record<string, string>
  networkMode: string
  restartPolicy: string
  rawJson: string
}

export type DockerSnapshot = {
  images: DockerImageSummary[]
  containers: DockerContainerSummary[]
  notes: DockerResourceNoteRecord[]
  checkedAt: string
}

export type DockerEventSummary = {
  id: string
  type: string
  action: string
  status: string
  time: string
  actorAttributes: Record<string, string>
}

type DockerStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

export type DockerDatabase = {
  exec: (sql: string) => unknown
  prepare: (sql: string) => DockerStatement
}

export type DockerCommandRunner = (args: string[]) => Promise<string>

export type DockerExecFileRunner = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv },
  callback: (error: DockerProcessError | null, stdout: string | Buffer, stderr: string | Buffer) => void
) => void

type DockerProcessError = Error & {
  code?: string | number
  killed?: boolean
  signal?: string | null
}

export type DockerSnapshotInput = {
  images: DockerImageSummary[]
  containers: DockerContainerSummary[]
  notes: DockerResourceNoteRecord[]
  checkedAt?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDockerPlaceholder(value: unknown): string {
  const normalized = trimText(value)
  return normalized === '<none>' ? '' : normalized
}

function normalizeDockerId(value: unknown): string {
  return trimText(value)
}

function shortenDockerId(value: string): string {
  return value.replace(/^sha256:/, '').slice(0, 12)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((record) => Object.keys(record).length > 0) : []
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string') {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ''
}

function stringArrayField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '')).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : []
  }

  return []
}

function booleanField(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(asRecord(value)).map(([key, entryValue]) => [key, String(entryValue ?? '')]))
}

function normalizeResourceType(value: unknown): DockerResourceType {
  if (value === 'image' || value === 'container') {
    return value
  }

  throw new Error('Docker 备注类型只支持 image 或 container')
}

function normalizeResourceKey(value: unknown): string {
  const resourceKey = trimText(value)

  if (!resourceKey) {
    throw new Error('缺少 Docker 资源标识')
  }

  return resourceKey
}

function mapDockerNoteRow(row: Record<string, unknown>): DockerResourceNoteRecord {
  return {
    resourceType: normalizeResourceType(row.resource_type),
    resourceKey: String(row.resource_key ?? ''),
    displayName: String(row.display_name ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function getDockerResourceNote(db: DockerDatabase, resourceType: DockerResourceType, resourceKey: string): DockerResourceNoteRecord | null {
  const row = db
    .prepare('SELECT * FROM docker_resource_notes WHERE resource_type = ? AND resource_key = ?')
    .get(resourceType, resourceKey) as Record<string, unknown> | undefined

  return row ? mapDockerNoteRow(row) : null
}

function createDockerNoteMap(notes: DockerResourceNoteRecord[]): Map<string, DockerResourceNoteRecord> {
  return new Map(notes.map((note) => [`${note.resourceType}:${note.resourceKey}`, note]))
}

function getMappedNote(noteMap: Map<string, DockerResourceNoteRecord>, resourceType: DockerResourceType, resourceKey: string): DockerResourceNoteRecord | null {
  return noteMap.get(`${resourceType}:${resourceKey}`) ?? null
}

export function getDockerImageTagResourceKey(repository: string, tag: string): string {
  return repository && tag ? `image-tag:${repository}:${tag}` : ''
}

export function getDockerImageIdResourceKey(imageId: string): string {
  return `image-id:${imageId}`
}

export function getDockerContainerResourceKey(containerId: string): string {
  return `container:${containerId}`
}

export function migrateDockerTables(db: DockerDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS docker_resource_notes (
      resource_type TEXT NOT NULL,
      resource_key TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (resource_type, resource_key)
    );
  `)
}

export function listDockerResourceNotes(db: DockerDatabase): DockerResourceNoteRecord[] {
  return db
    .prepare('SELECT * FROM docker_resource_notes ORDER BY resource_type ASC, resource_key ASC')
    .all()
    .map((row) => mapDockerNoteRow(row as Record<string, unknown>))
}

export function saveDockerResourceNote(db: DockerDatabase, input: DockerResourceNoteInput): DockerResourceNoteRecord {
  const resourceType = normalizeResourceType(input.resourceType)
  const resourceKey = normalizeResourceKey(input.resourceKey)
  const displayName = trimText(input.displayName)
  const notes = trimText(input.notes)
  const existing = getDockerResourceNote(db, resourceType, resourceKey)
  const createdAt = existing?.createdAt || nowIso()
  const updatedAt = nowIso()

  db.prepare(
    `
    INSERT INTO docker_resource_notes (resource_type, resource_key, display_name, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(resource_type, resource_key) DO UPDATE SET
      display_name = excluded.display_name,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `
  ).run(resourceType, resourceKey, displayName, notes, createdAt, updatedAt)

  const note = getDockerResourceNote(db, resourceType, resourceKey)

  if (!note) {
    throw new Error('Docker 备注保存失败')
  }

  return note
}

export function deleteDockerResourceNote(db: DockerDatabase, resourceType: DockerResourceType, resourceKey: string): DockerResourceNoteRecord[] {
  db.prepare('DELETE FROM docker_resource_notes WHERE resource_type = ? AND resource_key = ?').run(normalizeResourceType(resourceType), normalizeResourceKey(resourceKey))
  return listDockerResourceNotes(db)
}

function parseDockerJsonLines(content: string): Record<string, unknown>[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [asRecord(JSON.parse(line))]
      } catch {
        return []
      }
    })
    .filter((row) => Object.keys(row).length > 0)
}

function mapDockerImageRow(row: Record<string, unknown>): DockerImageSummary | null {
  const id = normalizeDockerId(stringField(row, 'ID', 'Id', 'id'))

  if (!id) {
    return null
  }

  const repository = normalizeDockerPlaceholder(stringField(row, 'Repository', 'repository'))
  const tag = normalizeDockerPlaceholder(stringField(row, 'Tag', 'tag'))
  const digest = normalizeDockerPlaceholder(stringField(row, 'Digest', 'digest'))
  const tagResourceKey = getDockerImageTagResourceKey(repository, tag)
  const imageIdResourceKey = getDockerImageIdResourceKey(id)
  const reference = tagResourceKey ? `${repository}:${tag}` : '<untagged>'

  return {
    id,
    shortId: shortenDockerId(id),
    repository,
    tag,
    digest,
    size: stringField(row, 'Size', 'size'),
    createdAt: stringField(row, 'CreatedAt', 'createdAt'),
    createdSince: stringField(row, 'CreatedSince', 'createdSince'),
    reference,
    tagResourceKey,
    imageIdResourceKey,
    noteResourceKey: tagResourceKey || imageIdResourceKey,
    displayName: reference,
    note: null
  }
}

function mapDockerContainerRow(row: Record<string, unknown>): DockerContainerSummary | null {
  const id = normalizeDockerId(stringField(row, 'ID', 'Id', 'id'))

  if (!id) {
    return null
  }

  const name = stringField(row, 'Names', 'Name', 'names', 'name')
    .replace(/^\/+/, '')
    .split(',')
    .map((item) => item.trim().replace(/^\/+/, ''))
    .filter(Boolean)
    .join(', ')
  const noteResourceKey = getDockerContainerResourceKey(id)

  return {
    id,
    shortId: shortenDockerId(id),
    name,
    image: stringField(row, 'Image', 'image'),
    state: stringField(row, 'State', 'state'),
    status: stringField(row, 'Status', 'status'),
    ports: stringField(row, 'Ports', 'ports'),
    createdAt: stringField(row, 'CreatedAt', 'createdAt'),
    runningFor: stringField(row, 'RunningFor', 'runningFor'),
    noteResourceKey,
    displayName: name || shortenDockerId(id),
    note: null
  }
}

export function parseDockerImageLines(content: string): DockerImageSummary[] {
  return parseDockerJsonLines(content).flatMap((row) => {
    const image = mapDockerImageRow(row)
    return image ? [image] : []
  })
}

export function parseDockerContainerLines(content: string): DockerContainerSummary[] {
  return parseDockerJsonLines(content).flatMap((row) => {
    const container = mapDockerContainerRow(row)
    return container ? [container] : []
  })
}

function parseDockerInspectObject(content: string): Record<string, unknown> {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Docker 容器详情解析失败')
  }

  const candidate = Array.isArray(parsed) ? parsed[0] : parsed
  const record = asRecord(candidate)

  if (Object.keys(record).length === 0) {
    throw new Error('Docker 容器详情为空')
  }

  return record
}

function normalizeDockerTimestamp(value: string): string {
  return value.startsWith('0001-01-01') ? '' : value
}

function mapDockerPorts(value: unknown): DockerContainerPortDetail[] {
  return Object.entries(asRecord(value)).flatMap(([key, bindingValue]) => {
    const match = key.match(/^(.+)\/(.+)$/)
    const privatePort = match?.[1] ?? key
    const type = match?.[2] ?? ''
    const bindings = Array.isArray(bindingValue) ? bindingValue.map(asRecord) : []

    if (bindings.length === 0) {
      return [{ privatePort, type, hostIp: '', hostPort: '' }]
    }

    return bindings.map((binding) => ({
      privatePort,
      type,
      hostIp: stringField(binding, 'HostIp'),
      hostPort: stringField(binding, 'HostPort')
    }))
  })
}

function mapDockerMounts(value: unknown): DockerContainerMountDetail[] {
  return asRecordArray(value).map((mount) => ({
    type: stringField(mount, 'Type'),
    source: stringField(mount, 'Source'),
    destination: stringField(mount, 'Destination'),
    mode: stringField(mount, 'Mode'),
    rw: booleanField(mount, 'RW'),
    name: stringField(mount, 'Name')
  }))
}

function mapDockerNetworks(value: unknown): DockerContainerNetworkDetail[] {
  return Object.entries(asRecord(value)).map(([name, networkValue]) => {
    const network = asRecord(networkValue)

    return {
      name,
      networkId: stringField(network, 'NetworkID'),
      ipAddress: stringField(network, 'IPAddress'),
      gateway: stringField(network, 'Gateway'),
      macAddress: stringField(network, 'MacAddress')
    }
  })
}

export function parseDockerContainerInspect(content: string): DockerContainerDetail {
  const record = parseDockerInspectObject(content)
  const id = normalizeDockerId(stringField(record, 'Id', 'ID', 'id'))

  if (!id) {
    throw new Error('Docker 容器详情缺少容器 ID')
  }

  const state = asRecord(record.State)
  const config = asRecord(record.Config)
  const hostConfig = asRecord(record.HostConfig)
  const restartPolicy = asRecord(hostConfig.RestartPolicy)
  const networkSettings = asRecord(record.NetworkSettings)
  const name = stringField(record, 'Name').replace(/^\/+/, '')

  return {
    id,
    shortId: shortenDockerId(id),
    name: name || shortenDockerId(id),
    image: stringField(record, 'Image'),
    imageName: stringField(config, 'Image') || stringField(record, 'Image'),
    createdAt: stringField(record, 'Created'),
    startedAt: normalizeDockerTimestamp(stringField(state, 'StartedAt')),
    finishedAt: normalizeDockerTimestamp(stringField(state, 'FinishedAt')),
    status: stringField(state, 'Status'),
    running: booleanField(state, 'Running'),
    paused: booleanField(state, 'Paused'),
    restarting: booleanField(state, 'Restarting'),
    pid: numberField(state, 'Pid'),
    exitCode: numberField(state, 'ExitCode'),
    restartCount: numberField(record, 'RestartCount'),
    platform: stringField(record, 'Platform'),
    driver: stringField(record, 'Driver'),
    hostname: stringField(config, 'Hostname'),
    user: stringField(config, 'User'),
    workingDir: stringField(config, 'WorkingDir'),
    entrypoint: stringArrayField(config, 'Entrypoint'),
    command: stringArrayField(config, 'Cmd').length > 0 ? stringArrayField(config, 'Cmd') : stringArrayField(record, 'Args'),
    env: stringArrayField(config, 'Env'),
    ports: mapDockerPorts(networkSettings.Ports),
    mounts: mapDockerMounts(record.Mounts),
    networks: mapDockerNetworks(networkSettings.Networks),
    labels: stringRecord(config.Labels),
    networkMode: stringField(hostConfig, 'NetworkMode'),
    restartPolicy: stringField(restartPolicy, 'Name'),
    rawJson: JSON.stringify(record, null, 2)
  }
}

export function parseDockerEventLines(content: string): DockerEventSummary[] {
  return parseDockerJsonLines(content).map((row) => {
    const actor = asRecord(row.Actor)
    const actorAttributes = asRecord(actor.Attributes)

    return {
      id: stringField(row, 'id', 'ID') || stringField(actor, 'ID'),
      type: stringField(row, 'Type', 'type'),
      action: stringField(row, 'Action', 'action'),
      status: stringField(row, 'status', 'Status'),
      time: stringField(row, 'timeNano', 'time'),
      actorAttributes: Object.fromEntries(Object.entries(actorAttributes).map(([key, value]) => [key, String(value ?? '')]))
    }
  })
}

export function createDockerSnapshot(input: DockerSnapshotInput): DockerSnapshot {
  const noteMap = createDockerNoteMap(input.notes)
  const images = input.images.map((image) => {
    const note =
      (image.tagResourceKey ? getMappedNote(noteMap, 'image', image.tagResourceKey) : null) ||
      getMappedNote(noteMap, 'image', image.imageIdResourceKey)

    return {
      ...image,
      noteResourceKey: note?.resourceKey || image.noteResourceKey,
      displayName: note?.displayName || image.reference || image.shortId,
      note
    }
  })
  const containers = input.containers.map((container) => {
    const note = getMappedNote(noteMap, 'container', container.noteResourceKey)

    return {
      ...container,
      displayName: note?.displayName || container.name || container.shortId,
      note
    }
  })

  return {
    images,
    containers,
    notes: input.notes,
    checkedAt: input.checkedAt || nowIso()
  }
}

function stringOutput(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString('utf8') : value
}

function formatDockerCommand(args: string[]): string {
  const renderedArgs = args.map((arg) => (/\s/.test(arg) ? `'${arg.replaceAll("'", "'\\''")}'` : arg))
  return ['docker', ...renderedArgs].join(' ')
}

function getDockerCommandHint(message: string, error: DockerProcessError): string {
  const normalizedMessage = message.toLowerCase()

  if (error.killed || normalizedMessage.includes('timed out') || normalizedMessage.includes('timeout')) {
    return '提示：Docker CLI 响应超时，请确认 Docker Desktop 已启动完成后重试。'
  }

  if (error.code === 'ENOENT' || normalizedMessage.includes('enoent')) {
    return '提示：请确认 Docker CLI 已安装，并且 /usr/local/bin 或 /opt/homebrew/bin 可访问。'
  }

  if (normalizedMessage.includes('permission denied') && normalizedMessage.includes('docker api')) {
    return '提示：请确认 Docker Desktop 正在运行，并允许 ForgeDesk 访问 Docker Desktop 的 Unix socket。'
  }

  if (normalizedMessage.includes('cannot connect') || normalizedMessage.includes('docker daemon')) {
    return '提示：请先启动 Docker Desktop，等 Docker 状态稳定后重试。'
  }

  return ''
}

function createDockerCommandError(args: string[], error: DockerProcessError, stderr: string | Buffer): Error {
  const stderrText = stringOutput(stderr).trim()
  const detail = stderrText || error.message || '未知错误'
  const hint = getDockerCommandHint(detail, error)
  const message = [`Docker 命令执行失败：${formatDockerCommand(args)}`, detail, hint].filter(Boolean).join('\n')

  return new Error(message)
}

export function createDockerCommandEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const path = mergePathValues(env.PATH, createGuiToolFallbackPath())

  return { ...env, HOME: env.HOME || homedir(), PATH: path }
}

export function createDockerCommandRunner(execFileRunner: DockerExecFileRunner = execFile as DockerExecFileRunner): DockerCommandRunner {
  return (args: string[]) =>
    new Promise((resolveOutput, reject) => {
      execFileRunner('docker', args, { timeout: 15000, maxBuffer: 1024 * 1024 * 20, env: createDockerCommandEnv() }, (error, stdout, stderr) => {
        if (error) {
          reject(createDockerCommandError(args, error, stderr))
          return
        }

        resolveOutput(stringOutput(stdout))
      })
    })
}

export function runDockerCommand(args: string[]): Promise<string> {
  const runner = createDockerCommandRunner()

  return runner(args)
}

export async function readDockerSnapshot(db: DockerDatabase, runner: DockerCommandRunner = runDockerCommand): Promise<DockerSnapshot> {
  const [imageOutput, containerOutput] = await Promise.all([
    runner(['image', 'ls', '--all', '--digests', '--no-trunc', '--format', '{{json .}}']),
    runner(['container', 'ls', '--all', '--no-trunc', '--format', '{{json .}}'])
  ])

  return createDockerSnapshot({
    images: parseDockerImageLines(imageOutput),
    containers: parseDockerContainerLines(containerOutput),
    notes: listDockerResourceNotes(db)
  })
}

export async function readDockerContainerDetail(containerId: string, runner: DockerCommandRunner = runDockerCommand): Promise<DockerContainerDetail> {
  const normalizedContainerId = normalizeResourceKey(containerId)
  const output = await runner(['container', 'inspect', normalizedContainerId])

  return parseDockerContainerInspect(output)
}
