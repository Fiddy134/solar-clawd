import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { localTime, moonAt, occasionAt, STOCKHOLM, sunAt, swedishClock } from './astro'
import { activityAt, drawFrame, isPrintable, ROWS } from './clawd'
import { fromBase64 } from './paint'
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
  const options = { background: 0x282c34 }
  const shader = skyShader(shaderParams(input, options))
  // Within the same two minutes, nothing to reload.
  expect(skyShader(shaderParams({ ...input, ms: input.ms + 30_000 }, options))).toBe(shader)
  expect(skyShader(shaderParams({ ...input, ms: input.ms + 180_000 }, options))).not.toBe(shader)
  expect(shader).toContain('const vec3 BACKGROUND = vec3(0.1569, 0.1725, 0.2039);')
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
  let now = 0
  on('env.get', (_, e) => ({ value: ({ TERM_PROGRAM: 'ghostty', HOME: '/Users/test' } as Record<string, string>)[e.name] }))
  on('fs.write', (_, e) => {
    files.set(e.path, { text: e.text, mtimeMs: now })
    return { value: undefined }
  })
  on('fs.read', (_, e) => (files.has(e.path) ? { value: files.get(e.path)!.text } : { deny: 'ENOENT' }))
  on('fs.list', (_, e) => ({
    value: [...files.entries()]
      .filter(([path]) => path.startsWith(`${e.path}/`) && !path.slice(e.path.length + 1).includes('/'))
      .map(([path, file]) => ({ name: path.slice(e.path.length + 1), kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false })),
  }))
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const [command] = e.argv
    let stdout = ''
    if (command === '/usr/sbin/ioreg') stdout = `    | |   "HIDIdleTime" = ${idleSeconds.value * 1e9}\n`
    if (command?.endsWith('/ghostty')) stdout = 'background = #1e1e2e\nforeground = #cdd6f4\n'
    if (command === '/bin/rm') for (const path of e.argv.slice(2)) files.delete(path)
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'this-session' }))
  on('session.end', () => ({ sessionId: 'this-session' }))
  on('ui.toast', () => ({ value: undefined }))

  return { files, runs, tick: (ms: number) => (now = ms) }
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
  // The terminal's own background, as Ghostty says it, is where the sky shows.
  expect(shader?.[1].text).toContain('const vec3 BACKGROUND = vec3(0.1176, 0.1176, 0.1804);')
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
