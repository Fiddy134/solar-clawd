// Colour, noise, a pixel canvas and the encodings that leave this module:
// base64, and a PNG built without a compressor.

export function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v))
}

export function smoothstep(lo: number, hi: number, v: number): number {
  const t = clamp((v - lo) / (hi - lo))

  return t * t * (3 - 2 * t)
}

export function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff
    const y = (b >> shift) & 0xff

    return Math.round(x + (y - x) * t) << shift
  }

  return ch(16) | ch(8) | ch(0)
}

export function scale(c: number, k: number): number {
  return mix(0, c, k)
}

export function luminance(c: number): number {
  return (
    (0.2126 * ((c >> 16) & 0xff) +
      0.7152 * ((c >> 8) & 0xff) +
      0.0722 * (c & 0xff)) /
    255
  )
}

export function grey(c: number): number {
  const v = Math.round(luminance(c) * 255)

  return (v << 16) | (v << 8) | v
}

// Pushes a colour away from its grey (k > 1) or toward it (k < 1).
export function saturate(c: number, k: number): number {
  const g = grey(c) & 0xff
  const ch = (shift: number) => {
    const x = (c >> shift) & 0xff

    return Math.round(clamp(g + (x - g) * k, 0, 255)) << shift
  }

  return ch(16) | ch(8) | ch(0)
}

export function hash(n: number): number {
  let x = Math.imul(n | 0, 0x2c1b3c6d)
  x ^= x >>> 12
  x = Math.imul(x, 0x297a2d39)
  x ^= x >>> 15

  return x >>> 0
}

// A repeatable number in [0, 1) for a seed.
export function rand(seed: number): number {
  return hash(seed) / 4294967296
}

// Smooth 1D value noise in [0, 1].
export function noise(x: number, seed: number): number {
  const i = Math.floor(x)
  const a = rand(i * 374761 + seed * 668265)
  const b = rand((i + 1) * 374761 + seed * 668265)

  return a + (b - a) * smoothstep(0, 1, x - i)
}

export class Canvas {
  readonly w: number
  readonly h: number
  readonly px: Uint32Array
  // 1 where something stands in front of the sky.
  readonly solid: Uint8Array

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.px = new Uint32Array(w * h)
    this.solid = new Uint8Array(w * h)
  }

  isSolid(x: number, y: number): boolean {
    return this.solid[y * this.w + x] === 1
  }

  get(x: number, y: number): number {
    return this.px[y * this.w + x] ?? 0
  }

  // Sky: paints without standing in front of it.
  paint(x: number, y: number, c: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c
  }

  set(x: number, y: number, c: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      this.px[y * this.w + x] = c
      this.solid[y * this.w + x] = 1
    }
  }

  blend(x: number, y: number, c: number, a: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h && a > 0) {
      this.set(x, y, mix(this.get(x, y), c, clamp(a)))
    }
  }

  // Like blend, but leaves the pixel sky: for what is part of the sky
  // itself (stars, clouds, aurora on the wallpaper).
  glaze(x: number, y: number, c: number, a: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h && a > 0) {
      this.paint(x, y, mix(this.get(x, y), c, clamp(a)))
    }
  }

  // Rows of characters, each looked up in the palette; '.' and unknown
  // characters are see-through. `light` dims everything but the glow keys.
  sprite(
    x0: number,
    y0: number,
    rows: readonly string[],
    palette: Record<string, number>,
    light = 1,
    glows = '',
  ): void {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx]!
        const c = palette[ch]
        if (c === undefined) continue
        this.set(x0 + dx, y0 + dy, glows.includes(ch) ? c : scale(c, light))
      }
    })
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// The runtime's own encoder where it has one: a wallpaper is megabytes.
type Base64Bytes = Uint8Array & { toBase64?: () => string }

