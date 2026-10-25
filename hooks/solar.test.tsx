import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { horizontalAt, localTime, moonAt, occasionAt, STOCKHOLM, sunAt, swedishClock } from './astro'
import { activityAt, drawFrame, isPrintable, ROWS } from './clawd'
import { contextAt, EVENTS, eventsAt, shootingRate } from './events'
import { domePoint, HORIZON, ZENITH_Y } from './dome'
import { fromBase64 } from './paint'
import { staleFiles } from './tidy'
import { shaderParams, skyShader } from './shader'
import { wallpaperPng } from './sky'

const BAND = {
  plugin: 'solar-clawd',
  surface: 'terminal',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the hours map to what Clawd does, weekends sleeping in', () => {
  const tuesday = [3, 6, 11, 12, 17, 18, 21, 22].map(hour => activityAt({ hour, weekday: 2 }))
  expect(tuesday).toEqual(['sleep', 'coffee', 'coffee', 'code', 'code', 'gta', 'gta', 'sleep'])
  expect(activityAt({ hour: 8, weekday: 6 })).toBe('sleep')
  expect(activityAt({ hour: 23, weekday: 5 })).toBe('gta')
})

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

test('a frame packs one cell per column and row, the wallpaper is a PNG', async () => {
  const view = { columns: 60, ms: Date.UTC(2026, 9, 24, 17, 30), t: 3, mode: 'live' as const, place: STOCKHOLM }
  expect(drawFrame(view).length).toBe(Math.ceil((60 * ROWS * 12) / 3) * 4)
  expect((await wallpaperPng(view, 120, 80)).startsWith('iVBORw0KGgo')).toBe(true)
})

test('the band is one Raster of cells, Clawd among them, and /solar hides it', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 24, 17, 30) })
  on('command.register', () => ({ value: { command: 'solar' } }))
  // Not in iTerm2, and nothing to read: the mod draws its own sky.
  on('env.get', () => ({ value: undefined }))
  on('fs.read', () => ({ deny: 'no file in a test' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // Stands for the engine, which draws an empty band when the mod passes.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(BAND)
  const sky = await ui.find({ type: 'Raster', key: 'sky' })
  expect(sky?.props.rows).toBe(ROWS)
  expect(sky?.props.columns).toBe(80)
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  await ui.unmount()

  await $.command.run({
    command: 'solar',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  const hidden = await $.ui.mount(BAND)
  expect(await hidden.find({ type: 'Raster' })).toBeUndefined()
  expect((await hidden.find({ type: 'Text' }))?.text).toBe('engine')
  await hidden.unmount()
})

test('control characters never reach a cell', () => {
  expect([0x1b, 0x07, 0x7f, 0x9b].some(isPrintable)).toBe(false)
  expect(['a', 'å', 'é', ' '].every(ch => isPrintable(ch.charCodeAt(0)))).toBe(true)
  const place = { name: 'Evil\u001b]0;pwn\u0007', lat: 59.33, lon: 18.07 }
  const cells = fromBase64(drawFrame({ ms: Date.UTC(2026, 9, 24, 10), t: 0, place, columns: 80, mode: 'live' }))
  const words = new Uint32Array(cells.buffer, cells.byteOffset, cells.length / 4)
  for (let i = 0; i < words.length; i += 3) expect(isPrintable(words[i]!) || words[i] === 0x2580 || words[i] === 0x2584).toBe(true)
})

test('the sky shader is the same text for the same scene, its constants baked in', () => {
  const snowyNight = { temperature: -2, code: 71, cloudCover: 60, wind: 3 }
  const input = { ms: Date.UTC(2026, 9, 24, 20, 0), t: 0, place: STOCKHOLM, weather: snowyNight, kp: 5 }
  const options = {}
  const shader = skyShader(shaderParams(input, options))
  // Within the same two minutes, nothing to reload.
  expect(skyShader(shaderParams({ ...input, ms: input.ms + 30_000 }, options))).toBe(shader)
  expect(skyShader(shaderParams({ ...input, ms: input.ms + 180_000 }, options))).not.toBe(shader)
  expect(shader).toContain('const float IS_DAY = 0.0;')
  expect(shader).toContain('const int PRECIPITATION = 4;')
  expect(shader).toContain('const int DEMO_COUNT = 0;')
  expect(shader).toContain('void mainImage(out vec4 fragColor, in vec2 fragCoord)')
  expect(skyShader(shaderParams({ ...input, ms: Date.UTC(2026, 9, 24, 11) }, options))).toContain('const float IS_DAY = 1.0;')
  // A demo bakes in the whole day, played with iTime.
  expect(skyShader(shaderParams(input, { ...options, demo: { seconds: 48 } }))).toContain('const int DEMO_COUNT = 96;')
})

// Ghostty, its config, the runtime folder and the person's idleness, in memory.
function ghosttyWorld(on: On, idleSeconds: { value: number }) {
  const files = new Map<string, { text: string; mtimeMs: number }>()
  const runs: string[][] = []
  // Paths written to, in order; commands answering as though they failed.
  const writes: string[] = []
  const failing = new Set<string>()
  let now = 0
  on('env.get', (_, e) => ({ value: ({ TERM_PROGRAM: 'ghostty', HOME: '/Users/test' } as Record<string, string>)[e.name] }))
  on('fs.write', (_, e) => {
    files.set(e.path, { text: e.text, mtimeMs: now })
    writes.push(e.path)
    return { value: undefined }
  })
  const unreadable = new Set<string>()
  on('fs.read', (_, e) => (files.has(e.path) && !unreadable.has(e.path) ? { value: files.get(e.path)!.text } : { deny: 'ENOENT' }))
  on('fs.exists', (_, e) => ({ value: files.has(e.path) }))
  on('fs.list', (_, e) => ({
    value: [...files.entries()]
      .filter(([path]) => path.startsWith(`${e.path}/`) && !path.slice(e.path.length + 1).includes('/'))
      .map(([path, file]) => ({ name: path.slice(e.path.length + 1), kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false })),
  }))
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const [command] = e.argv
    if (command && failing.has(command)) return { value: { exitCode: 1, stdout: '', stderr: 'failed', isStdoutTruncated: false, isStderrTruncated: false } }
    let stdout = ''
    if (command === '/usr/sbin/ioreg') stdout = `    | |   "HIDIdleTime" = ${idleSeconds.value * 1e9}\n`
    if (command === '/bin/rm') for (const path of e.argv.slice(2)) files.delete(path)
    if (command === '/bin/mv') {
      const [from, to] = e.argv.slice(-2) as [string, string]
      if (files.has(from)) files.set(to, { ...files.get(from)!, mtimeMs: now })
      files.delete(from)
    }
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'this-session' }))
  on('session.end', () => ({ sessionId: 'this-session' }))
  on('ui.toast', () => ({ value: undefined }))

  return { files, runs, writes, failing, unreadable, tick: (ms: number) => (now = ms) }
}

