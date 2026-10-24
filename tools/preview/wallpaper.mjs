// The iTerm2 wallpaper as a PNG, and how long it takes: one cold frame
// (the still sky painted) and `warm` frames after it (only the clouds).
//
//   tools/preview/run.sh wallpaper --at 2026-10-24T22:00 --width 2880 --height 1800 --weather 2,6,3,40

import { STOCKHOLM } from '../../hooks/astro.ts'
import { fromBase64 } from '../../hooks/paint.ts'
import { wallpaperPng } from '../../hooks/sky.ts'
import { moonTexture, options, timeOf, weatherOf, writePng } from './lib.mjs'

const o = options({ width: 2880, height: 1800, warm: 5 })
const ms = timeOf(o.at)
const input = {
  ms,
  t: ms / 1000,
  place: STOCKHOLM,
  weather: weatherOf(o.weather),
  kp: o.kp ? Number(o.kp) : null,
  isAuroraForced: !!o.aurora,
  moonTexture: moonTexture(),
}
const [width, height] = [Number(o.width), Number(o.height)]
const cache = {}

let start = performance.now()
let base64 = await wallpaperPng(input, width, height, undefined, cache)
const cold = performance.now() - start

start = performance.now()
for (let i = 1; i <= Number(o.warm); i++) base64 = await wallpaperPng({ ...input, t: input.t + i * 2.5 }, width, height, undefined, cache)
const warm = (performance.now() - start) / Math.max(1, Number(o.warm))

const bytes = fromBase64(base64)
console.log(writePng(bytes, o.out ?? 'wallpaper'))
console.log(`${width}×${height}: cold ${cold.toFixed(0)} ms, warm ${warm.toFixed(0)} ms/frame, ${(bytes.length / 1024).toFixed(0)} KB`)
