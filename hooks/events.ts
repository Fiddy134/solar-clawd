// Small, rare things in the sky, printed in risograph like the rest of it:
// balloons, planes, birds passing, a comet some nights. Which are up is a
// pure function of the time (and the sky then), so every session, the band
// and the shader agree without keeping anything.
//
// Each event has a slot it may come once in, a chance that it does, a
// length, and a condition the sky must meet while it plays. Shooting stars
// are too quick to schedule from here (Ghostty's shader has no clock but
// its own): they have a rate instead, and the shader places them.

import { localTime, sunAt } from './astro'
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
  { kind: 'satellite', word: 'satellit', slotMs: HOUR, chance: 1, durationMs: MINUTE, when: ctx => isNight(ctx) && isClear(ctx) },
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

// Not scheduled: while its condition holds, and when Claude says so.
const RAINBOW = { kind: 'rainbow', word: 'regnbåge' } as const
const MILESTONE = { kind: 'milestone', word: 'milstolpe', durationMs: 20_000 } as const
const SHOOTING_STAR = { kind: 'shootingStar', word: 'stjärnfall' } as const

// Every event the band and /solar can name, its word first.
export const EVENT_WORDS: Record<EventKind, string> = {
  ...(Object.fromEntries(EVENTS.map(spec => [spec.kind, spec.word])) as Record<Exclude<EventKind, 'rainbow' | 'milestone' | 'shootingStar'>, string>),
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
  const isRecent = ctx.lastRainAt !== null && ctx.ms - ctx.lastRainAt < 30 * MINUTE

  return isRecent && !isWet(ctx.sky) && ctx.elevation > 0 && ctx.elevation < 42
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

  if (isRainbow(ctx)) {
    active.push({ kind: 'rainbow', seed: 0, start: ctx.lastRainAt ?? ms, durationMs: 30 * MINUTE, progress: 0 })
  }

  for (const { kind, at } of forced) {
    const durationMs = kind === 'milestone' ? MILESTONE.durationMs : PREVIEW_MS
    if (ms < at || ms >= at + durationMs || active.some(event => event.kind === kind)) continue
    active.push({ kind, seed: hash(at) % 1000, start: at, durationMs, progress: (ms - at) / durationMs })
  }

  return active
}
