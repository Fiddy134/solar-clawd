// The mod in a session: Ghostty and iTerm2, the lighthouse, the keeper's
// line of fish and the wastebasket, /solar.

import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { STOCKHOLM } from './astro'
import { ROWS } from './clawd'
import { themeFiles } from './themes/check'
import { THEMES } from './themes/index'
import { rightPaddingOf, restaged, TICKER } from './ghostty'
import { markOf, UNMARK_TAB } from './mark'
import { PACE_HZ } from './pace'
import { asSettings, DEFAULT_TUNE, PREVIEW_LIFE_MS, PREVIEW_MS, TEXT_WORDS, TUNE_PANE, TUNE_WORDS } from './tune'
import type { TuneSettings } from './tune'
import { wallpaperPng } from './sky'
import { WAITING_MS, WAITING_SWEEP_MS } from './waiting'
import { fromBase64 } from './paint'
import { BAND, ghosttyWorld, RELOADS, CONFIG, startGhostty, SIGNALS, linuxWorld, waitingWorld, ISS_OMM, ISS_PASS, TTY } from './test-kit'

// The comment the mod writes with its include and the stage, and the one it
// wrote before there was a stage; where its runtime folder is on a Mac.
const STAGED = '# Solar Clawd: the sky while a Claude session runs, and a stage for the lighthouse.'
const UNSTAGED = '# Solar Clawd: the sky while a Claude session runs.'
const RUNTIME = '/Users/test/Library/Application Support/solar-clawd/runtime'

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

test('outside Ghostty, /solar event says the keeper\'s abduction and surf show only in Ghostty\'s sky', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 24, 17, 30) })
  mock.store(on)
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('env.get', () => ({ value: undefined }))
  on('fs.read', () => ({ deny: 'no file in a test' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const run = (args: string) =>
    $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  for (const name of ['ufo abduction', 'surf']) {
    const answer = (await run(`event ${name}`)) as { text: string }
    expect(answer.text).toContain(`only in Ghostty's sky`)
    expect(answer.text).not.toContain('seconds')
  }
  // The band's own events still play here.
  expect(((await run('event comet')) as { text: string }).text).toContain('90 seconds')
})

test('in Ghostty the sky is a shader, rewritten as the scene moves, still while the person is away', async ($, on) => {
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

  // Nothing lively up there: still (drawn as the terminal changes), and
  // away five minutes, still and lighter, without its clouds: one reload.
  expect(include?.[0] && world.files.get(include[0])?.text).toContain('custom-shader-animation = false')
  expect(shader?.[0] && world.files.get(shader[0])?.text).toContain('const float LIGHT = 0.0;')
  idle.value = 400
  await clock.advance(11_000)
  expect(include?.[0] && world.files.get(include[0])?.text).toContain('custom-shader-animation = false')
  expect(shader?.[0] && world.files.get(shader[0])?.text).toContain('const float LIGHT = 1.0;')
  expect(RELOADS(world.runs)).toBe(3)

  // The last session ending takes the sky with it.
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(include?.[0] && world.files.get(include[0])?.text).toBe('')
  expect(RELOADS(world.runs)).toBe(4)
})

test('a lively sky animates while the person is there, and stands still and lighter while away', async ($, on) => {
  const idle = { value: 1 }
  const { clock, include, shader } = await waitingWorld($, on, idle)
  // A storm played: the hat flies, the sky is lively.
  await $.command.run({ command: 'solar', args: 'blåst', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader-animation = true')
  expect(shader()).toContain('const float LIGHT = 0.0;')
  idle.value = 400
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader-animation = false')
  expect(shader()).toContain('const float LIGHT = 1.0;')
  idle.value = 1
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader-animation = true')
  expect(shader()).toContain('const float LIGHT = 0.0;')
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

  expect(await run('event comet')).toEqual(expect.objectContaining({ text: expect.stringContaining('comet') }))
  // The Swedish name it once took still plays it.
  expect(await run('event komet')).toEqual(expect.objectContaining({ text: expect.stringContaining('comet') }))
  await clock.advance(10_000)
  expect(shader()).toContain('const int EVENT_COUNT = 1;')
  expect(shader()).toContain('const int EVENT_KIND[1] = int[1](9);')
  // A preview ends.
  await clock.advance(100_000)
  expect(shader()).toContain('const int EVENT_COUNT = 0;')
  // fyr's dolphins, by their old Swedish words too, are the theme's events
  // from 100.
  expect(await run('event rosa delfin')).toEqual(expect.objectContaining({ text: expect.stringContaining('pink dolphin') }))
  await clock.advance(10_000)
  expect(shader()).toContain('const int EVENT_KIND[1] = int[1](101);')
  expect(await run('event delfin')).toEqual(expect.objectContaining({ text: expect.stringContaining('dolphin') }))
  await clock.advance(10_000)
  expect(shader()).toContain('const int EVENT_KIND[2] = int[2](101, 100);')
  await clock.advance(100_000)
  expect(shader()).toContain('const int EVENT_COUNT = 0;')

  await $.turn.complete({ answer: 'done', durationMs: 4 * 60_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(10_000)
  expect(shader()).toContain('int[1](11)')
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

test('/clear empties the context at once: the keeper grills his catch, the embers glow over a bare line', async ($, on) => {
  const fill = { percent: 60 }
  const { clock, world, include } = await waitingWorld($, on, { value: 1 }, () => on('session.usage', () => usageOf(fill)))
  const mark = () => lastMark(world)
  expect(mark()).toContain('rgb:00/06/01')
  fill.percent = 2
  await $.session.end({ reason: 'clear', sessionId: 'this-session', resume: { id: 'this-session' } })
  await clock.advance(10)
  expect(mark()).toContain('rgb:01/06/01')
  expect(include()).toContain('custom-shader-animation = true')
  await clock.advance(8_000)
  expect(mark()).toContain('rgb:02/00/01')
  await clock.advance(3_500)
  expect(mark()).toContain('rgb:00/00/01')
  expect(include()).toContain('custom-shader-animation = false')
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

test('on Linux Ghostty reloads on SIGUSR2, and nothing of the Mac is asked', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  await startGhostty($, on, clock, world)

  expect(world.runs.some(argv => argv.join(' ') === 'systemctl --user reload app-com.mitchellh.ghostty.service')).toBe(true)
  expect(SIGNALS(world.runs)).toBe(1)
  expect(RELOADS(world.runs)).toBe(0)
  expect(world.runs.some(argv => ['/usr/sbin/ioreg', '/usr/bin/pmset', '/usr/bin/osascript', '/usr/bin/lsappinfo'].includes(argv[0]!))).toBe(false)
})

// Ghostty's processes on a Mac as ps lists them, with their user: another
// user's app, this user's (501), whose parent is launchd, and a ghostty run
// from a shell in it, which SIGUSR2 would end.
const MAC_PS =
  '  777     1   502 /Users/other/Applications/Ghostty.app/Contents/MacOS/ghostty\n  619     1   501 /Applications/Ghostty.app/Contents/MacOS/ghostty\n 4242   619     0 /usr/bin/login\n 5150  4300   501 /Applications/Ghostty.app/Contents/MacOS/ghostty\n'
const KILLS = (runs: string[][]) => runs.filter(argv => argv[0] === '/bin/kill').map(argv => argv.join(' '))

test('on a Mac Ghostty 1.2 and later reloads on SIGUSR2 to the app alone, with no AppleScript', async ($, on) => {
  const world = await macReloads($, on, '1.4.0', MAC_PS)
  expect(KILLS(world.runs).length).toBeGreaterThan(0)
  expect(new Set(KILLS(world.runs))).toEqual(new Set(['/bin/kill -USR2 619']))
  expect(RELOADS(world.runs)).toBe(0)
})

// A Mac session reloading Ghostty of this version, ps listing these processes.
async function macReloads($: Engine, on: On, version: string, ps: string, isKillFailing = false) {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.env.set('TERM_PROGRAM_VERSION', version)
  world.answers.set('/bin/ps', ps)
  if (isKillFailing) world.failing.add('/bin/kill')
  await startGhostty($, on, clock, world)

  return world
}

test('on a Mac AppleScript reloads where ps finds no Ghostty app to signal', async ($, on) => {
  const world = await macReloads($, on, '1.4.0', ' 5150  4300   501 /Applications/Ghostty.app/Contents/MacOS/ghostty\n  777     1   502 /Applications/Ghostty.app/Contents/MacOS/ghostty\n')
  expect(KILLS(world.runs)).toEqual([])
  expect(RELOADS(world.runs)).toBeGreaterThan(0)
})

test('on a Mac AppleScript reloads where the signal was refused', async ($, on) => {
  const world = await macReloads($, on, '1.4.0', MAC_PS, true)
  expect(KILLS(world.runs).length).toBeGreaterThan(0)
  expect(RELOADS(world.runs)).toBeGreaterThan(0)
})

test('on a Mac a Ghostty before 1.2, or of no known version, is never sent SIGUSR2', async ($, on) => {
  const world = await macReloads($, on, '1.1.3', MAC_PS)
  expect(KILLS(world.runs)).toEqual([])
  expect(RELOADS(world.runs)).toBeGreaterThan(0)
})

test('on Linux the shader flips fragCoord, which OpenGL gives with y up', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  const runtime = await startGhostty($, on, clock, world)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float Y_UP = 1.0;')
})

test('on macOS fragCoord already has y down', async ($, on) => {
  const { shader } = await waitingWorld($, on)
  expect(shader()).toContain('const float Y_UP = 0.0;')
})

test('on Linux a Ghostty older than 1.3 is never sent SIGUSR2', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.2.3')
  await startGhostty($, on, clock, world)
  await clock.advance(60_000)

  expect(SIGNALS(world.runs)).toBe(0)
})

test('/solar ghostty on Linux adds the include to the XDG config that is there', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  const config = '/Users/test/.config/ghostty/config'
  world.files.set(config, { text: 'font-size = 14\n', mtimeMs: start })
  const runtime = await startGhostty($, on, clock, world)

  await $.command.run({ command: 'solar', args: 'ghostty', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(world.files.get(config)?.text).toBe(`font-size = 14\n${STAGED}\nconfig-file = ?${runtime}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`)
  expect([...world.files.keys()].some(path => path.includes('Library/Application Support'))).toBe(false)
})

test('an include the mod added to its own folder before is moved to the stable one', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: 'font-size = 14\n# Solar Clawd: the sky while a Claude session runs.\nconfig-file = ?/old/plugin/runtime/solar-clawd.ghostty\n', mtimeMs: start })
  const runtime = await startGhostty($, on, clock, world)
  expect(runtime).toBe('/Users/test/Library/Application Support/solar-clawd/runtime')
  expect(world.files.get(CONFIG)?.text).toBe(`font-size = 14\n${STAGED}\nconfig-file = ?${runtime}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`)
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
  expect(text.endsWith('window-padding-x = 2,240\n')).toBe(true)
})

test('/solar ghostty adds the stage margin, keeping the person\'s own left padding', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: 'font-size = 14\nwindow-padding-x = 10\n', mtimeMs: start })
  const runtime = await startGhostty($, on, clock, world)

  await $.command.run({ command: 'solar', args: 'ghostty', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  const expected = `font-size = 14\nwindow-padding-x = 10\n${STAGED}\nconfig-file = ?${runtime}/solar-clawd.ghostty\nwindow-padding-x = 10,240\n`
  expect(world.files.get(CONFIG)?.text).toBe(expected)
})

test('a second start on a config with the stage leaves it exactly as it is', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const text = `font-size = 14\nwindow-padding-x = 10\n${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 10,240\n`
  world.files.set(CONFIG, { text, mtimeMs: start })
  await startGhostty($, on, clock, world)
  expect(world.files.get(CONFIG)?.text).toBe(text)
  expect(world.toasts.some(toast => toast.includes('margin'))).toBe(false)
})

test('a config with our include but no stage gets the margin once, at the next start, and says so', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `font-size = 14\n${UNSTAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\n`, mtimeMs: start })
  await startGhostty($, on, clock, world)
  const upgraded = `font-size = 14\n${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`
  expect(world.files.get(CONFIG)?.text).toBe(upgraded)
  expect(world.toasts.filter(toast => toast.includes('240-point margin'))).toHaveLength(1)

  // The next session finds it given: nothing changes, nothing is said.
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)
  // (It did start again: the screen's scale was asked a second time.)
  expect(world.runs.filter(argv => argv.includes('JavaScript'))).toHaveLength(2)
  expect(world.files.get(CONFIG)?.text).toBe(upgraded)
  expect(world.toasts.filter(toast => toast.includes('240-point margin'))).toHaveLength(1)
})

