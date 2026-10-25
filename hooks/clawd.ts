// Clawd in the band's right-hand corner: what he does at this hour, what he
// wears for the weather and the day, how he reacts to Claude's work, and the
// line of words beside him. One frame is one Raster's cells, printed as a
// risograph would: the inks of paint.ts, a deeper tone dithered in where a
// halftone would shade, night as an indigo plate rather than darkness, and
// the odd indigo pixel printed off register.

import { localTime, moonAt, OCCASION_WORDS, occasionAt, sunAt } from './astro'
import type { LocalTime, Occasion } from './astro'
import { Canvas, INKS, luminance, mix, rand, smoothstep, toBase64 } from './paint'
import { auroraStrength, paintBandSky, paintPrecipitation, SKY_WORDS, skyOf } from './sky'
import type { SkyInput } from './sky'

// Terminal rows the band takes; every sprite below is laid out for it.
export const ROWS = 3

export type Activity = 'sleep' | 'coffee' | 'code' | 'gta'

export type Mode = 'live' | 'demo' | 'pinned'

// What Claude is up to, as Clawd shows it.
export type Reaction = 'working' | 'cheer' | 'facepalm' | 'wave'

export type View = SkyInput & {
  columns: number
  mode: Mode
  // The place's UTC offset; absent, Swedish time.
  offsetMs?: number
  // Leave the sky out so the terminal's wallpaper shows through.
  isClear?: boolean
  reaction?: { kind: Reaction; age: number } | null
  // What is playing, "title - artist", if anything.
  track?: string | null
  // The word for what is happening in the sky, if anything.
  event?: string | null
}

const LABELS: Record<Activity, string> = {
  sleep: 'sover',
  coffee: 'dricker morgonkaffe',
  code: 'skriver kod',
  gta: 'spelar GTA VI',
}

// Wind from which his hat goes, in metres per second.
export const WINDY = 9

// Weekdays up at six and in bed at ten; Friday and Saturday nights run to
// midnight, and the weekend sleeps in until nine.
export function activityAt({ hour, weekday }: Pick<LocalTime, 'hour' | 'weekday'>): Activity {
  const bedtime = weekday === 5 || weekday === 6 ? 24 : 22
  const wake = weekday === 0 || weekday === 6 ? 9 : 6
  if (hour < wake || hour >= bedtime) return 'sleep'
  if (hour < 12) return 'coffee'
  if (hour < 18) return 'code'

  return 'gta'
}

// --- Riso ------------------------------------------------------------------

const CREAM = 0xf5efe0
// Clawd's own ink, Claude's coral: the orange drum printed thin on cream,
// with a breath of indigo under it.
const CORAL = mix(mix(INKS.orange, CREAM, 0.15), INKS.indigo, 0.1)
// Wood and desks: orange printed over indigo.
const WOOD = mix(INKS.orange, INKS.indigo, 0.35)
// Blue printed thin, for screens and drops; paler still, for words.
const SKY_INK = mix(INKS.blue, 0xffffff, 0.45)
const PALE = mix(INKS.blue, 0xffffff, 0.6)
// The key plate at its darkest, for screens and eyes.
const KEY_DARK = mix(INKS.indigo, 0x000000, 0.55)

// A deeper tone of an ink, as its halftone's dots would print it.
function deeper(c: number): number {
  return mix(c, INKS.indigo, 0.22)
}

// A sprite printed: rows of characters looked up in the palette ('.' and
// unknown characters see-through). Night lays the indigo plate over all but
// the `glows`; the `shaded` keys get their deeper tone on every other pixel,
// from row `shadeFrom` down, as a halftone shades.
function print(
  c: Canvas,
  x0: number,
  y0: number,
  rows: readonly string[],
  palette: Record<string, number>,
  light: number,
  options: { glows?: string; shaded?: string; shadeFrom?: number } = {},
): void {
  const { glows = '', shaded = '', shadeFrom = 0 } = options
  const night = clamp01((1 - light) / 0.45) * 0.45
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx]!
      const ink = palette[ch]
      if (ink === undefined) continue
      const x = x0 + dx
      const y = y0 + dy
      const isShaded = shaded.includes(ch) && dy >= shadeFrom && (Math.round(x) + Math.round(y)) % 2 === 0
      const color = isShaded ? deeper(ink) : ink
      c.set(x, y, glows.includes(ch) ? color : mix(color, KEY_DARK, night))
    }
  })
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