const RELOADS = (runs: string[][]) => runs.filter(argv => argv[0] === '/usr/bin/osascript' && argv.join(' ').includes('reload_config')).length

test('in Ghostty the sky is a shader, rewritten as the scene moves, off while the person is away', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const idle = { value: 3 }
  const world = ghosttyWorld(on, idle)
  world.tick(start)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)

  const include = [...world.files.entries()].find(([path]) => path.endsWith('/runtime/solar-clawd.ghostty'))
  const shader = [...world.files.entries()].find(([path]) => path.endsWith('/runtime/sky.glsl'))
  expect(include?.[1].text).toContain(`custom-shader = ${shader?.[0]}`)
  expect(RELOADS(world.runs)).toBe(1)

  // Nothing new within the same two minutes: no reload.
  await clock.advance(30_000)
  expect(RELOADS(world.runs)).toBe(1)
  // The sun moves on: a new shader, one reload.
  await clock.advance(120_000)
  expect(RELOADS(world.runs)).toBe(2)

  // Away five minutes: the sky goes, and comes back with the person.
  idle.value = 400
  await clock.advance(11_000)
  expect(include?.[0] && world.files.get(include[0])?.text).toBe('')
  expect(RELOADS(world.runs)).toBe(3)
  idle.value = 1
  await clock.advance(11_000)
  expect(include?.[0] && world.files.get(include[0])?.text).toContain('custom-shader = ')
  expect(RELOADS(world.runs)).toBe(4)

  // The last session ending takes the sky with it.
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(include?.[0] && world.files.get(include[0])?.text).toBe('')
  expect(RELOADS(world.runs)).toBe(5)
})

test('another live session keeps the sky up when this one ends', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)
  const [runtime] = [...world.files.keys()].filter(path => path.endsWith('/runtime/sky.glsl')).map(path => path.slice(0, -'/sky.glsl'.length))
  world.files.set(`${runtime}/alive-other-session`, { text: '', mtimeMs: start })
  const reloads = RELOADS(world.runs)

  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect([...world.files.entries()].find(([path]) => path.endsWith('/solar-clawd.ghostty'))?.[1].text).toContain('custom-shader = ')
  expect(RELOADS(world.runs)).toBe(reloads)
})

