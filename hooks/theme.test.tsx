// A theme and the engine: the manifest's checks, the lint, the contract,
// and fyr, the theme built in, under all three.

import { expect, test } from 'claude-code/testing'

import { STOCKHOLM, swedishOffsetMs } from './astro'
import { EVENTS, kindOf, wordsOf } from './events'
import type { EventContext } from './events'
import { shaderParams, skyShader, THEME_SIGNALS } from './shader'
import type { Weather } from './sky'
import { swedish } from './test-kit'
import { COMMON } from './glsl/common'
import { CONTEXT_MARK } from './glsl/context'
import { EVENTS as EVENTS_GLSL } from './glsl/events'
import { PROTOTYPES } from './glsl/prototypes'
import { checkTheme, engineNames, longNight, NO_THEME, themeFiles, themeOfFiles, weightOf } from './themes/check'
import { BASE_THEME, THEMES } from './themes/index'
import { ENGINE_CONTRACT, lintTheme, SHADER_MAX, STAGE_WIDTHS, stagePtOf, THEME_GLSL_MAX, themeOf, topLevelNames, whenOf } from './themes/theme'
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

test("no kind of a theme's is a name every JavaScript object has, and the shader numbers one by its own events alone", () => {
  const dolphin = FYR.manifest.events[0]!
  for (const kind of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
    expect(errorOf(manifest({ events: [{ ...dolphin, kind, word: 'odd one' }] }))).not.toBeNull()
    expect(errorOf(manifest({ previews: [{ kind, word: 'odd one' }] }))).not.toBeNull()
  }
  // Even a theme that skipped themeOf gets a number, never a function's source.
  const odd: Theme = { ...bare, manifest: { ...bare.manifest, events: [{ ...dolphin, kind: 'toString', word: 'odd one' }] } }
  const text = skyShader({ ...params, events: [{ kind: 'toString', seed: 0.5, seconds: 10 }] }, odd)
  expect(text).toContain('const int EVENT_KIND[1] = int[1](100);')
  expect(skyShader({ ...params, events: [{ kind: 'constructor', seed: 0.5, seconds: 10 }] }, bare)).toContain('const int EVENT_KIND[1] = int[1](0);')
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
  // A header with a parenthesis in it is read too, not passed over.
  flags('float f() { float s = 0.0; for (int i = int(0.0); i < 100000000; i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < min(100000000, 200000000); i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i += (1)) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i++ s += 1.0; return s; }', 'loop not of the form')
  // Nor one that would run some 2^31 times, or for ever: a start far off,
  // a bound it never meets, no step, or a step away from the bound.
  flags('float f() { float s = 0.0; for (int i = -2147483647; i < 0; i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i != 7; i += 2) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i += 0) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i -= 0) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i > -4; i++) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i--) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 0; i <= 4; i -= 1) s += 1.0; return s; }', 'loop not of the form')
  flags('float f() { float s = 0.0; for (int i = 4; i >= 0; ++i) s += 1.0; return s; }', 'loop not of the form')
  flags(
    'float f() { float s = 0.0; for (int i = 0; i < 2; i++) { for (int j = 0; j < 2; j++) { for (int n = 0; n < 2; n++) s += 1.0; } } return s; }',
    'more than two deep',
  )
  // A loop whose header is not of the form still counts toward the depth.
  flags(
    'float f() { float s = 0.0; for (int i = 0; i < 2; i++) { for (int j = 0; j < 2; j++) { for (int n = int(0.0); n < 2; n++) s += 1.0; } } return s; }',
    'more than two deep',
  )
  // Nor a loop that hides what it does: a body without braces, an index
  // set back through an out parameter, loops deeper than two through a call.
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i++) s += 1.0; return s; }', 'not a { } block')
  flags(
    'float f() { float s = 0.0; for (int i = 0; i < 40; i++) for (int j = 0; j < 40; j++) for (int n = 0; n < 40; n++) s += 1.0; return s; }',
    'not a { } block',
  )
  flags('void z(inout int a) { a = 0; } float f() { float s = 0.0; for (int i = 0; i < 4; i++) { z(i); } return s; }', 'int out or inout')
  flags('float f() { float s = 0.0; for (int i = 0; i < 4; i++) { s += frexp(1.0, i); } return s; }', 'writes an int through an out')
  flags(
    'float g() { float s = 0.0; for (int a = 0; a < 48; a++) { s += 1.0; } return s; } float f() { float s = 0.0; for (int i = 0; i < 48; i++) { for (int j = 0; j < 48; j++) { s += g(); } } return s; }',
    'more than two deep',
  )
  // An overload with loops counts, whichever is defined last, and so does
  // one that shares the caller's name; a signature not read is not passed.
  flags(
    'float g(float x) { float s = 0.0; for (int a = 0; a < 48; a++) { s += x; } return s; } float g() { return 1.0; } float f() { float s = 0.0; for (int i = 0; i < 48; i++) { for (int j = 0; j < 48; j++) { s += g(1.0); } } return s; }',
    'more than two deep',
  )
  flags(
    'float f(float x) { float s = 0.0; for (int a = 0; a < 48; a++) { s += x; } return s; } float f() { float s = 0.0; for (int i = 0; i < 48; i++) { for (int j = 0; j < 48; j++) { s += f(1.0); } } return s; }',
    'more than two deep',
  )
  flags('float f(float x[2], vec2 y) { return 1.0; } float h(float a = (1.0)) { return a; }', 'cannot count')
  // A depth counted while a circle of overloads was cut short is not
  // reused: x(float) reaches y's two loops, and a loop calling it is three.
  flags(
    'float y(float t) { float s = 0.0; for (int a = 0; a < 48; a++) { for (int b = 0; b < 48; b++) { s += x(vec2(t)); } } return s; } float x(vec2 v) { return v.x; } float x(float t) { return y(t); } float f() { float s = 0.0; for (int i = 0; i < 48; i++) { s += x(1.0); } return s; }',
    'more than two deep',
  )
  // What is fine: its own names, a local that shadows the engine's, two
  // loops deep, a loop calling a function without one, an out parameter,
  // and the four entry points.
  expect(
    lint(`
// A comment may say while, texture( or #define.
const float MY_LEVEL = 0.5;
float wave(float x, out float y) { float pitch = 3.0; y = pitch; return x * MY_LEVEL; }
vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  for (int i = 0; i < 3; i++) { for (int j = 4; j > 0; j--) { sky *= 0.99; } }
  for (int i = 0; i < 48; i += 2) { sky += 0.001; }
  for (int i = -48; i <= 48; ++i) { sky += 0.0001; }
  for (int i = 48; i >= -48; i -= 3) { float y; sky -= 0.0001 * wave(float(i), y); }
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
    'vec3 sky_under(vec3 c, vec3 sky)',
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
    'bool sky_glyphCell(int code, ivec2 c)',
    'float sky_glyph(vec2 p, vec2 origin, float cell, int code)',
    'bool sky_wideCell(int code, ivec2 c)',
    'float sky_glyphWide(vec2 p, vec2 origin, float cell, int code)',
    'float sky_line16(vec2 p, vec2 origin, float cell, int text[16])',
    'int sky_numberCode(float value, int width, int decimals, int column)',
    'float sky_number(vec2 p, vec2 origin, float cell, float value, int width, int decimals)',
  ])
  // The context window, which a theme reads through these alone (never
  // iPalette), and the shooting stars' schedule, which fyr's night keeps to.
  expect([...CONTEXT_MARK.matchAll(/^(?:const \w+ \w+|\w+ \w+\([^)]*\))/gm)].map(m => m[0])).toEqual([
    'const int CONTEXT_IDLE',
    'const int CONTEXT_CLEARING',
    'const int CONTEXT_CLEARED',
    'const int CONTEXT_GAINED',
    'int contextFish()',
    'int contextState()',
    'const int sky_TOOL_NONE',
    'const int sky_TOOL_COMMAND',
    'const int sky_TOOL_EDIT',
    'const int sky_TOOL_READ',
    'const int sky_TOOL_WEB',
    'const int sky_TOOL_OTHER',
    'int sky_tool()',
    'int sky_agents()',
  ])
  expect(/^\w+ shootingStarAge\([^)]*\)/m.exec(EVENTS_GLSL)?.[0]).toBe('float shootingStarAge(float time, out vec2 from)')
  expect([...THEME_SIGNALS]).toEqual([
    'ELEVATION', 'PROGRESS', 'IS_DAY', 'MOON_ILLUMINATION', 'MOON_WAXING', 'MOON_AT', 'MOON_UP', 'CLOUDINESS', 'COVER', 'WIND',
    'PRECIPITATION', 'AURORA', 'AURORA_FLOOR', 'DEMO_COUNT', 'DEMO_SECONDS', 'DEMO_ELEVATION', 'DEMO_PROGRESS', 'DEMO_DAY',
    'INK_BLUE', 'INK_PINK', 'INK_YELLOW', 'INK_GREEN', 'INK_ORANGE', 'INK_VIOLET', 'INK_INDIGO',
    'ISS_UP', 'ISS_AT', 'ISS_TRAIL', 'WAITING', 'WAITING_URGENT', 'CONTEXT', 'STAGE_PX', 'Y_UP', 'LIGHT',
    'SHOOTING_RATE', 'FIREWORKS', 'FLAG_DAY', 'CLAWD_ASLEEP', 'THEME_FORCE', 'EVENT_COUNT', 'EVENT_KIND', 'EVENT_SEED', 'EVENT_SECONDS',
    'LOCAL_HOUR', 'WEEKDAY', 'MONTH', 'DAY', 'TEMPERATURE', 'CLAWD_ACTIVITY',
    'sky_QUOTE_COUNT', 'sky_BTC', 'sky_ETH', 'sky_NDX', 'sky_AAPL', 'sky_MSFT', 'sky_NVDA', 'sky_GOOGL', 'sky_AMZN', 'sky_META', 'sky_TSLA',
    'sky_QUOTE_PRICE', 'sky_QUOTE_CHANGE', 'sky_QUOTES_FRESH', 'sky_MARKET_OPEN', 'sky_NEW_YORK_HOUR', 'sky_NEW_YORK_WEEKDAY', 'sky_TRADING_DAY',
  ])
  const text = skyShader(params, FYR)
  for (const signal of THEME_SIGNALS) expect(text).toMatch(new RegExp(`\\bconst \\w+ ${signal}\\b`))
})

test("a theme reads the local hour, the day, the weather's temperature and Clawd's day", () => {
  const text = (ms: number, weather: Weather | null) => skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather, offsetMs: swedishOffsetMs(ms) }, {}), FYR)
  const frosty = { temperature: -2.4, code: 71, cloudCover: 60, wind: 3 }
  // A Saturday evening in October, half past nine: vibing.
  const evening = text(swedish(2026, 10, 24, 21, 30), frosty)
  for (const line of ['const float LOCAL_HOUR = 21.5;', 'const int WEEKDAY = 6;', 'const int MONTH = 10;', 'const int DAY = 24;', 'const float TEMPERATURE = -2.0;', 'const int CLAWD_ACTIVITY = 3;']) {
    expect(evening).toContain(line)
  }
  // Four on a Monday morning, the weather unknown: asleep, and a mild day.
  const night = text(swedish(2026, 10, 26, 4, 10), null)
  for (const line of ['const float LOCAL_HOUR = 4.1667;', 'const int WEEKDAY = 1;', 'const float TEMPERATURE = 10.0;', 'const int CLAWD_ACTIVITY = 5;', 'const float CLAWD_ASLEEP = 1.0;']) {
    expect(night).toContain(line)
  }
  // From early bird to asleep, in the band's own order.
  expect([6, 9, 13, 17, 23, 4].map(hour => /const int CLAWD_ACTIVITY = (\d);/.exec(text(swedish(2026, 10, 27, hour), null))![1])).toEqual(['0', '1', '2', '3', '4', '5'])
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
  // A comment that reads like a definition defines nothing.
  const commented = skyShader(params, { ...bare, glsl: '// themeEvent(...) { ... }\n/* float themeWindow(vec2 p, float u) { return 0.0; } */\n' })
  expect(commented).toContain('vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) { return sky; }')
  expect(commented).toContain('float themeWindow(vec2 p, float u) { return 1.0; }')
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

test("/solar event finds a theme's word with a space or a capital, and an alias with ä however it is typed", () => {
  const gate: Theme = {
    ...bare,
    manifest: {
      ...bare.manifest,
      events: [{ kind: 'landing', word: 'A380 landing', slotMinutes: 60, chance: 0.5, minutes: 1, layer: 'front', when: {} }],
      previews: [{ kind: 'fountain', word: 'fountain' }],
      aliases: { fontän: 'fountain' },
    },
  }
  // /solar lowers what the person typed before it asks.
  expect(kindOf('a380 landing', gate)).toBe('landing')
  expect(kindOf('fontän', gate)).toBe('fountain')
  expect(kindOf('fontän'.normalize('NFD'), gate)).toBe('fountain')
  expect(kindOf('fountain', gate)).toBe('fountain')
  // A name every object has is no word.
  expect(kindOf('constructor', gate)).toBeUndefined()
  expect(kindOf('tostring', FYR)).toBeUndefined()
  expect(kindOf('luftballong', gate)).toBe('balloon')
})

test('fyr packs to a manifest.json and a theme.glsl that read back as fyr and check clean', () => {
  const files = themeFiles(FYR)
  expect(Object.keys(files)).toEqual(['manifest.json', 'theme.glsl'])
  const back = themeOfFiles(files['manifest.json'], files['theme.glsl'])
  expect(back).toEqual(FYR)
  expect(checkTheme(back as Theme)).toEqual([])
  expect('error' in themeOfFiles('{ "engine": 1', '')).toBe(true)
  expect(themeOfFiles(JSON.stringify({ ...FYR.manifest, engine: 2 }), FYR.glsl)).toEqual({ error: 'the manifest asks for engine contract 2; this engine has 1' })
})

test('the check says what the lint and the caps say; the engine alone has every stub and checks clean', () => {
  expect(checkTheme(FYR)).toEqual([])
  expect(checkTheme(NO_THEME)).toEqual([])
  expect(checkTheme({ ...FYR, glsl: `${FYR.glsl}\nfloat spin() { float a = 0.0; while (a < 1.0) a += 0.1; return a; }\n` })).toContain('uses a while loop')
  expect(checkTheme({ ...FYR, glsl: `${FYR.glsl}\n// ${'x'.repeat(THEME_GLSL_MAX)}\n` }).some(problem => problem.startsWith('its GLSL is'))).toBe(true)
  expect(checkTheme({ ...FYR, glsl: `${FYR.glsl}\n// ${'x'.repeat(SHADER_MAX)}\n` }).some(problem => problem.startsWith('the whole shader of a long night is'))).toBe(true)
  // The wastebasket's names are the engine's, though fyr's shader leaves it out.
  expect(engineNames()).toContain('basket')
  expect(checkTheme({ ...FYR, glsl: `${FYR.glsl}\nvec3 basket(vec3 sky) { return sky; }\n` })).toContain("defines basket, which is the engine's")
  const none = skyShader(params, NO_THEME)
  expect(none).toContain('vec3 scenery(vec3 sky, vec2 p, float u, float k) { return sky; }')
  expect(none).toContain('vec3 resident(vec3 sky, vec2 p, float u, float k) { return sky; }')
  expect(none).toContain('vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) { return sky; }')
  expect(none).toContain('float themeWindow(vec2 p, float u) { return 1.0; }')
  expect(none).not.toContain('basket(')
  expect(weightOf(NO_THEME).glsl).toBe(0)
  expect(weightOf(FYR).night).toBe(skyShader(longNight(), FYR).length)
})