test('the person deletes the margin: it is not added again at the next start', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const text = `font-size = 14\n${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\n`
  world.files.set(CONFIG, { text, mtimeMs: start })
  await startGhostty($, on, clock, world)
  expect(world.files.get(CONFIG)?.text).toBe(text)
  expect(world.toasts.some(toast => toast.includes('margin'))).toBe(false)
})

test('the person changes the margin: theirs is kept, and nothing is added after it', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const text = `font-size = 14\n${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,120\n`
  world.files.set(CONFIG, { text, mtimeMs: start })
  await startGhostty($, on, clock, world)
  expect(world.files.get(CONFIG)?.text).toBe(text)
})

test('the margin keeps the left padding of the person\'s last window-padding-x, which is the one Ghostty uses', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: 'window-padding-x = 4\nfont-size = 14\nwindow-padding-x = 10,20\n', mtimeMs: start })
  await startGhostty($, on, clock, world)

  await $.command.run({ command: 'solar', args: 'ghostty', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(world.files.get(CONFIG)?.text?.endsWith('\nwindow-padding-x = 10,240\n')).toBe(true)
})

test('the shader is told the stage strip in pixels: points times the screen scale', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`, mtimeMs: start })
  world.answers.set('/usr/bin/osascript', '2\n')
  const runtime = await startGhostty($, on, clock, world)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float STAGE_PX = 480.0;')
})

test('the stage follows the screen the front Ghostty window is on within ten seconds, asked by one session for all', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`, mtimeMs: start })
  world.answers.set('/usr/bin/osascript', '2\n')
  const runtime = await startGhostty($, on, clock, world)
  const shader = () => world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  const scale = () => world.files.get(`${runtime}/scale`)?.text.split(' ')[0]
  const asked = () => world.runs.filter(argv => argv.includes('JavaScript')).length
  expect(shader()).toContain('const float STAGE_PX = 480.0;')
  expect(scale()).toBe('2')
  // Behind another app, the screen is not asked.
  world.answers.set('/usr/bin/osascript', '1\n')
  let before = asked()
  await clock.advance(61_000)
  expect(asked()).toBe(before)
  expect(shader()).toContain('const float STAGE_PX = 480.0;')
  // In front, on a screen of scale 1: the stage takes it within ten seconds.
  world.front.value = 'com.mitchellh.ghostty'
  await clock.advance(10_100)
  expect(scale()).toBe('1')
  expect(shader()).toContain('const float STAGE_PX = 240.0;')
  // Another session has just asked and found scale 2: this one takes its
  // answer without asking.
  world.answers.set('/usr/bin/osascript', '1\n')
  before = asked()
  for (let i = 0; i < 3; i++) {
    world.files.set(`${runtime}/scale`, { text: `2 ${clock.now()}\n`, mtimeMs: clock.now() })
    await clock.advance(10_000)
  }
  expect(asked()).toBe(before)
  expect(shader()).toContain('const float STAGE_PX = 480.0;')
  // Once no other session asks, this one does again.
  await clock.advance(20_100)
  expect(asked()).toBeGreaterThan(before)
  expect(shader()).toContain('const float STAGE_PX = 240.0;')
})

test('/solar ghostty asks the screen scale for the stage it has just added', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.answers.set('/usr/bin/osascript', '2\n')
  const runtime = await startGhostty($, on, clock, world)
  // Without the sky in the config, the scale is not worth a start's time.
  expect(world.runs.some(argv => argv.includes('JavaScript'))).toBe(false)

  await $.command.run({ command: 'solar', args: 'ghostty', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float STAGE_PX = 480.0;')
})

test('a scale answer that is no number counts as 1', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`, mtimeMs: start })
  world.answers.set('/usr/bin/osascript', 'garbage\n')
  const runtime = await startGhostty($, on, clock, world)
  const text = world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  expect(world.runs.some(argv => argv.includes('JavaScript'))).toBe(true)
  expect(text).toContain('const float STAGE_PX = 240.0;')
  expect(text).not.toContain('NaN')
})

test('a scale osascript refused to give counts as 1', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`, mtimeMs: start })
  world.denied.add('/usr/bin/osascript')
  const runtime = await startGhostty($, on, clock, world)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float STAGE_PX = 240.0;')
})

test('on Linux the stage strip is the points as they are, and the scale is never asked', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  const runtime = await startGhostty($, on, clock, world)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float STAGE_PX = 240.0;')
  expect(world.runs.some(argv => argv.includes('JavaScript'))).toBe(false)
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
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toContain('custom-shader-animation = false')

  // ioreg fails while the person is away: still away, the sky stays still.
  world.failing.add('/usr/sbin/ioreg')
  await clock.advance(20_000)
  expect(world.files.get(`${runtime}/solar-clawd.ghostty`)?.text).toContain('custom-shader-animation = false')

  // One ioreg each three seconds, and none besides.
  world.failing.delete('/usr/sbin/ioreg')
  const asked = world.runs.filter(argv => argv[0] === '/usr/sbin/ioreg').length
  await clock.advance(30_000)
  expect(world.runs.filter(argv => argv[0] === '/usr/sbin/ioreg').length - asked).toBe(10)
})

test('a question lights the orange lighthouse at once, an answer puts it out', async ($, on) => {
  const { clock, shader, include, ask } = await waitingWorld($, on)
  await ask()
  await clock.advance(100)
  expect(shader()).toContain('const int WAITING = 1;')
  expect(include()).toContain('custom-shader-animation = always')
  await $.prompt.submit({ text: 'ja', wait: false, origin: { kind: 'composer' } })
  await clock.advance(100)
  expect(shader()).toContain('const int WAITING = 0;')
  expect(include()).toContain('custom-shader-animation = false')
})

test('idle_prompt lights nothing', async ($, on) => {
  const { clock, shader, ask } = await waitingWorld($, on)
  await ask('idle_prompt')
  await clock.advance(10_000)
  expect(shader()).toContain('const int WAITING = 0;')
})

