// How far two previews of the sky lie apart: the largest difference in any
// channel, how many pixels changed at all, and how many of those lie more
// than a pixel from text, where a change to the rim or the glass should not
// reach, and by more than 8/255, F4's budget. Text is wherever the terminal
// (a --passthrough preview of the same stand-in) is not its background, the
// colour it shows most; without one, text is not told apart. With --out,
// the changes as a picture, black where nothing changed and brighter the
// more, red within a pixel of text.
//
//   node tools/preview/diff.mjs .preview/before.png .preview/after.png --terminal .preview/term.png --out .preview/changes.png

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = name => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? null : args.splice(i, 2)[1]
}
const terminalPath = flag('terminal')
const outPath = flag('out')
const [aPath, bPath] = args
if (!aPath || !bPath) {
  console.error('usage: diff.mjs a.png b.png [--terminal term.png] [--out changes.png]')
  process.exit(2)
}

// A PNG's size, from its header, and its pixels as RGB bytes, by ffmpeg.
function load(path) {
  const head = readFileSync(path).subarray(16, 24)
  const [width, height] = [head.readUInt32BE(0), head.readUInt32BE(4)]
  const rgb = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {
    maxBuffer: width * height * 3 + 1024,
  })

  return { width, height, rgb }
}

const a = load(aPath)
const b = load(bPath)
if (a.width !== b.width || a.height !== b.height) {
  console.error(`sizes differ: ${a.width}x${a.height} and ${b.width}x${b.height}`)
  process.exit(2)
}
const { width, height } = a
const count = width * height

// Near text: a pixel of text or one of the eight round it.
const isNearText = new Uint8Array(count)
if (terminalPath) {
  const t = load(terminalPath)
  if (t.width !== width || t.height !== height) {
    console.error(`the terminal is ${t.width}x${t.height}, the previews ${width}x${height}`)
    process.exit(2)
  }
  const tally = new Map()
  for (let i = 0; i < count; i++) {
    const c = (t.rgb[3 * i] << 16) | (t.rgb[3 * i + 1] << 8) | t.rgb[3 * i + 2]
    tally.set(c, (tally.get(c) ?? 0) + 1)
  }
  const background = [...tally].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const c = (t.rgb[3 * i] << 16) | (t.rgb[3 * i + 1] << 8) | t.rgb[3 * i + 2]
      if (c === background) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy]
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) isNearText[ny * width + nx] = 1
        }
      }
    }
  }
}

let largest = 0
let largestAway = 0
let changed = 0
let away = 0
let awayOver = 0
let worst = null
let box = null
const picture = outPath ? Buffer.alloc(count * 3) : null
for (let i = 0; i < count; i++) {
  let off = 0
  for (let ch = 0; ch < 3; ch++) off = Math.max(off, Math.abs(a.rgb[3 * i + ch] - b.rgb[3 * i + ch]))
  if (off === 0) continue
  changed++
  largest = Math.max(largest, off)
  const [x, y] = [i % width, Math.floor(i / width)]
  if (!isNearText[i]) {
    away++
    if (off > 8) awayOver++
    if (off > largestAway) [largestAway, worst] = [off, { x, y }]
  }
  box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y]
  if (picture) {
    const v = Math.min(255, 32 + off * 16)
    picture[3 * i] = v
    picture[3 * i + 1] = isNearText[i] ? 0 : v
    picture[3 * i + 2] = isNearText[i] ? 0 : v
  }
}

console.log(`largest difference ${largest}/255, ${changed} of ${count} pixels changed`)
console.log(
  terminalPath
    ? `more than 1 px from text: ${away} changed, ${awayOver} by more than 8/255, the largest ${largestAway}/255${worst ? ` at ${worst.x},${worst.y}` : ''}`
    : 'no --terminal: text not told apart',
)
if (box) console.log(`changes within x ${box[0]}..${box[2]}, y ${box[1]}..${box[3]}`)
// Through a file: from a pipe, ffmpeg cuts a large frame short.
if (picture) {
  const dir = mkdtempSync(join(tmpdir(), 'diff-'))
  writeFileSync(join(dir, 'changes.rgb'), picture)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, '-i', join(dir, 'changes.rgb'), '-y', outPath])
  rmSync(dir, { recursive: true })
  console.log(outPath)
}
