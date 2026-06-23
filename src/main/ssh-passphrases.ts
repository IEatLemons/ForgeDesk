import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export type SshPassphraseRecord = {
  path: string
  passphrase: string
}

export type SshPassphraseAskpass = {
  directory: string
  path: string
  env: NodeJS.ProcessEnv
  cleanup: () => Promise<void>
}

type SshPassphraseFile = {
  passphrases?: Array<Partial<SshPassphraseRecord>>
}

function getSshPassphraseFilePath(userDataPath: string): string {
  return join(userDataPath, 'ssh-passphrases.json')
}

function normalizeRecord(record: Partial<SshPassphraseRecord>): SshPassphraseRecord | null {
  const path = typeof record.path === 'string' ? resolve(record.path) : ''
  const passphrase = typeof record.passphrase === 'string' ? record.passphrase : ''

  if (!path || !passphrase) {
    return null
  }

  return { path, passphrase }
}

function dedupeRecords(records: SshPassphraseRecord[]): SshPassphraseRecord[] {
  const byPath = new Map<string, SshPassphraseRecord>()

  for (const record of records) {
    byPath.set(record.path, record)
  }

  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path))
}

async function writeSshPassphrases(userDataPath: string, records: SshPassphraseRecord[]): Promise<void> {
  await mkdir(userDataPath, { recursive: true, mode: 0o700 })
  const filePath = getSshPassphraseFilePath(userDataPath)
  await writeFile(filePath, `${JSON.stringify({ passphrases: dedupeRecords(records) }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await chmod(filePath, 0o600)
}

export async function readSshPassphrases(userDataPath: string): Promise<SshPassphraseRecord[]> {
  try {
    const content = await readFile(getSshPassphraseFilePath(userDataPath), 'utf8')
    const parsed = JSON.parse(content) as SshPassphraseFile
    const records = Array.isArray(parsed.passphrases) ? parsed.passphrases.map(normalizeRecord).filter((record): record is SshPassphraseRecord => Boolean(record)) : []
    return dedupeRecords(records)
  } catch {
    return []
  }
}

export async function listSshPassphrasePaths(userDataPath: string): Promise<Set<string>> {
  return new Set((await readSshPassphrases(userDataPath)).map((record) => record.path))
}

export async function saveSshPassphrase(userDataPath: string, path: string, passphrase: string): Promise<void> {
  const normalizedPath = resolve(path)

  if (!passphrase) {
    throw new Error('请输入私钥密码')
  }

  const records = (await readSshPassphrases(userDataPath)).filter((record) => record.path !== normalizedPath)
  records.push({ path: normalizedPath, passphrase })
  await writeSshPassphrases(userDataPath, records)
}

export async function clearSshPassphrase(userDataPath: string, path: string): Promise<void> {
  const normalizedPath = resolve(path)
  const records = (await readSshPassphrases(userDataPath)).filter((record) => record.path !== normalizedPath)
  await writeSshPassphrases(userDataPath, records)
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildAskpassScript(records: SshPassphraseRecord[]): string {
  const lines = ['#!/bin/sh', 'prompt="$*"']

  for (const record of records) {
    lines.push('case "$prompt" in')
    lines.push(`  *${shellSingleQuote(record.path)}*)`)
    lines.push(`    printf '%s\\n' ${shellSingleQuote(record.passphrase)}`)
    lines.push('    exit 0')
    lines.push('    ;;')
    lines.push('esac')
  }

  if (records.length === 1) {
    lines.push(`printf '%s\\n' ${shellSingleQuote(records[0].passphrase)}`)
    lines.push('exit 0')
  } else {
    lines.push('exit 1')
  }

  return `${lines.join('\n')}\n`
}

export async function createSshPassphraseAskpass(records: SshPassphraseRecord[]): Promise<SshPassphraseAskpass> {
  const normalizedRecords = dedupeRecords(records.map(normalizeRecord).filter((record): record is SshPassphraseRecord => Boolean(record)))

  if (normalizedRecords.length === 0) {
    throw new Error('没有可用的私钥密码')
  }

  const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ssh-askpass-'))
  await chmod(directory, 0o700)
  const path = join(directory, 'askpass.sh')
  await writeFile(path, buildAskpassScript(normalizedRecords), { encoding: 'utf8', mode: 0o700 })
  await chmod(path, 0o700)

  return {
    directory,
    path,
    env: {
      SSH_ASKPASS: path,
      SSH_ASKPASS_REQUIRE: 'force',
      DISPLAY: process.env.DISPLAY || 'forgedesk'
    },
    cleanup: () => rm(directory, { recursive: true, force: true })
  }
}

export async function withSshPassphraseAskpass<T>(records: SshPassphraseRecord[], operation: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  const normalizedRecords = dedupeRecords(records.map(normalizeRecord).filter((record): record is SshPassphraseRecord => Boolean(record)))

  if (normalizedRecords.length === 0) {
    return operation({})
  }

  const askpass = await createSshPassphraseAskpass(normalizedRecords)

  try {
    return await operation(askpass.env)
  } finally {
    await askpass.cleanup()
  }
}
