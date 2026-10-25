// Writes hooks/stars.ts: the stars the real sky shows, from the Yale Bright
// Star Catalogue (J2000; precession to now is well under a degree). Keeps
// every star of magnitude 3.5 or brighter and every star a constellation in
// hooks/constellations.ts draws, and fails if one of those is missing.
//
//   node tools/stars/build.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'https://raw.githubusercontent.com/brettonw/YaleBrightStarCatalog/master/bsc5-short.json'
const LIMIT = 3.5
const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

const drawn = new Set([...readFileSync(join(root, 'hooks/constellations.ts'), 'utf8').matchAll(/\[(\d+), (\d+)\]/g)].flatMap(m => [Number(m[1]), Number(m[2])]))

const hours = text => {
  const [h, m, s] = text.match(/[\d.]+/g).map(Number)
  return (h + m / 60 + s / 3600) * 15
}
const degrees = text => {
  const [d, m, s] = text.match(/[\d.]+/g).map(Number)
  return (text.trim().startsWith('-') ? -1 : 1) * (d + m / 60 + s / 3600)
}
// B−V from a temperature (Ballesteros 2012), solved for B−V.
const bv = kelvin => {
  const a = kelvin / 4600
  const b = 2.32 * a - 2
  const c = 1.054 * a - 2.32
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) / 0.92
}

const response = await fetch(URL)
if (!response.ok) throw new Error(`${URL}: ${response.status}`)
const catalogue = await response.json()
const stars = catalogue
  .filter(s => s.RA && s.Dec && s.V && (Number(s.V) <= LIMIT || drawn.has(Number(s.HR))))
  .map(s => [Number(s.HR), +hours(s.RA).toFixed(3), +degrees(s.Dec).toFixed(3), Number(s.V), +bv(Number(s.K) || 5800).toFixed(2)])
const missing = [...drawn].filter(hr => !stars.some(s => s[0] === hr))
if (missing.length > 0) throw new Error(`not in the catalogue: ${missing.join(', ')}`)

const rows = stars.map(s => `  [${s.join(', ')}],`).join('\n')
writeFileSync(
  join(root, 'hooks/stars.ts'),
  `// Written by tools/stars/build.mjs from the Yale Bright Star Catalogue: do not edit.
// [HR number, right ascension °, declination ° (J2000), V magnitude, B−V]
export const STARS: readonly (readonly [number, number, number, number, number])[] = [
${rows}
]
`,
)
console.log(`${stars.length} stars`)
