// The real stars and a few constellations, where they stand on the dome at a
// moment, and sorted into tiles so the shader looks at only the few stars
// near each pixel instead of all of them.

import { horizontalAt } from './astro'
import type { Place } from './astro'
import { CONSTELLATIONS } from './constellations'
import { domePoint, HORIZON } from './dome'
import type { DomePoint } from './dome'
import { STARS } from './stars'

export { CONSTELLATIONS }

export type ChartStar = DomePoint & { mag: number; bv: number }

// The tiles: TILE heights square, covering x from TILE_LEFT (windows up to
// 3.2 times as wide as tall) and y from the top down to the horizon.
export const TILE = 0.04
export const TILE_LEFT = -1.6
export const TILE_COLUMNS = 80
export const TILE_ROWS = 16

const BY_HR = new Map(STARS.map((star, i) => [star[0], i]))

// The stars above the horizon and within the window's top, and the
// constellations' lines whose both ends are.
export function chartAt(ms: number, place: Place): { stars: ChartStar[]; lines: [DomePoint, DomePoint][] } {
  const points = STARS.map(([, ra, dec]) => {
    const sky = horizontalAt(ra, dec, ms, place.lat, place.lon)
    if (sky.elevation <= 0) return null
    const at = domePoint(sky)

    return at.y >= 0 && at.y <= HORIZON ? at : null
  })
  const stars = STARS.flatMap(([, , , mag, bv], i) => (points[i] ? [{ ...points[i]!, mag, bv }] : []))
  const lines = Object.values(CONSTELLATIONS).flatMap(pairs =>
    pairs.flatMap(([a, b]) => {
      const from = points[BY_HR.get(a) ?? -1]
      const to = points[BY_HR.get(b) ?? -1]

      return from && to ? [[from, to] as [DomePoint, DomePoint]] : []
    }),
  )

  return { stars, lines }
}

export type Tiles = { start: number[]; count: number[]; index: number[] }

function tileRange(x0: number, x1: number, y0: number, y1: number): number[] {
  const column = (x: number) => Math.floor((x - TILE_LEFT) / TILE)
  const row = (y: number) => Math.min(TILE_ROWS - 1, Math.floor(y / TILE))
  const tiles: number[] = []
  for (let r = Math.max(0, row(y0)); r <= Math.min(TILE_ROWS - 1, row(y1)); r++) {
    for (let c = Math.max(0, column(x0)); c <= Math.min(TILE_COLUMNS - 1, column(x1)); c++) tiles.push(r * TILE_COLUMNS + c)
  }

  return tiles
}

// Each item's index in every tile `tilesOf` gives it, as the shader reads
// them: a start and a count per tile (row by row) into one list.
function tiled<T>(items: readonly T[], tilesOf: (item: T) => number[]): Tiles {
  const buckets: number[][] = Array.from({ length: TILE_COLUMNS * TILE_ROWS }, () => [])
  items.forEach((item, i) => {
    for (const tile of tilesOf(item)) buckets[tile]!.push(i)
  })
  const start: number[] = []
  const index: number[] = []
  for (const bucket of buckets) {
    start.push(index.length)
    index.push(...bucket)
  }

  return { start, count: buckets.map(bucket => bucket.length), index }
}

// Each star in the tile that holds it.
export function tileStars(stars: readonly DomePoint[]): Tiles {
  return tiled(stars, s => tileRange(s.x, s.x, s.y, s.y))
}

// Each line in every tile its box, and half a tile around it, touches.
export function tileLines(lines: readonly [DomePoint, DomePoint][]): Tiles {
  const m = TILE / 2

  return tiled(lines, ([a, b]) => tileRange(Math.min(a.x, b.x) - m, Math.max(a.x, b.x) + m, Math.min(a.y, b.y) - m, Math.max(a.y, b.y) + m))
}
