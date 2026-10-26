// The sky as a Ghostty custom shader: the wallpaper of sky.ts drawn on the
// GPU every frame, so the clouds glide and nothing is written per frame.
// Ghostty gives a shader no date (`iTime` only, and it runs on across a
// reload), so the scene is baked in as constants and the shader is written
// again, and Ghostty told to reload, when they change.

import { horizontalAt, localMidnight, localTime, moonAt, sunAt } from './astro'
import { activityOn } from './clawd'
import { chartAt, tileLines, tileStars } from './chart'
import type { ChartStar } from './chart'
import { domePoint } from './dome'
import type { DomePoint } from './dome'
import type { ActiveEvent, EventKind } from './events'
import { auroraThreshold, bodyAt, greyness, RARE_SHAPES, skyOf } from './sky'
import type { SkyInput } from './sky'
import { clamp, INKS, rand } from './paint'
import { COMMON } from './glsl/common'
import { SKY } from './glsl/sky'
import { CLOUDS } from './glsl/clouds'
import { SEA } from './glsl/sea'
import { EVENTS } from './glsl/events'
import { KEEPER } from './glsl/keeper'
import { SURF } from './glsl/surf'
import { NIGHT } from './glsl/night'
import { ROUTINE } from './glsl/routine'
import { UFO } from './glsl/ufo'
import { BASKET } from './glsl/basket'
import { MAIN } from './glsl/main'

// Where the sky stands at one moment.
export type Scene = {
  // The sun's elevation in degrees.
  elevation: number
  // The sun's (by day) or the moon's (by night) way along the arc, 0 to 1.
  progress: number
  isDay: boolean
}

export type ShaderParams = {
  scene: Scene
  // The real stars and constellation lines on the dome; empty by day.
  chart: { stars: ChartStar[]; lines: [DomePoint, DomePoint][] }
  // The lighthouse: lit while Claude waits (orange asking, white done),
  // hurrying once a question has waited.
  beacon: { mode: 'asking' | 'done'; isUrgent: boolean } | null
  // The wastebasket in the bottom right corner: balls of paper, a tenth of
  // the context window each, and a fire while the conversation compacts
  // (embers just after); null where the band keeps its own.
  basket: { balls: number; fire: 'burn' | 'embers' | null } | null
  // The ISS on a visible pass, where it is and was 20 s before; null otherwise.
  iss: { at: DomePoint; trail: DomePoint } | null
  // Where a comet up now hangs on the dome, and the angle its tails point
  // (away from the sun, in the window's own axes); null with no comet.
  comet: { at: DomePoint; away: number } | null
  // Where the moon is on the dome, null while it is below the horizon.
  moon: { illumination: number; isWaxing: boolean; at: DomePoint | null }
  // A whole day for /solar demo: scenes evenly through it, played in `seconds`.
  demo: { scenes: Scene[]; seconds: number } | null
  // How grey the weather makes the sky, cloud cover and wind (m/s).
  cloudiness: number
  cover: number
  wind: number
  precipitation: 'none' | 'drizzle' | 'rain' | 'thunder' | 'snow'
  // Aurora as strong as the Kp index and the clear sky allow, before the
  // night does; `auroraFloor` keeps a forced preview visible at dusk.
  aurora: number
  auroraFloor: number
  // Events up now, each looped over its length (Ghostty's iTime cannot say
  // when one began), and shooting stars an hour.
  events: { kind: EventKind; seed: number; seconds: number }[]
  shootingRate: number
  // New Year's fireworks: how much of the sky they fill, 0 to 1.
  fireworks: number
  // The keeper at the lighthouse: asleep when Clawd is, and a preview forced.
  keeper: { isAsleep: boolean; force: 'none' | 'ufo' | 'surf' }
  // Ghostty's fragCoord has y up (OpenGL, Linux) rather than down (Metal).
  isYUp: boolean
  // The width of the strip at the right where the lighthouse stands, in
  // pixels; 0 while it is not known.
  stagePx: number
}

