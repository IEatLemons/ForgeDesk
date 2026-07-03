import { execFile } from 'node:child_process'

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

export function createDockerCommandEnv(): NodeJS.ProcessEnv {
  const fallbackPaths = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin']
  const path = [process.env.PATH, ...fallbackPaths].filter(Boolean).join(':')

  return { ...process.env, PATH: path }
}

export function runDockerCommand(args: string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('docker', args, { timeout: 15000, maxBuffer: 1024 * 1024 * 20, env: createDockerCommandEnv() }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout)
    })
  })
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
