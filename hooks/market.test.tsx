// The market a theme can show: the quotes as Cboe and Binance give them,
// New York's hours, the snapshot every session shares, and the shader's
// signals latched to the scene so a price never reloads a tab by itself.

import type { EngineInterface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { STOCKHOLM } from './astro'
import {
  asMarketFile,
  BINANCE_URL,
  binanceQuotes,
  cboeQuote,
  cboeUrl,
  coinbaseQuote,
  FRESH_MS,
  MARKET_MS,
  marketAt,
  merged,
  SYMBOLS,
} from './market'
import type { MarketFile, Snapshot } from './market'
import { marketHoursOn, newYorkOffsetMs, newYorkOpen, newYorkTradingDay, newYorkWeekday } from './newyork'
import { updateGhosttySky } from './ghostty'
import type { Ghostty, SkyExtras, SkyState } from './ghostty'
import { MARKET_STORE, refreshMarket } from './net'
import { SCENE_MS, shaderParams, skyShader, THEME_SIGNALS } from './shader'
import { longNight } from './themes/check'
import { BASE_THEME, THEMES } from './themes/index'

const FYR = THEMES[BASE_THEME]

// The answers the research saw on 2026-10-27 at 23:47 UTC, after New York's close.
const CBOE_NDX = { timestamp: '2026-10-27 23:47:50', data: { symbol: '^NDX', security_type: 'index', current_price: 29651.4414, price_change: 378.0414, price_change_percent: 1.2914, close: 29651.4414, prev_day_close: 29273.4004, last_trade_time: '2026-10-27T16:14:59' }, symbol: '^NDX' }
const CBOE_AAPL = { timestamp: '2026-10-27 23:47:58', data: { symbol: 'AAPL', security_type: 'stock', current_price: 347.28, price_change: 3.19, price_change_percent: 0.9276, open: 343.24, high: 347.78, low: 342.39, close: 347.1, prev_day_close: 343.91, last_trade_time: '2026-10-27T15:59:59', tick: 'down' } }
const BINANCE = [
  { symbol: 'BTCUSDT', priceChange: '810.09000000', priceChangePercent: '1.010', prevClosePrice: '80178.73000000', lastPrice: '80988.83000000', openPrice: '80178.74000000', openTime: 1793058415003, closeTime: 1793144815003 },
  { symbol: 'ETHUSDT', priceChangePercent: '1.237', lastPrice: '2353.00000000', openPrice: '2324.26000000' },
]
const COINBASE_BTC = { open: '80008.79', high: '81182', low: '79365.93', last: '80890.01' }

test("Cboe's and Binance's answers read as a price and the day's change, and anything else as nothing", () => {
  // The change is the price against the last close, after-hours trades in it.
  const ndx = cboeQuote(CBOE_NDX)!
  expect(ndx.price).toBe(29651.4414)
  expect(Math.abs(ndx.change - (29651.4414 / 29273.4004 - 1) * 100) < 1e-9).toBe(true)
  const aapl = cboeQuote(CBOE_AAPL)!
  expect(Math.abs(aapl.change - (347.28 / 343.91 - 1) * 100) < 1e-9).toBe(true)
  expect(cboeQuote(null)).toBeNull()
  expect(cboeQuote({ data: { current_price: 'x', prev_day_close: 1 } })).toBeNull()
  expect(cboeQuote({ data: { current_price: 10, prev_day_close: 0 } })).toBeNull()
  expect(cboeUrl('NDX')).toBe('https://cdn-api.cboe.com/api/global/delayed_quotes/quotes/_NDX.json')
  expect(cboeUrl('AAPL')).toBe('https://cdn-api.cboe.com/api/global/delayed_quotes/quotes/AAPL.json')
  // Binance sends its numbers as strings.
  expect(binanceQuotes(BINANCE)).toEqual({ BTC: { price: 80988.83, change: 1.01 }, ETH: { price: 2353, change: 1.237 } })
  expect(binanceQuotes([{ symbol: 'BTCUSDT', lastPrice: 'abc', priceChangePercent: '1' }])).toEqual({})
  expect(binanceQuotes({ code: -1121 })).toEqual({})
  expect(BINANCE_URL).toBe('https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D')
  const btc = coinbaseQuote(COINBASE_BTC)!
  expect(btc.price).toBe(80890.01)
  expect(Math.abs(btc.change - (80890.01 / 80008.79 - 1) * 100) < 1e-9).toBe(true)
  expect(coinbaseQuote({ message: 'NotFound' })).toBeNull()
})

test('a fetch that missed a symbol keeps its last quote, with the time it was had', () => {
  const before: Snapshot = { fetchedAt: 1000, quotes: { BTC: { price: 1, change: 1, at: 1000 }, TSLA: { price: 2, change: 2, at: 1000 } } }
  const after = merged({ BTC: { price: 3, change: 3 } }, before, 5000)
  expect(after).toEqual({ fetchedAt: 5000, quotes: { BTC: { price: 3, change: 3, at: 5000 }, TSLA: { price: 2, change: 2, at: 1000 } } })
  expect(merged({}, null, 5000)).toEqual({ fetchedAt: 5000, quotes: {} })
})

test('a market file another session wrote is read without trusting it', () => {
  const good: MarketFile = { previous: null, current: { fetchedAt: 5, quotes: { ETH: { price: 2353, change: 1.2, at: 5 } } } }
  expect(asMarketFile(JSON.stringify(good))).toEqual(good)
  expect(asMarketFile('')).toEqual({ previous: null, current: null })
  expect(asMarketFile('{"current": {"fetchedAt": "soon"}}')).toEqual({ previous: null, current: null })
  // A quote of the wrong shape, or a symbol not of ours, is left out.
  const odd = { current: { fetchedAt: 5, quotes: { ETH: { price: 'x', change: 1, at: 5 }, DOGE: { price: 1, change: 1, at: 5 }, BTC: { price: 9, change: -1, at: 5 } } } }
  expect(asMarketFile(JSON.stringify(odd)).current).toEqual({ fetchedAt: 5, quotes: { BTC: { price: 9, change: -1, at: 5 } } })
})

// A New York moment as UTC: the wall clock there, its offset found as Swedish time's is.
const ny = (year: number, month: number, day: number, hour: number, minute = 0) => {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  return guess - newYorkOffsetMs(guess - newYorkOffsetMs(guess))
}

test("New York keeps summer time from March's second Sunday to November's first, a week past Sweden's", () => {
  const HOUR = 3_600_000
  expect(newYorkOffsetMs(Date.UTC(2026, 9, 28, 12))).toBe(-4 * HOUR)
  expect(newYorkOffsetMs(Date.UTC(2026, 10, 1, 5, 59))).toBe(-4 * HOUR)
  expect(newYorkOffsetMs(Date.UTC(2026, 10, 1, 6, 0))).toBe(-5 * HOUR)
  expect(newYorkOffsetMs(Date.UTC(2027, 2, 14, 6, 59))).toBe(-5 * HOUR)
  expect(newYorkOffsetMs(Date.UTC(2027, 2, 14, 7, 0))).toBe(-4 * HOUR)
  expect(newYorkOffsetMs(Date.UTC(2026, 0, 15, 12))).toBe(-5 * HOUR)
})

test('the market is open 09:30 to 16:00 on a weekday in New York, and not on its weekends', () => {
  // This week: Sweden is on winter time and New York not yet.
  expect(newYorkOpen(ny(2026, 10, 28, 9, 29))).toBe(false)
  expect(newYorkOpen(ny(2026, 10, 28, 9, 30))).toBe(true)
  expect(newYorkOpen(Date.UTC(2026, 9, 28, 13, 30))).toBe(true)
  expect(newYorkOpen(ny(2026, 10, 28, 15, 59))).toBe(true)
  expect(newYorkOpen(ny(2026, 10, 28, 16, 0))).toBe(false)
  // The research's moment, 19:47 in New York.
  expect(newYorkOpen(Date.UTC(2026, 9, 27, 23, 47))).toBe(false)
  expect(newYorkOpen(ny(2026, 10, 31, 12))).toBe(false)
  expect(newYorkOpen(ny(2026, 11, 1, 12))).toBe(false)
  // Across the switch, the same New York hours.
  expect(newYorkOpen(ny(2026, 11, 2, 9, 30))).toBe(true)
  expect(newYorkOpen(Date.UTC(2026, 10, 2, 14, 29))).toBe(false)
  expect(newYorkOpen(Date.UTC(2026, 10, 2, 14, 30))).toBe(true)
  expect(newYorkOpen(ny(2027, 3, 15, 9, 30))).toBe(true)
  expect(newYorkOpen(ny(2027, 3, 15, 16, 0))).toBe(false)
})

test("New York's holidays and early closes are NYSE's own for 2026 to 2028", () => {
  const closed: Record<number, string[]> = {
    2026: ['01-01', '01-19', '02-16', '04-03', '05-25', '06-19', '07-03', '09-07', '11-26', '12-25'],
    2027: ['01-01', '01-18', '02-15', '03-26', '05-31', '06-18', '07-05', '09-06', '11-25', '12-24'],
    2028: ['01-17', '02-21', '04-14', '05-29', '06-19', '07-04', '09-04', '11-23', '12-25'],
  }
  const early: Record<number, string[]> = { 2026: ['11-27', '12-24'], 2027: ['11-26'], 2028: ['07-03', '11-24'] }
  for (const year of [2026, 2027, 2028]) {
    const holidays: string[] = []
    const earlies: string[] = []
    for (let day = Date.UTC(year, 0, 1); day < Date.UTC(year + 1, 0, 1); day += 86_400_000) {
      const d = new Date(day)
      const weekday = d.getUTCDay()
      const name = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const hours = marketHoursOn(year, d.getUTCMonth() + 1, d.getUTCDate())
      if (weekday === 0 || weekday === 6) expect(hours).toBeNull()
      else if (hours === null) holidays.push(name)
      else if (hours.closes === 13) earlies.push(name)
      else expect(hours).toEqual({ opens: 9.5, closes: 16 })
    }
    expect(holidays).toEqual(closed[year]!)
    expect(earlies).toEqual(early[year]!)
  }
  // An early close shuts at one.
  expect(newYorkOpen(ny(2026, 11, 27, 12, 59))).toBe(true)
  expect(newYorkOpen(ny(2026, 11, 27, 13, 0))).toBe(false)
  expect(newYorkOpen(ny(2026, 11, 26, 12))).toBe(false)
})

test("New York's weekday is its own, and a trading day is a weekday NYSE keeps, early closes too", () => {
  // Wednesday in New York, all day long, whatever the hour.
  expect(newYorkWeekday(ny(2026, 10, 28, 0, 1))).toBe(3)
  expect(newYorkWeekday(ny(2026, 10, 28, 23, 59))).toBe(3)
  // Past midnight in Sweden, still Monday evening in New York.
  const mondayEvening = ny(2026, 11, 2, 19)
  expect(new Date(mondayEvening).getUTCDay()).toBe(2)
  expect(newYorkWeekday(mondayEvening)).toBe(1)
  expect(newYorkTradingDay(mondayEvening)).toBe(true)
  // Every hour of a trading day, before the open and after the close too.
  for (const hour of [0, 8, 9.5, 12, 16, 23.5]) expect(newYorkTradingDay(ny(2026, 10, 28, Math.floor(hour), (hour % 1) * 60))).toBe(true)
  // Weekends and holidays are not; an early close is.
  expect(newYorkTradingDay(ny(2026, 10, 31, 12))).toBe(false)
  expect(newYorkTradingDay(ny(2026, 11, 1, 12))).toBe(false)
  expect(newYorkWeekday(ny(2026, 11, 26, 12))).toBe(4)
  expect(newYorkTradingDay(ny(2026, 11, 26, 12))).toBe(false)
  expect(newYorkTradingDay(ny(2026, 11, 27, 15))).toBe(true)
  expect(newYorkOpen(ny(2026, 11, 27, 15))).toBe(false)
  expect(newYorkTradingDay(ny(2027, 3, 26, 12))).toBe(false)
  // Each day of 2026 to 2028 is a trading day exactly when NYSE has hours for it.
  for (let day = Date.UTC(2026, 0, 1); day < Date.UTC(2029, 0, 1); day += 86_400_000) {
    const d = new Date(day)
    const noon = ny(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 12)
    expect(newYorkWeekday(noon)).toBe(d.getUTCDay())
    expect(newYorkTradingDay(noon)).toBe(marketHoursOn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) !== null)
  }
})