// A tab's mark, palette colour 16 as the session sets it (register.tsx,
// markTab): blue one step off black says Claude runs there, green counts
// the balls in its wastebasket and red says what burns (1 a fire, 2
// embers). Per tab, where the shader's text is one for all of them.
export function tabMark(basket: ShaderParams['basket']): [number, number, number] {
  const balls = Math.max(0, Math.min(10, Math.round(basket?.balls ?? 0)))
  const fire = basket?.fire === 'burn' ? 1 : basket?.fire === 'embers' ? 2 : 0

  return [fire, balls, 1]
}

// The shader's number for each event.
const EVENT_INDEX: Record<EventKind, number> = {
  satellite: 1,
  balloon: 2,
  birds: 3,
  plane: 4,
  rainbow: 5,
  kite: 6,
  leaves: 7,
  blossom: 8,
  comet: 9,
  constellation: 10,
  milestone: 11,
  shootingStar: 12,
  witch: 13,
  feathers: 14,
  flag: 15,
  maypole: 16,
  luciaTrain: 17,
  christmasStar: 18,
  sleigh: 19,
  fireworks: 20,
  dolphin: 21,
  pinkDolphin: 22,
  // The shader schedules these itself; they are never drawn as events.
  abduction: 23,
  surf: 24,
}

// Scenes are worked out on this grid, so the shader's text (and with it a
// reload) changes about every two minutes.
export const SCENE_MS = 120_000
// Scenes in a demo day.
const DEMO_SCENES = 96

function round(v: number, step: number): number {
  return Math.round(v / step) * step
}

// A comet's place among the stars, from its seed: high in a northern sky.
// Below the horizon it is held just above it, so a preview always shows it.
function cometAt(seed: number, ms: number, place: SkyInput['place']): { at: DomePoint; away: number } {
  const sky = horizontalAt(rand(seed) * 360, 45 + 30 * rand(seed + 1), ms, place.lat, place.lon)
  const raw = domePoint({ elevation: Math.max(sky.elevation, 4), azimuth: sky.azimuth })
  const at = { x: raw.x, y: Math.max(raw.y, 0.05) }
  const sun = domePoint(sunAt(ms, place.lat, place.lon))

  return { at: dome(at), away: round(Math.atan2(at.y - sun.y, at.x - sun.x), 0.01) }
}

// A dome point as the shader takes it: fine enough that nothing jumps.
function dome(at: DomePoint): DomePoint {
  return { x: round(at.x, 0.0005), y: round(at.y, 0.0005) }
}

export function sceneAt(ms: number, place: SkyInput['place']): Scene {
  const sun = sunAt(ms, place.lat, place.lon)
  const body = bodyAt(ms, place)

  return { elevation: round(sun.elevation, 0.1), progress: round(body.progress, 0.001), isDay: body.isDay }
}

