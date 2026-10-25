// Pictures printed as a risograph prints them: shapes measured in distance
// (antialiased at any size) laid down as flat ink plates, halftone shading,
// an indigo key line a little off register, the odd ink-starved fleck, and
// by night an indigo screen over all of it. For what is drawn as a picture
// rather than in cells: events on iTerm2's wallpaper, and previews.
//
// Clawd's own corner was printed this way until he went back to cells,
// which cost a tenth of the CPU: see the history before hooks/clawd.ts.

import { clamp, hash, INKS, SCREEN_ANGLES, screen } from './paint'

const KEY = INKS.indigo

// --- Shapes -------------------------------------------------------------------

// A shape is its bounding box and its signed distance (negative inside), in
// units.
export type Shape = { x0: number; y0: number; x1: number; y1: number; d: (x: number, y: number) => number }

export function circle(cx: number, cy: number, r: number): Shape {
  return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, d: (x, y) => Math.hypot(x - cx, y - cy) - r }
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): Shape {
  const m = Math.min(rx, ry)

  return {
    x0: cx - rx,
    y0: cy - ry,
    x1: cx + rx,
    y1: cy + ry,
    d: (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * m,
  }
}

export function box(x: number, y: number, w: number, h: number, r = 0): Shape {
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

export function capsule(ax: number, ay: number, bx: number, by: number, r: number): Shape {
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

export function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Shape {
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

export function union(...shapes: Shape[]): Shape {
  return {
    x0: Math.min(...shapes.map(s => s.x0)),
    y0: Math.min(...shapes.map(s => s.y0)),
    x1: Math.max(...shapes.map(s => s.x1)),
    y1: Math.max(...shapes.map(s => s.y1)),
    d: (x, y) => Math.min(...shapes.map(s => s.d(x, y))),
  }
}

// `a` where `b` is not.
export function minus(a: Shape, b: Shape): Shape {
  return { ...a, d: (x, y) => Math.max(a.d(x, y), -b.d(x, y)) }
}

// `a` only where `b` is.
export function within(a: Shape, b: Shape): Shape {
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    d: (x, y) => Math.max(a.d(x, y), b.d(x, y)),
  }
}

// A line of width `w` along the shape's edge.
export function outline(s: Shape, w: number): Shape {
  return { x0: s.x0 - w, y0: s.y0 - w, x1: s.x1 + w, y1: s.y1 + w, d: (x, y) => Math.abs(s.d(x, y)) - w / 2 }
}

// The upper half of a ring.
export function arch(cx: number, cy: number, r: number, w: number): Shape {
  return {
    x0: cx - r - w,
    y0: cy - r - w,
    x1: cx + r + w,
    y1: cy,
    d: (x, y) => Math.max(Math.abs(Math.hypot(x - cx, y - cy) - r) - w / 2, y - cy),
  }
}

// --- The print ----------------------------------------------------------------

export type Paint = {
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

export class Print {
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
export function keyed(p: Print, shape: Shape, color: number, paint: Paint = {}): void {
  p.fill(shape, color, { grain: true, ...paint })
  p.fill(outline(shape, 0.11), KEY, { dx: 0.06, dy: 0.05, alpha: 0.85 })
}