test("the shader carries New York's weekday and whether it trades that day, by the scene's clock", () => {
  for (const name of ['sky_NEW_YORK_WEEKDAY', 'sky_TRADING_DAY']) expect(THEME_SIGNALS).toContain(name)
  const at = (ms: number) => skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  // Wednesday 08:00 in New York, before the open: a trading day, not open yet.
  const early = at(ny(2026, 10, 28, 8))
  expect(early).toContain('const int sky_NEW_YORK_WEEKDAY = 3;')
  expect(early).toContain('const float sky_TRADING_DAY = 1.0;')
  expect(early).toContain('const float sky_MARKET_OPEN = 0.0;')
  // Thanksgiving: a Thursday that does not trade.
  const thanksgiving = at(ny(2026, 11, 26, 11))
  expect(thanksgiving).toContain('const int sky_NEW_YORK_WEEKDAY = 4;')
  expect(thanksgiving).toContain('const float sky_TRADING_DAY = 0.0;')
  // 01:00 on a Tuesday in Stockholm is Monday evening in New York.
  const late = at(Date.UTC(2026, 10, 3, 0))
  expect(late).toContain('const int WEEKDAY = 2;')
  expect(late).toContain('const int sky_NEW_YORK_WEEKDAY = 1;')
  expect(late).toContain('const float sky_TRADING_DAY = 1.0;')
  // A Saturday.
  const saturday = at(ny(2026, 10, 24, 16))
  expect(saturday).toContain('const int sky_NEW_YORK_WEEKDAY = 6;')
  expect(saturday).toContain('const float sky_TRADING_DAY = 0.0;')
})

