export const DEFAULT_TERMINAL_REMOTE_GROUP_ID = 'remote-group-default'

type TerminalShortcutStatement = {
  all: (...params: any[]) => unknown[]
  get: (...params: any[]) => unknown
  run: (...params: any[]) => unknown
}

type TerminalShortcutDatabase = {
  exec: (sql: string) => unknown
  prepare: (sql: string) => TerminalShortcutStatement
}

export type TerminalRemoteGroupRecord = {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type TerminalRemoteHostRecord = {
  id: string
  groupId: string
  name: string
  host: string
  username: string
  port: number
  identityFile: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type TerminalRemoteGroupInput = {
  id?: string
  name: string
}

export type TerminalRemoteHostInput = {
  id?: string
  groupId: string
  name: string
  host: string
  username?: string
  port?: number
  identityFile?: string
  notes?: string
}

function createRemoteShortcutId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapGroupRow(row: Record<string, unknown>): TerminalRemoteGroupRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function mapHostRow(row: Record<string, unknown>): TerminalRemoteHostRecord {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    name: String(row.name ?? ''),
    host: String(row.host ?? ''),
    username: String(row.username ?? ''),
    port: Number(row.port ?? 22),
    identityFile: String(row.identity_file ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? '')
  }
}

function normalizeRequiredText(value: string | undefined, errorMessage: string): string {
  const normalized = value?.trim() ?? ''

  if (!normalized) {
    throw new Error(errorMessage)
  }

  return normalized
}

function normalizeOptionalText(value: string | undefined): string {
  return value?.trim() ?? ''
}

function normalizeHostName(value: string): string {
  const host = normalizeRequiredText(value, '请输入远程主机地址')

  if (/\s/.test(host)) {
    throw new Error('远程主机地址不能包含空格')
  }

  return host
}

function normalizePort(value: number | undefined): number {
  const port = value === undefined ? 22 : Math.floor(value)

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error('端口必须在 1 到 65535 之间')
  }

  return port
}

function getGroup(db: TerminalShortcutDatabase, groupId: string): TerminalRemoteGroupRecord | null {
  const row = db.prepare('SELECT * FROM terminal_remote_groups WHERE id = ?').get(groupId) as Record<string, unknown> | undefined
  return row ? mapGroupRow(row) : null
}

function getHost(db: TerminalShortcutDatabase, hostId: string): TerminalRemoteHostRecord | null {
  const row = db.prepare('SELECT * FROM terminal_remote_hosts WHERE id = ?').get(hostId) as Record<string, unknown> | undefined
  return row ? mapHostRow(row) : null
}

export function migrateTerminalRemoteShortcutTables(db: TerminalShortcutDatabase): void {
  const now = nowIso()

  db.exec(`
    CREATE TABLE IF NOT EXISTS terminal_remote_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terminal_remote_hosts (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      port INTEGER NOT NULL DEFAULT 22,
      identity_file TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES terminal_remote_groups(id)
    );

    INSERT OR IGNORE INTO terminal_remote_groups (id, name, sort_order, created_at, updated_at)
    VALUES ('${DEFAULT_TERMINAL_REMOTE_GROUP_ID}', '默认', 0, '${now}', '${now}');
  `)
}

export function listTerminalRemoteGroups(db: TerminalShortcutDatabase): TerminalRemoteGroupRecord[] {
  return (db.prepare('SELECT * FROM terminal_remote_groups ORDER BY sort_order ASC, name ASC').all() as Array<Record<string, unknown>>).map(mapGroupRow)
}

