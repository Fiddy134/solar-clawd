// The sky as numbers: the sun and the moon, events, the Swedish days, the
// ISS, the shader's text.

import { expect, test } from 'claude-code/testing'

import { horizontalAt, localTime, moonAt, occasionAt, STOCKHOLM, sunAt, swedishClock, swedishOffsetMs } from './astro'
import { EVENT_WORDS, EVENTS, eventsAt, shootingRate, specsOf, wordsOf } from './events'
import { domePoint, HORIZON, ZENITH_Y } from './dome'
import type { DomePoint } from './dome'
import { chartAt, TILE, tileLines, tileStars } from './chart'
import { animationOf, WAITING_MS, WAITING_SWEEP_MS, WAITING_URGENT_MS, waitingAt } from './waiting'
import { elementsOf, issAt, issVisible } from './iss'
import { asPace, AWAY_MS, canTick, FULL_STILL_MS, skyRules, versionOf } from './pace'
import { staleFiles } from './tidy'
import { DEFAULT_TUNE, NEUTRAL } from './tune'
import { shaderParams, skyShader } from './shader'
import { BASKET } from './glsl/basket'
import { COMMON } from './glsl/common'
import { PROTOTYPES } from './glsl/prototypes'
import { BASE_THEME, THEMES } from './themes/index'
import { contextFor, ISS_OMM, ISS_REFERENCE, ISS_PASS, swedish, DAY_KINDS, daysAt, kindsAt, someMinute } from './test-kit'

const FYR = THEMES[BASE_THEME]

test('Swedish time follows summer and winter time', () => {
  // 2026-10-24 is still CEST (+2), 2026-12-01 is CET (+1).
  expect(swedishClock(Date.UTC(2026, 9, 24, 10, 0))).toEqual({ hour: 12, minute: 0 })
  expect(swedishClock(Date.UTC(2026, 11, 1, 10, 0))).toEqual({ hour: 11, minute: 0 })
})

test('the sun and the moon stand where they do over Stockholm', () => {
  expect(Math.round(sunAt(Date.UTC(2026, 5, 21, 11, 0)).elevation)).toBe(54)
  expect(sunAt(Date.UTC(2026, 11, 21, 0, 0)).elevation).toBeLessThan(-40)
  // Full moon on 2026-10-26.
  expect(moonAt(Date.UTC(2026, 9, 26, 4, 0)).illumination).toBeGreaterThan(0.97)
})

test('holidays fall on their days', () => {
  const at = (y: number, m: number, d: number, h = 12) => occasionAt(localTime(Date.UTC(y, m - 1, d, h - 1)))
  expect(at(2026, 12, 13)).toBe('lucia')
  expect(at(2026, 12, 24)).toBe('christmas')
  expect(at(2026, 6, 19)).toBe('midsummer')
  expect(at(2027, 2, 9)).toBe('semla')
  expect(at(2026, 10, 25)).toBe(null)
})

test('the sky shader is the same text for the same scene, its constants baked in', () => {
  const snowyNight = { temperature: -2, code: 71, cloudCover: 60, wind: 3 }
  const input = { ms: Date.UTC(2026, 9, 24, 20, 0), t: 0, place: STOCKHOLM, weather: snowyNight, kp: 5 }
  const options = {}
  const shader = skyShader(shaderParams(input, options), FYR)
  // Within the same two minutes, nothing to reload.
  expect(skyShader(shaderParams({ ...input, ms: input.ms + 30_000 }, options), FYR)).toBe(shader)
  expect(skyShader(shaderParams({ ...input, ms: input.ms + 180_000 }, options), FYR)).not.toBe(shader)
  expect(shader).toContain('const float IS_DAY = 0.0;')
  expect(shader).toContain('const int PRECIPITATION = 4;')
  expect(shader).toContain('const int DEMO_COUNT = 0;')
  expect(shader).toContain('void mainImage(out vec4 fragColor, in vec2 fragCoord)')
  expect(skyShader(shaderParams({ ...input, ms: Date.UTC(2026, 9, 24, 11) }, options), FYR)).toContain('const float IS_DAY = 1.0;')
  // A demo bakes in the whole day, played with iTime.
  expect(skyShader(shaderParams(input, { ...options, demo: { seconds: 48 } }), FYR)).toContain('const int DEMO_COUNT = 96;')
  // The lighter sky, on battery or with the person away, leaves the clouds out.
  expect(shader).toContain('const float LIGHT = 0.0;')
  expect(skyShader(shaderParams(input, { ...options, isLight: true }), FYR)).toContain('const float LIGHT = 1.0;')
  expect(shader).toContain('if (LIGHT < 0.5) sky = clouds(')
})

test('events are a pure function of time: the same moment, the same events', () => {
  const ms = Date.UTC(2026, 6, 4, 10, 0)
  for (let m = 0; m < 600; m += 7) {
    const at = ms + m * 60_000
    expect(eventsAt(at, contextFor(at))).toEqual(eventsAt(at, contextFor(at)))
  }
})

