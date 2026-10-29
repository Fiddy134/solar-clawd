// The band above the prompt: the time and what the hour is for, the place
// and its weather, the sun, the moon and what is passing in the sky, as one
// Raster's cells. Where no wallpaper or shader shows through, the band
// paints its own strip of sky behind them, and the rain or snow in it.

import { localTime, moonAt, OCCASION_WORDS, occasionAt, sunAt } from './astro'
import { activityOn } from './hours'
import type { Activity } from './hours'
import { Canvas, INKS, isPrintable, luminance, mix, rand, toBase64 } from './paint'
import { auroraStrength, paintBandSky, paintPrecipitation, SKY_WORDS, skyOf } from './sky'
import type { SkyInput } from './sky'

// Terminal rows the band takes.
export const ROWS = 3

export type Mode = 'live' | 'demo' | 'pinned'

export type View = SkyInput & {
  columns: number
  mode: Mode
  // The place's UTC offset; absent, Swedish time.
  offsetMs?: number
  // Leave the sky out so the terminal's wallpaper shows through.
  isClear?: boolean
  // What is playing, "title - artist", if anything.
  track?: string | null
  // The word for what is happening in the sky, if anything.
  event?: string | null
}

const LABELS: Record<Activity, string> = {
  earlyBird: "early birdin'",
  coffee: 'coffee sesh',
  work: "workin'",
  vibe: "vibin'",
  nightOwl: 'night owl',
  sleep: 'sleep sesh',
}

const CREAM = 0xf5efe0
// Blue printed thin, for the fireworks' sparks.
const SKY_INK = mix(INKS.blue, 0xffffff, 0.45)

// --- Clawd as the keeper ------------------------------------------------------

// Clawd's figure, which the keeper in Ghostty's sky is drawn after and the
// theme guide quotes: the eyes, arms and legs of a pose.
export type Eyes = 'open' | 'closed' | 'right' | 'left' | 'shades' | 'up'
export type Arms = 'down' | 'typing' | 'up' | 'right-up' | 'none'
export type Legs = 'stand' | 'stepA' | 'stepB'

const FACES: Record<Eyes, string> = {
  open: '.KOOK.',
  closed: '.kOOk.',
  right: '.OKOK.',
  left: '.KOKO.',
  shades: '.GGGG.',
  // Looking up: the eyes move to the top row of his head (clawdRows).
  up: '.OOOO.',
}

const ARMS: Record<Arms, string> = {
  down: 'OOOOOO',
  typing: 'OOOOO.',
  up: '.OOOO.',
  'right-up': 'OOOOO.',
  none: '.OOOO.',
}

const LEGS: Record<Legs, string> = {
  stand: '.O..O.',
  stepA: 'O...O.',
  stepB: '.O...O',
}

// Clawd's four rows for a pose: head, face, arms, legs.
export function clawdRows(eyes: Eyes, arms: Arms, legs: Legs): string[] {
  return [eyes === 'up' ? '.KOOK.' : '.OOOO.', FACES[eyes], ARMS[arms], LEGS[legs]]
}

type Glyph = { x: number; y: number; text: string; fg: number; dim?: boolean }

// Fireworks over the band at the turn of the year.
function paintFireworks(c: Canvas, right: number, t: number): void {
  for (let k = 0; k < 3; k++) {
    const period = 2.2 + k * 0.4
    const age = (t + k * 0.9) % period
    const round = Math.floor((t + k * 0.9) / period)
    const cx = Math.floor(rand(round * 31 + k) * Math.max(1, right - 6)) + 3
    const cy = 2
    const color = [INKS.pink, SKY_INK, INKS.yellow, INKS.violet][Math.floor(rand(round * 17 + k) * 4)]!
    if (age < 0.5) {
      c.blend(cx, c.h - 1 - (age / 0.5) * (c.h - 1 - cy), mix(INKS.yellow, CREAM, 0.6), 0.9)
    } else if (age < 1.6) {
      const r = ((age - 0.5) / 1.1) * 3
      const fade = 1 - (age - 0.5) / 1.1
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        c.blend(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 0.7, color, fade)
      }
    }
  }
}

// --- Frame ----------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Segments joined with ' · ' while they fit in `room`.
function fit(segments: (string | null | undefined | false)[], room: number): string {
  let line = ''
  for (const s of segments) {
    if (!s) continue
    const next = line ? `${line} · ${s}` : s
    if (next.length > room) break
    line = next
  }

  return line
}

