export type DiffDisplayLineType = 'context' | 'add' | 'delete'

export type DiffDisplayLine = {
  id: string
  type: DiffDisplayLineType
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

export type DiffDisplayInput = {
  oldContent: string
  newContent: string
  patch: string
}

function splitContentLines(content: string): string[] {
  if (!content) {
    return []
  }

  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  if (lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}

function createLine({
  index,
  type,
  text,
  oldLineNumber,
  newLineNumber
}: {
  index: number
  type: DiffDisplayLineType
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}): DiffDisplayLine {
  return {
    id: `${type}:${oldLineNumber ?? ''}:${newLineNumber ?? ''}:${index}`,
    type,
    text,
    oldLineNumber,
    newLineNumber
  }
}

export function createSourceDiffLines(content: string): DiffDisplayLine[] {
  return splitContentLines(content).map((text, index) =>
    createLine({
      index,
      type: 'context',
      text,
      oldLineNumber: index + 1
    })
  )
}

function parseHunkHeader(line: string): { oldLineNumber: number; newLineNumber: number } | null {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)

  if (!match) {
    return null
  }

  return {
    oldLineNumber: Number(match[1]),
    newLineNumber: Number(match[2])
  }
}

function normalizePatchText(patch: string): string {
  const normalized = patch.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    return normalized.replace(/\\n/g, '\n')
  }

  return normalized
}

export function createDiffResultLines(diff: DiffDisplayInput): DiffDisplayLine[] {
  if (!diff.patch.trim()) {
    return splitContentLines(diff.newContent).map((text, index) =>
      createLine({
        index,
        type: 'context',
        text,
        newLineNumber: index + 1
      })
    )
  }

  const resultLines: DiffDisplayLine[] = []
  let oldLineNumber = 0
  let newLineNumber = 0
  let insideHunk = false

  for (const rawLine of normalizePatchText(diff.patch).split('\n')) {
    const hunk = parseHunkHeader(rawLine)

    if (hunk) {
      oldLineNumber = hunk.oldLineNumber
      newLineNumber = hunk.newLineNumber
      insideHunk = true
      continue
    }

    if (!insideHunk || rawLine.startsWith('\\ No newline')) {
      continue
    }

    const marker = rawLine[0]
    const text = rawLine.slice(1)
    const index = resultLines.length

    if (marker === '+') {
      resultLines.push(createLine({ index, type: 'add', text, newLineNumber }))
      newLineNumber += 1
    } else if (marker === '-') {
      resultLines.push(createLine({ index, type: 'delete', text, oldLineNumber }))
      oldLineNumber += 1
    } else {
      resultLines.push(createLine({ index, type: 'context', text, oldLineNumber, newLineNumber }))
      oldLineNumber += 1
      newLineNumber += 1
    }
  }

  return resultLines
}