export function toBase64(bytes: Uint8Array): string {
  const native = (bytes as Base64Bytes).toBase64
  if (typeof native === 'function') return native.call(bytes)

  // Character codes straight into a byte array, decoded once: no string
  // per character.
  const out = new Uint8Array(Math.ceil(bytes.length / 3) * 4)
  let at = 0
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out[at] = B64_CODES[(n >> 18) & 63]!
    out[at + 1] = B64_CODES[(n >> 12) & 63]!
    out[at + 2] = i + 1 < bytes.length ? B64_CODES[(n >> 6) & 63]! : 61
    out[at + 3] = i + 2 < bytes.length ? B64_CODES[n & 63]! : 61
    at += 4
  }

  return new TextDecoder().decode(out)
}

const B64_CODES = Uint8Array.from(B64, ch => ch.charCodeAt(0))

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }

  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)

  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))

  return out
}

// A PNG's raw rows, RGB, each led by filter 1 ("Sub": every byte minus the
// one a pixel to its left), filled a band of rows at a time so a large
// picture can be built between other work. A sky's rows are nearly flat
// left to right, so they become runs of zeros that compress to almost nothing.
export function pngRows(canvas: Canvas): Uint8Array {
  return new Uint8Array(canvas.h * (canvas.w * 3 + 1))
}

export function fillPngRows(
  canvas: Canvas,
  rows: Uint8Array,
  from: number,
  to: number,
  color: (c: number) => number = c => c,
): void {
  const { w } = canvas
  for (let y = from; y < Math.min(to, canvas.h); y++) {
    const row = y * (w * 3 + 1)
    rows[row] = 1
    let last = 0
    for (let x = 0; x < w; x++) {
      const c = color(canvas.px[y * w + x] ?? 0)
      rows[row + 1 + x * 3] = (((c >> 16) & 0xff) - ((last >> 16) & 0xff)) & 0xff
      rows[row + 2 + x * 3] = (((c >> 8) & 0xff) - ((last >> 8) & 0xff)) & 0xff
      rows[row + 3 + x * 3] = ((c & 0xff) - (last & 0xff)) & 0xff
      last = c
    }
  }
}

// Bits written least significant first, as deflate packs them.
class BitWriter {
  bytes: Uint8Array
  at = 0
  bit = 0
  value = 0

  constructor(size: number) {
    this.bytes = new Uint8Array(size)
  }

  write(value: number, count: number): void {
    this.value |= value << this.bit
    this.bit += count
    while (this.bit >= 8) {
      if (this.at >= this.bytes.length) {
        const grown = new Uint8Array(this.bytes.length * 2)
        grown.set(this.bytes)
        this.bytes = grown
      }
      this.bytes[this.at++] = this.value & 0xff
      this.value >>>= 8
      this.bit -= 8
    }
  }

  // A Huffman code goes most significant bit first.
  code(value: number, count: number): void {
    let reversed = 0
    for (let i = 0; i < count; i++) reversed |= ((value >> i) & 1) << (count - 1 - i)
    this.write(reversed, count)
  }

  finish(): Uint8Array {
    if (this.bit > 0) this.write(0, 8 - this.bit)

    return this.bytes.subarray(0, this.at)
  }
}

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]

// The fixed Huffman code of a literal or length symbol (RFC 1951, 3.2.6).
function symbol(out: BitWriter, n: number): void {
  if (n < 144) out.code(0x30 + n, 8)
  else if (n < 256) out.code(0x190 + n - 144, 9)
  else if (n < 280) out.code(n - 256, 7)
  else out.code(0xc0 + n - 280, 8)
}

