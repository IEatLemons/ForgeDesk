import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type SshConfigFile = {
  path: string
  content: string
  exists: boolean
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

export async function readSshConfigFile(sshDirectory: string): Promise<SshConfigFile> {
  const configPath = join(sshDirectory, 'config')

  try {
    return {
      path: configPath,
      content: await readFile(configPath, 'utf8'),
      exists: true
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        path: configPath,
        content: '',
        exists: false
      }
    }

    throw error
  }
}

export async function writeSshConfigFile(sshDirectory: string, content: string): Promise<SshConfigFile> {
  const configPath = join(sshDirectory, 'config')

  await mkdir(sshDirectory, { recursive: true, mode: 0o700 })
  await writeFile(configPath, content, { encoding: 'utf8', mode: 0o600 })
  await chmod(configPath, 0o600)

  return {
    path: configPath,
    content,
    exists: true
  }
}
