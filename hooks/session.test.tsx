// The mod in a session: Ghostty and iTerm2, the lighthouse, the wastebasket,
// /solar.

import { expect, mock, test } from 'claude-code/testing'

import { ROWS } from './clawd'
import { BEACON_MS, BEACON_SWEEP_MS } from './beacon'
import { fromBase64 } from './paint'
import { BAND, ghosttyWorld, RELOADS, CONFIG, startGhostty, SIGNALS, linuxWorld, waitingWorld, ISS_OMM, ISS_PASS } from './test-kit'

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
  // away five minutes, still as it was: no reload.
  expect(include?.[0] && world.files.get(include[0])?.text).toContain('custom-shader-animation = false')
  idle.value = 400
  await clock.advance(11_000)
  expect(include?.[0] && world.files.get(include[0])?.text).toContain('custom-shader-animation = false')
  expect(RELOADS(world.runs)).toBe(2)

  // The last session ending takes the sky with it.
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'this-session', resume: { id: 'this-session' } })
  expect(include?.[0] && world.files.get(include[0])?.text).toBe('')
  expect(RELOADS(world.runs)).toBe(3)
})

test('a lively sky animates while the person is there, and stands still while away', async ($, on) => {
  const idle = { value: 1 }
  const { clock, include } = await waitingWorld($, on, idle)
  // A storm played: the hat flies, the sky is lively.
  await $.command.run({ command: 'solar', args: 'blåst', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader-animation = true')
  idle.value = 400
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader-animation = false')
  idle.value = 1
  await clock.advance(11_000)
  expect(include()).toContain('custom-shader-animation = true')
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
  expect(world.files.get(config)?.text).toBe(`font-size = 14\n# Solar Clawd: the sky while a Claude session runs.\nconfig-file = ?${runtime}/solar-clawd.ghostty\n`)
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
  expect(world.files.get(CONFIG)?.text).toBe(`font-size = 14\n# Solar Clawd: the sky while a Claude session runs.\nconfig-file = ?${runtime}/solar-clawd.ghostty\n`)
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
  expect(shader()).toContain('const int BEACON = 1;')
  expect(include()).toContain('custom-shader-animation = always')
  await $.prompt.submit({ text: 'ja', wait: false, origin: { kind: 'composer' } })
  await clock.advance(100)
  expect(shader()).toContain('const int BEACON = 0;')
  expect(include()).toContain('custom-shader-animation = false')
})

test('idle_prompt lights nothing', async ($, on) => {
  const { clock, shader, ask } = await waitingWorld($, on)
  await ask('idle_prompt')
  await clock.advance(10_000)
  expect(shader()).toContain('const int BEACON = 0;')
})

test('a finished turn lights the white lighthouse, and it never hurries', async ($, on) => {
  const { clock, shader } = await waitingWorld($, on)
  await $.turn.complete({ answer: 'klart', durationMs: 30_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(100)
  expect(shader()).toContain('const int BEACON = 2;')
  await clock.advance(3 * 60_000)
  expect(shader()).toContain('const float BEACON_URGENT = 0.0;')
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
  await pass(BEACON_SWEEP_MS + 10_000)
  expect(shader()).toContain('const int BEACON = 1;')
  expect(include()).toContain('custom-shader-animation = false')
  await pass(BEACON_MS - BEACON_SWEEP_MS)
  expect(shader()).toContain('const int BEACON = 0;')
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
  expect(shader()).toContain('const int BEACON = 1;')
})

test('the white lighthouse goes out once Ghostty is in front and the person at it; a question waits for its answer', async ($, on) => {
  const idle = { value: 1 }
  const { clock, world, shader, ask } = await waitingWorld($, on, idle)
  await $.turn.complete({ answer: 'klart', durationMs: 30_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(4_000)
  expect(shader()).toContain('const int BEACON = 2;')
  // Ghostty in front with no one at it: nobody has seen it.
  world.front.value = 'com.mitchellh.ghostty'
  idle.value = 400
  await clock.advance(4_000)
  expect(shader()).toContain('const int BEACON = 2;')
  idle.value = 1
  await clock.advance(4_000)
  expect(shader()).toContain('const int BEACON = 0;')
  // A question is not put out by a look: Claude waits for the answer.
  await ask()
  await clock.advance(4_000)
  expect(shader()).toContain('const int BEACON = 1;')
})

test("another live session's question lights this sky; a dead session's does not", async ($, on) => {
  const { clock, world, runtime, start, shader } = await waitingWorld($, on)
  world.files.set(`${runtime}/waiting-other`, { text: JSON.stringify({ mode: 'asking', since: start }), mtimeMs: start })
  world.files.set(`${runtime}/alive-other`, { text: '', mtimeMs: start })
  await clock.advance(10_000)
  expect(shader()).toContain('const int BEACON = 1;')
  world.files.set(`${runtime}/alive-other`, { text: '', mtimeMs: start - 10 * 60_000 })
  await clock.advance(10_000)
  expect(shader()).toContain('const int BEACON = 0;')
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
  expect(shader()).toContain('const int BEACON = 0;')
})

test('on battery the sky stands still; a question still sweeps', async ($, on) => {
  const { clock, world, include, ask } = await waitingWorld($, on, { value: 1 }, () => undefined)
  world.power.text = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1234)\t80%; discharging\n"
  await clock.advance(61_000)
  expect(include()).toContain('custom-shader-animation = false')
  await ask()
  await clock.advance(100)
  expect(include()).toContain('custom-shader-animation = always')
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
  expect(shader()).toContain('const int BEACON = 1;')
  gates.Read!()
  await reading
  await clock.advance(100)
  expect(shader()).toContain('const int BEACON = 1;')
  gates.Bash!()
  await asking
  await clock.advance(100)
  expect(shader()).toContain('const int BEACON = 0;')
})

test('/solar toss throws a ball in the sky\'s basket, /solar burn burns it for a while', async ($, on) => {
  const { clock, world } = await waitingWorld($, on)
  const solar = (args: string) => $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  // The tab's mark as last written to its terminal.
  const mark = () => world.runs.filter(argv => argv[0] === 'sh' && argv[4]?.includes(']4;16;')).at(-1)?.[4]
  expect(mark()).toContain('rgb:00/00/01')
  await solar('toss')
  await clock.advance(1_500)
  expect(mark()).toContain('rgb:00/01/01')
  // The Swedish word it once took still works.
  await solar('bränn')
  await clock.advance(1_500)
  expect(mark()).toContain('rgb:01/01/01')
  await clock.advance(7_000)
  expect(mark()).toContain('rgb:02/00/01')
  await clock.advance(4_000)
  expect(mark()).toMatch(/rgb:00\/0[01]\/01/)
})

test('a shader changed on disk behind this session is written again', async ($, on) => {
  const { clock, world, runtime, shader } = await waitingWorld($, on)
  const mine = shader()
  world.files.set(`${runtime}/sky.glsl`, { text: '// another session lit a lighthouse here', mtimeMs: 0 })
  await clock.advance(10_000)
  expect(shader()).toBe(mine)
})