// The shader's constants for a moment, `demo` playing the place's whole day
// from local midnight instead.
export function shaderParams(
  input: SkyInput & { offsetMs?: number },
  options: {
    demo?: { seconds: number; offsetMs?: number } | null
    events?: readonly ActiveEvent[]
    shootingRate?: number
    beacon?: ShaderParams['beacon']
    iss?: ShaderParams['iss']
    basket?: ShaderParams['basket']
    isYUp?: boolean
    stagePx?: number
  },
): ShaderParams {
  const { place, weather, kp, isAuroraForced } = input
  const ms = round(input.ms, SCENE_MS)
  const moon = moonAt(ms, place.lat, place.lon)
  const sky = weather ? skyOf(weather.code) : 'clear'
  const clear = 1 - greyness(weather)
  const over = kp === null || kp === undefined ? -Infinity : kp - auroraThreshold(place.lat) + 1
  let demo: ShaderParams['demo'] = null
  if (options.demo) {
    const midnight = localMidnight(ms, options.demo.offsetMs)
    const scenes: Scene[] = []
    for (let i = 0; i < DEMO_SCENES; i++) scenes.push(sceneAt(midnight + (i * 86_400_000) / DEMO_SCENES, place))
    demo = { scenes, seconds: options.demo.seconds }
  }

  // The stars where they stand (in a demo, where they stood as it began);
  // by day there are none to show, and the shader stays short.
  const scene = demo ? demo.scenes[0]! : sceneAt(ms, place)
  const chart = demo || scene.elevation < -4 ? chartAt(ms, place) : { stars: [], lines: [] }
  const comet = options.events?.find(event => event.kind === 'comet')

  return {
    // In a demo the day plays from its table: a fixed scene keeps the text,
    // and with it Ghostty, still for the demo's length.
    scene,
    beacon: options.beacon ?? null,
    basket: options.basket ?? null,
    isYUp: !!options.isYUp,
    stagePx: Math.max(0, Math.round(options.stagePx ?? 0)),
    iss: options.iss ? { at: dome(options.iss.at), trail: dome(options.iss.trail) } : null,
    comet: comet ? cometAt(comet.seed, ms, place) : null,
    chart: {
      stars: chart.stars.map(star => ({ ...dome(star), mag: star.mag, bv: star.bv })),
      lines: chart.lines.map(([a, b]) => [dome(a), dome(b)] as [DomePoint, DomePoint]),
    },
    moon: { illumination: round(moon.illumination, 0.01), isWaxing: moon.isWaxing, at: moon.elevation > 0 ? dome(domePoint(moon)) : null },
    demo,
    cloudiness: round(greyness(weather), 0.01),
    cover: weather ? round(weather.cloudCover / 100, 0.01) : 0.3,
    wind: weather ? round(weather.wind, 0.5) : 3,
    precipitation: sky === 'drizzle' || sky === 'rain' || sky === 'thunder' || sky === 'snow' ? sky : 'none',
    aurora: isAuroraForced ? 0.9 : round(clamp(over / 3) * clear, 0.01),
    auroraFloor: isAuroraForced ? 0.4 : 0,
    // A shooting star asked for is a shower: one every few seconds.
    events: (options.events ?? [])
      .filter(event => event.kind !== 'shootingStar' && event.kind !== 'abduction' && event.kind !== 'surf')
      .slice(0, 4)
      .map(event => ({ kind: event.kind, seed: event.seed, seconds: Math.round(event.durationMs / 1000) })),
    shootingRate: options.events?.some(event => event.kind === 'shootingStar') ? 900 : options.shootingRate ?? 0,
    keeper: {
      isAsleep: activityOn(localTime(ms, input.offsetMs)) === 'sleep',
      force: options.events?.some(event => event.kind === 'abduction') ? 'ufo' : options.events?.some(event => event.kind === 'surf') ? 'surf' : 'none',
    },
    fireworks: round(options.events?.find(event => event.kind === 'fireworks')?.progress ?? 0, 0.05),
  }
}

// --- GLSL ---------------------------------------------------------------------

function f(v: number): string {
  const text = Number.isFinite(v) ? v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0') : '0.0'

  return text === '-0.0' ? '0.0' : text
}

function rgb(c: number): string {
  return `vec3(${f(((c >> 16) & 0xff) / 255)}, ${f(((c >> 8) & 0xff) / 255)}, ${f((c & 0xff) / 255)})`
}

function floats(values: number[]): string {
  return `float[${values.length}](${values.map(f).join(', ')})`
}

const PRECIPITATION = { none: 0, drizzle: 1, rain: 2, thunder: 3, snow: 4 } as const

// The gradient's stops, as sky.ts has them: sun elevation, then top,
// middle and horizon.
const STOPS: readonly [number, number, number, number][] = [
  [-90, 0x05070f, 0x0a0f22, 0x111a36],
  [-18, 0x070b1c, 0x0f1733, 0x1a2550],
  [-12, 0x0c1430, 0x1d2552, 0x3a3772],
  [-6, 0x16205a, 0x433f86, 0x9b5b8e],
  [-3, 0x223276, 0x6d4f95, 0xd9708a],
  [0, 0x2f4a92, 0x9a6aa6, 0xf59a78],
  [3, 0x3b66b0, 0xc48fb0, 0xffbf86],
  [8, 0x3f7cc8, 0x8fb5e0, 0xf7d6b4],
  [15, 0x4973ce, 0x6184d4, 0xb4b5db],
  [30, 0x436fcf, 0x537dd4, 0xacb3e1],
  [90, 0x3e6ace, 0x4c77d3, 0xa7afe1],
]