test('events keep to their conditions and come about as often as they should', () => {
  const count = (kind: string, from: number, days: number, weather?: Parameters<typeof contextFor>[1]) => {
    const seen = new Set<number>()
    for (let at = from; at < from + days * 86_400_000; at += 30_000) {
      for (const event of eventsAt(at, contextFor(at, weather))) if (event.kind === kind) seen.add(event.start)
    }
    return seen.size
  }
  const july = Date.UTC(2026, 6, 1)
  // Balloons fly by day in light wind, never at night, never in a gale.
  for (const event of [Date.UTC(2026, 6, 4, 0, 30), Date.UTC(2026, 6, 4, 23, 0)].flatMap(at => eventsAt(at, contextFor(at)))) {
    expect(event.kind).not.toBe('balloon')
  }
  expect(count('balloon', july, 10, { temperature: 20, code: 0, cloudCover: 5, wind: 14 })).toBe(0)
  // About one balloon every third hour of a long summer day, a plane an hour.
  const balloons = count('balloon', july, 10)
  expect(balloons).toBeGreaterThan(30)
  expect(balloons).toBeLessThan(70)
  const planes = count('plane', july, 10)
  expect(planes).toBeGreaterThan(120)
  expect(planes).toBeLessThan(200)
  // A comet now and then, not every week.
  const comets = count('comet', Date.UTC(2026, 0, 1), 365, { temperature: 0, code: 0, cloudCover: 0, wind: 2 })
  expect(comets).toBeGreaterThan(2)
  expect(comets).toBeLessThan(9)
})

// Pinned before the dolphins left the engine's list for the theme fyr:
// every event of a fortnight of slots, under three weathers, at the same
// start and in the same order as then.
test('the schedule is as it was: a fortnight under three weathers, the same events in the same order', () => {
  const schedule = (at: number, ctx: ReturnType<typeof contextFor>) => eventsAt(at, ctx, [], [...EVENTS, ...specsOf(FYR)])
  const weathers = [undefined, { temperature: 8, code: 61, cloudCover: 90, wind: 4 }, { temperature: 10, code: 2, cloudCover: 40, wind: 8 }]
  const from = Date.UTC(2026, 9, 20)
  const kinds = new Set<string>()
  // FNV-1a over each moment's list, kind and start, in order.
  let digest = 0x811c9dc5
  const add = (text: string) => {
    for (let i = 0; i < text.length; i++) digest = Math.imul(digest ^ text.charCodeAt(i), 0x01000193) >>> 0
  }
  for (const weather of weathers) {
    for (let at = from; at < from + 14 * 86_400_000; at += 60_000) {
      for (const event of schedule(at, contextFor(at, weather))) {
        kinds.add(event.kind)
        add(`${event.kind}@${event.start};`)
      }
      add('\n')
    }
  }
  expect(kinds.has('dolphin')).toBe(true)
  expect(kinds.has('pinkDolphin')).toBe(true)
  expect(digest.toString(16)).toBe('61c0e64b')
})

test('a rainbow needs the sun out after rain', () => {
  const afternoon = Date.UTC(2026, 6, 4, 15, 0)
  const sunny = { temperature: 18, code: 1, cloudCover: 30, wind: 3 }
  expect(eventsAt(afternoon, contextFor(afternoon, sunny, afternoon - 10 * 60_000)).some(e => e.kind === 'rainbow')).toBe(true)
  expect(eventsAt(afternoon, contextFor(afternoon, sunny, null)).some(e => e.kind === 'rainbow')).toBe(false)
  expect(eventsAt(afternoon, contextFor(afternoon, { ...sunny, code: 63 }, afternoon)).some(e => e.kind === 'rainbow')).toBe(false)
  const night = Date.UTC(2026, 6, 4, 23, 30)
  expect(eventsAt(night, contextFor(night, sunny, night - 60_000)).some(e => e.kind === 'rainbow')).toBe(false)
})

test('shooting stars on clear nights, a shower in August and December', () => {
  expect(shootingRate(contextFor(Date.UTC(2026, 6, 4, 12)))).toBe(0)
  expect(shootingRate(contextFor(Date.UTC(2026, 9, 25, 23)))).toBe(2)
  expect(shootingRate(contextFor(Date.UTC(2026, 9, 25, 23), { temperature: 5, code: 3, cloudCover: 100, wind: 3 }))).toBe(0)
  expect(shootingRate(contextFor(Date.UTC(2026, 7, 12, 23)))).toBe(10)
  expect(shootingRate(contextFor(Date.UTC(2026, 11, 13, 23)))).toBe(10)
})

test('a forced event plays for its length whatever the sky, and every event has a word', () => {
  const noon = Date.UTC(2026, 6, 4, 12, 0)
  const forced = [{ kind: 'comet' as const, at: noon }]
  expect(eventsAt(noon + 5_000, contextFor(noon + 5_000), forced).some(e => e.kind === 'comet')).toBe(true)
  expect(eventsAt(noon + 3_600_000, contextFor(noon + 3_600_000), forced).some(e => e.kind === 'comet')).toBe(false)
  for (const spec of EVENTS) expect(spec.word.length).toBeGreaterThan(2)
})