// --- Clawd ----------------------------------------------------------------

const CLAWD = { O: CORAL, K: INKS.indigo, k: deeper(CORAL), G: KEY_DARK, h: deeper(deeper(CORAL)) }

export type Eyes = 'open' | 'closed' | 'right' | 'left' | 'shades'
export type Arms = 'down' | 'typing' | 'up' | 'right-up' | 'none'
export type Legs = 'stand' | 'stepA' | 'stepB'

const FACES: Record<Eyes, string> = {
  open: '.KOOK.',
  closed: '.kOOk.',
  right: '.OKOK.',
  left: '.KOKO.',
  shades: '.GGGG.',
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

// Six wide, four tall: the logo's shape at the band's scale.
function paintClawd(
  c: Canvas,
  x: number,
  y: number,
  eyes: Eyes,
  arms: Arms,
  legs: Legs,
  light: number,
): void {
  // Shaded in his legs, the halftone darker below.
  print(c, x, y, ['.OOOO.', FACES[eyes], ARMS[arms], LEGS[legs]], CLAWD, light, { shaded: 'O', shadeFrom: 3 })
  if (arms === 'typing') print(c, x + 5, y + 3, ['O'], CLAWD, light)
  if (arms === 'up') print(c, x, y - 1, ['O....O'], CLAWD, light)
  // The key plate a pixel off register, just past his right side.
  if (!c.isSolid(x + 6, y + 1)) c.blend(x + 6, y + 1, INKS.indigo, 0.55)
}

// --- Hats -------------------------------------------------------------------

type Hat = { rows: string[]; palette: Record<string, number>; glows?: string }

// Red is pink printed over orange.
const RED = mix(INKS.pink, INKS.orange, 0.45)

const HATS = {
  nightcap: { rows: ['....NW', '.NNNN.'], palette: { N: INKS.blue, W: CREAM } },
  beanie: { rows: ['..W...', '.RRRR.'], palette: { W: CREAM, R: RED } },
  cap: { rows: ['......', '.BBBBB'], palette: { B: INKS.blue } },
  santa: { rows: ['..RRRW', '.WWWW.'], palette: { R: RED, W: CREAM } },
  lucia: { rows: ['.f..f.', '.wGGw.'], palette: { f: INKS.yellow, w: CREAM, G: INKS.green }, glows: 'f' },
  midsummer: { rows: ['......', '.pGyG.'], palette: { p: INKS.pink, G: INKS.green, y: INKS.yellow } },
} satisfies Record<string, Hat>

export type HatKind = keyof typeof HATS

function hatFor(occasion: Occasion | null, temperature: number | undefined, wind: number, isAwake: boolean): HatKind | null {
  if (!isAwake) return 'nightcap'
  if (occasion === 'lucia') return 'lucia'
  if (occasion === 'christmas') return 'santa'
  if (occasion === 'midsummer') return 'midsummer'
  if (temperature !== undefined && temperature <= 0) return 'beanie'
  if (wind >= WINDY) return 'cap'

  return null
}

function paintHat(c: Canvas, hat: Hat, x: number, y: number, light: number, t: number): void {
  const palette = { ...hat.palette }
  // Lucia's candles flicker.
  if (palette.f !== undefined) palette.f = Math.sin(t * 9) > 0 ? INKS.yellow : mix(INKS.yellow, INKS.orange, 0.5)
  print(c, x, y - 2, hat.rows, palette, light, { glows: hat.glows })
}

// --- Wind -------------------------------------------------------------------

export type Chase = {
  dx: number
  dy: number
  legs: Legs
  eyes: Eyes
  // Where the hat is, relative to Clawd's resting place; `held` while in hand.
  hat: { dx: number; dy: number; held: boolean } | null
}

// One ten-second loop: the hat lifts, flies off to the left, Clawd runs
// `distance` after it, catches it with a jump, walks back and puts it on again.
export function chaseAt(t: number, distance = 20): Chase | null {
  const p = t % 10
  const step = (rate: number): Legs => (Math.floor(p * rate) % 2 === 0 ? 'stepA' : 'stepB')
  const ease = (a: number, b: number) => smoothstep(a, b, p)

  if (p < 0.8) {
    return { dx: 0, dy: 0, legs: 'stand', eyes: 'open', hat: { dx: -p * 3, dy: -p * 1.2, held: false } }
  }
  if (p < 3.6) {
    const run = -distance * ease(1, 3.6)
    const flight = -2.4 - (distance + 1) * ease(0.8, 3.4)

    return {
      dx: run,
      dy: 0,
      legs: p < 1 ? 'stand' : step(8),
      eyes: 'left',
      hat: { dx: flight, dy: 1.5 + Math.sin(p * 5), held: false },
    }
  }
  if (p < 4.2) {
    const jump = -Math.sin(((p - 3.6) / 0.6) * Math.PI) * 2

    return { dx: -distance - (p - 3.6) * 2, dy: jump, legs: 'stand', eyes: 'left', hat: { dx: -distance - 2, dy: jump, held: true } }
  }
  if (p < 7.6) {
    const back = -(distance + 1.2) * (1 - ease(4.2, 7.6))

    return { dx: back, dy: 0, legs: step(5), eyes: 'right', hat: { dx: back, dy: 0, held: true } }
  }
  if (p < 8.4) {
    const on = ease(7.6, 8.4)

    return { dx: 0, dy: 0, legs: 'stand', eyes: 'open', hat: { dx: 0, dy: (1 - on) * 2, held: on < 0.5 } }
  }

  return null
}

// --- Scenes -----------------------------------------------------------------

type Stage = {
  c: Canvas
  // Clawd's resting place: his top-left pixel.
  x: number
  y: number
  t: number
  light: number
  occasion: Occasion | null
  isFridayNight: boolean
  // Out of his seat chasing his hat.
  isAway: boolean
}

// Each scene paints what stands behind Clawd and in front of him, and how he
// looks while he is in his seat.
type Scene = {
  behind: (s: Stage) => void
  front: (s: Stage) => void
  pose: (s: Stage) => { eyes: Eyes; arms: Arms }
  glyphs?: (s: Stage) => Glyph[]
}

type Glyph = { x: number; y: number; text: string; fg: number; dim?: boolean }

const SYNTAX = [INKS.pink, INKS.green, INKS.yellow, mix(INKS.blue, 0xffffff, 0.35), INKS.orange]

const sleep: Scene = {
  behind: ({ c, x, y, light }) => {
    print(c, x - 1, y, ['F', 'F', 'F', 'F'], { F: WOOD }, light)
    print(c, x + 7, y + 1, ['F', 'F', 'F'], { F: WOOD }, light)
  },
  front: ({ c, x, y, t, light }) => {
    // The blanket rises and falls with his breath.
    const isIn = Math.sin(t * 1.4) > 0
    // A violet blanket, its halftone breathing with him.
    const blanket = isIn ? mix(INKS.violet, CREAM, 0.35) : INKS.violet
    print(c, x, y + 2, ['BBBBBBB'], { B: blanket }, light, { shaded: 'B' })
    print(c, x - 1, y + 3, ['FFFFFFFFF'], { F: WOOD }, light)
  },
  pose: () => ({ eyes: 'closed', arms: 'none' }),
  glyphs: ({ x, t }) => {
    const shown = Math.floor(t / 0.9) % 3

    return [
      { x: x + 7, y: 0, text: 'z', fg: PALE },
      { x: x + 9, y: 0, text: 'Z', fg: PALE },
    ].slice(0, shown)
  },
}

const coffee: Scene = {
  behind: ({ c, x, y, light, occasion }) => {
    print(c, x + 6, y + 3, ['DDDDDDD'], { D: WOOD }, light, { shaded: 'D' })
    const bun = mix(INKS.orange, INKS.yellow, 0.4)
    if (occasion === 'cinnamonBun') print(c, x + 10, y + 1, ['.b.', 'bBb'], { b: bun, B: WOOD }, light)
    if (occasion === 'semla') print(c, x + 10, y + 1, ['ww', 'bb'], { w: CREAM, b: bun }, light)
  },
  front: ({ c, x, y, t, light, isAway }) => {
    // A sip now and then lifts the mug a pixel; else it steams.
    const isSipping = !isAway && t % 7 > 6
    const lift = isSipping ? 1 : 0
    print(c, x + 6, y + 1 - lift, ['WCW.', 'WWWW'], { W: CREAM, C: deeper(WOOD) }, light)
    if (!isSipping) {
      for (let k = 0; k < 3; k++) {
        const sway = Math.round(Math.sin(t * 3 + k * 1.3) * 0.6)
        c.blend(x + 7 + sway, y - k, 0xffffff, 0.5 - k * 0.14)
      }
    }
  },
  pose: ({ t }) => {
    const isSipping = t % 7 > 6
    const isBlinking = t % 4.3 < 0.15

    return { eyes: isSipping || isBlinking ? 'closed' : 'open', arms: 'down' }
  },
}

const code: Scene = {
  behind: ({ c, x, y, t, light }) => {
    print(c, x + 6, y + 3, ['DDDDDDD'], { D: WOOD }, light, { shaded: 'D' })
    print(c, x + 7, y - 1, ['GGGGG', 'GsssG', 'GGGGG'], { G: mix(INKS.indigo, 0x808080, 0.35), s: KEY_DARK }, light, { glows: 's' })
    // A line of code at a time, a new one every quarter second.
    const line = Math.floor(t * 4)
    for (let i = 0; i < 3; i++) {
      if (rand(line * 7 + i) < 0.75) c.set(x + 8 + i, y, SYNTAX[Math.floor(rand(line * 13 + i) * SYNTAX.length)]!)
    }
    print(c, x + 6, y + 2, ['AAAAAA'], { A: mix(CREAM, INKS.blue, 0.2) }, light, { shaded: 'A' })
  },
  front: () => {},
  pose: ({ t }) => ({ eyes: 'right', arms: Math.floor(t * 6) % 2 === 0 ? 'down' : 'typing' }),
}

const gta: Scene = {
  behind: ({ c, x, y, t, light, isFridayNight }) => {
    const tx = x + 8
    print(c, tx, y - 1, ['TTTTTT', 'T....T', 'T....T', 'TTTTTT'], { T: KEY_DARK }, light)
    print(c, tx + 1, y + 3, ['L..L'], { L: deeper(KEY_DARK) }, light)
    // Vice City: a pink sky with its sun, an orange causeway with a car on
    // it, dithered as the screen's halftone would print it.
    print(c, tx + 1, y, ['ppyp', 'oooo'], { p: INKS.pink, y: INKS.yellow, o: INKS.orange }, 1, { shaded: 'po' })
    c.set(tx + 1 + (Math.floor(t * 3) % 4), y + 1, SKY_INK)
    if (t % 1.2 < 0.25) {
      c.set(tx + 1, y, RED)
      c.set(tx + 4, y, INKS.blue)
    }
    if (isFridayNight) print(c, x + 6, y + 2, ['yY', 'BB'], { y: INKS.yellow, Y: mix(INKS.yellow, INKS.orange, 0.4), B: INKS.blue }, light)
  },
  front: ({ c, x, y, t, light, isAway }) => {
    // The pad, mashed; on the floor while he is off after his hat.
    const jiggle = Math.round(Math.sin(t * 14))
    const at = isAway ? { x: x + 1, y: y + 3 } : { x: x + 2 + jiggle * 0.5, y: y + 2 }
    print(c, at.x, at.y, ['cp'], { c: SKY_INK, p: INKS.pink }, light, { glows: 'cp' })
  },
  pose: () => ({ eyes: 'right', arms: 'down' }),
}

const SCENES: Record<Activity, Scene> = { sleep, coffee, code, gta }

// Seasonal things standing to the left of the scene.
function paintOccasion(c: Canvas, occasion: Occasion | null, x: number, y: number, t: number, light: number): void {
  if (occasion === 'halloween') {
    const glow = Math.sin(t * 5) > -0.3 ? INKS.yellow : mix(INKS.yellow, INKS.orange, 0.6)
    print(c, x, y + 1, ['.g.', 'OOO', 'yOy'], { g: INKS.green, O: INKS.orange, y: glow }, light, { glows: 'y', shaded: 'O' })
  }
  if (occasion === 'christmas' || occasion === 'lucia') {
    const lights = [RED, INKS.yellow, INKS.blue]
    const bulb = (k: number) => lights[(Math.floor(t * 2) + k) % 3]!
    print(c, x, y, ['.y.', '.G.', 'aGb', 'GGG'], { y: INKS.yellow, G: INKS.green, a: bulb(0), b: bulb(1) }, light, { glows: 'yab', shaded: 'G' })
  }
}

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

// --- Reactions ------------------------------------------------------------

// How long a passing reaction lasts, in seconds.
export const REACTION_SECONDS: Record<Reaction, number> = {
  working: Infinity,
  cheer: 2.5,
  facepalm: 3,
  wave: Infinity,
}

type Overrides = { eyes?: Eyes; arms?: Arms; dy?: number; glyphs: Glyph[] }

function reactionOverrides(
  c: Canvas,
  reaction: View['reaction'],
  x: number,
  y: number,
  t: number,
  isAwake: boolean,
): Overrides {
  if (!reaction) return { glyphs: [] }
  const { kind, age } = reaction
  const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3))

  if (kind === 'working') return { glyphs: [{ x: x - 4, y: 0, text: dots.padEnd(3), fg: PALE }] }
  if (!isAwake) {
    const mark = kind === 'cheer' ? '!' : '?'

    return { glyphs: [{ x: x - 2, y: 0, text: mark, fg: INKS.yellow }] }
  }
  if (kind === 'cheer') {
    const dy = -Math.round(Math.abs(Math.sin(age * Math.PI * 2.2)))
    const sparkle = Math.floor(age * 6) % 2 === 0 ? '*' : '+'

    return { arms: 'up', dy, glyphs: [{ x: x + 6, y: 0, text: sparkle, fg: INKS.yellow }] }
  }
  if (kind === 'facepalm') {
    c.set(x + 4, y + 1, CLAWD.h)
    c.blend(x + 6, y, SKY_INK, 0.9)

    return { eyes: 'closed', arms: 'typing', glyphs: [] }
  }
  // Waving for attention, a question over his head.
  const isHigh = Math.floor(t * 4) % 2 === 0
  c.set(x + 6, y + (isHigh ? 0 : 1), CLAWD.O)

  return { arms: 'right-up', glyphs: [{ x: x + 7, y: 0, text: '?', fg: INKS.yellow }] }
}

