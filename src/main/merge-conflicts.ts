export type ConflictSection = {
  index: number
  currentLabel: string
  incomingLabel: string
  currentContent: string
  incomingContent: string
  rawContent: string
}

export function hasConflictMarkers(content: string): boolean {
  return content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>')
}

export function extractConflictSections(content: string): ConflictSection[] {
  const lines = content.split(/\r?\n/)
  const sections: ConflictSection[] = []
  let index = 0

  while (index < lines.length) {
    if (!lines[index].startsWith('<<<<<<<')) {
      index += 1
      continue
    }

    const start = index
    const currentLabel = lines[index].replace(/^<<<<<<<\s*/, '').trim()
    const current: string[] = []
    const incoming: string[] = []

    index += 1

    while (index < lines.length && !lines[index].startsWith('=======')) {
      current.push(lines[index])
      index += 1
    }

    if (index >= lines.length) {
      break
    }

    index += 1

    while (index < lines.length && !lines[index].startsWith('>>>>>>>')) {
      incoming.push(lines[index])
      index += 1
    }

    if (index >= lines.length) {
      break
    }

    const incomingLabel = lines[index].replace(/^>>>>>>>\s*/, '').trim()
    const end = index

    sections.push({
      index: sections.length + 1,
      currentLabel,
      incomingLabel,
      currentContent: current.join('\n'),
      incomingContent: incoming.join('\n'),
      rawContent: lines.slice(start, end + 1).join('\n')
    })

    index += 1
  }

  return sections
}
