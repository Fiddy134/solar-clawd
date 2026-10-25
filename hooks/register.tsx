import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { localMidnight, STOCKHOLM } from './astro'
import type { Place } from './astro'
import { drawFrame, isPrintable, nextPassing, REACTION_SECONDS, ROWS, skyGained, THROW_SECONDS, toolKind, workKind } from './clawd'
import { contextAt, EVENT_WORDS, eventsAt, PREVIEW_MS, showerAt, shootingRate } from './events'
import type { EventKind, Forced } from './events'
import type { Mode, Reaction } from './clawd'
import { fromBase64 } from './paint'
import { shaderParams, skyShader } from './shader'
import type { ShaderParams } from './shader'
import { staleFiles } from './tidy'
import { animationOf, beaconAt } from './beacon'
import { elementsOf, issVisible } from './iss'
import type { Elements } from './iss'
import type { Waiting } from './beacon'
import { SKY_WORDS, skyOf, wallpaperPng } from './sky'
import type { MoonTexture, WallpaperCache, Weather } from './sky'

const isHidden = atom({ plugin: 'solar-clawd', key: 'isHidden' } as const, false)

const KEY = 'sky'
// The moon's texture, baked by tools/bake-moon.sh.
const MOON_SIZE = 256
// Pixels per point of the window: Retina.
const BACKING_SCALE = 2
// Eight frames a second: Clawd's sprites step, they do not glide.
const TICK_MS = 125
// A whole day in this long, for /solar demo.
const DEMO_MS = 48_000
// Narrower than this and the scene goes away rather than squeezing.
const MIN_COLUMNS = 34
// How often iTerm2's wallpaper moves its clouds on while the person is at
// it (the still sky behind them is painted once a minute), faster in the
// time-lapse; and how often the still sky is brought up to date otherwise.
const WALLPAPER_MS = 3_000
const DEMO_WALLPAPER_MS = 1_500
const IDLE_WALLPAPER_MS = 5 * 60_000
// How often the person's idleness (and iTerm2 being in front) is asked.
const ACTIVITY_MS = 3_000
// Weather and aurora are asked for this often, music this often; a place
// guessed from the IP address is trusted this long before it is guessed again.
const WEATHER_MS = 15 * 60_000
const MUSIC_MS = 10_000
// How long /solar bränn plays the wastebasket's fire.
const BURN_SHOWN_MS = 8_000
// How often the context window's fill is asked (it costs nothing), for the
// pile of paper by Clawd.
const PAPER_MS = 30_000
const GUESS_MS = 12 * 3_600_000

// Ghostty draws the sky itself, from a shader the mod writes into its
// runtime folder. Ghostty's config includes runtime/solar-clawd.ghostty,
// which names the shader while the sky is up and is empty otherwise; each
// change is followed by a reload, which Ghostty takes without a flicker.
const RELOAD_GHOSTTY = [
  '-e',
  'tell application id "com.mitchellh.ghostty" to perform action "reload_config" on focused terminal of selected tab of front window',
]
// How often the sky is looked at: a new scene, the person away or back.
const SKY_MS = 10_000
// Away after this long without a key or the mouse: the sky stands still,
// and with it Ghostty's frame loop, until the person is back.
const AWAY_MS = 5 * 60_000
// Each Ghostty session leaves a heartbeat this often; one older than
// ALIVE_MS is a session gone.
const HEARTBEAT_MS = 60_000
const ALIVE_MS = 5 * 60_000
// How often to ask whether the Mac runs on battery.
const BATTERY_MS = 60_000

// A turn of Claude's this long earns confetti when it is done.
const MILESTONE_MS = 3 * 60_000

// $.store keys: a place the person chose, and the last guess with its time.
const CHOSEN_PLACE = 'place'
const GUESSED_PLACE = 'guessedPlace'
// The ISS's elements as last fetched: { fetchedAt, json }.
const ISS_ELEMENTS = 'iss'
const ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json'
// Elements are fetched at most this often, and the sky follows a pass this often.
const ISS_MS = 86_400_000
const ISS_TICK_MS = 2_000

// Sets (or, given an empty path, clears) the background image of the one
// iTerm2 session whose id is the first argument, and answers the size of its
// window in points: "ok <width> <height>".
const SET_BACKGROUND = [
  'on run argv',
  'set targetId to item 1 of argv',
  'set imagePath to item 2 of argv',
  'tell application id "com.googlecode.iterm2"',
  'repeat with w in windows',
  'repeat with t in tabs of w',
  'repeat with s in sessions of t',
  'if (id of s) is targetId then',
  'set background image of s to imagePath',
  'set b to bounds of w',
  'return "ok " & ((item 3 of b) - (item 1 of b)) & " " & ((item 4 of b) - (item 2 of b)) & " " & (frontmost as text)',
  'end if',
  'end repeat',
  'end repeat',
  'end repeat',
  'end tell',
  'return "missing"',
  'end run',
].flatMap(line => ['-e', line])

// Whether iTerm2 is the app in front.
const ITERM_FRONTMOST = ['-e', 'tell application id "com.googlecode.iterm2" to return frontmost as text']

// "title - artist" of what Spotify or Music plays, or nothing. Neither app is
// started: each is asked only while it already runs, through `run script`
// so its terms are not looked up unless it does.
const NOW_PLAYING = [
  'set out to ""',
  'try',
  'repeat with appId in {"com.spotify.client", "com.apple.Music"}',
  'if out is "" and application id appId is running then',
  'set out to run script "tell application id \\"" & appId & "\\"\nif player state is playing then return name of current track & \\" - \\" & artist of current track\nreturn \\"\\"\nend tell"',
  'end if',
  'end repeat',
  'end try',
  'return out',
].flatMap(line => ['-e', line])

type Json = Record<string, unknown>

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Json)[key] : undefined
}

