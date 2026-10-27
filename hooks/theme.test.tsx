// A theme and the engine: the manifest's checks, the lint, the contract,
// and fyr, the theme built in, under all three.

import { expect, test } from 'claude-code/testing'

import { STOCKHOLM } from './astro'
import { EVENTS, kindOf, wordsOf } from './events'
import type { EventContext } from './events'
import { shaderParams, skyShader, THEME_SIGNALS } from './shader'
import { COMMON } from './glsl/common'
import { PROTOTYPES } from './glsl/prototypes'
import { BASE_THEME, THEMES } from './themes/index'
import { ENGINE_CONTRACT, lintTheme, SHADER_MAX, THEME_GLSL_MAX, themeOf, topLevelNames, whenOf } from './themes/theme'
import type { Theme, ThemeManifest, ThemeWhen } from './themes/theme'

const FYR = THEMES[BASE_THEME]
const at = Date.UTC(2026, 9, 24, 20)
const params = shaderParams({ ms: at, t: 0, place: STOCKHOLM, weather: null }, {})
// A theme with nothing of its own: the engine alone, the four stubbed.
const bare: Theme = { manifest: { ...FYR.manifest, name: 'bare', events: [], previews: [], aliases: {} }, glsl: '' }
const ENGINE_NAMES = topLevelNames(skyShader(params, bare))

const manifest = (change: Partial<ThemeManifest> | Record<string, unknown>) => ({ ...FYR.manifest, ...change }) as unknown
const errorOf = (m: unknown) => {
  const theme = themeOf(m, '')
  return 'error' in theme ? theme.error : null
}

test('fyr is a theme as one from elsewhere would be, and lints clean', () => {
  expect(errorOf(FYR.manifest)).toBeNull()
  expect(themeOf(JSON.parse(JSON.stringify(FYR.manifest)), FYR.glsl)).toEqual(FYR)
  expect(lintTheme(FYR.glsl, ENGINE_NAMES)).toEqual([])
  expect(ENGINE_NAMES).toContain('pitch')
  expect(ENGINE_NAMES).toContain('mainImage')
  expect(ENGINE_NAMES).not.toContain('lighthouse')
})

test("a manifest's kinds and words are its own, its events short and rare enough, its engine contract named", () => {
  const dolphin = FYR.manifest.events[0]!
  expect(errorOf(manifest({ events: [dolphin, { ...dolphin, word: 'another dolphin' }] }))).toContain('dolphin is taken')
  expect(errorOf(manifest({ events: [{ ...dolphin, kind: 'balloon' }] }))).toContain('balloon is taken')
  expect(errorOf(manifest({ events: [{ ...dolphin, word: 'comet' }] }))).toContain('"comet" is taken')
  expect(errorOf(manifest({ previews: [{ kind: 'surf', word: 'kite' }] }))).toContain('"kite" is taken')
  expect(errorOf(manifest({ events: [{ ...dolphin, minutes: 30 }] }))).toContain('whole slot')
  // Liveliness: a minute in every ten is 0.1 of the time.
  expect(errorOf(manifest({ events: [{ ...dolphin, slotMinutes: 10 }] }))).toContain('more than 0.08')
  expect(errorOf(manifest({ engine: undefined }))).toContain('engine contract')
  expect(errorOf(manifest({ engine: 2 }))).toContain('engine contract 2')
  expect(errorOf(manifest({ name: 'Fyr!' }))).toContain('name')
  expect(errorOf(manifest({ events: [{ ...dolphin, when: { sun: 'noon' } }] }))).toContain('sun')
  expect(errorOf(manifest({ aliases: { val: 'whale' } }))).toContain('names no kind')
})

