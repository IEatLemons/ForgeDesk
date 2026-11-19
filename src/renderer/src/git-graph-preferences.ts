export const gitGraphLayoutKey = 'forgedesk:git-log-layout:v1'
export const gitGraphLayoutEvent = 'forgedesk:git-log-layout-changed'
export function normalizeGraphWidth(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(160, Math.min(640, value))) : null
}
export function graphParentPath(fromX: number, toX: number, height: number): string {
  const middle = height / 2, end = height + 2, curve = Math.min(12, height / 4)
  return fromX === toX ? `M ${fromX} ${middle} L ${toX} ${end}` : `M ${fromX} ${middle} C ${fromX} ${middle + curve} ${toX} ${height - curve} ${toX} ${end}`
}
