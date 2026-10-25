// Time, sun and moon: the local clock and calendar of a place, where the sun
// and the moon stand over it, and which days are holidays there.

export type Place = { name: string; lat: number; lon: number }

export const STOCKHOLM: Place = { name: 'Stockholm', lat: 59.3293, lon: 18.0686 }

export const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const RAD = Math.PI / 180
// Days from the Unix epoch to J2000.0 (2000-01-01 12:00 UTC).
const J2000_DAYS = 10957.5

// --- Clock ------------------------------------------------------------------

function lastSundayAtOneUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0))

  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1)
}

// CET, or CEST from the last Sunday of March to the last Sunday of October:
// the clock until the weather service has said the place's own offset.
export function swedishOffsetMs(ms: number): number {
  const year = new Date(ms).getUTCFullYear()
  const isSummer =
    ms >= lastSundayAtOneUtc(year, 2) && ms < lastSundayAtOneUtc(year, 9)

  return (isSummer ? 2 : 1) * HOUR_MS
}

export type LocalTime = {
  year: number
  month: number // 1 to 12
  day: number
  weekday: number // 0 Sunday to 6 Saturday
  hour: number
  minute: number
}

export function localTime(ms: number, offsetMs = swedishOffsetMs(ms)): LocalTime {
  const d = new Date(ms + offsetMs)

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

export function swedishClock(ms: number): { hour: number; minute: number } {
  const { hour, minute } = localTime(ms)

  return { hour, minute }
}

export function localMidnight(ms: number, offsetMs = swedishOffsetMs(ms)): number {
  const local = ms + offsetMs

  return local - (local % DAY_MS) - offsetMs
}

// --- Sun and moon -------------------------------------------------------------

export type Sun = { elevation: number; azimuth: number }

// Azimuth from north, clockwise, given the hour angle and declination.
function horizontal(hourAngle: number, dec: number, lat: number): Sun {
  const phi = lat * RAD
  const elevation =
    Math.asin(
      Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle),
    ) / RAD
  const fromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
  )

  return { elevation, azimuth: (fromSouth / RAD + 540) % 360 }
}

// NOAA's low-precision solar position: a fraction of a degree off, plenty
// for a sky.
export function sunAt(ms: number, lat = STOCKHOLM.lat, lon = STOCKHOLM.lon): Sun {
  const [x, y, z] = sunDirection(ms)

  return horizontal((gmstDegrees(ms) + lon) * RAD - Math.atan2(y, x), Math.asin(z), lat)
}

// The sun's direction from the Earth, a unit vector in equatorial
// coordinates (x to the March equinox, z to the north pole).
export function sunDirection(ms: number): [number, number, number] {
  const d = ms / DAY_MS - J2000_DAYS
  const g = (357.529 + 0.98560028 * d) * RAD
  const q = 280.459 + 0.98564736 * d
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const tilt = (23.439 - 0.00000036 * d) * RAD

  return [Math.cos(l), Math.cos(tilt) * Math.sin(l), Math.sin(tilt) * Math.sin(l)]
}

// Greenwich mean sidereal time, in degrees.
export function gmstDegrees(ms: number): number {
  const d = ms / DAY_MS - J2000_DAYS

  return (((18.697374558 + 24.06570982441908 * d) * 15) % 360 + 360) % 360
}

// Where a star (right ascension and declination, in degrees) stands from a
// place at a moment.
export function horizontalAt(raDeg: number, decDeg: number, ms: number, lat: number, lon: number): Sun {
  return horizontal((gmstDegrees(ms) + lon - raDeg) * RAD, decDeg * RAD, lat)
}

export type Moon = Sun & {
  // The lit share of the disc, 0 new to 1 full.
  illumination: number
  isWaxing: boolean
}

const SYNODIC_DAYS = 29.530588853

