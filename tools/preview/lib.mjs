// Shared bits of the previews: options from argv, the moon texture, cells
// as an SVG, and an SVG or a PNG laid down in .preview/.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { fromBase64 } from '../../hooks/paint.ts'

// Set by run.sh: the bundle runs from .preview/, not from here.
export const ROOT = process.env.SOLAR_ROOT ?? process.cwd()
export const OUT = join(ROOT, '.preview')
mkdirSync(OUT, { recursive: true })

// --name value pairs, a bare --flag meaning true.
export function options(defaults) {
  const result = { ...defaults }
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '')
    const next = args[i + 1]
    if (next === undefined || next.startsWith('--')) result[key] = true
    else result[key] = (i++, next)
  }

  return result
}

// "2026-10-24T18:30" read as Swedish local time when it has no zone.
export function timeOf(text) {
  if (!text || text === true) return Date.now()
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(text)) return Date.parse(text)
  const guess = Date.parse(`${text}Z`)
  const offset = new Date(guess).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', timeZoneName: 'shortOffset' })
  const [, sign, hours] = /GMT([+-])(\d+)/.exec(offset) ?? [, '+', '0']

  return guess - (sign === '-' ? -1 : 1) * Number(hours) * 3_600_000
}

// "code,temperature,wind,cloudCover", e.g. 61,8,4,90 for rain.
export function weatherOf(text) {
  if (!text || text === true) return { temperature: 12, code: 1, cloudCover: 20, wind: 3 }
  const [code, temperature = 10, wind = 3, cloudCover = 50] = String(text).split(',').map(Number)

  return { temperature, code, cloudCover, wind }
}

export function moonTexture() {
  const path = join(ROOT, 'assets/moon.rgba')
  if (!existsSync(path)) return null
  const rgba = new Uint8Array(readFileSync(path))

  return rgba.length === 256 * 256 * 4 ? { size: 256, rgba } : null
}

const hex = c => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`
const escape = text => text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch])

// A frame's cells (base64 words: character, foreground, background) as SVG
// rects and text, one cell `cell` wide and twice that tall, at `top`.
// 0x01000000 is the terminal's own background.
export function cellsSvg(base64, columns, rows, cell, top = 0, terminal = 0x282c34) {
  const bytes = fromBase64(base64)
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4)
  const color = c => hex(c === 0x01000000 ? terminal : c)
  const h = cell * 2
  const parts = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 3
      const [code, fg, bg] = [words[i], words[i + 1], words[i + 2]]
      const px = x * cell
      const py = top + y * h
      if (code === 0x2580 || code === 0x2584) {
        const [upper, lower] = code === 0x2580 ? [fg, bg] : [bg, fg]
        parts.push(`<rect x="${px}" y="${py}" width="${cell}" height="${cell}" fill="${color(upper)}"/>`)
        parts.push(`<rect x="${px}" y="${py + cell}" width="${cell}" height="${cell}" fill="${color(lower)}"/>`)
      } else {
        parts.push(`<rect x="${px}" y="${py}" width="${cell}" height="${h}" fill="${color(bg)}"/>`)
        if (code !== 0x20) {
          const char = escape(String.fromCodePoint(code))
          parts.push(`<text x="${px}" y="${py + h * 0.76}" font-size="${cell / 0.6}" fill="${color(fg)}">${char}</text>`)
        }
      }
    }
  }

  return parts.join('')
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// Its own empty profile, so it never reaches for the person's.
const HEADLESS = ['--headless', '--hide-scrollbars', `--user-data-dir=${join(OUT, 'chrome')}`, '--no-first-run', '--no-default-browser-check']
// WebGL without a GPU: SwiftShader.
const WEBGL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']

// A page (an .svg or .html in .preview/) laid down as a PNG at exactly
// width × height.
export function screenshot(file, width, height, name, isWebGl = false) {
  const png = join(OUT, `${name}.png`)
  const flags = isWebGl ? WEBGL : ['--disable-gpu']
  execFileSync(CHROME, [...HEADLESS, ...flags, '--virtual-time-budget=4000', `--screenshot=${png}`, `--window-size=${width},${height}`, `file://${file}`], { stdio: 'ignore' })

  return png
}

// The page's DOM once its scripts have run, for what a page reports back.
export function dumpDom(file, isWebGl = false) {
  const flags = isWebGl ? WEBGL : ['--disable-gpu']

  return execFileSync(CHROME, [...HEADLESS, ...flags, '--virtual-time-budget=4000', '--dump-dom', `file://${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

// An SVG laid down as a PNG at exactly width × height, by headless Chrome.
export function svgToPng(body, width, height, name) {
  const svg = join(OUT, `${name}.svg`)
  writeFileSync(
    svg,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Menlo" shape-rendering="crispEdges">${body}</svg>`,
  )

  return screenshot(svg, width, height, name)
}

export function writePng(bytes, name) {
  const path = join(OUT, `${name}.png`)
  writeFileSync(path, bytes)

  return path
}
