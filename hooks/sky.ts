// The sky: the gradient (after Apple's "Solar Gradients"), risograph clouds
// and sun, stars, the moon in its real phase, aurora, and the weather falling
// through the band. The wallpaper is the large sky behind the terminal; the
// band only adds what moves fast.

import { dayArc, moonAt, sunAt } from './astro'
import type { Moon, Place, Sun } from './astro'
import {
  Canvas,
  clamp,
  fillPngRows,
  grey,
  hash,
  INKS,
  luminance,
  mix,
  noise,
  pngOf,
  pngRows,
  rand,
  saturate,
  SCREEN_ANGLES,
  screen,
  smoothstep,
  toBase64,
} from './paint'

// Now, where the place is: WMO weather code, °C, cloud cover in percent and
// wind in metres per second.
export type Weather = {
  temperature: number
  code: number
  cloudCover: number
  wind: number
}

export type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

export function skyOf(code: number): Sky {
  if (code <= 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'thunder'

  return 'rain'
}

export const SKY_WORDS: Record<Sky, string> = {
  clear: 'clear',
  partly: 'partly cloudy',
  cloudy: 'cloudy',
  fog: 'fog',
  drizzle: 'drizzle',
  rain: 'rain',
  snow: 'snow',
  thunder: 'thunder',
}

const SKY_GREY: Record<Sky, number> = {
  clear: 0,
  partly: 0.08,
  cloudy: 0.3,
  fog: 0.55,
  drizzle: 0.4,
  rain: 0.5,
  snow: 0.45,
  thunder: 0.6,
}

// How grey the weather makes the sky, 0 to 1.
export function greyness(weather: Weather | null | undefined): number {
  if (!weather) return 0

  return clamp(SKY_GREY[skyOf(weather.code)] + (weather.cloudCover / 100) * 0.12)
}

// The latitude's Kp threshold for aurora overhead: 1 in Lapland, about 4
// around Stockholm, 7 in Skåne.
export function auroraThreshold(lat: number): number {
  return clamp(Math.round((67 - Math.abs(lat)) / 2.5) + 1, 1, 9)
}

export type SkyInput = {
  ms: number
  t: number
  place: Place
  weather?: Weather | null
  // Kp index now, and whether to show aurora regardless (a preview).
  kp?: number | null
  isAuroraForced?: boolean
  moonTexture?: MoonTexture | null
}

// --- Gradient -------------------------------------------------------------

// The sky at a sun elevation, top / middle / horizon: deep navy at night,
// violet and coral through twilight, peach at sunrise, clear blue by day.
const STOPS: readonly [number, number, number, number][] = [
  [-90, 0x05070f, 0x0a0f22, 0x111a36],
  [-18, 0x070b1c, 0x0f1733, 0x1a2550],
  [-12, 0x0c1430, 0x1d2552, 0x3a3772],
  [-6, 0x16205a, 0x433f86, 0x9b5b8e],
  [-3, 0x223276, 0x6d4f95, 0xd9708a],
  [0, 0x2f4a92, 0x9a6aa6, 0xf59a78],
  [3, 0x3b66b0, 0xc48fb0, 0xffbf86],
  [8, 0x3f7cc8, 0x8fb5e0, 0xf7d6b4],
  [15, 0x3585d8, 0x79b4ea, 0xd6e8f6],
  [30, 0x2a7ad8, 0x66aaf0, 0xbfe0fa],
  [90, 0x1f6ed6, 0x58a2f0, 0xb0d8fb],
]

function stops(elevation: number): [number, number, number] {
  let i = 1
  while (i < STOPS.length - 1 && elevation > STOPS[i]![0]) i++
  const [loAt, loTop, loMiddle, loHorizon] = STOPS[i - 1]!
  const [hiAt, hiTop, hiMiddle, hiHorizon] = STOPS[i]!
  const t = clamp((elevation - loAt) / (hiAt - loAt))

  return [mix(loTop, hiTop, t), mix(loMiddle, hiMiddle, t), mix(loHorizon, hiHorizon, t)]
}

// --- Where the sun and the moon are -------------------------------------------

// The sky's one body: the sun from sunrise to sunset, the moon from sunset
// to sunrise, each crossing the same arc over the right of the sky. Rising
// at its left foot, highest at its middle, setting at its right foot.
export type Arc = { left: number; right: number; top: number; foot: number }

export const WALLPAPER_ARC: Arc = { left: 0.56, right: 0.95, top: 0.12, foot: 0.62 }

type Body = { isDay: boolean; progress: number }

export function bodyAt(ms: number, place: Place): Body {
  const arc = dayArc(ms, place.lat, place.lon)
  if (arc) return arc
  // A polar day or night: the sun goes round, so the azimuth says how far.
  const sun = sunAt(ms, place.lat, place.lon)

  return { isDay: sun.elevation > -0.83, progress: clamp(((sun.azimuth + 180) % 360) / 360) }
}

export function arcPoint(canvas: Canvas, arc: Arc, progress: number): { x: number; y: number } {
  return {
    x: canvas.w * (arc.left + (arc.right - arc.left) * clamp(progress)),
    y: canvas.h * (arc.foot - (arc.foot - arc.top) * Math.sin(clamp(progress) * Math.PI)),
  }
}

export function paintGradient(canvas: Canvas, sun: Sun, body: Body, arc: Arc, cloudiness: number): void {
  const { w, h } = canvas
  const isEvening = body.isDay ? body.progress > 0.5 : body.progress < 0.5
  let [top, middle, horizon] = stops(sun.elevation)

  // Sunsets run pinker than sunrises, through dusk and no further.
  if (isEvening && sun.elevation < 12) {
    const k = 0.22 * clamp((12 - sun.elevation) / 18) * smoothstep(-14, -4, sun.elevation)
    middle = mix(middle, 0xff6f91, k)
    horizon = mix(horizon, 0xff6f91, k * 0.8)
  }

  // The glow sits where the sun is, or at the foot it set behind or will
  // rise from.
  const glowAt = body.isDay ? body.progress : isEvening ? 1 : 0
  const { x: sunX } = arcPoint(canvas, arc, glowAt)
  const glow = clamp(1 - Math.abs(sun.elevation - 1) / 11) * (1 - cloudiness)
  const glowColor = isEvening ? 0xff7a5c : 0xffb37a

  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1)
    const base = t < 0.55 ? mix(top, middle, t / 0.55) : mix(middle, horizon, (t - 0.55) / 0.45)
    for (let x = 0; x < w; x++) {
      const dx = (x - sunX) / w
      const c = mix(base, glowColor, glow * t * t * Math.exp(-dx * dx * 6) * 0.55)
      canvas.paint(x, y, mix(c, grey(c), cloudiness))
    }
  }
}

