// New York's clock and its market's hours: the offset with its summer
// time, NYSE's holidays and early closes by their rules, and whether the
// market is open at a moment. No source without a key says it, so it is
// worked out here.

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

// The nth (from 1) given weekday of a month, as a day of it; a negative n
// counts from the month's end.
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = new Date(Date.UTC(year, month - 1, days)).getUTCDay()

  return days - ((last - weekday + 7) % 7) + (n + 1) * 7
}

// New York's offset from UTC: summer time (UTC-4) from the second Sunday
// of March at 2:00 there (07:00 UTC) to the first Sunday of November at
// 2:00 there (06:00 UTC); UTC-5 otherwise.
export function newYorkOffsetMs(ms: number): number {
  const year = new Date(ms).getUTCFullYear()
  const from = Date.UTC(year, 2, nthWeekday(year, 3, 0, 2), 7)
  const to = Date.UTC(year, 10, nthWeekday(year, 11, 0, 1), 6)

  return (ms >= from && ms < to ? -4 : -5) * HOUR_MS
}

// Easter Sunday as [month, day], by the anonymous Gregorian computus.
function easter(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const g = Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3)
  const h = (19 * a + b - Math.floor(b / 4) - g + 15) % 30
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)

  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1]
}

// A fixed date's holiday as NYSE keeps it: on a Saturday the Friday
// before, on a Sunday the Monday after; as [month, day] of `year`, or null
// when it moved out of the year.
function observed(year: number, month: number, day: number): [number, number] | null {
  const at = Date.UTC(year, month - 1, day)
  const weekday = new Date(at).getUTCDay()
  const moved = new Date(at + (weekday === 6 ? -DAY_MS : weekday === 0 ? DAY_MS : 0))

  return moved.getUTCFullYear() === year ? [moved.getUTCMonth() + 1, moved.getUTCDate()] : null
}

// NYSE's holidays in a year, as [month, day], by its rules. New Year's Day
// on a Saturday is not moved to the Friday before: there is none that year.
function holidays(year: number): [number, number][] {
  const newYear = new Date(Date.UTC(year, 0, 1)).getUTCDay() === 6 ? null : observed(year, 1, 1)
  const [em, ed] = easter(year)
  const goodFriday = new Date(Date.UTC(year, em - 1, ed) - 2 * DAY_MS)

  return [
    newYear,
    [1, nthWeekday(year, 1, 1, 3)],
    [2, nthWeekday(year, 2, 1, 3)],
    [goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()],
    [5, nthWeekday(year, 5, 1, -1)],
    observed(year, 6, 19),
    observed(year, 7, 4),
    [9, nthWeekday(year, 9, 1, 1)],
    [11, nthWeekday(year, 11, 4, 4)],
    observed(year, 12, 25),
  ].filter((day): day is [number, number] => day !== null)
}

// When New York's market opens and closes on a day there, in hours, or
// null when it does not: weekends and NYSE's holidays. It closes at 13:00
// the day after Thanksgiving, and on Jul 3 and Dec 24 from Monday to
// Thursday. Unplanned closings are not known.
export function marketHoursOn(year: number, month: number, day: number): { opens: number; closes: number } | null {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  if (weekday === 0 || weekday === 6) return null
  if (holidays(year).some(([m, d]) => m === month && d === day)) return null
  const isMondayToThursday = weekday >= 1 && weekday <= 4
  const isEarly =
    (month === 11 && day === nthWeekday(year, 11, 4, 4) + 1) ||
    (isMondayToThursday && month === 7 && day === 3) ||
    (isMondayToThursday && month === 12 && day === 24)

  return { opens: 9.5, closes: isEarly ? 13 : 16 }
}

// The hour in New York with its minutes, 0 to 24.
export function newYorkHour(ms: number): number {
  const local = new Date(ms + newYorkOffsetMs(ms))

  return local.getUTCHours() + local.getUTCMinutes() / 60
}

// The day of the week in New York, 0 on Sunday: the person's own WEEKDAY
// may already be the next day, or still the one before.
export function newYorkWeekday(ms: number): number {
  return new Date(ms + newYorkOffsetMs(ms)).getUTCDay()
}

// Whether the day in New York is one its market trades on, all of it:
// a weekday that is not one of NYSE's holidays, early closes included.
export function newYorkTradingDay(ms: number): boolean {
  const local = new Date(ms + newYorkOffsetMs(ms))

  return marketHoursOn(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()) !== null
}

// Whether New York's market is open at a moment.
export function newYorkOpen(ms: number): boolean {
  const local = new Date(ms + newYorkOffsetMs(ms))
  const hours = marketHoursOn(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate())
  const hour = newYorkHour(ms)

  return hours !== null && hour >= hours.opens && hour < hours.closes
}