// A context for a moment over Stockholm, with this weather.
const contextFor = (ms: number, weather = { temperature: 12, code: 0, cloudCover: 5, wind: 3 }, lastRainAt: number | null = null) =>
  contextAt(ms, STOCKHOLM, weather, lastRainAt)

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

test('/solar event plays an event in the sky, and a long turn earns confetti', async ($, on) => {
  const start = Date.UTC(2026, 6, 4, 23, 30)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  const shader = () => [...world.files.entries()].find(([path]) => path.endsWith('/runtime/sky.glsl'))?.[1].text ?? ''
  const run = (args: string) =>
    $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)
  expect(shader()).toContain('const int EVENT_COUNT = 0;')

  expect(await run('event komet')).toEqual(expect.objectContaining({ text: expect.stringContaining('komet') }))
  await clock.advance(10_000)
  expect(shader()).toContain('const int EVENT_COUNT = 1;')
  expect(shader()).toContain('const int EVENT_KIND[1] = int[1](9);')
  // A preview ends.
  await clock.advance(100_000)
  expect(shader()).toContain('const int EVENT_COUNT = 0;')

  await $.turn.complete({ answer: 'done', durationMs: 4 * 60_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(10_000)
  expect(shader()).toContain('int[1](11)')
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
  ])
})

test('in iTerm2 the clouds move only while the person is at it, in front', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 12, 0)
  const clock = mock.clock(on, { now: start })
  const state = { idleSeconds: 1, frontmost: 'true' }
  let pictures = 0
  mock.env(on, { ITERM_SESSION_ID: 'w0t0p0:0F8E2C1A-1111-4A4A-9B9B-123456789ABC', HOME: '/Users/test' })
  mock.store(on)
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [] }))
  on('process.run', (_, e) => {
    const [command] = e.argv
    let stdout = ''
    if (command === '/usr/sbin/ioreg') stdout = `"HIDIdleTime" = ${state.idleSeconds * 1e9}\n`
    if (command === '/usr/bin/base64') pictures += 1
    if (command === '/usr/bin/osascript') stdout = e.argv.some(arg => arg.includes('background image')) ? `ok 120 80 ${state.frontmost}` : state.frontmost
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(30_000)
  const active = pictures
  expect(active).toBeGreaterThan(5)

  // Away: a still sky, brought up to date every five minutes at most.
  state.idleSeconds = 600
  await clock.advance(4_000)
  const away = pictures
  await clock.advance(120_000)
  expect(pictures - away).toBeLessThanOrEqual(1)

  // Back, but iTerm2 behind another window: still.
  state.idleSeconds = 1
  state.frontmost = 'false'
  await clock.advance(4_000)
  const behind = pictures
  await clock.advance(60_000)
  expect(pictures - behind).toBeLessThanOrEqual(1)
})

const CONFIG = '/Users/test/Library/Application Support/com.mitchellh.ghostty/config.ghostty'

// A Ghostty session started, its first sky written; answers the runtime folder.
async function startGhostty($: Engine, on: On, clock: ReturnType<typeof mock.clock>, world: ReturnType<typeof ghosttyWorld>) {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)
  const shader = [...world.files.keys()].find(path => path.endsWith('/runtime/sky.glsl'))!

  return shader.slice(0, -'/sky.glsl'.length)
}

test('/clear keeps the sky: the session goes on', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)
  const reloads = RELOADS(world.runs)

  await $.session.end({ reason: 'clear', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toContain('custom-shader = ')
  expect(RELOADS(world.runs)).toBe(reloads)
})

test('the shader takes the terminal background from Ghostty itself', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)
  const shader = world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  expect(shader).toContain('iBackgroundColor')
  expect(shader).not.toContain('const vec3 BACKGROUND')
  expect(world.runs.some(argv => argv.some(a => a.includes('show-config')))).toBe(false)
})

test('/solar ghostty never writes over a config it could not read', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: 'font-size = 14\ntheme = Dracula\n', mtimeMs: start })
  world.unreadable.add(CONFIG)
  await startGhostty($, on, clock, world)

  await $.command.run({ command: 'solar', args: 'ghostty', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(world.files.get(CONFIG)?.text).toBe('font-size = 14\ntheme = Dracula\n')
})

test('a sky another session took down comes back while this one wants it', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)
  const reloads = RELOADS(world.runs)

  // Another session, ending, emptied the include.
  world.files.set(`${runtime}/solar-clawd.ghostty`, { text: '', mtimeMs: start })
  await clock.advance(10_000)
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toContain('custom-shader = ')
  expect(RELOADS(world.runs)).toBe(reloads + 1)

  // Hidden with /solar, in any session: a file all of them read.
  await $.command.run({ command: 'solar', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.advance(10_000)
  expect(world.files.has(`${runtime}/hidden`)).toBe(true)
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toBe('')
})