test('a finished turn lights the white lighthouse, and it never hurries', async ($, on) => {
  const { clock, shader } = await waitingWorld($, on)
  await $.turn.complete({ answer: 'klart', durationMs: 30_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(100)
  expect(shader()).toContain('const int WAITING = 2;')
  await clock.advance(3 * 60_000)
  expect(shader()).toContain('const float WAITING_URGENT = 0.0;')
})

test('the lighthouse sweeps five minutes, then stands still, and is out after thirty', async ($, on) => {
  const { clock, shader, include, ask } = await waitingWorld($, on)
  // The band ticks eight times a second: minutes go by in steps.
  const pass = async (ms: number) => {
    for (let left = ms; left > 0; left -= 30_000) await clock.advance(Math.min(30_000, left))
  }
  await ask()
  await clock.advance(100)
  expect(include()).toContain('custom-shader-animation = always')
  await pass(WAITING_SWEEP_MS + 10_000)
  expect(shader()).toContain('const int WAITING = 1;')
  expect(include()).toContain('custom-shader-animation = false')
  await pass(WAITING_MS - WAITING_SWEEP_MS)
  expect(shader()).toContain('const int WAITING = 0;')
  expect(include()).toContain('custom-shader-animation = false')
})

test('away, the sky and the lit lighthouse stand still', async ($, on) => {
  const idle = { value: 1 }
  const { clock, shader, include, ask } = await waitingWorld($, on, idle)
  await ask()
  idle.value = 400
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader = ')
  expect(include()).toContain('custom-shader-animation = false')
  expect(shader()).toContain('const int WAITING = 1;')
})

test('the white lighthouse goes out once Ghostty is in front and the person at it; a question waits for its answer', async ($, on) => {
  const idle = { value: 1 }
  const { clock, world, shader, ask } = await waitingWorld($, on, idle)
  await $.turn.complete({ answer: 'klart', durationMs: 30_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(4_000)
  expect(shader()).toContain('const int WAITING = 2;')
  // Ghostty in front with no one at it: nobody has seen it.
  world.front.value = 'com.mitchellh.ghostty'
  idle.value = 400
  await clock.advance(4_000)
  expect(shader()).toContain('const int WAITING = 2;')
  idle.value = 1
  await clock.advance(4_000)
  expect(shader()).toContain('const int WAITING = 0;')
  // A question is not put out by a look: Claude waits for the answer.
  await ask()
  await clock.advance(4_000)
  expect(shader()).toContain('const int WAITING = 1;')
})

test("another live session's question lights this sky; a dead session's does not", async ($, on) => {
  const { clock, world, runtime, start, shader } = await waitingWorld($, on)
  world.files.set(`${runtime}/waiting-other`, { text: JSON.stringify({ mode: 'asking', since: start }), mtimeMs: start })
  world.files.set(`${runtime}/alive-other`, { text: '', mtimeMs: start })
  await clock.advance(10_000)
  expect(shader()).toContain('const int WAITING = 1;')
  world.files.set(`${runtime}/alive-other`, { text: '', mtimeMs: start - 10 * 60_000 })
  await clock.advance(10_000)
  expect(shader()).toContain('const int WAITING = 0;')
})

test('AskUserQuestion lights the orange lighthouse while it waits, and it goes out once answered', async ($, on) => {
  // What this session waits for while the question is open, as other sessions read it.
  const seen = { waiting: () => '' }
  let during = ''
  const { clock, shader, world, runtime } = await waitingWorld($, on, { value: 1 }, () =>
    on('tool.call', () => {
      during = seen.waiting()
      return { result: {} } as never
    }),
  )
  seen.waiting = () => world.files.get(`${runtime}/waiting-this-session`)?.text ?? ''
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await clock.advance(100)
  expect(JSON.parse(during).mode).toBe('asking')
  expect(world.files.has(`${runtime}/waiting-this-session`)).toBe(false)
  expect(shader()).toContain('const int WAITING = 0;')
})

test('on battery the sky stands still and lighter; a question still sweeps', async ($, on) => {
  const { clock, world, include, shader, ask } = await waitingWorld($, on, { value: 1 }, () => undefined)
  expect(shader()).toContain('const float LIGHT = 0.0;')
  world.power.text = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1234)\t80%; discharging\n"
  await clock.advance(61_000)
  expect(include()).toContain('custom-shader-animation = false')
  expect(shader()).toContain('const float LIGHT = 1.0;')
  await ask()
  await clock.advance(100)
  expect(include()).toContain('custom-shader-animation = always')
  expect(shader()).toContain('const float LIGHT = 1.0;')
})

test('a pmset that fails counts as mains power', async ($, on) => {
  const { clock, world, include } = await waitingWorld($, on)
  world.failing.add('/usr/bin/pmset')
  await $.command.run({ command: 'solar', args: 'blåst', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.advance(61_000)
  expect(include()).toContain('custom-shader-animation = true')
})

test('during a pass the ISS moves every two seconds; a failed fetch shows none and breaks nothing', async ($, on) => {
  const answer = { isUp: true }
  const { clock, shader } = await waitingWorld(
    $,
    on,
    { value: 1 },
    () =>
      on('http.fetch', (_, e) =>
        answer.isUp && e.url.includes('celestrak')
          ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify([ISS_OMM]), requestId: 'r', key: 'k' } }
          : { deny: 'offline' },
      ),
    ISS_PASS - 12_000,
  )
  const seen = new Set<string>()
  for (let i = 0; i < 5; i++) {
    await clock.advance(2_000)
    seen.add(/const vec2 ISS_AT = [^;]*;/.exec(shader())?.[0] ?? '')
  }
  expect(shader()).toContain('const float ISS_UP = 1.0;')
  expect(seen.size).toBeGreaterThanOrEqual(4)
})

test('with no ISS elements to be had the sky goes on without it', async ($, on) => {
  const { clock, shader } = await waitingWorld($, on, { value: 1 }, () => on('http.fetch', () => ({ deny: 'offline' })), ISS_PASS - 12_000)
  await clock.advance(10_000)
  expect(shader()).toContain('const float ISS_UP = 0.0;')
  expect(shader()).toContain('void mainImage')
})

test("a question is put out by the end of the call that asked, not by another call's end", async ($, on) => {
  const gates: Record<string, () => void> = {}
  const { clock, shader } = await waitingWorld($, on, { value: 1 }, () => {
    on('tool.check', (_, e) => ({ decision: e.tool === 'Bash' ? 'ask' : 'allow' }) as never)
    // The person allows it (in a session, through the dialog).
    on('classic.PermissionRequest', () => ({ decision: { behavior: 'allow' } }) as never)
    on('tool.call', (_, e) => new Promise(done => (gates[e.tool] = () => done({ result: {} } as never))))
  })
  const asking = $.tool.call({ tool: 'Bash', command: 'make' } as never)
  const reading = $.tool.call({ tool: 'Read', file_path: '/x' } as never)
  await clock.advance(10)
  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
  await clock.advance(100)
  expect(shader()).toContain('const int WAITING = 1;')
  gates.Read!()
  await reading
  await clock.advance(100)
  expect(shader()).toContain('const int WAITING = 1;')
  gates.Bash!()
  await asking
  await clock.advance(100)
  expect(shader()).toContain('const int WAITING = 0;')
})

// The tab's mark as last written to its terminal.
const lastMark = (world: ReturnType<typeof ghosttyWorld>) => world.files.get(TTY)?.text
// How full the context window is, as session.usage answers it.
const usageOf = (fill: { percent: number }) => ({ value: { startedAt: 0, context: { window: 200_000, percent: fill.percent }, rateLimits: [] } })

test("/solar catch lands a fish on the keeper's line, /solar grill grills the catch for a while, and the old words still work", async ($, on) => {
  const { clock, world, include } = await waitingWorld($, on)
  const solar = (args: string) => $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  const mark = () => lastMark(world)
  expect(mark()).toContain('rgb:00/00/01')
  await solar('catch')
  await clock.advance(10)
  expect(mark()).toContain('rgb:03/01/01')
  // The catch is a still: Ghostty's frame loop is not set going for it.
  expect(include()).toContain('custom-shader-animation = false')
  await clock.advance(2_500)
  expect(mark()).toContain('rgb:00/01/01')
  await solar('grill')
  await clock.advance(10)
  expect(mark()).toContain('rgb:01/01/01')
  expect(include()).toContain('custom-shader-animation = true')
  await clock.advance(8_000)
  expect(mark()).toContain('rgb:02/00/01')
  await clock.advance(3_500)
  expect(mark()).toMatch(/rgb:00\/0[01]\/01/)
  expect(include()).toContain('custom-shader-animation = false')

  // The Swedish words it once took, and its old English ones.
  for (const [word, state] of [['kasta', '03'], ['toss', '03'], ['bränn', '01'], ['burn', '01']] as const) {
    await clock.advance(12_000)
    await solar(word)
    await clock.advance(10)
    expect(mark()).toContain(`rgb:${state}/01/01`)
  }
})

test('another tenth of the context window filled: the keeper lands a fish at once, and hangs it on the line once the catch is over', async ($, on) => {
  const fill = { percent: 8 }
  const { clock, world } = await waitingWorld($, on, { value: 1 }, () => on('session.usage', () => usageOf(fill)))
  const mark = () => lastMark(world)
  expect(mark()).toContain('rgb:00/00/01')
  fill.percent = 12
  await $.turn.complete({ answer: 'klart', durationMs: 30_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(10)
  expect(mark()).toContain('rgb:03/01/01')
  await clock.advance(2_500)
  expect(mark()).toContain('rgb:00/01/01')
  // A reading within the same tenth catches nothing.
  fill.percent = 19
  await $.turn.complete({ answer: 'klart', durationMs: 30_000, isAborted: false, turnId: 't2', reason: 'answer' })
  await clock.advance(10)
  expect(mark()).toContain('rgb:00/01/01')
})

test('a compaction grills the catch while it runs, leaves embers over a bare line, then hangs what the new reading says', async ($, on) => {
  const fill = { percent: 60 }
  let finish = () => {}
  const { clock, world, include } = await waitingWorld($, on, { value: 1 }, () => {
    on('session.usage', () => usageOf(fill))
    on('session.compact', (_, e) => new Promise(done => (finish = () => done({ messages: e.messages }))) as never)
  })
  const mark = () => lastMark(world)
  expect(mark()).toContain('rgb:00/06/01')
  const messages = [{ role: 'user', text: 'the plan', toolUses: [] }]
  const compacting = $.session.compact({ trigger: 'manual', messages } as never)
  await clock.advance(10)
  expect(mark()).toContain('rgb:01/06/01')
  expect(include()).toContain('custom-shader-animation = true')
  fill.percent = 15
  finish()
  await compacting
  await clock.advance(10)
  expect(mark()).toContain('rgb:02/00/01')
  expect(include()).toContain('custom-shader-animation = true')
  // The embers out: the line as the new reading has it, no catch for it.
  await clock.advance(3_200)
  expect(mark()).toContain('rgb:00/01/01')
  expect(include()).toContain('custom-shader-animation = false')
})

test('a shader changed on disk behind this session is written again', async ($, on) => {
  const { clock, world, runtime, shader } = await waitingWorld($, on)
  const mine = shader()
  world.files.set(`${runtime}/sky.glsl`, { text: '// another session lit a lighthouse here', mtimeMs: 0 })
  await clock.advance(10_000)
  expect(shader()).toBe(mine)
})

test('the tab is found once, and its marks are written to it without a process each', async ($, on) => {
  const { clock, world } = await waitingWorld($, on)
  const solar = (args: string) => $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  await solar('catch')
  await clock.advance(3_000)
  await solar('grill')
  await clock.advance(70_000)
  expect(world.runs.filter(argv => argv[0] === 'sh').length).toBe(1)
  expect(world.writes.filter(path => path === TTY).length).toBeGreaterThan(3)
  expect(world.files.get(TTY)?.text).toContain(']4;16;rgb:')
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(world.files.get(TTY)?.text).toBe(UNMARK_TAB)
})

// What /solar says about the sky's pace and Ghostty's vsync, word for word.
const FULL = 'Solar: full. The sky moves 24 times a second whenever it shows, in front or behind, on battery too, and stands still after 20 minutes without you.'
const SPAR = 'Solar: spar. The sky moves 24 times a second while Ghostty is in front and something in it moves, and stands still on battery, behind other apps and after 5 minutes without you; the lighthouse still sweeps behind them.'
const NEEDS_VSYNC = ' On Ghostty 1.3 that takes vsync off: /solar vsync off turns it off in every Ghostty window, with Claude or without, until /solar vsync on. Ghostty warns that drawing out of sync can cause a kernel panic on macOS 14.4 and later. Until then the sky runs as it did.'
const VSYNC_OFF = 'Solar: vsync is off in every Ghostty window, with Claude or without, until /solar vsync on. New tabs and windows draw the sky 24 times a second (⌘T opens one); tabs already open draw as before until they close, so restart Ghostty to have it everywhere. Ghostty warns that drawing out of sync can cause a kernel panic on macOS 14.4 and later.'
const VSYNC_ON = 'Solar: vsync is on again for new Ghostty tabs and windows; tabs already open keep it off until they close.'
const VSYNC_NOT_NEEDED = 'Solar: this Ghostty draws the sky 24 times a second with vsync on; there is nothing to turn off.'
const NOT_ON_LINUX = 'Solar: on Linux the sky keeps its pace as it is, for now.'
const UNKNOWN_VERSION = 'Solar: Ghostty did not say its version here, so the sky keeps its pace as it is and vsync is left alone.'
const INCLUDE_FIRST = "Solar: run /solar ghostty first; the sky is not in Ghostty's config yet."
const SETTINGS = '/Users/test/Library/Application Support/solar-clawd/sky.json'
const VSYNC = `${RUNTIME}/vsync.ghostty`
const VSYNC_INCLUDE = `config-file = ?${VSYNC}`

// A Ghostty session on a Mac whose Ghostty is `version`, its config as
// given; answers /solar as text.
async function paceWorld($: Engine, on: On, version: string | null, config: string | null = 'font-size = 14\n', idle = { value: 1 }) {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, idle)
  world.tick(start)
  world.helpersOn(clock)
  if (version !== null) world.env.set('TERM_PROGRAM_VERSION', version)
  if (config !== null) world.files.set(CONFIG, { text: config, mtimeMs: start })
  on('classic.Notification', () => ({}))
  const runtime = await startGhostty($, on, clock, world)
  const solar = async (args: string) =>
    ((await $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })) as { text: string }).text

  return { clock, world, runtime, solar, config: () => world.files.get(CONFIG)?.text ?? '' }
}
const count = (text: string, line: string) => text.split('\n').filter(row => row === line).length

test('/solar full and spar are saved for every session, and on Ghostty 1.3 say what 24 a second takes', async ($, on) => {
  const { world, solar } = await paceWorld($, on, '1.3.1')
  await solar('ghostty')
  expect(await solar('full')).toBe(FULL + NEEDS_VSYNC)
  expect(world.files.get(SETTINGS)?.text).toBe('{"pace":"full"}')
  await solar('vsync off')
  expect(await solar('spar')).toBe(SPAR)
  expect(world.files.get(SETTINGS)?.text).toBe('{"pace":"spar"}')
})

test('/solar spar keeps a tune already saved', async ($, on) => {
  const { world, solar } = await paceWorld($, on, '1.4.0')
  const tune = { ...DEFAULT_TUNE, night: { ...DEFAULT_TUNE.night, brightness: 0.7 } }
  world.files.set(SETTINGS, { text: JSON.stringify({ pace: 'full', tune }), mtimeMs: 0 })
  await solar('spar')
  const saved = asSettings(world.files.get(SETTINGS)!.text)
  expect(saved.pace).toBe('spar')
  expect(saved.tune).toEqual(tune)
})

// A theme from elsewhere in the plugin's themes/: fyr's own GLSL under
// another name with a mark of its own in the shader, asking a wider stage
// and the market's prices; and one that does not lint.
const FYR = THEMES.fyr
const HARBOUR_MARK = 'const float harbourMark = 7.5;'

function seedThemes(world: { files: Map<string, { text: string; mtimeMs: number }>; reads: string[] }) {
  const { files } = world
  const moon = world.reads.find(path => path.endsWith('/assets/moon.rgba'))!
  const root = moon.slice(0, -'/assets/moon.rgba'.length)
  const harbour = themeFiles({ manifest: { ...FYR.manifest, name: 'harbour', stagePt: 400, market: true }, glsl: `${FYR.glsl}\n${HARBOUR_MARK}\n` })
  for (const [file, text] of Object.entries(harbour)) files.set(`${root}/themes/harbour/${file}`, { text, mtimeMs: 0 })
  const broken = themeFiles({ manifest: { ...FYR.manifest, name: 'broken' }, glsl: `${FYR.glsl}\nvoid mainImage() {}\n` })
  for (const [file, text] of Object.entries(broken)) files.set(`${root}/themes/broken/${file}`, { text, mtimeMs: 0 })
}

test("/solar theme draws a theme of themes/ in every session, keeps the pace, and gives the mod's stage its width", async ($, on) => {
  const fetched: string[] = []
  on('http.fetch', (_, e) => {
    fetched.push(e.url)
    return { deny: 'offline' }
  })
  const { world, solar, clock, config, runtime } = await paceWorld($, on, '1.4.0')
  const shader = () => world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  seedThemes(world)
  await solar('ghostty')
  await solar('spar')
  expect(await solar('theme')).toBe("Solar: the sky's theme is fyr. Themes: fyr, broken, harbour. /solar theme <name> changes it in every session.")
  await clock.advance(11 * 60_000)
  expect(fetched.some(url => /cboe|binance|coinbase/.test(url))).toBe(false)
  expect(await solar('theme harbour')).toBe("Solar: the sky is harbour now, in every session. Its stage is 400 points wide; Ghostty's new windows show it.")
  expect(JSON.parse(world.files.get(SETTINGS)!.text)).toEqual({ pace: 'spar', theme: 'harbour' })
  expect(rightPaddingOf(config())).toBe(400)
  await clock.advance(100)
  expect(shader()).toContain(HARBOUR_MARK)
  // A theme that shows prices asks the market for them.
  expect(fetched.some(url => /cboe|binance|coinbase/.test(url))).toBe(true)
  expect(await solar('theme')).toContain("the sky's theme is harbour")
  expect(await solar('theme harbour')).toBe("Solar: the sky's theme is already harbour.")
  // A theme that does not lint, or none by that name, leaves the sky as it is.
  expect(await solar('theme broken')).toMatch(/^Solar: broken: .*mainImage.*\. Themes: fyr, broken, harbour\.$/)
  expect(await solar('theme ../etc')).toBe('Solar: no theme called "../etc". Themes: fyr, broken, harbour.')
  expect(JSON.parse(world.files.get(SETTINGS)!.text).theme).toBe('harbour')
  await clock.advance(10_100)
  expect(shader()).toContain(HARBOUR_MARK)
  // Back to fyr: its own stage again, and the market is asked no more.
  expect(await solar('theme fyr')).toBe("Solar: the sky is fyr now, in every session. Its stage is 240 points wide; Ghostty's new windows show it.")
  expect(rightPaddingOf(config())).toBe(240)
  await clock.advance(100)
  expect(shader()).not.toContain(HARBOUR_MARK)
  const market = () => fetched.filter(url => /cboe|binance|coinbase/.test(url)).length
  const asked = market()
  await clock.advance(11 * 60_000)
  expect(market()).toBe(asked)
  // /solar full keeps the theme.
  await solar('full')
  expect(JSON.parse(world.files.get(SETTINGS)!.text)).toEqual({ pace: 'full', theme: 'fyr' })
})

test('a session follows the theme another chose within a few seconds, and a theme it cannot draw is not tried again', async ($, on) => {
  const { world, solar, clock, runtime } = await paceWorld($, on, '1.4.0')
  const shader = () => world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  seedThemes(world)
  await solar('ghostty')
  // Another session's /solar theme: this one draws it within a few seconds.
  world.files.set(SETTINGS, { text: JSON.stringify({ pace: 'spar', theme: 'harbour' }), mtimeMs: clock.now() })
  await clock.advance(3_100)
  expect(await solar('theme')).toContain("the sky's theme is harbour")
  await clock.advance(10_100)
  expect(shader()).toContain(HARBOUR_MARK)
  // A file half written says nothing: the theme stays.
  world.files.set(SETTINGS, { text: '{"pace":"sp', mtimeMs: clock.now() })
  await clock.advance(3_100)
  expect(await solar('theme')).toContain("the sky's theme is harbour")
  // One that does not lint is checked once, not every few seconds.
  world.files.set(SETTINGS, { text: JSON.stringify({ pace: 'spar', theme: 'broken' }), mtimeMs: clock.now() })
  const reads = () => world.reads.filter(path => path.endsWith('/themes/broken/theme.glsl')).length
  await clock.advance(3_100)
  const once = reads()
  expect(once).toBeGreaterThan(0)
  await clock.advance(30_000)
  expect(reads()).toBe(once)
  expect(await solar('theme')).toContain("the sky's theme is harbour")
  // A padding of the person's own stays theirs.
  world.files.set(CONFIG, { text: world.files.get(CONFIG)!.text.replace(/window-padding-x = (\d+),400/, 'window-padding-x = $1,300'), mtimeMs: clock.now() })
  expect(await solar('theme fyr')).toBe('Solar: the sky is fyr now, in every session. It wants a stage 240 points wide; your window-padding-x gives it 300, and stays as you set it.')
})

test('/solar vsync off writes the line in a file of its own, included once, and /solar vsync on empties it', async ($, on) => {
  const { world, solar, config } = await paceWorld($, on, '1.3.1')
  await solar('ghostty')
  const reloads = RELOADS(world.runs)
  expect(await solar('vsync off')).toBe(VSYNC_OFF)
  expect(await solar('vsync   off')).toBe(VSYNC_OFF)
  expect(count(config(), VSYNC_INCLUDE)).toBe(1)
  const rows = config().split('\n')
  expect(rows[rows.indexOf(VSYNC_INCLUDE) - 1]).toBe(`config-file = ?${RUNTIME}/solar-clawd.ghostty`)
  expect(world.files.get(VSYNC)?.text).toBe('window-vsync = false\n')
  expect(RELOADS(world.runs)).toBeGreaterThan(reloads)
  expect(await solar('vsync on')).toBe(VSYNC_ON)
  expect(world.files.get(VSYNC)?.text).toBe('')
  expect(count(config(), VSYNC_INCLUDE)).toBe(1)
})

test('the vsync line outlives the hidden sky and the last session', async ($, on) => {
  const { world, solar } = await paceWorld($, on, '1.3.1')
  await solar('ghostty')
  await solar('vsync off')
  await solar('')
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(world.files.get(VSYNC)?.text).toBe('window-vsync = false\n')
  expect(world.files.get(`${RUNTIME}/solar-clawd.ghostty`)?.text).toBe('')
})

test('an include moved from another folder keeps the vsync include beside it', async ($, on) => {
  const old = `# Solar Clawd: the sky while a Claude session runs.\nconfig-file = ?/old/plugin/runtime/solar-clawd.ghostty\n${VSYNC_INCLUDE}\n`
  const { config } = await paceWorld($, on, '1.3.1', `font-size = 14\n${old}`)
  expect(config()).toContain(`config-file = ?${RUNTIME}/solar-clawd.ghostty`)
  expect(config()).not.toContain('/old/plugin/')
  expect(count(config(), VSYNC_INCLUDE)).toBe(1)
})

test('/solar vsync off never writes a config it cannot read, nor one without the sky', async ($, on) => {
  const { world, solar, config } = await paceWorld($, on, '1.3.1')
  expect(await solar('vsync off')).toBe(INCLUDE_FIRST)
  expect(config()).toBe('font-size = 14\n')
  expect(world.files.has(VSYNC)).toBe(false)
  await solar('ghostty')
  const before = config()
  world.unreadable.add(CONFIG)
  expect(await solar('vsync off')).toBe("Solar: could not read Ghostty's config, so it is left as it is.")
  world.unreadable.delete(CONFIG)
  expect(config()).toBe(before)
  expect(world.files.has(VSYNC)).toBe(false)
})

test('a Ghostty later than 1.3 needs no vsync line: the session takes it away, and the words say so', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.env.set('TERM_PROGRAM_VERSION', '1.4.0')
  world.files.set(VSYNC, { text: 'window-vsync = false\n', mtimeMs: start })
  await startGhostty($, on, clock, world)
  expect(world.files.get(VSYNC)?.text).toBe('')
  const writes = world.writes.length
  const answer = (await $.command.run({ command: 'solar', args: 'vsync off', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })) as { text: string }
  expect(answer.text).toBe(VSYNC_NOT_NEEDED)
  expect(world.writes.slice(writes).some(path => path === VSYNC || path.startsWith(`${VSYNC}.tmp-`))).toBe(false)
})

test('on Linux the pace stays as it is, and nothing is written for it', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  world.env.set('TERM_PROGRAM_VERSION', '1.3.1')
  await startGhostty($, on, clock, world)
  for (const word of ['full', 'spar', 'vsync off']) {
    const answer = (await $.command.run({ command: 'solar', args: word, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })) as { text: string }
    expect(answer.text).toBe(NOT_ON_LINUX)
  }
  expect(world.writes.some(path => path.endsWith('/sky.json') || path.includes('vsync.ghostty'))).toBe(false)
})

