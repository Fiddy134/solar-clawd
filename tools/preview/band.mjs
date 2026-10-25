// The band above the prompt as a PNG: `frames` frames `dt` seconds apart,
// stacked, so a sprite's motion reads at a glance.
//
//   tools/preview/run.sh band --at 2026-10-24T09:00 --columns 80 --frames 4 --dt 0.5
//   --weather 61,8,4,90   rain (code,°C,wind,cloud %)   --reaction cheer   --clear   --paper 85

import { drawFrame, ROWS } from '../../hooks/clawd.ts'
import { STOCKHOLM } from '../../hooks/astro.ts'
import { contextAt, EVENT_WORDS, eventsAt, showerAt, shootingRate } from '../../hooks/events.ts'
import { cellsSvg, moonTexture, options, svgToPng, timeOf, weatherOf } from './lib.mjs'

const o = options({ columns: 80, frames: 1, dt: 0.25, cell: 10, mode: 'live' })
const columns = Number(o.columns)
const frames = Number(o.frames)
const cell = Number(o.cell)
const ms = timeOf(o.at)
const view = {
  columns,
  ms,
  t: ms / 1000,
  mode: o.mode,
  place: STOCKHOLM,
  weather: weatherOf(o.weather),
  kp: o.kp ? Number(o.kp) : null,
  isAuroraForced: !!o.aurora,
  moonTexture: moonTexture(),
  isClear: !!o.clear,
  track: o.track === undefined || o.track === true ? null : o.track,
  // --paper 85: the context window's fill, Clawd's pile of paper.
  paper: o.paper === undefined ? null : Number(o.paper),
}
// The event the band names: --event balloon forces one, as /solar event does.
const context = contextAt(ms, STOCKHOLM, view.weather, null)
const [event] = eventsAt(ms, context, o.event ? [{ kind: o.event, at: ms }] : [])
view.event = event ? EVENT_WORDS[event.kind] : shootingRate(context) > 2 ? showerAt(context.time) : null

const height = ROWS * cell * 2
const gap = cell
let body = ''
for (let f = 0; f < frames; f++) {
  const t = view.t + f * Number(o.dt)
  const reaction = o.reaction ? { kind: o.reaction, age: f * Number(o.dt) } : null
  body += cellsSvg(drawFrame({ ...view, t, reaction }), columns, ROWS, cell, f * (height + gap))
}

console.log(svgToPng(body, columns * cell, frames * (height + gap) - gap, o.out ?? 'band'))
