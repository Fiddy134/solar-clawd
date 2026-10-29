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
import type { Theme, ThemeWhen } from './themes/theme'

// The engine's own events. A theme brings its own kinds (its manifest's
// events and previews), any string.
export type EngineEventKind =
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
export type EventKind = EngineEventKind | (string & {})

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

export type Spec = {
  kind: EventKind
  // The word the band shows while it plays.
  word: string
  slotMs: number
  chance: number
  durationMs: number
  when: (ctx: EventContext) => boolean
  // Its schedule's seed: the same salt, the same slots taken.
  salt: number
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const isNight = (ctx: EventContext) => ctx.elevation < -8
const isDay = (ctx: EventContext) => ctx.elevation > 2
const isClear = (ctx: EventContext, most = 0.3) => ctx.cloudiness <= most
const isWet = (sky: Sky) => sky === 'drizzle' || sky === 'rain' || sky === 'thunder' || sky === 'snow'
const inMonths = (ctx: EventContext, ...months: number[]) => months.includes(ctx.time.month)

// The engine's catalogue, at a pace that leaves the sky mostly quiet. The
// salts are each one's place in the list from before the dolphins left it
// for the theme fyr (7 and 8 are theirs), so every schedule stays as it was.
export const EVENTS: readonly Spec[] = [
  { kind: 'balloon', word: 'balloon', slotMs: 3 * HOUR, chance: 1, durationMs: 4 * MINUTE, when: ctx => isDay(ctx) && ctx.wind < 6 && !isWet(ctx.sky), salt: 0 },
  {
    kind: 'birds',
    word: 'migrating birds',
    slotMs: 40 * MINUTE,
    chance: 1,
    durationMs: 90_000,
    // Spring and autumn, around sunrise and sunset.
    when: ctx => inMonths(ctx, 3, 4, 5, 8, 9, 10) && ctx.elevation > -3 && ctx.elevation < 15 && !isWet(ctx.sky),
    salt: 1,
  },
  { kind: 'plane', word: 'plane', slotMs: HOUR, chance: 1, durationMs: 2 * MINUTE, when: ctx => isDay(ctx) && isClear(ctx), salt: 2 },
  { kind: 'kite', word: 'kite', slotMs: HOUR, chance: 1, durationMs: 5 * MINUTE, when: ctx => isDay(ctx) && ctx.wind >= 6 && ctx.wind <= 12 && !isWet(ctx.sky), salt: 3 },
  {
    kind: 'leaves',
    word: 'autumn leaves',
    slotMs: HOUR,
    chance: 0.8,
    durationMs: 3 * MINUTE,
    when: ctx => inMonths(ctx, 9, 10, 11) && ctx.wind >= 5 && ctx.elevation > -6,
    salt: 4,
  },
  { kind: 'blossom', word: 'cherry blossom', slotMs: HOUR, chance: 0.8, durationMs: 3 * MINUTE, when: ctx => inMonths(ctx, 5) && ctx.elevation > -6, salt: 5 },
  { kind: 'comet', word: 'comet', slotMs: 60 * DAY, chance: 1, durationMs: 3 * DAY, when: ctx => isNight(ctx) && isClear(ctx, 0.6), salt: 6 },
  { kind: 'constellation', word: 'clawd constellation', slotMs: 3.5 * DAY, chance: 1, durationMs: 10 * MINUTE, when: ctx => isNight(ctx) && isClear(ctx, 0.5), salt: 9 },
]

// Not scheduled: while its condition holds, and when Claude says so. A
// satellite is the real ISS now (iss.ts), and played only as a preview.
const RAINBOW = { kind: 'rainbow', word: 'rainbow' } as const
const MILESTONE = { kind: 'milestone', word: 'milestone', durationMs: 20_000 } as const
const SHOOTING_STAR = { kind: 'shootingStar', word: 'shooting star' } as const
const SATELLITE = { kind: 'satellite', word: 'satellite' } as const

// The Swedish days' words, as the band and /solar say them.
const DAY_WORDS = {
  witch: 'easter witch',
  feathers: 'easter feathers',
  flag: 'national day',
  maypole: 'maypole',
  luciaTrain: 'lucia procession',
  christmasStar: 'christmas star',
  sleigh: "santa's sleigh",
  fireworks: 'fireworks',
} as const
type DayKind = keyof typeof DAY_WORDS

// The words the mod once spoke, Swedish, still taken by /solar event; a
// theme's own are its manifest's aliases.
export const OLD_EVENT_WORDS: Record<string, EngineEventKind> = {
  luftballong: 'balloon', flyttfåglar: 'birds', flygplan: 'plane', drake: 'kite', höstlöv: 'leaves', körsbärsblad: 'blossom',
  komet: 'comet', 'clawd-stjärnbild': 'constellation', regnbåge: 'rainbow',
  milstolpe: 'milestone', stjärnfall: 'shootingStar', satellit: 'satellite', påskkärring: 'witch', påskfjädrar: 'feathers',
  nationaldagen: 'flag', midsommarstång: 'maypole', luciatåg: 'luciaTrain', julstjärna: 'christmasStar', tomten: 'sleigh', fyrverkeri: 'fireworks',
}

// Every event of the engine's the band and /solar can name, its word
// first; wordsOf adds a theme's.
export const EVENT_WORDS: Record<EngineEventKind, string> = {
  ...(Object.fromEntries(EVENTS.map(spec => [spec.kind, spec.word])) as Record<Exclude<EngineEventKind, 'rainbow' | 'milestone' | 'shootingStar' | 'satellite' | DayKind>, string>),
  ...DAY_WORDS,
  satellite: SATELLITE.word,
  rainbow: RAINBOW.word,
  milestone: MILESTONE.word,
  shootingStar: SHOOTING_STAR.word,
}

// A theme's events and previews among the engine's: every word the band
// and /solar can say, by kind.
export function wordsOf(theme: Theme): Record<EventKind, string> {
  const own = [...theme.manifest.events, ...theme.manifest.previews].map(event => [event.kind, event.word])

  return { ...EVENT_WORDS, ...Object.fromEntries(own) }
}

// The kind /solar event means by `name`: a word, a kind, a word the mod
// once spoke or one of the theme's aliases; undefined for none. /solar
// hands it the person's words in lower case, and a word with a letter
// such as ä may come composed or as a letter and its mark, so both sides
// are compared composed and in lower case. Only a table's own words count,
// never a name every object has.
export function kindOf(name: string, theme: Theme): EventKind | undefined {
  const said = name.normalize('NFC').toLowerCase()
  const isSaid = (word: string) => word.normalize('NFC').toLowerCase() === said
  const words = wordsOf(theme)
  const own = Object.keys(words).find(kind => isSaid(words[kind]!) || kind.toLowerCase() === said)
  const old = Object.hasOwn(OLD_EVENT_WORDS, said) ? OLD_EVENT_WORDS[said] : undefined

  return own ?? old ?? Object.entries(theme.manifest.aliases).find(([word]) => isSaid(word))?.[1]
}

// A theme's condition for an event as a predicate, in the engine's own
// terms: a day's sun above 2°, a night's below -8°, a low one between -3°
// and 15°; how clear, how windy, dry, which months, how high the sun.
export function whenOf(when: ThemeWhen): (ctx: EventContext) => boolean {
  return ctx => {
    if (when.sun === 'day' && !isDay(ctx)) return false
    if (when.sun === 'night' && !isNight(ctx)) return false
    if (when.sun === 'low' && !(ctx.elevation > -3 && ctx.elevation < 15)) return false
    if (when.clearAtMost !== undefined && !isClear(ctx, when.clearAtMost)) return false
    if (when.windBelow !== undefined && !(ctx.wind < when.windBelow)) return false
    if (when.windAtLeast !== undefined && !(ctx.wind >= when.windAtLeast)) return false
    if (when.windAtMost !== undefined && !(ctx.wind <= when.windAtMost)) return false
    if (when.dry && isWet(ctx.sky)) return false
    if (when.months !== undefined && !when.months.includes(ctx.time.month)) return false
    if (when.elevationAbove !== undefined && !(ctx.elevation > when.elevationAbove)) return false
    if (when.elevationBelow !== undefined && !(ctx.elevation < when.elevationBelow)) return false

    return true
  }
}

// A theme's events as the engine schedules them, after its own: each with
// its manifest's salt, or 1000 and its place in the list.
export function specsOf(theme: Theme): Spec[] {
  return theme.manifest.events.map((event, i) => ({
    kind: event.kind,
    word: event.word,
    slotMs: event.slotMinutes * MINUTE,
    chance: event.chance,
    durationMs: event.minutes * MINUTE,
    when: whenOf(event.when),
    salt: event.salt ?? 1000 + i,
  }))
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
  if (time.month === 8 && time.day >= 11 && time.day <= 13) return 'Perseids'
  if (time.month === 12 && time.day >= 13 && time.day <= 14) return 'Geminids'

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
  if (time.month === 6 && time.day >= 19 && time.day <= 25 && time.weekday === 5) {
    days.push(lasting('maypole', ms, time), lasting('blossom', ms, time))
  }
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

// The events this session plays and those another session played (the
// settings file): one of each kind, the latest, in the order they were
// played, so every session draws the same sky from them. Only the kinds
// `isKnown` takes, the theme's own.
export function mergeForced(own: readonly Forced[], shared: readonly Forced[], isKnown: (kind: EventKind) => boolean): Forced[] {
  const latest = new Map<EventKind, Forced>()
  for (const event of [...own, ...shared]) {
    const seen = latest.get(event.kind)
    if (isKnown(event.kind) && (seen === undefined || event.at > seen.at)) latest.set(event.kind, event)
  }

  return [...latest.values()].sort((a, b) => a.at - b.at)
}

// The events up at `ms`: those of `specs` (the engine's, and a theme's
// after them) whose condition holds, a rainbow if the sky makes one, and
// those `forced` (a preview or a milestone) still within their length.
export function eventsAt(ms: number, ctx: EventContext, forced: readonly Forced[] = [], specs: readonly Spec[] = EVENTS): ActiveEvent[] {
  const active: ActiveEvent[] = []

  for (const spec of specs) {
    const slot = Math.floor(ms / spec.slotMs)
    const seed = hash(spec.salt * 1_000_003 + slot * 7919 + 17)
    if (rand(seed) >= spec.chance) continue
    const start = slot * spec.slotMs + Math.floor(rand(seed + 1) * (spec.slotMs - spec.durationMs))
    if (ms < start || ms >= start + spec.durationMs || !spec.when(ctx)) continue
    active.push({ kind: spec.kind, seed: seed % 1000, start, durationMs: spec.durationMs, progress: (ms - start) / spec.durationMs })
  }

  active.push(...dayEventsAt(ms, ctx))

  if (isRainbow(ctx)) {
    active.push({ kind: 'rainbow', seed: 0, start: ctx.lastRainAt ?? ms, durationMs: 30 * MINUTE, progress: 0 })
  }

  const played: ActiveEvent[] = []
  for (const { kind, at } of forced) {
    const durationMs = kind === 'milestone' ? MILESTONE.durationMs : PREVIEW_MS
    if (ms < at || ms >= at + durationMs) continue
    if (active.some(event => event.kind === kind) || played.some(event => event.kind === kind)) {
      played.push(...active.filter(event => event.kind === kind && !played.includes(event)))
      continue
    }
    // A preview of the fireworks is the full display.
    const progress = kind === 'fireworks' ? 1 : (ms - at) / durationMs
    played.push({ kind, seed: hash(at) % 1000, start: at, durationMs, progress })
  }

  // What was asked for (a preview, a milestone) first: the shader shows the
  // first few, and the band names the first.
  return [...played, ...active.filter(event => !played.includes(event))]
}