// A scene's middle on the grid, and a snapshot fetched at `at`.
const SCENE = Math.round(Date.UTC(2026, 9, 28, 14, 31) / SCENE_MS) * SCENE_MS
const snapshot = (at: number, btc: number): Snapshot => ({ fetchedAt: at, quotes: { BTC: { price: btc, change: 1.234, at }, NDX: { price: 29651.4414, change: -2.5, at } } })

test('the market a scene shows is the newest snapshot fetched before the scene began, and stays so through it', () => {
  const begin = SCENE - SCENE_MS / 2
  const old = snapshot(begin - 200_000, 80_000)
  const fresh = snapshot(begin + 1_000, 81_000)
  // Fetched inside this scene: shown from the next one on.
  const file: MarketFile = { previous: old, current: fresh }
  expect(marketAt(file, SCENE)?.quotes[0]?.price).toBe(80_000)
  expect(marketAt(file, begin + 2_000)).toEqual(marketAt(file, SCENE + SCENE_MS / 2 - 1))
  expect(marketAt(file, SCENE + SCENE_MS)?.quotes[0]?.price).toBe(81_000)
  // Nothing fetched before the scene: no market yet.
  expect(marketAt({ previous: null, current: fresh }, SCENE)).toBeNull()
  expect(marketAt({ previous: null, current: null }, SCENE)).toBeNull()
  // Prices to five figures and the change to a hundredth, every symbol in its place.
  const shown = marketAt(file, SCENE)!
  expect(shown.quotes).toHaveLength(SYMBOLS.length)
  expect(shown.quotes[SYMBOLS.indexOf('NDX')]).toEqual({ price: 29651, change: -2.5 })
  expect(shown.quotes[0]).toEqual({ price: 80_000, change: 1.23 })
  expect(shown.quotes[SYMBOLS.indexOf('TSLA')]).toBeNull()
  // Fresh while every quote known was had in the last 15 minutes.
  expect(shown.isFresh).toBe(true)
  const stale = snapshot(SCENE - FRESH_MS - SCENE_MS, 80_000)
  expect(marketAt({ previous: null, current: stale }, SCENE)!.isFresh).toBe(false)
})

