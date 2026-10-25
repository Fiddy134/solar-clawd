import type { EngineInterface } from 'claude-code'

import type { Place } from './astro'
import { isPrintable } from './clawd'
import { elementsOf } from './iss'
import type { Elements } from './iss'
import { SKY_WORDS, skyOf } from './sky'
import type { Weather } from './sky'

// What the network says: where the computer is, the weather there, the
// aurora's Kp index and the ISS's elements; and the store's memory of them.

// A place guessed from the IP address is trusted this long before it is guessed again.
const GUESS_MS = 12 * 3_600_000

// $.store keys: a place the person chose, and the last guess with its time.
export const CHOSEN_PLACE = 'place'
export const GUESSED_PLACE = 'guessedPlace'
// The ISS's elements as last fetched: { fetchedAt, json }.
const ISS_ELEMENTS = 'iss'
const ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json'
// The ISS's elements are fetched at most this often.
export const ISS_MS = 86_400_000

type Json = Record<string, unknown>

export function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Json)[key] : undefined
}

export function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asPlace(value: unknown): Place | null {
  const name = field(value, 'name')
  const lat = number(field(value, 'lat'))
  const lon = number(field(value, 'lon'))

  // A name from the network goes into cells and replies: printable and short.
  return typeof name === 'string' && lat !== null && lon !== null ? { name: plain(name).slice(0, 40), lat, lon } : null
}

// The ISS's elements: as stored while under a day old, fetched again after,
// the stored ones kept should the network fail.
export async function issElements($: EngineInterface): Promise<Elements | null> {
  const now = await $.clock.now()
  const cached = (await $.store.get(ISS_ELEMENTS).catch(() => null)) as { fetchedAt?: unknown; json?: unknown } | null
  const stored = cached ? elementsOf(cached.json) : null
  if (stored && typeof cached?.fetchedAt === 'number' && now - cached.fetchedAt < ISS_MS) return stored
  const json = await getJson($, ISS_URL)
  const fresh = elementsOf(json)
  if (!fresh) return stored
  await $.store.set(ISS_ELEMENTS, { fetchedAt: now, json }).catch(() => undefined)

  return fresh
}

async function getJson($: EngineInterface, url: string): Promise<unknown> {
  try {
    const response = await $.http.fetch(url)

    return response.ok ? (JSON.parse(response.text) as unknown) : null
  } catch {
    return null
  }
}

// Where this machine seems to be, from its IP address: a town, roughly.
async function guessPlace($: EngineInterface): Promise<Place | null> {
  const info = await getJson($, 'https://ipinfo.io/json')
  const city = field(info, 'city')
  const [lat, lon] = String(field(info, 'loc') ?? '').split(',').map(Number)
  if (typeof city === 'string' && Number.isFinite(lat) && Number.isFinite(lon)) {
    return asPlace({ name: city, lat, lon })
  }

  const who = await getJson($, 'https://ipwho.is/')
  const fallback = {
    name: field(who, 'city'),
    lat: field(who, 'latitude'),
    lon: field(who, 'longitude'),
  }

  return field(who, 'success') === true ? asPlace(fallback) : null
}

export async function findPlace($: EngineInterface, name: string): Promise<Place | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=sv&format=json&name=${encodeURIComponent(name)}`
  const first = (field(await getJson($, url), 'results') as unknown[] | undefined)?.[0]

  return asPlace({
    name: field(first, 'name'),
    lat: field(first, 'latitude'),
    lon: field(first, 'longitude'),
  })
}

// The weather now and the place's UTC offset, which carries its summer time.
async function fetchWeather(
  $: EngineInterface,
  place: Place,
): Promise<{ weather: Weather; offsetMs: number } | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m&wind_speed_unit=ms&timezone=auto`
  const body = await getJson($, url)
  const current = field(body, 'current')
  const temperature = number(field(current, 'temperature_2m'))
  const code = number(field(current, 'weather_code'))
  const cloudCover = number(field(current, 'cloud_cover'))
  const wind = number(field(current, 'wind_speed_10m'))
  const offset = number(field(body, 'utc_offset_seconds'))
  if (temperature === null || code === null || cloudCover === null || wind === null || offset === null) {
    return null
  }

  return { weather: { temperature, code, cloudCover, wind }, offsetMs: offset * 1000 }
}

// The planetary Kp index (0 to 9) over the last few minutes, from NOAA.
async function fetchKp($: EngineInterface): Promise<number | null> {
  const rows = await getJson($, 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json')
  if (!Array.isArray(rows)) return null
  const recent = rows.slice(-10).map(row => number(field(row, 'estimated_kp')) ?? 0)

  return recent.length > 0 ? Math.max(...recent) : null
}

// Where the sky is and what it is doing there: Stockholm and Swedish time
// until a place and its weather come in.
export type Where = {
  place: Place
  isChosen: boolean
  weather: Weather | null
  offsetMs: number | undefined
  kp: number | null
  // When it last rained there, for a rainbow after.
  lastRainAt: number | null
}

export async function refreshWeather($: EngineInterface, where: Where): Promise<void> {
  const [fetched, kp] = await Promise.all([fetchWeather($, where.place), fetchKp($)])
  if (fetched) {
    where.weather = fetched.weather
    where.offsetMs = fetched.offsetMs
    const sky = skyOf(fetched.weather.code)
    if (sky === 'drizzle' || sky === 'rain' || sky === 'thunder') where.lastRainAt = await $.clock.now()
  }
  if (kp !== null) where.kp = kp
}

// A chosen place wins; else a recent guess; else a new guess.
export async function settlePlace($: EngineInterface, where: Where): Promise<void> {
  const chosen = asPlace(await $.store.get(CHOSEN_PLACE))
  where.isChosen = chosen !== null
  if (chosen) {
    where.place = chosen
  } else {
    const now = await $.clock.now()
    const cached = await $.store.get(GUESSED_PLACE)
    const guessed = asPlace(field(cached, 'place'))
    const at = number(field(cached, 'at')) ?? 0
    if (guessed && now - at < GUESS_MS) {
      where.place = guessed
    } else {
      const fresh = await guessPlace($)
      if (fresh) {
        where.place = fresh
        await $.store.set(GUESSED_PLACE, { place: fresh, at: now })
      }
    }
  }
  await refreshWeather($, where)
}

export function placeText({ place, isChosen, weather }: Where): string {
  const guessed = isChosen ? '' : ' (gissad från din IP-adress)'
  const now = weather ? `, ${Math.round(weather.temperature)}°C ${SKY_WORDS[skyOf(weather.code)]}` : ''

  return `${place.name}${guessed}${now}`
}

// Text as the band can draw it: one cell per printable character, so no
// control character from a track or a place name reaches the terminal.
export function plain(text: string): string {
  return [...text].map(ch => (isPrintable(ch.codePointAt(0)!) ? ch : '?')).join('')
}