// One fixed-Huffman deflate block whose only matches are runs: a byte, then
// "the same again, n times" at distance 1. Crude, and plenty for a sky.
function deflate(data: Uint8Array): Uint8Array {
  const out = new BitWriter(Math.max(1024, data.length >> 3))
  out.write(1, 1)
  out.write(1, 2)
  let i = 0
  while (i < data.length) {
    const b = data[i]!
    let run = 0
    if (i > 0 && data[i - 1] === b) {
      while (run < 258 && i + run < data.length && data[i + run] === b) run++
    }
    if (run >= 3) {
      let code = 0
      while (code < 28 && LENGTH_BASE[code + 1]! <= run) code++
      symbol(out, 257 + code)
      out.write(run - LENGTH_BASE[code]!, LENGTH_EXTRA[code]!)
      out.code(0, 5)
      i += run
    } else {
      symbol(out, b)
      i++
    }
  }
  symbol(out, 256)

  return out.finish()
}

function adler32(data: Uint8Array): number {
  let a = 1
  let d = 0
  for (let i = 0; i < data.length; i++) {
    a += data[i]!
    d += a
    // Reduce now and then, not every byte: a and d stay exact below 2^53.
    if ((i & 4095) === 4095) {
      a %= 65521
      d %= 65521
    }
  }

  return (((d % 65521) << 16) | (a % 65521)) >>> 0
}

// The PNG around filled rows.
export function pngOf(width: number, height: number, rows: Uint8Array): Uint8Array {
  const body = deflate(rows)
  const zlib = new Uint8Array(2 + body.length + 4)
  zlib[0] = 0x78
  zlib[1] = 0x01
  zlib.set(body, 2)
  new DataView(zlib.buffer).setUint32(2 + body.length, adler32(rows))

  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8)

  const chunks = [chunk('IHDR', header), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0))]
  const out = new Uint8Array(8 + chunks.reduce((n, c) => n + c.length, 0))
  out.set([137, 80, 78, 71, 13, 10, 26, 10])
  let offset = 8
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }

  return out
}

export function png(canvas: Canvas, color: (c: number) => number = c => c): Uint8Array {
  const rows = pngRows(canvas)
  fillPngRows(canvas, rows, 0, canvas.h, color)

  return pngOf(canvas.w, canvas.h, rows)
}

type Base64Decoder = { fromBase64?: (text: string) => Uint8Array }

export function fromBase64(text: string): Uint8Array {
  const native = (Uint8Array as unknown as Base64Decoder).fromBase64
  if (typeof native === 'function') return native(text)

  const clean = text.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let bits = 0
  let value = 0
  let at = 0
  for (const ch of clean) {
    value = (value << 6) | B64.indexOf(ch)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[at++] = (value >> bits) & 0xff
    }
  }

  return out
}

// --- Risograph ---------------------------------------------------------------

// The inks of a risograph, as the visual folder prints with them.
export const INKS = {
  blue: 0x0078bf,
  pink: 0xff48b0,
  yellow: 0xffe800,
  green: 0x00a95c,
  orange: 0xff6c2f,
  violet: 0x765ba7,
  indigo: 0x2e3192,
} as const

// Each ink is screened at its own angle, as on the drum.
export const SCREEN_ANGLES = {
  blue: 15,
  pink: 75,
  yellow: 0,
  green: 45,
  orange: 45,
  violet: 30,
  indigo: 60,
} as const

// How much of the point (x, y) a halftone dot covers, 0 to 1: dots on a
// lattice `pitch` apart, turned to `angle` degrees, each as large as `tone`
// asks (0 none, 1 solid), their edges antialiased.
export function screen(x: number, y: number, tone: number, pitch: number, angle: number): number {
  if (tone <= 0.01) return 0
  if (tone >= 0.99) return 1
  const a = (angle * Math.PI) / 180
  const u = (x * Math.cos(a) + y * Math.sin(a)) / pitch
  const v = (-x * Math.sin(a) + y * Math.cos(a)) / pitch
  const du = u - Math.round(u)
  const dv = v - Math.round(v)
  const distance = Math.sqrt(du * du + dv * dv) * pitch
  const radius = pitch * Math.sqrt(tone / Math.PI) * 1.1

  return clamp(radius - distance + 0.5)
}