// --- Stars ------------------------------------------------------------------

// How much of the night is out: 0 by day, 1 past nautical twilight.
export function nightness(sun: Sun): number {
  return smoothstep(-5, -13, sun.elevation)
}

// One star per `every` pixels or so, brighter and rarer ones among them,
// each `dot` pixels across; a few twinkle as `t` moves. Scattered by seed,
// so a large wallpaper costs no more than its stars.
export function paintStars(
  canvas: Canvas,
  sun: Sun,
  cloudiness: number,
  t: number,
  every = 260,
  dot = 1,
): void {
  const strength = nightness(sun) * (1 - cloudiness * 0.9)
  if (strength < 0.03) return
  const { w, h } = canvas
  const count = Math.round((w * h * 0.8) / every)
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand(i * 2 + 1) * w)
    const y = Math.floor(rand(i * 2 + 2) * h * 0.8)
    const n = hash(i + 99991)
    const kind = n % 20
    const tint = kind === 0 ? 0xffd2a8 : kind === 1 ? 0xb8ccff : 0xfff8ec
    const twinkle = 0.75 + 0.25 * Math.sin(t * (1.5 + (n % 7) * 0.4) + n)
    const bright = (kind < 3 ? 0.95 : 0.35 + ((n >>> 5) % 5) * 0.1) * twinkle
    // Fainter near the horizon, where the air is thick.
    const a = strength * bright * (1 - smoothstep(0.45, 0.8, y / h))
    for (let dy = 0; dy < dot; dy++) {
      for (let dx = 0; dx < dot; dx++) canvas.glaze(x + dx, y + dy, tint, a)
    }
    if (kind < 3 && dot > 1) {
      for (let k = 1; k <= dot * 2; k++) {
        const fade = a * 0.35 * (1 - k / (dot * 2 + 1))
        canvas.glaze(x - k, y, tint, fade)
        canvas.glaze(x + dot - 1 + k, y, tint, fade)
        canvas.glaze(x, y - k, tint, fade)
        canvas.glaze(x, y + dot - 1 + k, tint, fade)
      }
    }
  }
}