export function saveTerminalRemoteGroup(db: TerminalShortcutDatabase, input: TerminalRemoteGroupInput): TerminalRemoteGroupRecord {
  const name = normalizeRequiredText(input.name, '请输入分组名称')
  const existing = input.id ? getGroup(db, input.id) : null
  const now = nowIso()

  if (existing) {
    db.prepare('UPDATE terminal_remote_groups SET name = ?, updated_at = ? WHERE id = ?').run(name, now, existing.id)
    return getGroup(db, existing.id) as TerminalRemoteGroupRecord
  }

  const maxSortRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM terminal_remote_groups').get() as { max_sort_order?: unknown } | undefined
  const id = input.id || createRemoteShortcutId('remote-group')
  const sortOrder = Number(maxSortRow?.max_sort_order ?? 0) + 1

  db.prepare('INSERT INTO terminal_remote_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, sortOrder, now, now)
  return getGroup(db, id) as TerminalRemoteGroupRecord
}

export function deleteTerminalRemoteGroup(db: TerminalShortcutDatabase, groupId: string): TerminalRemoteGroupRecord[] {
  if (groupId === DEFAULT_TERMINAL_REMOTE_GROUP_ID) {
    throw new Error('默认分组不能删除')
  }

  if (!getGroup(db, groupId)) {
    return listTerminalRemoteGroups(db)
  }

  const now = nowIso()
  db.prepare('UPDATE terminal_remote_hosts SET group_id = ?, updated_at = ? WHERE group_id = ?').run(DEFAULT_TERMINAL_REMOTE_GROUP_ID, now, groupId)
  db.prepare('DELETE FROM terminal_remote_groups WHERE id = ?').run(groupId)
  return listTerminalRemoteGroups(db)
}

export function listTerminalRemoteHosts(db: TerminalShortcutDatabase): TerminalRemoteHostRecord[] {
  return (
    db
      .prepare(
        `
        SELECT hosts.*
        FROM terminal_remote_hosts hosts
        JOIN terminal_remote_groups groups ON groups.id = hosts.group_id
        ORDER BY groups.sort_order ASC, hosts.name ASC
      `
      )
      .all() as Array<Record<string, unknown>>
  ).map(mapHostRow)
}

export function saveTerminalRemoteHost(db: TerminalShortcutDatabase, input: TerminalRemoteHostInput): TerminalRemoteHostRecord {
  const groupId = normalizeRequiredText(input.groupId, '请选择分组')

  if (!getGroup(db, groupId)) {
    throw new Error('远程分组不存在')
  }

  const name = normalizeRequiredText(input.name, '请输入远程名称')
  const host = normalizeHostName(input.host)
  const username = normalizeOptionalText(input.username)
  const port = normalizePort(input.port)
  const identityFile = normalizeOptionalText(input.identityFile)
  const notes = normalizeOptionalText(input.notes)
  const existing = input.id ? getHost(db, input.id) : null
  const now = nowIso()

  if (existing) {
    db.prepare(
      `
      UPDATE terminal_remote_hosts
      SET group_id = ?, name = ?, host = ?, username = ?, port = ?, identity_file = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(groupId, name, host, username, port, identityFile, notes, now, existing.id)
    return getHost(db, existing.id) as TerminalRemoteHostRecord
  }

  const id = input.id || createRemoteShortcutId('remote-host')
  db.prepare(
    `
    INSERT INTO terminal_remote_hosts (id, group_id, name, host, username, port, identity_file, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, groupId, name, host, username, port, identityFile, notes, now, now)

  return getHost(db, id) as TerminalRemoteHostRecord
}

export function deleteTerminalRemoteHost(db: TerminalShortcutDatabase, hostId: string): TerminalRemoteHostRecord[] {
  db.prepare('DELETE FROM terminal_remote_hosts WHERE id = ?').run(hostId)
  return listTerminalRemoteHosts(db)
}

function shellQuoteArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./~-]+$/.test(value)) {
    return value
  }

  return `'${value.replace(/'/g, "'\\''")}'`
}

export function buildTerminalRemoteSshCommand(host: TerminalRemoteHostRecord): string {
  const target = host.username ? `${host.username}@${host.host}` : host.host
  const args = ['ssh']

  if (host.identityFile) {
    args.push('-i', host.identityFile)
  }

  if (host.port !== 22) {
    args.push('-p', String(host.port))
  }

  args.push(target)
  return args.map(shellQuoteArg).join(' ')
}