test('tidying takes only our own old files, never those of this session', () => {
  const now = Date.UTC(2026, 9, 25, 12)
  const old = now - 2 * 3_600_000
  const fresh = now - 10 * 60_000
  const id = '0F8E2C1A-1111-4A4A-9B9B-123456789ABC'
  const entry = (name: string, mtimeMs: number, kind: 'file' | 'dir' = 'file') => ({ name, kind, size: 1, mtimeMs, isLink: false })
  const entries = [
    entry(`${id}-0.png`, old),
    entry(`${id}-1.png`, old),
    entry('7A1B2C3D-2222-4B4B-8C8C-ABCDEF012345-0.png', old),
    entry('7A1B2C3D-2222-4B4B-8C8C-ABCDEF012345-1.png', fresh),
    entry('sky-1234.png', old),
    entry('alive-old-session', old),
    entry('alive-live-session', fresh),
    entry('waiting-old-session', old),
    entry('photo.png', old),
    entry('notes-0.png', old),
    entry('sky.glsl', old),
    entry('solar-clawd.ghostty', old),
    entry('sky-dir.png', old, 'dir'),
  ]
  expect(staleFiles(entries, '/cache', now, [id, 'alive-live-session']).sort()).toEqual([
    '/cache/7A1B2C3D-2222-4B4B-8C8C-ABCDEF012345-0.png',
    '/cache/alive-old-session',
    '/cache/sky-1234.png',
    '/cache/waiting-old-session',
  ])
})

test('a rainbow needs rain that has been, not rain still to come', () => {
  const ms = Date.UTC(2026, 5, 24, 16)
  const clear = { temperature: 18, code: 1, cloudCover: 30, wind: 3 }
  expect(eventsAt(ms, contextFor(ms, clear, ms - 600_000)).some(e => e.kind === 'rainbow')).toBe(true)
  expect(eventsAt(ms, contextFor(ms, clear, ms + 600_000)).some(e => e.kind === 'rainbow')).toBe(false)
})

test('every event fits in its slot', () => {
  for (const spec of EVENTS) expect(spec.durationMs).toBeLessThan(spec.slotMs)
})

test('tidying takes the temp files a crashed write left, and no one else\'s', () => {
  const now = Date.UTC(2026, 9, 25, 12)
  const entry = (name: string, mtimeMs: number) => ({ name, kind: 'file' as const, size: 1, mtimeMs, isLink: false })
  const entries = [
    entry('sky.glsl.tmp-old-session', now - 2 * 3_600_000),
    entry('solar-clawd.ghostty.tmp-old-session', now - 2 * 3_600_000),
    entry('sky.glsl.tmp-live-session', now - 60_000),
    entry('notes.txt.tmp-old-session', now - 2 * 3_600_000),
    entry('vsync.ghostty.tmp-old-session', now - 2 * 3_600_000),
    entry('vsync.ghostty', now - 2 * 3_600_000),
  ]
  expect(staleFiles(entries, '/runtime', now, []).sort()).toEqual([
    '/runtime/sky.glsl.tmp-old-session',
    '/runtime/solar-clawd.ghostty.tmp-old-session',
    '/runtime/vsync.ghostty.tmp-old-session',
  ])
})

test('the dome: south horizon at the horizon line, east left, Polaris high in the north', () => {
  const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)
  near(domePoint({ elevation: 0, azimuth: 180 }).y, HORIZON)
  near(domePoint({ elevation: 0, azimuth: 180 }).x, 0)
  near(domePoint({ elevation: 90, azimuth: 0 }).y, ZENITH_Y)
  expect(domePoint({ elevation: 0, azimuth: 90 }).x).toBeLessThan(0)
  expect(domePoint({ elevation: 0, azimuth: 270 }).x).toBeGreaterThan(0)
  // Polaris (RA 37.95°, Dec 89.26°) from Stockholm: north, about 59° up.
  const polaris = horizontalAt(37.95, 89.26, Date.UTC(2026, 9, 24, 20), STOCKHOLM.lat, STOCKHOLM.lon)
  expect(Math.abs(polaris.elevation - 59.3)).toBeLessThan(1.2)
  const at = domePoint(polaris)
  expect(Math.abs(at.x)).toBeLessThan(0.02)
  expect(at.y).toBeGreaterThan(0)
  expect(at.y).toBeLessThan(ZENITH_Y)
})

test('the moon stands where it is, and is gone below the horizon', () => {
  const up = Date.UTC(2026, 9, 24, 20)
  const params = shaderParams({ ms: up, t: 0, place: STOCKHOLM, weather: null }, {})
  const moon = moonAt(up, STOCKHOLM.lat, STOCKHOLM.lon)
  expect(moon.elevation).toBeGreaterThan(5)
  expect(Math.abs(params.moon.at!.x - domePoint(moon).x)).toBeLessThan(0.002)
  expect(Math.abs(params.moon.at!.y - domePoint(moon).y)).toBeLessThan(0.002)
  const down = Date.UTC(2026, 9, 24, 8)
  expect(shaderParams({ ms: down, t: 0, place: STOCKHOLM, weather: null }, {}).moon.at).toBeNull()
  expect(skyShader(params, FYR)).toContain('const vec2 MOON_AT')
})

test('the chart: Orion south on a January night, Vega overhead in August, Polaris always', () => {
  const january = chartAt(Date.UTC(2026, 0, 15, 21), STOCKHOLM) // 22:00 local
  const betelgeuse = january.stars.find(s => s.mag < 0.6 && s.bv > 1.5)!
  expect(Math.abs(betelgeuse.x)).toBeLessThan(0.35)
  expect(betelgeuse.y).toBeGreaterThan(ZENITH_Y)
  const august = chartAt(Date.UTC(2026, 7, 15, 21), STOCKHOLM) // 23:00 local
  const vega = august.stars.find(s => s.mag < 0.1 && s.bv < 0.1)!
  expect(Math.hypot(vega.x, vega.y - ZENITH_Y)).toBeLessThan(0.12)
  expect(january.lines.length).toBeGreaterThan(5)
})