// --- Frame ----------------------------------------------------------------

// Clawd and his things in the corner, as cells; the words he puts above
// his head come back.
function paintScene(c: Canvas, view: View, state: SceneState, x: number, y: number): Glyph[] {
  const { t, reaction, track } = view
  const { activity, occasion, isAwake, light, isWindy } = state
  const chase = isWindy ? chaseAt(t) : null
  const stage: Stage = {
    c,
    x,
    y,
    t,
    light,
    occasion,
    isFridayNight: state.isFridayNight,
    isAway: chase !== null,
  }
  const scene = SCENES[activity]
  const seated = scene.pose(stage)
  const override = reactionOverrides(c, chase ? null : reaction, x, y, t, isAwake)

  paintOccasion(c, occasion, x - 6, y, t, light)
  scene.behind(stage)

  const cx = x + Math.round(chase?.dx ?? 0)
  const cy = y + Math.round(chase?.dy ?? override.dy ?? 0)
  const eyes = chase?.eyes ?? override.eyes ?? (state.isCool ? 'shades' : seated.eyes)
  const arms = chase ? 'down' : override.arms ?? seated.arms
  paintClawd(c, cx, cy, eyes, arms, chase?.legs ?? 'stand', light)
  scene.front(stage)

  const hat = state.hat && HATS[state.hat]
  if (hat) {
    const at = chase?.hat
    if (!at) paintHat(c, hat, cx, cy, light, t)
    else if (at.held) paintHat(c, hat, x + Math.round(at.dx) + 3, y + Math.round(at.dy) + 3, light, t)
    else paintHat(c, hat, x + Math.round(at.dx), y + Math.round(at.dy), light, t)
  }

  // Headphones and notes while music plays.
  if (track && isAwake) {
    print(c, cx, cy - 1, ['.HHHH.'], { H: KEY_DARK }, light)
    print(c, cx, cy + 1, ['H....H'], { H: KEY_DARK }, light)
    for (let k = 0; k < 2; k++) {
      const age = (t * 0.7 + k * 0.5) % 1
      c.blend(cx + 6 + k * 2, cy + 1 - age * 3, k === 0 ? INKS.pink : SKY_INK, 1 - age)
    }
  }

  return [...(scene.glyphs?.(stage) ?? []), ...override.glyphs]
}

