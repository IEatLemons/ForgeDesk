export type EnvFileVariables = {
  variables: EnvFileVariable[]
  variableNames: string[]
  ignoredLineCount: number
}

export type EnvFileVariable = {
  name: string
  value: string
  rawLine: string
}

export type EnvFileDiffStatus = 'same' | 'different' | 'missing-in-target' | 'extra-in-target'

export type EnvFileDiffRow = {
  id: string
  variableName: string
  sourceValue: string
  targetValue: string
  status: EnvFileDiffStatus
}

export type EnvFileDiffResult = {
  sourceVariables: string[]
  targetVariables: string[]
  missingInTarget: string[]
  extraInTarget: string[]
  differentValues: string[]
  rows: EnvFileDiffRow[]
  sourceIgnoredLineCount: number
  targetIgnoredLineCount: number
}

export type EnvFileDiffRowFilter = 'all' | 'missing' | 'extra' | 'different'

export type EnvFileDiffTaskFile = {
  name: string
  size: number
}

export type EnvFileDiffTask = {
  id: string
  title: string
  sourceText: string
  targetText: string
  sourceFile: EnvFileDiffTaskFile | null
  targetFile: EnvFileDiffTaskFile | null
  resultFilter: EnvFileDiffRowFilter
  createdAt: string
  updatedAt: string
}

export type EnvFileDiffTaskStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export const envFileDiffTasksStorageKey = 'forgedesk.envFileDiffTasks.v1'
export const envFileDiffActiveTaskStorageKey = 'forgedesk.envFileDiffActiveTaskId.v1'

type EnvFileVariableBlock = {
  variable: EnvFileVariable
  endLineIndex: number
}

function createEnvFileDiffTaskId(now: Date): string {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `env-diff-${now.getTime().toString(36)}-${randomPart}`
}

function isEnvFileDiffRowFilter(value: unknown): value is EnvFileDiffRowFilter {
  return value === 'all' || value === 'missing' || value === 'extra' || value === 'different'
}

function normalizeTextValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeTaskFile(value: unknown): EnvFileDiffTaskFile | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const file = value as Record<string, unknown>
  const name = typeof file.name === 'string' ? file.name.trim() : ''
  const size = typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0 ? file.size : 0

  return name ? { name, size } : null
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? fallback : value
}

function getEnvFileDiffTaskStorage(): EnvFileDiffTaskStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function createEnvFileDiffTask(input: Partial<EnvFileDiffTask> = {}, now = new Date()): EnvFileDiffTask {
  const timestamp = now.toISOString()
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : '环境变量对比'

  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : createEnvFileDiffTaskId(now),
    title,
    sourceText: normalizeTextValue(input.sourceText),
    targetText: normalizeTextValue(input.targetText),
    sourceFile: normalizeTaskFile(input.sourceFile),
    targetFile: normalizeTaskFile(input.targetFile),
    resultFilter: isEnvFileDiffRowFilter(input.resultFilter) ? input.resultFilter : 'all',
    createdAt: normalizeIsoDate(input.createdAt, timestamp),
    updatedAt: normalizeIsoDate(input.updatedAt, timestamp)
  }
}

export function normalizeEnvFileDiffTasks(input: unknown): EnvFileDiffTask[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return []
      }

      const task = item as Record<string, unknown>

      if (typeof task.id !== 'string' || !task.id.trim()) {
        return []
      }

      return [
        createEnvFileDiffTask({
          id: task.id,
          title: normalizeTextValue(task.title),
          sourceText: normalizeTextValue(task.sourceText),
          targetText: normalizeTextValue(task.targetText),
          sourceFile: normalizeTaskFile(task.sourceFile),
          targetFile: normalizeTaskFile(task.targetFile),
          resultFilter: isEnvFileDiffRowFilter(task.resultFilter) ? task.resultFilter : 'all',
          createdAt: normalizeTextValue(task.createdAt),
          updatedAt: normalizeTextValue(task.updatedAt)
        })
      ]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function readStoredEnvFileDiffTasks(storage: EnvFileDiffTaskStorage | null = getEnvFileDiffTaskStorage()): EnvFileDiffTask[] {
  if (!storage) {
    return []
  }

  try {
    const rawValue = storage.getItem(envFileDiffTasksStorageKey)
    return rawValue ? normalizeEnvFileDiffTasks(JSON.parse(rawValue)) : []
  } catch {
    return []
  }
}