// The band as cells: the sky (or the terminal's own background, where a
// wallpaper or shader shows through) and the words, right-aligned.
export function drawFrame(view: View): string {
  const { columns, ms, t, mode, place, weather, isClear = false, track, offsetMs } = view
  const c = new Canvas(columns, ROWS * 2)
  const sun = sunAt(ms, place.lat, place.lon)
  const time = localTime(ms, offsetMs)
  const occasion = occasionAt(time)
  const activity = activityOn(time)
  const isAwake = activity !== 'sleep'
  const isFridayNight = time.weekday === 5 && activity === 'vibe'

  if (!isClear) paintBandSky(c, view)
  paintPrecipitation(c, weather, t)

  const labelRight = columns - 1
  if (occasion === 'newYear') paintFireworks(c, labelRight - 30, t)
  const glyphs: Glyph[] = []

  const room = labelRight - 1
  const aurora = auroraStrength(view, sun) > 0.15
  const moon = moonAt(ms, place.lat, place.lon)
  const status = mode === 'demo' ? 'time-lapse · /solar now' : mode === 'pinned' ? 'pinned time · /solar now' : null
  const lines = [
    fit([`${pad(time.hour)}:${pad(time.minute)}  ${LABELS[activity]}`, occasion && OCCASION_WORDS[occasion], isFridayNight && 'friday night'], room),
    fit([
      place.name,
      weather && `${Math.round(weather.temperature)}°C ${SKY_WORDS[skyOf(weather.code)]}`,
      weather && weather.wind >= 5 && `${Math.round(weather.wind)} m/s`,
    ], room),
    fit([
      view.event && `* ${view.event}`,
      `sun ${Math.round(sun.elevation)}°`,
      moon.elevation > 0 && `moon ${Math.round(moon.illumination * 100)}%`,
      aurora && 'aurora',
      status,
      track && isAwake && `listening: ${track.length > 28 ? `${track.slice(0, 27)}~` : track}`,
    ], room),
  ]
  lines.forEach((text, row) => {
    if (text) glyphs.push({ x: labelRight - text.length, y: row, text, fg: 0, dim: row > 0 })
  })

  return encode(c, glyphs, isClear)
}

// The terminal's own background, where a clear band lets the wallpaper show.
const DEFAULT = 0x01000000

function encode(canvas: Canvas, glyphs: Glyph[], isClear: boolean): string {
  const { w } = canvas
  const words = new Uint32Array(w * ROWS * 3)
  const background = (x: number, y: number) =>
    isClear ? DEFAULT : mix(canvas.get(x, y * 2), canvas.get(x, y * 2 + 1), 0.5)

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      const top = canvas.get(x, y * 2)
      const bottom = canvas.get(x, y * 2 + 1)
      const isTop = !isClear || canvas.isSolid(x, y * 2)
      const isBottom = !isClear || canvas.isSolid(x, y * 2 + 1)
      if (isTop) {
        words[i] = 0x2580
        words[i + 1] = top
        words[i + 2] = isBottom ? bottom : DEFAULT
      } else if (isBottom) {
        words[i] = 0x2584
        words[i + 1] = bottom
        words[i + 2] = DEFAULT
      } else {
        words[i] = 0x20
        words[i + 1] = DEFAULT
        words[i + 2] = DEFAULT
      }
    }
  }

  // Text sits on the blended colour of its cell, light or dark to suit it;
  // on a clear band, on the wallpaper, which is kept dark enough for white.
  for (const glyph of glyphs) {
    if (glyph.y < 0 || glyph.y >= ROWS) continue
    for (let k = 0; k < glyph.text.length; k++) {
      const x = glyph.x + k
      // One cell per character: anything past Latin (a wide or combining
      // character, half a surrogate pair) or a control character is '?'.
      const char = glyph.text.charCodeAt(k)
      const code = isPrintable(char) ? char : 0x3f
      if (x < 0 || x >= w) continue
      const bg = background(x, glyph.y)
      const ink = glyph.fg || (!isClear && luminance(bg) > 0.6 ? 0x1b1f33 : 0xffffff)
      const i = (glyph.y * w + x) * 3
      words[i] = code
      words[i + 1] = glyph.dim ? mix(ink, isClear ? 0x404660 : bg, 0.3) : ink
      words[i + 2] = bg
    }
  }

  return toBase64(new Uint8Array(words.buffer))
}
