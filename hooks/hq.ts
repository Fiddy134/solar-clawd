// Clawd's corner as a picture, where the terminal shows pictures: he and his
// things are shapes measured in distance (antialiased at any size), printed
// as a risograph would print them: flat ink plates, halftone shading, an
// indigo key line a little off register, the odd ink-starved fleck, and by
// night an indigo screen laid over all of it. What glows (screens, flames,
// notes) is printed last, over the night.
//
// The corner's unit is the band's old pixel (a column wide, half a row
// tall), so the layout matches the cells version; only the drawing is finer.

import { chaseAt, REACTION_SECONDS, ROWS, sceneOf } from './clawd'
import type { Arms, Eyes, HatKind, Legs, SceneState, View } from './clawd'
import { clamp, hash, INKS, mix, rand, SCREEN_ANGLES, screen, smoothstep } from './paint'

// Columns the picture spans: the scene, and room to its left to chase a hat.
export const HQ_COLUMNS = 30

const CORAL = 0xd97757
const CREAM = 0xf5efe0
const WOOD = 0x9a5a3c
const SCREEN_DARK = 0x15172b
const KEY = INKS.indigo

// --- Shapes -------------------------------------------------------------------

// A shape is its bounding box and its signed distance (negative inside), in
// units.
type Shape = { x0: number; y0: number; x1: number; y1: number; d: (x: number, y: number) => number }

function circle(cx: number, cy: number, r: number): Shape {
  return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, d: (x, y) => Math.hypot(x - cx, y - cy) - r }
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Shape {
  const m = Math.min(rx, ry)

  return {
    x0: cx - rx,
    y0: cy - ry,
    x1: cx + rx,
    y1: cy + ry,
    d: (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * m,
  }
}

function box(x: number, y: number, w: number, h: number, r = 0): Shape {
  const cx = x + w / 2
  const cy = y + h / 2
  const hw = w / 2 - r
  const hh = h / 2 - r

  return {
    x0: x,
    y0: y,
    x1: x + w,
    y1: y + h,
    d: (px, py) => {
      const qx = Math.abs(px - cx) - hw
      const qy = Math.abs(py - cy) - hh

      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
    },
  }
}

function capsule(ax: number, ay: number, bx: number, by: number, r: number): Shape {
  const ex = bx - ax
  const ey = by - ay
  const len = ex * ex + ey * ey || 1

  return {
    x0: Math.min(ax, bx) - r,
    y0: Math.min(ay, by) - r,
    x1: Math.max(ax, bx) + r,
    y1: Math.max(ay, by) + r,
    d: (x, y) => {
      const h = clamp(((x - ax) * ex + (y - ay) * ey) / len)

      return Math.hypot(x - ax - ex * h, y - ay - ey * h) - r
    },
  }
}

function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Shape {
  const edge = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) => {
    const ex = x1 - x0
    const ey = y1 - y0
    const h = clamp(((px - x0) * ex + (py - y0) * ey) / (ex * ex + ey * ey || 1))

    return Math.hypot(px - x0 - ex * h, py - y0 - ey * h)
  }
  const side = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) =>
    (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)

  return {
    x0: Math.min(ax, bx, cx),
    y0: Math.min(ay, by, cy),
    x1: Math.max(ax, bx, cx),
    y1: Math.max(ay, by, cy),
    d: (x, y) => {
      const d = Math.min(edge(x, y, ax, ay, bx, by), edge(x, y, bx, by, cx, cy), edge(x, y, cx, cy, ax, ay))
      const s1 = side(x, y, ax, ay, bx, by)
      const s2 = side(x, y, bx, by, cx, cy)
      const s3 = side(x, y, cx, cy, ax, ay)
      const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)

      return inside ? -d : d
    },
  }
}

function union(...shapes: Shape[]): Shape {
  return {
    x0: Math.min(...shapes.map(s => s.x0)),
    y0: Math.min(...shapes.map(s => s.y0)),
    x1: Math.max(...shapes.map(s => s.x1)),
    y1: Math.max(...shapes.map(s => s.y1)),
    d: (x, y) => Math.min(...shapes.map(s => s.d(x, y))),
  }
}

// `a` where `b` is not.
function minus(a: Shape, b: Shape): Shape {
  return { ...a, d: (x, y) => Math.max(a.d(x, y), -b.d(x, y)) }
}

// `a` only where `b` is.
function within(a: Shape, b: Shape): Shape {
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    d: (x, y) => Math.max(a.d(x, y), b.d(x, y)),
  }
}