// --- The moon -----------------------------------------------------------------

// A full moon, as tools/moon.html draws it: `size` square, RGBA.
export type MoonTexture = { size: number; rgba: Uint8Array }

function sampleTexture(texture: MoonTexture, u: number, v: number): [number, number] {
  const { size, rgba } = texture
  const x = clamp(u, 0, 1) * (size - 1)
  const y = clamp(v, 0, 1) * (size - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const corners = [
    [x0, y0, (1 - fx) * (1 - fy)],
    [x0 + 1, y0, fx * (1 - fy)],
    [x0, y0 + 1, (1 - fx) * fy],
    [x0 + 1, y0 + 1, fx * fy],
  ] as const
  let r = 0
  let g = 0
  let b = 0
  let alpha = 0
  for (const [cx, cy, weight] of corners) {
    const i = (Math.min(cy, size - 1) * size + Math.min(cx, size - 1)) * 4
    r += (rgba[i] ?? 0) * weight
    g += (rgba[i + 1] ?? 0) * weight
    b += (rgba[i + 2] ?? 0) * weight
    alpha += ((rgba[i + 3] ?? 0) / 255) * weight
  }
  if (alpha <= 0.001) return [0, 0]
  // The texture's edge was averaged with transparent black: undo that.
  const color = (Math.round(r / alpha) << 16) | (Math.round(g / alpha) << 8) | Math.round(b / alpha)

  return [color, alpha]
}

// The moon in its phase at (cx, cy): the lit side to the right while
// waxing, a faint earthshine on the dark side, a soft halo. With a texture
// its seas and craters show; without one it is a plain disc.
export function paintMoon(
  canvas: Canvas,
  moon: Moon,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  texture?: MoonTexture | null,
): void {
  if (moon.illumination < 0.02 || strength <= 0) return
  const plain = 0xf4efdc
  const reach = Math.ceil(radius * 3.2)
  // The terminator is soft over about a pixel and a half.
  const soft = 1.5 / radius
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      // The halo lies under the disc too, so its edge meets light, not sky.
      const r = Math.sqrt(dx * dx + dy * dy) / radius
      const halo = 0.16 * Math.exp(-Math.max(0, r - 1) * 1.6) * moon.illumination
      canvas.glaze(cx + dx, cy + dy, plain, halo * strength)
      if (r > 1.02) continue

      const nx = dx / radius
      const edge = Math.sqrt(Math.max(0, 1 - (dy / radius) ** 2))
      const terminator = edge * (1 - 2 * moon.illumination)
      const side = moon.isWaxing ? nx - terminator : -nx - terminator
      const lit = smoothstep(-soft, soft, side)

      const [surface, alpha] = texture
        ? sampleTexture(texture, (dx / radius + 1) / 2, (dy / radius + 1) / 2)
        : [plain, smoothstep(1, 1 - soft, r)]
      if (alpha <= 0) continue
      const behind = canvas.get(Math.round(cx + dx), Math.round(cy + dy))
      canvas.glaze(cx + dx, cy + dy, mix(mix(behind, surface, 0.07), surface, lit), alpha * strength)
    }
  }
}

