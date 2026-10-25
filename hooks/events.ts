// Small, rare things in the sky, printed in risograph like the rest of it:
// balloons, planes, birds passing, a comet some nights. Which are up is a
// pure function of the time (and the sky then), so every session, the band
// and the shader agree without keeping anything.
//
// Each event has a slot it may come once in, a chance that it does, a
// length, and a condition the sky must meet while it plays. Shooting stars
// are too quick to schedule from here (Ghostty's shader has no clock but
// its own): they have a rate instead, and the shader places them.

import { easter, localTime, sunAt } from './astro'
import type { LocalTime, Place } from './astro'
import { hash, rand } from './paint'
import { greyness, skyOf } from './sky'
import type { Sky, Weather } from './sky'

export type EventKind =
  | 'satellite'
  | 'balloon'
  | 'birds'
  | 'plane'
  | 'rainbow'
  | 'kite'
  | 'leaves'
  | 'blossom'
  | 'comet'
  | 'constellation'
  | 'milestone'
  | 'shootingStar'
  // The Swedish days.
  | 'witch'
  | 'feathers'
  | 'flag'
  | 'maypole'
  | 'luciaTrain'
  | 'christmasStar'
  | 'sleigh'
  | 'fireworks'

// What an event's condition may look at.
export type EventContext = {
  time: LocalTime
  elevation: number
  cloudiness: number
  sky: Sky
  wind: number
  // When it last rained, if lately.
  lastRainAt: number | null
  ms: number
}

export type ActiveEvent = {
  kind: EventKind
  // Repeatable per occurrence: where it flies, which way, its colours.
  seed: number
  start: number
  durationMs: number
  // 0 to 1 through its length.
  progress: number
}