test('a southern sky charts without Polaris, and every star sits in its own tile', () => {
  const cape = chartAt(Date.UTC(2026, 5, 1, 20), { name: 'Kapstaden', lat: -33.9, lon: 18.4 })
  expect(cape.stars.length).toBeGreaterThan(20)
  for (const s of cape.stars) expect(s.y >= 0 && s.y <= HORIZON).toBe(true)
  const { stars, lines } = chartAt(Date.UTC(2026, 0, 15, 21), STOCKHOLM)
  const tiles = tileStars(stars)
  expect(tiles.start.length).toBe(80 * 16)
  stars.forEach((s, i) => {
    if (Math.abs(s.x) >= 1.6) return
    const tile = Math.min(15, Math.floor(s.y / TILE)) * 80 + Math.floor((s.x + 1.6) / TILE)
    const own = tiles.index.slice(tiles.start[tile], tiles.start[tile]! + tiles.count[tile]!)
    expect(own).toContain(i)
  })
  // A line is listed in the tile under its midpoint.
  const lineTiles = tileLines(lines)
  lines.forEach(([a, b], i) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    if (Math.abs(mx) >= 1.6) return
    const tile = Math.min(15, Math.floor(my / TILE)) * 80 + Math.floor((mx + 1.6) / TILE)
    expect(lineTiles.index.slice(lineTiles.start[tile], lineTiles.start[tile]! + lineTiles.count[tile]!)).toContain(i)
  })
})