// The colours Claude Code fills its own fields with in its dark themes, as
// 2.1.310's CLI has them (dark, then what dark-daltonized has of its own):
// a diff's added and removed rows, dimmed and not, and the brighter
// backgrounds of the words changed in them; the prompt's rows, hovered and
// not; the shell's rows; the # of a memory; the composer's sidebar; and a
// tool's diff as color-diff highlights it, which has rows and words of its
// own in truecolor. Glass lets the sky through these and nothing else: the
// band's pixel art, text and any other colour stay solid.
export const FIELD_COLOURS: readonly number[] = [
  0x225c2b, // diffAdded
  0x7a2936, // diffRemoved
  0x47584a, // diffAddedDimmed
  0x69484d, // diffRemovedDimmed
  0x38a660, // diffAddedWord
  0xb3596b, // diffRemovedWord
  0x373737, // userMessageBackground
  0x464646, // userMessageBackgroundHover
  0x413c41, // bashMessageBackgroundColor
  0x374146, // memoryBackgroundColor
  0x262626, // composerSidebarBackground
  0x004466, // diffAdded, daltonized
  0x660000, // diffRemoved, daltonized
  0x3e515b, // diffAddedDimmed, daltonized
  0x3e2c2c, // diffRemovedDimmed, daltonized
  0x0077b3, // diffAddedWord, daltonized
  0xb30000, // diffRemovedWord, daltonized
  0x022800, // color-diff's addLine
  0x044700, // color-diff's addWord
  0x3d0100, // color-diff's deleteLine
  0x5c0200, // color-diff's deleteWord
  0x001b29, // color-diff's addLine, daltonized
  0x003047, // color-diff's addWord, daltonized
]

// A colour as the shader reads the terminal's image: in linear light on
// Linux (sRGB's own curve, as the GPU decodes it), as it is elsewhere.
function seen(c: number, isLinear: boolean): string {
  const channel = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff].map(v => (isLinear ? channel(v / 255) : v / 255))

  return `vec3(${f(r!)}, ${f(g!)}, ${f(b!)})`
}

// The sRGB colour c in Display P3, as a Mac's Ghostty (its window-colorspace
// srgb, the default) hands the shader the terminal's image: through linear
// light, from sRGB's primaries to P3's, and back onto the same curve.
function displayP3(c: number): number {
  const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const encode = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)))
  const [r, g, b] = [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff].map(v => decode(v / 255)) as [number, number, number]
  const p3 = [0.8225 * r + 0.1774 * g, 0.0332 * r + 0.9669 * g, 0.0171 * r + 0.0724 * g + 0.9108 * b].map(encode) as [number, number, number]
  return (p3[0] << 16) | (p3[1] << 8) | p3[2]
}

// The field colours as the shader reads them: on Linux in linear light; on
// a Mac both as they are (a window-colorspace of display-p3, and the
// previews) and in Display P3, as Ghostty there gives them by default.
// Greys are the same either way, and are given once.
function fieldsSeen(isLinear: boolean): string[] {
  if (isLinear) return FIELD_COLOURS.map(c => seen(c, true))
  const converted = FIELD_COLOURS.map(displayP3).filter(c => !FIELD_COLOURS.includes(c))
  return [...FIELD_COLOURS, ...converted].map(c => seen(c, false))
}

function ints(values: number[]): string {
  return `int[${values.length}](${values.join(', ')})`
}

function vec2s(points: DomePoint[]): string {
  return `vec2[${points.length}](${points.map(p => `vec2(${f(p.x)}, ${f(p.y)})`).join(', ')})`
}