test("the shader's market signals: quotes in a fixed order, unknown as 0, New York's hour and whether its market is open", () => {
  expect(SYMBOLS).toEqual(['BTC', 'ETH', 'NDX', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'])
  const names = ['sky_QUOTE_COUNT', ...SYMBOLS.map(s => `sky_${s}`), 'sky_QUOTE_PRICE', 'sky_QUOTE_CHANGE', 'sky_QUOTES_FRESH', 'sky_MARKET_OPEN', 'sky_NEW_YORK_HOUR']
  for (const name of names) expect(THEME_SIGNALS).toContain(name)
  const file: MarketFile = { previous: null, current: snapshot(SCENE - SCENE_MS, 101_234.5) }
  const open = Date.UTC(2026, 9, 28, 15, 30)
  const text = skyShader(shaderParams({ ms: open, t: 0, place: STOCKHOLM, weather: null }, { market: marketAt(file, SCENE) }), FYR)
  expect(text).toContain('const int sky_QUOTE_COUNT = 10;')
  expect(text).toContain('const int sky_BTC = 0;')
  expect(text).toContain('const int sky_TSLA = 9;')
  expect(text).toContain('const float sky_QUOTE_PRICE[10] = float[10](101230.0, 0.0, 29651.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);')
  expect(text).toContain('const float sky_QUOTE_CHANGE[10] = float[10](1.23, 0.0, -2.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);')
  expect(text).toContain('const float sky_QUOTES_FRESH = 1.0;')
  expect(text).toContain('const float sky_MARKET_OPEN = 1.0;')
  expect(text).toContain('const float sky_NEW_YORK_HOUR = 11.5;')
  // No market: every price unknown, nothing fresh; the clock goes on.
  const none = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 27, 23, 47), t: 0, place: STOCKHOLM, weather: null }, {}), FYR)
  expect(none).toContain('const float sky_QUOTE_PRICE[10] = float[10](0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);')
  expect(none).toContain('const float sky_QUOTES_FRESH = 0.0;')
  expect(none).toContain('const float sky_MARKET_OPEN = 0.0;')
  expect(none).toContain('const float sky_NEW_YORK_HOUR = 19.8')
  // The long night the caps are measured on carries a full market.
  expect(skyShader(longNight(), FYR)).not.toContain('float[10](0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)')
})