// A line of width `w` along the shape's edge.
function outline(s: Shape, w: number): Shape {
  return { x0: s.x0 - w, y0: s.y0 - w, x1: s.x1 + w, y1: s.y1 + w, d: (x, y) => Math.abs(s.d(x, y)) - w / 2 }
}

// The upper half of a ring.
function arch(cx: number, cy: number, r: number, w: number): Shape {
  return {
    x0: cx - r - w,
    y0: cy - r - w,
    x1: cx + r + w,
    y1: cy,
    d: (x, y) => Math.max(Math.abs(Math.hypot(x - cx, y - cy) - r) - w / 2, y - cy),
  }
}

// --- The print ----------------------------------------------------------------

type Paint = {
  alpha?: number
  // A halftone instead of a solid: the dot size, everywhere or per point.
  tone?: number | ((x: number, y: number) => number)
  angle?: number
  // Off register by this much, in units.
  dx?: number
  dy?: number
  // Ink-starved flecks in a solid.
  grain?: boolean
}

class Print {
  readonly w: number
  readonly h: number
  readonly sx: number
  readonly sy: number
  readonly pitch: number
  // Premultiplied RGBA, 0 to 1.
  readonly px: Float32Array

  constructor(w: number, h: number, sx: number, sy: number) {
    this.w = w
    this.h = h
    this.sx = sx
    this.sy = sy
    this.pitch = Math.max(2.5, ((sx + sy) / 2) * 0.24)
    this.px = new Float32Array(w * h * 4)
  }

  fill(shape: Shape, color: number | ((x: number, y: number) => number), paint: Paint = {}): void {
    const { alpha = 1, tone, angle = 45, dx = 0, dy = 0, grain = false } = paint
    const scale = (this.sx + this.sy) / 2
    const x0 = Math.max(0, Math.floor((shape.x0 + dx) * this.sx) - 1)
    const x1 = Math.min(this.w - 1, Math.ceil((shape.x1 + dx) * this.sx) + 1)
    const y0 = Math.max(0, Math.floor((shape.y0 + dy) * this.sy) - 1)
    const y1 = Math.min(this.h - 1, Math.ceil((shape.y1 + dy) * this.sy) + 1)
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const ux = (px + 0.5) / this.sx - dx
        const uy = (py + 0.5) / this.sy - dy
        let cover = clamp(0.5 - shape.d(ux, uy) * scale)
        if (cover <= 0) continue
        if (tone !== undefined) {
          const t = typeof tone === 'number' ? tone : tone(ux, uy)
          cover *= screen(px, py, t, this.pitch, angle)
        }
        if (grain && hash(px * 7919 + py * 104729) % 47 === 0) cover *= 0.35
        this.over(px, py, typeof color === 'number' ? color : color(ux, uy), cover * alpha)
      }
    }
  }

  over(px: number, py: number, color: number, a: number): void {
    if (a <= 0) return
    const i = (py * this.w + px) * 4
    const k = 1 - a
    this.px[i] = ((color >> 16) & 0xff) / 255 * a + this.px[i]! * k
    this.px[i + 1] = ((color >> 8) & 0xff) / 255 * a + this.px[i + 1]! * k
    this.px[i + 2] = (color & 0xff) / 255 * a + this.px[i + 2]! * k
    this.px[i + 3] = a + this.px[i + 3]! * k
  }

  // Night: an indigo screen over everything printed so far.
  night(amount: number): void {
    if (amount <= 0.02) return
    const [r, g, b] = [((KEY >> 16) & 0xff) / 255, ((KEY >> 8) & 0xff) / 255, (KEY & 0xff) / 255]
    for (let py = 0; py < this.h; py++) {
      for (let px = 0; px < this.w; px++) {
        const i = (py * this.w + px) * 4
        const a = this.px[i + 3]!
        if (a < 0.01) continue
        const k = screen(px, py, amount, this.pitch, SCREEN_ANGLES.indigo) * 0.6
        this.px[i] = this.px[i]! * (1 - k) + r * a * k
        this.px[i + 1] = this.px[i + 1]! * (1 - k) + g * a * k
        this.px[i + 2] = this.px[i + 2]! * (1 - k) + b * a * k
      }
    }
  }

  rgba(): Uint8Array {
    const out = new Uint8Array(this.w * this.h * 4)
    for (let i = 0; i < this.px.length; i += 4) {
      const a = this.px[i + 3]!
      if (a <= 0.001) continue
      out[i] = Math.round(Math.min(1, this.px[i]! / a) * 255)
      out[i + 1] = Math.round(Math.min(1, this.px[i + 1]! / a) * 255)
      out[i + 2] = Math.round(Math.min(1, this.px[i + 2]! / a) * 255)
      out[i + 3] = Math.round(a * 255)
    }

    return out
  }
}