// The scene's corner in pixels (= columns), counted from the right edge.
const CORNER = 22

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

// What the moment holds for Clawd, whoever draws him.
export type SceneState = {
  time: LocalTime
  occasion: Occasion | null
  activity: Activity
  isAwake: boolean
  // How lit the scene is, 0.55 at night to 1 by day.
  light: number
  wind: number
  isWindy: boolean
  // Shades in a warm sun.
  isCool: boolean
  isFridayNight: boolean
  hat: HatKind | null
}

export function sceneOf(view: View): SceneState {
  const { ms, place, offsetMs, weather } = view
  const sun = sunAt(ms, place.lat, place.lon)
  const time = localTime(ms, offsetMs)
  const occasion = occasionAt(time)
  // Up for the fireworks at New Year, and with the Lucia train at six.
  const usual = activityAt(time)
  const isUpEarly = occasion === 'lucia' && time.hour >= 6 && time.hour < 12
  const activity = usual === 'sleep' && (occasion === 'newYear' || isUpEarly)
    ? (occasion === 'newYear' ? 'gta' : 'coffee')
    : usual
  const isAwake = activity !== 'sleep'
  const wind = weather?.wind ?? 0

  return {
    time,
    occasion,
    activity,
    isAwake,
    light: 0.55 + 0.45 * smoothstep(-12, 6, sun.elevation),
    wind,
    isWindy: isAwake && wind >= WINDY,
    isCool: isAwake && !!weather && weather.temperature >= 25 && sun.elevation > 0,
    isFridayNight: time.weekday === 5 && activity === 'gta',
    hat: hatFor(occasion, weather?.temperature, wind, isAwake),
  }
}