// A Ghostty 1.3.1 session on a Mac showing the sky, at this pace, with or
// without the vsync line, with another app in front; and how many times the
// tab's mark is written over a stretch of time, by the session itself or
// by its helper, PACE_HZ times a second for as long as one runs.
async function tickWorld($: Engine, on: On, pace: 'full' | 'spar', isVsyncOff: boolean, version: string | null = '1.3.1', idle = { value: 1 }) {
  const world = await paceWorld($, on, version, 'font-size = 14\n', idle)
  await world.solar('ghostty')
  const start = world.clock.now()
  world.world.files.set(SETTINGS, { text: JSON.stringify({ pace }), mtimeMs: start })
  if (isVsyncOff) world.world.files.set(VSYNC, { text: 'window-vsync = false\n', mtimeMs: start })
  await world.clock.advance(11_000)
  const written = () => {
    const now = world.clock.now()
    const ticked = world.world.helpers.reduce((sum, h) => sum + Math.floor(((h.to ?? now) - h.from) * PACE_HZ / 1000), 0)

    return world.world.writes.filter(path => path === TTY).length + ticked
  }
  const marks = async (ms: number) => {
    const before = written()
    await world.clock.advance(ms)

    return written() - before
  }
  const include = () => world.world.files.get(`${RUNTIME}/solar-clawd.ghostty`)?.text ?? ''
  const shader = () => world.world.files.get(`${RUNTIME}/sky.glsl`)?.text ?? ''

  return { ...world, marks, include, shader }
}
const within = (count: number, expected: number) => Math.abs(count - expected) <= 1
// While a helper's stream is open the test kit's clock moves slowly in
// real time (about 50 ms a second of the clock), so tests that tick get longer.
const TICKING = { timeoutMs: 30_000 }

test('full with the vsync line ticks the mark 24 times a second, as the animation false', TICKING, async ($, on) => {
  const idle = { value: 1 }
  const { world, marks, include, shader, clock } = await tickWorld($, on, 'full', true, '1.3.1', idle)
  world.power.text = "Now drawing from 'Battery Power'\n"
  await clock.advance(61_000)
  expect(within(await marks(10_000), 240)).toBe(true)
  expect(include()).toContain('custom-shader-animation = false')
  expect(shader()).toContain('const float LIGHT = 0.0;')
  // Twenty minutes without the person: still. Back: moving again.
  idle.value = 20 * 60
  await clock.advance(3_100)
  expect(await marks(10_000)).toBeLessThanOrEqual(1)
  idle.value = 1
  await clock.advance(3_100)
  expect(within(await marks(1_000), 24)).toBe(true)
})

test('spar ticks only in front while something moves, and the sweep behind', TICKING, async ($, on) => {
  const { world, marks, solar, clock } = await tickWorld($, on, 'spar', true)
  await solar('event dolphin')
  await clock.advance(4_000)
  expect(await marks(10_000)).toBeLessThanOrEqual(1)
  world.front.value = 'com.mitchellh.ghostty'
  await clock.advance(4_000)
  expect(within(await marks(10_000), 240)).toBe(true)
  world.front.value = 'com.apple.Safari'
  await clock.advance(4_000)
  expect(await marks(10_000)).toBeLessThanOrEqual(1)
  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
  await clock.advance(100)
  expect(within(await marks(10_000), 240)).toBe(true)
  await clock.advance(300_000)
  expect(await marks(10_000)).toBeLessThanOrEqual(1)
})

for (const [name, version, isVsyncOff] of [['without a version Ghostty says', null, true], ['on Ghostty 1.3 without the vsync line', '1.3.1', false]] as const) {
  test(`no ticks ${name}: everything as before`, async ($, on) => {
    const { marks, include, solar, clock } = await tickWorld($, on, 'full', isVsyncOff, version)
    await solar('event dolphin')
    await clock.advance(11_000)
    expect(include()).toContain('custom-shader-animation = true')
    expect(await marks(10_000)).toBeLessThanOrEqual(1)
  })
}

