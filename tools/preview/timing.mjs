// What each recurring step costs, in milliseconds per call: the band's
// frame (8 a second), the events (each check), the Ghostty shader's text
// (each check, every 10 s), and iTerm2's wallpaper (see wallpaper.mjs).
//
//   tools/preview/run.sh timing --columns 160

import { STOCKHOLM } from '../../hooks/astro.ts'
import { drawFrame } from '../../hooks/clawd.ts'
import { contextAt, EVENTS, eventsAt, shootingRate, specsOf } from '../../hooks/events.ts'
import { BASE_THEME, THEMES } from '../../hooks/themes/index.ts'
import { shaderParams, skyShader } from '../../hooks/shader.ts'
import { options, weatherOf } from './lib.mjs'

const o = options({ columns: 160, runs: 400 })
const runs = Number(o.runs)
const weather = weatherOf(o.weather)
const ms = Date.UTC(2026, 9, 24, 12)

function time(name, step) {
  for (let i = 0; i < 20; i++) step(i)
  const start = performance.now()
  for (let i = 0; i < runs; i++) step(i)
  const each = (performance.now() - start) / runs
  console.log(`${name.padEnd(28)} ${each.toFixed(3)} ms`)
}

time(`band frame, ${o.columns} columns`, i => drawFrame({ columns: Number(o.columns), ms: ms + i * 125, t: i / 8, mode: 'live', place: STOCKHOLM, weather }))
time('events', i => {
  const at = ms + i * 10_000
  eventsAt(at, contextAt(at, STOCKHOLM, weather, null), [], [...EVENTS, ...specsOf(THEMES[BASE_THEME])])
})
time('ghostty shader text', i => {
  const at = ms + i * 10_000
  const context = contextAt(at, STOCKHOLM, weather, null)
  skyShader(shaderParams({ ms: at, t: at / 1000, place: STOCKHOLM, weather }, { events: eventsAt(at, context, [], [...EVENTS, ...specsOf(THEMES[BASE_THEME])]), shootingRate: shootingRate(context) }), THEMES[BASE_THEME])
})