export function writeStoredEnvFileDiffTasks(tasks: EnvFileDiffTask[], storage: EnvFileDiffTaskStorage | null = getEnvFileDiffTaskStorage()): void {
  if (!storage) {
    return
  }

  try {
    storage.setItem(envFileDiffTasksStorageKey, JSON.stringify(tasks))
  } catch {
    // Storage can fail in private contexts or when the quota is full.
  }
}

export function readStoredEnvFileDiffActiveTaskId(storage: EnvFileDiffTaskStorage | null = getEnvFileDiffTaskStorage()): string {
  if (!storage) {
    return ''
  }

  try {
    return storage.getItem(envFileDiffActiveTaskStorageKey) || ''
  } catch {
    return ''
  }
}

export function writeStoredEnvFileDiffActiveTaskId(taskId: string, storage: EnvFileDiffTaskStorage | null = getEnvFileDiffTaskStorage()): void {
  if (!storage) {
    return
  }

  try {
    if (taskId) {
      storage.setItem(envFileDiffActiveTaskStorageKey, taskId)
    } else {
      storage.removeItem(envFileDiffActiveTaskStorageKey)
    }
  } catch {
    // Ignore persistence failures so the tool remains usable.
  }
}

function hasUnescapedQuote(value: string, quote: string, startIndex = 1): boolean {
  let escaped = false

  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (character === '\\') {
      escaped = true
      continue
    }

    if (character === quote) {
      return true
    }
  }

  return false
}

function getOpenQuote(value: string): string | null {
  const quote = value[0]

  if ((quote === '"' || quote === "'") && !hasUnescapedQuote(value, quote)) {
    return quote
  }

  return null
}

function isPemBlockStart(value: string): boolean {
  return /^-----BEGIN [A-Z0-9][A-Z0-9 ]*-----$/.test(value.trim())
}

function isPemBlockEnd(value: string): boolean {
  return /^-----END [A-Z0-9][A-Z0-9 ]*-----$/.test(value.trim())
}

function readEnvVariable(line: string): EnvFileVariable | null {
  const normalized = line.replace(/^\uFEFF/, '').trim()

  if (!normalized || normalized.startsWith('#') || normalized.startsWith('//')) {
    return null
  }

  const withoutExport = normalized.replace(/^export\s+/, '')
  const assignmentMatch = withoutExport.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|:)\s*(.*)$/)

  if (assignmentMatch) {
    return {
      name: assignmentMatch[1],
      value: assignmentMatch[2],
      rawLine: line
    }
  }

  const nameOnlyMatch = withoutExport.match(/^([A-Za-z_][A-Za-z0-9_]*)$/)

  if (nameOnlyMatch) {
    return {
      name: nameOnlyMatch[1],
      value: '',
      rawLine: line
    }
  }

  const tableCopyMatch = withoutExport.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\t|\s{2,})(.*)$/)

  if (tableCopyMatch) {
    return {
      name: tableCopyMatch[1],
      value: tableCopyMatch[2],
      rawLine: line
    }
  }

  return null
}

function readEnvVariableBlock(lines: string[], startLineIndex: number): EnvFileVariableBlock | null {
  const variable = readEnvVariable(lines[startLineIndex])

  if (!variable) {
    return null
  }

  const openQuote = getOpenQuote(variable.value)

  if (!openQuote) {
    if (isPemBlockStart(variable.value) && !isPemBlockEnd(variable.value)) {
      const valueLines = [variable.value]
      const rawLines = [lines[startLineIndex]]

      for (let lineIndex = startLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
        valueLines.push(lines[lineIndex])
        rawLines.push(lines[lineIndex])

        if (isPemBlockEnd(lines[lineIndex])) {
          return {
            variable: {
              ...variable,
              value: valueLines.join('\n'),
              rawLine: rawLines.join('\n')
            },
            endLineIndex: lineIndex
          }
        }
      }
    }

    return {
      variable,
      endLineIndex: startLineIndex
    }
  }

  const valueLines = [variable.value]
  const rawLines = [lines[startLineIndex]]
  let endLineIndex = startLineIndex

  for (let lineIndex = startLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    endLineIndex = lineIndex
    valueLines.push(lines[lineIndex])
    rawLines.push(lines[lineIndex])

    if (hasUnescapedQuote(lines[lineIndex], openQuote, 0)) {
      break
    }
  }

  return {
    variable: {
      ...variable,
      value: valueLines.join('\n'),
      rawLine: rawLines.join('\n')
    },
    endLineIndex
  }
}