// --- The sun, printed ---------------------------------------------------------

// A risograph sun: a solid yellow disc (orange as it sinks), the pink plate
// laid over it a little off register, and a glow of dots that thin out.
export function paintSun(
  canvas: Canvas,
  sun: Sun,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  pitch: number,
  tone: (c: number) => number = c => c,
): void {
  if (strength <= 0) return
  const low = 1 - smoothstep(2, 22, sun.elevation)
  const disc = tone(mix(INKS.yellow, INKS.orange, low * 0.8))
  const overprint = tone(mix(INKS.orange, INKS.pink, low))
  const shift = { x: radius * 0.09, y: radius * 0.07 }
  const reach = Math.ceil(radius * 3.4)

  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const x = cx + dx
      const y = cy + dy
      const d = Math.sqrt(dx * dx + dy * dy)
      // The glow: a screen of dots, densest at the rim, gone by `reach`.
      if (d > radius && d < reach) {
        const density = 0.55 * Math.exp(-(d - radius) / (radius * 0.75)) * smoothstep(reach, reach * 0.6, d)
        canvas.glaze(x, y, disc, screen(x, y, density, pitch, SCREEN_ANGLES.yellow) * strength * 0.8)
      }
      // The disc, solid, with the odd ink-starved fleck.
      const cover = smoothstep(radius + 0.8, radius - 0.8, d)
      if (cover > 0) {
        const starved = hash(Math.round(x) * 7919 + Math.round(y) * 131) % 61 === 0 ? 0.55 : 1
        canvas.glaze(x, y, disc, cover * strength * starved)
      }
      // The second plate, half-tone and off register.
      const ox = dx - shift.x
      const oy = dy - shift.y
      const over = smoothstep(radius * 0.92 + 0.8, radius * 0.92 - 0.8, Math.sqrt(ox * ox + oy * oy))
      if (over > 0) {
        const density = 0.25 + 0.45 * clamp((ox + oy) / (radius * 1.6) + 0.5)
        canvas.glaze(x, y, overprint, over * screen(x, y, density, pitch, SCREEN_ANGLES.pink) * strength * 0.85)
      }
    }
  }
}

// --- Clouds -----------------------------------------------------------------

// Shapes a rare cloud takes, cell by cell; each 'x' is a puff.
export const RARE_SHAPES = {
  clawd: ['.xxxxxx.', '.x.xx.x.', 'xxxxxxxx', '.xxxxxx.', '.x.xx.x.'],
  heart: ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  whale: ['...........x.x', '.xxxxxx......x', 'xxxxxxxxx...xx', 'xxxxxxxxxxxxx.', '.xxxxxxxxxx...'],
  rabbit: ['.x.x....', '.x.x....', 'xxxx....', 'xxxxxxx.', '.xxxxxxx', '..x...x.'],
} as const

export type CloudKind = 'puffy' | keyof typeof RARE_SHAPES | 'golden' | 'ufo'

const RARE_KINDS: CloudKind[] = ['clawd', 'heart', 'whale', 'rabbit', 'golden', 'ufo']

// A cumulus is the union of soft round puffs, bumpy on top; a shaped cloud
// is puffs melted together (each adds r² / d², the cloud is where the sum
// passes 1), so a whale or a heart holds together without seams.
type Puff = { x: number; y: number; r: number }

