// The sky as a Ghostty custom shader: the wallpaper of sky.ts drawn on the
// GPU every frame, so the clouds glide and nothing is written per frame.
// Ghostty gives a shader no date (`iTime` only, and it runs on across a
// reload), so the scene is baked in as constants and the shader is written
// again, and Ghostty told to reload, when they change.

import { localMidnight, moonAt, sunAt } from './astro'
import type { ActiveEvent, EventKind } from './events'
import { auroraThreshold, bodyAt, greyness, RARE_SHAPES, skyOf } from './sky'
import type { SkyInput } from './sky'
import { clamp, INKS } from './paint'

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
  moon: { illumination: number; isWaxing: boolean }
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
  // The terminal's background: where the terminal shows it, the sky shows.
  background: number
  // Events up now, each looped over its length (Ghostty's iTime cannot say
  // when one began), and shooting stars an hour.
  events: { kind: EventKind; seed: number; seconds: number }[]
  shootingRate: number
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
}

// Scenes are worked out on this grid, so the shader's text (and with it a
// reload) changes about every two minutes.
export const SCENE_MS = 120_000
// Scenes in a demo day.
const DEMO_SCENES = 96

function round(v: number, step: number): number {
  return Math.round(v / step) * step
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
    background: number
    demo?: { seconds: number; offsetMs?: number } | null
    events?: readonly ActiveEvent[]
    shootingRate?: number
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

  return {
    // In a demo the day plays from its table: a fixed scene keeps the text,
    // and with it Ghostty, still for the demo's length.
    scene: demo ? demo.scenes[0]! : sceneAt(ms, place),
    moon: { illumination: round(moon.illumination, 0.01), isWaxing: moon.isWaxing },
    demo,
    cloudiness: round(greyness(weather), 0.01),
    cover: weather ? round(weather.cloudCover / 100, 0.01) : 0.3,
    wind: weather ? round(weather.wind, 0.5) : 3,
    precipitation: sky === 'drizzle' || sky === 'rain' || sky === 'thunder' || sky === 'snow' ? sky : 'none',
    aurora: isAuroraForced ? 0.9 : round(clamp(over / 3) * clear, 0.01),
    auroraFloor: isAuroraForced ? 0.4 : 0,
    background: options.background,
    // A shooting star asked for is a shower: one every few seconds.
    events: (options.events ?? [])
      .filter(event => event.kind !== 'shootingStar')
      .slice(0, 4)
      .map(event => ({ kind: event.kind, seed: event.seed, seconds: Math.round(event.durationMs / 1000) })),
    shootingRate: options.events?.some(event => event.kind === 'shootingStar') ? 900 : options.shootingRate ?? 0,
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

// The whole shader for these constants: the same text for the same params.
export function skyShader(params: ShaderParams): string {
  const { scene, moon, demo } = params
  const demoScenes = demo?.scenes ?? [scene]
  // GLSL has no empty arrays: a placeholder when no event is up.
  const events = params.events.length > 0 ? params.events : [{ kind: 'satellite' as const, seed: 0, seconds: 1 }]
  const constants = [
    `const vec3 BACKGROUND = ${rgb(params.background)};`,
    `const float ELEVATION = ${f(scene.elevation)};`,
    `const float PROGRESS = ${f(scene.progress)};`,
    `const float IS_DAY = ${scene.isDay ? '1.0' : '0.0'};`,
    `const float MOON_ILLUMINATION = ${f(moon.illumination)};`,
    `const float MOON_WAXING = ${moon.isWaxing ? '1.0' : '0.0'};`,
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
    `const float SHOOTING_RATE = ${f(params.shootingRate)};`,
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

// Everything but the constants. Coordinates are Ghostty's fragCoord, x right
// and y down from the top left, as on sky.ts's Canvas.
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
  if (rand(n) > 0.6) return sky;
  float margin = size * 3.0 + 1.0;
  vec2 at = c * cell + margin + vec2(rand(n + 1), rand(n + 2)) * (cell - margin * 2.0);
  vec2 d = abs(p - at);
  if (d.x > margin || d.y > margin) return sky;
  uint kind = hashi(n + 3) % 20u;
  vec3 tint = kind == 0u ? vec3(1.0, 0.824, 0.659) : kind == 1u ? vec3(0.722, 0.8, 1.0) : vec3(1.0, 0.973, 0.925);
  float twinkle = 0.75 + 0.25 * sin(iTime * (1.5 + float(hashi(n + 4) % 7u) * 0.4) + float(hashi(n + 6) % 100u));
  float bright = (kind < 3u ? 0.95 : 0.35 + float(hashi(n + 5) % 5u) * 0.1) * twinkle;
  // Fainter near the horizon, where the air is thick.
  float a = strength * bright * (1.0 - smoothstep(0.45, 0.8, at.y / iResolution.y));
  float disc = (d.x < size * 0.5 + 0.5 && d.y < size * 0.5 + 0.5) ? 1.0 : 0.0;
  float glint = kind < 3u && size > 1.0 && min(d.x, d.y) < 0.5 ? 0.35 * (1.0 - max(d.x, d.y) / (size * 2.0 + 1.0)) : 0.0;
  return mix(sky, tint, clamp(a * max(disc, glint), 0.0, 1.0));
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
      // Now and then not a cloud at all.
      float px = max(1.0, floor(size / 6.0 + 0.5));
      ivec2 cell = ivec2(floor(q / px));
      if (cell.x < 0 || cell.x > 6 || cell.y < 0 || cell.y > 3) continue;
      int rx = cell.x;
      bool dome = cell.y < 2 && abs(rx - 3) <= (cell.y == 0 ? 1 : 2);
      bool hull = cell.y == 2 || (cell.y == 3 && rx > 0 && rx < 6);
      if (!dome && !hull) continue;
      bool light = cell.y == 3 && rx % 2 == 0;
      bool blink = int(floor(iTime * 2.0)) % 3 == rx % 3;
      vec3 c = dome ? vec3(0.561, 0.89, 1.0) : light ? (blink ? INK_YELLOW : INK_PINK) : vec3(0.604, 0.643, 0.722);
      sky = mix(sky, tone(c, k), opacity);
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
  int gore = int(floor((q.x / max(across, 0.01) + 2.0) * 3.0)) + int(seed);
  vec3 gores[3] = vec3[3](INK_PINK, INK_YELLOW, INK_ORANGE);
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
    vec2 at = lead + vec2(back * rank * 1.6 * u, side * rank * 0.9 * u);
    float flap = sin(iTime * 7.0 + float(i) * 1.3) * 0.35 * u;
    d = min(d, segment(p, at, at + vec2(-0.6 * u, -flap)));
    d = min(d, segment(p, at, at + vec2(0.6 * u, -flap)));
  }
  return ink(sky, mix(INK_INDIGO, vec3(0.0), 0.3), d - 0.09 * u, 0.85);
}

vec3 plane(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  bool isEast = seeded(seed, 1) < 0.5;
  vec2 a = iResolution.xy * vec2(isEast ? -0.05 : 1.05, 0.1 + 0.25 * seeded(seed, 2));
  vec2 b = iResolution.xy * vec2(isEast ? 1.05 : -0.05, 0.05 + 0.2 * seeded(seed, 3));
  vec2 at = mix(a, b, t);
  vec2 dir = normalize(b - a);
  // The contrail: forming a little behind, widening and thinning out.
  float behind = dot(at - p, dir);
  if (behind > 0.0) {
    float d = abs(dot(p - at, vec2(-dir.y, dir.x)));
    float width = 0.1 * u + behind * 0.012;
    float a2 = 0.6 * exp(-behind / (0.5 * iResolution.x)) * smoothstep(0.4 * u, 1.6 * u, behind);
    float cover = smoothstep(width + 0.8, width - 0.8, d) * a2;
    sky = mix(sky, lift(vec3(1.0), k), screen(p, cover, max(3.0, u * 0.24), 30.0) * 0.8 + cover * 0.25);
  }
  vec2 n = vec2(-dir.y, dir.x);
  float body = segment(p, at - dir * 0.45 * u, at + dir * 0.45 * u) - 0.1 * u;
  float wings = segment(p, at - n * 0.5 * u, at + n * 0.5 * u) - 0.07 * u;
  return ink(sky, vec3(1.0, 0.98, 0.94), min(body, wings), 1.0);
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
    vec2 q = p - vec2(x, y);
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
  vec2 head = iResolution.xy * vec2(0.14 + 0.25 * seeded(seed, 1), 0.14 + 0.14 * seeded(seed, 2));
  vec2 dir = normalize(vec2(1.0, -0.38));
  vec2 ion = normalize(vec2(1.0, -0.2));
  float pitch = max(3.0, u * 0.24);
  vec2 q = p - head;
  float along = dot(q, dir);
  if (along > 0.0) {
    // The dust tail: broad, curving a little, yellow; the ion tail straight and blue.
    float bend = along * along * 0.0006 / u;
    float width = 0.3 * u + along * 0.13;
    float d = abs(dot(q, vec2(-dir.y, dir.x)) - bend);
    float cover = exp(-along / (11.0 * u)) * smoothstep(width, 0.0, d);
    sky = mix(sky, INK_YELLOW, screen(p, cover * 0.8, pitch, 0.0) * 0.7);
    float ionAlong = dot(q, ion);
    float ionD = abs(dot(q, vec2(-ion.y, ion.x)));
    float ionCover = exp(-ionAlong / (16.0 * u)) * smoothstep(0.25 * u + ionAlong * 0.02, 0.0, ionD);
    sky = mix(sky, mix(INK_BLUE, vec3(1.0), 0.3), screen(p, ionCover * 0.7, pitch, 15.0) * 0.7);
  }
  sky = mix(sky, vec3(1.0, 0.97, 0.88), 0.35 * exp(-length(q) / (0.6 * u)));
  return ink(sky, vec3(1.0, 0.98, 0.92), length(q) - 0.22 * u, 1.0);
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

// A milestone: risograph confetti over the whole window.
vec3 confetti(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  vec3 inks[5] = vec3[5](INK_PINK, INK_YELLOW, INK_BLUE, INK_GREEN, INK_ORANGE);
  float fade = 1.0 - smoothstep(0.85, 1.0, t);
  float seconds = t * 20.0;
  for (int i = 0; i < 48; i++) {
    float a = seeded(seed, i * 3);
    float b = seeded(seed, i * 3 + 1);
    float x = a * iResolution.x + sin(seconds * (1.0 + b) + a * 7.0) * 1.2 * u;
    float y = -2.0 * u - b * iResolution.y * 0.6 + seconds * (2.5 + 3.0 * a) * u;
    vec2 q = p - vec2(x, y);
    if (dot(q, q) > u * u) continue;
    float spin = seconds * (2.0 + 3.0 * b) + a * 6.0;
    q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
    vec2 e = abs(q) - vec2(0.45, 0.2) * u;
    sky = ink(sky, lift(inks[i % 5], k), max(e.x, e.y), fade);
  }
  return sky;
}

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
      continue;
    }
    if (kind == 2) sky = balloon(sky, p, u, seed, t, k);
    if (kind == 3) sky = birds(sky, p, u, seed, t);
    if (kind == 4) sky = plane(sky, p, u, seed, t, k);
    if (kind == 6) sky = kite(sky, p, u, seed, k);
    if (kind == 7 || kind == 8) sky = drift(sky, p, u, seed, kind == 8, k);
    if (kind == 11) sky = confetti(sky, p, u, seed, t, k);
  }
  return sky;
}