// A solid shape with its key line printed a little off register.
function keyed(p: Print, shape: Shape, color: number, paint: Paint = {}): void {
  p.fill(shape, color, { grain: true, ...paint })
  p.fill(outline(shape, 0.11), KEY, { dx: 0.06, dy: 0.05, alpha: 0.85 })
}

// --- Clawd ------------------------------------------------------------------

type Pose = { eyes: Eyes; arms: Arms; legs: Legs; wave?: number }

function legsOf(x: number, y: number, legs: Legs): Shape {
  const sway = legs === 'stepA' ? 0.3 : legs === 'stepB' ? -0.3 : 0
  const leg = (at: number, k: number) => capsule(x + at, y + 2.8, x + at + sway * k, y + 3.85, 0.17)

  return union(leg(1.35, 1), leg(2.1, -1), leg(3.9, 1), leg(4.65, -1))
}

// His arms are the logo's: short stubs at his sides, halfway down.
function armsOf(x: number, y: number, arms: Arms, wave = 0): Shape | null {
  const left = box(x + 0.25, y + 1.5, 0.95, 0.78, 0.32)
  const right = box(x + 4.8, y + 1.5, 0.95, 0.78, 0.32)
  switch (arms) {
    case 'down':
      return union(left, right)
    case 'typing':
      return union(left, capsule(x + 5.0, y + 1.85, x + 5.75, y + 2.55, 0.36))
    case 'up':
      return union(capsule(x + 1.1, y + 1.85, x + 0.3, y + 0.45, 0.36), capsule(x + 4.9, y + 1.85, x + 5.7, y + 0.45, 0.36))
    case 'right-up':
      return union(left, capsule(x + 4.9, y + 1.85, x + 5.85 + wave * 0.35, y + 0.4, 0.36))
    case 'none':
      return null
  }
}

function paintClawd(p: Print, x: number, y: number, pose: Pose): void {
  const body = box(x + 0.9, y, 4.2, 3.0, 0.55)
  const arms = armsOf(x, y, pose.arms, pose.wave)
  const silhouette = arms ? union(body, arms, legsOf(x, y, pose.legs)) : union(body, legsOf(x, y, pose.legs))

  p.fill(silhouette, CORAL, { grain: true })
  // Shading: the pink plate in halftone, deepening toward his feet.
  p.fill(silhouette, INKS.pink, { tone: (_, uy) => smoothstep(y + 0.7, y + 3.4, uy) * 0.42, angle: SCREEN_ANGLES.pink, alpha: 0.55 })
  // A cream highlight up on his brow.
  p.fill(within(ellipse(x + 2.2, y + 0.45, 1.3, 0.45), body), CREAM, { tone: 0.35, angle: SCREEN_ANGLES.yellow, alpha: 0.5 })
  p.fill(outline(silhouette, 0.11), KEY, { dx: 0.06, dy: 0.05, alpha: 0.85 })

  const look = pose.eyes === 'right' ? 0.35 : pose.eyes === 'left' ? -0.35 : 0
  if (pose.eyes === 'closed') {
    for (const ex of [1.75, 3.75]) p.fill(capsule(x + ex, y + 1.25, x + ex + 0.5, y + 1.25, 0.11), KEY)
  } else if (pose.eyes === 'shades') {
    p.fill(box(x + 1.25, y + 0.8, 3.5, 0.72, 0.3), KEY)
    p.fill(capsule(x + 1.6, y + 0.98, x + 2.0, y + 0.98, 0.07), CREAM, { alpha: 0.9 })
  } else {
    for (const ex of [1.75, 3.75]) {
      p.fill(box(x + ex + look, y + 0.7, 0.5, 0.95, 0.25), KEY)
      p.fill(circle(x + ex + look + 0.32, y + 0.88, 0.09), CREAM, { alpha: 0.9 })
    }
  }
}

// --- Hats ---------------------------------------------------------------------