test('through one scene the shader is the same text whatever is fetched, so a price never reloads a tab by itself', () => {
  const begin = SCENE - SCENE_MS / 2
  const before: MarketFile = { previous: null, current: snapshot(begin - 300_000, 80_000) }
  // Another session fetches in the middle of the scene.
  const after: MarketFile = { previous: before.current, current: snapshot(SCENE, 99_000) }
  const text = (file: MarketFile, now: number) => skyShader(shaderParams({ ms: now, t: 0, place: STOCKHOLM, weather: null }, { market: marketAt(file, now) }), FYR)
  expect(text(after, SCENE + 30_000)).toBe(text(before, begin + 1))
  expect(text(after, SCENE + SCENE_MS)).toContain('99000.0')
})

// The engine as the market's functions use it, in memory: files, a mv, a
// store, a clock, and the network answering as `answer` says.
function fakeEngine(start: number, answer: (url: string) => unknown, store: Record<string, unknown> = {}) {
  const files = new Map<string, string>()
  const writes: string[] = []
  const fetched: string[] = []
  const runs: string[][] = []
  const clock = { now: start }
  const ok = { exitCode: 0, stdout: '', stderr: '' }
  const $ = {
    clock: { now: async () => clock.now },
    fs: {
      read: async (path: string) => {
        if (!files.has(path)) throw new Error('ENOENT')
        return files.get(path)!
      },
      write: async (path: string, text: string) => {
        files.set(path, text)
        writes.push(path)
      },
      exists: async (path: string) => files.has(path),
      list: async () => [],
    },
    process: {
      run: async (argv: string[]) => {
        runs.push(argv)
        if (argv[0] === '/bin/mv') {
          const [from, to] = argv.slice(-2) as [string, string]
          files.set(to, files.get(from)!)
          files.delete(from)
        }
        return ok
      },
    },
    store: { get: async (key: string) => store[key] ?? null, set: async (key: string, value: unknown) => void (store[key] = value) },
    http: {
      fetch: async (url: string) => {
        fetched.push(url)
        const json = answer(url)
        if (json === undefined) throw new Error('offline')
        return json === null ? { status: 403, ok: false, headers: {}, text: '<Error>AccessDenied</Error>' } : { status: 200, ok: true, headers: {}, text: JSON.stringify(json) }
      },
    },
  } as unknown as EngineInterface

  return { $, files, writes, fetched, runs, store, clock, file: () => asMarketFile(files.get(MARKET_FILE) ?? '') }
}