// --- The sky behind the terminal -------------------------------------------

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 term = texture(iChannel0, fragCoord / iResolution.xy);
  // Wherever the terminal shows anything but its background, the terminal.
  float mask = smoothstep(0.02, 0.12, distance(term.rgb, BACKGROUND));
  if (mask >= 1.0) {
    fragColor = vec4(term.rgb, 1.0);
    return;
  }

  vec2 p = fragCoord;
  Scene s = sceneNow();
  float unit = max(4.0, floor(iResolution.y / 60.0 + 0.5));
  float k;
  vec3 sky = gradient(p, s, k);

  float night = nightness(s.elevation);
  float auroraStrength = AURORA * max(AURORA_FLOOR, night);
  if (auroraStrength > 0.0) sky = aurora(sky, p, auroraStrength);
  float starStrength = night * (1.0 - CLOUDINESS * 0.9);
  if (starStrength > 0.03) sky = stars(sky, p, starStrength, max(1.0, floor(iResolution.y / 700.0 + 0.5)));
  vec2 body = arcPoint(s.progress);
  if (s.isDay < 0.5) sky = moonAt(sky, p, body, unit * 2.0, (0.35 + 0.65 * night) * (1.0 - CLOUDINESS * 0.8));

  sky = tone(sky, k);
  if (s.isDay > 0.5) sky = sunAt(sky, p, body, unit * 1.9, 1.0 - CLOUDINESS * 0.85, max(3.0, unit * 0.24), k, s.elevation);
  sky = events(sky, p, unit, k, true);
  sky = clouds(sky, p, s, unit, k);
  sky = events(sky, p, unit, k, false);
  sky = weather(sky, p, unit);

  fragColor = vec4(mix(sky, term.rgb, mask), 1.0);
}
`