function puffsOf(kind: CloudKind, seed: number, size: number): Puff[] {
  if (kind in RARE_SHAPES) {
    const rows = RARE_SHAPES[kind as keyof typeof RARE_SHAPES]
    const cell = size * 0.42
    const puffs: Puff[] = []
    rows.forEach((row, cy) => {
      for (let cx = 0; cx < row.length; cx++) {
        if (row[cx] === 'x') puffs.push({ x: cx * cell, y: cy * cell, r: cell * 0.62 })
      }
    })

    return puffs
  }

  // An ordinary cumulus: a row of puffs, the middle ones tallest, flat below.
  const count = 3 + (seed % 4)
  const puffs: Puff[] = []
  for (let i = 0; i < count; i++) {
    const middle = 1 - Math.abs(i / (count - 1) - 0.5) * 1.2
    const r = size * (0.35 + 0.35 * middle) * (0.8 + rand(seed + i) * 0.4)
    puffs.push({ x: i * size * 0.55, y: -r * 0.45, r })
  }

  return puffs
}

export type CloudField = {
  count: number
  // Where they float, as fractions of the canvas height.
  top: number
  bottom: number
  // A cloud's size in pixels, and how far it drifts each second.
  size: number
  speed: number
  // Chance that a cloud, each time it crosses, is a rare one.
  rareChance: number
  opacity: number
  // Printed in halftone on this pitch (pixels), or soft if absent.
  pitch?: number
}

// Clouds drift west to east and come back as new ones; their colour comes
// from the sky behind them, lit by the sun or the moon. Printed, the lit tops
// take pink (violet by night, orange at sunset) and the undersides blue, two
// plates a little off register. `tone` maps every colour laid down, as the
// wallpaper dims its picture.
export function paintClouds(
  canvas: Canvas,
  field: CloudField,
  sun: Sun,
  t: number,
  tone: (c: number) => number = c => c,
): void {
  const { w, h } = canvas
  const day = smoothstep(-8, 6, sun.elevation)
  const golden = clamp(1 - Math.abs(sun.elevation - 2) / 9)
  const topInk = mix(mix(INKS.violet, INKS.pink, day), INKS.orange, golden * 0.6)
  const underInk = mix(INKS.indigo, INKS.blue, day)
  const inkStrength = 0.45 + 0.35 * day
  const pitch = field.pitch ?? 0
  const register = { x: pitch * 0.45, y: pitch * 0.3 }

  for (let slot = 0; slot < field.count; slot++) {
    const margin = field.size * 6
    const span = w + margin * 2
    const speed = field.speed * (0.6 + rand(slot * 31 + 2) * 0.8)
    const travelled = rand(slot * 977 + 5) * span + t * speed
    const lap = Math.floor(travelled / span)
    const seed = hash(slot * 7919 + lap * 104729 + 11)
    const isRare = rand(seed + 3) < field.rareChance
    const kind: CloudKind = isRare ? RARE_KINDS[seed % RARE_KINDS.length]! : 'puffy'
    const size = field.size * (0.7 + rand(seed + 9) * 0.6)
    // Kept fractional: a cloud slides by less than a pixel at a time.
    const ox = (travelled % span) - margin
    const oy = Math.round(h * (field.top + (field.bottom - field.top) * rand(seed + 1)))

    if (kind === 'ufo') {
      paintUfo(canvas, Math.round(ox), oy, size, t, field.opacity, tone)
      continue
    }

    const puffs = puffsOf(kind, seed, size)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const p of puffs) {
      minX = Math.min(minX, p.x - p.r * 1.6)
      maxX = Math.max(maxX, p.x + p.r * 1.6)
      minY = Math.min(minY, p.y - p.r * 1.6)
      maxY = Math.max(maxY, p.y + p.r * 1.6)
    }
    const flat = kind === 'puffy' ? maxY - (maxY - minY) * 0.35 : maxY
    const frac = ox - Math.floor(ox)

    for (let py = Math.floor(minY); py <= Math.ceil(flat); py++) {
      for (let px = Math.floor(minX) - 1; px <= Math.ceil(maxX); px++) {
        // Sampled at the cloud's own sub-pixel offset, so it glides.
        const sx = px - frac
        let cover = 0
        if (kind === 'puffy') {
          for (const p of puffs) {
            const d = Math.sqrt((sx - p.x) ** 2 + (py - p.y) ** 2)
            cover = Math.max(cover, smoothstep(p.r, p.r - Math.max(1, p.r * 0.35), d))
          }
        } else {
          let sum = 0
          for (const p of puffs) sum += (p.r * p.r) / ((sx - p.x) ** 2 + (py - p.y) ** 2 + 0.5)
          cover = smoothstep(0.85, 1.6, sum)
        }
        if (cover <= 0) continue
        const x = Math.floor(ox) + px
        const y = oy + py
        if (x < 0 || y < 0 || x >= w || y >= h) continue

        const behind = canvas.get(x, y)
        const lower = clamp((py - minY) / Math.max(1, flat - minY))
        const lit = mix(mix(behind, tone(0x9aa3c4), 0.22), mix(behind, tone(0xffffff), 0.6), day)
        const shade = mix(lit, tone(0xff7a8a), golden * 0.55)
        let color = mix(lit, mix(shade, grey(behind), 0.25), lower)
        if (kind === 'golden') color = mix(color, tone(0xffd36b), 0.55 * (1 - lower * 0.5))

        if (pitch <= 0) {
          canvas.glaze(x, y, color, cover * field.opacity)
          continue
        }
        // Printed: a pale body, then the two plates in halftone.
        canvas.glaze(x, y, color, cover * field.opacity * 0.55)
        const topDots = screen(x, y, cover * (1 - lower) * 0.65, pitch, SCREEN_ANGLES.pink)
        canvas.glaze(x, y, tone(topInk), topDots * inkStrength * field.opacity)
        const underDots = screen(x - register.x, y - register.y, cover * lower * 0.6, pitch, SCREEN_ANGLES.blue)
        canvas.glaze(x, y, tone(underInk), underDots * inkStrength * field.opacity)
      }
    }
  }
}