test('a night shader carries the real stars, a day shader none', () => {
  const night = skyShader(shaderParams({ ms: Date.UTC(2026, 0, 15, 21), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  expect(Number(/const int STAR_COUNT = (\d+);/.exec(night)?.[1])).toBeGreaterThan(50)
  expect(Number(/const int LINE_COUNT = (\d+);/.exec(night)?.[1])).toBeGreaterThan(5)
  const day = skyShader(shaderParams({ ms: Date.UTC(2026, 5, 15, 10), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  expect(day).toContain('const int STAR_COUNT = 0;')
})

test('the comet hangs at its place among the stars and turns with them', () => {
  const ms = Date.UTC(2026, 9, 24, 20)
  const ctx = contextFor(ms)
  const params = (at: number) => shaderParams({ ms: at, t: 0, place: STOCKHOLM, weather: null }, { events: eventsAt(at, ctx, [{ kind: 'comet', at: ms }]) })
  const now = params(ms).comet!
  const later = params(ms + 80_000).comet! // the same preview, a scene later
  expect(now).not.toBeNull()
  expect(Math.hypot(later.at.x - now.at.x, later.at.y - now.at.y)).toBeGreaterThan(0)
  expect(skyShader(params(ms), FYR)).toContain('const vec2 COMET_AT')
  expect(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, {}).comet).toBeNull()
})

test('the lighthouse: orange when Claude asks, white when done', () => {
  const ms = Date.UTC(2026, 9, 24, 20)
  const text = (options: object) => skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, options), FYR)
  expect(text({})).toContain('const int WAITING = 0;')
  expect(text({ waiting: { mode: 'asking', isUrgent: false } })).toContain('const int WAITING = 1;')
  expect(text({ waiting: { mode: 'done', isUrgent: false } })).toContain('const int WAITING = 2;')
  expect(text({ waiting: { mode: 'asking', isUrgent: true } })).toContain('const float WAITING_URGENT = 1.0;')
  // Claude's waiting is the engine's; the lighthouse is only how fyr shows it.
  expect(text({ waiting: { mode: 'asking', isUrgent: true } })).not.toMatch(/\b(BEACON|BEACON_URGENT|KEEPER_ASLEEP)\b/)
})

test("glass knows Claude Code's own field colours, in linear light on Linux", () => {
  const ms = Date.UTC(2026, 9, 24, 20)
  // The colours the shader is given, back in 0–255 sRGB.
  const fields = (isYUp: boolean) => {
    const text = skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, { isYUp }), FYR)
    const list = /const vec3 FIELD_COLOURS\[(\d+)\] = vec3\[\d+\]\((.*)\);/.exec(text)
    expect(list).not.toBeNull()
    expect(text).toContain(`const int FIELD_COUNT = ${list![1]};`)
    const srgb = (v: number) => (isYUp ? (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) : v)
    return [...list![2]!.matchAll(/vec3\(([\d.]+), ([\d.]+), ([\d.]+)\)/g)].map(m => m.slice(1, 4).map(v => Math.round(srgb(Number(v)) * 255)).join(','))
  }
  // diffRemoved, diffAdded, userMessageBackground, bashMessageBackgroundColor
  // in 2.1.310's dark theme.
  for (const isYUp of [false, true]) {
    for (const colour of ['122,41,54', '34,92,43', '55,55,55', '65,60,65']) expect(fields(isYUp)).toContain(colour)
    // A tool's diff as color-diff prints it, highlighted, in truecolor: its
    // added and removed rows and words, and dark-daltonized's added ones.
    for (const colour of ['2,40,0', '4,71,0', '61,1,0', '92,2,0', '0,27,41', '0,48,71']) expect(fields(isYUp)).toContain(colour)
  }
  // On a Mac Ghostty hands the shader the terminal in Display P3, sRGB
  // colours converted: color-diff's rows as a Ghostty there showed them
  // (2,40,0 and 61,1,0), and the theme's diff. Greys are the same in both.
  for (const colour of ['14,39,5', '55,6,3', '50,91,48']) expect(fields(false)).toContain(colour)
  for (const colour of fields(true)) expect(fields(false)).toContain(colour)
})

test("Claude's waiting: a question beats done, hurries after two minutes, is out after thirty", () => {
  expect(waitingAt([], 0)).toBeNull()
  expect(waitingAt([{ mode: 'done', since: 0 }, { mode: 'asking', since: 50_000 }], 60_000)).toEqual({ mode: 'asking', since: 50_000, isUrgent: false })
  expect(waitingAt([{ mode: 'asking', since: 0 }], WAITING_URGENT_MS)!.isUrgent).toBe(true)
  expect(waitingAt([{ mode: 'done', since: 0 }], 10 * 60_000)!.isUrgent).toBe(false)
  expect(waitingAt([{ mode: 'asking', since: 30_000 }, { mode: 'asking', since: 0 }], 40_000)!.since).toBe(0)
  expect(waitingAt([{ mode: 'asking', since: 0 }], WAITING_MS)).toBeNull()
})

test('Ghostty animates always while the lighthouse sweeps, stands still after it and on battery', () => {
  const waiting = { mode: 'asking' as const, since: 0 }
  expect(animationOf({ waiting, now: 1000, isAway: false, isOnBattery: false, isLively: true })).toBe('always')
  expect(animationOf({ waiting, now: WAITING_SWEEP_MS, isAway: false, isOnBattery: false, isLively: true })).toBe('false')
  expect(animationOf({ waiting, now: 1000, isAway: true, isOnBattery: false, isLively: true })).toBe('false')
  expect(animationOf({ waiting, now: 1000, isAway: false, isOnBattery: true, isLively: true })).toBe('always')
  expect(animationOf({ waiting: null, now: 0, isAway: false, isOnBattery: true, isLively: true })).toBe('false')
  expect(animationOf({ waiting: null, now: 0, isAway: false, isOnBattery: false, isLively: true })).toBe('true')
  expect(animationOf({ waiting: null, now: 0, isAway: true, isOnBattery: false, isLively: true })).toBe('false')
  // Nothing lively up there: still, drawn as the terminal changes.
  expect(animationOf({ waiting: null, now: 0, isAway: false, isOnBattery: false, isLively: false })).toBe('false')
  expect(animationOf({ waiting: { mode: 'asking', since: 0 }, now: 1000, isAway: false, isOnBattery: false, isLively: false })).toBe('always')
})

test('the ISS stands where satellite.js puts it', () => {
  const elements = elementsOf([ISS_OMM])!
  for (const [ms, elevation, azimuth] of ISS_REFERENCE) {
    const got = issAt(elements, ms, STOCKHOLM)
    expect(Math.abs(got.elevation - elevation)).toBeLessThan(1.5)
    expect(Math.abs(((got.azimuth - azimuth + 540) % 360) - 180) * Math.cos((elevation * Math.PI) / 180)).toBeLessThan(1.5)
  }
})

test('the ISS shows only on a visible pass', () => {
  const elements = elementsOf([ISS_OMM])
  expect(issVisible(elements, ISS_PASS, STOCKHOLM)).not.toBeNull()
  expect(issVisible(elements, Date.UTC(2026, 9, 25, 11), STOCKHOLM)).toBeNull()
  expect(issVisible(elements, ISS_REFERENCE[0][0], STOCKHOLM)).toBeNull()
})

test('no ISS from garbage, nothing, or old elements', () => {
  expect(elementsOf('nope')).toBeNull()
  expect(elementsOf([{}])).toBeNull()
  expect(elementsOf(null)).toBeNull()
  expect(issVisible(elementsOf([ISS_OMM]), ISS_PASS + 4 * 86_400_000, STOCKHOLM)).toBeNull()
})

test('the real ISS replaces the scheduled satellite; a preview still shows one', () => {
  const clear = { temperature: 2, code: 0, cloudCover: 0, wind: 2 }
  const start = Date.UTC(2026, 9, 24, 18)
  for (let ms = start; ms < start + 48 * 3_600_000; ms += 60_000) {
    expect(eventsAt(ms, contextFor(ms, clear)).some(e => e.kind === 'satellite')).toBe(false)
  }
  expect(eventsAt(start, contextFor(start, clear), [{ kind: 'satellite', at: start }]).some(e => e.kind === 'satellite')).toBe(true)
})

test('the Swedish days come on their days, in Swedish time', () => {
  // Easter 2026 is 5 April: Maundy Thursday the 2nd.
  expect(someMinute(swedish(2026, 4, 2, 19), swedish(2026, 4, 2, 23), 'witch')).toBe(true)
  expect(kindsAt(swedish(2026, 4, 4, 12))).toContain('feathers')
  expect(kindsAt(swedish(2026, 6, 6, 12))).toContain('flag')
  expect(kindsAt(swedish(2026, 6, 7, 12))).toEqual([])
  expect(kindsAt(swedish(2026, 6, 19, 12))).toContain('maypole')
  expect(kindsAt(swedish(2026, 12, 13, 6))).toContain('luciaTrain')
  expect(kindsAt(swedish(2026, 12, 24, 15, 1))).toContain('sleigh')
  expect(kindsAt(swedish(2026, 12, 24, 12))).toContain('christmasStar')
  expect(daysAt(swedish(2026, 12, 31, 23, 59)).find(e => e.kind === 'fireworks')?.progress).toBe(1)
  expect(kindsAt(swedish(2027, 1, 1, 0, 40))).toEqual([])
})

test('Easter 2027 keeps to Swedish time across the night the clocks change', () => {
  // Easter Sunday 28 March 2027, summer time from 02:00 local (01:00 UTC).
  expect(kindsAt(Date.UTC(2027, 2, 28, 0, 30))).toContain('feathers')
  expect(kindsAt(Date.UTC(2027, 2, 28, 2, 30))).toContain('feathers')
  expect(someMinute(swedish(2027, 3, 25, 19), swedish(2027, 3, 25, 23), 'witch')).toBe(true)
  expect(kindsAt(swedish(2027, 3, 29, 23, 59) + 2 * 60_000)).toEqual([])
})

test('every Swedish day has a word, and /solar event can play it', () => {
  for (const kind of DAY_KINDS) expect(EVENT_WORDS[kind]).toBeTruthy()
  expect(EVENT_WORDS.witch).toBe('easter witch')
  const ms = swedish(2026, 8, 10, 12)
  expect(eventsAt(ms, contextFor(ms), [{ kind: 'witch', at: ms }]).some(e => e.kind === 'witch')).toBe(true)
})

test('the shader glances at the cursor, and never at iDate', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  expect(text).toContain('iCurrentCursor')
  expect(text).toContain('iTimeCursorChange')
  expect(text).not.toContain('iDate')
})