// Each hat sits on a head whose top-left is (x, y).
function paintHat(p: Print, kind: HatKind, x: number, y: number, t: number, glows: (() => void)[]): void {
  switch (kind) {
    case 'nightcap':
      keyed(p, triangle(x + 0.9, y + 0.25, x + 5.1, y + 0.25, x + 6.0, y - 1.5), INKS.blue)
      p.fill(triangle(x + 0.9, y + 0.25, x + 5.1, y + 0.25, x + 6.0, y - 1.5), INKS.violet, { tone: 0.3, angle: SCREEN_ANGLES.violet })
      keyed(p, box(x + 0.7, y - 0.05, 4.6, 0.55, 0.27), CREAM)
      keyed(p, circle(x + 6.05, y - 1.5, 0.38), CREAM)
      break
    case 'beanie':
      keyed(p, box(x + 0.8, y - 1.05, 4.4, 1.5, 0.7), 0xd8323e)
      p.fill(box(x + 0.8, y - 1.05, 4.4, 1.5, 0.7), INKS.pink, { tone: 0.35, angle: SCREEN_ANGLES.pink })
      keyed(p, box(x + 0.65, y + 0.0, 4.7, 0.5, 0.25), 0xa82632)
      keyed(p, circle(x + 3, y - 1.15, 0.45), CREAM)
      break
    case 'cap':
      keyed(p, box(x + 1.0, y - 0.7, 3.9, 0.95, 0.47), INKS.blue)
      keyed(p, capsule(x + 4.4, y + 0.12, x + 5.6, y + 0.16, 0.17), INKS.blue)
      p.fill(circle(x + 2.95, y - 0.66, 0.14), CREAM)
      break
    case 'santa':
      keyed(p, triangle(x + 0.9, y + 0.15, x + 5.1, y + 0.15, x + 5.9, y - 1.6), 0xd62e3a)
      keyed(p, box(x + 0.7, y - 0.1, 4.6, 0.6, 0.3), CREAM)
      keyed(p, circle(x + 5.95, y - 1.6, 0.4), CREAM)
      break
    case 'lucia': {
      keyed(p, box(x + 0.8, y - 0.25, 4.4, 0.55, 0.27), INKS.green)
      for (const cx of [1.5, 3.0, 4.5]) {
        keyed(p, box(x + cx - 0.17, y - 1.3, 0.34, 1.1, 0.1), CREAM)
        glows.push(() => {
          const flicker = 0.85 + 0.15 * Math.sin(t * 13 + cx * 3)
          p.fill(circle(x + cx, y - 1.55, 0.42), INKS.yellow, { tone: (ux, uy) => 0.3 * flicker * (1 - Math.hypot(ux - x - cx, uy - y + 1.55) / 0.42), angle: SCREEN_ANGLES.yellow, alpha: 0.7 })
          p.fill(ellipse(x + cx, y - 1.55, 0.17, 0.3 * flicker), mix(INKS.yellow, INKS.orange, 0.3))
        })
      }
      break
    }
    case 'midsummer':
      keyed(p, box(x + 0.8, y - 0.3, 4.4, 0.5, 0.25), INKS.green)
      ;[INKS.pink, INKS.yellow, CREAM, INKS.pink, INKS.blue].forEach((color, i) => {
        p.fill(circle(x + 1.1 + i * 0.95, y - 0.12, 0.3), color)
      })
      break
  }
}

// --- Scenes -------------------------------------------------------------------

type Stage = {
  p: Print
  x: number
  y: number
  t: number
  state: SceneState
  isAway: boolean
  glows: (() => void)[]
}

const SYNTAX = [INKS.pink, INKS.green, INKS.yellow, 0x5fb0ff, INKS.orange]

function bed({ p, x, y, t }: Stage, part: 'behind' | 'front'): void {
  if (part === 'behind') {
    keyed(p, box(x - 1.3, y - 0.4, 0.55, 4.4, 0.25), WOOD)
    keyed(p, box(x + 6.65, y + 0.9, 0.55, 3.1, 0.25), WOOD)
    keyed(p, ellipse(x + 0.6, y + 1.05, 1.15, 0.55), CREAM)

    return
  }
  // The blanket rises and falls with his breath.
  const breath = Math.sin(t * 1.4) * 0.09
  const blanket = box(x - 0.6, y + 1.85 + breath, 7.2, 1.7, 0.6)
  keyed(p, blanket, INKS.blue)
  p.fill(blanket, INKS.violet, { tone: (_, uy) => 0.25 + 0.2 * Math.sin(uy * 9), angle: SCREEN_ANGLES.violet })
  p.fill(box(x - 0.6, y + 1.85 + breath, 7.2, 0.38, 0.19), CREAM)
  keyed(p, box(x - 1.3, y + 3.3, 8.5, 0.7, 0.25), WOOD)
}

