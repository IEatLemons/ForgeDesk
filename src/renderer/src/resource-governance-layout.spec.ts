import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'

describe('resource governance layout', () => {
  it('keeps long app and process names inside their fixed table column', async () => {
    const [source, styles] = await Promise.all([
      readFile(join(process.cwd(), 'src/renderer/src/resource-governance-panel.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')
    ])

    assert.match(source, /resource-process-table/)
    assert.match(source, /tableLayout="fixed"/)
    assert.match(source, /resource-process-name-button/)
    assert.match(styles, /\.resource-process-table \.ant-table-cell\s*\{[^}]*overflow: hidden/s)
    assert.match(styles, /\.resource-process-name-button > span[^}]*text-overflow: ellipsis/s)
  })

  it('keeps storage directory search and tree table paths scannable', async () => {
    const [source, styles] = await Promise.all([
      readFile(join(process.cwd(), 'src/renderer/src/resource-governance-panel.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')
    ])

    assert.match(source, /storage-directory-search/)
    assert.match(source, /listStorageDirectories/)
    assert.match(source, /expandedDirectoryKeys/)
    assert.match(source, /tableLayout="fixed"/)
    assert.match(source, /ellipsis=\{\{ tooltip: row\.path \}\}/)
    assert.match(source, /storage-candidate-table/)
    assert.match(source, /storageItemNameCell/)
    assert.match(styles, /\.storage-directory-name,[^{]*\.storage-item-name\s*\{[^}]*display: grid/s)
    assert.match(styles, /\.storage-directory-section \.ant-table-cell,[^{]*\.storage-candidate-table \.ant-table-cell\s*\{[^}]*overflow: hidden/s)
  })
})