test('on Linux the sky ticks not, whatever the pace and the vsync file say', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  world.env.set('TERM_PROGRAM_VERSION', '1.3.1')
  world.files.set(SETTINGS.replace('/Users/test/Library/Application Support', '/Users/test/.local/state'), { text: '{"pace":"full"}', mtimeMs: start })
  await startGhostty($, on, clock, world)
  const runtime = [...world.files.keys()].find(path => path.endsWith('/runtime/sky.glsl'))!.slice(0, -'/sky.glsl'.length)
  world.files.set(`${runtime}/vsync.ghostty`, { text: 'window-vsync = false\n', mtimeMs: start })
  await clock.advance(11_000)
  const before = world.writes.filter(path => path === TTY).length
  await clock.advance(10_000)
  expect(world.writes.filter(path => path === TTY).length - before).toBeLessThanOrEqual(1)
  expect(world.helpers).toEqual([])
})

test('another session changes the pace: this one follows within seconds', TICKING, async ($, on) => {
  const { world, marks, solar, include, clock } = await tickWorld($, on, 'full', true)
  await solar('event dolphin')
  await clock.advance(1_000)
  expect(within(await marks(1_000), 24)).toBe(true)
  world.files.set(SETTINGS, { text: '{"pace":"spar"}', mtimeMs: clock.now() })
  await clock.advance(3_100)
  expect(await marks(5_000)).toBeLessThanOrEqual(1)
  world.files.set(SETTINGS, { text: '{"pace":"full"}', mtimeMs: clock.now() })
  await clock.advance(3_100)
  expect(within(await marks(1_000), 24)).toBe(true)
  world.files.set(VSYNC, { text: '', mtimeMs: clock.now() })
  await clock.advance(10_100)
  expect(include()).toContain('custom-shader-animation = true')
  expect(await marks(5_000)).toBeLessThanOrEqual(1)
})

test('hidden, or ended, the sky ticks no more, and the last word to the tab is its unmarking', TICKING, async ($, on) => {
  const { world, marks, solar, clock } = await tickWorld($, on, 'full', true)
  expect(within(await marks(1_000), 24)).toBe(true)
  await solar('')
  await clock.advance(100)
  expect(await marks(5_000)).toBeLessThanOrEqual(1)
  expect(world.files.get(VSYNC)?.text).toBe('window-vsync = false\n')
  await solar('')
  await clock.advance(100)
  expect(within(await marks(1_000), 24)).toBe(true)
  await $.session.end({ reason: 'clear', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(within(await marks(1_000), 24)).toBe(true)
  await clock.advance(17)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(world.files.get(TTY)?.text).toBe(UNMARK_TAB)
  expect(await marks(5_000)).toBe(0)
})

test('one zsh beside Claude Code ticks, with the mark as its argument: a new mark is a new helper, and never two at once', TICKING, async ($, on) => {
  const { world, solar, clock } = await tickWorld($, on, 'full', true)
  const { helpers, ttyLog } = world
  expect(helpers.length).toBe(1)
  expect(helpers[0]!.argv).toEqual(['/bin/zsh', '-f', '-c', TICKER, 'solar-ticks', TTY, '24', markOf(null)])
  expect(helpers[0]!.to).toBe(null)
  await solar('catch')
  await clock.advance(3_100)
  await solar('grill')
  await clock.advance(3_100)
  expect(helpers.length).toBeGreaterThan(2)
  expect(helpers.at(-1)!.argv.at(-1)).toBe(world.files.get(TTY)?.text)
  // In the order things reached the tab: never two helpers at once, and a
  // new mark written only once no helper writes the old one.
  let ticking: string | null = null
  for (const entry of ttyLog) {
    const [kind, ...rest] = entry.split(' ')
    const mark = rest.join(' ')
    if (kind === 'start') {
      expect(ticking).toBe(null)
      ticking = mark
    }
    if (kind === 'end') {
      expect(ticking).toBe(mark)
      ticking = null
    }
    if (kind === 'write' && ticking !== null) expect(mark).toBe(ticking)
  }
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(helpers.every(h => h.to !== null)).toBe(true)
  expect(ttyLog.at(-1)).toBe(`write ${UNMARK_TAB}`)
  expect(ttyLog.lastIndexOf(`write ${UNMARK_TAB}`)).toBeGreaterThan(ttyLog.findLastIndex(entry => entry.startsWith('end ')))
})

test('what Claude does, marked while the sky ticks, goes to a new helper once the old one has stopped', TICKING, async ($, on) => {
  const gates: Record<string, () => void> = {}
  on('tool.call', (_, e) => new Promise(done => (gates[e.tool_use_id] = () => done({ result: {} } as never))))
  const { world, clock } = await tickWorld($, on, 'full', true)
  const { helpers, ttyLog } = world
  const before = helpers.length
  const running = $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'make' } as never)
  await clock.advance(10)
  const command = markOf(null, { tool: 'command', agents: 0 })
  expect(helpers.length).toBe(before + 1)
  expect(helpers.at(-1)!.argv.at(-1)).toBe(command)
  expect(helpers.filter(h => h.to === null).length).toBe(1)
  expect(world.files.get(TTY)?.text).toBe(command)
  gates.b1!()
  await running
  await clock.advance(1_600)
  expect(helpers.at(-1)!.argv.at(-1)).toBe(markOf(null))
  expect(helpers.filter(h => h.to === null).length).toBe(1)
  let ticking: string | null = null
  for (const entry of ttyLog) {
    const [kind, ...rest] = entry.split(' ')
    const mark = rest.join(' ')
    if (kind === 'start') {
      expect(ticking).toBe(null)
      ticking = mark
    }
    if (kind === 'end') ticking = null
    if (kind === 'write' && ticking !== null) expect(mark).toBe(ticking)
  }
})

test('a helper that cannot open the tab says so and ends, and the next update starts another', TICKING, async ($, on) => {
  const { world, solar, clock } = await tickWorld($, on, 'full', true)
  world.helperFails.value = true
  await solar('catch')
  await clock.advance(3_100)
  const tried = world.helpers.length
  expect(tried).toBeGreaterThan(1)
  expect(world.helpers.every(h => h.to !== null)).toBe(true)
  world.helperFails.value = false
  await clock.advance(10_100)
  expect(world.helpers.length).toBeGreaterThan(tried)
  expect(world.helpers.at(-1)!.to).toBe(null)
})

test('on Linux the tab is a pts, and its mark is written there', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = linuxWorld(on, start, '1.3.1')
  world.answers.set('sh', 'pts/3\n')
  await startGhostty($, on, clock, world)
  expect(world.files.get('/dev/pts/3')?.text).toContain(']4;16;rgb:')
})

test('where Ghostty says no version, vsync is left alone and the pace is not promised', async ($, on) => {
  const { world, solar } = await paceWorld($, on, null)
  await solar('ghostty')
  expect(await solar('vsync off')).toBe(UNKNOWN_VERSION)
  expect(world.files.has(VSYNC)).toBe(false)
  expect(await solar('full')).toBe(UNKNOWN_VERSION)
  expect(world.files.has(SETTINGS)).toBe(false)
})

test('fyr shows no prices, so its session asks no market for them and reads no market file', async ($, on) => {
  const fetched: string[] = []
  const { clock, world, runtime } = await waitingWorld($, on, { value: 1 }, () =>
    on('http.fetch', (_, e) => {
      fetched.push(e.url)
      return { deny: 'offline' }
    }),
  )
  await clock.advance(11 * 60_000)
  expect(fetched.some(url => /cboe|binance|coinbase/.test(url))).toBe(false)
  expect(world.files.has(`${runtime}/market.json`)).toBe(false)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float sky_QUOTES_FRESH = 0.0;')
})

// A Ghostty session whose tool calls stay open until let go, by tool.
async function workWorld($: Engine, on: On) {
  const gates: Record<string, () => void> = {}
  const listed: { id: string; status: string }[] = []
  const w = await waitingWorld($, on, { value: 1 }, () => {
    on('tool.call', (_, e) => new Promise(done => (gates[e.tool_use_id] = () => done({ result: {} } as never))))
    on('agent.spawn', () => ({ model: 'opus', agentId: 'spawned' }))
    on('agent.list', () => ({ value: listed.map(agent => ({ ...agent, description: 'x', subagentType: 'general-purpose' })) as never }))
  })
  const call = (tool: string, id: string, agentId?: string) => $.tool.call({ tool, tool_use_id: id, ...(agentId ? { agentId } : {}), command: 'make', file_path: '/x' } as never)
  const mark = () => w.world.files.get(TTY)?.text

  return { ...w, gates, listed, call, mark }
}
const idle = { fish: 0, state: 'idle' } as const

test("a command marks the tab at once with what Claude does, and reloads nothing", async ($, on) => {
  const { clock, world, call, gates, mark } = await workWorld($, on)
  await clock.advance(1_000)
  expect(mark()).toBe(markOf(idle))
  const reloads = RELOADS(world.runs)
  const shaders = world.writes.filter(path => path.includes('sky.glsl')).length
  const running = call('Bash', 'b1')
  await clock.advance(10)
  expect(mark()).toBe(markOf(idle, { tool: 'command', agents: 0 }))
  // A read begun under the command's hold shows once the hold is over.
  const reading = call('Read', 'r1')
  await clock.advance(100)
  expect(mark()).toBe(markOf(idle, { tool: 'command', agents: 0 }))
  await clock.advance(1_500)
  expect(mark()).toBe(markOf(idle, { tool: 'read', agents: 0 }))
  // Over at once, it is still shown for its hold, then the command again.
  gates.r1!()
  await reading
  await clock.advance(10)
  expect(mark()).toBe(markOf(idle, { tool: 'read', agents: 0 }))
  await clock.advance(1_500)
  expect(mark()).toBe(markOf(idle, { tool: 'command', agents: 0 }))
  gates.b1!()
  await running
  await clock.advance(1_600)
  expect(mark()).toBe(markOf(idle))
  expect(RELOADS(world.runs)).toBe(reloads)
  expect(world.writes.filter(path => path.includes('sky.glsl')).length).toBe(shaders)
})

test('a subagent counts from its spawn or its first call, and stops counting at its end or once the engine lists it ended', async ($, on) => {
  const { clock, call, gates, mark, listed } = await workWorld($, on)
  await $.agent.spawn({ prompt: 'Read README.md.' } as never)
  await clock.advance(10)
  expect(mark()).toBe(markOf(idle, { tool: 'none', agents: 1 }))
  // One not heard starting, at its first call.
  const reading = call('Grep', 'g1', 'unheard')
  await clock.advance(10)
  expect(mark()).toBe(markOf(idle, { tool: 'read', agents: 2 }))
  gates.g1!()
  await reading
  await $.turn.complete({ answer: 'done', durationMs: 1_000, isAborted: false, turnId: 't9', reason: 'answer', agentId: 'unheard' } as never)
  await clock.advance(2_000)
  expect(mark()).toBe(markOf(idle, { tool: 'none', agents: 1 }))
  // The spawned one's end never heard: the engine's list says it is over.
  listed.push({ id: 'spawned', status: 'completed' })
  await clock.advance(10_000)
  expect(mark()).toBe(markOf(idle))
})

test('a subagent silent ten minutes and not listed at work stops counting; one listed at work goes on', async ($, on) => {
  const { clock, mark, listed } = await workWorld($, on)
  await $.agent.spawn({ prompt: 'Think.' } as never)
  listed.push({ id: 'spawned', status: 'running' })
  await clock.advance(11 * 60_000)
  expect(mark()).toBe(markOf(idle, { tool: 'none', agents: 1 }))
  listed.length = 0
  await clock.advance(10_000)
  expect(mark()).toBe(markOf(idle))
})

test('the session ends while a call runs: the last word to the tab is still its unmarking', async ($, on) => {
  const { clock, world, call, gates } = await workWorld($, on)
  const running = call('Edit', 'e1')
  await clock.advance(10)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  gates.e1!()
  await running
  await clock.advance(2_000)
  expect(world.files.get(TTY)?.text).toBe(UNMARK_TAB)
})