test('the band keeps its own sky until Ghostty includes the shader', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 12, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const runtime = await startGhostty($, on, clock, world)
  const isClear = async () => {
    const ui = await $.ui.mount(BAND)
    const cells = fromBase64(String((await ui.find({ type: 'Raster', key: 'sky' }))?.props.cells))
    await ui.unmount()
    const words = new Uint32Array(cells.buffer, cells.byteOffset, cells.length / 4)
    return words[2] === 0x01000000
  }
  expect(await isClear()).toBe(false)

  world.files.set(CONFIG, { text: `# Solar\nconfig-file = ?${runtime}/solar-clawd.ghostty\n`, mtimeMs: start })
  await clock.advance(61_000)
  expect(await isClear()).toBe(true)
})

test('a reload Ghostty did not take is tried again on the next tick', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.failing.add('/usr/bin/osascript')
  await startGhostty($, on, clock, world)
  const tried = RELOADS(world.runs)
  expect(tried).toBeGreaterThan(0)

  world.failing.delete('/usr/bin/osascript')
  await clock.advance(10_000)
  expect(RELOADS(world.runs)).toBe(tried + 1)
  // Taken: nothing more is owed.
  await clock.advance(10_000)
  expect(RELOADS(world.runs)).toBe(tried + 1)
})

test('once the session has ended, no tick brings the sky or the heartbeat back', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)

  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  await clock.advance(130_000)
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toBe('')
  expect(world.files.has(`${runtime}/alive-this-session`)).toBe(false)
})

test('/solar ghostty puts its line in place of one the mod left from another folder', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const old = '# Solar Clawd: the sky shader while a Claude session runs (empty otherwise).\nconfig-file = ?/old/place/runtime/solar-clawd.ghostty\n'
  world.files.set(CONFIG, { text: `font-size = 14\n${old}theme = Dracula\n`, mtimeMs: start })
  const runtime = await startGhostty($, on, clock, world)

  await $.command.run({ command: 'solar', args: 'ghostty', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  const text = world.files.get(CONFIG)?.text ?? ''
  expect(text).not.toContain('/old/place/')
  expect(text.match(/^config-file = /gm)?.length).toBe(1)
  expect(text).toContain(`config-file = ?${runtime}/solar-clawd.ghostty`)
  expect(text).toContain('font-size = 14\ntheme = Dracula\n')
})

test('the shader and the include are written whole: a file of their own, moved into place', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)

  expect(world.writes).not.toContain(`${runtime}/sky.glsl`)
  expect(world.writes).not.toContain(`${runtime}/solar-clawd.ghostty`)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('void mainImage')
  expect([...world.files.keys()].some(path => path.includes('.tmp-'))).toBe(false)
})

test('a failed ioreg keeps the last answer, and Ghostty asks no ioreg of its own', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const idle = { value: 1 }
  const world = ghosttyWorld(on, idle)
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)
  idle.value = 400
  await clock.advance(10_000)
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toBe('')

  // ioreg fails while the person is away: still away, the sky stays off.
  world.failing.add('/usr/sbin/ioreg')
  await clock.advance(20_000)
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toBe('')

  // One ioreg each three seconds, and none besides.
  world.failing.delete('/usr/sbin/ioreg')
  const asked = world.runs.filter(argv => argv[0] === '/usr/sbin/ioreg').length
  await clock.advance(30_000)
  expect(world.runs.filter(argv => argv[0] === '/usr/sbin/ioreg').length - asked).toBe(10)
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

test('a soft hyphen is no printable character', () => {
  expect(isPrintable(0xad)).toBe(false)
  expect(isPrintable(0xe5)).toBe(true)
})

test('tidying takes the temp files a crashed write left, and no one else\'s', () => {
  const now = Date.UTC(2026, 9, 25, 12)
  const entry = (name: string, mtimeMs: number) => ({ name, kind: 'file' as const, size: 1, mtimeMs, isLink: false })
  const entries = [
    entry('sky.glsl.tmp-old-session', now - 2 * 3_600_000),
    entry('solar-clawd.ghostty.tmp-old-session', now - 2 * 3_600_000),
    entry('sky.glsl.tmp-live-session', now - 60_000),
    entry('notes.txt.tmp-old-session', now - 2 * 3_600_000),
  ]
  expect(staleFiles(entries, '/runtime', now, []).sort()).toEqual(['/runtime/sky.glsl.tmp-old-session', '/runtime/solar-clawd.ghostty.tmp-old-session'])
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
  expect(skyShader(params)).toContain('const vec2 MOON_AT')
})