test('confetti is an even rain: it ignores where its loop is', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  const body = /vec3 confetti\([^)]*\) \{[\s\S]*?\n\}/.exec(text)?.[0] ?? ''
  expect(body).not.toBe('')
  expect(body).not.toMatch(/float t\b/)
  expect(body).not.toMatch(/[^\w.]t \*|\(t\b|, t\)/)
})

test('the dolphin, the leaves and the feathers share one smin and one tumble, in the common part', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  expect(text.match(/float smin\(/g)).toHaveLength(1)
  expect(text.indexOf('float smin(')).toBeLessThan(text.indexOf('float dolphinShape('))
  expect(text.match(/vec2 tumble\(/g)).toHaveLength(1)
})

test('the parts share pitch, night, keyInk and the key plate from COMMON, each defined once', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  const helpers = ['float pitch(', 'float night(', 'vec3 keyInk(', 'vec2 keyShift(', 'vec3 keyPlate(', 'float box(', 'vec3 nightInk(']
  for (const helper of [...helpers, 'float noise2(', 'float fbm(', 'float steam(', 'vec3 lamp(', 'int spriteAt(', 'vec3 sprite(']) {
    expect(COMMON).toContain(helper)
    expect(text.split(helper)).toHaveLength(2)
  }
  // Written out anywhere else, each would be a copy that can drift.
  const outside = text.replace(COMMON, '') + BASKET
  for (const copy of ['max(3.0, u * 0.24)', 'max(3.0, unit * 0.24)', 'nightness(sceneNow().elevation)', 'lift(INK_INDIGO, k)']) {
    expect(outside).not.toContain(copy)
  }
})

test('the sky draws its scenery, resident and theme events through four prototypes', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  expect(text).toContain(`${COMMON}\n${PROTOTYPES}`)
  const main = /void mainImage\([^)]*\) \{[\s\S]*?\n\}/.exec(text)?.[0] ?? ''
  expect(main).not.toMatch(/\b(beacon|keeper)\(/)
  // Behind the clouds, the theme, then the outdoors where its window shows it.
  const order = ['events(sky, p, unit, k, true)', 'scenery(', 'resident(', 'themeWindow(', 'clouds(', 'events(sky, p, unit, k, false)', 'weather(', 'shaded(']
  for (let i = 1; i < order.length; i++) expect(main.indexOf(order[i]!)).toBeGreaterThan(main.indexOf(order[i - 1]!))
  const events = /vec3 events\([^)]*\) \{[\s\S]*?\n\}/.exec(text)?.[0] ?? ''
  expect(events).toContain('themeEvent(')
  expect(events).not.toContain('dolphin(')
  // The island comes after mainImage: the engine reaches it through the four alone.
  expect(text.indexOf('vec3 scenery(vec3 sky, vec2 p, float u, float k) {')).toBeGreaterThan(text.indexOf('void mainImage('))
  expect(text.indexOf('vec3 dolphin(')).toBeGreaterThan(text.indexOf('void mainImage('))
})

test('the birds are printed in lifted inks, so they dim with the sky', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  // The skein finds which birds box the pixel, and birdPrint inks them.
  const birds = /vec3 birds\([^)]*\) \{[\s\S]*?\n\}/.exec(text)?.[0] ?? ''
  const print = /vec3 birdPrint\([^)]*\) \{[\s\S]*?\n\}/.exec(text)?.[0] ?? ''
  expect(birds).toContain('birdPrint(')
  expect(print).toContain('lift(')
  expect(birds + print).not.toContain('vec3(0.0)')
})

