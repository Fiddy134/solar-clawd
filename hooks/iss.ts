// The International Space Station from its orbital elements (CelesTrak's
// OMM JSON): where it stands from a place, and when it is the bright point
// worth showing, high enough, the sky dark and the station in sunlight.
//
// A Kepler orbit with the Earth's flattening (J2) turning its plane and
// perigee, and its decay from MEAN_MOTION_DOT: within a day of epoch it
// keeps to SGP4 within a degree or so (tools/iss/check.sh), which a sky
// needs, not a telescope.

import { gmstDegrees, sunAt, sunDirection } from './astro'
import type { Place } from './astro'
import { domePoint } from './dome'
import type { DomePoint } from './dome'

export type Elements = {
  epochMs: number
  // Revolutions a day, and its change (half the rate, rev/day², as TLEs give it).
  meanMotion: number
  meanMotionDot: number
  eccentricity: number
  // Degrees.
  inclination: number
  raan: number
  argPerigee: number
  meanAnomaly: number
}

// Older elements than this show no ISS: they would put it in the wrong place.
export const ELEMENTS_MAX_AGE_MS = 259_200_000

const RAD = Math.PI / 180
const MU = 398600.4418
const EARTH_KM = 6378.137
const J2 = 1.08262668e-3
const FLATTENING = 0.00669438
// sqrt(GM) in Earth radii per minute, as SGP4 has it.
const XKE = 60 / Math.sqrt(EARTH_KM ** 3 / MU)

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// The ISS's elements from CelesTrak's answer, or null for anything else.
export function elementsOf(json: unknown): Elements | null {
  const rows: unknown[] = Array.isArray(json) ? json : [json]
  const row = rows.find(r => typeof r === 'object' && r !== null && (r as Record<string, unknown>).NORAD_CAT_ID === 25544) as
    | Record<string, unknown>
    | undefined
  if (!row || typeof row.EPOCH !== 'string') return null
  // Milliseconds at most: not every engine reads microseconds.
  const epochMs = Date.parse(`${row.EPOCH.replace(/(\.\d{3})\d*/, '$1')}Z`)
  const values = [row.MEAN_MOTION, row.ECCENTRICITY, row.INCLINATION, row.RA_OF_ASC_NODE, row.ARG_OF_PERICENTER, row.MEAN_ANOMALY].map(finite)
  if (!Number.isFinite(epochMs) || values.some(v => v === null)) return null
  const [meanMotion, eccentricity, inclination, raan, argPerigee, meanAnomaly] = values as number[]

  return { epochMs, meanMotion: meanMotion!, meanMotionDot: finite(row.MEAN_MOTION_DOT) ?? 0, eccentricity: eccentricity!, inclination: inclination!, raan: raan!, argPerigee: argPerigee!, meanAnomaly: meanAnomaly! }
}

// The station's position in equatorial coordinates (km) at `ms`. The
// elements' mean motion is Kozai's, as SGP4 reads it: recovered to
// Brouwer's first, so the J2 drift is not counted twice.
function position(el: Elements, ms: number): [number, number, number] {
  const days = (ms - el.epochMs) / 86_400_000
  const minutes = days * 1440
  const e = el.eccentricity
  const i = el.inclination * RAD
  const cos2 = Math.cos(i) ** 2
  const beta2 = 1 - e * e
  const beta = Math.sqrt(beta2)
  const k2 = 0.5 * J2
  const kozai = (el.meanMotion * 2 * Math.PI) / 1440
  const a1 = (XKE / kozai) ** (2 / 3)
  const d1 = (1.5 * k2 * (3 * cos2 - 1)) / (a1 * a1 * beta * beta2)
  const a0 = a1 * (1 - d1 * (1 / 3 + d1 * (1 + (134 / 81) * d1)))
  const d0 = (1.5 * k2 * (3 * cos2 - 1)) / (a0 * a0 * beta * beta2)
  const n = kozai / (1 + d0)
  const a = (a0 / (1 - d0)) * EARTH_KM
  // The secular drifts, per minute.
  const t1 = (3 * k2 * n) / (((a / EARTH_KM) * beta2) ** 2)
  const raan = el.raan * RAD - t1 * Math.cos(i) * minutes
  const argp = el.argPerigee * RAD - 0.5 * t1 * (1 - 5 * cos2) * minutes
  const meanAnomaly = el.meanAnomaly * RAD + (n + 0.5 * t1 * beta * (3 * cos2 - 1)) * minutes + 2 * Math.PI * el.meanMotionDot * days * days
  let E = meanAnomaly
  for (let step = 0; step < 8; step++) E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E))
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
  const r = a * (1 - e * Math.cos(E))
  const u = argp + nu

  return [
    r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(i)),
    r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(i)),
    r * Math.sin(u) * Math.sin(i),
  ]
}

// Where the station stands from `place` (degrees, azimuth from north), and
// whether the sun lights it: out of the Earth's shadow, a cylinder behind it.
export function issAt(el: Elements, ms: number, place: Place): { elevation: number; azimuth: number; isSunlit: boolean } {
  const [x, y, z] = position(el, ms)
  const theta = gmstDegrees(ms) * RAD
  const sx = x * Math.cos(theta) + y * Math.sin(theta)
  const sy = -x * Math.sin(theta) + y * Math.cos(theta)
  const phi = place.lat * RAD
  const lambda = place.lon * RAD
  const N = EARTH_KM / Math.sqrt(1 - FLATTENING * Math.sin(phi) ** 2)
  const rx = sx - N * Math.cos(phi) * Math.cos(lambda)
  const ry = sy - N * Math.cos(phi) * Math.sin(lambda)
  const rz = z - N * (1 - FLATTENING) * Math.sin(phi)
  const south = Math.sin(phi) * Math.cos(lambda) * rx + Math.sin(phi) * Math.sin(lambda) * ry - Math.cos(phi) * rz
  const east = -Math.sin(lambda) * rx + Math.cos(lambda) * ry
  const up = Math.cos(phi) * Math.cos(lambda) * rx + Math.cos(phi) * Math.sin(lambda) * ry + Math.sin(phi) * rz
  const range = Math.hypot(rx, ry, rz)
  const sun = sunDirection(ms)
  const along = x * sun[0] + y * sun[1] + z * sun[2]
  const off = Math.hypot(x - along * sun[0], y - along * sun[1], z - along * sun[2])

  return {
    elevation: Math.asin(up / range) / RAD,
    azimuth: ((Math.atan2(east, -south) / RAD) % 360 + 360) % 360,
    isSunlit: along > 0 || off > EARTH_KM,
  }
}

// The station on the dome while it is worth looking up for, with where it
// was 20 s before (its trail); null otherwise, or from missing or old elements.
export function issVisible(el: Elements | null, ms: number, place: Place): { at: DomePoint; trail: DomePoint } | null {
  if (!el || Math.abs(ms - el.epochMs) > ELEMENTS_MAX_AGE_MS) return null
  const now = issAt(el, ms, place)
  if (now.elevation <= 10 || !now.isSunlit || sunAt(ms, place.lat, place.lon).elevation >= -6) return null

  return { at: domePoint(now), trail: domePoint(issAt(el, ms - 20_000, place)) }
}