function sleepingZs({ p, x, y, t }: Stage): void {
  // Each z rises and grows, fading as it goes; a new one every 0.9 seconds.
  for (let k = 0; k < 3; k++) {
    const age = (t / 2.7 + k / 3) % 1
    const size = 0.25 + age * 0.35
    const zx = x + 6.2 + age * 2.2
    const zy = y + 0.8 - age * 2.4
    const a = Math.sin(age * Math.PI) * 0.95
    const z = union(
      capsule(zx, zy, zx + size, zy, 0.07),
      capsule(zx + size, zy, zx, zy + size, 0.07),
      capsule(zx, zy + size, zx + size, zy + size, 0.07),
    )
    p.fill(z, CREAM, { alpha: a })
  }
}

function mug({ p, x, y, t, isAway, state }: Stage): void {
  keyed(p, box(x + 5.7, y + 3.3, 4.9, 0.4, 0.18), WOOD)
  if (state.occasion === 'cinnamonBun') {
    keyed(p, ellipse(x + 9.6, y + 2.95, 0.75, 0.38), 0xc98a4b)
    p.fill(outline(ellipse(x + 9.6, y + 2.92, 0.4, 0.18), 0.1), 0x7a4a24)
  }
  if (state.occasion === 'semla') {
    keyed(p, ellipse(x + 9.6, y + 3.05, 0.75, 0.28), 0xd09a5a)
    keyed(p, ellipse(x + 9.6, y + 2.65, 0.65, 0.35), CREAM)
    keyed(p, ellipse(x + 9.6, y + 2.3, 0.6, 0.22), 0xd09a5a)
  }
  // A sip now and then: the mug eases up to him and back.
  const phase = t % 7
  const sip = isAway ? 0 : smoothstep(6, 6.3, phase) * (1 - smoothstep(6.7, 7, phase))
  const mx = x + 6.25 - sip * 0.5
  const my = y + 1.15 - sip * 0.7
  keyed(p, outline(circle(mx + 1.95, my + 1.0, 0.45), 0.22), CREAM)
  const body = box(mx, my, 1.8, 2.1, 0.35)
  keyed(p, body, CREAM)
  p.fill(within(box(mx, my + 1.0, 1.8, 0.42), body), INKS.blue)
  p.fill(ellipse(mx + 0.9, my + 0.2, 0.72, 0.16), 0x6f4430)
  if (sip > 0.1) return
  // Steam: two thin wisps, curling up and fading as they go.
  for (const wisp of [0, 1]) {
    const at = (k: number) => ({
      x: mx + 0.6 + wisp * 0.6 + Math.sin(t * 2.2 + k * 0.9 + wisp * 2.4) * 0.22 * (1 + k * 0.15),
      y: my - 0.15 - k * 0.3,
    })
    for (let k = 0; k < 6; k++) {
      const a = at(k)
      const b = at(k + 1)
      p.fill(capsule(a.x, a.y, b.x, b.y, 0.06), CREAM, { alpha: 0.45 * (1 - k / 6) })
    }
  }
}

function laptop({ p, x, y, t, glows }: Stage, part: 'behind' | 'front'): void {
  if (part === 'front') return
  keyed(p, box(x + 5.6, y + 3.3, 7.4, 0.4, 0.18), WOOD)
  keyed(p, box(x + 7.0, y - 0.65, 4.9, 3.05, 0.3), 0x5b4a8a)
  const glass = box(x + 7.28, y - 0.4, 4.34, 2.5, 0.14)
  p.fill(glass, SCREEN_DARK)
  keyed(p, box(x + 6.35, y + 2.6, 5.7, 0.6, 0.22), 0xb9bdd0)
  p.fill(box(x + 6.6, y + 2.7, 5.2, 0.4, 0.1), KEY, { tone: 0.35, angle: SCREEN_ANGLES.indigo })
  // Code scrolls up the glass, a line every half second; the cursor blinks.
  glows.push(() => {
    const step = 0.42
    const scroll = (t * 0.9) % step
    const first = Math.floor((t * 0.9) / step)
    for (let i = 0; i < 7; i++) {
      const n = first + i
      const ly = y + 2.0 - i * step + scroll - step
      const indent = Math.floor(rand(n * 3) * 3) * 0.35
      const length = 0.6 + rand(n * 7) * 2.6
      const color = SYNTAX[Math.floor(rand(n * 11) * SYNTAX.length)]!
      p.fill(within(capsule(x + 7.6 + indent, ly, x + 7.6 + indent + length, ly, 0.09), glass), color)
      if (i === 0 && Math.floor(t * 2.5) % 2 === 0) {
        p.fill(within(box(x + 7.75 + indent + length, ly - 0.13, 0.14, 0.26), glass), CREAM)
      }
    }
    p.fill(glass, 0x5fb0ff, { tone: 0.12, angle: SCREEN_ANGLES.blue, alpha: 0.6 })
  })
}

