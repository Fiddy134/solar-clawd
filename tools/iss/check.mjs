// Checks hooks/iss.ts against satellite.js (SGP4) for the current ISS
// elements: the largest error over 24 hours from epoch, and five reference
// moments over Stockholm (one on a visible pass) for the test's fixture.
//
//   tools/iss/check.sh

import { STOCKHOLM, sunAt } from '../../hooks/astro.ts'
import { elementsOf, issAt } from '../../hooks/iss.ts'
import * as satellite from 'satellite.js'

const BASE = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT='
const json = await (await fetch(`${BASE}json`)).json()
const [, line1, line2] = (await (await fetch(`${BASE}tle`)).text()).trim().split('\n').map(line => line.trim())
const satrec = satellite.twoline2satrec(line1, line2)
const observer = { longitude: satellite.degreesToRadians(STOCKHOLM.lon), latitude: satellite.degreesToRadians(STOCKHOLM.lat), height: 0.03 }
const RAD = Math.PI / 180

// SGP4's elevation and azimuth (degrees, from north) from Stockholm.
function reference(ms) {
  const date = new Date(ms)
  const { position } = satellite.propagate(satrec, date)
  const look = satellite.ecfToLookAngles(observer, satellite.eciToEcf(position, satellite.gstime(date)))
  return { elevation: look.elevation / RAD, azimuth: ((look.azimuth / RAD) % 360 + 360) % 360 }
}

// Whether the ISS is out of Earth's shadow (a cylinder behind the Earth,
// away from the sun), from SGP4's position and a low-precision sun.
function isSunlit(ms) {
  const { position: p } = satellite.propagate(satrec, new Date(ms))
  const d = ms / 86_400_000 - 10957.5
  const g = (357.529 + 0.98560028 * d) * RAD
  const l = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const tilt = (23.439 - 0.00000036 * d) * RAD
  const sun = [Math.cos(l), Math.cos(tilt) * Math.sin(l), Math.sin(tilt) * Math.sin(l)]
  const along = p.x * sun[0] + p.y * sun[1] + p.z * sun[2]
  const off = Math.hypot(p.x - along * sun[0], p.y - along * sun[1], p.z - along * sun[2])
  return along > 0 || off > 6371
}

const epochMs = Date.parse(`${json[0].EPOCH}Z`)
let ours = null
try {
  ours = elementsOf(json)
} catch {
  console.log('hooks/iss.ts is not written yet: reference only')
}

let worst = 0
const passes = []
for (let ms = epochMs; ms < epochMs + 72 * 3_600_000; ms += 60_000) {
  const want = reference(ms)
  if (want.elevation > 10 && sunAt(ms).elevation < -6 && isSunlit(ms)) passes.push(ms)
  if (!ours || ms > epochMs + 24 * 3_600_000) continue
  const got = issAt(ours, ms, STOCKHOLM)
  if (want.elevation < -5) continue
  const dAz = Math.abs(((got.azimuth - want.azimuth + 540) % 360) - 180) * Math.cos(want.elevation * RAD)
  worst = Math.max(worst, Math.hypot(got.elevation - want.elevation, dAz))
}
if (ours) console.log(`largest error over 24 h (ISS above -5°): ${worst.toFixed(2)}°`)

// Five moments: three spread over the day with the ISS up, two on a pass in the dark.
const up = []
for (let ms = epochMs + 3_600_000; ms < epochMs + 24 * 3_600_000 && up.length < 3; ms += 60_000) {
  if (reference(ms).elevation > 10 && (up.length === 0 || ms - up[up.length - 1] > 90 * 60_000)) up.push(ms)
}
const moments = [...up, ...passes.slice(0, 2)]
console.log('OMM:', JSON.stringify(json[0]))
console.log('visible passes (ISS above 10° and sunlit, sun below -6°), 72 h:', passes.length, passes.slice(0, 3).map(ms => new Date(ms).toISOString()))
for (const ms of moments) {
  const r = reference(ms)
  console.log(`[${ms}, ${r.elevation.toFixed(2)}, ${r.azimuth.toFixed(2)}], // ${new Date(ms).toISOString()}${passes.includes(ms) ? ' visible' : ''}`)
}