test("the lint keeps a theme from the terminal's image, the GPU's time and the engine's names", () => {
  const lint = (glsl: string) => lintTheme(glsl, ENGINE_NAMES)
  const flags = (glsl: string, what: string) => expect(lint(glsl).join('\n')).toContain(what)
  flags('float f() { float x = 0.0; while (x < 1.0) x += 0.1; return x; }', 'while')
  flags('float f() { float x = 0.0; do { x += 0.1; } while (x < 1.0); return x; }', 'do loop')
  flags('vec3 f(vec2 uv) { return texture(iChannel0, uv).rgb; }', 'texture read')
  flags('vec3 f(vec2 uv) { return textureLod(iChannel0, uv, 0.0).rgb; }', 'texture read')
  flags('float f() { return iChannel0 == iChannel0 ? 1.0 : 0.0; }', 'iChannel')
  flags('float f() { return iPalette[16].g; }', 'iPalette')
  flags('#define X 1\nfloat f() { return 1.0; }', 'preprocessor')
  flags('void f() { discard; }', 'discard')
  flags('uniform float iMine;', 'uniform')
  flags('out vec4 color;', 'out')
  flags('layout(location = 0) out vec4 color;', 'layout')
  flags('void mainImage(out vec4 c, in vec2 p) { c = vec4(0.0); }', 'mainImage')
  flags('float sky_glow(float x) { return x; }', 'sky_')
  flags('const float sky_LEVEL = 1.0;', 'sky_')
  flags('float pitch(float u) { return u; }', 'defines pitch')
  flags('const float ELEVATION = 3.0;', 'defines ELEVATION')
  flags('struct Scene { float x; };', 'defines Scene')
  flags('float f() { float s = 0.0; for (int i = 0; i < 48; i++) { i = 0; } return s; }', 'assigns its loop index i')
  flags('float f() { float s = 0.0; for (int i = 0; i < 49; i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f(int n) { float s = 0.0; for (int i = 0; i < n; i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f(int n) { float s = 0.0; for (int i = n - 1; i <= n; i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i += s > 1.0 ? 1 : 2) s += 1.0; return s; }', 'loop not of the form')
  flags(
    'float f() { float s = 0.0; for (int i = 0; i < 2; i++) { for (int j = 0; j < 2; j++) { for (int n = 0; n < 2; n++) s += 1.0; } } return s; }',
    'more than two deep',
  )
  // What is fine: its own names, a local that shadows the engine's, two
  // loops deep, an out parameter, and the four entry points.
  expect(
    lint(`
// A comment may say while, texture( or #define.
const float MY_LEVEL = 0.5;
float wave(float x, out float y) { float pitch = 3.0; y = pitch; return x * MY_LEVEL; }
vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  for (int i = 0; i < 3; i++) { for (int j = 4; j > 0; j--) sky *= 0.99; }
  for (int i = 0; i < 48; i += 2) sky += 0.001;
  return sky;
}
float themeWindow(vec2 p, float u) { return 1.0; }
`),
  ).toEqual([])
})