const MARKET_FILE = '/runtime/market.json'
// What the network answers: the research's answers, Coinbase for both
// coins, a 403 for a symbol Cboe has not here; Binance and everything
// down as asked.
const network = (up = { binance: true, all: true }) => (url: string) => {
  if (!up.all) return undefined
  if (url === BINANCE_URL) return up.binance ? BINANCE : undefined
  if (url.includes('coinbase')) return COINBASE_BTC
  if (url.endsWith('/_NDX.json')) return CBOE_NDX
  if (url.endsWith('/AAPL.json')) return CBOE_AAPL
  return null
}

test('the market is fetched at most every five minutes into the shared file, written whole, and kept in the store', async () => {
  const world = fakeEngine(Date.UTC(2026, 9, 28, 14, 0), network())
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  // Cboe for each of the eight, Binance once for both coins; no fallback needed.
  expect(world.fetched.filter(url => url.includes('cboe'))).toHaveLength(8)
  expect(world.fetched.filter(url => url === BINANCE_URL)).toHaveLength(1)
  expect(world.fetched.some(url => url.includes('coinbase'))).toBe(false)
  const first = world.file()
  expect(first.previous).toBeNull()
  expect(Object.keys(first.current!.quotes).sort()).toEqual(['AAPL', 'BTC', 'ETH', 'NDX'])
  expect(world.store[MARKET_STORE]).toEqual(first.current)
  expect(world.writes).not.toContain(MARKET_FILE)

  world.clock.now += MARKET_MS - 1_000
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  expect(world.fetched).toHaveLength(9)
  world.clock.now += 1_000
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  expect(world.fetched).toHaveLength(18)
  expect(world.file().previous).toEqual(first.current)
})

test('Binance down: Coinbase for the coins; everything down: the last snapshot stays and nothing throws', async () => {
  const up = { binance: false, all: true }
  const world = fakeEngine(Date.UTC(2026, 9, 28, 14, 0), network(up))
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  const first = world.file().current!
  expect(first.quotes.BTC?.price).toBe(80890.01)
  expect(first.quotes.ETH?.price).toBe(80890.01)

  up.all = false
  world.clock.now += MARKET_MS
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  expect(world.file().current).toEqual(first)
  // The store failing too, still nothing thrown.
  ;(world.$.store as { get: unknown }).get = async () => {
    throw new Error('no store')
  }
  world.files.clear()
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  expect(world.files.size).toBe(0)
})