type Spec = {
  kind: EventKind
  // The word the band shows while it plays.
  word: string
  slotMs: number
  chance: number
  durationMs: number
  when: (ctx: EventContext) => boolean
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const isNight = (ctx: EventContext) => ctx.elevation < -8
const isDay = (ctx: EventContext) => ctx.elevation > 2
const isClear = (ctx: EventContext, most = 0.3) => ctx.cloudiness <= most
const isWet = (sky: Sky) => sky === 'drizzle' || sky === 'rain' || sky === 'thunder' || sky === 'snow'
const inMonths = (ctx: EventContext, ...months: number[]) => months.includes(ctx.time.month)

// The catalogue, at a pace that leaves the sky mostly quiet.
export const EVENTS: readonly Spec[] = [
  { kind: 'balloon', word: 'luftballong', slotMs: 3 * HOUR, chance: 1, durationMs: 4 * MINUTE, when: ctx => isDay(ctx) && ctx.wind < 6 && !isWet(ctx.sky) },
  {
    kind: 'birds',
    word: 'flyttfåglar',
    slotMs: 40 * MINUTE,
    chance: 1,
    durationMs: 90_000,
    // Spring and autumn, around sunrise and sunset.
    when: ctx => inMonths(ctx, 3, 4, 5, 8, 9, 10) && ctx.elevation > -3 && ctx.elevation < 15 && !isWet(ctx.sky),
  },
  { kind: 'plane', word: 'flygplan', slotMs: HOUR, chance: 1, durationMs: 2 * MINUTE, when: ctx => isDay(ctx) && isClear(ctx) },
  { kind: 'kite', word: 'drake', slotMs: HOUR, chance: 1, durationMs: 5 * MINUTE, when: ctx => isDay(ctx) && ctx.wind >= 6 && ctx.wind <= 12 && !isWet(ctx.sky) },
  {
    kind: 'leaves',
    word: 'höstlöv',
    slotMs: HOUR,
    chance: 0.8,
    durationMs: 3 * MINUTE,
    when: ctx => inMonths(ctx, 9, 10, 11) && ctx.wind >= 5 && ctx.elevation > -6,
  },
  { kind: 'blossom', word: 'körsbärsblad', slotMs: HOUR, chance: 0.8, durationMs: 3 * MINUTE, when: ctx => inMonths(ctx, 5) && ctx.elevation > -6 },
  { kind: 'comet', word: 'komet', slotMs: 60 * DAY, chance: 1, durationMs: 3 * DAY, when: ctx => isNight(ctx) && isClear(ctx, 0.6) },
  { kind: 'constellation', word: 'clawd-stjärnbild', slotMs: 3.5 * DAY, chance: 1, durationMs: 10 * MINUTE, when: ctx => isNight(ctx) && isClear(ctx, 0.5) },
]

// Not scheduled: while its condition holds, and when Claude says so. A
// satellite is the real ISS now (iss.ts), and played only as a preview.
const RAINBOW = { kind: 'rainbow', word: 'regnbåge' } as const
const MILESTONE = { kind: 'milestone', word: 'milstolpe', durationMs: 20_000 } as const
const SHOOTING_STAR = { kind: 'shootingStar', word: 'stjärnfall' } as const
const SATELLITE = { kind: 'satellite', word: 'satellit' } as const

// The Swedish days' words, as the band and /solar say them.
const DAY_WORDS = {
  witch: 'påskkärring',
  feathers: 'påskfjädrar',
  flag: 'nationaldagen',
  maypole: 'midsommarstång',
  luciaTrain: 'luciatåg',
  christmasStar: 'julstjärna',
  sleigh: 'tomten',
  fireworks: 'fyrverkeri',
} as const
type DayKind = keyof typeof DAY_WORDS

// Every event the band and /solar can name, its word first.
export const EVENT_WORDS: Record<EventKind, string> = {
  ...(Object.fromEntries(EVENTS.map(spec => [spec.kind, spec.word])) as Record<Exclude<EventKind, 'rainbow' | 'milestone' | 'shootingStar' | 'satellite' | DayKind>, string>),
  ...DAY_WORDS,
  satellite: SATELLITE.word,
  rainbow: RAINBOW.word,
  milestone: MILESTONE.word,
  shootingStar: SHOOTING_STAR.word,
}

// How long a preview (`/solar event <name>`) plays an event that has no
// length of its own, or a long one.
export const PREVIEW_MS = 90_000

export function contextAt(ms: number, place: Place, weather: Weather | null | undefined, lastRainAt: number | null, offsetMs?: number): EventContext {
  return {
    ms,
    time: localTime(ms, offsetMs),
    elevation: sunAt(ms, place.lat, place.lon).elevation,
    cloudiness: greyness(weather),
    sky: weather ? skyOf(weather.code) : 'clear',
    wind: weather?.wind ?? 0,
    lastRainAt,
  }
}

// The meteor showers worth a night up: the Perseids and the Geminids.
export function showerAt(time: LocalTime): string | null {
  if (time.month === 8 && time.day >= 11 && time.day <= 13) return 'Perseiderna'
  if (time.month === 12 && time.day >= 13 && time.day <= 14) return 'Geminiderna'

  return null
}

// Shooting stars an hour: a couple on a clear night, many in a shower.
export function shootingRate(ctx: EventContext): number {
  if (!isNight(ctx) || !isClear(ctx)) return 0

  return showerAt(ctx.time) ? 10 : 2
}

function isRainbow(ctx: EventContext): boolean {
  // Rain that has been: a pinned or played time may lie before it.
  const since = ctx.lastRainAt === null ? -1 : ctx.ms - ctx.lastRainAt
  const isRecent = since >= 0 && since < 30 * MINUTE

  return isRecent && !isWet(ctx.sky) && ctx.elevation > 0 && ctx.elevation < 42
}

// --- The Swedish days ---------------------------------------------------------

const DAY_MS = 24 * HOUR

// Days from Easter Sunday to this local date.
function fromEaster(time: LocalTime): number {
  const { month, day } = easter(time.year)

  return Math.round((Date.UTC(time.year, time.month - 1, time.day) - Date.UTC(time.year, month - 1, day)) / DAY_MS)
}

// One pass of `passMs` in each `slotMinutes` slot from local minute
// `from` to `to`, each at a moment its seed picks.
function passes(kind: EventKind, ms: number, time: LocalTime, from: number, to: number, slotMinutes: number, passMs: number): ActiveEvent | null {
  const minutes = time.hour * 60 + time.minute
  if (minutes < from || minutes >= to) return null
  const slot = Math.floor((minutes - from) / slotMinutes)
  const seed = hash(time.year * 10_000 + time.month * 400 + time.day * 12 + slot)
  const slotStart = ms - (minutes - from - slot * slotMinutes) * MINUTE - (ms % MINUTE)
  const start = slotStart + Math.floor(rand(seed) * (slotMinutes * MINUTE - passMs))
  if (ms < start || ms >= start + passMs) return null

  return { kind, seed: seed % 1000, start, durationMs: passMs, progress: (ms - start) / passMs }
}

// Up all through the local day (or from `from` to `to`, local minutes),
// `progress` how far through.
function lasting(kind: EventKind, ms: number, time: LocalTime, from = 0, to = 1440): ActiveEvent {
  const minutes = time.hour * 60 + time.minute
  const start = ms - (minutes - from) * MINUTE - (ms % MINUTE)
  const durationMs = (to - from) * MINUTE

  return { kind, seed: time.year % 1000, start, durationMs, progress: (ms - start) / durationMs }
}

// The fireworks' strength: a rocket now and then through the evening, the
// whole sky from ten to midnight to a quarter past, dying out by half past.
function fireworksAt(time: LocalTime): number | null {
  const minutes = time.hour * 60 + time.minute
  if (time.month === 12 && time.day === 31 && minutes >= 18 * 60) return minutes >= 23 * 60 + 50 ? 1 : 0.15
  if (time.month === 1 && time.day === 1 && minutes < 30) return minutes < 15 ? 1 : 1 - (minutes - 15) / 15

  return null
}

// The Swedish days up at `ms`, in Swedish local time: Easter, the national
// day, Midsummer's Eve, Lucia, Christmas Eve and New Year.
export function dayEventsAt(ms: number, ctx: EventContext): ActiveEvent[] {
  const { time } = ctx
  const days: (ActiveEvent | null)[] = []
  const easterDay = fromEaster(time)
  if (easterDay === -3) days.push(passes('witch', ms, time, 19 * 60, 23 * 60, 40, 3 * MINUTE))
  if (easterDay >= -3 && easterDay <= 1) days.push(lasting('feathers', ms, time))
  if (time.month === 6 && time.day === 6) days.push(lasting('flag', ms, time))
  if (time.month === 6 && time.day >= 19 && time.day <= 25 && time.weekday === 5) days.push(lasting('maypole', ms, time))
  if (time.month === 12 && time.day === 13 && time.hour >= 5 && time.hour < 8 && ctx.elevation < -3) {
    const start = Math.floor(ms / (3 * MINUTE)) * 3 * MINUTE
    days.push({ kind: 'luciaTrain', seed: 13, start, durationMs: 3 * MINUTE, progress: (ms - start) / (3 * MINUTE) })
  }
  if (time.month === 12 && time.day === 24) {
    days.push(lasting('christmasStar', ms, time))
    days.push(passes('sleigh', ms, time, 15 * 60, 15 * 60 + 2, 2, 2 * MINUTE) ?? passes('sleigh', ms, time, 17 * 60, 22 * 60, 30, 2 * MINUTE))
  }
  const fireworks = fireworksAt(time)
  if (fireworks !== null) days.push({ ...lasting('fireworks', ms, time), progress: fireworks })

  return days.filter((day): day is ActiveEvent => day !== null)
}

export type Forced = { kind: EventKind; at: number }

// The events up at `ms`: scheduled ones whose condition holds, a rainbow if
// the sky makes one, and those `forced` (a preview or a milestone) still
// within their length.
export function eventsAt(ms: number, ctx: EventContext, forced: readonly Forced[] = []): ActiveEvent[] {
  const active: ActiveEvent[] = []

  EVENTS.forEach((spec, index) => {
    const slot = Math.floor(ms / spec.slotMs)
    const seed = hash(index * 1_000_003 + slot * 7919 + 17)
    if (rand(seed) >= spec.chance) return
    const start = slot * spec.slotMs + Math.floor(rand(seed + 1) * (spec.slotMs - spec.durationMs))
    if (ms < start || ms >= start + spec.durationMs || !spec.when(ctx)) return
    active.push({ kind: spec.kind, seed: seed % 1000, start, durationMs: spec.durationMs, progress: (ms - start) / spec.durationMs })
  })

  active.push(...dayEventsAt(ms, ctx))

  if (isRainbow(ctx)) {
    active.push({ kind: 'rainbow', seed: 0, start: ctx.lastRainAt ?? ms, durationMs: 30 * MINUTE, progress: 0 })
  }

  for (const { kind, at } of forced) {
    const durationMs = kind === 'milestone' ? MILESTONE.durationMs : PREVIEW_MS
    if (ms < at || ms >= at + durationMs || active.some(event => event.kind === kind)) continue
    // A preview of the fireworks is the full display.
    const progress = kind === 'fireworks' ? 1 : (ms - at) / durationMs
    active.push({ kind, seed: hash(at) % 1000, start: at, durationMs, progress })
  }

  return active
}
