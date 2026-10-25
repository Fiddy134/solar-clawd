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

export type Activity = 'earlyBird' | 'coffee' | 'work' | 'vibe' | 'nightOwl' | 'sleep'

export type Mode = 'live' | 'demo' | 'pinned'

// What Claude is up to, as Clawd shows it: `working` while it writes or
// runs things, `reading` while it only reads; `toss` as the context window
// fills another tenth, `burn` while the conversation is compacted and
// `embers` just after.
export type Reaction = 'working' | 'reading' | 'cheer' | 'facepalm' | 'wave' | 'lookUp' | 'toss' | 'burn' | 'embers'

// What a tool does, as Clawd shows it: reads, writes (or runs), or neither
// as far as he can tell.
export function toolKind(tool: string): 'read' | 'write' | null {
  if (['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'NotebookRead', 'ToolSearch'].includes(tool)) return 'read'
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'].includes(tool)) return 'write'

  return null
}

// Clawd at work: reading only while every open call reads.
export function workKind(open: Iterable<'read' | 'write'>): 'working' | 'reading' {
  const kinds = [...open]

  return kinds.length > 0 && kinds.every(kind => kind === 'read') ? 'reading' : 'working'
}

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
  // How full Claude's context window is, 0 to 100: the paper in the
  // wastebasket behind him.
  paper?: number | null
  // The wastebasket stands in the sky's corner (Ghostty's shader) instead:
  // he throws the paper down toward it.
  isBasketInSky?: boolean
}

const LABELS: Record<Activity, string> = {
  earlyBird: "early birdin'",
  coffee: 'coffee sesh',
  work: "workin'",
  vibe: "vibin'",
  nightOwl: 'night owl',
  sleep: 'sleep sesh',
}

// Wind from which his hat goes, in metres per second.
export const WINDY = 9

// The same day every day: up with the birds at six, coffee till noon, work
// till four, then vibing, a night owl from ten, and asleep from three.
export function activityAt({ hour }: Pick<LocalTime, 'hour'>): Activity {
  if (hour >= 3 && hour < 6) return 'sleep'
  if (hour >= 6 && hour < 8) return 'earlyBird'
  if (hour >= 8 && hour < 12) return 'coffee'
  if (hour >= 12 && hour < 16) return 'work'
  if (hour >= 16 && hour < 22) return 'vibe'

  return 'nightOwl'
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
  print(c, x, y, clawdRows(eyes, arms, legs), CLAWD, light, { shaded: 'O', shadeFrom: 3 })
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

const vibe: Scene = {
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

// Early birds and night owls share the coffee and the screen.
const SCENES: Record<Activity, Scene> = { earlyBird: coffee, coffee, work: code, vibe, nightOwl: code, sleep }

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
  reading: Infinity,
  toss: 1.8,
  burn: Infinity,
  embers: 3,
  cheer: 2.5,
  facepalm: 3,
  wave: Infinity,
  lookUp: 10,
}

// Whether the sky has something it did not have before: Clawd looks up.
export function skyGained(before: readonly string[], after: readonly string[]): boolean {
  return after.some(thing => !before.includes(thing))
}

type Overrides = { eyes?: Eyes; arms?: Arms; dy?: number; glyphs: Glyph[] }

function reactionOverrides(
  c: Canvas,
  reaction: View['reaction'],
  x: number,
  y: number,
  t: number,
  isAwake: boolean,
  isInSky: boolean,
): Overrides {
  if (!reaction) return { glyphs: [] }
  const { kind, age } = reaction
  const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3))

  if (kind === 'working' || kind === 'reading') {
    const glyphs = [{ x: x - 4, y: 0, text: dots.padEnd(3), fg: PALE }]
    if (!isAwake) return { glyphs }
    if (kind === 'reading') return { eyes: 'right', arms: 'typing', glyphs }

    return { eyes: 'right', arms: Math.floor(t * 8) % 2 === 0 ? 'typing' : 'down', glyphs }
  }
  if (!isAwake) {
    const mark = kind === 'cheer' ? '!' : kind === 'lookUp' ? '*' : '?'

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
  // A ball of paper over his shoulder into the basket.
  if (kind === 'toss') return { eyes: isInSky ? 'right' : 'left', arms: age < 0.5 ? 'up' : 'down', glyphs: [] }
  // A match thrown in, then watching the context burn away, and the smoke.
  if (kind === 'burn') return { eyes: isInSky ? 'right' : 'left', arms: age < 0.6 ? 'up' : 'down', glyphs: [] }
  if (kind === 'embers') return { eyes: 'closed', glyphs: [] }
  // Something in the sky: eyes up, a claw pointing at it.
  if (kind === 'lookUp') {
    c.set(x + 6, y, CLAWD.O)

    return { eyes: 'up', arms: 'right-up', glyphs: [{ x: x + 7, y: 0, text: '*', fg: INKS.yellow }] }
  }
  // Waving for attention, a question over his head.
  const isHigh = Math.floor(t * 4) % 2 === 0
  c.set(x + 6, y + (isHigh ? 0 : 1), CLAWD.O)

  return { arms: 'right-up', glyphs: [{ x: x + 7, y: 0, text: '?', fg: INKS.yellow }] }
}

// What he works with, in front of whatever the scene has there: a book
// open in his claws while Claude reads, a page turning now and then; keys
// under them while it writes.
function paintWork(c: Canvas, reaction: View['reaction'], x: number, y: number, t: number, light: number): void {
  if (reaction?.kind === 'reading') {
    print(c, x + 6, y + 2, [t % 2.5 < 0.3 ? 'pP' : 'PP', 'CC'], { P: CREAM, p: SKY_INK, C: INKS.blue }, light)
  }
  if (reaction?.kind === 'working') print(c, x + 6, y + 3, ['kkk'], { k: PALE }, light, { shaded: 'k' })
}

const STEEL = mix(PALE, INKS.indigo, 0.35)
const FLAME = [mix(INKS.pink, INKS.orange, 0.45), INKS.orange, INKS.yellow]

// The wastebasket behind him: a wire-mesh bin, the context window's paper
// showing through it as it fills (the last of it heaped over the rim).
// While the conversation compacts the paper burns, flames licking up and
// the paper going; then smoke from an empty bin.
function paintBasket(c: Canvas, x: number, y: number, paper: number | null | undefined, light: number, t: number, reaction: View['reaction']): void {
  const left = x - 5
  const burning = reaction?.kind === 'burn' ? reaction.age : null
  const isEmpty = reaction?.kind === 'embers' || (burning !== null && burning > 4)
  // The bin: a rim, a mesh over its dark inside, a narrower base.
  print(c, left, y, ['RRRR', 'MiMi', 'iMiM', '.RR.'], { R: STEEL, M: deeper(STEEL), i: mix(KEY_DARK, STEEL, 0.25) }, light)
  // The paper in the mesh's gaps, bottom up, the last of it heaped over the rim.
  const cells = [[0, 2], [2, 2], [1, 1], [3, 1], [1, -1], [2, -1]]
  const shown = isEmpty ? 0 : Math.round((Math.min(100, paper ?? 0) / 100) * cells.length) - (burning === null ? 0 : Math.floor(burning * 1.5))
  cells.slice(0, Math.max(0, shown)).forEach(([dx, dy], k) => print(c, left + dx!, y + dy!, ['P'], { P: k % 2 === 0 ? CREAM : deeper(CREAM) }, light))
  if (burning !== null && burning > 0.6) {
    for (let k = 0; k < 4; k++) {
      const tall = 1 + Math.floor(rand(Math.floor(t * 9) * 4 + k) * (isEmpty ? 1.5 : 3))
      for (let j = 0; j < tall; j++) c.set(left + k, y - j, FLAME[Math.min(2, j + (k === 1 || k === 2 ? 1 : 0))]!)
    }
  }
  if (burning !== null || reaction?.kind === 'embers') {
    for (let k = 0; k < 3; k++) {
      const age = (t * 0.8 + k / 3) % 1
      c.blend(left + 1 + k % 2 + Math.round(Math.sin(t * 2 + k) * 0.7), y - 2 - Math.floor(age * 3), 0xb8b8c0, 0.6 * (1 - age))
    }
  }
}

// How long a ball (or a match) takes to reach the basket.
export const THROW_SECONDS = 1.4

// What flies to the basket: a ball of paper, or a lit match, arcing back
// over his shoulder to the one behind him, or out and down toward the one
// in the sky's corner.
function paintThrow(c: Canvas, x: number, y: number, reaction: View['reaction'], isInSky: boolean): void {
  const age = reaction?.kind === 'toss' ? reaction.age : reaction?.kind === 'burn' ? reaction.age : null
  if (age === null || age > THROW_SECONDS) return
  const f = age / THROW_SECONDS
  // Into the sky's basket: high over his screen to the band's last
  // columns, and only there down out of it, above where it stands.
  const px = Math.round(isInSky ? x + 5 + 9 * f : x - 4 * f)
  const py = Math.round(isInSky ? y + 1 - 12 * f * (1 - f) + 5 * f * f * f : y + 1 - 3 * f * (1 - f) * 2 - f)
  c.set(px, py, reaction!.kind === 'toss' ? CREAM : INKS.yellow)
  if (reaction!.kind === 'burn') c.set(px + (isInSky ? -1 : 1), py + 1, WOOD)
}

// --- Frame ----------------------------------------------------------------

// Clawd and his things in the corner, as cells; the words he puts above
// his head come back.
function paintScene(c: Canvas, view: View, state: SceneState, x: number, y: number): Glyph[] {
  const { t, reaction, track } = view
  const { activity, occasion, isAwake, light, isWindy } = state
  // A throw at the wastebasket stops even a chase after his hat.
  const isThrowing = reaction?.kind === 'toss' || reaction?.kind === 'burn'
  const chase = isWindy && !isThrowing ? chaseAt(t) : null
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
  const isInSky = !!view.isBasketInSky
  const override = reactionOverrides(c, chase ? null : reaction, x, y, t, isAwake, isInSky)

  paintOccasion(c, occasion, x - 8, y, t, light)
  scene.behind(stage)
  if (!isInSky) paintBasket(c, x, y, view.paper, light, t, chase ? null : reaction)

  const cx = x + Math.round(chase?.dx ?? 0)
  const cy = y + Math.round(chase?.dy ?? override.dy ?? 0)
  const eyes = chase?.eyes ?? override.eyes ?? (state.isCool ? 'shades' : seated.eyes)
  const arms = chase ? 'down' : override.arms ?? seated.arms
  paintClawd(c, cx, cy, eyes, arms, chase?.legs ?? 'stand', light)
  scene.front(stage)
  if (isAwake && !chase) paintWork(c, reaction, x, y, t, light)
  if (!chase) paintThrow(c, x, y, reaction, isInSky)

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
  // Up all New Year's night, and early for the Lucia train.
  const usual = activityAt(time)
  const activity = usual !== 'sleep' ? usual : occasion === 'newYear' ? 'nightOwl' : occasion === 'lucia' && time.hour >= 5 ? 'earlyBird' : usual
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
    isFridayNight: time.weekday === 5 && activity === 'vibe',
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
  const status = mode === 'demo' ? 'time-lapse · /solar now' : mode === 'pinned' ? 'pinned time · /solar now' : null
  const lines = [
    fit([`${pad(time.hour)}:${pad(time.minute)}  ${LABELS[activity]}`, occasion && OCCASION_WORDS[occasion], state.isFridayNight && 'friday night'], room),
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

// Latin a cell can hold, without the C0 and C1 control characters.
export function isPrintable(code: number): boolean {
  // A soft hyphen (U+00AD) draws as nothing in some terminals: not one.
  return (code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code < 0x250 && code !== 0xad)
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

// Clawd's passing reaction once the sky has (or has not) gained something:
// he looks up at it, unless a reaction is still under way (a cheer for work
// done keeps its moment).
export function nextPassing(passing: { kind: Reaction; at: number } | null, now: number, isGained: boolean): { kind: Reaction; at: number } | null {
  if (!isGained) return passing
  if (passing && (now - passing.at) / 1000 < REACTION_SECONDS[passing.kind]) return passing

  return { kind: 'lookUp', at: now }
}