// The band as cells: the sky (or the terminal's own background, where a
// wallpaper or shader shows through), the words, and Clawd's corner.
export function drawFrame(view: View): string {
  const { columns, ms, t, mode, place, weather, isClear = false, reaction, track } = view
  const c = new Canvas(columns, ROWS * 2)
  const sun = sunAt(ms, place.lat, place.lon)
  const state = sceneOf(view)
  const { time, occasion, activity, isAwake, light, isWindy } = state

  if (!isClear) paintBandSky(c, view)
  paintPrecipitation(c, weather, t)

  const x = columns - CORNER + 7
  const y = c.h - 4
  const labelRight = columns - CORNER - 1 - (isWindy ? 22 : 0)
  if (occasion === 'newYear') paintFireworks(c, labelRight - 30, t)
  const glyphs: Glyph[] = []
  glyphs.push(...paintScene(c, view, state, x, y))

  // The words, right-aligned against the scene.
  const room = labelRight - 1
  const aurora = auroraStrength(view, sun) > 0.15
  const moon = moonAt(ms, place.lat, place.lon)
  const status = mode === 'demo' ? 'tidsförlopp · /solar now' : mode === 'pinned' ? 'låst tid · /solar now' : null
  const lines = [
    fit([`${pad(time.hour)}:${pad(time.minute)}  Clawd ${LABELS[activity]}`, occasion && OCCASION_WORDS[occasion], state.isFridayNight && 'fredagsmys'], room),
    fit([
      place.name,
      weather && `${Math.round(weather.temperature)}°C ${SKY_WORDS[skyOf(weather.code)]}`,
      weather && weather.wind >= 5 && `${Math.round(weather.wind)} m/s`,
    ], room),
    fit([
      view.event && `* ${view.event}`,
      `sol ${Math.round(sun.elevation)}°`,
      moon.elevation > 0 && `måne ${Math.round(moon.illumination * 100)}%`,
      aurora && 'norrsken',
      status,
      track && isAwake && `lyssnar: ${track.length > 28 ? `${track.slice(0, 27)}~` : track}`,
    ], room),
  ]
  lines.forEach((text, row) => {
    if (text) glyphs.push({ x: labelRight - text.length, y: row, text, fg: 0, dim: row > 0 })
  })

  return encode(c, glyphs, isClear)
}

// Latin a cell can hold, without the C0 and C1 control characters.
export function isPrintable(code: number): boolean {
  return (code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code < 0x250)
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
