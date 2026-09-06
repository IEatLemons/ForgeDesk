const gitErrorMarkers = [
  /\b(?:fatal|error):/i,
  /\bfailed\b/i,
  /\bdenied\b/i,
  /\brejected\b/i,
  /\bcould not\b/i,
  /\bcannot\b/i,
  /\bunable to\b/i,
  /\bpermission denied\b/i,
  /\[remote rejected\]/i
]

export function isProjectGitTaskErrorLine(line: string): boolean {
  return gitErrorMarkers.some((marker) => marker.test(line.trim()))
}