function television({ p, x, y, t, isAway, state, glows }: Stage, part: 'behind' | 'front'): void {
  const tx = x + 7.9
  const ty = y - 1.35
  if (part === 'behind') {
    keyed(p, capsule(tx + 1.3, ty + 4.0, tx + 1.0, y + 3.9, 0.14), 0x2a2a3a)
    keyed(p, capsule(tx + 4.9, ty + 4.0, tx + 5.2, y + 3.9, 0.14), 0x2a2a3a)
    keyed(p, box(tx, ty, 6.2, 4.15, 0.35), 0x1d1f33)
    if (state.isFridayNight) {
      keyed(p, within(ellipse(x + 6.7, y + 3.25, 0.95, 0.55), box(x + 5.5, y + 3.25, 2.5, 1)), INKS.blue)
      for (let i = 0; i < 4; i++) p.fill(ellipse(x + 6.25 + i * 0.3, y + 3.15 - (i % 2) * 0.12, 0.2, 0.12), INKS.yellow)
    }
    // Vice City: a neon sky with its sun, a palm, a causeway and a car.
    glows.push(() => {
      const glass = box(tx + 0.35, ty + 0.35, 5.5, 3.1, 0.15)
      p.fill(glass, (_, uy) => mix(0x3a1160, mix(INKS.pink, INKS.orange, smoothstep(ty + 1.5, ty + 2.8, uy)), smoothstep(ty + 0.35, ty + 1.6, uy)))
      p.fill(within(circle(tx + 3.7, ty + 2.55, 0.95), box(tx, ty, 6.2, 2.55)), INKS.yellow)
      p.fill(within(circle(tx + 3.7, ty + 2.55, 0.95), box(tx, ty, 6.2, 2.55)), INKS.orange, { tone: (_, uy) => smoothstep(ty + 1.7, ty + 2.6, uy) * 0.7, angle: SCREEN_ANGLES.orange })
      const palm = 0x2a0f3a
      p.fill(capsule(tx + 1.3, ty + 3.0, tx + 1.65, ty + 1.15, 0.1), palm)
      for (const [dx, dy] of [[-0.8, 0.35], [0.85, 0.3], [-0.55, -0.25], [0.6, -0.3]] as const) {
        p.fill(capsule(tx + 1.65, ty + 1.15, tx + 1.65 + dx, ty + 1.15 + dy, 0.09), palm)
      }
      const road = within(box(tx + 0.35, ty + 2.85, 5.5, 0.6), glass)
      p.fill(road, 0x1c1430)
      const dash = (t * 2.2) % 1
      for (let i = 0; i < 7; i++) p.fill(within(box(tx + 0.3 + i - dash, ty + 3.1, 0.45, 0.08), glass), CREAM, { alpha: 0.8 })
      const carX = tx + 0.2 + ((t * 1.3) % 6.4)
      p.fill(within(box(carX, ty + 2.88, 0.85, 0.28, 0.1), glass), 0x34e7ff)
      p.fill(within(circle(carX + 0.05, ty + 3.02, 0.06), glass), INKS.pink)
      // Wanted: the police lights flash in the corners.
      if (t % 1.2 < 0.3) {
        p.fill(within(circle(tx + 0.6, ty + 0.6, 0.5), glass), 0xff2a2a, { tone: 0.5, angle: 15, alpha: 0.9 })
        p.fill(within(circle(tx + 5.6, ty + 0.6, 0.5), glass), 0x2a6bff, { tone: 0.5, angle: 75, alpha: 0.9 })
      }
    })

    return
  }
  // The pad, mashed; on the floor while he is off after his hat.
  const jiggle = Math.sin(t * 14) * 0.12
  const pad = isAway ? { x: x + 1.2, y: y + 3.35 } : { x: x + 1.65 + jiggle, y: y + 2.05 }
  keyed(p, box(pad.x, pad.y, 2.7, 0.72, 0.36), 0x3a3550)
  glows.push(() => {
    p.fill(circle(pad.x + 0.55, pad.y + 0.36, 0.13), 0x34e7ff)
    p.fill(circle(pad.x + 2.1, pad.y + 0.28, 0.12), INKS.pink)
    p.fill(circle(pad.x + 2.35, pad.y + 0.48, 0.12), INKS.yellow)
  })
}

