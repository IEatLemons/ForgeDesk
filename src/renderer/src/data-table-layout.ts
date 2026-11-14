type TableColumn = {
  width?: number | string
  hidden?: boolean
  children?: readonly TableColumn[]
}

const flexibleColumnWidth = 120

function getColumnsWidth(columns: readonly TableColumn[]): number {
  return columns.reduce((total, column) => {
    if (column.hidden) return total
    if (column.children?.length) return total + getColumnsWidth(column.children)
    // Percentage and CSS widths are resolved by the table in the browser.
    return total + (column.width == null ? flexibleColumnWidth : Number(column.width) || 0)
  }, 0)
}

export function getTableScrollWidth(
  requestedWidth: number,
  columns: readonly TableColumn[] = [],
  selectionWidth: number | string = 0
): number {
  return Math.max(requestedWidth, getColumnsWidth(columns) + (Number(selectionWidth) || 0))
}
