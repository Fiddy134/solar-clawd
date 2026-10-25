// The sky as a Ghostty custom shader: the wallpaper of sky.ts drawn on the
// GPU every frame, so the clouds glide and nothing is written per frame.
// Ghostty gives a shader no date (`iTime` only, and it runs on across a
// reload), so the scene is baked in as constants and the shader is written
// again, and Ghostty told to reload, when they change.

import { horizontalAt, localMidnight, moonAt, sunAt } from './astro'
import { chartAt, tileLines, tileStars } from './chart'
import type { ChartStar } from './chart'
import { domePoint } from './dome'
import type { DomePoint } from './dome'
import type { ActiveEvent, EventKind } from './events'
import { auroraThreshold, bodyAt, greyness, RARE_SHAPES, skyOf } from './sky'
import type { SkyInput } from './sky'
import { clamp, INKS, rand } from './paint'

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
  // Ghostty's fragCoord has y up (OpenGL, Linux) rather than down (Metal).
  isYUp: boolean
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
  input: SkyInput,
  options: {
    demo?: { seconds: number; offsetMs?: number } | null
    events?: readonly ActiveEvent[]
    shootingRate?: number
    beacon?: ShaderParams['beacon']
    iss?: ShaderParams['iss']
    basket?: ShaderParams['basket']
    isYUp?: boolean
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
      .filter(event => event.kind !== 'shootingStar')
      .slice(0, 4)
      .map(event => ({ kind: event.kind, seed: event.seed, seconds: Math.round(event.durationMs / 1000) })),
    shootingRate: options.events?.some(event => event.kind === 'shootingStar') ? 900 : options.shootingRate ?? 0,
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
  [15, 0x3585d8, 0x79b4ea, 0xd6e8f6],
  [30, 0x2a7ad8, 0x66aaf0, 0xbfe0fa],
  [90, 0x1f6ed6, 0x58a2f0, 0xb0d8fb],
]

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
    `const float Y_UP = ${params.isYUp ? '1.0' : '0.0'};`,
    `const vec2 COMET_AT = vec2(${f(params.comet?.at.x ?? 0)}, ${f(params.comet?.at.y ?? 0)});`,
    `const float COMET_AWAY = ${f(params.comet?.away ?? 0)};`,
    `const float SHOOTING_RATE = ${f(params.shootingRate)};`,
    `const float FIREWORKS = ${f(params.fireworks)};`,
    `const float FLAG_DAY = ${params.events.some(e => e.kind === 'flag') ? '1.0' : '0.0'};`,
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
const BODY = `
const float PI = 3.14159265;
// The arc the sun and the moon cross, as fractions of the window.
const vec4 ARC = vec4(0.56, 0.95, 0.12, 0.62); // left, right, top, foot
// The brightest the sky gets, so the terminal's light text stays readable.
const float LUMINANCE = 0.36;
const float SATURATION = 1.35;

// --- Numbers -------------------------------------------------------------

uint hashu(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
uint hashi(int n) { return hashu(uint(n)); }
float rand(int n) { return float(hashi(n) >> 8u) / 16777216.0; }

// Smooth 1D value noise in [0, 1].
float noise(float x, int seed) {
  float i = floor(x);
  float a = rand(int(i) * 374761 + seed * 668265);
  float b = rand((int(i) + 1) * 374761 + seed * 668265);
  return mix(a, b, smoothstep(0.0, 1.0, x - i));
}

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 grey(vec3 c) { return vec3(luminance(c)); }
// Pushes a colour away from its grey (k > 1).
vec3 vivid(vec3 c, float k) { float g = luminance(c); return clamp(g + (c - g) * k, 0.0, 1.0); }

// How much of (x, y) a risograph halftone dot covers: dots on a lattice
// \`pitch\` apart at \`angle\` degrees, as large as \`tone\` asks.
float screen(vec2 at, float tone, float pitch, float angle) {
  if (tone <= 0.01) return 0.0;
  if (tone >= 0.99) return 1.0;
  float a = radians(angle);
  vec2 uv = vec2(at.x * cos(a) + at.y * sin(a), -at.x * sin(a) + at.y * cos(a)) / pitch;
  float d = length(uv - floor(uv + 0.5)) * pitch;
  float r = pitch * sqrt(tone / PI) * 1.1;
  return clamp(r - d + 0.5, 0.0, 1.0);
}

// --- Where things are ----------------------------------------------------

struct Scene { float elevation; float progress; float isDay; };

// The scene now; in a demo, the day played round with iTime.
Scene sceneNow() {
  if (DEMO_COUNT == 0) return Scene(ELEVATION, PROGRESS, IS_DAY);
  float at = fract(iTime / DEMO_SECONDS) * float(DEMO_COUNT);
  int i = int(floor(at)) % DEMO_COUNT;
  int j = (i + 1) % DEMO_COUNT;
  float t = fract(at);
  float elevation = mix(DEMO_ELEVATION[i], DEMO_ELEVATION[j], t);
  // Across sunrise and sunset the arc starts over: no blending there.
  float progress = DEMO_DAY[i] == DEMO_DAY[j] ? mix(DEMO_PROGRESS[i], DEMO_PROGRESS[j], t) : DEMO_PROGRESS[i];
  return Scene(elevation, progress, DEMO_DAY[i]);
}

// A point of the dome (hooks/dome.ts), in window heights from the top
// centre, as a pixel.
vec2 domeToPixel(vec2 d) { return vec2(iResolution.x * 0.5 + d.x * iResolution.y, d.y * iResolution.y); }

// The terminal's cursor. Ghostty gives its bottom-left corner (y down, as
// fragCoord; probed 2026-10-25) and its size in zw.
// With y up (OpenGL) the corner is the top-left one, so the same centre is
// flipped as fragCoord is.
vec2 cursorAt() {
  vec2 c = vec2(iCurrentCursor.x + iCurrentCursor.z * 0.5, iCurrentCursor.y - iCurrentCursor.w * 0.5);
  return Y_UP > 0.5 ? vec2(c.x, iResolution.y - c.y) : c;
}

// How much a star at \`at\` glints for the cursor: near it, just after it
// moved, fading within a second.
float glance(vec2 at) {
  if (iCurrentCursor.z <= 0.0) return 0.0;
  float u = max(4.0, floor(iResolution.y / 60.0 + 0.5));
  float fresh = exp(-max(0.0, iTime - iTimeCursorChange) * 2.5);
  return fresh * smoothstep(6.0 * u, 0.0, length(at - cursorAt()));
}

// A thing at \`at\`, nudged out of the cursor's way.
vec2 shy(vec2 at, float u) {
  if (iCurrentCursor.z <= 0.0) return at;
  vec2 away = at - cursorAt();
  float d = length(away);
  if (d > 8.0 * u || d < 0.001) return at;
  return at + away / d * 3.0 * u * (1.0 - d / (8.0 * u));
}

vec2 arcPoint(float progress) {
  float p = clamp(progress, 0.0, 1.0);
  return iResolution.xy * vec2(ARC.x + (ARC.y - ARC.x) * p, ARC.w - (ARC.w - ARC.z) * sin(p * PI));
}

float nightness(float elevation) { return smoothstep(-5.0, -13.0, elevation); }

// --- The gradient ----------------------------------------------------------

void stops(float e, out vec3 top, out vec3 middle, out vec3 horizon) {
  int i = 1;
  for (int k = 1; k < 10; k++) if (e > STOP_AT[k]) i = k + 1;
  float t = clamp((e - STOP_AT[i - 1]) / (STOP_AT[i] - STOP_AT[i - 1]), 0.0, 1.0);
  top = mix(STOP_TOP[i - 1], STOP_TOP[i], t);
  middle = mix(STOP_MIDDLE[i - 1], STOP_MIDDLE[i], t);
  horizon = mix(STOP_HORIZON[i - 1], STOP_HORIZON[i], t);
}

// The gradient at \`p\`, and in \`k\` how far the whole sky is dimmed so its
// brightest point stays at LUMINANCE.
vec3 gradient(vec2 p, Scene s, out float k) {
  vec3 top, middle, horizon;
  stops(s.elevation, top, middle, horizon);
  bool isEvening = s.isDay > 0.5 ? s.progress > 0.5 : s.progress < 0.5;
  // Sunsets run pinker than sunrises, through dusk and no further.
  if (isEvening && s.elevation < 12.0) {
    float pink = 0.22 * clamp((12.0 - s.elevation) / 18.0, 0.0, 1.0) * smoothstep(-14.0, -4.0, s.elevation);
    middle = mix(middle, vec3(1.0, 0.435, 0.569), pink);
    horizon = mix(horizon, vec3(1.0, 0.435, 0.569), pink * 0.8);
  }
  // The glow sits where the sun is, or at the foot it set behind or will rise from.
  float glowAt = s.isDay > 0.5 ? s.progress : isEvening ? 1.0 : 0.0;
  float glowX = ARC.x + (ARC.y - ARC.x) * glowAt;
  float glow = clamp(1.0 - abs(s.elevation - 1.0) / 11.0, 0.0, 1.0) * (1.0 - CLOUDINESS);
  vec3 glowColor = isEvening ? vec3(1.0, 0.478, 0.361) : vec3(1.0, 0.702, 0.478);

  vec3 hottest = mix(horizon, glowColor, glow * 0.55);
  float brightest = max(max(luminance(top), luminance(middle)), luminance(hottest));
  k = min(1.0, LUMINANCE / max(brightest, 0.001));

  float v = p.y / iResolution.y;
  vec3 base = v < 0.55 ? mix(top, middle, v / 0.55) : mix(middle, horizon, (v - 0.55) / 0.45);
  float dx = p.x / iResolution.x - glowX;
  vec3 c = mix(base, glowColor, glow * v * v * exp(-dx * dx * 6.0) * 0.55);
  return mix(c, grey(c), CLOUDINESS);
}

// --- Aurora ----------------------------------------------------------------

vec3 aurora(vec3 sky, vec2 p, float strength) {
  float u = p.x / iResolution.x;
  float h = iResolution.y;
  float t = iTime;
  float base = h * (0.22 + 0.16 * noise(u * 4.0 + t * 0.02, 1));
  float tall = h * (0.12 + 0.22 * noise(u * 9.0 - t * 0.04, 2));
  float reach = tall * 0.25;
  if (p.y < base - tall || p.y > base + reach) return sky;
  float ray = 0.25 + 0.75 * pow(noise(u * 40.0 + t * 0.15, 3), 3.0);
  float fold = smoothstep(0.25, 0.75, noise(u * 3.5 - t * 0.03, 4));
  float rel = (base - p.y) / tall;
  float a = rel >= 0.0 ? exp(-rel * 2.4) : exp(rel * tall / (reach * 0.3)) * 0.6;
  vec3 color = mix(vec3(0.239, 1.0, 0.627), vec3(0.659, 0.42, 1.0), clamp(rel * 1.4, 0.0, 1.0));
  return mix(sky, color, clamp(strength * ray * fold * a * 0.75, 0.0, 1.0));
}

// --- Stars -----------------------------------------------------------------

// One star in some cells of a grid, kept away from the cell's edges so its
// glints stay inside; bright ones are rarer and glint.
vec3 stars(vec3 sky, vec2 p, float strength, float size) {
  float cell = 37.0;
  vec2 c = floor(p / cell);
  int n = int(c.x) * 7919 + int(c.y) * 104729;
  // Sparse: the real stars carry the sky, these only fill it.
  if (rand(n) > 0.35) return sky;
  float margin = size * 3.0 + 1.0;
  vec2 at = c * cell + margin + vec2(rand(n + 1), rand(n + 2)) * (cell - margin * 2.0);
  vec2 d = abs(p - at);
  if (d.x > margin || d.y > margin) return sky;
  uint kind = hashi(n + 3) % 20u;
  vec3 tint = kind == 0u ? vec3(1.0, 0.824, 0.659) : kind == 1u ? vec3(0.722, 0.8, 1.0) : vec3(1.0, 0.973, 0.925);
  float twinkle = 0.75 + 0.25 * sin(iTime * (1.5 + float(hashi(n + 4) % 7u) * 0.4) + float(hashi(n + 6) % 100u));
  // Faint fill: the bright stars are the real ones (realStars).
  float bright = (kind < 3u ? 0.48 : 0.35 + float(hashi(n + 5) % 5u) * 0.1) * twinkle;
  // Fainter near the horizon, where the air is thick.
  float near = glance(at);
  float a = strength * bright * (1.0 - smoothstep(0.45, 0.8, at.y / iResolution.y)) * (1.0 + 1.5 * near);
  float disc = (d.x < size * (0.5 + near) + 0.5 && d.y < size * (0.5 + near) + 0.5) ? 1.0 : 0.0;
  float glint = kind < 3u && size > 1.0 && min(d.x, d.y) < 0.5 ? 0.35 * (1.0 - max(d.x, d.y) / (size * 2.0 + 1.0)) : 0.0;
  return mix(sky, tint, clamp(a * max(disc, glint), 0.0, 1.0));
}

// The dome point under a pixel, and the chart tile it falls in (-1 outside).
vec2 pixelToDome(vec2 p) { return vec2((p.x - iResolution.x * 0.5) / iResolution.y, p.y / iResolution.y); }
int chartTile(int column, int row) {
  if (column < 0 || column >= 80 || row < 0 || row >= 16) return -1;
  return row * 80 + column;
}

// The real stars near \`p\`: as bright as their magnitude, tinted by their
// colour index, the brightest with a soft glint.
vec3 realStars(vec3 sky, vec2 p, float strength, float size) {
  vec2 d = pixelToDome(p);
  int column = int(floor((d.x + 1.6) / 0.04));
  int row = int(floor(d.y / 0.04));
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      int tile = chartTile(column + dx, row + dy);
      if (tile < 0) continue;
      int first = TILE_START[tile];
      for (int k = first; k < first + TILE_COUNT[tile]; k++) {
        int i = TILE_STAR[k];
        vec2 at = domeToPixel(STAR_AT[i]);
        float mag = STAR_LOOK[i].x;
        float bv = STAR_LOOK[i].y;
        float glint = glance(at);
        float r = size * (0.9 + max(0.0, 3.5 - mag) * 0.6) * (1.0 + 0.7 * glint);
        float dist = length(p - at);
        if (dist > r * 4.0) continue;
        vec3 tint = bv < 0.2 ? vec3(0.78, 0.86, 1.0) : bv > 1.2 ? vec3(1.0, 0.8, 0.62) : vec3(1.0, 0.97, 0.92);
        float twinkle = 0.85 + 0.15 * sin(iTime * (1.1 + mod(float(i), 7.0) * 0.3) + float(i));
        float bright = clamp((4.5 - mag) / 3.5, 0.3, 1.0) * twinkle;
        float core = clamp(r - dist + 0.5, 0.0, 1.0);
        float halo = max(mag < 2.0 ? 0.45 * exp(-dist / (r * 0.8)) : 0.0, 0.7 * glint * exp(-dist / (r * 1.4)));
        float a = strength * bright * (1.0 - smoothstep(0.5, 0.85, at.y / iResolution.y)) * (1.0 + 1.5 * glint);
        sky = mix(sky, tint, clamp(a * max(core, halo), 0.0, 1.0));
      }
    }
  }
  return sky;
}

// --- The moon ----------------------------------------------------------------

// Its seas, in the disc's own units (y down): darker, a little blue.
float seas(vec2 q) {
  float s = 0.0;
  s = max(s, smoothstep(0.32, 0.18, length((q - vec2(-0.32, -0.42)) * vec2(1.0, 1.2))));  // Imbrium
  s = max(s, smoothstep(0.2, 0.1, length(q - vec2(0.14, -0.36))));                          // Serenitatis
  s = max(s, smoothstep(0.24, 0.12, length((q - vec2(0.3, -0.06)) * vec2(1.0, 1.3))));     // Tranquillitatis
  s = max(s, smoothstep(0.13, 0.06, length(q - vec2(0.64, -0.3))));                         // Crisium
  s = max(s, smoothstep(0.42, 0.2, length((q - vec2(-0.58, 0.02)) * vec2(1.4, 0.8))));     // Procellarum
  s = max(s, smoothstep(0.2, 0.08, length(q - vec2(-0.16, 0.42))));                         // Nubium
  s = max(s, smoothstep(0.16, 0.07, length(q - vec2(0.5, 0.16))));                          // Fecunditatis
  return s;
}

vec3 moonAt(vec3 sky, vec2 p, vec2 at, float radius, float strength) {
  if (MOON_ILLUMINATION < 0.02 || strength <= 0.0) return sky;
  vec2 d = p - at;
  float r = length(d) / radius;
  if (r > 3.2) return sky;
  vec3 plain = vec3(0.957, 0.937, 0.863);
  // The halo lies under the disc too, so its edge meets light, not sky.
  sky = mix(sky, plain, 0.16 * exp(-max(0.0, r - 1.0) * 1.6) * MOON_ILLUMINATION * strength);
  if (r > 1.02) return sky;
  vec2 q = d / radius;
  float soft = 1.5 / radius;
  float edge = sqrt(max(0.0, 1.0 - q.y * q.y));
  float terminator = edge * (1.0 - 2.0 * MOON_ILLUMINATION);
  float side = MOON_WAXING > 0.5 ? q.x - terminator : -q.x - terminator;
  float lit = smoothstep(-soft, soft, side);
  // Seas, a speckle of craters, a bright Tycho and a darker limb.
  float speckle = noise(q.x * 23.0 + q.y * 7.0, 5) * noise(q.y * 19.0 - q.x * 5.0, 6);
  vec3 surface = mix(plain, vec3(0.69, 0.68, 0.66), seas(q) * 0.75);
  surface *= 0.92 + 0.12 * speckle;
  surface = mix(surface, vec3(1.0), smoothstep(0.07, 0.0, length(q - vec2(-0.1, 0.74))) * 0.5);
  surface *= 1.0 - 0.18 * pow(r, 4.0);
  float alpha = smoothstep(1.0, 1.0 - soft, r);
  return mix(sky, mix(mix(sky, surface, 0.07), surface, lit), alpha * strength);
}

// --- The sun, printed -----------------------------------------------------

// A solid yellow disc (orange as it sinks), the pink plate a little off
// register, a glow of dots that thin out. Half dimmed: a dull sun looks
// like a mistake.
vec3 sunAt(vec3 sky, vec2 p, vec2 at, float radius, float strength, float pitch, float k, float elevation) {
  if (strength <= 0.0) return sky;
  vec2 d = p - at;
  float dist = length(d);
  float reach = radius * 3.4;
  if (dist > reach) return sky;
  float low = 1.0 - smoothstep(2.0, 22.0, elevation);
  vec3 discInk = mix(INK_YELLOW, INK_ORANGE, low * 0.8);
  vec3 overInk = mix(INK_ORANGE, INK_PINK, low);
  vec3 disc = mix(vivid(discInk * k, SATURATION), discInk, 0.5);
  vec3 over = mix(vivid(overInk * k, SATURATION), overInk, 0.5);
  if (dist > radius) {
    float density = 0.55 * exp(-(dist - radius) / (radius * 0.75)) * smoothstep(reach, reach * 0.6, dist);
    sky = mix(sky, disc, screen(p, density, pitch, 0.0) * strength * 0.8);
  }
  float cover = smoothstep(radius + 0.8, radius - 0.8, dist);
  if (cover > 0.0) {
    float starved = hashi(int(p.x) * 7919 + int(p.y) * 131) % 61u == 0u ? 0.55 : 1.0;
    sky = mix(sky, disc, cover * strength * starved);
  }
  vec2 o = d - radius * vec2(0.09, 0.07);
  float plate = smoothstep(radius * 0.92 + 0.8, radius * 0.92 - 0.8, length(o));
  if (plate > 0.0) {
    float density = 0.25 + 0.45 * clamp((o.x + o.y) / (radius * 1.6) + 0.5, 0.0, 1.0);
    sky = mix(sky, over, plate * screen(p, density, pitch, 75.0) * strength * 0.85);
  }
  return sky;
}

// --- Clouds ----------------------------------------------------------------


uint shapeRow(int kind, int row) {
  if (kind == 1) return row < 5 ? CLAWD[row] : 0u;
  if (kind == 2) return row < 6 ? HEART[row] : 0u;
  if (kind == 3) return row < 5 ? WHALE[row] : 0u;
  return row < 6 ? RABBIT[row] : 0u;
}

vec3 tone(vec3 c, float k) { return vivid(c * k, SATURATION); }

// The UFO among the clouds prints as the events do, further down.
vec3 ink(vec3 sky, vec3 color, float d, float alpha);
vec3 lift(vec3 c, float k);

// Clouds drift west to east and come back as new ones, lit from the sky
// behind them; printed, the lit tops take pink (violet by night, orange at
// sunset) and the undersides blue, two plates a little off register.
// kind: 0 cumulus, 1–4 a shape, 5 golden, 6 a ufo.
vec3 clouds(vec3 sky, vec2 p, Scene s, float unit, float k) {
  float w = iResolution.x;
  float h = iResolution.y;
  int count = int(floor(5.0 + COVER * 4.0 + 0.5));
  float baseSize = unit * 3.2;
  float pitch = max(3.0, unit * 0.24);
  float speed = (w / 1400.0) * (1.0 + WIND / 5.0);
  float opacity = 0.55 + COVER * 0.3;
  float day = smoothstep(-8.0, 6.0, s.elevation);
  float golden = clamp(1.0 - abs(s.elevation - 2.0) / 9.0, 0.0, 1.0);
  vec3 topInk = tone(mix(mix(INK_VIOLET, INK_PINK, day), INK_ORANGE, golden * 0.6), k);
  vec3 underInk = tone(mix(INK_INDIGO, INK_BLUE, day), k);
  float inkStrength = 0.45 + 0.35 * day;
  vec2 shift = vec2(pitch * 0.45, pitch * 0.3);

  for (int slot = 0; slot < 9; slot++) {
    if (slot >= count) break;
    float margin = baseSize * 6.0;
    float span = w + margin * 2.0;
    float travelled = rand(slot * 977 + 5) * span + iTime * speed * (0.6 + rand(slot * 31 + 2) * 0.8);
    int lap = int(floor(travelled / span));
    int seed = int(hashi(slot * 7919 + lap * 104729 + 11) >> 1u);
    int kind = 0;
    if (rand(seed + 3) < 0.08) kind = 1 + int(hashi(seed) % 6u);
    float size = baseSize * (0.7 + rand(seed + 9) * 0.6);
    vec2 o = vec2(mod(travelled, span) - margin, floor(h * (0.06 + 0.44 * rand(seed + 1))));
    vec2 q = p - o;

    if (kind == 6) {
      // Now and then not a cloud at all: a saucer, printed as the balloon
      // is, rocking a little, its lights running round its rim.
      float px = max(1.0, size / 6.0);
      vec2 v = q - vec2(3.5, 2.3) * px;
      if (abs(v.x) > 5.0 * px || abs(v.y) > 4.0 * px) continue;
      float tilt = sin(iTime * 1.3 + float(seed % 97)) * 0.08;
      v = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * v;
      v.y += sin(iTime * 1.7 + float(seed % 89)) * 0.25 * px;
      float hull = (length(v / vec2(3.6, 0.95)) - px) * 0.95;
      float dome = v.y < -0.3 * px ? length(v - vec2(0.0, -0.55 * px)) - 1.55 * px : 1e9;
      vec3 steel = mix(vec3(0.82, 0.84, 0.9), INK_BLUE, 0.15);
      vec3 body = mix(steel, mix(steel, INK_INDIGO, 0.45), screen(p, clamp(0.15 + v.y / px * 0.45, 0.0, 1.0), pitch, 45.0));
      vec3 glass = mix(mix(INK_BLUE, vec3(1.0), 0.35), vec3(1.0), screen(p, clamp(0.5 - (v.x + v.y) / px * 0.3, 0.0, 1.0), pitch, 15.0) * 0.6);
      sky = ink(sky, lift(glass, k), dome, 1.0);
      sky = ink(sky, lift(body, k), hull, 1.0);
      for (int j = 0; j < 5; j++) {
        bool isLit = int(floor(iTime * 3.0)) % 5 == j;
        sky = ink(sky, isLit ? INK_YELLOW : lift(INK_PINK, k), length(v - vec2(float(j - 2) * 1.25 * px, 0.25 * px)) - 0.3 * px, 1.0);
      }
      // The key plate, a little off register.
      vec2 w = v - vec2(0.12, 0.1) * px;
      float key = min(abs((length(w / vec2(3.6, 0.95)) - px) * 0.95), w.y < -0.3 * px ? abs(length(w - vec2(0.0, -0.55 * px)) - 1.55 * px) : 1e9);
      sky = ink(sky, lift(INK_INDIGO, k), key - 0.06 * px, 0.6);
      continue;
    }

    // Quick out: outside the widest a cloud of this size gets.
    if (q.x < -size * 2.0 || q.x > size * 7.0 || q.y < -size * 2.0 || q.y > size * 3.0) continue;

    float cover = 0.0;
    float minY = 1e9;
    float maxY = -1e9;
    float bottom = 0.0;
    if (kind == 0 || kind == 5) {
      // A cumulus: a row of puffs, the middle ones tallest, flat below.
      int puffs = 3 + int(uint(seed) % 4u);
      for (int i = 0; i < 6; i++) {
        if (i >= puffs) break;
        float middle = 1.0 - abs(float(i) / float(puffs - 1) - 0.5) * 1.2;
        float r = size * (0.35 + 0.35 * middle) * (0.8 + rand(seed + i) * 0.4);
        vec2 c = vec2(float(i) * size * 0.55, -r * 0.45);
        minY = min(minY, c.y - r * 1.6);
        maxY = max(maxY, c.y + r * 1.6);
        cover = max(cover, smoothstep(r, r - max(1.0, r * 0.35), length(q - c)));
      }
      bottom = maxY - (maxY - minY) * 0.35;
    } else {
      // A shape: puffs melted together, the cloud where r² / d² sums past 1.
      float cell = size * 0.42;
      float r = cell * 0.62;
      float sum = 0.0;
      for (int row = 0; row < 6; row++) {
        uint bits = shapeRow(kind, row);
        if (bits == 0u) continue;
        minY = min(minY, float(row) * cell - r * 1.6);
        maxY = max(maxY, float(row) * cell + r * 1.6);
        for (int col = 0; col < 14; col++) {
          if ((bits & (1u << uint(col))) == 0u) continue;
          vec2 d = q - vec2(float(col), float(row)) * cell;
          sum += r * r / (dot(d, d) + 0.5);
        }
      }
      cover = smoothstep(0.85, 1.6, sum);
      bottom = maxY;
    }
    if (cover <= 0.0 || q.y > bottom) continue;

    vec3 behind = sky;
    float lower = clamp((q.y - minY) / max(1.0, bottom - minY), 0.0, 1.0);
    vec3 lit = mix(mix(behind, tone(vec3(0.604, 0.639, 0.769), k), 0.22), mix(behind, tone(vec3(1.0), k), 0.6), day);
    vec3 shade = mix(lit, tone(vec3(1.0, 0.478, 0.541), k), golden * 0.55);
    vec3 color = mix(lit, mix(shade, grey(behind), 0.25), lower);
    if (kind == 5) color = mix(color, tone(vec3(1.0, 0.827, 0.42), k), 0.55 * (1.0 - lower * 0.5));

    // Printed: a pale body, then the two plates in halftone.
    sky = mix(sky, color, clamp(cover * opacity * 0.55, 0.0, 1.0));
    float topDots = screen(p, cover * (1.0 - lower) * 0.65, pitch, 75.0);
    sky = mix(sky, topInk, clamp(topDots * inkStrength * opacity, 0.0, 1.0));
    float underDots = screen(p - shift, cover * lower * 0.6, pitch, 15.0);
    sky = mix(sky, underInk, clamp(underDots * inkStrength * opacity, 0.0, 1.0));
  }
  return sky;
}

// --- Rain and snow ------------------------------------------------------

vec3 weather(vec3 sky, vec2 p, float unit) {
  if (PRECIPITATION == 0) return sky;
  bool isSnow = PRECIPITATION == 4;
  int every = PRECIPITATION == 1 ? 9 : PRECIPITATION == 2 ? 4 : PRECIPITATION == 3 ? 3 : 6;
  float fall = (isSnow ? 3.0 : PRECIPITATION == 1 ? 10.0 : PRECIPITATION == 2 ? 18.0 : 22.0) * unit * 0.6;
  float slant = min(2.0, WIND / 6.0);
  float h = iResolution.y;
  float gap = unit * 0.5;
  // Rain leans with the wind; each column carries one drop or flake.
  float x = isSnow ? p.x : p.x + p.y * slant * 0.15;
  int column = int(floor(x / gap));
  uint n = hashi(column * 4099 + 3);
  if (n % uint(every) != 0u) return sky;
  float streak = isSnow ? unit * 0.3 : unit * 1.4;
  float y = mod(float((n >> 5u) % 997u) + iTime * fall * (0.8 + float(n % 5u) * 0.1), h + streak * 2.0) - streak;
  float dx = isSnow ? x - (float(column) + 0.5) * gap - sin(iTime * 1.5 + float(n % 100u)) * unit * 0.3 * (1.0 + slant) : x - (float(column) + 0.5) * gap;
  float dy = p.y - y;
  float a = isSnow
    ? smoothstep(streak + 0.8, streak - 0.8, sqrt(dx * dx + dy * dy)) * 0.7
    : (abs(dx) < 1.0 && dy > 0.0 && dy < streak ? 0.3 * dy / streak : 0.0);
  vec3 color = isSnow ? vec3(1.0) : vec3(0.612, 0.769, 1.0);
  sky = mix(sky, color, a);
  // Now and then, lightning: the whole sky lights up for a moment.
  if (PRECIPITATION == 3 && mod(iTime, 6.0) < 0.12) sky = mix(sky, vec3(1.0, 0.953, 0.627), 0.25);
  return sky;
}


// --- Events ------------------------------------------------------------------

// A random number for an event's seed and a salt.
float seeded(float seed, int salt) { return rand(int(seed) * 7919 + salt * 104729 + 3); }

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * h);
}

// The constellations' lines near \`p\`: dashed and faint, as star charts draw them.
vec3 chartLines(vec3 sky, vec2 p, float u, float strength) {
  vec2 d = pixelToDome(p);
  int tile = chartTile(int(floor((d.x + 1.6) / 0.04)), int(floor(d.y / 0.04)));
  if (tile < 0) return sky;
  float line = 1e9;
  vec2 along = vec2(0.0);
  int first = LINE_TILE_START[tile];
  for (int k = first; k < first + LINE_TILE_COUNT[tile]; k++) {
    int i = LINE_TILE_LINE[k];
    vec2 a = domeToPixel(LINE_A[i]);
    vec2 b = domeToPixel(LINE_B[i]);
    float dist = segment(p, a, b);
    if (dist < line) { line = dist; along = a; }
  }
  if (line > 2.0) return sky;
  float dash = step(0.5, fract(length(p - along) / (0.5 * u)));
  return mix(sky, mix(INK_BLUE, vec3(1.0), 0.5), clamp(0.5 - (line - 0.05 * u), 0.0, 1.0) * 0.15 * dash * strength);
}

// An ink laid down by distance: solid inside, antialiased at the edge.
vec3 ink(vec3 sky, vec3 color, float d, float alpha) {
  return mix(sky, color, clamp(0.5 - d, 0.0, 1.0) * alpha);
}

// Half dimmed, as the sun is: small things stay visible on a dimmed sky.
vec3 lift(vec3 c, float k) { return mix(tone(c, k), c, 0.5); }

vec3 shootingStars(vec3 sky, vec2 p, float u) {
  float period = 3600.0 / SHOOTING_RATE;
  float slot = floor(iTime / period);
  int n = int(mod(slot, 100000.0));
  float start = slot * period + rand(n * 3 + 1) * max(0.1, period - 1.2);
  float age = iTime - start;
  if (age < 0.0 || age > 0.9) return sky;
  vec2 from = iResolution.xy * vec2(0.1 + 0.8 * rand(n * 3 + 2), 0.05 + 0.35 * rand(n * 3 + 3));
  vec2 dir = normalize(vec2(rand(n) < 0.5 ? -1.0 : 1.0, 0.45));
  vec2 head = from + dir * age * 24.0 * u;
  float tail = 9.0 * u * min(1.0, age / 0.15);
  float along = clamp(dot(head - p, dir) / tail, 0.0, 1.0);
  float d = segment(p, head - dir * tail, head);
  float fade = (1.0 - along) * (1.0 - age / 0.9);
  return mix(sky, mix(vec3(1.0, 0.97, 0.9), INK_YELLOW, along), clamp(0.5 - d + 0.6, 0.0, 1.0) * fade);
}

vec3 satellite(vec3 sky, vec2 p, float u, float seed, float t) {
  vec2 a = iResolution.xy * vec2(-0.05, 0.08 + 0.3 * seeded(seed, 1));
  vec2 b = iResolution.xy * vec2(1.05, 0.05 + 0.3 * seeded(seed, 2));
  vec2 at = mix(a, b, t);
  return ink(sky, vec3(1.0, 0.97, 0.9), length(p - at) - 0.14 * u, 0.9);
}

// The Swedish flag's blue and yellow, and the ink of night silhouettes.
const vec3 SWEDISH_BLUE = vec3(0.0, 0.42, 0.66);
const vec3 SWEDISH_YELLOW = vec3(1.0, 0.8, 0.0);
const vec3 NIGHT_INK = vec3(0.09, 0.08, 0.2);

vec3 balloon(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  float r = 2.2 * u;
  vec2 c = vec2(mix(-0.1, 1.1, t) * iResolution.x, iResolution.y * (0.22 + 0.2 * seeded(seed, 1)) - t * 3.0 * u + sin(iTime * 0.5) * 0.3 * u);
  vec2 q = p - c;
  if (abs(q.x) > 2.0 * r || q.y < -1.6 * r || q.y > 2.4 * r) return sky;
  // The envelope: a ball tapering to its mouth; the basket under it.
  float ball = length(q / vec2(1.0, 1.15)) - r;
  float fall = q.y / (1.7 * r);
  float shoulder = q.y > 0.0 && q.y < 1.55 * r ? r * (1.0 - fall * fall) : 0.0;
  float taper = shoulder > 0.0 ? abs(q.x) - shoulder : 1e9;
  float envelope = min(ball, taper);
  // How wide the envelope is at this height, so the gores follow its curve.
  float across = max(r * sqrt(max(0.0, 1.0 - pow(q.y / (1.15 * r), 2.0))), shoulder);
  vec2 b = abs(q - vec2(0.0, 1.9 * r)) - vec2(0.28, 0.16) * r;
  float basket = max(b.x, b.y);
  float ropes = min(segment(q, vec2(-0.32, 1.45) * r, vec2(-0.24, 1.75) * r), segment(q, vec2(0.32, 1.45) * r, vec2(0.24, 1.75) * r)) - 0.04 * u;
  // Gores in three inks, the seed choosing their order; shaded to the right.
  // Never below 0: % of a negative int is undefined in GLSL.
  int gore = max(int(floor((q.x / max(across, 0.01) + 2.0) * 3.0)), 0) + int(seed);
  // Blue and yellow on the national day.
  vec3 gores[3] = vec3[3](INK_PINK, INK_YELLOW, INK_ORANGE);
  if (FLAG_DAY > 0.5) {
    gores[0] = SWEDISH_BLUE;
    gores[2] = SWEDISH_BLUE;
  }
  vec3 color = gores[gore % 3];
  color = mix(color, mix(color, INK_INDIGO, 0.35), screen(p, clamp(q.x / r * 0.6 + 0.2, 0.0, 1.0), max(3.0, u * 0.24), 45.0));
  sky = ink(sky, lift(color, k), envelope, 1.0);
  sky = ink(sky, lift(mix(INK_ORANGE, INK_INDIGO, 0.4), k), min(basket, ropes), 1.0);
  // The key plate, a little off register.
  float key = abs(length((q - vec2(0.12, 0.1) * u) / vec2(1.0, 1.15)) - r) - 0.08 * u;
  return ink(sky, lift(INK_INDIGO, k), key, 0.7);
}

vec3 birds(vec3 sky, vec2 p, float u, float seed, float t) {
  bool isEast = seeded(seed, 1) < 0.5;
  vec2 lead = vec2(mix(-0.15, 1.15, isEast ? t : 1.0 - t) * iResolution.x, iResolution.y * (0.12 + 0.25 * seeded(seed, 2)));
  float back = isEast ? -1.0 : 1.0;
  if (abs(p.x - lead.x) > 9.0 * u || abs(p.y - lead.y) > 6.0 * u) return sky;
  float d = 1e9;
  for (int i = 0; i < 9; i++) {
    float rank = float((i + 1) / 2);
    float side = i % 2 == 0 ? 1.0 : -1.0;
    vec2 at = shy(lead + vec2(back * rank * 1.6 * u, side * rank * 0.9 * u), u);
    float flap = sin(iTime * 7.0 + float(i) * 1.3) * 0.35 * u;
    d = min(d, segment(p, at, at + vec2(-0.6 * u, -flap)));
    d = min(d, segment(p, at, at + vec2(0.6 * u, -flap)));
  }
  return ink(sky, mix(INK_INDIGO, vec3(0.0), 0.3), d - 0.09 * u, 0.85);
}

// A capsule from a to b whose radius runs from ra to rb.
float limb(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * h) - mix(ra, rb, h);
}

// An airliner seen from below, in its own frame (x towards the nose, y
// across, s its unit): fuselage, swept wings, tailplane.
float airframe(vec2 q, float s) {
  vec2 m = vec2(q.x, abs(q.y));
  float body = min(limb(q, vec2(1.5, 0.0) * s, vec2(1.0, 0.0) * s, 0.1 * s, 0.19 * s), limb(q, vec2(1.0, 0.0) * s, vec2(-1.55, 0.0) * s, 0.19 * s, 0.06 * s));
  float wing = limb(m, vec2(0.2, 0.0) * s, vec2(-0.5, 1.65) * s, 0.3 * s, 0.07 * s);
  float tail = limb(m, vec2(-1.2, 0.0) * s, vec2(-1.5, 0.65) * s, 0.14 * s, 0.05 * s);
  return min(body, min(wing, tail));
}

// An airliner crossing high up, printed as the balloon is; its contrails,
// one from each engine, drift together and widen, lit pink and orange
// when the sun is low. At night only its silhouette and lights.
vec3 plane(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  bool isEast = seeded(seed, 1) < 0.5;
  vec2 a = iResolution.xy * vec2(isEast ? -0.05 : 1.05, 0.1 + 0.25 * seeded(seed, 2));
  vec2 b = iResolution.xy * vec2(isEast ? 1.05 : -0.05, 0.05 + 0.2 * seeded(seed, 3));
  vec2 at = mix(a, b, t);
  vec2 dir = normalize(b - a);
  vec2 n = vec2(-dir.y, dir.x);
  float s = 1.1 * u;
  float elevation = sceneNow().elevation;
  bool isNight = elevation < -4.0;
  float behind = dot(at - p, dir);
  if (behind > 0.0 && !isNight) {
    float across = dot(p - at, n);
    float spread = mix(0.6 * s, 0.22 * s, smoothstep(0.0, 0.3 * iResolution.x, behind));
    float width = 0.08 * u + behind * 0.01;
    float fade = 0.6 * exp(-behind / (0.5 * iResolution.x)) * smoothstep(1.4 * s, 3.5 * s, behind);
    float cover = max(smoothstep(width + 0.8, width - 0.8, abs(across - spread)), smoothstep(width + 0.8, width - 0.8, abs(across + spread))) * fade;
    vec3 trail = mix(vec3(1.0), mix(INK_PINK, INK_ORANGE, 0.45), smoothstep(16.0, 4.0, elevation) * 0.8);
    sky = mix(sky, lift(trail, k), screen(p, cover, max(3.0, u * 0.24), 30.0) * 0.8 + cover * 0.25);
  }
  vec2 d = p - at;
  vec2 q = vec2(dot(d, dir), dot(d, n));
  if (abs(q.x) > 2.0 * s || abs(q.y) > 2.0 * s) return sky;
  float frame = airframe(q, s);
  float engines = limb(vec2(q.x, abs(q.y)), vec2(0.55, 0.6) * s, vec2(0.0, 0.6) * s, 0.12 * s, 0.1 * s);
  if (isNight) {
    sky = ink(sky, NIGHT_INK, min(frame, engines), 0.9);
    // Red on one wingtip, green on the other, a white strobe at the tail.
    vec2 tip = vec2(-0.5, 1.65) * s;
    sky = ink(sky, vec3(1.0, 0.25, 0.2), length(q - vec2(tip.x, -tip.y)) - 0.12 * u, 1.0);
    sky = ink(sky, vec3(0.3, 1.0, 0.5), length(q - tip) - 0.12 * u, 1.0);
    return ink(sky, vec3(1.0), length(q - vec2(-1.55 * s, 0.0)) - 0.14 * u, step(0.85, fract(iTime * 0.8)));
  }
  // The underside pale, screened darker to one side; the engines in the
  // seed's ink.
  vec3 belly = mix(vec3(0.97, 0.96, 0.93), INK_BLUE, 0.08);
  vec3 color = mix(belly, mix(belly, INK_INDIGO, 0.35), screen(p, clamp(0.3 - q.y / s * 0.35, 0.0, 1.0), max(3.0, u * 0.24), 45.0));
  sky = ink(sky, lift(color, k), frame, 1.0);
  vec3 accents[3] = vec3[3](INK_PINK, INK_ORANGE, INK_BLUE);
  sky = ink(sky, lift(accents[int(seeded(seed, 4) * 3.0) % 3], k), engines, 1.0);
  // The key plate, a little off register.
  vec2 off = d - vec2(0.12, 0.1) * u;
  float key = abs(airframe(vec2(dot(off, dir), dot(off, n)), s)) - 0.06 * u;
  return ink(sky, lift(INK_INDIGO, k), key, 0.7);
}

// Three inks screened at their own angles: where they overlap the dots
// mix, orange where pink meets yellow, green where yellow meets blue.
vec3 rainbow(vec3 sky, vec2 p, float k) {
  vec2 c = iResolution.xy * vec2(0.12, 1.2);
  float radius = iResolution.y * 0.78;
  float band = iResolution.y * 0.035;
  float r = length(p - c);
  float pitch = max(3.0, iResolution.y / 60.0 * 0.24);
  // Fading toward the ground and toward the arc's ends.
  float fade = 0.75 * smoothstep(iResolution.y * 1.0, iResolution.y * 0.55, p.y);
  vec3 inks[3] = vec3[3](INK_PINK, INK_YELLOW, INK_BLUE);
  float angles[3] = float[3](75.0, 0.0, 15.0);
  for (int i = 0; i < 3; i++) {
    float centre = radius + (1.0 - float(i)) * band;
    float cover = smoothstep(band * 1.1, band * 0.3, abs(r - centre)) * fade;
    sky = mix(sky, lift(inks[i], k), screen(p, cover * 0.7, pitch, angles[i]) * 0.75);
  }
  return sky;
}

vec3 kite(vec3 sky, vec2 p, float u, float seed, float k) {
  vec2 anchor = vec2(iResolution.x * (0.2 + 0.2 * seeded(seed, 1)), iResolution.y);
  vec2 at = vec2(iResolution.x * (0.35 + 0.2 * seeded(seed, 2)) + sin(iTime * 0.7) * 1.5 * u, iResolution.y * (0.22 + 0.1 * seeded(seed, 3)) + sin(iTime * 1.1) * 0.8 * u);
  float tilt = sin(iTime * 0.9) * 0.25;
  vec2 q = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * (p - at);
  float diamond = (abs(q.x) / (0.9 * u) + abs(q.y) / (1.3 * u) - 1.0) * 0.9 * u;
  vec3 color = (q.x < 0.0) == (q.y < 0.0) ? INK_PINK : INK_YELLOW;
  sky = ink(sky, lift(INK_INDIGO, k), segment(p, at + vec2(0.0, 1.3 * u), anchor) - 0.03 * u, 0.5);
  for (int j = 0; j < 6; j++) {
    vec2 bow = at + vec2(sin(iTime * 2.0 + float(j)) * 0.5 * u, (float(j) + 1.6) * 0.7 * u);
    sky = ink(sky, lift(j % 2 == 0 ? INK_BLUE : INK_PINK, k), length((p - bow) / vec2(1.6, 1.0)) - 0.16 * u, 1.0);
  }
  sky = ink(sky, lift(color, k), diamond, 1.0);
  return ink(sky, lift(INK_INDIGO, k), abs(diamond) - 0.06 * u, 0.6);
}

// Leaves (or petals) tumbling across on the wind.
vec3 drift(vec3 sky, vec2 p, float u, float seed, bool isBlossom, float k) {
  vec3 leaf[3] = vec3[3](INK_ORANGE, INK_YELLOW, mix(INK_ORANGE, INK_PINK, 0.5));
  vec3 petal[3] = vec3[3](INK_PINK, vec3(0.98, 0.9, 0.93), mix(INK_PINK, vec3(1.0), 0.5));
  for (int i = 0; i < 18; i++) {
    float a = seeded(seed, i * 4);
    float b = seeded(seed, i * 4 + 1);
    float span = iResolution.x + 4.0 * u;
    float x = mod(a * span + iTime * (2.0 + WIND * 0.6) * u * (0.6 + 0.8 * b), span) - 2.0 * u;
    float y = mod(b * iResolution.y + iTime * 0.9 * u * (0.5 + a), iResolution.y + 4.0 * u) - 2.0 * u + sin(iTime * 1.7 + a * 9.0) * u;
    vec2 q = p - shy(vec2(x, y), u);
    if (dot(q, q) > u * u) continue;
    float spin = iTime * (1.5 + 2.0 * a) + b * 6.0;
    q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
    vec2 size = isBlossom ? vec2(0.22, 0.14) * u : vec2(0.36, 0.17) * u;
    float d = (length(q / size) - 1.0) * min(size.x, size.y);
    sky = ink(sky, lift(isBlossom ? petal[i % 3] : leaf[i % 3], k), d, 0.95);
  }
  return sky;
}

vec3 comet(vec3 sky, vec2 p, float u, float seed) {
  vec2 head = domeToPixel(COMET_AT);
  // The ion tail points straight away from the sun; the dust tail lags a
  // little behind, curving.
  vec2 ion = vec2(cos(COMET_AWAY), sin(COMET_AWAY));
  vec2 dir = normalize(ion - vec2(-ion.y, ion.x) * 0.18);
  vec2 side = vec2(-dir.y, dir.x);
  float pitch = max(3.0, u * 0.24);
  float pulse = 0.9 + 0.1 * sin(iTime * 1.6);
  vec2 q = p - head;
  float along = dot(q, dir);
  if (along > -2.0 * u) {
    // The dust tail: a broad fan, densest along its spine and fading
    // softly to its edges, yellow printed over pink so the curve's outer
    // edge runs orange.
    float a = max(along, 0.0);
    float bend = a * a * 0.0006 / u;
    float width = 0.5 * u + a * 0.11;
    float across = (dot(q, side) - bend) / width;
    float fall = exp(-a / (10.0 * u)) * smoothstep(-2.0 * u, 0.8 * u, along);
    float edge = exp(-pow(across - 0.45, 2.0) * 4.0) * fall * smoothstep(0.0, 4.0 * u, a);
    sky = mix(sky, INK_PINK, screen(p, edge * 0.5, pitch, 75.0) * 0.85);
    float spine = exp(-across * across * 2.2) * fall;
    sky = mix(sky, INK_YELLOW, screen(p, spine * 0.8, pitch, 0.0) * 0.9);
    // Grains carried out down the tail, an even stream with no start.
    vec2 g = vec2(a / (1.6 * u) - iTime * 0.9, across * width / (0.9 * u));
    vec2 cell = floor(g);
    int n = int(cell.x) * 7919 + int(cell.y) * 104729 + int(seed);
    if (rand(n) < 0.3) {
      vec2 f = fract(g) - 0.2 - vec2(rand(n + 1), rand(n + 2)) * 0.6;
      float grain = smoothstep(0.24, 0.0, length(f)) * exp(-a / (14.0 * u)) * exp(-across * across * 1.5);
      sky = mix(sky, vec3(1.0, 0.95, 0.75), grain);
    }
  }
  // The ion tail: straight, narrow, blue, fluttering a little.
  float ionAlong = dot(q, ion);
  if (ionAlong > 0.0) {
    vec2 ionSide = vec2(-ion.y, ion.x);
    float flutter = sin(iTime * 0.7 + ionAlong * 0.05) * ionAlong * 0.012;
    float ionD = abs(dot(q, ionSide) - flutter);
    float ionCover = exp(-ionAlong / (18.0 * u)) * smoothstep(0.2 * u + ionAlong * 0.012, 0.0, ionD);
    sky = mix(sky, mix(INK_BLUE, vec3(1.0), 0.35), screen(p, ionCover * 0.75, pitch, 15.0) * 0.8);
  }
  // The coma: green, as a comet's is, screened round a bright nucleus
  // that breathes.
  float r = length(q);
  sky = mix(sky, mix(INK_GREEN, vec3(1.0), 0.35), screen(p, exp(-r / (0.75 * u * pulse)) * smoothstep(3.0 * u, 1.0 * u, r) * 0.9, pitch, 30.0) * 0.85);
  sky = mix(sky, vec3(1.0, 0.98, 0.9), 0.55 * exp(-r / (0.35 * u * pulse)));
  return ink(sky, vec3(1.0, 0.98, 0.92), r - 0.25 * u, 1.0);
}

// Clawd among the stars: his outline joined by faint lines, his eyes the brightest.
const vec2 FIGURE[12] = vec2[12](vec2(1.0, 0.0), vec2(6.0, 0.0), vec2(6.0, 1.4), vec2(7.2, 2.0), vec2(6.0, 2.6), vec2(6.0, 3.2),
  vec2(1.0, 3.2), vec2(1.0, 2.6), vec2(-0.2, 2.0), vec2(1.0, 1.4), vec2(2.0, 4.4), vec2(5.0, 4.4));
vec3 constellation(vec3 sky, vec2 p, float u, float seed) {
  float s = 1.7 * u;
  // Left of the arc and below where a comet would hang.
  vec2 o = iResolution.xy * vec2(0.08 + 0.22 * seeded(seed, 1), 0.34 + 0.12 * seeded(seed, 2));
  float line = 1e9;
  for (int i = 0; i < 10; i++) line = min(line, segment(p, o + FIGURE[i] * s, o + FIGURE[(i + 1) % 10] * s));
  line = min(line, segment(p, o + vec2(2.0, 3.2) * s, o + FIGURE[10] * s));
  line = min(line, segment(p, o + vec2(5.0, 3.2) * s, o + FIGURE[11] * s));
  // Dashed, as star charts draw them.
  float dash = step(0.5, fract(dot(p - o, vec2(0.7, 0.7)) / (0.5 * u)));
  sky = mix(sky, mix(INK_BLUE, vec3(1.0), 0.5), clamp(0.5 - (line - 0.05 * u), 0.0, 1.0) * 0.22 * dash);
  for (int i = 0; i < 12; i++) {
    float twinkle = 0.75 + 0.25 * sin(iTime * (1.3 + float(i) * 0.37) + float(i));
    sky = ink(sky, vec3(1.0, 0.97, 0.9), length(p - o - FIGURE[i] * s) - 0.13 * u, twinkle);
  }
  vec2 eyes[2] = vec2[2](vec2(2.4, 1.2), vec2(4.6, 1.2));
  for (int i = 0; i < 2; i++) sky = ink(sky, INK_YELLOW, length(p - o - eyes[i] * s) - 0.2 * u, 0.95);
  return sky;
}

// A milestone: risograph confetti raining over the whole window for its
// twenty seconds. Each piece falls down its own column round and round,
// so the rain is as thick at any moment: Ghostty's unknown start of iTime
// never shows as a burst missed or half over.
vec3 confetti(vec3 sky, vec2 p, float u, float seed, float k) {
  vec3 inks[5] = vec3[5](INK_PINK, INK_YELLOW, INK_BLUE, INK_GREEN, INK_ORANGE);
  float fall = iResolution.y + 4.0 * u;
  for (int i = 0; i < 48; i++) {
    float a = seeded(seed, i * 3);
    float b = seeded(seed, i * 3 + 1);
    float x = a * iResolution.x + sin(iTime * (1.0 + b) + a * 7.0) * 1.2 * u;
    float y = mod(b * fall + iTime * (2.5 + 3.0 * a) * u, fall) - 2.0 * u;
    vec2 q = p - vec2(x, y);
    if (dot(q, q) > u * u) continue;
    float spin = iTime * (2.0 + 3.0 * b) + a * 6.0;
    q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
    vec2 e = abs(q) - vec2(0.45, 0.2) * u;
    sky = ink(sky, lift(inks[i % 5], k), max(e.x, e.y), 1.0);
  }
  return sky;
}

// --- The Swedish days -------------------------------------------------------

float box(vec2 q, vec2 b) { vec2 d = abs(q) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

// Maundy Thursday night: a påskkärring on her broom, a coffee pot hanging
// from it, on her way past the moon to Blåkulla.
vec3 witch(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  vec2 c = vec2(mix(1.1, -0.1, t) * iResolution.x, iResolution.y * (0.16 + 0.12 * seeded(seed, 1)) + sin(t * 18.0) * 0.4 * u);
  vec2 q = (p - c) / (2.2 * u);
  if (dot(q, q) > 9.0) return sky;
  // The broom, tilted, its bristles fanning out behind.
  float stick = segment(q, vec2(-1.4, -0.15), vec2(1.3, 0.25)) - 0.05;
  vec2 b = q - vec2(1.3, 0.25);
  float bristles = b.x > 0.0 && b.x < 0.9 && abs(b.y) < 0.12 + b.x * 0.35 ? -0.01 : 1.0;
  sky = ink(sky, NIGHT_INK, min(stick, bristles) * 2.2 * u, 0.95);
  // Her skirt, shawl and kerchief.
  // The skirt widens to its hem; corners rounded.
  vec2 hem = q - vec2(0.2, -0.25);
  hem.x /= 1.0 + 0.6 * clamp(hem.y / 0.28, -1.0, 1.0) * 0.5;
  sky = ink(sky, lift(INK_ORANGE, k), (box(hem, vec2(0.36, 0.24)) - 0.06) * 2.2 * u, 0.95);
  sky = ink(sky, lift(INK_PINK, k), (box(q - vec2(0.12, -0.7), vec2(0.24, 0.16)) - 0.08) * 2.2 * u, 0.95);
  sky = ink(sky, lift(INK_YELLOW, k), (length(q - vec2(-0.02, -1.08)) - 0.2) * 2.2 * u, 0.95);
  // The coffee pot, swinging.
  vec2 pot = q - vec2(-0.9 + 0.08 * sin(iTime * 3.0), 0.35);
  return ink(sky, NIGHT_INK, (length(pot / vec2(1.0, 1.2)) - 0.17) * 2.2 * u, 0.95);
}

// Feathers drifting down, dyed as for the påskris.
vec3 feathers(vec3 sky, vec2 p, float u, float seed, float k) {
  vec3 dye[5] = vec3[5](INK_PINK, INK_YELLOW, INK_GREEN, INK_ORANGE, INK_VIOLET);
  for (int i = 0; i < 14; i++) {
    float a = seeded(seed, i * 4 + 50);
    float b = seeded(seed, i * 4 + 51);
    float x = a * iResolution.x + sin(iTime * (0.6 + a) + b * 7.0) * 1.5 * u;
    float y = mod(b * iResolution.y + iTime * 0.6 * u * (0.6 + a), iResolution.y + 4.0 * u) - 2.0 * u;
    vec2 q = p - shy(vec2(x, y), u);
    if (dot(q, q) > 1.5 * u * u) continue;
    float sway = 0.6 * sin(iTime * (1.1 + a) + b * 5.0);
    q = mat2(cos(sway), -sin(sway), sin(sway), cos(sway)) * q;
    sky = ink(sky, lift(dye[i % 5], k), (length(q / vec2(0.18 * u, 0.55 * u)) - 1.0) * 0.18 * u, 0.9);
    sky = ink(sky, vec3(0.97, 0.95, 0.9), abs(q.x) - 0.03 * u + max(0.0, abs(q.y) - 0.6 * u), 0.8);
  }
  return sky;
}

// The national day: a Swedish flag on a pole at the horizon, waving.
vec3 flag(vec3 sky, vec2 p, float u) {
  float foot = 0.62 * iResolution.y;
  float x = 0.72 * iResolution.x;
  float h = 5.0 * u;
  sky = ink(sky, vec3(0.95, 0.94, 0.9), box(p - vec2(x, foot - h * 0.5), vec2(0.07 * u, h * 0.5)), 0.95);
  vec2 q = p - vec2(x + 0.07 * u, foot - h + 0.1 * u);
  float w = 2.6 * u;
  float fly = clamp(q.x / w, 0.0, 1.0);
  float wave = sin(fly * 5.0 - iTime * 3.0);
  q.y -= wave * 0.16 * u * fly;
  if (q.x < 0.0 || q.x > w || q.y < 0.0 || q.y > 1.62 * u) return sky;
  // The cross at 5:2:9 across and 4:2:4 down.
  bool isCross = abs(q.x / w - 0.3125) < 0.0625 || abs(q.y / (1.62 * u) - 0.5) < 0.1;
  return mix(sky, (isCross ? SWEDISH_YELLOW : SWEDISH_BLUE) * (0.85 + 0.15 * wave), 0.95);
}

// Midsummer's Eve: a maypole dressed in green with its two rings.
vec3 maypole(vec3 sky, vec2 p, float u, float k) {
  float foot = 0.62 * iResolution.y;
  float x = 0.72 * iResolution.x;
  float h = 5.5 * u;
  vec3 green = lift(INK_GREEN, k);
  sky = ink(sky, green, box(p - vec2(x, foot - h * 0.5), vec2(0.12 * u, h * 0.5)), 0.95);
  sky = ink(sky, green, box(p - vec2(x, foot - h * 0.78), vec2(1.3 * u, 0.1 * u)), 0.95);
  for (int side = -1; side <= 1; side += 2) {
    vec2 ring = p - vec2(x + float(side) * 1.1 * u, foot - h * 0.78 + 0.75 * u + sin(iTime * 1.2 + float(side)) * 0.08 * u);
    sky = ink(sky, green, abs(length(ring) - 0.55 * u) - 0.09 * u, 0.95);
    float a = atan(ring.y, ring.x) * 1.6;
    if (fract(a) < 0.3) {
      vec3 flower = mod(floor(a), 2.0) < 1.0 ? INK_PINK : INK_YELLOW;
      sky = ink(sky, lift(flower, k), length(ring - normalize(ring) * 0.55 * u) - 0.12 * u, 0.95);
    }
  }
  return sky;
}

// Lucia morning: a procession in white with candles, walking slowly along
// the horizon, the flames flickering; Lucia first, a crown of light.
vec3 luciaTrain(vec3 sky, vec2 p, float u, float t) {
  float foot = 0.62 * iResolution.y;
  for (int i = 0; i < 9; i++) {
    float x = (mix(-0.15, 1.15, t) - float(i) * 0.022) * iResolution.x;
    vec2 q = p - vec2(x, foot);
    if (abs(q.x) > u || q.y < -2.4 * u || q.y > 0.2 * u) continue;
    sky = ink(sky, vec3(0.96, 0.95, 0.92), box(q - vec2(0.0, -0.6 * u), vec2(0.22 * u, 0.6 * u)), 0.95);
    sky = ink(sky, vec3(0.98, 0.86, 0.72), length(q - vec2(0.0, -1.38 * u)) - 0.18 * u, 0.95);
    float flicker = 0.75 + 0.25 * sin(iTime * (9.0 + float(i)) + float(i) * 2.0);
    vec2 flame = i == 0 ? vec2(0.0, -1.75 * u) : vec2(0.25 * u, -0.95 * u);
    sky = mix(sky, vec3(1.0, 0.82, 0.45), 0.6 * flicker * exp(-length(q - flame) / (0.35 * u)));
    sky = ink(sky, vec3(1.0, 0.93, 0.7), length((q - flame) / vec2(1.0, 1.6)) - 0.08 * u, flicker);
  }
  return sky;
}

// Christmas Eve: a bright star, four long points and a soft glow.
vec3 christmasStar(vec3 sky, vec2 p, float u) {
  vec2 q = p - vec2(0.3 * iResolution.x, 0.14 * iResolution.y);
  float d = length(q);
  if (d > 6.0 * u) return sky;
  float rays = exp(-abs(q.x) / (0.05 * u)) * exp(-abs(q.y) / (2.4 * u)) + exp(-abs(q.y) / (0.05 * u)) * exp(-abs(q.x) / (1.6 * u));
  float glow = exp(-d / (0.5 * u)) * (0.9 + 0.1 * sin(iTime * 1.3));
  return mix(sky, vec3(1.0, 0.97, 0.85), clamp(glow + rays * 0.8, 0.0, 1.0));
}

// Christmas Eve: the tomte in his sleigh behind a reindeer, crossing.
vec3 sleigh(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  vec2 c = vec2(mix(-0.12, 1.12, t) * iResolution.x, iResolution.y * (0.2 + 0.1 * seeded(seed, 2)) - sin(t * 3.14159) * 2.0 * u);
  vec2 q = (p - c) / (1.7 * u);
  if (abs(q.x) > 4.5 || abs(q.y) > 2.0) return sky;
  // The reindeer ahead, legs running, antlers up; the reins.
  float run = sin(iTime * 9.0) * 0.15;
  float deer = min(box(q - vec2(2.6, -0.2), vec2(0.55, 0.22)), length(q - vec2(3.25, -0.55)) - 0.18);
  deer = min(deer, min(segment(q, vec2(2.2, 0.0), vec2(2.1 - run, 0.55)) - 0.06, segment(q, vec2(3.0, 0.0), vec2(3.1 + run, 0.55)) - 0.06));
  deer = min(deer, segment(q, vec2(3.3, -0.7), vec2(3.5, -1.1)) - 0.04);
  vec3 brown = lift(vec3(0.62, 0.42, 0.26), k);
  sky = ink(sky, brown, deer * 1.7 * u, 0.95);
  sky = ink(sky, NIGHT_INK, (segment(q, vec2(0.9, -0.1), vec2(2.1, -0.2)) - 0.03) * 1.7 * u, 0.9);
  // The sleigh, and its runner.
  sky = ink(sky, lift(INK_PINK, k) * 0.9, box(q, vec2(0.85, 0.3)) * 1.7 * u, 0.95);
  sky = ink(sky, NIGHT_INK, (segment(q, vec2(-0.9, 0.45), vec2(0.9, 0.45)) - 0.05) * 1.7 * u, 0.95);
  // The tomte: red coat and cap, white beard.
  vec3 red = vec3(0.95, 0.3, 0.28);
  sky = ink(sky, red, (length(q - vec2(-0.2, -0.55)) - 0.32) * 1.7 * u, 0.95);
  sky = ink(sky, vec3(0.97, 0.95, 0.92), (length(q - vec2(0.0, -0.45)) - 0.16) * 1.7 * u, 0.95);
  float cap = segment(q, vec2(-0.25, -0.8), vec2(-0.55, -1.3)) - 0.12;
  return ink(sky, red, cap * 1.7 * u, 0.95);
}

// New Year: rockets bursting into rings of sparks and falling away, as
// many as the hour calls for. Each burst lives two seconds in a slot of its
// own, so the display has no start to show.
vec3 fireworks(vec3 sky, vec2 p, float u, float k) {
  vec3 colors[4] = vec3[4](INK_PINK, INK_YELLOW, INK_GREEN, INK_BLUE);
  for (int i = 0; i < 8; i++) {
    float clock = iTime / 2.0 + float(i) * 0.37;
    float slot = floor(clock);
    int n = int(slot) * 31 + i * 977;
    if (rand(n) > FIREWORKS) continue;
    float age = fract(clock);
    vec2 c = vec2((0.1 + 0.8 * rand(n + 1)) * iResolution.x, (0.08 + 0.35 * rand(n + 2)) * iResolution.y + age * age * 1.5 * u);
    vec2 q = p - c;
    float reach = (3.0 + 3.0 * rand(n + 3)) * u * sqrt(age);
    float d = length(q);
    if (d > reach + u) continue;
    vec3 color = lift(colors[(i + int(slot)) % 4], k);
    float fade = (1.0 - age) * (1.0 - age);
    // A glow over the burst, then the sparks: an outer ring and a trailing inner one.
    sky = mix(sky, color, 0.18 * fade * exp(-d / reach));
    float a = atan(q.y, q.x) / 6.28318 * 16.0;
    float spark = length(vec2((fract(a) - 0.5) * 6.28318 / 16.0 * d, d - reach));
    float trail = length(vec2((fract(a + 0.5) - 0.5) * 6.28318 / 16.0 * d, d - reach * 0.62));
    sky = ink(sky, color, spark - 0.2 * u, fade);
    sky = ink(sky, color, trail - 0.12 * u, fade * 0.6);
  }
  return sky;
}

// The dolphin lives with the lighthouse's sea, further down.
vec3 dolphin(vec3 sky, vec2 p, float u, float seed, float k, bool isPink);

// Every event up now; \`isBehind\` draws only what sits behind the clouds.
vec3 events(vec3 sky, vec2 p, float u, float k, bool isBehind) {
  if (isBehind) {
    if (SHOOTING_RATE > 0.0) sky = shootingStars(sky, p, u);
  }
  for (int i = 0; i < EVENT_COUNT; i++) {
    int kind = EVENT_KIND[i];
    float seed = EVENT_SEED[i];
    float t = fract(iTime / EVENT_SECONDS[i] + seed * 0.001);
    if (isBehind) {
      if (kind == 1) sky = satellite(sky, p, u, seed, t);
      if (kind == 5) sky = rainbow(sky, p, k);
      if (kind == 9) sky = comet(sky, p, u, seed);
      if (kind == 10) sky = constellation(sky, p, u, seed);
      if (kind == 18) sky = christmasStar(sky, p, u);
      continue;
    }
    if (kind == 2) sky = balloon(sky, p, u, seed, t, k);
    if (kind == 3) sky = birds(sky, p, u, seed, t);
    if (kind == 4) sky = plane(sky, p, u, seed, t, k);
    if (kind == 6) sky = kite(sky, p, u, seed, k);
    if (kind == 7 || kind == 8) sky = drift(sky, p, u, seed, kind == 8, k);
    if (kind == 11) sky = confetti(sky, p, u, seed, k);
    if (kind == 13) sky = witch(sky, p, u, seed, t, k);
    if (kind == 14) sky = feathers(sky, p, u, seed, k);
    if (kind == 15) sky = flag(sky, p, u);
    if (kind == 16) sky = maypole(sky, p, u, k);
    if (kind == 17) sky = luciaTrain(sky, p, u, t);
    if (kind == 19) sky = sleigh(sky, p, u, seed, t, k);
    if (kind == 20) sky = fireworks(sky, p, u, k);
    if (kind == 21 || kind == 22) sky = dolphin(sky, p, u, seed, k, kind == 22);
  }
  return sky;
}

// --- The ISS -----------------------------------------------------------------

// The station on a real pass: a steady, faintly yellow point, brighter than
// the stars, with a short fading trail back along its way. The mod writes
// its place every two seconds while it passes.
vec3 iss(vec3 sky, vec2 p, float u) {
  vec2 at = domeToPixel(ISS_AT);
  vec2 back = domeToPixel(ISS_TRAIL);
  vec2 way = at - back;
  float h = clamp(dot(p - back, way) / max(dot(way, way), 1e-6), 0.0, 1.0);
  float line = length(p - back - way * h);
  sky = mix(sky, vec3(1.0, 0.95, 0.8), clamp(0.6 - line, 0.0, 1.0) * h * h * 0.45);
  float d = length(p - at);
  sky = mix(sky, vec3(1.0, 0.96, 0.82), 0.4 * exp(-d / (0.25 * u)));
  return ink(sky, vec3(1.0, 0.98, 0.9), d - 0.12 * u, 1.0);
}

// --- The lighthouse --------------------------------------------------------

// The sea on the horizon at the right, fading out toward the middle and
// down into the sky: halftone ripples drifting, the low sun glittering in
// it and a lit lighthouse's lantern too. \`glow\` is the lantern's light.
vec3 sea(vec3 sky, vec2 p, float u, float k, vec3 glow, float glowStrength) {
  float level = ARC.w * iResolution.y;
  if (p.y < level) return sky;
  float depth = (p.y - level) / iResolution.y;
  float cover = smoothstep(0.62, 0.78, p.x / iResolution.x) * smoothstep(0.08, 0.025, depth);
  if (cover <= 0.0) return sky;
  float pitch = max(3.0, u * 0.24);
  vec3 water = mix(sky * 0.8, tone(mix(INK_BLUE, INK_INDIGO, 0.5), k) * (1.0 - 0.7 * nightness(sceneNow().elevation)), 0.45);
  // Ripples: short dashes on rows that crowd together toward the horizon.
  float row = sqrt((p.y - level + 1.0) / (0.05 * u));
  float onRow = smoothstep(0.2, 0.0, abs(fract(row) - 0.5));
  float dash = smoothstep(0.35, 0.9, sin(p.x / (0.7 * u) + floor(row) * 2.3 + iTime * 0.7) * sin(p.x / (2.9 * u) - floor(row) * 1.1 + iTime * 0.3));
  water = mix(water, mix(water, sky * 1.25 + 0.05, 0.6), screen(p, onRow * dash * 0.8, pitch, 0.0));
  // The sun low over it glitters in a broken column beneath it.
  Scene sc = sceneNow();
  if (sc.isDay > 0.5 && sc.elevation < 25.0) {
    vec2 sun = arcPoint(sc.progress);
    float column = exp(-abs(p.x - sun.x) / (0.8 * u * (1.0 + depth * 12.0)));
    float glint = column * onRow * smoothstep(0.2, 0.7, sin(p.x / (0.6 * u) + floor(row) * 1.7 - iTime * 1.3));
    vec3 gold = mix(INK_YELLOW, INK_ORANGE, smoothstep(12.0, 2.0, sc.elevation));
    water = mix(water, gold, screen(p, glint, pitch, 0.0) * 0.9);
  }
  // A lit lantern's light on the water below it.
  if (glowStrength > 0.0) {
    float column = exp(-abs(p.x - 0.88 * iResolution.x) / (0.5 * u * (1.0 + depth * 10.0)));
    water = mix(water, glow, screen(p, column * onRow * glowStrength, pitch, 15.0) * 0.9);
  }
  return mix(sky, water, cover);
}

// A small striped lighthouse far off on the horizon at the right, on its
// rocks in the sea: always there, its lantern dark until Claude waits, then
// lit (orange asking, white done) and hurrying once a question has waited.
// Its beam turns as a real one does: seen from the side it reaches out
// left or right as long as it points across, and flashes in the lantern
// as it comes round toward you. Any moment of the turn looks right, so
// iTime's unknown start never shows.
vec3 beacon(vec3 sky, vec2 p, float u, float k) {
  // Its own unit, smaller than the sky's: it stands far off.
  float s = 0.65 * u;
  float foot = ARC.w * iResolution.y;
  float x = 0.88 * iResolution.x;
  float h = 5.0 * s;
  float deck = foot - h;
  vec2 lantern = vec2(x, deck - 0.35 * s);
  vec2 v = p - lantern;
  vec3 light = BEACON == 1 ? INK_ORANGE : vec3(1.0, 0.97, 0.9);
  float speed = BEACON_URGENT > 0.5 ? 1.2 : 0.6;
  float strength = BEACON_URGENT > 0.5 ? 1.0 : 0.75;
  float phase = iTime * speed;
  float toward = max(0.0, sin(phase));

  sky = sea(sky, p, u, k, light, BEACON != 0 ? 0.35 + 0.45 * toward : 0.0);
  if (BEACON != 0) {
    // The beam, behind the tower.
    float across = cos(phase);
    vec2 dir = normalize(vec2(across >= 0.0 ? 1.0 : -1.0, -0.05));
    float along = dot(v, dir);
    float reach = 0.45 * iResolution.y * abs(across);
    if (along > 0.0 && along < reach && p.y < foot) {
      float off = abs(dot(v, vec2(-dir.y, dir.x)));
      float spread = along * 0.105 + 0.15 * s;
      float cover = pow(1.0 - along / reach, 1.5) * smoothstep(spread, spread * 0.35, off);
      sky = mix(sky, light, clamp(cover * 0.5 * strength, 0.0, 1.0));
    }
    // The flash as the beam comes round toward you.
    float glow = exp(-length(v) / (s * (0.5 + 1.4 * toward * toward)));
    sky = mix(sky, light, clamp(glow * (0.35 + 0.55 * toward) * (0.6 + 0.4 * strength), 0.0, 1.0));
  }
  if (abs(p.x - x) > 3.0 * s || p.y < deck - 2.0 * s || p.y > foot + 1.0 * s) return sky;

  // Far off, everything takes some of the sky's colour, and the night's dark.
  float haze = 0.3;
  float dark = 1.0 - 0.6 * nightness(sceneNow().elevation);
  vec3 indigo = mix(tone(INK_INDIGO, k) * dark, sky, haze);
  // The rocks it stands on, lighter on top, the water lapping at them.
  float rocks = min(min(length((p - vec2(x - 0.7 * s, foot - 0.05 * s)) / vec2(1.5, 0.6)), length((p - vec2(x + 0.9 * s, foot + 0.05 * s)) / vec2(1.2, 0.45))),
                    length((p - vec2(x + 0.1 * s, foot - 0.25 * s)) / vec2(1.1, 0.55))) - s;
  if (rocks < 0.0 && p.y < foot + 0.35 * s) {
    float top = smoothstep(foot - 0.6 * s, foot + 0.2 * s, p.y);
    sky = mix(sky, mix(mix(tone(vec3(0.42, 0.4, 0.55), k) * dark, sky, haze), indigo, top), 0.95);
  }
  // The tower: narrowing as it rises, banded coral and white, shaded to
  // one side, with a window in each white band.
  float t = (foot - p.y) / h;
  float halfWidth = mix(0.6, 0.38, clamp(t, 0.0, 1.0)) * s;
  if (t >= 0.0 && t <= 1.0 && abs(p.x - x) < halfWidth) {
    bool coral = int(floor(t * 4.0)) % 2 == 0;
    vec3 tower = coral ? vec3(0.96, 0.36, 0.32) : vec3(0.97, 0.95, 0.9);
    tower = tone(tower * (0.7 + 0.3 * smoothstep(halfWidth, -0.3 * halfWidth, p.x - x)), k) * dark;
    sky = mix(sky, mix(tower, sky, haze), 0.92);
    float band = fract(t * 4.0);
    if (!coral && abs(p.x - x) < 0.09 * s && abs(band - 0.5) < 0.22) sky = mix(sky, indigo, 0.85);
  }
  // The gallery: a deck wider than the tower, and its railing.
  if (abs(p.x - x) < 0.62 * s && p.y > deck - 0.12 * s && p.y < deck + 0.05 * s) sky = mix(sky, indigo, 0.9);
  float rail = min(abs(p.y - (deck - 0.38 * s)), abs(p.x - x) < 0.62 * s ? 1e9 : 1e9);
  if (abs(p.x - x) < 0.6 * s && p.y < deck && p.y > deck - 0.42 * s) {
    float posts = abs(fract((p.x - x) / (0.3 * s) + 0.5) - 0.5) * 0.3 * s;
    rail = min(abs(p.y - (deck - 0.38 * s)), posts);
    sky = ink(sky, indigo, rail - 0.04 * s, 0.75);
  }
  // The lantern room, lit or dark, its glazing bars, the dome and its finial.
  vec2 r = abs(v);
  vec3 glass = BEACON == 1 ? INK_ORANGE : BEACON == 2 ? vec3(1.0, 0.97, 0.9) : indigo;
  if (r.x < 0.36 * s && r.y < 0.28 * s) {
    sky = mix(sky, glass, 0.95);
    if (abs(abs(p.x - x) - 0.12 * s) < 0.035 * s) sky = mix(sky, indigo, 0.7);
  }
  vec2 dome = (p - vec2(x, lantern.y - 0.28 * s)) / vec2(0.44 * s, 0.34 * s);
  if (p.y < lantern.y - 0.28 * s && dot(dome, dome) < 1.0) sky = mix(sky, indigo, 0.92);
  if (abs(p.x - x) < 0.04 * s && p.y < lantern.y - 0.6 * s && p.y > lantern.y - 0.85 * s) sky = mix(sky, indigo, 0.9);
  return sky;
}

// Water thrown up where the dolphin breaks the surface at \`at\`, \`age\`
// seconds after, and a ring spreading flat on the water.
vec3 splash(vec3 sky, vec2 p, vec2 at, float age, float s, float u, float k) {
  if (age < 0.0 || age > 1.6) return sky;
  float fade = 1.0 - age / 1.6;
  vec3 foam = lift(vec3(0.94, 0.97, 1.0), k);
  vec2 ring = (p - at) / vec2(1.0, 0.25);
  if (p.y > at.y - 0.4 * s) sky = ink(sky, foam, abs(length(ring) - (0.3 + 1.1 * age) * s) - 0.05 * u, 0.6 * fade);
  for (int i = 0; i < 8; i++) {
    float a = rand(i * 13 + int(at.x));
    float b = rand(i * 7 + 5 + int(at.x));
    vec2 drop = at + vec2((a - 0.5) * 3.0, -(2.0 + 2.5 * b)) * s * age + vec2(0.0, 7.0 * s) * age * age;
    if (drop.y > at.y) continue;
    sky = ink(sky, foam, length(p - drop) - 0.13 * u, fade);
  }
  return sky;
}

// A dolphin in the lighthouse's sea, leaping now and then: an arc out of
// the water and back, a splash where it leaves and where it goes in.
// Sometimes a pink one.
vec3 dolphin(vec3 sky, vec2 p, float u, float seed, float k, bool isPink) {
  // A little way out from the horizon, nearer than the lighthouse.
  float level = (ARC.w + 0.03) * iResolution.y;
  float period = 7.0;
  float air = 1.3;
  float clock = iTime + seed;
  int n = int(floor(clock / period));
  float local = mod(clock, period);
  float s = 0.7 * u;
  float span = 3.4 * s;
  float side = rand(n * 17 + 3) < 0.5 ? 1.0 : -1.0;
  float x0 = iResolution.x * (0.72 + 0.09 * rand(n * 31 + int(seed))) + (side < 0.0 ? span : 0.0);
  if (abs(p.x - x0 - side * span * 0.5) > span + 2.0 * s || abs(p.y - level) > 4.0 * s) return sky;
  sky = splash(sky, p, vec2(x0, level), local, s, u, k);
  sky = splash(sky, p, vec2(x0 + side * span, level), local - air, s, u, k);
  if (local >= air || p.y > level) return sky;
  float f = local / air;
  float rise = 2.4 * s;
  vec2 at = vec2(x0 + side * span * f, level - 4.0 * f * (1.0 - f) * rise);
  vec2 vel = normalize(vec2(side * span, -(1.0 - 2.0 * f) * 4.0 * rise));
  // Its back up, whichever way it swims.
  vec2 back = side * vec2(vel.y, -vel.x);
  vec2 d = p - at;
  vec2 q = vec2(dot(d, vel), dot(d, back));
  float body = min(limb(q, vec2(0.85, 0.0) * s, vec2(-0.85, 0.0) * s, 0.24 * s, 0.07 * s), limb(q, vec2(1.25, -0.02) * s, vec2(0.8, 0.0) * s, 0.06 * s, 0.15 * s));
  float fin = limb(q, vec2(0.1, 0.18) * s, vec2(-0.25, 0.52) * s, 0.1 * s, 0.02 * s);
  float fluke = limb(vec2(q.x, abs(q.y)), vec2(-0.8, 0.0) * s, vec2(-1.15, 0.3) * s, 0.08 * s, 0.04 * s);
  float shape = min(body, min(fin, fluke));
  // Blue-grey (or pink), its belly paler, screened.
  vec3 skin = isPink ? lift(mix(INK_PINK, vec3(1.0, 0.88, 0.92), 0.35), k) : tone(mix(INK_BLUE, vec3(0.55, 0.6, 0.7), 0.45), k);
  vec3 color = mix(skin, mix(skin, vec3(0.95), 0.6), screen(p, smoothstep(0.0, -0.2 * s, q.y), max(3.0, u * 0.24), 45.0));
  sky = ink(sky, color, shape, 1.0);
  vec2 off = d - vec2(0.1, 0.08) * u;
  vec2 q2 = vec2(dot(off, vel), dot(off, back));
  float key = min(limb(q2, vec2(0.85, 0.0) * s, vec2(-0.85, 0.0) * s, 0.24 * s, 0.07 * s), limb(q2, vec2(0.1, 0.18) * s, vec2(-0.25, 0.52) * s, 0.1 * s, 0.02 * s));
  return ink(sky, lift(INK_INDIGO, k), abs(key) - 0.05 * u, 0.6);
}

// --- The wastebasket -------------------------------------------------------

// A crumpled ball of paper: a disc with a crease, screened darker away from
// the light, its key plate off register; \`burnt\` blackens it.
vec3 paperBall(vec3 sky, vec2 p, vec2 at, float r, int seed, float k, float burnt) {
  vec2 v = p - at;
  float d = length(v) - r;
  if (d > 3.0) return sky;
  vec3 paper = mix(lift(vec3(0.97, 0.95, 0.9), k), vec3(0.18, 0.1, 0.1), burnt);
  float pitch = max(3.0, r * 0.35);
  vec3 c = mix(paper, mix(paper, INK_INDIGO, 0.35), screen(p, clamp(0.2 + dot(v / r, vec2(0.5, 0.6)) * 0.5, 0.0, 1.0), pitch, 45.0));
  float a = float(seed) * 2.4;
  float crease = abs(dot(v, vec2(cos(a), sin(a)))) - 0.04 * r;
  c = mix(c, mix(c, INK_INDIGO, 0.45), smoothstep(1.0, 0.0, crease) * step(length(v), r * 0.8));
  sky = ink(sky, c, d, 1.0);
  return ink(sky, lift(INK_INDIGO, k), abs(length(v - vec2(0.12, 0.1) * r) - r) - 0.5, 0.6);
}

// A tongue of fire rising from \`foot\`, \`h\` tall and \`w\` wide at its base,
// flickering; how much it covers \`p\`.
float flame(vec2 p, vec2 foot, float h, float w, float phase) {
  float f = (foot.y - p.y) / h;
  if (f < 0.0 || f > 1.0) return 0.0;
  float sway = sin(f * 3.0 + iTime * 6.0 + phase) * 0.18 * w * f;
  float width = w * pow(1.0 - f, 0.7) * smoothstep(0.0, 0.12, f);
  return smoothstep(width, width * 0.6, abs(p.x - foot.x - sway));
}

// The wastebasket in the bottom right corner, wire mesh over a dark inside:
// the context window's paper in balls inside it, the last over the rim.
// While the conversation compacts it burns, the balls blackening, flames
// in three inks and smoke rising; embers and smoke just after.
const vec2 BALL_AT[10] = vec2[10](vec2(-0.45, -0.45), vec2(0.45, -0.45), vec2(-0.5, -1.15), vec2(0.05, -1.1), vec2(0.55, -1.15),
  vec2(-0.55, -1.85), vec2(0.05, -1.8), vec2(0.6, -1.85), vec2(-0.3, -2.55), vec2(0.4, -2.6));
vec3 basket(vec3 sky, vec2 p, float u, float k) {
  if (BASKET == 0) return sky;
  // This tab's own, from its mark (tabMark).
  int balls = int(iPalette[16].g * 255.0 + 0.5);
  int fire = int(iPalette[16].r * 255.0 + 0.5);
  float pitch = max(3.0, u * 0.24);
  // Its own unit, a little smaller than the sky's.
  u *= 0.85;
  float hgt = 2.6 * u;
  vec2 base = vec2(iResolution.x - 2.2 * u, iResolution.y - 0.35 * u);
  vec2 v = p - base;
  if (abs(v.x) > 3.0 * u || v.y > 0.5 * u || v.y < -hgt - 6.0 * u) return sky;
  float rise = clamp(-v.y / hgt, 0.0, 1.0);
  float halfWidth = mix(0.85, 1.15, rise) * u;
  bool isInside = v.y <= 0.0 && v.y >= -hgt && abs(v.x) <= halfWidth;
  bool isBurning = fire == 1;
  float burnt = isBurning ? 0.55 + 0.25 * sin(iTime * 2.0) : 0.0;

  // Smoke, behind it all.
  if (fire != 0) {
    for (int j = 0; j < 4; j++) {
      float age = fract(iTime * 0.22 + float(j) * 0.25);
      vec2 at = base + vec2(sin(float(j) * 2.1 + iTime * 0.5) * 0.5 * u, -hgt - 0.8 * u - age * 4.5 * u);
      float puff = smoothstep(1.0, 0.4, length(p - at) / ((0.35 + 0.7 * age) * u)) * (1.0 - age) * (isBurning ? 0.6 : 0.4);
      sky = mix(sky, lift(vec3(0.62, 0.62, 0.68), k), screen(p, puff, pitch, 45.0) * 0.8);
    }
  }
  if (isInside) sky = mix(sky, tone(INK_INDIGO, k) * 0.55, 0.85);
  for (int i = 0; i < 8; i++) {
    if (i >= balls) break;
    sky = paperBall(sky, p, base + BALL_AT[i] * u, 0.42 * u, i + 3, k, burnt);
  }
  // The mesh, the sides, the rim and the base, in steel.
  vec3 steel = lift(mix(vec3(0.78, 0.8, 0.88), INK_BLUE, 0.2), k);
  if (isInside) {
    float a = abs(fract((v.x + v.y) / (0.42 * u)) - 0.5) * 0.42 * u;
    float b = abs(fract((v.x - v.y) / (0.42 * u)) - 0.5) * 0.42 * u;
    sky = ink(sky, steel, min(a, b) - 0.04 * u, 0.8);
  }
  if (v.y <= 0.0 && v.y >= -hgt) sky = ink(sky, steel, abs(abs(v.x) - halfWidth) - 0.06 * u, 1.0);
  if (abs(v.x) <= 1.25 * u) sky = ink(sky, steel, abs(v.y + hgt) - 0.11 * u, 1.0);
  if (abs(v.x) <= 0.85 * u) sky = ink(sky, steel, abs(v.y) - 0.09 * u, 1.0);
  // The key plate, a little off register.
  vec2 w = v - vec2(0.12, 0.1) * u;
  float wr = clamp(-w.y / hgt, 0.0, 1.0);
  if (w.y <= 0.0 && w.y >= -hgt) sky = ink(sky, lift(INK_INDIGO, k), abs(abs(w.x) - mix(0.85, 1.15, wr) * u) - 0.04 * u, 0.5);
  for (int i = 8; i < 10; i++) {
    if (i >= balls) break;
    sky = paperBall(sky, p, base + BALL_AT[i] * u, 0.42 * u, i + 3, k, burnt);
  }

  // The fire: pink, orange and yellow tongues, each smaller than the last.
  if (isBurning) {
    vec3 inks[3] = vec3[3](INK_PINK, INK_ORANGE, INK_YELLOW);
    float angles[3] = float[3](75.0, 45.0, 0.0);
    for (int layer = 0; layer < 3; layer++) {
      float scale = 1.0 - float(layer) * 0.28;
      float cover = 0.0;
      for (int i = 0; i < 3; i++) {
        float x = (-0.6 + 0.6 * float(i)) * u;
        float h = (1.4 + 0.9 * (0.5 + 0.5 * sin(iTime * (2.3 + float(i) * 0.7) + float(i) * 1.9))) * u * scale;
        cover = max(cover, flame(p, base + vec2(x, -hgt + 0.6 * u), h, 0.55 * u * scale, float(i * 3 + layer)));
      }
      sky = mix(sky, inks[layer], screen(p, cover * 0.95, pitch, angles[layer]));
    }
  }
  // Embers in the bottom of an emptied bin.
  if (fire == 2 && isInside && v.y > -0.6 * u) {
    float glow = step(0.82, rand(int(floor(p.x / pitch)) * 31 + int(floor(p.y / pitch)) * 17 + int(floor(iTime * 4.0))));
    sky = mix(sky, INK_ORANGE, glow * 0.9);
  }
  return sky;
}

// --- The sky behind the terminal -------------------------------------------

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 term = texture(iChannel0, fragCoord / iResolution.xy);
  // Wherever the terminal shows anything but its background (as Ghostty
  // says it, theme and all), the terminal. With linear alpha blending (the
  // default on Linux) the terminal's image is in linear light while
  // iBackgroundColor is sRGB: compared with both.
  vec3 linearBackground = pow(iBackgroundColor, vec3(2.2));
  float mask = smoothstep(0.02, 0.12, min(distance(term.rgb, iBackgroundColor), distance(term.rgb, linearBackground)));
  if (mask >= 1.0) {
    fragColor = vec4(term.rgb, 1.0);
    return;
  }
  // Only in a tab where Claude runs: its session marks palette colour 16,
  // blue one step off black (tabMark).
  if (abs(iPalette[16].b - 1.0 / 255.0) > 0.5 / 255.0 || iPalette[16].r > 2.5 / 255.0 || iPalette[16].g > 10.5 / 255.0) {
    fragColor = vec4(term.rgb, 1.0);
    return;
  }
  float unit = max(4.0, floor(iResolution.y / 60.0 + 0.5));

  // fragCoord with y down from the top left, on every backend.
  vec2 p = Y_UP > 0.5 ? vec2(fragCoord.x, iResolution.y - fragCoord.y) : fragCoord;
  Scene s = sceneNow();
  float k;
  vec3 sky = gradient(p, s, k);

  float night = nightness(s.elevation);
  float auroraStrength = AURORA * max(AURORA_FLOOR, night);
  if (auroraStrength > 0.0) sky = aurora(sky, p, auroraStrength);
  float starStrength = night * (1.0 - CLOUDINESS * 0.9);
  if (starStrength > 0.03) {
    float size = max(1.0, floor(iResolution.y / 700.0 + 0.5));
    sky = stars(sky, p, starStrength, size);
    if (STAR_COUNT > 0) sky = realStars(sky, p, starStrength, size);
    if (LINE_COUNT > 0 && night > 0.6 && CLOUDINESS < 0.5) sky = chartLines(sky, p, unit, (night - 0.6) / 0.4);
  }
  vec2 body = arcPoint(s.progress);
  if (s.isDay < 0.5 && MOON_UP > 0.5) sky = moonAt(sky, p, domeToPixel(MOON_AT), unit * 2.0, (0.35 + 0.65 * night) * (1.0 - CLOUDINESS * 0.8));

  sky = tone(sky, k);
  if (s.isDay > 0.5) sky = sunAt(sky, p, body, unit * 1.9, 1.0 - CLOUDINESS * 0.85, max(3.0, unit * 0.24), k, s.elevation);
  sky = events(sky, p, unit, k, true);
  if (ISS_UP > 0.5) sky = iss(sky, p, unit);
  sky = beacon(sky, p, unit, k);
  sky = clouds(sky, p, s, unit, k);
  sky = events(sky, p, unit, k, false);
  sky = weather(sky, p, unit);
  sky = basket(sky, p, unit, k);

  fragColor = vec4(mix(sky, term.rgb, mask), 1.0);
}
`
