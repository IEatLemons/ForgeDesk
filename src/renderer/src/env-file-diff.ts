export type EnvFileVariables = {
  variableNames: string[]
  ignoredLineCount: number
}

export type EnvFileDiffResult = {
  sourceVariables: string[]
  targetVariables: string[]
  missingInTarget: string[]
  extraInTarget: string[]
  sourceIgnoredLineCount: number
  targetIgnoredLineCount: number
}

function readEnvVariableName(line: string): string | null {
  const normalized = line.replace(/^\uFEFF/, '').trim()

  if (!normalized || normalized.startsWith('#') || normalized.startsWith('//')) {
    return null
  }

  const withoutExport = normalized.replace(/^export\s+/, '')
  const match = withoutExport.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|:)/)

  return match?.[1] ?? null
}

export function parseEnvFileVariables(content: string): EnvFileVariables {
  const variableNames: string[] = []
  const seenVariableNames = new Set<string>()
  let ignoredLineCount = 0

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.replace(/^\uFEFF/, '').trim()

    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue
    }

    const variableName = readEnvVariableName(line)

    if (!variableName) {
      ignoredLineCount += 1
      continue
    }

    if (!seenVariableNames.has(variableName)) {
      seenVariableNames.add(variableName)
      variableNames.push(variableName)
    }
  }

  return { variableNames, ignoredLineCount }
}

export function compareEnvFiles(sourceContent: string, targetContent: string): EnvFileDiffResult {
  const source = parseEnvFileVariables(sourceContent)
  const target = parseEnvFileVariables(targetContent)
  const targetVariableSet = new Set(target.variableNames)
  const sourceVariableSet = new Set(source.variableNames)

  return {
    sourceVariables: source.variableNames,
    targetVariables: target.variableNames,
    missingInTarget: source.variableNames.filter((variableName) => !targetVariableSet.has(variableName)),
    extraInTarget: target.variableNames.filter((variableName) => !sourceVariableSet.has(variableName)),
    sourceIgnoredLineCount: source.ignoredLineCount,
    targetIgnoredLineCount: target.ignoredLineCount
  }
}

export function formatVariableNames(variableNames: string[]): string {
  return variableNames.join('\n')
}
