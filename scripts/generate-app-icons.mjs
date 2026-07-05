import { deflateSync } from 'node:zlib'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const canvasSize = 1024
const samples = 4
const colors = {
  background: [17, 24, 39],
  foreground: [248, 250, 252],
  accent: [56, 189, 248]
}
const background = { x: 96, y: 96, width: 832, height: 832, radius: 208 }
const foregroundPath = [
  [316, 257],
  [732, 257],
  [732, 391],
  [465, 391],
  [465, 502],
  [678, 502],
  [678, 636],
  [465, 636],
  [465, 767],
  [316, 767]
]
const accent = { x: 636, y: 683, width: 144, height: 144, radius: 37 }
const iconsetSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

function createSvg() {
  const foregroundPathData = foregroundPath
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${formatNumber(x)} ${formatNumber(y)}`)
    .join('')

  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" role="img" aria-label="ForgeDesk" xmlns="http://www.w3.org/2000/svg">
  <rect x="${background.x}" y="${background.y}" width="${background.width}" height="${background.height}" rx="${background.radius}" fill="#111827"/>
  <path d="${foregroundPathData}Z" fill="#F8FAFC"/>
  <rect x="${accent.x}" y="${accent.y}" width="${accent.width}" height="${accent.height}" rx="${accent.radius}" fill="#38BDF8"/>
</svg>
`
}

function insideRoundedRect(px, py, rect, scale) {
  const x = rect.x * scale
  const y = rect.y * scale
  const width = rect.width * scale
  const height = rect.height * scale
  const radius = rect.radius * scale

  if (px < x || py < y || px >= x + width || py >= y + height) {
    return false
  }

  const closestX = Math.max(x + radius, Math.min(px, x + width - radius))
  const closestY = Math.max(y + radius, Math.min(py, y + height - radius))
  const dx = px - closestX
  const dy = py - closestY

  return dx * dx + dy * dy <= radius * radius
}

function insidePolygon(px, py, points, scale) {
  let inside = false

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0] * scale
    const yi = points[i][1] * scale
    const xj = points[j][0] * scale
    const yj = points[j][1] * scale
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function coverageForPixel(x, y, contains) {
  let covered = 0

  for (let sampleY = 0; sampleY < samples; sampleY += 1) {
    for (let sampleX = 0; sampleX < samples; sampleX += 1) {
      if (contains(x + (sampleX + 0.5) / samples, y + (sampleY + 0.5) / samples)) {
        covered += 1
      }
    }
  }

  return covered / (samples * samples)
}

function blend(buffer, index, color, alpha) {
  if (alpha <= 0) {
    return
  }

  const sourceAlpha = alpha / 255
  const targetAlpha = buffer[index + 3] / 255
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha)

  for (let channel = 0; channel < 3; channel += 1) {
    const target = buffer[index + channel]
    buffer[index + channel] = Math.round((color[channel] * sourceAlpha + target * targetAlpha * (1 - sourceAlpha)) / outputAlpha)
  }

  buffer[index + 3] = Math.round(outputAlpha * 255)
}

function drawShape(buffer, size, color, bounds, contains) {
  const minX = Math.max(0, Math.floor(bounds.x))
  const minY = Math.max(0, Math.floor(bounds.y))
  const maxX = Math.min(size, Math.ceil(bounds.x + bounds.width))
  const maxY = Math.min(size, Math.ceil(bounds.y + bounds.height))

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const coverage = coverageForPixel(x, y, contains)

      if (coverage > 0) {
        blend(buffer, (y * size + x) * 4, color, Math.round(coverage * 255))
      }
    }
  }
}

function renderIcon(size) {
  const scale = size / canvasSize
  const buffer = Buffer.alloc(size * size * 4)

  drawShape(
    buffer,
    size,
    colors.background,
    {
      x: background.x * scale,
      y: background.y * scale,
      width: background.width * scale,
      height: background.height * scale
    },
    (x, y) => insideRoundedRect(x, y, background, scale)
  )
  drawShape(
    buffer,
    size,
    colors.foreground,
    {
      x: 316 * scale,
      y: 257 * scale,
      width: 416 * scale,
      height: 510 * scale
    },
    (x, y) => insidePolygon(x, y, foregroundPath, scale)
  )
  drawShape(
    buffer,
    size,
    colors.accent,
    {
      x: accent.x * scale,
      y: accent.y * scale,
      width: accent.width * scale,
      height: accent.height * scale
    },
    (x, y) => insideRoundedRect(x, y, accent, scale)
  )

  return encodePng(size, size, buffer)
}

function makeCrcTable() {
  const table = []

  for (let n = 0; n < 256; n += 1) {
    let value = n

    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }

    table[n] = value >>> 0
  }

  return table
}

const crcTable = makeCrcTable()

function crc32(buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const output = Buffer.alloc(12 + data.length)

  output.writeUInt32BE(data.length, 0)
  typeBuffer.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)

  return output
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)

  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6

  for (let y = 0; y < height; y += 1) {
    const outputOffset = y * (stride + 1)
    raw[outputOffset] = 0
    rgba.copy(raw, outputOffset + 1, y * stride, y * stride + stride)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function createIcnsChunk(type, data) {
  const output = Buffer.alloc(8 + data.length)

  output.write(type, 0, 4, 'ascii')
  output.writeUInt32BE(output.length, 4)
  data.copy(output, 8)

  return output
}

function writeIcns(path, entries) {
  const chunks = entries.map(([type, data]) => createIcnsChunk(type, data))
  const header = Buffer.alloc(8)
  const totalLength = header.length + chunks.reduce((sum, item) => sum + item.length, 0)

  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(totalLength, 4)
  writeFileSync(path, Buffer.concat([header, ...chunks], totalLength))
}

const svg = createSvg()
const iconsetRoot = mkdtempSync(join(tmpdir(), 'forgedesk-icons-'))
const iconsetDir = join(iconsetRoot, 'forgedesk.iconset')
const keepIconset = process.env.FORGEDESK_KEEP_ICONSET === '1'
mkdirSync(iconsetDir)

try {
  const iconPngs = new Map()

  writeFileSync(join('resources', 'forgedesk-logo.svg'), svg)
  writeFileSync(join('src', 'renderer', 'src', 'assets', 'forgedesk-logo.svg'), svg)
  writeFileSync(join('resources', 'forgedesk.png'), renderIcon(canvasSize))

  for (const [fileName, size] of iconsetSizes) {
    const png = renderIcon(size)

    iconPngs.set(fileName, png)
    writeFileSync(join(iconsetDir, fileName), png)
  }

  writeIcns(join('resources', 'forgedesk.icns'), [
    ['icp4', iconPngs.get('icon_16x16.png')],
    ['ic11', iconPngs.get('icon_16x16@2x.png')],
    ['icp5', iconPngs.get('icon_32x32.png')],
    ['icp6', iconPngs.get('icon_32x32@2x.png')],
    ['ic12', iconPngs.get('icon_32x32@2x.png')],
    ['ic07', iconPngs.get('icon_128x128.png')],
    ['ic13', iconPngs.get('icon_128x128@2x.png')],
    ['ic08', iconPngs.get('icon_256x256.png')],
    ['ic14', iconPngs.get('icon_256x256@2x.png')],
    ['ic09', iconPngs.get('icon_512x512.png')],
    ['ic10', iconPngs.get('icon_512x512@2x.png')]
  ])
} finally {
  if (keepIconset) {
    console.log(`Kept iconset at ${iconsetDir}`)
  } else {
    rmSync(iconsetRoot, { recursive: true, force: true })
  }
}

console.log('Generated ForgeDesk app icon assets.')