// The moon's place to about a degree (the series SunCalc uses) and its
// phase from the mean synodic month since the new moon of 2000-01-06.
export function moonAt(ms: number, lat = STOCKHOLM.lat, lon = STOCKHOLM.lon): Moon {
  const d = ms / DAY_MS - J2000_DAYS
  const meanLongitude = (218.316 + 13.176396 * d) * RAD
  const anomaly = (134.963 + 13.064993 * d) * RAD
  const distance = (93.272 + 13.22935 * d) * RAD
  const l = meanLongitude + 6.289 * RAD * Math.sin(anomaly)
  const b = 5.128 * RAD * Math.sin(distance)
  const tilt = 23.4397 * RAD
  const ra = Math.atan2(
    Math.sin(l) * Math.cos(tilt) - Math.tan(b) * Math.sin(tilt),
    Math.cos(l),
  )
  const dec = Math.asin(
    Math.sin(b) * Math.cos(tilt) + Math.cos(b) * Math.sin(tilt) * Math.sin(l),
  )
  const sidereal = (280.16 + 360.9856235 * d) * RAD + lon * RAD

  const age = (((ms / DAY_MS + 2440587.5 - 2451550.1) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS

  return {
    ...horizontal(sidereal - ra, dec, lat),
    illumination: (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2,
    isWaxing: age < SYNODIC_DAYS / 2,
  }
}

// --- Calendar -------------------------------------------------------------

// Easter Sunday (the anonymous Gregorian algorithm).
export function easter(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)

  return {
    month: Math.floor((h + l - 7 * m + 114) / 31),
    day: ((h + l - 7 * m + 114) % 31) + 1,
  }
}

export type Occasion =
  | 'lucia'
  | 'christmas'
  | 'newYear'
  | 'midsummer'
  | 'halloween'
  | 'cinnamonBun'
  | 'semla'

export const OCCASION_WORDS: Record<Occasion, string> = {
  lucia: 'Lucia',
  christmas: 'Merry Christmas',
  newYear: 'Happy New Year',
  midsummer: 'Happy Midsummer',
  halloween: 'Halloween',
  cinnamonBun: 'Cinnamon Bun Day',
  semla: 'Semla Day',
}

function dayOfYear(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS)
}

export function occasionAt(time: LocalTime): Occasion | null {
  const { year, month, day, weekday, hour } = time
  if ((month === 12 && day === 31 && hour >= 20) || (month === 1 && day === 1 && hour < 2)) {
    return 'newYear'
  }
  if (month === 12 && day === 13) return 'lucia'
  if ((month === 12 && day >= 10) || (month === 1 && day <= 6)) return 'christmas'
  // Midsummer's Eve: the Friday from 19 to 25 June.
  if (month === 6 && day >= 19 && day <= 25 && weekday === 5) return 'midsummer'
  if (month === 10 && day === 31) return 'halloween'
  if (month === 10 && day === 4) return 'cinnamonBun'
  // Shrove Tuesday: 47 days before Easter Sunday.
  const { month: em, day: ed } = easter(year)
  if (dayOfYear(year, month, day) === dayOfYear(year, em, ed) - 47) return 'semla'

  return null
}

// How far through its day (sunrise to sunset) or its night (sunset to the
// next sunrise) the sky is, 0 to 1; null where the sun does not rise or set
// within a day and a half (a polar summer or winter).
export function dayArc(
  ms: number,
  lat = STOCKHOLM.lat,
  lon = STOCKHOLM.lon,
): { isDay: boolean; progress: number } | null {
  const isUp = (at: number) => sunAt(at, lat, lon).elevation > -0.83
  const isDay = isUp(ms)
  const step = 10 * 60_000
  // The moment the sun last (or next) crossed the horizon, to the minute.
  const crossing = (direction: 1 | -1): number | null => {
    let at = ms
    for (let i = 0; i < 216; i++) {
      const next = at + direction * step
      if (isUp(next) !== isDay) {
        let near = at
        let far = next
        while (Math.abs(far - near) > 60_000) {
          const middle = (near + far) / 2
          if (isUp(middle) === isDay) near = middle
          else far = middle
        }

        return near
      }
      at = next
    }

    return null
  }
  const start = crossing(-1)
  const end = crossing(1)
  if (start === null || end === null) return null

  return { isDay, progress: (ms - start) / Math.max(1, end - start) }
}