// Now and then not a cloud at all.
function paintUfo(
  canvas: Canvas,
  ox: number,
  oy: number,
  size: number,
  t: number,
  opacity: number,
  tone: (c: number) => number,
): void {
  const s = Math.max(1, Math.round(size / 6))
  const rows = ['..ddd..', '.ddddd.', 'hhhhhhh', '.hlhlh.']
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx]
      if (ch === '.') continue
      const blink = Math.floor(t * 2 + rx) % 3 === 0
      const color = ch === 'd' ? 0x8fe3ff : ch === 'l' ? (blink ? INKS.yellow : INKS.pink) : 0x9aa4b8
      for (let yy = 0; yy < s; yy++) {
        for (let xx = 0; xx < s; xx++) {
          canvas.glaze(ox + rx * s + xx, oy + ry * s + yy, tone(color), opacity)
        }
      }
    }
  })
}

// --- Aurora ---------------------------------------------------------------

// Curtains along the top of the sky: a bright green lower edge, violet
// above, swaying slowly. `strength` 0 to 1.
export function paintAurora(canvas: Canvas, strength: number, t: number): void {
  if (strength <= 0) return
  const { w, h } = canvas
  for (let x = 0; x < w; x++) {
    const u = x / w
    const base = h * (0.22 + 0.16 * noise(u * 4 + t * 0.02, 1))
    const tall = h * (0.12 + 0.22 * noise(u * 9 - t * 0.04, 2))
    // Rays, and whole stretches where the curtain thins out to nothing.
    const ray = 0.25 + 0.75 * noise(u * 40 + t * 0.15, 3) ** 3
    const fold = smoothstep(0.25, 0.75, noise(u * 3.5 - t * 0.03, 4))
    const reach = tall * 0.25
    for (let y = Math.max(0, Math.floor(base - tall)); y <= base + reach; y++) {
      // A bright lower edge fading upward into violet, a faint glow below it.
      const rel = (base - y) / tall
      const a = rel >= 0 ? Math.exp(-rel * 2.4) : Math.exp((rel * tall) / (reach * 0.3)) * 0.6
      const color = mix(0x3dffa0, 0xa86bff, clamp(rel * 1.4))
      canvas.glaze(x, y, color, strength * ray * fold * a * 0.75)
    }
  }
}