test("the right padding Ghostty uses is the last window-padding-x's, and the mod restages only its own line", () => {
  expect(rightPaddingOf('font-size = 14\n')).toBeNull()
  expect(rightPaddingOf('window-padding-x = 10\n')).toBe(10)
  expect(rightPaddingOf('window-padding-x = 4,300\nfont-size = 14\nwindow-padding-x = 2 , 240\n')).toBe(240)
  expect(rightPaddingOf('# window-padding-x = 2,400\nwindow-padding-x = 2,120\n')).toBe(120)
  const include = `config-file = ?${RUNTIME}/solar-clawd.ghostty`
  const ours = `font-size = 14\n${STAGED}\n${include}\nwindow-padding-x = 6,240\n`
  expect(restaged(ours, 400)).toBe(`font-size = 14\n${STAGED}\n${include}\nwindow-padding-x = 6,400\n`)
  expect(restaged(ours, 240)).toBe(ours)
  // A padding of the person's own, below the include or anywhere else, is theirs.
  expect(restaged(`${STAGED}\n${include}\nwindow-padding-x = 6,300\n`, 400)).toBeNull()
  expect(restaged(`${STAGED}\n${include}\nfont-size = 14\nwindow-padding-x = 6,240\n`, 400)).toBeNull()
  expect(restaged('window-padding-x = 6,240\n', 400)).toBeNull()
})

test("/solar ghostty puts the mod's own stage line back to the theme's width, and leaves a person's own as it is", async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  // A wider theme had the stage at 400; fyr wants 240.
  const before = `font-size = 14\n${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,400\n`
  world.files.set(CONFIG, { text: before, mtimeMs: start })
  world.answers.set('/usr/bin/osascript', '2\n')
  const runtime = await startGhostty($, on, clock, world)
  expect(world.files.get(CONFIG)?.text).toBe(before)
  // Until then the stage is the theme's 240 at most, whatever the padding.
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float STAGE_PX = 480.0;')
  const solar = async (args: string) =>
    ((await $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })) as { text: string }).text
  expect(await solar('ghostty')).toBe("Solar: the stage is now 240 points wide, as the theme wants; Ghostty's new windows show it.")
  expect(world.files.get(CONFIG)?.text).toBe(before.replace('2,400', '2,240'))
  expect(await solar('ghostty')).toBe('Solar: Ghostty already shows the sky.')

  world.files.set(CONFIG, { text: before.replace('2,400', '2,300'), mtimeMs: start })
  expect(await solar('ghostty')).toBe('Solar: Ghostty already shows the sky. The theme wants a stage 240 points wide; your window-padding-x gives it 300, and stays as you set it.')
  expect(world.files.get(CONFIG)?.text).toBe(before.replace('2,400', '2,300'))
})