function number(value: unknown): number | null {
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
async function issElements($: EngineInterface): Promise<Elements | null> {
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

async function findPlace($: EngineInterface, name: string): Promise<Place | null> {
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
type Where = {
  place: Place
  isChosen: boolean
  weather: Weather | null
  offsetMs: number | undefined
  kp: number | null
  // When it last rained there, for a rainbow after.
  lastRainAt: number | null
}

async function refreshWeather($: EngineInterface, where: Where): Promise<void> {
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
async function settlePlace($: EngineInterface, where: Where): Promise<void> {
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

function placeText({ place, isChosen, weather }: Where): string {
  const guessed = isChosen ? '' : ' (gissad från din IP-adress)'
  const now = weather ? `, ${Math.round(weather.temperature)}°C ${SKY_WORDS[skyOf(weather.code)]}` : ''

  return `${place.name}${guessed}${now}`
}

// Text as the band can draw it: one cell per printable character, so no
// control character from a track or a place name reaches the terminal.
function plain(text: string): string {
  return [...text].map(ch => (isPrintable(ch.codePointAt(0)!) ? ch : '?')).join('')
}

// How full the context window is, 0 to 100, for Clawd's pile of paper;
// null when it could not say.
async function contextFill($: EngineInterface): Promise<number | null> {
  const usage = await $.session.usage().catch(() => null)

  return usage?.context.percent ?? null
}

// Whether the session runs on Linux, as uname says; anything it does not
// say plainly counts as the Mac.
async function isLinuxHost($: EngineInterface): Promise<boolean> {
  const answer = await $.process.run(['uname', '-s'], { timeoutMs: 5_000 }).catch(() => null)

  return answer?.stdout.trim() === 'Linux'
}

// Whether the computer runs on battery: on battery the Ghostty sky stands
// still. Anything pmset (or Linux's power supplies) does not say plainly
// counts as mains power.
async function isOnBattery($: EngineInterface, isOnLinux: boolean): Promise<boolean> {
  try {
    if (isOnLinux) {
      const { stdout } = await $.process.run(['sh', '-c', 'cat /sys/class/power_supply/*/status 2>/dev/null'], { timeoutMs: 5_000 })

      return stdout.split('\n').some(line => line.trim() === 'Discharging')
    }
    const { stdout } = await $.process.run(['/usr/bin/pmset', '-g', 'batt'], { timeoutMs: 5_000 })

    return stdout.includes("'Battery Power'")
  } catch {
    return false
  }
}

// How long since the person last touched a key or the mouse; null on
// Linux, which has no one way to ask.
async function idleMs($: EngineInterface, isOnLinux: boolean): Promise<number | null> {
  if (isOnLinux) return null
  try {
    const { stdout } = await $.process.run(['/usr/sbin/ioreg', '-c', 'IOHIDSystem', '-d', '4'], { timeoutMs: 5_000 })
    const ns = /"HIDIdleTime" = (\d+)/.exec(stdout)?.[1]

    return ns ? Number(ns) / 1e6 : null
  } catch {
    return null
  }
}

// Whether Ghostty is the app in front, as lsappinfo says (it needs no
// permissions); null when it could not say, as on Linux.
async function isGhosttyInFront($: EngineInterface, isOnLinux: boolean): Promise<boolean | null> {
  if (isOnLinux) return null
  try {
    const { stdout: front } = await $.process.run(['/usr/bin/lsappinfo', 'front'], { timeoutMs: 5_000 })
    if (front.trim() === '') return null
    const { stdout } = await $.process.run(['/usr/bin/lsappinfo', 'info', '-only', 'bundleid', front.trim()], { timeoutMs: 5_000 })
    const id = /bundleID="([^"]+)"/.exec(stdout)?.[1]

    return id ? id === 'com.mitchellh.ghostty' : null
  } catch {
    return null
  }
}

// Ghostty's config files, the one to add the include to first: on macOS
// Application Support before ~/.config, on Linux only the XDG folder.
function ghosttyConfigs(home: string, isOnLinux: boolean, xdgConfig: string | null): string[] {
  const xdg = `${xdgConfig ?? `${home}/.config`}/ghostty`
  if (isOnLinux) return [`${xdg}/config.ghostty`, `${xdg}/config`]
  const support = `${home}/Library/Application Support/com.mitchellh.ghostty`

  return [`${support}/config.ghostty`, `${support}/config`, `${xdg}/config.ghostty`, `${xdg}/config`]
}

// Where a Ghostty session keeps the sky's files, and what it last wrote:
// the shader, the include, the heartbeat's time.
type Ghostty = {
  // This session's id, which its heartbeat and its temp files are named by.
  id: string
  folder: string
  include: string
  shader: string
  heartbeat: string
  // What this session waits on the person for, while it does: other
  // sessions read it, so any of their skies lights the lighthouse.
  waiting: string
  // Present while the sky is hidden: /solar in any session hides it for all.
  hidden: string
  home: string
  configs: string[]
  isLinux: boolean
  // Whether Ghostty is new enough to reload on SIGUSR2 (Linux only).
  knowsReloadSignal: boolean
  // Whether Ghostty's config includes the mod's file, asked each minute.
  isIncluded: boolean
  written: {
    shader: string
    include: string
    heartbeatAt: number
    // A change Ghostty has not yet reloaded for: tried again each tick.
    isReloadOwed: boolean
    // Set as the session ends: no tick writes after it.
    isEnded: boolean
    // The update under way, which the session's end waits on, and whether
    // something changed while it ran, so it runs again.
    running: Promise<void> | null
    isAgain: boolean
  }
}

// Whether one of Ghostty's config files includes the mod's file, on a line
// of its own (a commented-out line does not count).
async function isIncluded($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
  for (const path of ghostty.configs) {
    const text = await $.fs.read(path).catch(() => '')
    const lines = text.split('\n').map(line => line.trim().replace(/^config-file\s*=\s*\??/, ''))
    if (text.split('\n').some((line, i) => /^config-file\s*=/.test(line.trim()) && lines[i] === ghostty.include)) return true
  }

  return false
}

// Removes what crashed sessions left in `folder`; `keep` is this session's.
async function tidy($: EngineInterface, folder: string, keep: string[]): Promise<void> {
  const now = await $.clock.now()
  const entries = await $.fs.list(folder).catch(() => [])
  const paths = staleFiles(entries, folder, now, keep)
  if (paths.length > 0) await $.process.run(['/bin/rm', '-f', ...paths]).catch(() => undefined)
}

// Ghostty's config, and with it the shader, is one for every tab and
// window. A session marks its own tab instead: palette colour 16 (black,
// in the colour cube) one step off, which no one sees and the shader looks
// for, so the sky shows only where Claude runs. Written to the session's
// own terminal: the tty of the process the mod's commands run under.
const MARK_TAB = '\x1b]4;16;rgb:00/00/01\x1b\\'
const UNMARK_TAB = '\x1b]104;16\x1b\\'
async function markTab($: EngineInterface, sequence: string): Promise<void> {
  const script = 'tty=$(ps -o tty= -p $PPID | tr -d " "); case "$tty" in ""|"?"*) exit 1;; esac; printf "%s" "$1" > "/dev/$tty"'
  await $.process.run(['sh', '-c', script, 'sh', sequence], { timeoutMs: 5_000 }).catch(() => undefined)
}

// Whether Ghostty took the reload. On Linux Ghostty reloads on SIGUSR2:
// through systemd while it runs as its service, else sent to it straight,
// but only to a Ghostty new enough to know the signal (to an older one it
// is the end).
async function reloadGhostty($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
  try {
    if (ghostty.isLinux) {
      const service = await $.process
        .run(['systemctl', '--user', 'reload', 'app-com.mitchellh.ghostty.service'], { timeoutMs: 5_000 })
        .catch(() => null)
      if (service?.exitCode === 0) return true
      if (!ghostty.knowsReloadSignal) return false
      const { exitCode } = await $.process.run(['pkill', '-USR2', '-x', 'ghostty'], { timeoutMs: 5_000 })

      return exitCode === 0
    }
    const { exitCode } = await $.process.run(['/usr/bin/osascript', ...RELOAD_GHOSTTY], { timeoutMs: 5_000 })

    return exitCode === 0
  } catch {
    return false
  }
}

// Whether the Ghostty on the PATH is 1.3 or later.
async function ghosttyKnowsReloadSignal($: EngineInterface): Promise<boolean> {
  const answer = await $.process.run(['ghostty', '--version'], { timeoutMs: 5_000 }).catch(() => null)
  const [major = 0, minor = 0] = (/Ghostty (\d+)\.(\d+)/.exec(answer?.stdout ?? '') ?? []).slice(1).map(Number)

  return major > 1 || (major === 1 && minor >= 3)
}

// Writes `text` to a file of this session's own beside `path`, then moves it
// into place: Ghostty, reloading at any moment, never reads half a file.
async function writeWhole($: EngineInterface, path: string, text: string, id: string): Promise<void> {
  const temp = `${path}.tmp-${id}`
  await $.fs.write(temp, text)
  const { exitCode } = await $.process.run(['/bin/mv', '-f', temp, path])
  if (exitCode !== 0) throw new Error(`mv exited ${exitCode}`)
}

// What the Ghostty sky depends on besides the time: whether the person is
// away, whether the Mac runs on battery, and what this session waits on the
// person for.
type SkyState = { isAway: boolean; isOnBattery: boolean; waiting: Waiting | null }

// What the session's shader is asked to draw beyond the scene.
type SkyExtras = { beacon: { mode: 'asking' | 'done'; isUrgent: boolean } | null }

// The sky in Ghostty as it should be now: `shaderAt`'s shader while the
// sky is not hidden, nothing otherwise, and Ghostty animating it as the
// lighthouse, the battery and the person's being away say. Ghostty
// reloads only when a file actually changed.
//
// Every session wants the same on or off (the hidden file and the person's
// idleness are shared), so the include is checked against the disk and put
// right whoever changed it. The shader's text is this session's own: it is
// written when it changes here, the last session to change it winning.
// One update at a time, again if asked for while one ran, and none once the
// session has ended.
async function updateGhosttySky(
  $: EngineInterface,
  ghostty: Ghostty,
  shaderAt: (now: number, extras: SkyExtras) => string,
  state: () => SkyState,
): Promise<void> {
  const { written } = ghostty
  if (written.isEnded) return
  if (written.running !== null) {
    written.isAgain = true
    return
  }
  do {
    written.isAgain = false
    written.running = writeGhosttySky($, ghostty, shaderAt, state())
    try {
      await written.running
    } finally {
      written.running = null
    }
  } while (written.isAgain && !written.isEnded)
}

// What other live sessions wait on the person for: their waiting files,
// counted only while their heartbeat is fresh.
async function othersWaiting($: EngineInterface, ghostty: Ghostty, now: number): Promise<Waiting[]> {
  const entries = await $.fs.list(ghostty.folder).catch(() => [])
  const own = ghostty.waiting.slice(ghostty.folder.length + 1)
  const alive = new Map(entries.filter(entry => entry.name.startsWith('alive-')).map(entry => [entry.name.slice(6), entry.mtimeMs]))
  const waits: Waiting[] = []
  for (const entry of entries) {
    if (!entry.name.startsWith('waiting-') || entry.name === own) continue
    const beat = alive.get(entry.name.slice(8))
    if (beat === undefined || now - beat >= ALIVE_MS) continue
    const wait = asWaiting(await $.fs.read(`${ghostty.folder}/${entry.name}`).catch(() => ''))
    if (wait) waits.push(wait)
  }

  return waits
}

function asWaiting(text: string): Waiting | null {
  try {
    const value = JSON.parse(text) as unknown
    const mode = field(value, 'mode')
    const since = number(field(value, 'since'))

    return (mode === 'asking' || mode === 'done') && since !== null ? { mode, since } : null
  } catch {
    return null
  }
}

// The notifications that ask the person something.
const ASKING = ['permission_prompt', 'elicitation_dialog']

// Shares a change in what this session waits on the person for, and
// updates the sky for it at once.
async function shareWaiting($: EngineInterface, ghostty: Ghostty | null, waiting: Waiting | null, refresh: (() => void) | null): Promise<void> {
  if (ghostty === null) return
  await writeWaiting($, ghostty, waiting).catch(() => undefined)
  refresh?.()
}

// Writes what this session waits on the person for where others read it,
// or takes it away.
async function writeWaiting($: EngineInterface, ghostty: Ghostty, waiting: Waiting | null): Promise<void> {
  if (waiting) await $.fs.write(ghostty.waiting, JSON.stringify(waiting))
  else await $.process.run(['/bin/rm', '-f', ghostty.waiting]).catch(() => undefined)
}

async function writeGhosttySky(
  $: EngineInterface,
  ghostty: Ghostty,
  shaderAt: (now: number, extras: SkyExtras) => string,
  state: SkyState,
): Promise<void> {
  const { written } = ghostty
  const now = await $.clock.now()
  if (now - written.heartbeatAt >= HEARTBEAT_MS) {
    // Again each minute: a `reset` in the tab would have cleared it.
    await markTab($, MARK_TAB)
    await $.fs.write(ghostty.heartbeat, String(now))
    written.heartbeatAt = now
    ghostty.isIncluded = await isIncluded($, ghostty)
  }
  const waits = [...(state.waiting ? [state.waiting] : []), ...(await othersWaiting($, ghostty, now))]
  const beacon = beaconAt(waits, now)
  const isHidden = await $.fs.exists(ghostty.hidden).catch(() => false)
  const isWanted = !isHidden
  let include = ''
  if (isWanted) {
    const extras = { beacon: beacon && { mode: beacon.mode, isUrgent: beacon.isUrgent } }
    // Against the disk, not what this session last wrote: another session
    // may have written the same (no reload) or something else (put right).
    const shader = shaderAt(now, extras)
    if (shader !== (await $.fs.read(ghostty.shader).catch(() => null))) {
      await writeWhole($, ghostty.shader, shader, ghostty.id)
      written.isReloadOwed = true
    }
    written.shader = shader
    const animation = animationOf({ beacon, now, isAway: state.isAway, isOnBattery: state.isOnBattery })
    include = `custom-shader = ${ghostty.shader}\ncustom-shader-animation = ${animation}\n`
  }
  const onDisk = await $.fs.read(ghostty.include).catch(() => null)
  if (include !== onDisk) {
    await writeWhole($, ghostty.include, include, ghostty.id)
    written.isReloadOwed = true
  }
  written.include = include
  if (written.isReloadOwed) written.isReloadOwed = !(await reloadGhostty($, ghostty))
}

// The session is ending: its heartbeat goes, and the sky with it unless
// another session is still alive. A /clear or a resume goes on in the same
// process: the sky stays.
async function endGhosttySky($: EngineInterface, ghostty: Ghostty, reason: string): Promise<void> {
  if (reason === 'clear' || reason === 'resume') return
  ghostty.written.isEnded = true
  await markTab($, UNMARK_TAB)
  await ghostty.written.running?.catch(() => undefined)
  const { folder, heartbeat, include } = ghostty
  await $.process.run(['/bin/rm', '-f', heartbeat, ghostty.waiting]).catch(() => undefined)
  const now = await $.clock.now()
  const entries = await $.fs.list(folder).catch(() => [])
  const isAnotherAlive = entries.some(
    entry => entry.name.startsWith('alive-') && `${folder}/${entry.name}` !== heartbeat && now - entry.mtimeMs < ALIVE_MS,
  )
  if (!isAnotherAlive && (await $.fs.read(include).catch(() => '')) !== '') {
    await writeWhole($, include, '', ghostty.id)
    await reloadGhostty($, ghostty)
  }
}

// The lines the mod itself added to a Ghostty config, from any folder it was
// loaded from: its comment, and the include of its runtime file.
const OUR_LINES = [/^# Solar Clawd: /, /^config-file\s*=\s*\??\S*\/runtime\/solar-clawd\.ghostty$/]

// Adds the one include line to the config Ghostty reads first, in place of
// any the mod added before; `?` keeps Ghostty quiet should the file ever be
// missing. Answers the line and file, or null when the config is there but
// cannot be read: never written over.
async function includeInGhostty($: EngineInterface, ghostty: Ghostty): Promise<{ line: string; config: string } | null> {
  let config = ghostty.configs[0]!
  // On Linux the file that is there, config.ghostty if neither is.
  if (ghostty.isLinux) {
    for (const path of ghostty.configs) {
      if (await $.fs.exists(path).catch(() => false)) {
        config = path
        break
      }
    }
    await $.process.run(['mkdir', '-p', config.slice(0, config.lastIndexOf('/'))]).catch(() => undefined)
  }
  const isThere = await $.fs.exists(config).catch(() => true)
  const read = isThere ? await $.fs.read(config).catch(() => null) : ''
  if (read === null) return null
  const text = read
    .split('\n')
    .filter(row => !OUR_LINES.some(pattern => pattern.test(row.trim())))
    .join('\n')
  const line = `config-file = ?${ghostty.include}`
  const gap = text === '' || text.endsWith('\n') ? '' : '\n'
  await $.fs.write(config, `${text}${gap}# Solar Clawd: the sky while a Claude session runs.\n${line}\n`)

  return { line, config }
}

export const register: Register = on => {
  // The band as last drawn, so the timer can repaint it in place, and the
  // terminal's size, which the wallpaper takes its shape from.
  let site: { requestId: string; columns: number } | null = null
  let viewport = { columns: 160, rows: 45 }
  // The iTerm2 window in points, once iTerm2 has said.
  let windowSize: { width: number; height: number } | null = null
  let moonTexture: MoonTexture | null = null
  let demoFrom: number | null = null
  let pinnedAt: number | null = null
  let isAuroraForced = false
  let isWindForced = false
  let track: string | null = null
  const where: Where = { place: STOCKHOLM, isChosen: false, weather: null, offsetMs: undefined, kp: null, lastRainAt: null }
  // Events played on request (/solar event) or earned (a long turn done).
  let forced: Forced[] = []
  // Claude's state as Clawd shows it: a turn running, waiting on the person,
  // and the last passing reaction.
  const claude = {
    isWorking: false,
    passing: null as { kind: Reaction; at: number } | null,
    // The main conversation's calls now running that read or write, by id.
    open: new Map<string, 'read' | 'write'>(),
    // How full the context window is, 0 to 100, as last asked.
    paper: null as number | null,
    // When the conversation began compacting, while it does.
    compactingSince: null as number | null,
    // A fire played on request (/solar bränn) until then, and a ball thrown
    // on request (/solar kasta) lying in the basket until then.
    burnShownUntil: 0,
    ballShownUntil: 0,
  }
  // What Claude waits on the person for: an answer (a permission or a
  // question), or the next task once work is done. The lighthouse's.
  let waiting: Waiting | null = null
  // The ISS's elements, once fetched.
  let issOrbit: Elements | null = null
  // Whether the Mac runs on battery, as last asked.
  const power = { isOnBattery: false }
  // Updates the Ghostty sky at once, once a Ghostty session has started.
  let refreshSky: (() => void) | null = null
  // The calls the engine put to the person (tool.check's ask), by id: a
  // permission asked for is answered when its own call goes on and ends.
  const askingCalls = new Set<string>()
  // Sets what Claude waits for; whether that changed (a wait keeps the
  // moment it began).
  const waitFor = (next: Waiting | null): boolean => {
    if ((next?.mode ?? null) === (waiting?.mode ?? null)) return false
    waiting = next

    return true
  }
  // Set when this session runs in iTerm2: its session id and where the
  // wallpaper files go.
  let iterm: { sessionId: string; folder: string } | null = null
  const wallpaper = { at: 0, count: 0, isBusy: false, isShown: false, key: '', last: '' }
  // Whether the person is at the computer, and iTerm2 in front, as last asked.
  const activity = { isAway: false, isFrontmost: true }
  // Set when this session runs in Ghostty: where the sky's files go, and
  // the background the terminal draws.
  let ghostty: Ghostty | null = null
  const wallpaperCache: { current?: WallpaperCache } = {}

  const momentAt = (now: number): { ms: number; mode: Mode } => {
    if (demoFrom !== null) {
      const elapsed = now - demoFrom
      if (elapsed < DEMO_MS) {
        return {
          ms: localMidnight(demoFrom, where.offsetMs) + (elapsed / DEMO_MS) * 86_400_000,
          mode: 'demo',
        }
      }
      demoFrom = null
    }

    return pinnedAt === null ? { ms: now, mode: 'live' } : { ms: pinnedAt, mode: 'pinned' }
  }

  // How full the context window is now: another tenth filled, Clawd
  // throws a ball of paper in the basket.
  // Whether he threw.
  const takePaper = (fill: number | null, now: number): boolean => {
    const before = claude.paper
    claude.paper = fill ?? before
    if (before !== null && fill !== null && claude.compactingSince === null && Math.floor(fill / 10) > Math.floor(before / 10)) {
      claude.passing = { kind: 'toss', at: now }

      return true
    }

    return false
  }
  // The sky's wastebasket: a ball for each tenth, and the fire.
  const basketAt = (now: number): ShaderParams['basket'] => {
    const isEmbers = claude.passing?.kind === 'embers' && now - claude.passing.at < REACTION_SECONDS.embers * 1000
    const fire = claude.compactingSince !== null || now < claude.burnShownUntil ? 'burn' : isEmbers ? 'embers' : null
    const balls = (claude.paper === null ? 0 : Math.floor(claude.paper / 10)) + (now < claude.ballShownUntil ? 1 : 0)

    return { balls: isEmbers ? 0 : balls, fire }
  }

  const reactionAt = (now: number) => {
    if (claude.compactingSince !== null) return { kind: 'burn' as const, age: (now - claude.compactingSince) / 1000 }
    if (now < claude.burnShownUntil) return { kind: 'burn' as const, age: (now - (claude.burnShownUntil - BURN_SHOWN_MS)) / 1000 }
    const { passing } = claude
    // Looking up at the sky gives way to a question and to work.
    const isBusy = waiting?.mode === 'asking' || claude.isWorking
    if (passing && !(passing.kind === 'lookUp' && isBusy)) {
      const age = (now - passing.at) / 1000
      if (age < REACTION_SECONDS[passing.kind]) return { kind: passing.kind, age }
    }
    if (waiting?.mode === 'asking') return { kind: 'wave' as const, age: 0 }
    if (claude.isWorking) return { kind: workKind(claude.open.values()), age: 0 }

    return null
  }

  // The sky's events at a moment: those due then, and those forced, which
  // run on the real clock whatever moment the sky shows.
  const eventsNow = (now: number) => {
    const { ms } = momentAt(now)
    forced = forced.filter(event => now - event.at < PREVIEW_MS)
    const context = contextAt(ms, where.place, where.weather, where.lastRainAt, where.offsetMs)
    const events = eventsAt(ms, context, forced.map(event => ({ ...event, at: event.at - now + ms })))

    return { events, context }
  }

  const viewAt = (now: number, columns: number) => {
    const { ms, mode } = momentAt(now)
    const { events, context } = eventsNow(now)
    const shower = shootingRate(context) > 2 ? showerAt(context.time) : null

    // A preview of a stormy day keeps the rest of the weather as it is.
    const calm: Weather = { temperature: 8, code: 3, cloudCover: 60, wind: 0 }
    const weather = isWindForced ? { ...(where.weather ?? calm), wind: 12 } : where.weather

    return {
      columns,
      ms,
      t: now / 1000,
      mode,
      ...where,
      weather,
      isAuroraForced,
      moonTexture,
      // Clear where a wallpaper or Ghostty's sky shows through the band.
      isClear: iterm !== null || (ghostty !== null && ghostty.isIncluded && ghostty.written.include !== ''),
      reaction: reactionAt(now),
      paper: claude.paper,
      isBasketInSky: ghostty !== null && ghostty.isIncluded && ghostty.written.include !== '',
      track,
      event: events.length > 0 ? EVENT_WORDS[events[0]!.kind] : issNow(now, mode) ? 'ISS' : shower,
    }
  }

  // The ISS on a visible pass now; never in a demo or at a pinned time.
  const issNow = (now: number, mode: Mode) => (mode === 'live' ? issVisible(issOrbit, now, where.place) : null)

  const skyState = (): SkyState => ({ isAway: activity.isAway, isOnBattery: power.isOnBattery, waiting })

  // The Ghostty shader for a moment: the scene then, or in a demo the day.
  // What was in the Ghostty sky last time it was drawn; null before the first.
  let lastSky: string[] | null = null

  const shaderAt = (now: number, extras: SkyExtras) => {
    const { ms, mode } = momentAt(now)
    const demo = mode === 'demo' ? { seconds: DEMO_MS / 1000, offsetMs: where.offsetMs } : null

    const { events, context } = eventsNow(now)

    const iss = issNow(now, mode)
    // Something new up there: Clawd looks up at it.
    const sky = [...events.map(event => event.kind as string), ...(iss ? ['iss'] : []), ...(extras.beacon ? ['beacon'] : [])]
    if (lastSky !== null) claude.passing = nextPassing(claude.passing, now, skyGained(lastSky, sky))
    lastSky = sky

    return skyShader(shaderParams({ ...viewAt(now, viewport.columns), ms }, { demo, events, shootingRate: shootingRate(context), iss, ...extras, basket: basketAt(now) }))
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'solar',
      description: 'Show or hide the solar sky; demo plays a day, HH:MM pins a time, plats sets the place',
      argumentHint: '[demo | now | HH:MM | ÅÅÅÅ-MM-DD HH:MM | plats <stad> | norrsken | blåst | events | event <namn> | kasta | bränn | ghostty]',
      immediate: true,
    })

    const home = await $.env.get('HOME')
    const sessionId = (await $.env.get('ITERM_SESSION_ID'))?.split(':')[1]
    if (sessionId && home) {
      iterm = { sessionId, folder: `${home}/Library/Caches/solar-clawd` }
      await $.process.run(['/bin/mkdir', '-p', iterm.folder])
      void tidy($, iterm.folder, [sessionId]).catch(() => undefined)
    }

    try {
      const { base64 } = await $.fs.read(`${$.plugin.root}/assets/moon.rgba`, { as: 'bytes' })
      const rgba = fromBase64(base64)
      if (rgba.length === MOON_SIZE * MOON_SIZE * 4) moonTexture = { size: MOON_SIZE, rgba }
    } catch {
      // A plain disc, then.
    }

    const isOnLinux = await isLinuxHost($)
    if ((await $.env.get('TERM_PROGRAM')) === 'ghostty' && home) {
      const xdgConfig = isOnLinux ? (await $.env.get('XDG_CONFIG_HOME')) || null : null
      const folder = `${$.plugin.root}/runtime`
      const id = await $.session.id().catch(() => 'session')
      ghostty = {
        id,
        folder,
        include: `${folder}/solar-clawd.ghostty`,
        shader: `${folder}/sky.glsl`,
        heartbeat: `${folder}/alive-${id}`,
        waiting: `${folder}/waiting-${id}`,
        hidden: `${folder}/hidden`,
        home,
        configs: ghosttyConfigs(home, isOnLinux, xdgConfig),
        isLinux: isOnLinux,
        knowsReloadSignal: isOnLinux && (await ghosttyKnowsReloadSignal($)),
        isIncluded: false,
        written: { shader: '', include: '', heartbeatAt: -Infinity, isReloadOwed: false, isEnded: false, running: null, isAgain: false },
      }
      void tidy($, folder, [`alive-${id}`]).catch(() => undefined)
      // The sky shows only once Ghostty's config includes the mod's file.
      ghostty.isIncluded = await isIncluded($, ghostty)
      if (!ghostty.isIncluded) $.ui.toast('Solar: kör /solar ghostty så visas himlen bakom terminalen.')
    }

    if (ghostty !== null) {
      const sky = ghostty
      const update = () => updateGhosttySky($, sky, shaderAt, skyState)
      // Whether the person is here, and the power, before the first sky.
      const idle = await idleMs($, isOnLinux)
      if (idle !== null) activity.isAway = idle >= AWAY_MS
      power.isOnBattery = await isOnBattery($, isOnLinux)
      $.clock.every(BATTERY_MS, () => {
        void (async () => {
          const isOn = await isOnBattery($, isOnLinux)
          if (isOn === power.isOnBattery) return
          power.isOnBattery = isOn
          await update()
        })().catch(() => undefined)
      })
      void update().catch(() => undefined)
      refreshSky = () => void update().catch(() => undefined)
      // While the ISS passes, its place every two seconds, and once more as
      // it goes, so it does not hang there until the next tick.
      let isPassing = false
      $.clock.every(ISS_TICK_MS, () => {
        void (async () => {
          const now = await $.clock.now()
          const wasPassing = isPassing
          isPassing = issNow(now, momentAt(now).mode) !== null
          if (isPassing || wasPassing) await update()
        })().catch(() => undefined)
      })
      $.clock.every(SKY_MS, () => void update().catch(() => undefined))
    }

    // The network is not waited on: the sky starts in Stockholm.
    void settlePlace($, where).catch(() => undefined)
    const fetchIss = async () => {
      issOrbit = (await issElements($)) ?? issOrbit
    }
    void fetchIss().catch(() => undefined)
    // A ball thrown lands in the sky's basket as it gets there.
    const readPaper = async () => {
      if (takePaper(await contextFill($), await $.clock.now())) await $.clock.sleep(THROW_SECONDS * 1000).then(() => refreshSky?.()).catch(() => undefined)
    }
    void readPaper()
    $.clock.every(PAPER_MS, () => void readPaper())
    $.clock.every(ISS_MS / 24, () => void fetchIss().catch(() => undefined))
    $.clock.every(WEATHER_MS, () => void refreshWeather($, where).catch(() => undefined))
    // Away from the computer, or iTerm2 behind other windows: the wallpaper
    // stands still and the music is not asked after.
    $.clock.every(ACTIVITY_MS, () => {
      void (async () => {
        const wasIdle = activity.isAway || !activity.isFrontmost
        // An ioreg that failed says nothing: the last answer stands.
        const idle = await idleMs($, isOnLinux)
        if (idle !== null) activity.isAway = idle >= AWAY_MS
        if (iterm !== null && !activity.isAway && (wasIdle || !activity.isFrontmost)) {
          const { stdout } = await $.process.run(['/usr/bin/osascript', ...ITERM_FRONTMOST], { timeoutMs: 5_000 })
          activity.isFrontmost = stdout.trim() === 'true'
        }
        // The white lighthouse is seen once Ghostty is in front with the
        // person at it; a question still waits for its answer.
        if (ghostty !== null && waiting?.mode === 'done' && !activity.isAway && (await isGhosttyInFront($, isOnLinux))) {
          if (waiting?.mode === 'done' && waitFor(null)) await shareWaiting($, ghostty, waiting, refreshSky)
        }
      })().catch(() => undefined)
    })
    // Music is asked of macOS's own apps.
    $.clock.every(MUSIC_MS, () => {
      if (activity.isAway || isOnLinux) return
      void $.process
        .run(['/usr/bin/osascript', ...NOW_PLAYING], { timeoutMs: 5_000 })
        .then(({ stdout }) => {
          track = stdout.trim() ? plain(stdout.trim()) : null
        })
        .catch(() => undefined)
    })

    // Writes the sky as a PNG and hands it to iTerm2, two files taken in
    // turn so iTerm2 sees a new path and reloads; an empty path clears it.
    const setWallpaper = async (now: number | null) => {
      if (iterm === null) return
      let path = ''
      if (now !== null) {
        const view = viewAt(now, viewport.columns)
        // At the window's own pixels once iTerm2 has said its size, so the moon
        // and stars are sharp; until then a guess from the terminal's cells,
        // about 2.15 times as tall as wide. The time-lapse paints at half size.
        const scale = momentAt(now).mode === 'demo' ? BACKING_SCALE / 2 : BACKING_SCALE
        const guess = { width: viewport.columns * 7.2, height: viewport.rows * 7.2 * 2.15 }
        const points = windowSize ?? guess
        const width = Math.round(Math.min(3200, Math.max(240, points.width * scale)))
        const height = Math.round((width * points.height) / points.width)
        const png = await wallpaperPng(view, width, height, () => $.clock.sleep(1), wallpaperCache)
        // The same picture again (a still sky): nothing to write or send.
        if (png === wallpaper.last && wallpaper.isShown) return
        wallpaper.last = png
        wallpaper.count += 1
        path = `${iterm.folder}/${iterm.sessionId}-${wallpaper.count % 2}.png`
        await $.process.run(['/usr/bin/base64', '-D', '-o', path], { stdin: png })
      } else {
        wallpaper.last = ''
      }
      const { stdout } = await $.process.run([
        '/usr/bin/osascript',
        ...SET_BACKGROUND,
        iterm.sessionId,
        path,
      ])
      const [answer, w, h, frontmost] = stdout.trim().split(' ')
      wallpaper.isShown = now !== null && answer === 'ok'
      if (frontmost) activity.isFrontmost = frontmost === 'true'
      if (Number(w) > 0 && Number(h) > 0) windowSize = { width: Number(w), height: Number(h) }
    }

    $.clock.every(TICK_MS, () => {
      void (async () => {
        const now = await $.clock.now()
        const hidden = await read($, isHidden)

        if (iterm !== null && !wallpaper.isBusy) {
          const { mode } = momentAt(now)
          // A new place, weather, size or preview repaints at once.
          const weather = where.weather
          const key = `${mode}|${where.place.name}|${weather?.code}|${weather?.cloudCover}|${where.kp}|${isAuroraForced}|${viewport.columns}x${viewport.rows}|${windowSize?.width}x${windowSize?.height}`
          const isActive = !activity.isAway && activity.isFrontmost
          const every = mode === 'demo' ? DEMO_WALLPAPER_MS : isActive ? WALLPAPER_MS : IDLE_WALLPAPER_MS
          const isDue = now - wallpaper.at >= every || key !== wallpaper.key
          if (hidden ? wallpaper.isShown : isDue) {
            wallpaper.isBusy = true
            wallpaper.at = now
            wallpaper.key = key
            await setWallpaper(hidden ? null : now).finally(() => {
              wallpaper.isBusy = false
            })
          }
        }

        const drawn = site
        if (drawn === null) return
        const result = await $.ui.blit({
          requestId: drawn.requestId,
          key: KEY,
          cells: drawFrame(viewAt(now, drawn.columns)),
          columns: drawn.columns,
          rows: ROWS,
        })
        // Hidden, collapsed or resized: wait for the next draw to say where.
        if (result.deny && site === drawn) site = null
      })().catch(() => {
        // Gone between ticks: the next draw says where it is.
        site = null
      })
    })

    return next(e)
  })

  // Leave iTerm2 as it was found; in Ghostty the sky goes with the last
  // session that shows it.
  on('session.end', async ($, e, next) => {
    if (iterm !== null && wallpaper.isShown) {
      await $.process.run(['/usr/bin/osascript', ...SET_BACKGROUND, iterm.sessionId, ''])
    }
    if (ghostty !== null) await endGhosttySky($, ghostty, e.reason)

    return next(e)
  })

  // Clawd follows the main conversation: busy while a turn runs, cheering
  // when it ends, a hand to his face when a tool fails, waving when Claude
  // waits on the person.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      claude.isWorking = true
      claude.open.clear()
      if (waitFor(null)) await shareWaiting($, ghostty, waiting, refreshSky)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      claude.isWorking = false
      claude.open.clear()
      const now = await $.clock.now()
      if (takePaper(await contextFill($), now)) void $.clock.sleep(THROW_SECONDS * 1000).then(() => refreshSky?.()).catch(() => undefined)
      if (e.reason === 'answer') {
        claude.passing = { kind: 'cheer', at: now }
        if (waitFor({ mode: 'done', since: now })) await shareWaiting($, ghostty, waiting, refreshSky)
        // A long piece of work done: confetti over the sky.
        if (e.durationMs > MILESTONE_MS) forced.push({ kind: 'milestone', at: now })
      }
    }

    return next(e)
  })

  // Which calls are put to the person: the call that asked is the one whose
  // end answers the question.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id) askingCalls.add(e.tool_use_id)

    return verdict
  })

  on('tool.call', async ($, e, next) => {
    // A question put to the person waits inside its call; any other call in
    // the conversation means Claude is at work again (unless a permission it
    // asked for is still open).
    const isQuestion = e.tool === 'AskUserQuestion'
    const startedAt = await $.clock.now()
    const asked = isQuestion ? { mode: 'asking' as const, since: startedAt } : null
    const isOpen = waiting?.mode === 'asking' && askingCalls.size > 0
    if ((isQuestion || (e.agentId === undefined && !isOpen)) && waitFor(asked)) await shareWaiting($, ghostty, waiting, refreshSky)
    const kind = e.agentId === undefined ? toolKind(e.tool) : null
    if (kind && e.tool_use_id) claude.open.set(e.tool_use_id, kind)
    const result = await next(e).finally(() => claude.open.delete(e.tool_use_id))
    // Answered: the question's own call, or the last call that asked for a
    // permission, has ended. A notice no call asked for (an MCP server's
    // question) ends with the main call it came up in.
    const wasAsking = askingCalls.delete(e.tool_use_id)
    const isAnswered =
      isQuestion ||
      (wasAsking && askingCalls.size === 0) ||
      (!wasAsking && askingCalls.size === 0 && e.agentId === undefined && (waiting?.since ?? -Infinity) >= startedAt)
    if (waiting?.mode === 'asking' && isAnswered && waitFor(null)) await shareWaiting($, ghostty, waiting, refreshSky)
    if (result.isError && e.agentId === undefined) {
      claude.passing = { kind: 'facepalm', at: await $.clock.now() }
    }

    return result
  })

  // The conversation compacting (not ahead of time): Clawd throws a match
  // in the basket and the context burns while it runs; smoke after, unless
  // it was skipped.
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    claude.compactingSince = await $.clock.now()
    // The match lands, and the sky's basket catches fire.
    void $.clock.sleep(THROW_SECONDS * 1000).then(() => refreshSky?.()).catch(() => undefined)
    try {
      const result = await next(e)
      if (!('skip' in result)) {
        const now = await $.clock.now()
        claude.passing = { kind: 'embers', at: now }
        claude.compactingSince = null
        claude.paper = null
        takePaper(await contextFill($), now)
        // Embers now, and an empty bin once they are out.
        void $.clock.sleep(REACTION_SECONDS.embers * 1000 + 200).then(() => refreshSky?.()).catch(() => undefined)
      }

      return result
    } finally {
      claude.compactingSince = null
      refreshSky?.()
    }
  })

  // A permission or a question for the person; Claude Code's reminder that
  // it has been idle (`idle_prompt`) and other notices ask nothing.
  on('classic.Notification', async ($, e, next) => {
    if (ASKING.includes(e.notification_type) && waiting?.mode !== 'asking') {
      if (waitFor({ mode: 'asking', since: await $.clock.now() })) await shareWaiting($, ghostty, waiting, refreshSky)
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (waitFor(null)) await shareWaiting($, ghostty, waiting, refreshSky)

    return next(e)
  })

  on('command.run', { command: 'solar' }, async ($, e) => {
    const arg = e.args.trim()
    const word = arg.toLowerCase()
    const now = await $.clock.now()

    if (word === '') {
      const wasHidden = await read($, isHidden)
      await update($, isHidden, () => !wasHidden)
      // Ghostty's sky is one for every session: hidden in all of them.
      if (ghostty !== null) {
        if (wasHidden) await $.process.run(['/bin/rm', '-f', ghostty.hidden]).catch(() => undefined)
        else await $.fs.write(ghostty.hidden, '')
      }

      return { text: wasHidden ? 'Solar-himlen är tillbaka.' : 'Solar-himlen är gömd.' }
    }

    if (word === 'demo') {
      demoFrom = now
      await update($, isHidden, () => false)

      return { text: 'Solar: ett helt dygn på 48 sekunder.' }
    }

    if (word === 'now') {
      demoFrom = null
      pinnedAt = null

      return { text: 'Solar: följer solen igen.' }
    }

    if (word === 'ghostty') {
      if (ghostty === null) return { text: 'Solar: den här sessionen körs inte i Ghostty.' }
      if (await isIncluded($, ghostty)) return { text: 'Solar: Ghostty visar redan himlen.' }
      const added = await includeInGhostty($, ghostty)
      if (added === null) return { text: `Solar: kunde inte läsa Ghosttys config, så den lämnas orörd.` }
      const { line, config } = added
      ghostty.isIncluded = true
      await updateGhosttySky($, ghostty, shaderAt, skyState)
      await reloadGhostty($, ghostty)

      return { text: `Solar: lade till "${line}" i ${config}.` }
    }

    if (word === 'events') {
      const words = Object.values(EVENT_WORDS).join(', ')

      return { text: `Solar: ${words}. Visa ett med /solar event <namn>.` }
    }

    if (word.startsWith('event')) {
      const name = word.slice('event'.length).trim()
      const kind = (Object.keys(EVENT_WORDS) as EventKind[]).find(k => EVENT_WORDS[k] === name || k.toLowerCase() === name)
      if (!kind) return { text: `Solar: inget event som heter "${name}". /solar events listar dem.` }
      forced = [...forced.filter(event => event.kind !== kind), { kind, at: now }]
      await update($, isHidden, () => false)

      return { text: `Solar: ${EVENT_WORDS[kind]} i ${PREVIEW_MS / 1000} sekunder.` }
    }

    // Clawd's wastebasket, played: a ball thrown in, or the context burnt.
    if (word === 'kasta') {
      claude.passing = { kind: 'toss', at: now }
      claude.ballShownUntil = now + PREVIEW_MS
      void $.clock.sleep(THROW_SECONDS * 1000).then(() => refreshSky?.()).catch(() => undefined)
      void $.clock.sleep(PREVIEW_MS + 100).then(() => refreshSky?.()).catch(() => undefined)

      return { text: 'Solar: Clawd kastar en pappersboll i papperskorgen.' }
    }

    if (word === 'bränn') {
      claude.burnShownUntil = now + BURN_SHOWN_MS
      void $.clock.sleep(THROW_SECONDS * 1000).then(() => refreshSky?.()).catch(() => undefined)
      void $.clock
        .sleep(BURN_SHOWN_MS)
        .then(() => {
          claude.passing = { kind: 'embers', at: now + BURN_SHOWN_MS }
          refreshSky?.()
        })
        .catch(() => undefined)
      void $.clock.sleep(BURN_SHOWN_MS + REACTION_SECONDS.embers * 1000 + 200).then(() => refreshSky?.()).catch(() => undefined)

      return { text: `Solar: papperskorgen brinner i ${BURN_SHOWN_MS / 1000} sekunder, som vid /compact (konversationen rörs inte).` }
    }

    if (word === 'norrsken') {
      isAuroraForced = !isAuroraForced

      return { text: isAuroraForced ? 'Solar: norrsken på, för att se hur det ser ut.' : 'Solar: norrsken bara när det finns på riktigt.' }
    }

    if (word === 'blåst') {
      isWindForced = !isWindForced

      return { text: isWindForced ? 'Solar: storm, för att se Clawd jaga sin mössa.' : 'Solar: vinden som den är på riktigt.' }
    }

    if (word === 'plats' || word.startsWith('plats ')) {
      const name = arg.slice('plats'.length).trim()
      if (name === '') return { text: `Solar: ${placeText(where)}.` }

      if (name.toLowerCase() === 'auto') {
        await $.store.delete(CHOSEN_PLACE)
        await $.store.delete(GUESSED_PLACE)
        await settlePlace($, where)

        return { text: `Solar: följer din plats igen, ${placeText(where)}.` }
      }

      const found = await findPlace($, name)
      if (!found) return { text: `Solar: hittade ingen plats som heter "${name}".` }
      await $.store.set(CHOSEN_PLACE, found)
      where.place = found
      where.isChosen = true
      await refreshWeather($, where)

      return { text: `Solar: himlen är nu ${placeText(where)}.` }
    }

    // HH:MM pins a time today; YYYY-MM-DD, with a time or at noon, pins a day.
    const at = /^(?:(\d{4})-(\d{2})-(\d{2})\s*)?(?:(\d{1,2})(?::(\d{2}))?)?$/.exec(word)
    if (at && (at[1] || at[4])) {
      const hour = Number(at[4] ?? 12)
      const minute = Number(at[5] ?? 0)
      if (hour < 24 && minute < 60) {
        const day = at[1]
          ? Date.UTC(Number(at[1]), Number(at[2]) - 1, Number(at[3])) - (where.offsetMs ?? 3_600_000)
          : localMidnight(now, where.offsetMs)
        demoFrom = null
        pinnedAt = day + (hour * 60 + minute) * 60_000
        await update($, isHidden, () => false)

        return { text: `Solar: låst på ${at[1] ? `${at[1]}-${at[2]}-${at[3]} ` : ''}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}.` }
      }
    }

    return { text: 'Solar: /solar, /solar demo, /solar now, /solar HH:MM, /solar ÅÅÅÅ-MM-DD HH:MM, /solar plats <stad>, /solar norrsken, /solar blåst, /solar kasta eller /solar bränn.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    if (await read($, isHidden)) return next(e)

    if (e.viewport) viewport = { columns: e.viewport.columns, rows: e.viewport.rows }
    const columns = e.props.bodyColumns
    if (columns < MIN_COLUMNS || e.props.maxRows < ROWS) return next(e)

    const now = await $.clock.now()
    site = { requestId: e.requestId, columns }
    const { Raster } = $.ui.resolve(e)

    return <Raster key={KEY} columns={columns} rows={ROWS} cells={drawFrame(viewAt(now, columns))} />
  })
}
