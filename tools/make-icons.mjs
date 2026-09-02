// Build the install icons from Roy's selected Sort Stream source art.
// Plain Node keeps this reproducible without adding an image dependency.
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATIC = join(ROOT, 'static')
const SOURCE = join(ROOT, 'assets', 'branding', 'sort-stream-source.png')
const MASKABLE_SOURCE = join(ROOT, 'assets', 'branding', 'sort-stream-maskable-source.png')

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, body) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([length, typed, crc])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function readPng(file) {
  const input = readFileSync(file)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!input.subarray(0, 8).equals(signature)) throw new Error(`${file}: not a PNG`)

  let width, height, bitDepth, colorType, interlace
  const idat = []
  for (let offset = 8; offset < input.length;) {
    const length = input.readUInt32BE(offset)
    const type = input.toString('ascii', offset + 4, offset + 8)
    const body = input.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      bitDepth = body[8]
      colorType = body[9]
      interlace = body[12]
    } else if (type === 'IDAT') idat.push(body)
    offset += length + 12
  }
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) {
    throw new Error(`${file}: expected non-interlaced 8-bit RGB PNG`)
  }

  const stride = width * 3
  const raw = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0, from = 0; y < height; y++) {
    const filter = raw[from++]
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const value = raw[from++]
      const left = x >= 3 ? pixels[row + x - 3] : 0
      const up = y ? pixels[row - stride + x] : 0
      const upperLeft = y && x >= 3 ? pixels[row - stride + x - 3] : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : (() => { throw new Error(`${file}: unsupported PNG filter ${filter}`) })()
      pixels[row + x] = (value + predictor) & 0xff
    }
  }
  return { width, height, pixels }
}

function resize(source, size) {
  const pixels = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    const sy = (y + 0.5) * source.height / size - 0.5
    const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(source.height - 1, y0 + 1)
    const fy = Math.max(0, sy - y0)
    for (let x = 0; x < size; x++) {
      const sx = (x + 0.5) * source.width / size - 0.5
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(source.width - 1, x0 + 1)
      const fx = Math.max(0, sx - x0)
      for (let channel = 0; channel < 3; channel++) {
        const a = source.pixels[(y0 * source.width + x0) * 3 + channel]
        const b = source.pixels[(y0 * source.width + x1) * 3 + channel]
        const c = source.pixels[(y1 * source.width + x0) * 3 + channel]
        const d = source.pixels[(y1 * source.width + x1) * 3 + channel]
        pixels[(y * size + x) * 3 + channel] = Math.round(
          (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy,
        )
      }
    }
  }
  return { width: size, height: size, pixels }
}

function png(image) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(image.width, 0)
  ihdr.writeUInt32BE(image.height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const stride = image.width * 3
  const raw = Buffer.alloc(image.height * (stride + 1))
  for (let y = 0; y < image.height; y++) {
    raw[y * (stride + 1)] = 0
    image.pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const source = readPng(SOURCE)
for (const size of [180, 192, 512]) {
  writeFileSync(join(STATIC, `icon-${size}.png`), png(resize(source, size)))
}
writeFileSync(join(STATIC, 'icon-maskable-512.png'), png(resize(readPng(MASKABLE_SOURCE), 512)))
rmSync(join(STATIC, 'icon.svg'), { force: true })
console.log('wrote Sort Stream icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png')