export function parseEnvFileVariables(content: string): EnvFileVariables {
  const variables: EnvFileVariable[] = []
  const variableNames: string[] = []
  const seenVariableNames = new Set<string>()
  let ignoredLineCount = 0
  const lines = content.split(/\r?\n/)

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const trimmedLine = line.replace(/^\uFEFF/, '').trim()

    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue
    }

    const block = readEnvVariableBlock(lines, lineIndex)

    if (!block) {
      ignoredLineCount += 1
      continue
    }

    const { variable } = block

    if (!seenVariableNames.has(variable.name)) {
      seenVariableNames.add(variable.name)
      variables.push(variable)
      variableNames.push(variable.name)
    }

    lineIndex = block.endLineIndex
  }

  return { variables, variableNames, ignoredLineCount }
}

export function compareEnvFiles(sourceContent: string, targetContent: string): EnvFileDiffResult {
  const source = parseEnvFileVariables(sourceContent)
  const target = parseEnvFileVariables(targetContent)
  const targetVariableMap = new Map(target.variables.map((variable) => [variable.name, variable]))
  const sourceVariableMap = new Map(source.variables.map((variable) => [variable.name, variable]))
  const targetVariableSet = new Set(target.variableNames)
  const sourceVariableSet = new Set(source.variableNames)
  const rows: EnvFileDiffRow[] = []

  for (const sourceVariable of source.variables) {
    const targetVariable = targetVariableMap.get(sourceVariable.name)

    rows.push({
      id: sourceVariable.name,
      variableName: sourceVariable.name,
      sourceValue: sourceVariable.value,
      targetValue: targetVariable?.value ?? '',
      status: !targetVariable ? 'missing-in-target' : sourceVariable.value === targetVariable.value ? 'same' : 'different'
    })
  }

  for (const targetVariable of target.variables) {
    if (sourceVariableMap.has(targetVariable.name)) {
      continue
    }

    rows.push({
      id: targetVariable.name,
      variableName: targetVariable.name,
      sourceValue: '',
      targetValue: targetVariable.value,
      status: 'extra-in-target'
    })
  }

  return {
    sourceVariables: source.variableNames,
    targetVariables: target.variableNames,
    missingInTarget: source.variableNames.filter((variableName) => !targetVariableSet.has(variableName)),
    extraInTarget: target.variableNames.filter((variableName) => !sourceVariableSet.has(variableName)),
    differentValues: rows.filter((row) => row.status === 'different').map((row) => row.variableName),
    rows,
    sourceIgnoredLineCount: source.ignoredLineCount,
    targetIgnoredLineCount: target.ignoredLineCount
  }
}

export function formatVariableNames(variableNames: string[]): string {
  return variableNames.join('\n')
}

export function formatEnvVariableRows(variables: EnvFileVariable[]): string {
  return variables.map((variable) => `${variable.name}=${variable.value}`).join('\n')
}

export function formatEnvVariableValues(variables: EnvFileVariable[]): string {
  return variables.map((variable) => variable.value).join('\n')
}

export function updateEnvVariableValue(content: string, variableName: string, value: string): string {
  const lines = content.split(/\r?\n/)
  const nextLine = `${variableName}=${value}`

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const block = readEnvVariableBlock(lines, lineIndex)

    if (!block) {
      continue
    }

    if (block.variable.name === variableName) {
      lines.splice(lineIndex, block.endLineIndex - lineIndex + 1, ...nextLine.split('\n'))
      return lines.join('\n')
    }

    lineIndex = block.endLineIndex
  }

  if (!content.trim()) {
    return nextLine
  }

  const hasTrailingEmptyLine = lines.length > 0 && lines[lines.length - 1] === ''

  if (hasTrailingEmptyLine) {
    lines.splice(lines.length - 1, 0, ...nextLine.split('\n'))
    return lines.join('\n')
  }

  return [...lines, ...nextLine.split('\n')].join('\n')
}