// The chart as the shader reads it: stars and lines, and the tiles that say
// which of them lie near each pixel. GLSL has no empty arrays: one
// placeholder each when there is nothing to show.
function chartConstants(chart: ShaderParams['chart']): string[] {
  const nothing = { x: 0, y: 0 }
  const stars = chart.stars.length > 0 ? chart.stars : [{ ...nothing, mag: 9, bv: 0 }]
  const lines = chart.lines.length > 0 ? chart.lines : [[nothing, nothing] as [DomePoint, DomePoint]]
  const starTiles = tileStars(chart.stars)
  const lineTiles = tileLines(chart.lines)
  const tiles = starTiles.start.length

  return [
    `const int STAR_COUNT = ${chart.stars.length};`,
    `const vec2 STAR_AT[${stars.length}] = ${vec2s(stars)};`,
    `const vec2 STAR_LOOK[${stars.length}] = vec2[${stars.length}](${stars.map(s => `vec2(${f(s.mag)}, ${f(s.bv)})`).join(', ')});`,
    `const int TILE_START[${tiles}] = ${ints(starTiles.start)};`,
    `const int TILE_COUNT[${tiles}] = ${ints(starTiles.count)};`,
    `const int TILE_STAR[${Math.max(1, starTiles.index.length)}] = ${ints(starTiles.index.length > 0 ? starTiles.index : [0])};`,
    `const int LINE_COUNT = ${chart.lines.length};`,
    `const vec2 LINE_A[${lines.length}] = ${vec2s(lines.map(l => l[0]))};`,
    `const vec2 LINE_B[${lines.length}] = ${vec2s(lines.map(l => l[1]))};`,
    `const int LINE_TILE_START[${tiles}] = ${ints(lineTiles.start)};`,
    `const int LINE_TILE_COUNT[${tiles}] = ${ints(lineTiles.count)};`,
    `const int LINE_TILE_LINE[${Math.max(1, lineTiles.index.length)}] = ${ints(lineTiles.index.length > 0 ? lineTiles.index : [0])};`,
  ]
}

