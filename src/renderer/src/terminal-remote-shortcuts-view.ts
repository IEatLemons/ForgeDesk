export type TerminalRemoteGroupSection = {
  group: TerminalRemoteGroupRecord
  hosts: TerminalRemoteHostRecord[]
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

function compareRemoteHostName(left: TerminalRemoteHostRecord, right: TerminalRemoteHostRecord): number {
  return left.name.localeCompare(right.name)
}

export function filterTerminalRemoteHosts(hosts: TerminalRemoteHostRecord[], query: string): TerminalRemoteHostRecord[] {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return [...hosts].sort(compareRemoteHostName)
  }

  return hosts
    .filter((host) =>
      [host.name, host.host, host.username, String(host.port), host.identityFile, host.notes]
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(normalizedQuery))
    )
    .sort(compareRemoteHostName)
}

export function createTerminalRemoteGroupSections(
  groups: TerminalRemoteGroupRecord[],
  hosts: TerminalRemoteHostRecord[],
  query = ''
): TerminalRemoteGroupSection[] {
  const filteredHosts = filterTerminalRemoteHosts(hosts, query)

  return [...groups]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((group) => ({
      group,
      hosts: filteredHosts.filter((host) => host.groupId === group.id)
    }))
}

export function formatTerminalRemoteTarget(host: TerminalRemoteHostRecord): string {
  const target = host.username ? `${host.username}@${host.host}` : host.host
  return `${target}:${host.port}`
}