test('a narrower padding of the person\'s own narrows the stage the theme draws on', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,120\n`, mtimeMs: start })
  world.answers.set('/usr/bin/osascript', '2\n')
  const runtime = await startGhostty($, on, clock, world)
  expect(world.files.get(`${runtime}/sky.glsl`)?.text).toContain('const float STAGE_PX = 240.0;')
})

test("a config with the include but not yet staged loses a stage line the mod wrote at any width, and keeps the person's", async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.files.set(CONFIG, { text: `font-size = 14\nwindow-padding-x = 2,300\nwindow-padding-x = 2,400\n${UNSTAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\n`, mtimeMs: start })
  await startGhostty($, on, clock, world)
  expect(world.files.get(CONFIG)?.text).toBe(`font-size = 14\nwindow-padding-x = 2,300\n${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\nwindow-padding-x = 2,240\n`)
})

// A Ghostty session at noon on an ordinary day, sky.json saying `settings`
// before it starts; the sky's shader as text, its sun's height and its tune.
async function noonWorld($: Engine, on: On, settings?: object) {
  const start = Date.UTC(2026, 9, 21, 10, 30)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  if (settings) world.files.set(SETTINGS, { text: JSON.stringify(settings), mtimeMs: start })
  on('classic.Notification', () => ({}))
  const runtime = await startGhostty($, on, clock, world)
  const shader = () => world.files.get(`${runtime}/sky.glsl`)?.text ?? ''

  return { start, clock, world, runtime, shader }
}
const elevationIn = (text: string) => Number(/const float ELEVATION = (-?[\d.]+);/.exec(text)?.[1])
const tuneIn = (text: string) => /const vec4 sky_TUNE = (vec4\([^)]*\));/.exec(text)?.[1]
const NIGHT_PREVIEW = { brightness: 0.6, shade: 1.2, colour: 0.8, warmth: -0.5 }

test('a saved tune reaches the shader of every session', async ($, on) => {
  const { clock, world, shader } = await noonWorld($, on, { pace: 'spar', tune: { day: { brightness: 0.7 } } })
  expect(shader()).toContain('TUNE = vec4(0.7, 1.0, 1.0, 0.0);')
  // Another session saves another tune: this one draws it at its next update.
  world.files.set(SETTINGS, { text: JSON.stringify({ tune: { day: { brightness: 0.85, warmth: 0.5 } } }), mtimeMs: clock.now() })
  await clock.advance(10_100)
  expect(shader()).toContain('TUNE = vec4(0.85, 1.0, 1.0, 0.5);')
})

test('a preview shows while its session lives and goes within a minute of its last word', async ($, on) => {
  const { start, clock, world, shader } = await noonWorld($, on)
  const preview = (until: number) =>
    world.files.set(SETTINGS, { text: JSON.stringify({ pace: 'spar', preview: { tune: { night: NIGHT_PREVIEW }, phase: 'night', until } }), mtimeMs: clock.now() })
  expect(elevationIn(shader())).toBeGreaterThan(10)
  expect(tuneIn(shader())).toBe('vec4(1.0, 1.0, 1.0, 0.0)')
  preview(clock.now() + 30_000)
  await clock.advance(10_100)
  expect(elevationIn(shader())).toBeLessThan(-5)
  expect(tuneIn(shader())).toBe('vec4(0.6, 1.2, 0.8, -0.5)')
  // Not renewed: once its time is up, the next update draws noon and the
  // saved tune again.
  await clock.advance(31_000 - 10_100)
  await clock.advance(10_100)
  expect(elevationIn(shader())).toBeGreaterThan(10)
  expect(tuneIn(shader())).toBe('vec4(1.0, 1.0, 1.0, 0.0)')
  // One that says it runs an hour (a dead session's, or a clock gone wrong)
  // counts not at all: no preview outlives its last word by a minute.
  const seeded = clock.now()
  preview(seeded + 3_600_000)
  await clock.advance(10_100)
  expect(elevationIn(shader())).toBeGreaterThan(10)
  await clock.advance(seeded + 61_000 - clock.now())
  expect(elevationIn(shader())).toBeGreaterThan(10)
  expect(tuneIn(shader())).toBe('vec4(1.0, 1.0, 1.0, 0.0)')
  // One a minute ahead shows, and is gone 61 s after it was written: written
  // half a second before an update (every SKY_MS from the start), so one
  // falls just after its minute.
  await clock.advance((((9_500 - ((clock.now() - start) % 10_000)) % 10_000) + 10_000) % 10_000)
  const written = clock.now()
  preview(written + 60_000)
  await clock.advance(1_000)
  expect(elevationIn(shader())).toBeLessThan(-5)
  await clock.advance(written + 59_000 - clock.now())
  expect(elevationIn(shader())).toBeLessThan(-5)
  await clock.advance(written + 61_000 - clock.now())
  expect(elevationIn(shader())).toBeGreaterThan(10)
  expect(tuneIn(shader())).toBe('vec4(1.0, 1.0, 1.0, 0.0)')
})

test('a second session draws the preview instead of writing over it', async ($, on) => {
  const { clock, world, runtime, shader } = await noonWorld($, on)
  // The tuning session: its preview, renewed every 20 s, and the shader it
  // writes for it.
  const renew = (text?: string) => {
    world.files.set(SETTINGS, { text: JSON.stringify({ pace: 'spar', preview: { tune: { night: NIGHT_PREVIEW }, phase: 'night', until: clock.now() + 30_000 } }), mtimeMs: clock.now() })
    if (text !== undefined) world.files.set(`${runtime}/sky.glsl`, { text, mtimeMs: clock.now() })
  }
  renew()
  await clock.advance(10_000)
  const drawn = shader()
  expect(elevationIn(drawn)).toBeLessThan(-5)
  expect(tuneIn(drawn)).toBe('vec4(0.6, 1.2, 0.8, -0.5)')
  // Each renewal is a new `until`, read at another moment: the text stays
  // the tuning session's, written by neither again, and Ghostty is not
  // reloaded.
  const reloads = RELOADS(world.runs)
  const writes = () => world.writes.filter(path => path.startsWith(`${runtime}/sky.glsl`)).length
  const written = writes()
  for (let i = 0; i < 4; i++) {
    await clock.advance(20_000)
    renew(drawn)
  }
  await clock.advance(10_000)
  expect(shader()).toBe(drawn)
  expect(writes()).toBe(written)
  expect(RELOADS(world.runs)).toBe(reloads)
})

test("iTerm2's wallpaper draws the tune saved in sky.json, never a preview", async ($, on) => {
  const start = Date.UTC(2026, 9, 21, 10, 30)
  const clock = mock.clock(on, { now: start })
  const saved = { day: { brightness: 0.5, colour: 0.8 } }
  const settings = JSON.stringify({ tune: saved, preview: { tune: { day: { brightness: 1, warmth: 1 } }, phase: 'day', until: start + 3_600_000 } })
  // Each picture and the tick it was painted at (TICK_MS from the start).
  const pictures: { at: number; png: string }[] = []
  mock.env(on, { ITERM_SESSION_ID: 'w0t0p0:0F8E2C1A-1111-4A4A-9B9B-123456789ABC', HOME: '/Users/test' })
  mock.store(on)
  on('fs.read', (_, e) => (e.path === SETTINGS ? { value: settings } : { deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [] }))
  on('process.run', (_, e) => {
    const [command] = e.argv
    let stdout = ''
    if (command === '/usr/sbin/ioreg') stdout = `"HIDIdleTime" = ${1e9}\n`
    if (command === '/usr/bin/base64') pictures.push({ at: start + Math.floor((clock.now() - start) / 125) * 125, png: e.init?.stdin ?? '' })
    if (command === '/usr/bin/osascript') stdout = e.argv.some(arg => arg.includes('background image')) ? 'ok 120 80 true' : 'true'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(20_000)
  expect(pictures.length).toBeGreaterThan(3)
  // Painted again here, in the same order and with a cache of its own, from
  // the second picture on (the first is at a guessed size).
  const paint = async (tune: TuneSettings | null) => {
    const cache = {}
    const out: string[] = []
    for (const { at } of pictures.slice(1)) {
      out.push(await wallpaperPng({ ms: at, t: at / 1000, place: STOCKHOLM, weather: null, kp: null, isAuroraForced: false, moonTexture: null, tune }, 240, 160, async () => {}, cache))
    }

    return out
  }
  const shown = pictures.slice(1).map(picture => picture.png)
  expect(shown).toEqual(await paint(asSettings(settings).tune))
  expect(shown[0]).not.toBe((await paint(null))[0])
})

// The engine's panes, in memory: which are open, and what each open asked.
function paneWorld(on: On) {
  const open = new Set<string>()
  const opened: object[] = []
  on('ui.open', (_, e) => {
    open.add(e.id)
    opened.push({ ...e })
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    open.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, title: id, isShown: true, isFocused: true, isPlaced: true })) }))

  return { open, opened }
}

const TUNE_MOUNT = {
  plugin: 'solar-clawd',
  surface: 'terminal',
  component: 'Pane',
  requestId: TUNE_PANE,
  props: { title: 'Solar tune', isFocused: true, bodyColumns: 72, placement: 'inline', scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

// The pane closed through the mod's own ui.close hook. The kit cannot press
// Escape or the close mark for the person, so the mod's own close stands in:
// a session started again (a reload) finds the pane open and closes it, and
// the hook that drops the preview is the one the person's close runs.
const closeTune = async ($: Engine, panes: { open: Set<string> }) => {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(panes.open.has(TUNE_PANE)).toBe(false)
}

const solarSays = async ($: Engine, args: string) =>
  ((await $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })) as { text?: string }).text

test('/solar tune outside Ghostty says so and opens nothing', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 21, 10, 30) })
  mock.env(on, { ITERM_SESSION_ID: 'w0t0p0:0F8E2C1A-1111-4A4A-9B9B-123456789ABC', HOME: '/Users/test' })
  mock.store(on)
  const writes: string[] = []
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.write', (_, e) => {
    writes.push(e.path)
    return { value: undefined }
  })
  on('fs.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const panes = paneWorld(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(await solarSays($, 'tune')).toBe(TUNE_WORDS.notGhostty)
  expect(panes.open.size).toBe(0)
  expect(panes.opened).toEqual([])
  expect(writes.some(path => path.endsWith('sky.json') || path.includes('sky.json.'))).toBe(false)
})

test('the pane previews as you move, keeps on enter and forgets on escape', async ($, on) => {
  const panes = paneWorld(on)
  const { clock, world, shader } = await noonWorld($, on)
  const saves = () => world.runs.filter(argv => argv[0] === '/bin/mv' && argv.at(-1) === SETTINGS).length
  const saved = () => asSettings(world.files.get(SETTINGS)?.text ?? '')

  // A dark blue pane that takes the keys, on the part of the day it is now.
  expect(await solarSays($, 'tune')).toBeUndefined()
  expect(panes.opened).toEqual([{ id: TUNE_PANE, title: 'Solar tune', focus: true, closeOnEscape: true, backgroundColor: '#10142a' }])
  const ui = await $.ui.mount(TUNE_MOUNT)
  expect(await ui.find({ type: 'Text', text: ' day ', in: 'tune' })).toMatchObject({ props: { backgroundColor: '#ff6fc0', color: '#10142a' } })
  expect(await ui.find({ type: 'Text', text: '100 %', in: 'tune' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: TUNE_WORDS.hint, in: 'tune' })).toBeDefined()

  // Three moves within 100 ms make one write, a PREVIEW_MS after the first,
  // with the last of them, and the sky follows at once.
  const before = saves()
  for (let i = 0; i < 3; i++) {
    await ui.key({ key: 'left' })
    await clock.advance(30)
  }
  expect(saves()).toBe(before)
  await clock.advance(PREVIEW_MS - 90)
  expect(saves()).toBe(before + 1)
  const written = clock.now()
  expect(saved().preview).toEqual({ tune: { ...DEFAULT_TUNE, day: { ...DEFAULT_TUNE.day, brightness: 0.85 } }, phase: 'day', until: written + PREVIEW_LIFE_MS })
  expect(shader()).toContain('TUNE = vec4(0.85, 1.0, 1.0, 0.0);')
  expect(await ui.find({ type: 'Text', text: '85 %', in: 'tune' })).toBeDefined()
  await clock.advance(PREVIEW_MS * 4)
  expect(saves()).toBe(before + 1)

  // While the pane is open the preview is renewed, never further ahead
  // than its life.
  await clock.advance(20_000)
  expect(saved().preview?.until).toBeGreaterThan(written + PREVIEW_LIFE_MS)
  expect(saved().preview!.until).toBeLessThanOrEqual(clock.now() + PREVIEW_LIFE_MS)

  // Enter keeps it for every session, and the pane says so.
  await ui.key({ key: 'return' })
  expect(saved().tune.day.brightness).toBe(0.85)
  expect(saved().preview).toBeNull()
  expect(saved().pace).toBe('spar')
  expect(await ui.find({ type: 'Text', text: TUNE_WORDS.kept, in: 'tune' })).toBeDefined()
  await ui.key({ key: 'down' })
  expect(await ui.find({ type: 'Text', text: TUNE_WORDS.kept, in: 'tune' })).toBeUndefined()
  await closeTune($, panes)
  await ui.unmount()

  // Opened again, moved, and closed: the preview goes and the saved tune
  // stays as it was kept.
  await solarSays($, 'tune')
  const again = await $.ui.mount(TUNE_MOUNT)
  expect(await again.find({ type: 'Text', text: '85 %', in: 'tune' })).toBeDefined()
  await again.key({ key: 'left' })
  await clock.advance(PREVIEW_MS)
  expect(saved().preview?.tune.day.brightness).toBe(0.8)
  await closeTune($, panes)
  expect(saved().tune.day.brightness).toBe(0.85)
  expect(saved().preview).toBeNull()
  await clock.advance(1)
  expect(shader()).toContain('TUNE = vec4(0.85, 1.0, 1.0, 0.0);')
  await again.unmount()

  // A move closed before its write is never written, and nothing is renewed
  // once the pane is closed.
  await solarSays($, 'tune')
  const third = await $.ui.mount(TUNE_MOUNT)
  const quiet = saves()
  await third.key({ key: 'left' })
  await closeTune($, panes)
  await third.unmount()
  await clock.advance(60_000)
  expect(saves()).toBe(quiet)
  expect(saved().preview).toBeNull()
})

test('a close while the first preview is still being written leaves no preview', async ($, on) => {
  const panes = paneWorld(on)
  const { clock, world } = await noonWorld($, on)
  await solarSays($, 'tune')
  const ui = await $.ui.mount(TUNE_MOUNT)
  // The preview's move of sky.json into place waits until it is let go.
  let letGo = () => {}
  world.slowMoves.set(SETTINGS, new Promise<void>(resolve => (letGo = resolve)))
  await ui.key({ key: 'left' })
  await clock.advance(PREVIEW_MS)
  expect(world.slowMoves.has(SETTINGS)).toBe(false)
  expect(asSettings(world.files.get(SETTINGS)?.text ?? '').preview).toBeNull()
  // Closed while it is under way: the preview lands, and the close after it
  // takes it away again.
  const closing = closeTune($, panes)
  await clock.advance(1)
  letGo()
  await closing
  await clock.advance(1)
  expect(asSettings(world.files.get(SETTINGS)?.text ?? '').preview).toBeNull()
  await ui.unmount()
})

test('a keep the pane posted together with a later move is kept, and the move previewed', async ($, on) => {
  const panes = paneWorld(on)
  const { clock, world } = await noonWorld($, on)
  const saved = () => asSettings(world.files.get(SETTINGS)?.text ?? '')
  await solarSays($, 'tune')
  const ui = await $.ui.mount(TUNE_MOUNT)
  // What the module posts for Enter at 95 % and a left after it, when the
  // frame delivers only the second.
  const day = (brightness: number) => ({ ...DEFAULT_TUNE, day: { ...DEFAULT_TUNE.day, brightness } })
  const state = { phase: 'day', row: 'brightness', tune: day(0.9), opened: DEFAULT_TUNE }
  await ui.post({ state, action: 'preview', keeps: 1, keptTune: day(0.95) })
  expect(saved().tune.day.brightness).toBe(0.95)
  expect(saved().preview).toBeNull()
  await clock.advance(PREVIEW_MS)
  expect(saved().preview?.tune.day.brightness).toBe(0.9)
  expect(saved().tune.day.brightness).toBe(0.95)
  // Two keys in one go are two steps from where the pane last was, 90 %.
  await Promise.all([ui.key({ key: 'left' }), ui.key({ key: 'left' })])
  await clock.advance(PREVIEW_MS)
  expect(saved().preview?.tune.day.brightness).toBe(0.8)
  await closeTune($, panes)
  await ui.unmount()
})

// Ghostty's +show-config as it prints the text keys on a config that sets
// none of them, and +list-fonts.
const SHOW_CONFIG = 'font-family = \nfont-size = 13\nfont-thicken = false\nfont-thicken-strength = 255\nadjust-cell-height = \nwindow-padding-x = 2,240\nfaint-opacity = 0.5\n'
const LIST_FONTS = 'Andale Mono\n  Andale Mono\n\nMenlo\n  Menlo Bold\n  Menlo Regular\n'
const TEXT = `${RUNTIME}/text.ghostty`
const TEXT_INCLUDE = `config-file = ?${TEXT}`
const GHOSTTY_APP = '/Applications/Ghostty.app/Contents/MacOS/ghostty'
const RESETS = (runs: string[][]) =>
  runs.filter(argv => argv[0] === '/usr/bin/osascript' && argv[1] === '-l' && argv[2] === 'JavaScript' && argv.join(' ').includes('reset_font_size')).length

// A Ghostty 1.4 session on a Mac with the sky in its config, the tune pane
// open on its text tab; Ghostty's app as ps lists it, and its command line
// as the kit models it.
async function textWorld($: Engine, on: On, before?: (world: ReturnType<typeof ghosttyWorld>) => void) {
  const panes = paneWorld(on)
  const { clock, world, solar, config, runtime } = await paceWorld($, on, '1.4.0')
  world.answers.set('/bin/ps', MAC_PS)
  world.cli.showConfig = SHOW_CONFIG
  world.cli.fonts = LIST_FONTS
  await solar('ghostty')
  before?.(world)
  await solarSays($, 'tune')
  const ui = await $.ui.mount(TUNE_MOUNT)
  const isOnText = async () => (await ui.find({ type: 'Text', text: /^ text $/, in: 'tune' }))?.props.backgroundColor === '#ff6fc0'
  for (let i = 0; i < 5 && !(await isOnText()); i++) await ui.key({ key: 'tab' })
  expect(await isOnText()).toBe(true)

  return { panes, clock, world, solar, config, runtime, ui, kills: () => KILLS(world.runs).length }
}

test('a text change is validated, written to its own include and reloaded', async ($, on) => {
  const { panes, clock, world, config, ui, kills } = await textWorld($, on)
  // The person's own values, dimmed, with own; the gap says where it shows.
  expect(await ui.find({ type: 'Text', text: '13 pt', in: 'tune' })).toMatchObject({ props: { dimColor: true } })
  expect(await ui.find({ type: 'Text', text: TEXT_WORDS.builtIn, in: 'tune' })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^\s*own$/, in: 'tune' })).length).toBe(5)
  expect(await ui.find({ type: 'Text', text: TEXT_WORDS.newWindows, in: 'tune' })).toBeDefined()
  // +show-config and +list-fonts were read once, as the pane opened.
  const shows = () => world.runs.filter(argv => argv[0] === GHOSTTY_APP && argv[1] === '+show-config').length
  const lists = () => world.runs.filter(argv => argv[0] === GHOSTTY_APP && argv[1] === '+list-fonts').length
  expect([shows(), lists()]).toEqual([1, 1])

  // Two moves within a PREVIEW_MS make one write, with the last of them.
  const from = world.runs.length
  const reloads = kills()
  await ui.key({ key: 'right' })
  await clock.advance(50)
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 14\n')
  expect(await ui.find({ type: 'Text', text: '14 pt', in: 'tune' })).toBeDefined()
  const runs = world.runs.slice(from).map(argv => argv.join(' '))
  const validated = runs.findIndex(run => run.startsWith(`${GHOSTTY_APP} +validate-config --config-file=${TEXT}.tmp-`))
  const moved = runs.findIndex(run => run.startsWith('/bin/mv') && run.endsWith(` ${TEXT}`))
  expect(validated).toBeGreaterThanOrEqual(0)
  expect(moved).toBeGreaterThan(validated)
  expect(runs.filter(run => run.includes('+validate-config')).length).toBe(1)
  expect(kills()).toBe(reloads + 1)
  // Its include sits beside the sky's, once; the sky's settings know nothing yet.
  const rows = config().split('\n')
  expect(rows.filter(row => row === TEXT_INCLUDE).length).toBe(1)
  expect(rows[rows.indexOf(TEXT_INCLUDE) - 1]).toBe(`config-file = ?${RUNTIME}/solar-clawd.ghostty`)
  expect(asSettings(world.files.get(SETTINGS)?.text ?? '').text.size).toBeNull()
  // Nothing more is read or written while the moves rest, the sky's ten
  // seconds included.
  await clock.advance(11_000)
  expect([shows(), lists()]).toEqual([1, 1])
  expect(world.runs.filter(argv => argv.join(' ').includes('+validate-config')).length).toBe(1)

  // Escape writes the text the pane opened with back, and Ghostty reloads.
  const beforeClose = kills()
  await closeTune($, panes)
  expect(world.files.get(TEXT)?.text).toBe('')
  expect(kills()).toBeGreaterThan(beforeClose)
  await ui.unmount()
})

test('the text kept stays once the pane is closed, and u goes back to how it opened', async ($, on) => {
  const { panes, clock, world, solar, ui } = await textWorld($, on)
  await ui.key({ key: 'right' })
  await ui.key({ key: 'return' })
  expect(asSettings(world.files.get(SETTINGS)!.text).text.size).toBe(13.5)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  await closeTune($, panes)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  await ui.unmount()
  // Opened again on what was kept: a move, then u, is the kept text again.
  await solar('tune')
  const again = await $.ui.mount(TUNE_MOUNT)
  for (let i = 0; i < 5 && (await again.find({ type: 'Text', text: /^ text $/, in: 'tune' }))?.props.backgroundColor !== '#ff6fc0'; i++) await again.key({ key: 'tab' })
  expect(await again.find({ type: 'Text', text: '13.5 pt', in: 'tune' })).toMatchObject({ props: { dimColor: false } })
  await again.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 14\n')
  await again.key({ key: 'u' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  // r leaves the size untouched, the person's own: no line for it.
  await again.key({ key: 'r' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('')
  await closeTune($, panes)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  await again.unmount()
})

test('a text change Ghostty refuses is not written', async ($, on) => {
  const { panes, clock, world, ui, kills } = await textWorld($, on)
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  // The font Ghostty will not take: the file as it was, no reload, and the
  // pane names the key.
  world.cli.refuses.add('font-family')
  const reloads = kills()
  await ui.key({ key: 'down' })
  await ui.key({ key: 'down' })
  await ui.key({ key: 'down' })
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  expect(kills()).toBe(reloads)
  expect([...world.files.keys()].some(path => path.startsWith(`${TEXT}.tmp-`))).toBe(false)
  expect(await ui.find({ type: 'Text', text: TEXT_WORDS.refused('font-family'), in: 'tune' })).toBeDefined()
  // Taken again once the font is one Ghostty takes.
  world.cli.refuses.clear()
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\nfont-family = ""\nfont-family = Menlo\n')
  expect(await ui.find({ type: 'Text', text: TEXT_WORDS.refused('font-family'), in: 'tune' })).toBeUndefined()
  await closeTune($, panes)
  await ui.unmount()
})

test('a change of size resets the font size of every terminal', async ($, on) => {
  const { panes, clock, world, ui } = await textWorld($, on)
  expect(RESETS(world.runs)).toBe(0)
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(RESETS(world.runs)).toBe(1)
  const reset = world.runs.find(argv => argv[0] === '/usr/bin/osascript' && argv.join(' ').includes('reset_font_size'))!
  expect(reset.join(' ')).toContain('com.mitchellh.ghostty')
  expect(reset.join(' ')).toContain('terminals()')
  // A change of weight is drawn again in every window as it is.
  await ui.key({ key: 'down' })
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\nfont-thicken = true\nfont-thicken-strength = 0\n')
  expect(RESETS(world.runs)).toBe(1)
  // The close takes the size away again: that is a change of size too.
  await closeTune($, panes)
  expect(RESETS(world.runs)).toBe(2)
  await ui.unmount()
})

test('the gap widens the padding line for new windows', async ($, on) => {
  const { panes, clock, world, solar, config, runtime, ui, kills } = await textWorld($, on, world => {
    seedThemes(world)
    world.answers.set('/usr/bin/osascript', '2\n')
  })
  const shader = () => world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  expect(await solar('theme harbour')).toBe("Solar: the sky is harbour now, in every session. Its stage is 400 points wide; Ghostty's new windows show it.")
  expect(config()).toContain('\nwindow-padding-x = 2,400\n')
  // The sky drawn with the new theme first.
  await clock.advance(100)
  // Two steps of the gap: 16 points more padding, and Ghostty reads it.
  const reloads = kills()
  await ui.key({ key: 'up' })
  await ui.key({ key: 'right' })
  await ui.key({ key: 'right' })
  expect(await ui.find({ type: 'Text', text: '16 pt', in: 'tune' })).toBeDefined()
  await clock.advance(PREVIEW_MS)
  expect(config()).toContain('\nwindow-padding-x = 2,416\n')
  expect(config()).not.toContain('2,400')
  expect(kills()).toBe(reloads + 1)
  // The gap writes no text line, and the stage stays the theme's width.
  expect(world.files.get(TEXT)?.text ?? '').toBe('')
  await clock.advance(11_000)
  expect(shader()).toContain('const float STAGE_PX = 800.0;')
  // Kept, it goes with every theme the mod stages, and /solar ghostty finds it so.
  await ui.key({ key: 'return' })
  expect(asSettings(world.files.get(SETTINGS)!.text).text.gap).toBe(16)
  expect(await solar('ghostty')).toBe('Solar: Ghostty already shows the sky.')
  expect(await solar('theme fyr')).toBe("Solar: the sky is fyr now, in every session. Its stage is 240 points wide; Ghostty's new windows show it.")
  expect(config()).toContain('\nwindow-padding-x = 2,256\n')
  await closeTune($, panes)
  expect(config()).toContain('\nwindow-padding-x = 2,256\n')
  await ui.unmount()
})

test('a gap not kept goes back at the close', async ($, on) => {
  const { panes, clock, config, ui } = await textWorld($, on)
  await ui.key({ key: 'up' })
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(config()).toContain('\nwindow-padding-x = 2,248\n')
  await closeTune($, panes)
  expect(config()).toContain('\nwindow-padding-x = 2,240\n')
  await ui.unmount()
})

test('hiding the sky keeps the text include', async ($, on) => {
  const { panes, clock, world, solar, config, ui } = await textWorld($, on)
  await ui.key({ key: 'right' })
  await ui.key({ key: 'return' })
  await clock.advance(PREVIEW_MS)
  await closeTune($, panes)
  await ui.unmount()
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  // The sky hidden, then the last session gone: the person's text stays.
  await solar('')
  await clock.advance(11_000)
  expect(world.files.get(`${RUNTIME}/solar-clawd.ghostty`)?.text).toBe('')
  expect(config()).toContain(`\n${TEXT_INCLUDE}\n`)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(config()).toContain(`\n${TEXT_INCLUDE}\n`)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
})

test('a kept gap reaches the padding line, whatever theme came between', async ($, on) => {
  const { panes, clock, world, solar, config, ui } = await textWorld($, on, world => seedThemes(world))
  // The gap previewed on fyr, then another theme before Enter.
  await ui.key({ key: 'up' })
  await ui.key({ key: 'right' })
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(config()).toContain('\nwindow-padding-x = 2,256\n')
  await solar('theme harbour')
  expect(config()).toContain('\nwindow-padding-x = 2,400\n')
  await ui.key({ key: 'return' })
  expect(asSettings(world.files.get(SETTINGS)!.text).text.gap).toBe(16)
  expect(config()).toContain('\nwindow-padding-x = 2,416\n')
  await closeTune($, panes)
  expect(config()).toContain('\nwindow-padding-x = 2,416\n')
  await ui.unmount()
})

test("Ghostty's command line is run only from this user's own app, under an Applications folder", async ($, on) => {
  // Another user's app and a link out of /Applications are passed over;
  // this user's app is the one asked.
  const { panes, clock, world, ui } = await textWorld($, on, world => {
    world.answers.set('/bin/ps', '  777     1   502 /Users/other/Applications/Ghostty.app/Contents/MacOS/ghostty\n  619     1   501 /Applications/Ghostty.app/Contents/MacOS/ghostty\n')
  })
  const asked = () => world.runs.filter(argv => /\/Ghostty\.app\/Contents\/MacOS\/ghostty$/.test(argv[0]!)).map(argv => argv[0])
  expect(new Set(asked())).toEqual(new Set([GHOSTTY_APP]))
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  expect(new Set(asked())).toEqual(new Set([GHOSTTY_APP]))
  // With only apps that do not qualify, nothing is checked and nothing written.
  world.answers.set('/bin/ps', '  777     1   502 /Applications/Ghostty.app/Contents/MacOS/ghostty\n  619     1   501 /Users/test/Downloads/Ghostty.app/Contents/MacOS/ghostty\n  620     1   501 /Users/test/Applications/Ghostty.app/Contents/MacOS/ghostty\n')
  world.links.set('/Users/test/Applications/Ghostty.app/Contents/MacOS/ghostty', '/private/tmp/Ghostty.app/Contents/MacOS/ghostty')
  const before = asked().length
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(asked().length).toBe(before)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 13.5\n')
  expect(await ui.find({ type: 'Text', text: TEXT_WORDS.noApp, in: 'tune' })).toBeDefined()
  // An app of this user's own ~/Applications is one.
  world.links.clear()
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(world.files.get(TEXT)?.text).toBe('font-size = 14.5\n')
  expect(asked().at(-1)).toBe('/Users/test/Applications/Ghostty.app/Contents/MacOS/ghostty')
  await closeTune($, panes)
  await ui.unmount()
})

// A Ghostty 1.4 session on a Mac starting on a config with the sky, its
// stage and the text include, sky.json and text.ghostty as given: what a
// session killed with the tune pane open leaves.
async function crashedWorld($: Engine, on: On, settings: (start: number) => object, text: string) {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.env.set('TERM_PROGRAM_VERSION', '1.4.0')
  world.answers.set('/bin/ps', MAC_PS)
  world.files.set(CONFIG, { text: `${STAGED}\nconfig-file = ?${RUNTIME}/solar-clawd.ghostty\n${TEXT_INCLUDE}\nwindow-padding-x = 2,240\n`, mtimeMs: start })
  world.files.set(SETTINGS, { text: JSON.stringify(settings(start)), mtimeMs: start })
  world.files.set(TEXT, { text, mtimeMs: start })
  on('classic.Notification', () => ({}))
  await startGhostty($, on, clock, world)

  return { world, validations: () => world.runs.filter(argv => argv[1] === '+validate-config').length }
}

test('a text draft a killed session left is put back to the kept text at the next start', async ($, on) => {
  const { world, validations } = await crashedWorld($, on, () => ({ text: { size: 14.5 } }), 'font-size = 20\nfaint-opacity = 1\n')
  expect(world.files.get(TEXT)?.text).toBe('font-size = 14.5\n')
  expect(validations()).toBe(1)
  expect(RESETS(world.runs)).toBe(1)
})

test("a text draft another session's pane still renews is left alone at the start", async ($, on) => {
  const { world, validations } = await crashedWorld($, on, start => ({ text: { size: 14.5 }, textDraftUntil: start + 30_000 }), 'font-size = 20\n')
  expect(world.files.get(TEXT)?.text).toBe('font-size = 20\n')
  expect(validations()).toBe(0)
})

test('a start with the text as kept checks nothing and writes nothing', async ($, on) => {
  // A draft mark long past is a dead pane's, and counts not at all.
  const { world, validations } = await crashedWorld($, on, start => ({ text: { size: 14.5 }, textDraftUntil: start - 1 }), 'font-size = 14.5\n')
  expect(world.files.get(TEXT)?.text).toBe('font-size = 14.5\n')
  expect(validations()).toBe(0)
  expect(world.writes.some(path => path.startsWith(`${TEXT}.tmp-`))).toBe(false)
})

test('the pane marks its text draft live while it is open, and clears the mark at a keep and at the close', async ($, on) => {
  const { panes, clock, world, ui } = await textWorld($, on)
  const until = () => JSON.parse(world.files.get(SETTINGS)?.text ?? '{}').textDraftUntil ?? null
  expect(until()).toBeNull()
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  const marked = until()
  expect(marked).toBeGreaterThan(clock.now())
  expect(marked).toBeLessThanOrEqual(clock.now() + PREVIEW_LIFE_MS)
  // Renewed while the pane stays open.
  await clock.advance(20_000)
  expect(until()).toBeGreaterThan(marked)
  await ui.key({ key: 'return' })
  expect(until()).toBeNull()
  await ui.key({ key: 'right' })
  await clock.advance(PREVIEW_MS)
  expect(until()).not.toBeNull()
  await closeTune($, panes)
  expect(until()).toBeNull()
  await ui.unmount()
})