export function auroraStrength(input: SkyInput, sun: Sun): number {
  const { place, weather, kp, isAuroraForced } = input
  const clear = 1 - greyness(weather)
  if (isAuroraForced) return 0.9 * Math.max(0.4, nightness(sun))
  if (kp === null || kp === undefined) return 0
  const over = kp - auroraThreshold(place.lat) + 1

  return clamp(over / 3) * nightness(sun) * clear
}

// --- Weather in the band ----------------------------------------------------

// Drops per column (1 in n) and how fast they fall, in pixels a second.
const PRECIPITATION: Partial<Record<Sky, { every: number; speed: number; color: number }>> = {
  drizzle: { every: 9, speed: 10, color: 0x9cc4ff },
  rain: { every: 4, speed: 18, color: 0x9cc4ff },
  thunder: { every: 3, speed: 22, color: 0x9cc4ff },
  snow: { every: 6, speed: 3, color: 0xffffff },
}

export function paintPrecipitation(canvas: Canvas, weather: Weather | null | undefined, t: number): void {
  if (!weather) return
  const sky = skyOf(weather.code)
  const fall = PRECIPITATION[sky]
  const { w, h } = canvas
  if (fall) {
    const isSnow = sky === 'snow'
    const slant = Math.min(2, weather.wind / 6)
    for (let x = 0; x < w; x++) {
      const n = hash(x * 4099 + 3)
      if (n % fall.every !== 0) continue
      const y = ((n >>> 5) % 97 + t * fall.speed * (0.8 + (n % 5) * 0.1)) % (h + 2)
      const drift = isSnow ? Math.sin(t * 1.5 + n) * (1 + slant) : -y * slant * 0.5
      canvas.blend(x + drift, y, fall.color, isSnow ? 0.9 : 0.65)
    }
  }

  // Now and then, lightning.
  if (sky === 'thunder' && t % 6 < 0.25) {
    const bx = hash(Math.floor(t / 6)) % Math.max(1, Math.floor(w * 0.6))
    canvas.sprite(bx, 0, ['.Y', 'Y.', '.Y', 'Y.', '.Y'], { Y: 0xfff3a0 }, 1, 'Y')
  }
}

// --- The two skies ----------------------------------------------------------

function cloudFieldFor(weather: Weather | null | undefined, canvas: Canvas, size: number, pitch?: number): CloudField {
  const cover = weather ? weather.cloudCover / 100 : 0.3
  const wind = weather ? weather.wind : 3

  return {
    // A handful of small clouds far off on a fair day, more as it closes in.
    count: Math.round(5 + cover * 4),
    top: 0.06,
    bottom: 0.5,
    size,
    // Slow, as far-off clouds are: a window's width in some twenty minutes.
    speed: (canvas.w / 1400) * (1 + wind / 5),
    rareChance: 0.08,
    opacity: 0.55 + cover * 0.3,
    pitch,
  }
}

// The band's arc lies between the words and Clawd's corner.
const BAND_ARC: Arc = { left: 0.3, right: 0.62, top: 0.2, foot: 0.95 }

// The sky the band draws itself when the terminal shows no wallpaper.
export function paintBandSky(canvas: Canvas, input: SkyInput): void {
  const { ms, place, t } = input
  const sun = sunAt(ms, place.lat, place.lon)
  const body = bodyAt(ms, place)
  const cloudiness = greyness(input.weather)
  paintGradient(canvas, sun, body, BAND_ARC, cloudiness)
  paintAurora(canvas, auroraStrength(input, sun), t)
  paintStars(canvas, sun, cloudiness, t, 90)
  const at = arcPoint(canvas, BAND_ARC, body.progress)
  if (body.isDay) {
    paintSun(canvas, sun, at.x, at.y, 1.3, 1 - cloudiness * 0.85, 2)
  } else {
    paintMoon(canvas, moonAt(ms, place.lat, place.lon), at.x, at.y, 1.6, 1 - cloudiness * 0.8)
  }
  paintClouds(canvas, cloudFieldFor(input.weather, canvas, 3), sun, t)
}