test('a session started without the shared file begins it from the store, its age kept', async () => {
  const now = Date.UTC(2026, 9, 28, 14, 0)
  const kept: Snapshot = { fetchedAt: now - 60_000, quotes: { BTC: { price: 1, change: 2, at: now - 60_000 } } }
  const world = fakeEngine(now, network(), { [MARKET_STORE]: kept })
  await refreshMarket(world.$, MARKET_FILE, 'this-session')
  expect(world.fetched).toHaveLength(0)
  expect(world.file()).toEqual({ previous: null, current: kept })
})

// A Ghostty session on the shared runtime folder, as register.tsx makes one
// for a theme that shows prices.
const ghosttyOf = (id: string): Ghostty => ({
  id,
  folder: '/runtime',
  include: '/runtime/solar-clawd.ghostty',
  shader: '/runtime/sky.glsl',
  heartbeat: `/runtime/alive-${id}`,
  waiting: `/runtime/waiting-${id}`,
  hidden: '/runtime/hidden',
  settings: '/sky.json',
  vsync: '/runtime/vsync.ghostty',
  text: '/runtime/text.ghostty',
  uid: 501,
  market: MARKET_FILE,
  version: [1, 2],
  home: '/home',
  tty: null,
  configs: [],
  isLinux: false,
  stagePt: 240,
  stagePx: 240,
  knowsReloadSignal: false,
  isIncluded: true,
  ticks: null,
  written: { shader: '', include: '', mark: '', marking: null, heartbeatAt: -Infinity, isReloadOwed: false, isEnded: false, isTicking: false, canTick: false, running: null, isAgain: false },
})
const state = (): SkyState => ({ idleMs: 1000, isOnBattery: false, isGhosttyInFront: true, pace: 'spar', waiting: null, catchAt: () => null, workAt: () => ({ tool: 'none', agents: 0 }), livelyAt: () => false })
const shaderAt = (now: number, extras: SkyExtras) => skyShader(shaderParams({ ms: now, t: 0, place: STOCKHOLM, weather: null }, extras), FYR)

test('two sessions on one market file draw the same prices, and a fetch inside a scene reloads nothing', async () => {
  const world = fakeEngine(SCENE - SCENE_MS / 2 + 1_000, network())
  const reloads = () => world.runs.filter(argv => argv.join(' ').includes('reload_config')).length
  const [a, b] = [ghosttyOf('a'), ghosttyOf('b')]
  await refreshMarket(world.$, MARKET_FILE, 'a')
  // The first scene after the fetch shows its prices, in both.
  world.clock.now += SCENE_MS
  await updateGhosttySky(world.$, a, shaderAt, state)
  await updateGhosttySky(world.$, b, shaderAt, state)
  const shown = world.files.get('/runtime/sky.glsl')!
  expect(shown).toContain('const float sky_QUOTE_PRICE[10] = float[10](80989.0, 2353.0, 29651.0, 347.28,')
  expect(a.written.shader).toBe(b.written.shader)
  const before = reloads()
  // Five minutes on another session fetches new prices in the middle of a scene.
  world.clock.now += MARKET_MS
  await updateGhosttySky(world.$, a, shaderAt, state)
  const scene = world.files.get('/runtime/sky.glsl')!
  CBOE_NDX.data.current_price = 30_000
  await refreshMarket(world.$, MARKET_FILE, 'b')
  CBOE_NDX.data.current_price = 29651.4414
  world.clock.now += 10_000
  await updateGhosttySky(world.$, a, shaderAt, state)
  await updateGhosttySky(world.$, b, shaderAt, state)
  expect(world.files.get('/runtime/sky.glsl')).toBe(scene)
  expect(a.written.shader).toBe(b.written.shader)
  // One reload for the new scene, none for the fetch.
  expect(reloads() - before).toBe(1)
  world.clock.now += SCENE_MS
  await updateGhosttySky(world.$, b, shaderAt, state)
  expect(world.files.get('/runtime/sky.glsl')).toContain('30000.0')
})