// The whole shader for these constants: the same text for the same params.
export function skyShader(params: ShaderParams): string {
  const { scene, moon, demo } = params
  const demoScenes = demo?.scenes ?? [scene]
  // GLSL has no empty arrays: a placeholder when no event is up.
  const events = params.events.length > 0 ? params.events : [{ kind: 'satellite' as const, seed: 0, seconds: 1 }]
  const constants = [
    `const float ELEVATION = ${f(scene.elevation)};`,
    `const float PROGRESS = ${f(scene.progress)};`,
    `const float IS_DAY = ${scene.isDay ? '1.0' : '0.0'};`,
    `const float MOON_ILLUMINATION = ${f(moon.illumination)};`,
    `const float MOON_WAXING = ${moon.isWaxing ? '1.0' : '0.0'};`,
    `const vec2 MOON_AT = vec2(${f(moon.at?.x ?? 0)}, ${f(moon.at?.y ?? 0)});`,
    `const float MOON_UP = ${moon.at ? '1.0' : '0.0'};`,
    `const float CLOUDINESS = ${f(params.cloudiness)};`,
    `const float COVER = ${f(params.cover)};`,
    `const float WIND = ${f(params.wind)};`,
    `const int PRECIPITATION = ${PRECIPITATION[params.precipitation]};`,
    `const float AURORA = ${f(params.aurora)};`,
    `const float AURORA_FLOOR = ${f(params.auroraFloor)};`,
    `const int DEMO_COUNT = ${demo ? demoScenes.length : 0};`,
    `const float DEMO_SECONDS = ${f(demo?.seconds ?? 1)};`,
    `const float DEMO_ELEVATION[${demoScenes.length}] = ${floats(demoScenes.map(s => s.elevation))};`,
    `const float DEMO_PROGRESS[${demoScenes.length}] = ${floats(demoScenes.map(s => s.progress))};`,
    `const float DEMO_DAY[${demoScenes.length}] = ${floats(demoScenes.map(s => (s.isDay ? 1 : 0)))};`,
    `const float STOP_AT[${STOPS.length}] = ${floats(STOPS.map(s => s[0]))};`,
    `const vec3 STOP_TOP[${STOPS.length}] = vec3[${STOPS.length}](${STOPS.map(s => rgb(s[1])).join(', ')});`,
    `const vec3 STOP_MIDDLE[${STOPS.length}] = vec3[${STOPS.length}](${STOPS.map(s => rgb(s[2])).join(', ')});`,
    `const vec3 STOP_HORIZON[${STOPS.length}] = vec3[${STOPS.length}](${STOPS.map(s => rgb(s[3])).join(', ')});`,
    ...Object.entries(INKS).map(([name, c]) => `const vec3 INK_${name.toUpperCase()} = ${rgb(c)};`),
    ...chartConstants(params.chart),
    `const float ISS_UP = ${params.iss ? '1.0' : '0.0'};`,
    `const vec2 ISS_AT = vec2(${f(params.iss?.at.x ?? 0)}, ${f(params.iss?.at.y ?? 0)});`,
    `const vec2 ISS_TRAIL = vec2(${f(params.iss?.trail.x ?? 0)}, ${f(params.iss?.trail.y ?? 0)});`,
    `const int BEACON = ${params.beacon ? (params.beacon.mode === 'asking' ? 1 : 2) : 0};`,
    `const float BEACON_URGENT = ${params.beacon?.isUrgent ? '1.0' : '0.0'};`,
    `const int BASKET = ${params.basket ? 1 : 0};`,
    `const float STAGE_PX = ${f(params.stagePx)};`,
    `const float Y_UP = ${params.isYUp ? '1.0' : '0.0'};`,
    `const int FIELD_COUNT = ${fieldsSeen(params.isYUp).length};`,
    `const vec3 FIELD_COLOURS[${fieldsSeen(params.isYUp).length}] = vec3[${fieldsSeen(params.isYUp).length}](${fieldsSeen(params.isYUp).join(', ')});`,
    `const vec2 COMET_AT = vec2(${f(params.comet?.at.x ?? 0)}, ${f(params.comet?.at.y ?? 0)});`,
    `const float COMET_AWAY = ${f(params.comet?.away ?? 0)};`,
    `const float SHOOTING_RATE = ${f(params.shootingRate)};`,
    `const float FIREWORKS = ${f(params.fireworks)};`,
    `const float FLAG_DAY = ${params.events.some(e => e.kind === 'flag') ? '1.0' : '0.0'};`,
    `const float KEEPER_ASLEEP = ${params.keeper.isAsleep ? '1.0' : '0.0'};`,
    `const int KEEPER_FORCE = ${{ none: 0, ufo: 1, surf: 2 }[params.keeper.force]};`,
    `const int EVENT_COUNT = ${params.events.length};`,
    `const int EVENT_KIND[${events.length}] = int[${events.length}](${events.map(e => EVENT_INDEX[e.kind] ?? 0).join(', ')});`,
    `const float EVENT_SEED[${events.length}] = ${floats(events.map(e => e.seed))};`,
    `const float EVENT_SECONDS[${events.length}] = ${floats(events.map(e => Math.max(1, e.seconds)))};`,
    // The rare clouds' shapes, a row per uint, bit 0 the leftmost puff.
    ...Object.entries(RARE_SHAPES).map(([name, rows]) => {
      const bits = rows.map(row => [...row].reduce((sum, ch, i) => (ch === 'x' ? sum + 2 ** i : sum), 0))
      return `const uint ${name.toUpperCase()}[${bits.length}] = uint[${bits.length}](${bits.map(b => `${b}u`).join(', ')});`
    }),
  ]

  return `// Solar Clawd's sky, written by hooks/shader.ts: edits here are overwritten.\n\n${constants.join('\n')}\n${BODY}`
}

// Everything but the constants. Coordinates are x right and y down from the
// top left, as on sky.ts's Canvas: Ghostty's fragCoord on Metal (macOS),
// flipped from OpenGL's y up (Linux) when Y_UP is set.
const BODY = [COMMON, SKY, CLOUDS, SEA, EVENTS, KEEPER, SURF, NIGHT, ROUTINE, UFO, BASKET, MAIN].join('\n')
