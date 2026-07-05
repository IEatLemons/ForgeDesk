import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, it } from 'node:test'

function readPngAlphaBounds(path) {
  const file = readFileSync(path)
  const signature = file.subarray(0, 8)

  assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10])

  let offset = 8
  let width = 0
  let height = 0
  const idat = []

  while (offset < file.length) {
    const length = file.readUInt32BE(offset)
    const type = file.toString('ascii', offset + 4, offset + 8)
    const data = file.subarray(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      assert.equal(data[8], 8)
      assert.equal(data[9], 6)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }

    offset += length + 12
  }

  const bytesPerPixel = 4
  const stride = width * bytesPerPixel
  const raw = inflateSync(Buffer.concat(idat))
  let rawOffset = 0
  let previousRow = Buffer.alloc(stride)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset]
    rawOffset += 1

    const row = Buffer.alloc(stride)

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0
      const up = previousRow[x]
      const upLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0
      const predictor = left + up - upLeft
      const leftDistance = Math.abs(predictor - left)
      const upDistance = Math.abs(predictor - up)
      const upLeftDistance = Math.abs(predictor - upLeft)
      const paeth =
        leftDistance <= upDistance && leftDistance <= upLeftDistance
          ? left
          : upDistance <= upLeftDistance
            ? up
            : upLeft
      const byte = raw[rawOffset]
      rawOffset += 1

      if (filter === 0) {
        row[x] = byte
      } else if (filter === 1) {
        row[x] = (byte + left) & 255
      } else if (filter === 2) {
        row[x] = (byte + up) & 255
      } else if (filter === 3) {
        row[x] = (byte + Math.floor((left + up) / 2)) & 255
      } else if (filter === 4) {
        row[x] = (byte + paeth) & 255
      } else {
        throw new Error(`Unsupported PNG filter: ${filter}`)
      }
    }

    for (let x = 0; x < width; x += 1) {
      if (row[x * bytesPerPixel + 3] > 0) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    previousRow = row
  }

  return {
    width,
    height,
    contentWidth: maxX - minX + 1,
    contentHeight: maxY - minY + 1
  }
}

describe('app icon assets', () => {
  it('keeps the runtime dock icon large enough for macOS chrome', () => {
    const bounds = readPngAlphaBounds(join(process.cwd(), 'resources/forgedesk.png'))

    assert.equal(bounds.width, 1024)
    assert.equal(bounds.height, 1024)
    assert.ok(bounds.contentWidth >= 820, `expected icon content width >= 820px, got ${bounds.contentWidth}px`)
    assert.ok(bounds.contentHeight >= 820, `expected icon content height >= 820px, got ${bounds.contentHeight}px`)
  })

  it('keeps packaged and renderer logo SVGs in sync', () => {
    const packagedLogo = readFileSync(join(process.cwd(), 'resources/forgedesk-logo.svg'), 'utf8')
    const rendererLogo = readFileSync(join(process.cwd(), 'src/renderer/src/assets/forgedesk-logo.svg'), 'utf8')

    assert.equal(rendererLogo, packagedLogo)
  })
})
