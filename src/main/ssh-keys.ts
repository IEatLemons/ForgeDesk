import { chmod, copyFile, mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'

export type SshKeyKind = 'private' | 'public'

export type SshPublicKeyRecord = {
  fileName: string
  path: string
  fingerprint: string
  pairedPrivateKeyPath: string
}

export type SshPrivateKeyRecord = {
  fileName: string
  path: string
  fingerprint: string
  publicKeyPath: string
  hasPublicKey: boolean
  mode: string
  needsPermissionFix: boolean
}

export type SshKeyInventory = {
  sshPublicKeys: SshPublicKeyRecord[]
  sshPrivateKeys: SshPrivateKeyRecord[]
}

export type SshKeyGenerationInput = {
  keyName?: string
  email: string
}

export type SshKeyImportInput = {
  kind: SshKeyKind
  sourcePath: string
  fileName: string
}

const SAFE_KEY_FILE_PATTERN = /^[A-Za-z0-9._-]+$/
const RESERVED_SSH_FILES = new Set(['config', 'known_hosts', 'known_hosts.old', 'authorized_keys', 'environment'])
const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/
const PUBLIC_KEY_PATTERN = /^(ssh-|ecdsa-|sk-)/

export type SshFingerprintReader = (path: string, content: string) => Promise<string>

function formatFileMode(mode: number): string {
  return `0${(mode & 0o777).toString(8)}`
}

function isPrivateKeyContent(content: string): boolean {
  return PRIVATE_KEY_PATTERN.test(content)
}

function isPublicKeyContent(content: string): boolean {
  return PUBLIC_KEY_PATTERN.test(content.trim())
}

function getFallbackFingerprint(content: string): string {
  return content.trim().slice(0, 80)
}

function ensureInsideSshDirectory(sshDirectory: string, path: string): string {
  const normalizedDirectory = resolve(sshDirectory)
  const normalizedPath = resolve(path)

  if (normalizedPath !== normalizedDirectory && !normalizedPath.startsWith(`${normalizedDirectory}${sep}`)) {
    throw new Error('只能管理 ~/.ssh 目录下的密钥文件')
  }

  return normalizedPath
}

export function normalizeSshKeyFileName(value: string, kind: SshKeyKind): string {
  const rawName = value.trim()
  const fileName = kind === 'public' && rawName && !rawName.endsWith('.pub') ? `${rawName}.pub` : rawName

  if (!fileName) {
    throw new Error('请输入密钥文件名')
  }

  if (kind === 'private' && fileName.endsWith('.pub')) {
    throw new Error('私钥文件名不能以 .pub 结尾')
  }

  if (!SAFE_KEY_FILE_PATTERN.test(fileName)) {
    throw new Error('密钥文件名只能包含字母、数字、点、下划线和短横线')
  }

  const reservedName = kind === 'public' && fileName.endsWith('.pub') ? fileName.slice(0, -4) : fileName

  if (RESERVED_SSH_FILES.has(reservedName) || RESERVED_SSH_FILES.has(fileName)) {
    throw new Error('这是 SSH 保留文件，不能作为密钥文件名')
  }

  return fileName
}

export function resolveSshKeyFilePath(sshDirectory: string, path: string, kind: SshKeyKind): string {
  const normalizedPath = ensureInsideSshDirectory(sshDirectory, path)
  const fileName = basename(normalizedPath)

  normalizeSshKeyFileName(fileName, kind)

  if (kind === 'public' && !fileName.endsWith('.pub')) {
    throw new Error('公钥文件名必须以 .pub 结尾')
  }

  return normalizedPath
}

async function readFingerprint(path: string, content: string, fingerprintReader: SshFingerprintReader): Promise<string> {
  try {
    return await fingerprintReader(path, content)
  } catch {
    return getFallbackFingerprint(content)
  }
}

export async function readSshKeyInventory(
  sshDirectory: string,
  fingerprintReader: SshFingerprintReader = async (_path, content) => getFallbackFingerprint(content)
): Promise<SshKeyInventory> {
  let entries

  try {
    entries = await readdir(sshDirectory, { withFileTypes: true })
  } catch {
    return { sshPublicKeys: [], sshPrivateKeys: [] }
  }

  const fileEntries = entries.filter((entry) => entry.isFile())
  const publicFiles = fileEntries.filter((entry) => entry.name.endsWith('.pub')).map((entry) => entry.name)
  const publicFileSet = new Set(publicFiles)
  const privateFiles: string[] = []

  for (const entry of fileEntries) {
    if (entry.name.endsWith('.pub') || RESERVED_SSH_FILES.has(entry.name)) {
      continue
    }

    const path = join(sshDirectory, entry.name)
    const content = await readFile(path, 'utf8').catch(() => '')

    if (isPrivateKeyContent(content)) {
      privateFiles.push(entry.name)
    }
  }

  const privateFileSet = new Set(privateFiles)

  const sshPrivateKeys = await Promise.all(
    privateFiles.sort((left, right) => left.localeCompare(right)).map(async (fileName) => {
      const path = join(sshDirectory, fileName)
      const content = await readFile(path, 'utf8')
      const fileStat = await stat(path)
      const publicKeyPath = `${path}.pub`
      const mode = formatFileMode(fileStat.mode)

      return {
        fileName,
        path,
        fingerprint: await readFingerprint(path, content, fingerprintReader),
        publicKeyPath,
        hasPublicKey: publicFileSet.has(`${fileName}.pub`),
        mode,
        needsPermissionFix: mode !== '0600'
      }
    })
  )

  const sshPublicKeys = await Promise.all(
    publicFiles.sort((left, right) => left.localeCompare(right)).map(async (fileName) => {
      const path = join(sshDirectory, fileName)
      const content = await readFile(path, 'utf8')
      const privateKeyName = fileName.slice(0, -4)

      return {
        fileName,
        path,
        fingerprint: await readFingerprint(path, content, fingerprintReader),
        pairedPrivateKeyPath: privateFileSet.has(privateKeyName) ? join(sshDirectory, privateKeyName) : ''
      }
    })
  )

  return {
    sshPublicKeys,
    sshPrivateKeys
  }
}

export async function importSshKeyFile(sshDirectory: string, input: SshKeyImportInput): Promise<SshPrivateKeyRecord | SshPublicKeyRecord> {
  const fileName = normalizeSshKeyFileName(input.fileName, input.kind)
  const targetPath = join(sshDirectory, fileName)
  const content = await readFile(resolve(input.sourcePath), 'utf8')

  if (input.kind === 'private' && !isPrivateKeyContent(content)) {
    throw new Error('选择的文件不是可识别的 SSH 私钥')
  }

  if (input.kind === 'public' && !isPublicKeyContent(content)) {
    throw new Error('选择的文件不是可识别的 SSH 公钥')
  }

  await mkdir(sshDirectory, { recursive: true, mode: 0o700 })
  await copyFile(resolve(input.sourcePath), targetPath)
  await chmod(targetPath, input.kind === 'private' ? 0o600 : 0o644)

  const inventory = await readSshKeyInventory(sshDirectory)
  const importedKey =
    input.kind === 'private'
      ? inventory.sshPrivateKeys.find((key) => key.path === targetPath)
      : inventory.sshPublicKeys.find((key) => key.path === targetPath)

  if (!importedKey) {
    throw new Error('密钥已导入，但重新读取失败')
  }

  return importedKey
}

export async function deleteSshKeyFile(sshDirectory: string, path: string, kind: SshKeyKind): Promise<void> {
  await unlink(resolveSshKeyFilePath(sshDirectory, path, kind))
}

export async function fixSshPrivateKeyPermissions(sshDirectory: string, path: string): Promise<void> {
  await chmod(resolveSshKeyFilePath(sshDirectory, path, 'private'), 0o600)
}