test('a leaf or a feather is boxed before it is turned or printed', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  for (const name of ['drift', 'feathers']) {
    const body = new RegExp(`vec3 ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(text)?.[0] ?? ''
    expect(body).not.toBe('')
    const box = body.indexOf('abs(q.x) >')
    expect(box).toBeGreaterThan(0)
    expect(body.indexOf('Print(')).toBeGreaterThan(box)
    expect(body).not.toMatch(/mat2|tumble\(/)
  }
})

test('every plate of a leaf, a feather or a bird is a lifted ink', () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  for (const name of ['driftPrint', 'featherPrint', 'birdPrint']) {
    const body = new RegExp(`vec3 ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(text)?.[0] ?? ''
    // The key plate is lifted too: keyInk and keyPlate are lift(INK_INDIGO, k).
    const inks = body.match(/\bink\(sky, [^,]*|\bkeyPlate\(/g) ?? []
    expect(inks.length).toBeGreaterThan(1)
    for (const ink of inks) expect(ink).toMatch(/^(ink\(sky, (lift|keyInk)\(|keyPlate\()/)
  }
})

// --- Fixes from the final review ----------------------------------------

test('the ISS shows only where the window shows it', () => {
  const elements = elementsOf([ISS_OMM])!
  let offTop = 0
  for (const place of [STOCKHOLM, { name: 'Milano', lat: 45, lon: 10 }]) {
    for (let ms = elements.epochMs; ms < elements.epochMs + 2.9 * 86_400_000; ms += 30_000) {
      const now = issAt(elements, ms, place)
      if (now.elevation <= 10 || !now.isSunlit || sunAt(ms, place.lat, place.lon).elevation >= -6) continue
      const at: DomePoint = domePoint(now)
      if (at.y >= 0) continue
      offTop++
      expect(issVisible(elements, ms, place)).toBeNull()
    }
  }
  expect(offTop).toBeGreaterThan(0)
})

test('a preview or confetti comes first, whatever days fill the sky', () => {
  const ms = swedish(2026, 12, 24, 15, 1)
  const events = eventsAt(ms, contextFor(ms), [{ kind: 'comet', at: ms }])
  expect(events[0]!.kind).toBe('comet')
  expect(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, { events }).events.some(e => e.kind === 'comet')).toBe(true)
})

test("Midsummer's Eve has blossom drifting by its maypole", () => {
  const ms = swedish(2026, 6, 19, 12)
  expect(eventsAt(ms, contextFor(ms)).map(e => e.kind)).toContain('blossom')
})

test('the lighthouse stands on the stage strip when its width is known', () => {
  const at = Date.UTC(2026, 9, 25, 20, 0)
  const text = (stagePx?: number) => skyShader(shaderParams({ ms: at, t: 0, place: STOCKHOLM, weather: null }, { stagePx }), FYR)
  expect(text()).toContain('const float STAGE_PX = 0.0;')
  expect(text(480)).toContain('const float STAGE_PX = 480.0;')
})

test('the keeper sleeps when Clawd does, through CLAWD_ASLEEP', () => {
  const asleep = (ms: number) => {
    const text = skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null, offsetMs: swedishOffsetMs(ms) }, {}), FYR)
    return text.includes('const float CLAWD_ASLEEP = 1.0;') ? true : text.includes('const float CLAWD_ASLEEP = 0.0;') ? false : null
  }
  expect(asleep(swedish(2026, 10, 25, 4))).toBe(true)
  expect(asleep(swedish(2026, 10, 25, 2))).toBe(false)
  expect(asleep(swedish(2026, 10, 25, 7))).toBe(false)
  expect(asleep(swedish(2027, 1, 1, 1))).toBe(false)
})

test("/solar event plays fyr's previews, the keeper's abduction and surf, and the shader schedules them itself", () => {
  const ms = swedish(2026, 8, 10, 12)
  const ctx = contextFor(ms)
  const shaderOf = (kind: 'abduction' | 'surf') => {
    const events = eventsAt(ms, ctx, [{ kind, at: ms }])
    expect(events.some(e => e.kind === kind)).toBe(true)
    return skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, { events }), FYR)
  }
  const ufo = shaderOf('abduction')
  // THEME_FORCE is the preview's place in fyr's manifest, from 1.
  expect(ufo).toContain('const int THEME_FORCE = 1;')
  expect(ufo).toContain('const int EVENT_COUNT = 0;')
  expect(shaderOf('surf')).toContain('const int THEME_FORCE = 2;')
  expect(skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, {}), FYR)).toContain('const int THEME_FORCE = 0;')
  expect(wordsOf(FYR).abduction).toBe('ufo abduction')
  expect(wordsOf(FYR).surf).toBe('surf')
  const start = swedish(2026, 8, 10, 0)
  for (let t = start; t < start + 7 * 86_400_000; t += 30_000) {
    const kinds = eventsAt(t, contextFor(t), [], [...EVENTS, ...specsOf(FYR)]).map(e => e.kind)
    expect(kinds).not.toContain('abduction')
    expect(kinds).not.toContain('surf')
  }
})

// The rules' inputs, for one combination: a fresh question, one past its
// sweep, or none; the person here a second or six minutes.
const WAITS = [null, { mode: 'asking' as const, since: 0 }, { mode: 'done' as const, since: -WAITING_SWEEP_MS }]
const rulesWith = (o: Partial<Parameters<typeof skyRules>[0]>) =>
  skyRules({ pace: 'spar', canTick: true, waiting: null, now: 1000, idleMs: 1000, isOnBattery: false, isLively: true, isGhosttyInFront: true, ...o })