// Seasonal things standing to the left of the scene.
function occasionThings({ p, x, y, t, state, glows }: Stage): void {
  const ox = x - 4
  if (state.occasion === 'halloween') {
    const body = ellipse(ox, y + 2.95, 1.3, 0.95)
    keyed(p, body, INKS.orange)
    for (const rx of [-0.55, 0, 0.55]) p.fill(outline(ellipse(ox + rx, y + 2.95, 0.4, 0.9), 0.07), 0xb8481a, { alpha: 0.7 })
    keyed(p, capsule(ox, y + 2.0, ox + 0.2, y + 1.65, 0.12), INKS.green)
    glows.push(() => {
      const flicker = 0.8 + 0.2 * Math.sin(t * 11)
      const glow = mix(INKS.yellow, INKS.orange, 0.3)
      p.fill(triangle(ox - 0.6, y + 2.95, ox - 0.25, y + 2.95, ox - 0.42, y + 2.6), glow, { alpha: flicker })
      p.fill(triangle(ox + 0.25, y + 2.95, ox + 0.6, y + 2.95, ox + 0.42, y + 2.6), glow, { alpha: flicker })
      p.fill(within(ellipse(ox, y + 3.25, 0.55, 0.22), box(ox - 1, y + 3.25, 2, 1)), glow, { alpha: flicker })
    })
  }
  if (state.occasion === 'christmas' || state.occasion === 'lucia') {
    keyed(p, box(ox - 0.15, y + 3.2, 0.3, 0.6), WOOD)
    keyed(p, triangle(ox - 1.3, y + 3.3, ox + 1.3, y + 3.3, ox, y + 1.4), INKS.green)
    keyed(p, triangle(ox - 1.0, y + 2.3, ox + 1.0, y + 2.3, ox, y + 0.6), INKS.green)
    p.fill(triangle(ox - 1.3, y + 3.3, ox + 1.3, y + 3.3, ox, y + 0.6), KEY, { tone: 0.2, angle: SCREEN_ANGLES.indigo })
    glows.push(() => {
      p.fill(circle(ox, y + 0.55, 0.28), INKS.yellow)
      const lights = [INKS.pink, INKS.yellow, 0x5fb0ff]
      ;[[-0.5, 2.9], [0.45, 2.6], [-0.2, 1.9], [0.35, 3.05]].forEach(([dx, dy], i) => {
        const on = Math.floor(t * 2 + i) % 3
        p.fill(circle(ox + dx!, y + dy!, 0.15), lights[on]!)
      })
    })
  }
}

// --- Reactions ------------------------------------------------------------

function sparkle(p: Print, cx: number, cy: number, r: number, color: number, alpha: number): void {
  p.fill(union(capsule(cx - r, cy, cx + r, cy, r * 0.18), capsule(cx, cy - r, cx, cy + r, r * 0.18)), color, { alpha })
}

function question(p: Print, cx: number, cy: number, color: number): void {
  p.fill(arch(cx, cy, 0.32, 0.14), color)
  p.fill(capsule(cx + 0.32, cy, cx, cy + 0.35, 0.07), color)
  p.fill(circle(cx, cy + 0.65, 0.09), color)
}

// --- The corner -----------------------------------------------------------

export type Corner = { rgba: Uint8Array; width: number; height: number }

