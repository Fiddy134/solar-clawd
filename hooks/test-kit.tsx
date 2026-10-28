// What the tests share: the worlds they run the mod in, and the moments
// and scenes they look at.

import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { STOCKHOLM, swedishOffsetMs } from './astro'
import { contextAt, eventsAt } from './events'

export const BAND = {
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

// Ghostty, its config, the runtime folder and the person's idleness, in memory.
export function ghosttyWorld(on: On, idleSeconds: { value: number }) {
  const files = new Map<string, { text: string; mtimeMs: number }>()
  const runs: string[][] = []
  // Paths written to, in order; commands answering as though they failed.
  const writes: string[] = []
  const failing = new Set<string>()
  // Commands the engine refuses to run at all.
  const denied = new Set<string>()
  // The toasts shown, in order.
  const toasts: string[] = []
  // What other commands answer, by name: uname, ghostty --version.
  const answers = new Map<string, string>()
  // What pmset says powers the Mac.
  const power = { text: "Now drawing from 'AC Power'\n" }
  // The bundle id of the app in front, as lsappinfo says it.
  const front = { value: 'com.apple.Safari' }
  // The session's terminal, as ps names it.
  answers.set('sh', 'ttys004\n')
  let now = 0
  // The session's environment: Ghostty's own variables, the home folder.
  const env = new Map([['TERM_PROGRAM', 'ghostty'], ['HOME', '/Users/test']])
  on('env.get', (_, e) => ({ value: env.get(e.name) }))
  // What reaches the tab, in order: the session's own writes to a /dev
  // path, and each helper's start and end with the mark it writes.
  const ttyLog: string[] = []
  on('fs.write', (_, e) => {
    files.set(e.path, { text: e.text, mtimeMs: now })
    writes.push(e.path)
    if (e.path.startsWith('/dev/')) ttyLog.push(`write ${e.text}`)
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
    if (command && denied.has(command)) return { deny: 'denied in a test' }
    if (command && failing.has(command)) return { value: { exitCode: 1, stdout: '', stderr: 'failed', isStdoutTruncated: false, isStderrTruncated: false } }
    let stdout = ''
    if (command === '/usr/sbin/ioreg') stdout = `    | |   "HIDIdleTime" = ${idleSeconds.value * 1e9}\n`
    if (command === '/usr/bin/pmset') stdout = power.text
    if (command && answers.has(command)) stdout = answers.get(command)!
    if (command === '/usr/bin/lsappinfo') stdout = e.argv[1] === 'front' ? 'ASN:0x0-0x1:\n' : `"ASN:0x0-0x1:" (in front)\n    bundleID="${front.value}"\n`
    if (command === '/bin/rm') for (const path of e.argv.slice(2)) files.delete(path)
    if (command === '/bin/mv') {
      const [from, to] = e.argv.slice(-2) as [string, string]
      if (files.has(from)) files.set(to, { ...files.get(from)!, mtimeMs: now })
      files.delete(from)
    }
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // The helpers started (startTicks's zsh), each with the moments it ran
  // from and to (null while it runs), on the clock `helpersOn` is given:
  // it says it ticks, and ends when the mod closes its stream. Failing, it
  // says why on stderr and ends at once, as zsh does on a tty it cannot
  // open.
  const helpers: { argv: string[]; from: number; to: number | null }[] = []
  const helperFails = { value: false }
  let helperClock: ReturnType<typeof mock.clock> | null = null
  on('process.spawn', async function* (_, e) {
    const helper = { argv: [...e.argv], from: helperClock?.now() ?? now, to: null as number | null }
    helpers.push(helper)
    ttyLog.push(`start ${e.argv.at(-1)}`)
    try {
      if (helperFails.value) yield { stream: 'stderr' as const, text: 'zsh:3: operation not permitted: /dev/ttys004\n' }
      else yield { stream: 'stdout' as const, text: 'ticking\n' }
    } finally {
      helper.to = helperClock?.now() ?? now
      ttyLog.push(`end ${e.argv.at(-1)}`)
    }

    return { value: { code: helperFails.value ? 1 : null, signal: helperFails.value ? null : 'SIGTERM' } }
  })
  on('session.id', () => ({ value: 'this-session' }))
  on('session.end', () => ({ sessionId: 'this-session' }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  return { files, runs, writes, failing, denied, toasts, answers, power, front, unreadable, env, helpers, helperFails, ttyLog,
    helpersOn: (clock: ReturnType<typeof mock.clock>) => (helperClock = clock),
    tick: (ms: number) => (now = ms),
  }
}

// The terminal a Ghostty session's tab is, where its mark is written.
export const TTY = '/dev/ttys004'

export const RELOADS = (runs: string[][]) => runs.filter(argv => argv[0] === '/usr/bin/osascript' && argv.join(' ').includes('reload_config')).length

// A context for a moment over Stockholm, with this weather.
export const contextFor = (ms: number, weather = { temperature: 12, code: 0, cloudCover: 5, wind: 3 }, lastRainAt: number | null = null) =>
  contextAt(ms, STOCKHOLM, weather, lastRainAt)

export const CONFIG = '/Users/test/Library/Application Support/com.mitchellh.ghostty/config.ghostty'

// A Ghostty session started, its first sky written; answers the runtime folder.
export async function startGhostty($: Engine, on: On, clock: ReturnType<typeof mock.clock>, world: ReturnType<typeof ghosttyWorld>) {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(11_000)
  const shader = [...world.files.keys()].find(path => path.endsWith('/runtime/sky.glsl'))!

  return shader.slice(0, -'/sky.glsl'.length)
}

export const SIGNALS = (runs: string[][]) => runs.filter(argv => argv.join(' ') === 'pkill -USR2 -x ghostty').length

// Ghostty on Linux, `version` its own, not running as a systemd service.
export function linuxWorld(on: On, start: number, version: string) {
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  world.answers.set('uname', 'Linux\n')
  world.answers.set('ghostty', `Ghostty ${version}\n\nVersion\n`)
  world.failing.add('systemctl')

  return world
}

// A Ghostty session to wait in: its shader and include as text.
export async function waitingWorld(
  $: Engine,
  on: On,
  idle = { value: 1 },
  before?: (clock: ReturnType<typeof mock.clock>) => void,
  start = Date.UTC(2026, 9, 24, 20, 0),
) {
  const clock = mock.clock(on, { now: start })
  before?.(clock)
  const world = ghosttyWorld(on, idle)
  world.tick(start)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('classic.Notification', () => ({}))
  const runtime = await startGhostty($, on, clock, world)

  return {
    start,
    clock,
    world,
    runtime,
    shader: () => world.files.get(`${runtime}/sky.glsl`)?.text ?? '',
    include: () => world.files.get(`${runtime}/solar-clawd.ghostty`)?.text ?? '',
    ask: (type = 'permission_prompt') => $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: type }),
  }
}

// The ISS's elements from CelesTrak on 2026-10-25, and where satellite.js
// (SGP4) put it from Stockholm then: [ms, elevation, azimuth] (tools/iss/check.sh).
export const ISS_OMM = {
  OBJECT_NAME: 'ISS (ZARYA)', OBJECT_ID: '1998-067A', EPOCH: '2026-10-24T05:01:11.149248', MEAN_MOTION: 15.49030149,
  ECCENTRICITY: 0.00068845, INCLINATION: 51.6335, RA_OF_ASC_NODE: 21.6229, ARG_OF_PERICENTER: 302.9098, MEAN_ANOMALY: 57.1228,
  EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999, REV_AT_EPOCH: 59175,
  BSTAR: 0.00014938171, MEAN_MOTION_DOT: 7.8e-5, MEAN_MOTION_DDOT: 0,
}
export const ISS_REFERENCE = [
  [1792891631149, 11.7, 162.98], // 01:27 UTC, up but in Earth's shadow
  [1792897271149, 10.62, 222.38],
  [1792903091149, 14.61, 228.63], // visible
  [1792897451149, 20.8, 159.82], // visible
  [1792897511149, 16.48, 137.48], // visible
] as const
export const ISS_PASS = 1792897451149

// A Swedish local time as a moment.
export const swedish = (year: number, month: number, day: number, hour: number, minute = 0) => {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  return guess - swedishOffsetMs(guess - swedishOffsetMs(guess))
}
export const DAY_KINDS = ['witch', 'feathers', 'flag', 'maypole', 'luciaTrain', 'christmasStar', 'sleigh', 'fireworks'] as const
export const daysAt = (ms: number) => eventsAt(ms, contextFor(ms)).filter(e => (DAY_KINDS as readonly string[]).includes(e.kind))
export const kindsAt = (ms: number) => daysAt(ms).map(e => e.kind as string)
export const someMinute = (from: number, to: number, kind: string) => {
  for (let ms = from; ms < to; ms += 60_000) if (kindsAt(ms).includes(kind)) return true
  return false
}