test('a theme may say it shows the market, as true or false', () => {
  expect(errorOf(manifest({ market: true }))).toBeNull()
  expect(errorOf(manifest({ market: false }))).toBeNull()
  expect(errorOf(manifest({ market: 'yes' }))).toBe('market is not true or false')
  expect(FYR.manifest.market).toBeUndefined()
})

test('a theme that wants the stage may ask it wider, 240 to 480 points in steps of 40; fyr keeps 240', () => {
  expect([...STAGE_WIDTHS]).toEqual([240, 280, 320, 360, 400, 440, 480])
  for (const stagePt of STAGE_WIDTHS) expect(errorOf(manifest({ stagePt }))).toBeNull()
  const wrong = 'stagePt is not one of 240, 280, 320, 360, 400, 440 and 480 points'
  expect(errorOf(manifest({ stagePt: 250 }))).toBe(wrong)
  expect(errorOf(manifest({ stagePt: 520 }))).toBe(wrong)
  expect(errorOf(manifest({ stagePt: '400' }))).toBe(wrong)
  expect(errorOf(manifest({ stagePt: 400, stage: 'none' }))).toBe('stagePt is for a theme that wants the stage')
  expect(stagePtOf(FYR)).toBe(240)
  expect(FYR.manifest.stagePt).toBeUndefined()
  const wide = themeOf(manifest({ stagePt: 400 }), '') as Theme
  expect(stagePtOf(wide)).toBe(400)
})