test('the contract is what contract 1 says it is', () => {
  // Changing any of this breaks the themes written against it: bump
  // ENGINE_CONTRACT, and add new engine names as sky_ ones.
  expect(ENGINE_CONTRACT).toBe(1)
  expect(PROTOTYPES.split('\n').filter(line => /^\w/.test(line))).toEqual([
    'vec3 scenery(vec3 sky, vec2 p, float u, float k);',
    'vec3 resident(vec3 sky, vec2 p, float u, float k);',
    'vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind);',
    'float themeWindow(vec2 p, float u);',
  ])
  expect([...COMMON.matchAll(/^(\w+) (\w+)\(([^)]*)\)/gm)].map(m => m[0])).toEqual([
    'uint hashu(uint x)',
    'uint hashi(int n)',
    'float rand(int n)',
    'float noise(float x, int seed)',
    'float noise2(vec2 x, int seed)',
    'float fbm(vec2 x, int seed, int octaves)',
    'float luminance(vec3 c)',
    'vec3 grey(vec3 c)',
    'vec3 vivid(vec3 c, float k)',
    'float screen(vec2 at, float tone, float pitch, float angle)',
    'Scene sceneNow()',
    'vec2 domeToPixel(vec2 d)',
    'vec2 cursorAt()',
    'float glance(vec2 at)',
    'vec2 shy(vec2 at, float u)',
    'vec2 arcPoint(float progress)',
    'float nightness(float elevation)',
    'vec3 tone(vec3 c, float k)',
    'vec3 ink(vec3 sky, vec3 color, float d, float alpha)',
    'vec3 lift(vec3 c, float k)',
    'float seeded(float seed, int salt)',
    'float segment(vec2 p, vec2 a, vec2 b)',
    'float limb(vec2 p, vec2 a, vec2 b, float ra, float rb)',
    'float smin(float a, float b, float r)',
    'float box(vec2 q, vec2 b)',
    'float widthShown(float turn, float least)',
    'vec2 tumble(vec2 q, float spin, float flip)',
    'float flame(vec2 p, vec2 foot, float h, float w, float phase)',
    'vec3 fire(vec3 sky, vec2 p, vec2 foot, float spacing, float tall, float wide, float pitch)',
    'vec3 smoke(vec3 sky, vec2 p, vec2 from, float rise, float drift, float r, float rate, float strength, vec3 color, float pitch)',
    'float steam(vec2 p, vec2 foot, float h, float w, float speed, int seed)',
    'float pitch(float u)',
    'float night()',
    'vec3 keyInk(float k)',
    'vec2 keyShift(float u)',
    'vec3 keyPlate(vec3 sky, float sdShifted, float width, float alpha, float k)',
    'vec3 nightInk(vec3 c, float k)',
    'vec3 lamp(vec3 sky, vec2 p, vec2 at, float radius, vec3 color, float strength)',
    'int spriteAt(uint rows[8], ivec2 size, ivec2 c, bool flip)',
    'vec3 sprite(vec3 sky, vec2 p, vec2 origin, float cell, uint rows[8], ivec2 size, bool flip, vec3 palette[8], float k)',
  ])
  expect([...THEME_SIGNALS]).toEqual([
    'ELEVATION', 'PROGRESS', 'IS_DAY', 'MOON_ILLUMINATION', 'MOON_WAXING', 'MOON_AT', 'MOON_UP', 'CLOUDINESS', 'COVER', 'WIND',
    'PRECIPITATION', 'AURORA', 'AURORA_FLOOR', 'DEMO_COUNT', 'DEMO_SECONDS', 'DEMO_ELEVATION', 'DEMO_PROGRESS', 'DEMO_DAY',
    'INK_BLUE', 'INK_PINK', 'INK_YELLOW', 'INK_GREEN', 'INK_ORANGE', 'INK_VIOLET', 'INK_INDIGO',
    'ISS_UP', 'ISS_AT', 'ISS_TRAIL', 'BEACON', 'BEACON_URGENT', 'CONTEXT', 'STAGE_PX', 'Y_UP', 'LIGHT',
    'SHOOTING_RATE', 'FIREWORKS', 'FLAG_DAY', 'KEEPER_ASLEEP', 'THEME_FORCE', 'EVENT_COUNT', 'EVENT_KIND', 'EVENT_SEED', 'EVENT_SECONDS',
  ])
  const text = skyShader(params, FYR)
  for (const signal of THEME_SIGNALS) expect(text).toMatch(new RegExp(`\\bconst \\w+ ${signal}\\b`))
})

test("whenOf says what every engine event's own condition says", () => {
  const whens: Record<string, ThemeWhen> = {
    balloon: { sun: 'day', windBelow: 6, dry: true },
    birds: { months: [3, 4, 5, 8, 9, 10], sun: 'low', dry: true },
    plane: { sun: 'day', clearAtMost: 0.3 },
    kite: { sun: 'day', windAtLeast: 6, windAtMost: 12, dry: true },
    leaves: { months: [9, 10, 11], windAtLeast: 5, elevationAbove: -6 },
    blossom: { months: [5], elevationAbove: -6 },
    comet: { sun: 'night', clearAtMost: 0.6 },
    constellation: { sun: 'night', clearAtMost: 0.5 },
  }
  expect(EVENTS.map(spec => spec.kind).sort()).toEqual(Object.keys(whens).sort())
  // Each condition's edges and either side of them.
  const elevations = [-20, -8.5, -8, -7.5, -6.5, -6, -5.5, -3.5, -3, -2.5, 0, 1.5, 2, 2.5, 10, 14.5, 15, 15.5, 30]
  const winds = [0, 4.5, 5, 5.5, 5.9, 6, 6.1, 9, 11.9, 12, 12.1, 15]
  const clouds = [0, 0.3, 0.31, 0.5, 0.51, 0.6, 0.61, 0.9]
  const wrong: string[] = []
  let n = 0
  for (const month of [1, 3, 4, 5, 6, 8, 9, 10, 11, 12]) {
    for (const elevation of elevations) {
      for (const wind of winds) {
        for (const cloudiness of clouds) {
          for (const sky of ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder'] as const) {
            const ctx = { time: { year: 2026, month, day: 10, weekday: 6, hour: 12, minute: 0 }, elevation, cloudiness, sky, wind, lastRainAt: null, ms: 0 } as EventContext
            for (const spec of EVENTS) if (whenOf(whens[spec.kind]!)(ctx) !== spec.when(ctx)) wrong.push(`${spec.kind} ${JSON.stringify(ctx)}`)
            n++
          }
        }
      }
    }
  }
  expect(n).toBeGreaterThan(100_000)
  expect(wrong.slice(0, 5)).toEqual([])
})

