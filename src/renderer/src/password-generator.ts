export type PasswordToolMode = 'hex' | 'password'

export type PasswordCharacterGroupKey = 'uppercase' | 'lowercase' | 'numbers' | 'symbols'

export type PasswordCharacterGroup = {
  key: PasswordCharacterGroupKey
  label: string
  characters: string
}

type PasswordToolItemBase = {
  id: string
  label: string
  variableName: string
  description: string
}

export type HexPasswordToolItem = PasswordToolItemBase & {
  mode: 'hex'
  byteLength: number
}

export type TextPasswordToolItem = PasswordToolItemBase & {
  mode: 'password'
  length: number
  groups: PasswordCharacterGroupKey[]
}

export type PasswordToolItem = HexPasswordToolItem | TextPasswordToolItem

export type GeneratedPasswordRow = PasswordToolItem & {
  value: string
}

export type RandomBytes = (length: number) => Uint8Array

export const PASSWORD_CHARACTER_GROUPS: PasswordCharacterGroup[] = [
  { key: 'uppercase', label: '大写字母', characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { key: 'lowercase', label: '小写字母', characters: 'abcdefghijklmnopqrstuvwxyz' },
  { key: 'numbers', label: '数字', characters: '0123456789' },
  { key: 'symbols', label: '符号', characters: '!@#$%^&*()-_=+' }
]

export const DEFAULT_PASSWORD_GROUP_KEYS: PasswordCharacterGroupKey[] = ['uppercase', 'lowercase', 'numbers', 'symbols']

export const DEFAULT_PASSWORD_TOOL_ITEMS: PasswordToolItem[] = [
  {
    id: 'ingest-api-key',
    label: 'Ingest API Key',
    variableName: 'INGEST_API_KEY',
    description: '服务调用密钥',
    mode: 'hex',
    byteLength: 32
  },
  {
    id: 'admin-session-secret',
    label: 'Admin Session Secret',
    variableName: 'ADMIN_SESSION_SECRET',
    description: '后台会话签名密钥',
    mode: 'hex',
    byteLength: 32
  },
  {
    id: 'merchant-adapter-api-key',
    label: 'Merchant Adapter API Key',
    variableName: 'MERCHANT_ADAPTER_API_KEY',
    description: '适配器 API 密钥',
    mode: 'hex',
    byteLength: 32
  },
  {
    id: 'admin-superuser-password',
    label: 'Admin Superuser Password',
    variableName: 'ADMIN_SUPERUSER_PASSWORD',
    description: '管理员强密码',
    mode: 'password',
    length: 24,
    groups: DEFAULT_PASSWORD_GROUP_KEYS
  }
]

function createBrowserRandomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('随机长度必须大于 0')
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('当前环境不支持安全随机数')
  }

  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

function readRandomBytes(length: number, randomBytes: RandomBytes): Uint8Array {
  const bytes = randomBytes(length)

  if (bytes.length < length) {
    throw new Error('随机源返回长度不足')
  }

  return bytes
}

function getCharacterGroups(groupKeys: PasswordCharacterGroupKey[]): PasswordCharacterGroup[] {
  const uniqueKeys = Array.from(new Set(groupKeys))
  const groups = uniqueKeys.map((key) => PASSWORD_CHARACTER_GROUPS.find((group) => group.key === key)).filter((group): group is PasswordCharacterGroup => Boolean(group))

  if (groups.length === 0) {
    throw new Error('至少选择一种字符类型')
  }

  return groups
}

function getRandomIndex(limit: number, randomBytes: RandomBytes): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 256) {
    throw new Error('随机范围必须在 1 到 256 之间')
  }

  const bucketSize = Math.floor(256 / limit) * limit

  while (true) {
    const byte = readRandomBytes(1, randomBytes)[0]

    if (byte < bucketSize) {
      return byte % limit
    }
  }
}

function pickRandomCharacter(characters: string, randomBytes: RandomBytes): string {
  return characters[getRandomIndex(characters.length, randomBytes)]
}

function shuffleCharacters(characters: string[], randomBytes: RandomBytes): string[] {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1, randomBytes)
    const current = characters[index]
    characters[index] = characters[swapIndex]
    characters[swapIndex] = current
  }

  return characters
}

export function generateHexSecret(byteLength = 32, randomBytes: RandomBytes = createBrowserRandomBytes): string {
  if (!Number.isInteger(byteLength) || byteLength < 1) {
    throw new Error('密钥字节数必须大于 0')
  }

  return Array.from(readRandomBytes(byteLength, randomBytes).slice(0, byteLength))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function generatePassword(
  input: {
    length: number
    groups: PasswordCharacterGroupKey[]
  },
  randomBytes: RandomBytes = createBrowserRandomBytes
): string {
  const groups = getCharacterGroups(input.groups)
  const length = Math.max(Math.floor(input.length), groups.length)
  const characters = groups.map((group) => pickRandomCharacter(group.characters, randomBytes))
  const allCharacters = groups.map((group) => group.characters).join('')

  while (characters.length < length) {
    characters.push(pickRandomCharacter(allCharacters, randomBytes))
  }

  return shuffleCharacters(characters, randomBytes).join('')
}

export function generatePasswordToolValue(item: PasswordToolItem, randomBytes: RandomBytes = createBrowserRandomBytes): string {
  if (item.mode === 'hex') {
    return generateHexSecret(item.byteLength, randomBytes)
  }

  return generatePassword({ length: item.length, groups: item.groups }, randomBytes)
}

export function createGeneratedPasswordRows(items = DEFAULT_PASSWORD_TOOL_ITEMS, randomBytes: RandomBytes = createBrowserRandomBytes): GeneratedPasswordRow[] {
  return items.map((item) => ({ ...item, value: generatePasswordToolValue(item, randomBytes) }))
}

export function formatEnvironmentVariableRows(rows: GeneratedPasswordRow[]): string {
  return rows.map((row) => `${row.variableName}=${row.value}`).join('\n')
}

export function getPasswordToolItemLengthLabel(item: PasswordToolItem): string {
  return item.mode === 'hex' ? `${item.byteLength * 2} hex` : `${item.length} 位`
}
