import { existsSync, realpathSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export type GitPathCommand = (localPath: string, args: string[]) => Promise<string>

export type SubmoduleDescriptor = {
  name: string
  path: string
  localPath: string
  relativePath: string
  url: string
  branch: string
  parentRepositoryId: string
  expectedCommit: string
  statusMarker: ' ' | '+' | '-' | 'U' | ''
}

type ParsedSubmoduleConfig = {
  name: string
  path: string
  url: string
  branch: string
}

function parseNullConfig(output: string): Array<{ key: string; value: string }> {
  const values = output.split('\0').filter((value) => value.length > 0)
  const entries: Array<{ key: string; value: string }> = []

  for (let index = 0; index + 1 < values.length; index += 2) {
    entries.push({ key: values[index], value: values[index + 1] })
  }

  return entries
}

export function parseSubmoduleConfig(output: string): ParsedSubmoduleConfig[] {
  const configs = new Map<string, ParsedSubmoduleConfig>()

  for (const { key, value } of parseNullConfig(output)) {
    const match = key.match(/^submodule\.(.+)\.(path|url|branch)$/)

    if (!match) {
      continue
    }

    const name = match[1]
    const field = match[2] as 'path' | 'url' | 'branch'
    const current = configs.get(name) ?? { name, path: '', url: '', branch: '' }
    current[field] = value.trim()
    configs.set(name, current)
  }

  return Array.from(configs.values())
    .filter((config) => config.path.length > 0)
    .sort((left, right) => left.path.localeCompare(right.path))
}

function parseExpectedCommit(output: string): string {
  const match = output.match(/(?:^|\0)160000\s+commit\s+([0-9a-f]{7,64})\t/)
  return match?.[1] ?? ''
}

function parseSubmoduleStatus(output: string, targetPath: string): { marker: SubmoduleDescriptor['statusMarker']; commit: string } {
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue
    }

    const marker = (line[0] ?? '') as SubmoduleDescriptor['statusMarker']
    const rest = line.slice(1).trimStart()
    const commit = rest.split(/\s+/, 1)[0] ?? ''
    const path = rest.slice(commit.length).trimStart().split(/\s+\(/, 1)[0]?.trim() ?? ''

    if (path !== targetPath) {
      continue
    }

    return {
      marker: [' ', '+', '-', 'U'].includes(marker) ? marker : '',
      commit
    }
  }

  return { marker: '', commit: '' }
}

function isSafeSubmodulePath(parentPath: string, targetPath: string): boolean {
  const resolveExistingPath = (path: string): string => {
    if (!existsSync(path)) {
      return resolve(path)
    }

    try {
      return realpathSync(path)
    } catch {
      return resolve(path)
    }
  }
  const normalizedParent = resolveExistingPath(parentPath)
  const normalizedTarget = resolveExistingPath(targetPath)
  const relativePath = relative(normalizedParent, normalizedTarget)

  return Boolean(relativePath) && !relativePath.startsWith('..') && !relativePath.includes('\0')
}

export async function discoverSubmoduleTree(
  repositoryPath: string,
  workspaceRoot: string,
  runGit: GitPathCommand
): Promise<SubmoduleDescriptor[]> {
  const normalizedRepositoryPath = resolve(repositoryPath)
  const normalizedWorkspaceRoot = resolve(workspaceRoot)
  const descriptors: SubmoduleDescriptor[] = []
  const visited = new Set<string>()
  const queue: Array<{ parentPath: string; parentRepositoryId: string }> = [
    { parentPath: normalizedRepositoryPath, parentRepositoryId: normalizedRepositoryPath }
  ]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || visited.has(current.parentPath)) {
      continue
    }

    visited.add(current.parentPath)
    const configOutput = await runGit(current.parentPath, [
      'config',
      '--file',
      '.gitmodules',
      '--null',
      '--get-regexp',
      '^submodule\\..*\\.(path|url|branch)$'
    ])

    if (!configOutput) {
      continue
    }

    const statusOutput = await runGit(current.parentPath, ['submodule', 'status', '--recursive'])

    for (const config of parseSubmoduleConfig(configOutput)) {
      const localPath = resolve(current.parentPath, config.path)

      if (!isSafeSubmodulePath(current.parentPath, localPath)) {
        continue
      }

      const status = parseSubmoduleStatus(statusOutput, config.path)
      const expectedCommit = parseExpectedCommit(await runGit(current.parentPath, ['ls-tree', '-z', 'HEAD', '--', config.path]))
      const descriptor: SubmoduleDescriptor = {
        name: config.name,
        path: config.path,
        localPath,
        relativePath: relative(normalizedWorkspaceRoot, localPath) || config.path,
        url: config.url,
        branch: config.branch,
        parentRepositoryId: current.parentRepositoryId,
        expectedCommit: expectedCommit || status.commit,
        statusMarker: status.marker
      }

      if (descriptors.some((item) => item.localPath === descriptor.localPath)) {
        continue
      }

      descriptors.push(descriptor)

      if (existsSync(localPath)) {
        queue.push({ parentPath: localPath, parentRepositoryId: localPath })
      }
    }
  }

  return descriptors
}
