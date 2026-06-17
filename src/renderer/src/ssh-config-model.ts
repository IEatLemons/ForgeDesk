export type SshConfigEntry = {
  host: string
  hostName: string
  user: string
  port: string
  identityFile: string
  preferredAuthentications: string
  identitiesOnly: 'yes' | 'no' | ''
  serverAliveInterval: string
  serverAliveCountMax: string
  connectTimeout: string
  tcpKeepAlive: 'yes' | 'no' | ''
  ipQoS: string
  extraOptions: Array<{
    key: string
    value: string
  }>
}

type SshConfigEntryKey = keyof Omit<SshConfigEntry, 'extraOptions'>

const optionToField = new Map<string, SshConfigEntryKey>([
  ['host', 'host'],
  ['hostname', 'hostName'],
  ['user', 'user'],
  ['port', 'port'],
  ['identityfile', 'identityFile'],
  ['preferredauthentications', 'preferredAuthentications'],
  ['identitiesonly', 'identitiesOnly'],
  ['serveraliveinterval', 'serverAliveInterval'],
  ['serveralivecountmax', 'serverAliveCountMax'],
  ['connecttimeout', 'connectTimeout'],
  ['tcpkeepalive', 'tcpKeepAlive'],
  ['ipqos', 'ipQoS']
])

export function createEmptySshConfigEntry(): SshConfigEntry {
  return {
    host: '',
    hostName: '',
    user: 'git',
    port: '',
    identityFile: '',
    preferredAuthentications: 'publickey',
    identitiesOnly: 'yes',
    serverAliveInterval: '',
    serverAliveCountMax: '',
    connectTimeout: '',
    tcpKeepAlive: '',
    ipQoS: '',
    extraOptions: []
  }
}

function normalizeYesNo(value: string): 'yes' | 'no' | '' {
  const normalized = value.trim().toLowerCase()

  if (normalized === 'yes' || normalized === 'no') {
    return normalized
  }

  return ''
}

function assignEntryOption(entry: SshConfigEntry, key: string, value: string): void {
  const field = optionToField.get(key.toLowerCase())

  if (!field || field === 'host') {
    entry.extraOptions.push({ key, value })
    return
  }

  if (field === 'identitiesOnly' || field === 'tcpKeepAlive') {
    entry[field] = normalizeYesNo(value)
    return
  }

  entry[field] = value
}

export function parseSshConfigEntries(content: string): SshConfigEntry[] {
  const entries: SshConfigEntry[] = []
  let currentEntry: SshConfigEntry | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const [rawKey = '', ...valueParts] = line.split(/\s+/)
    const value = valueParts.join(' ')

    if (rawKey.toLowerCase() === 'host') {
      currentEntry = {
        ...createEmptySshConfigEntry(),
        host: value
      }
      entries.push(currentEntry)
      continue
    }

    if (!currentEntry) {
      continue
    }

    assignEntryOption(currentEntry, rawKey, value)
  }

  return entries
}

function pushOption(lines: string[], key: string, value: string): void {
  const normalizedValue = value.trim()

  if (normalizedValue) {
    lines.push(`  ${key} ${normalizedValue}`)
  }
}

export function serializeSshConfigEntries(entries: SshConfigEntry[]): string {
  const lines: string[] = []

  for (const entry of entries) {
    const host = entry.host.trim()

    if (!host) {
      continue
    }

    if (lines.length > 0) {
      lines.push('')
    }

    lines.push(`Host ${host}`)
    pushOption(lines, 'HostName', entry.hostName)
    pushOption(lines, 'User', entry.user)
    pushOption(lines, 'Port', entry.port)
    pushOption(lines, 'IdentityFile', entry.identityFile)
    pushOption(lines, 'PreferredAuthentications', entry.preferredAuthentications)
    pushOption(lines, 'IdentitiesOnly', entry.identitiesOnly)
    pushOption(lines, 'ServerAliveInterval', entry.serverAliveInterval)
    pushOption(lines, 'ServerAliveCountMax', entry.serverAliveCountMax)
    pushOption(lines, 'ConnectTimeout', entry.connectTimeout)
    pushOption(lines, 'TCPKeepAlive', entry.tcpKeepAlive)
    pushOption(lines, 'IPQoS', entry.ipQoS)

    for (const option of entry.extraOptions) {
      pushOption(lines, option.key, option.value)
    }
  }

  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}