// The brightest the wallpaper gets, so the terminal's light text stays
// readable on a midday sky: the whole picture is scaled down together, then
// given back some colour so a dimmed day stays blue rather than grey.
const WALLPAPER_LUMINANCE = 0.36
const WALLPAPER_SATURATION = 1.35

// The still part of the wallpaper (gradient, aurora, stars, sun or moon),
// already dimmed, kept between frames: only the clouds move.
export type WallpaperCache = { key: string; base: Uint32Array; k: number }

// The whole sky as a PNG (base64), at the window's shape so stars stay
// round. The still part is painted once a minute and kept in `cache`; each
// call lays the clouds where they have drifted to. A large picture is work,
// so it goes in steps with `pause` between them.
export async function wallpaperPng(
  input: SkyInput,
  width: number,
  height: number,
  pause: () => Promise<void> = async () => {},
  cache: { current?: WallpaperCache } = {},
): Promise<string> {
  const { ms, place, weather, t } = input
  const canvas = new Canvas(width, height)
  const sun = sunAt(ms, place.lat, place.lon)
  const cloudiness = greyness(weather)
  // Sizes follow the window: a unit is a sixtieth of its height.
  const unit = Math.max(4, Math.round(height / 60))

  const key = [
    width,
    height,
    Math.floor(ms / 60_000),
    place.name,
    weather?.code,
    weather?.cloudCover,
    input.kp,
    input.isAuroraForced,
    !!input.moonTexture,
  ].join('|')
  let still = cache.current
  if (!still || still.key !== key) {
    const body = bodyAt(ms, place)
    paintGradient(canvas, sun, body, WALLPAPER_ARC, cloudiness)
    let brightest = 0
    for (const c of canvas.px) brightest = Math.max(brightest, luminance(c))
    const k = Math.min(1, WALLPAPER_LUMINANCE / Math.max(brightest, 0.001))
    await pause()

    paintAurora(canvas, auroraStrength(input, sun), t)
    paintStars(canvas, sun, cloudiness, t, 1400, Math.max(1, Math.round(height / 700)))
    const at = arcPoint(canvas, WALLPAPER_ARC, body.progress)
    if (!body.isDay) {
      const strength = (0.35 + 0.65 * nightness(sun)) * (1 - cloudiness * 0.8)
      paintMoon(canvas, moonAt(ms, place.lat, place.lon), at.x, at.y, unit * 2, strength, input.moonTexture)
    }
    await pause()

    for (let i = 0; i < canvas.px.length; i++) {
      canvas.px[i] = saturate(mix(0, canvas.px[i]!, k), WALLPAPER_SATURATION)
    }
    // The sun goes on after the dimming, keeping half its light: it is small,
    // and a dull sun looks like a mistake.
    if (body.isDay) {
      const half = (c: number) => mix(saturate(mix(0, c, k), WALLPAPER_SATURATION), c, 0.5)
      paintSun(canvas, sun, at.x, at.y, unit * 1.9, 1 - cloudiness * 0.85, Math.max(3, unit * 0.24), half)
    }
    still = { key, base: canvas.px.slice(), k }
    cache.current = still
    await pause()
  } else {
    canvas.px.set(still.base)
  }

  const k = still.k
  const tone = (c: number) => saturate(mix(0, c, k), WALLPAPER_SATURATION)
  paintClouds(canvas, cloudFieldFor(weather, canvas, unit * 3.2, Math.max(3, unit * 0.24)), sun, t, tone)
  await pause()

  const rows = pngRows(canvas)
  const band = 400
  for (let y = 0; y < height; y += band) {
    fillPngRows(canvas, rows, y, y + band)
    await pause()
  }
  const file = pngOf(width, height, rows)

  return toBase64(file)
}