// The corner as RGBA, `width` by `height` pixels, transparent where nothing
// is, for an Image the band draws over HQ_COLUMNS columns.
export function drawCorner(view: View, width: number, height: number): Corner {
  const p = new Print(width, height, width / HQ_COLUMNS, height / (ROWS * 2))
  const state = sceneOf(view)
  const { t, reaction, track } = view
  const glows: (() => void)[] = []

  // His seat, the old cells' place: fifteen columns in from the right.
  const x = HQ_COLUMNS - 15
  const y = ROWS * 2 - 4
  const chase = state.isWindy ? chaseAt(t, 11) : null
  const stage: Stage = { p, x, y, t, state, isAway: chase !== null, glows }

  // How he sits for what he does, and what Claude's state makes of it.
  let pose: Pose = { eyes: 'open', arms: 'down', legs: 'stand' }
  if (state.activity === 'sleep') pose = { eyes: 'closed', arms: 'none', legs: 'stand' }
  if (state.activity === 'coffee') {
    const isSipping = t % 7 > 6.1 && t % 7 < 6.9
    pose = { eyes: isSipping || t % 4.3 < 0.15 ? 'closed' : 'open', arms: 'down', legs: 'stand' }
  }
  if (state.activity === 'code') pose = { eyes: 'right', arms: Math.floor(t * 7) % 2 === 0 ? 'down' : 'typing', legs: 'stand' }
  if (state.activity === 'gta') pose = { eyes: 'right', arms: 'down', legs: 'stand' }
  if (state.isCool) pose.eyes = 'shades'

  let lift = 0
  const live = reaction && reaction.age < REACTION_SECONDS[reaction.kind] ? reaction : null
  if (live && state.isAwake && !chase) {
    if (live.kind === 'cheer') {
      pose = { ...pose, arms: 'up' }
      lift = -Math.abs(Math.sin(live.age * Math.PI * 2.2)) * 0.8
    }
    if (live.kind === 'facepalm') pose = { ...pose, eyes: 'closed', arms: 'typing' }
    if (live.kind === 'wave') pose = { ...pose, arms: 'right-up', wave: Math.sin(t * 9) }
  }
  if (chase) pose = { eyes: chase.eyes, arms: 'down', legs: chase.legs }

  const cx = x + (chase?.dx ?? 0)
  const cy = y + (chase?.dy ?? 0) + lift

  occasionThings(stage)
  if (state.activity === 'sleep') bed(stage, 'behind')
  if (state.activity === 'code') laptop(stage, 'behind')
  if (state.activity === 'gta') television(stage, 'behind')
  paintClawd(p, cx, cy, pose)
  if (state.activity === 'sleep') bed(stage, 'front')
  if (state.activity === 'coffee') mug(stage)
  if (state.activity === 'gta') television(stage, 'front')

  if (live?.kind === 'facepalm' && state.isAwake && !chase) {
    keyed(p, capsule(cx + 5.1, cy + 1.9, cx + 4.05, cy + 1.1, 0.36), CORAL)
    p.fill(union(circle(cx + 5.9, cy + 0.45, 0.2), triangle(cx + 5.72, cy + 0.38, cx + 6.08, cy + 0.38, cx + 5.9, cy - 0.05)), 0x7fc4ff)
  }

  if (state.hat) {
    const at = chase?.hat
    if (!at) paintHat(p, state.hat, cx, cy, t, glows)
    else if (at.held) paintHat(p, state.hat, x + at.dx + 2.5, y + at.dy + 2.2, t, glows)
    else paintHat(p, state.hat, x + at.dx, y + at.dy, t, glows)
  }

  // Headphones while music plays.
  if (track && state.isAwake) {
    keyed(p, arch(cx + 3, cy + 1.0, 2.45, 0.24), 0x3a3550)
    keyed(p, box(cx + 0.25, cy + 0.55, 0.65, 1.05, 0.28), INKS.pink)
    keyed(p, box(cx + 5.1, cy + 0.55, 0.65, 1.05, 0.28), INKS.pink)
  }

  // Night: the indigo screen over everything that does not glow.
  p.night(1 - smoothstep(0.55, 1, state.light))

  for (const glow of glows) glow()
  if (state.activity === 'sleep') sleepingZs(stage)

  // Notes rising while music plays.
  if (track && state.isAwake) {
    for (let k = 0; k < 2; k++) {
      const age = (t * 0.6 + k * 0.5) % 1
      const nx = cx + 6.3 + k * 1.1 + Math.sin(age * 6) * 0.2
      const ny = cy + 1.4 - age * 2.6
      const color = k === 0 ? INKS.pink : 0x7fe0ff
      const a = Math.sin(age * Math.PI)
      p.fill(union(ellipse(nx, ny, 0.22, 0.17), capsule(nx + 0.2, ny, nx + 0.2, ny - 0.75, 0.05)), color, { alpha: a })
    }
  }

  // What Claude is up to, over his head.
  if (live && !chase) {
    if (live.kind === 'working') {
      for (let i = 0; i < 3; i++) {
        const bounce = Math.max(0, Math.sin(t * 6 - i * 0.8)) * 0.25
        p.fill(circle(cx - 1.4 + i * 0.5, cy + 0.2 - bounce, 0.14), CREAM, { alpha: 0.9 })
      }
    }
    if (live.kind === 'cheer') {
      for (let i = 0; i < 3; i++) {
        const a = live.age * 3 + (i * Math.PI * 2) / 3
        sparkle(p, cx + 3 + Math.cos(a) * 3.4, cy + 0.9 + Math.sin(a) * 1.1, 0.3, INKS.yellow, 0.9)
      }
    }
    if (live.kind === 'wave') question(p, cx + 6.9, cy - 0.6, INKS.yellow)
    if (live.kind === 'facepalm' && !state.isAwake) question(p, cx + 6.9, cy - 0.6, INKS.yellow)
  }

  return { rgba: p.rgba(), width, height }
}