test("without ticks the rules are today's, to the letter", () => {
  for (const pace of ['full', 'spar'] as const) {
    for (const waiting of WAITS) {
      for (const idleMs of [1000, 6 * 60_000, null]) {
        for (const isOnBattery of [false, true]) {
          for (const isLively of [false, true]) {
            for (const isGhosttyInFront of [false, true, null]) {
              const isAway = idleMs !== null && idleMs >= AWAY_MS
              const today = animationOf({ waiting, now: 1000, isAway, isOnBattery, isLively })
              expect(rulesWith({ pace, canTick: false, waiting, idleMs, isOnBattery, isLively, isGhosttyInFront })).toEqual({
                animation: today,
                isLight: isOnBattery || isAway,
                isTicking: false,
              })
            }
          }
        }
      }
    }
  }
})

test('full ticks in front and behind, on battery, until twenty minutes away, and is never light', () => {
  const full = { pace: 'full' as const, isGhosttyInFront: false, isOnBattery: true, isLively: false }
  expect(rulesWith({ ...full, idleMs: 19 * 60_000 })).toEqual({ animation: 'false', isLight: false, isTicking: true })
  expect(rulesWith({ ...full, idleMs: FULL_STILL_MS })).toEqual({ animation: 'false', isLight: false, isTicking: false })
  expect(rulesWith({ ...full, idleMs: null })).toEqual({ animation: 'false', isLight: false, isTicking: true })
  expect(rulesWith({ ...full, waiting: { mode: 'asking', since: 0 } }).isTicking).toBe(true)
})

test("spar ticks where today's sky would move, and only in front unless the lighthouse sweeps", () => {
  const asking = { mode: 'asking' as const, since: 0 }
  const ticks = (o: Partial<Parameters<typeof skyRules>[0]>) => rulesWith(o).isTicking
  expect(ticks({})).toBe(true)
  expect(ticks({ isGhosttyInFront: false, waiting: asking })).toBe(true)
  expect(ticks({ isGhosttyInFront: null })).toBe(true)
  expect(ticks({ isGhosttyInFront: false })).toBe(false)
  expect(ticks({ isOnBattery: true })).toBe(false)
  expect(ticks({ isLively: false })).toBe(false)
  expect(ticks({ idleMs: AWAY_MS })).toBe(false)
  expect(ticks({ waiting: asking, now: WAITING_SWEEP_MS })).toBe(false)
  for (const o of [{}, { isOnBattery: true }, { idleMs: AWAY_MS }, { waiting: asking, isGhosttyInFront: false }]) {
    expect(rulesWith(o).animation).toBe('false')
  }
  expect(rulesWith({ isOnBattery: true }).isLight).toBe(true)
  expect(rulesWith({ idleMs: AWAY_MS }).isLight).toBe(true)
  expect(rulesWith({}).isLight).toBe(false)
})

test('ticks need macOS, a known Ghostty, and on 1.3 the vsync line', () => {
  expect(canTick({ isLinux: true, version: [1, 4], isVsyncOff: true })).toBe(false)
  expect(canTick({ isLinux: false, version: null, isVsyncOff: true })).toBe(false)
  expect(canTick({ isLinux: false, version: [1, 3], isVsyncOff: false })).toBe(false)
  expect(canTick({ isLinux: false, version: [1, 3], isVsyncOff: true })).toBe(true)
  expect(canTick({ isLinux: false, version: [1, 4], isVsyncOff: false })).toBe(true)
  expect(canTick({ isLinux: false, version: [2, 0], isVsyncOff: false })).toBe(true)
  expect(versionOf('1.3.1')).toEqual([1, 3])
  expect(versionOf('1.4.0-dev+abc')).toEqual([1, 4])
  for (const text of [undefined, '', 'tip']) expect(versionOf(text)).toBeNull()
  expect(asPace('{"pace":"full"}')).toBe('full')
  expect(asPace('{"pace":"spar"}')).toBe('spar')
  for (const text of ['', '{"pace":"fast"}', '{', 'null', '"full"']) expect(asPace(text)).toBe('spar')
})


test('the shader carries the tune of its moment, and a demo the tune of each scene', () => {
  const noonInput = { ms: Date.UTC(2026, 9, 24, 11, 0), t: 0, place: STOCKHOLM, weather: null }
  const tune = { ...DEFAULT_TUNE, day: { ...NEUTRAL, brightness: 0.7 } }
  expect(skyShader(shaderParams(noonInput, { tune }), FYR)).toContain('const vec4 sky_TUNE = vec4(0.7, 1.0, 1.0, 0.0);')
  expect(skyShader(shaderParams(noonInput, {}), FYR)).toContain('const vec4 sky_TUNE = vec4(1.0, 1.0, 1.0, 0.0);')
  // The demo's day from local midnight: scene 48 is noon, 0 midnight.
  const demo = skyShader(shaderParams(noonInput, { tune, demo: { seconds: 48 } }), FYR)
  const array = /const vec4 sky_DEMO_TUNE\[(\d+)\] = vec4\[\d+\]\((.*)\);/.exec(demo)
  expect(array?.[1]).toBe('96')
  const brightness = [...(array?.[2] ?? '').matchAll(/vec4\(([^,]+),/g)].map(m => Number(m[1]))
  expect(brightness.length).toBe(96)
  expect(brightness[48]).toBe(0.7)
  expect(brightness[0]).toBe(1)
  expect(brightness[95]).toBe(1)
})
