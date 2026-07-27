import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

export type GpgKeyUserId = {
  uid: string
  name: string
  email: string
}

export type GpgSecretKeyRecord = {
  keyId: string
  fingerprint: string
  algorithm: string
  createdAt: string
  expiresAt: string
  trust: string
  capabilities: string
  userIds: GpgKeyUserId[]
}

export type GpgImportPlan = {
  keyFiles: string[]
  ownerTrustFiles: string[]
}

const GPG_KEY_FILE_EXTENSIONS = new Set(['.asc', '.gpg', '.pgp', '.key'])
const OWNERTRUST_PATTERN = /^[A-F0-9]{16,40}:[0-6]:/m

function parseGpgTimestamp(value: string): string {
  const timestamp = Number(value)

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }

  return new Date(timestamp * 1000).toISOString()
}

function decodeGpgColonValue(value: string): string {
  return value.replace(/\\x([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

function formatGpgAlgorithm(value: string): string {
  switch (value) {
    case '1':
      return 'RSA'
    case '16':
      return 'Elgamal'
    case '17':
      return 'DSA'
    case '18':
      return 'ECDH'
    case '19':
      return 'ECDSA'
    case '22':
      return 'EdDSA'
    default:
      return value ? `算法 ${value}` : ''
  }
}

function parseGpgUserId(value: string): GpgKeyUserId {
  const uid = decodeGpgColonValue(value)
  const emailMatch = uid.match(/<([^<>]+)>/)
  const email = emailMatch?.[1] ?? ''
  const name = uid.replace(/\s*<[^<>]+>\s*/g, '').replace(/\s*\([^)]*\)\s*/g, '').trim()

  return {
    uid,
    name,
    email
  }
}

export function parseGpgSecretKeys(output: string): GpgSecretKeyRecord[] {
  const keys: GpgSecretKeyRecord[] = []
  let current: GpgSecretKeyRecord | null = null

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const fields = line.split(':')
    const type = fields[0]

    if (type === 'sec') {
      current = {
        keyId: fields[4] || '',
        fingerprint: '',
        algorithm: formatGpgAlgorithm(fields[3] || ''),
        createdAt: parseGpgTimestamp(fields[5] || ''),
        expiresAt: parseGpgTimestamp(fields[6] || ''),
        trust: fields[1] || '',
        capabilities: fields[11] || '',
        userIds: []
      }
      keys.push(current)
      continue
    }

    if (!current) {
      continue
    }

    if (type === 'fpr' && !current.fingerprint) {
      current.fingerprint = fields[9] || ''
      continue
    }

    if (type === 'uid') {
      current.userIds.push(parseGpgUserId(fields[9] || ''))
    }
  }

  return keys
}

function isGpgKeyFile(path: string): boolean {
  const lowerName = basename(path).toLowerCase()
  return Array.from(GPG_KEY_FILE_EXTENSIONS).some((extension) => lowerName.endsWith(extension))
}

async function isOwnerTrustFile(path: string): Promise<boolean> {
  const lowerName = basename(path).toLowerCase()

  if (lowerName.includes('ownertrust') || lowerName.includes('otrust')) {
    return true
  }

  if (!lowerName.endsWith('.txt')) {
    return false
  }

  const content = await readFile(path, 'utf8').catch(() => '')
  return OWNERTRUST_PATTERN.test(content)
}

async function walkFiles(path: string): Promise<string[]> {
  const info = await stat(path)

  if (info.isFile()) {
    return [path]
  }

  if (!info.isDirectory()) {
    return []
  }

  const entries = await readdir(path, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const childPath = join(path, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(childPath)))
    } else if (entry.isFile()) {
      files.push(childPath)
    }
  }

  return files
}

export async function createGpgImportPlan(sourcePath: string): Promise<GpgImportPlan> {
  const files = await walkFiles(sourcePath)
  const keyFiles: string[] = []
  const ownerTrustFiles: string[] = []

  for (const file of files) {
    if (isGpgKeyFile(file)) {
      keyFiles.push(file)
    } else if (await isOwnerTrustFile(file)) {
      ownerTrustFiles.push(file)
    }
  }

  return {
    keyFiles: keyFiles.sort((left, right) => left.localeCompare(right)),
    ownerTrustFiles: ownerTrustFiles.sort((left, right) => left.localeCompare(right))
  }
}