test("fyr's GLSL and its night shader with the aurora, the ISS and the grill keep under the caps", () => {
  const night = shaderParams(
    { ms: Date.UTC(2026, 9, 26, 3), t: 0, place: STOCKHOLM, weather: null, isAuroraForced: true },
    { iss: { at: { x: 0.05, y: 0.33 }, trail: { x: -0.02, y: 0.345 } }, context: { fish: 9, state: 'grill' } },
  )
  expect(night.chart.stars.length).toBeGreaterThan(50)
  expect(FYR.glsl.length).toBeLessThanOrEqual(THEME_GLSL_MAX)
  expect(skyShader(night, FYR).length).toBeLessThanOrEqual(SHADER_MAX)
})

test("fyr keeps the context itself, so its shader has no wastebasket; a theme that leaves it to the engine gets one", () => {
  expect(FYR.manifest.context).toBe('resident')
  const fyr = skyShader(params, FYR)
  expect(fyr).not.toContain('basket(')
  const engine = skyShader(params, { ...bare, manifest: { ...bare.manifest, context: 'engine' } })
  expect(engine).toContain('vec3 basket(')
  const main = /void mainImage\([^)]*\) \{[\s\S]*?\n\}/.exec(engine)?.[0] ?? ''
  expect(main.indexOf('sky = basket(')).toBeLessThan(main.indexOf('sky = shaded('))
  expect(main.indexOf('sky = basket(')).toBeGreaterThan(main.indexOf('sky = weather('))
})

test('a theme that leaves out themeEvent or themeWindow gets the engine stubs', () => {
  const only = skyShader(params, { ...bare, glsl: 'vec3 scenery(vec3 sky, vec2 p, float u, float k) { return sky; }\nvec3 resident(vec3 sky, vec2 p, float u, float k) { return sky; }\n' })
  expect(only).toContain('vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) { return sky; }')
  expect(only).toContain('float themeWindow(vec2 p, float u) { return 1.0; }')
  expect(only.match(/vec3 scenery\(vec3 sky, vec2 p, float u, float k\) \{/g)).toHaveLength(1)
  // fyr defines all four, once each.
  const fyr = skyShader(params, FYR)
  for (const name of ['scenery', 'resident', 'themeEvent', 'themeWindow']) expect(fyr.match(new RegExp(`\\b${name}\\([^)]*\\) \\{`, 'g'))).toHaveLength(1)
})

test("fyr's dolphins answer to their old Swedish words, as aliases now", () => {
  expect(kindOf('delfin', FYR)).toBe('dolphin')
  expect(kindOf('rosa delfin', FYR)).toBe('pinkDolphin')
  expect(kindOf('dolphin', FYR)).toBe('dolphin')
  expect(kindOf('pinkdolphin', FYR)).toBe('pinkDolphin')
  expect(kindOf('pink dolphin', FYR)).toBe('pinkDolphin')
  expect(kindOf('komet', FYR)).toBe('comet')
  expect(kindOf('delfin', bare)).toBeUndefined()
  expect(wordsOf(FYR).abduction).toBe('ufo abduction')
  expect(wordsOf(FYR).surf).toBe('surf')
})
