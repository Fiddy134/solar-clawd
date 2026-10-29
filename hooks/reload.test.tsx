// A hot reload of the mod's code in a running session: the sky it draws
// next is the one it left.
//
// The order of these tests matters. The engine's kit loads a module once a
// test, so the first test runs a session and leaves what a reload would
// find (the files, the tab's mark, the host's state for the session) in
// `left`; the two after it start a fresh module on that, as a reload does.
// Run alone or before the first, they have nothing to start on and fail.

import { expect, mock, test } from 'claude-code/testing'

import { markOf } from './mark'
import { RELOADS, reloadWorld, SCALE_ASKS } from './test-kit'
import type { LeftBehind } from './test-kit'

const START = Date.UTC(2026, 9, 24, 20, 0)
// The session runs this long before the reload, which comes within the
// same two minutes of the sun: nothing up there has moved by then.
const RUN_MS = 30_000
// The mark of a context window 45 % full with a subagent at work.
const MARK = markOf({ fish: 4, state: 'idle' }, { tool: 'none', agents: 1 })

let left: LeftBehind | null = null

test('a session with its sky up keeps what the sky is drawn from in the host, for a reload', { timeoutMs: 15_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const { world, states } = reloadWorld(on, clock, null)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'Read README.md.' } as never)
  await clock.advance(RUN_MS)
  left = { files: new Map(world.files), states: new Map(states), mark: MARK, at: clock.now() }
  expect(world.helpers.at(-1)?.argv.at(-1)).toBe(MARK)
  const kept = JSON.stringify(states.get('carried'))
  expect(kept).toContain('"cloudCover":80')
  expect(kept).toContain('"fill":45')
  expect(kept).toContain('"helper-agent"')
})

test('a reload of the mod with nothing changed leaves the sky as it was', async ($, on) => {
  const clock = mock.clock(on, { now: left!.at + 1_000 })
  const { world, runtime } = reloadWorld(on, clock, left)
  const shader = world.files.get(`${runtime}/sky.glsl`)!.text
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  // The scale another session (here the old module) asked a moment ago
  // serves until SCALE_MS has passed, when it is asked again as ever.
  await clock.advance(9_000)
  expect(SCALE_ASKS(world.runs)).toBe(0)
  // Past the next look at the sky, with the weather fetched again: no
  // Ghostty reload, nothing of the sky's written again.
  await clock.advance(2_000)
  expect(RELOADS(world.runs)).toBe(0)
  expect(world.writes.filter(path => path.includes('/sky.glsl') || path.includes('/solar-clawd.ghostty'))).toEqual([])
  expect(world.files.get(`${runtime}/sky.glsl`)!.text).toBe(shader)
  // The old helper ended with the old module: one new one ticks the same
  // mark, which is not written to the tab again.
  expect(world.helpers.map(helper => [helper.argv.at(-1), helper.to])).toEqual([[MARK, null]])
  expect(world.ttyLog).toEqual([`start ${MARK}`])
})

test('a reload keeps the sky ticking', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: left!.at + 1_000 })
  const { world, runtime } = reloadWorld(on, clock, left)
  const shader = world.files.get(`${runtime}/sky.glsl`)!.text
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)
  expect(RELOADS(world.runs)).toBe(0)

  // The sun moves on: the timers run again, a new shader, one reload; and
  // the heartbeat is left again within its minute.
  await clock.advance(120_000)
  expect(world.files.get(`${runtime}/sky.glsl`)!.text).not.toBe(shader)
  expect(RELOADS(world.runs)).toBe(1)
  // That reload is the signal to this user's app, as on a Mac with Ghostty 1.4.
  expect(world.runs.filter(argv => argv.join(' ') === '/bin/kill -USR2 619')).toHaveLength(1)
  expect(world.writes.filter(path => path.endsWith('/alive-this-session')).length).toBeGreaterThan(0)
  expect(world.helpers.filter(helper => helper.to === null)).toHaveLength(1)
})

test('a new session, with nothing kept from before, asks the weather and the screen scale as ever', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const { world, weatherAsks, runtime } = reloadWorld(on, clock, null)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(SCALE_ASKS(world.runs)).toBe(1)
  await clock.advance(11_000)
  expect(weatherAsks.count).toBe(1)
  // Its first sky is drawn before the weather is in, and again with it.
  expect(world.writes.filter(path => path.startsWith(`${runtime}/sky.glsl`)).length).toBe(2)
  expect(world.files.get(`${runtime}/sky.glsl`)!.text).toContain('const float COVER = 0.8;')
})

test('a reload under another session id than the one kept (a /clear between) writes its own heartbeat at once', async ($, on) => {
  // The old module beat for the session's id before the /clear; this one
  // beats for the id the session has now, which no file says is alive yet.
  const kept = left!.states.get('carried') as { shape: string; value: Record<string, unknown> }
  const runtime = '/Users/test/Library/Application Support/solar-clawd/runtime'
  const states = new Map([['carried', { ...kept, value: { ...kept.value, heartbeat: `${runtime}/alive-before-clear` } }]])
  const clock = mock.clock(on, { now: left!.at + 1_000 })
  const { world } = reloadWorld(on, clock, { ...left!, states })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(world.writes).toContain(`${runtime}/alive-this-session`)
  // The mark goes with the heartbeat, as each minute; the same one.
  expect(world.ttyLog).toEqual([`write ${MARK}`, `start ${MARK}`])
})
