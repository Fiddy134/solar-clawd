// The market a theme can show (a trading floor's tape): BTC, ETH, the
// Nasdaq-100 and the seven largest of it, as Cboe's delayed quotes and
// Binance's public market data give them (New York's hours are newyork.ts's). Every
// session reads one shared snapshot (net.ts, refreshMarket) and shows it
// latched to the scene, so the shader's text changes with a price only when
// it changes anyway.

import { field, number } from './json'
import { SCENE_MS, SYMBOLS } from './shader'
import type { MarketSymbol } from './shader'

export { SYMBOLS }
export type { MarketSymbol }
const STOCKS = ['NDX', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'] as const

// The market is fetched at most this often; a quote had longer ago than
// FRESH_MS before the scene is no longer fresh.
export const MARKET_MS = 300_000
export const FRESH_MS = 900_000

// A price and its change over the day, in percent.
export type Price = { price: number; change: number }
// A price as the snapshot keeps it, with the moment it was had.
export type Quote = Price & { at: number }
export type Snapshot = { fetchedAt: number; quotes: Partial<Record<MarketSymbol, Quote>> }
// The shared file: the newest snapshot and the one before, so that a fetch
// inside a scene leaves the scene the snapshot it began with.
export type MarketFile = { previous: Snapshot | null; current: Snapshot | null }
// The market as a scene shows it: a price or nothing for each symbol, in
// SYMBOLS' order, and whether every price known is fresh.
export type Market = { quotes: (Price | null)[]; isFresh: boolean }

// Cboe's delayed quote for one of the stocks, or the index (_NDX: an
// index needs the underscore). The host answers directly; cdn.cboe.com
// would redirect to it.
export function cboeUrl(symbol: (typeof STOCKS)[number]): string {
  return `https://cdn-api.cboe.com/api/global/delayed_quotes/quotes/${symbol === 'NDX' ? '_NDX' : symbol}.json`
}

// BTC and ETH over the last 24 hours, both in one request, and Coinbase's
// for one of them should Binance not answer.
export const BINANCE_URL = 'https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D'
export function coinbaseUrl(coin: 'BTC' | 'ETH'): string {
  return `https://api.exchange.coinbase.com/products/${coin}-USD/stats`
}

// A price against a reference before it, as a change in percent; null for
// anything that is not two prices.
function priceOf(price: number | null, reference: number | null): Price | null {
  if (price === null || reference === null || price <= 0 || reference <= 0) return null

  return { price, change: (price / reference - 1) * 100 }
}

// Cboe's answer: the price now, after-hours trades in it, against the last
// regular close, so the tape agrees with itself.
export function cboeQuote(json: unknown): Price | null {
  const data = field(json, 'data')

  return priceOf(number(field(data, 'current_price')), number(field(data, 'prev_day_close')))
}

// A number Binance or Coinbase sends as a string.
function decimal(value: unknown): number | null {
  return typeof value === 'string' && value.trim() !== '' ? number(Number(value)) : null
}

// Binance's answer for both coins: the last price and its change over 24 hours.
export function binanceQuotes(json: unknown): Partial<Record<'BTC' | 'ETH', Price>> {
  const quotes: Partial<Record<'BTC' | 'ETH', Price>> = {}
  if (!Array.isArray(json)) return quotes
  for (const row of json) {
    const coin = ({ BTCUSDT: 'BTC', ETHUSDT: 'ETH' } as const)[String(field(row, 'symbol')) as 'BTCUSDT' | 'ETHUSDT']
    const price = decimal(field(row, 'lastPrice'))
    const change = decimal(field(row, 'priceChangePercent'))
    if (coin && price !== null && price > 0 && change !== null) quotes[coin] = { price, change }
  }

  return quotes
}

// Coinbase's stats: the last price against the one 24 hours before.
export function coinbaseQuote(json: unknown): Price | null {
  return priceOf(decimal(field(json, 'last')), decimal(field(json, 'open')))
}

// A new snapshot from what a fetch got; a symbol it missed keeps the quote
// it had, with the moment that was had, or has none.
export function merged(fetched: Partial<Record<MarketSymbol, Price>>, before: Snapshot | null, now: number): Snapshot {
  const quotes: Partial<Record<MarketSymbol, Quote>> = {}
  for (const symbol of SYMBOLS) {
    const got = fetched[symbol]
    const kept = before?.quotes[symbol]
    if (got) quotes[symbol] = { ...got, at: now }
    else if (kept) quotes[symbol] = kept
  }

  return { fetchedAt: now, quotes }
}

export function asSnapshot(value: unknown): Snapshot | null {
  const fetchedAt = number(field(value, 'fetchedAt'))
  if (fetchedAt === null) return null
  const quotes: Partial<Record<MarketSymbol, Quote>> = {}
  const given = field(value, 'quotes')
  for (const symbol of SYMBOLS) {
    const quote = field(given, symbol)
    const price = number(field(quote, 'price'))
    const change = number(field(quote, 'change'))
    const at = number(field(quote, 'at'))
    if (price !== null && change !== null && at !== null) quotes[symbol] = { price, change, at }
  }

  return { fetchedAt, quotes }
}

// The shared file as another session wrote it, trusting nothing of it.
export function asMarketFile(text: string): MarketFile {
  try {
    const value = JSON.parse(text) as unknown

    return { previous: asSnapshot(field(value, 'previous')), current: asSnapshot(field(value, 'current')) }
  } catch {
    return { previous: null, current: null }
  }
}

// The market a scene shows: the newest snapshot fetched before the scene
// began, the scene being the shader's grid (shaderParams rounds to it), so
// that the same snapshot holds all through it in every session reading the
// same file. Prices to five figures (a 32-bit float keeps them whole), the
// change to a hundredth of a percent. Null with nothing fetched yet.
export function marketAt(file: MarketFile, now: number): Market | null {
  const scene = Math.round(now / SCENE_MS) * SCENE_MS
  const begin = scene - SCENE_MS / 2
  const shown = [file.current, file.previous].find(snapshot => snapshot !== null && snapshot.fetchedAt <= begin) ?? null
  if (shown === null) return null
  const known = SYMBOLS.map(symbol => shown.quotes[symbol]).filter(quote => quote !== undefined)

  return {
    quotes: SYMBOLS.map(symbol => {
      const quote = shown.quotes[symbol]
      return quote ? { price: Number(quote.price.toPrecision(5)), change: Math.round(quote.change * 100) / 100 } : null
    }),
    isFresh: known.length > 0 && known.every(quote => scene - quote.at <= FRESH_MS),
  }
}
