import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { localMidnight, STOCKHOLM } from './astro'
import type { Place } from './astro'
import { drawFrame, isPrintable, REACTION_SECONDS, ROWS } from './clawd'
import type { Mode, Reaction } from './clawd'
import { drawCorner, HQ_COLUMNS } from './hq'
import { fromBase64, toBase64 } from './paint'
import { shaderParams, skyShader } from './shader'
import { SKY_WORDS, skyOf, wallpaperPng } from './sky'
import type { MoonTexture, WallpaperCache, Weather } from './sky'

const isHidden = atom({ plugin: 'solar-clawd', key: 'isHidden' } as const, false)

const KEY = 'sky'
// The corner as a picture, where the terminal draws pictures.
const PICTURE = 'clawd'
// The moon's texture, baked by tools/bake-moon.sh.
const MOON_SIZE = 256
// Pixels per point of the window: Retina.
const BACKING_SCALE = 2
// Twelve frames a second, as film is often drawn: on twos.
const TICK_MS = 83
// A whole day in this long, for /solar demo.
const DEMO_MS = 48_000
// Narrower than this and the scene goes away rather than squeezing.
const MIN_COLUMNS = 34
// How often iTerm2's wallpaper moves its clouds on (the still sky behind
// them is painted once a minute); faster in the time-lapse.
const WALLPAPER_MS = 2_500
const DEMO_WALLPAPER_MS = 1_500
// Weather and aurora are asked for this often, music this often; a place
// guessed from the IP address is trusted this long before it is guessed again.
const WEATHER_MS = 15 * 60_000
const MUSIC_MS = 10_000
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
// Away after this long without a key or the mouse: the sky goes, and with
// it Ghostty's frame loop, until the person is back.
const AWAY_MS = 5 * 60_000
// Each Ghostty session leaves a heartbeat this often; one older than
// ALIVE_MS is a session gone.
const HEARTBEAT_MS = 60_000
const ALIVE_MS = 5 * 60_000
// Ghostty's own background, until it says otherwise.
const GHOSTTY_BACKGROUND = 0x282c34

// $.store keys: a place the person chose, and the last guess with its time.
const CHOSEN_PLACE = 'place'
const GUESSED_PLACE = 'guessedPlace'

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
  'return "ok " & ((item 3 of b) - (item 1 of b)) & " " & ((item 4 of b) - (item 2 of b))',
  'end if',
  'end repeat',
  'end repeat',
  'end repeat',
  'end tell',
  'return "missing"',
  'end run',
].flatMap(line => ['-e', line])

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
}

async function refreshWeather($: EngineInterface, where: Where): Promise<void> {
  const [fetched, kp] = await Promise.all([fetchWeather($, where.place), fetchKp($)])
  if (fetched) {
    where.weather = fetched.weather
    where.offsetMs = fetched.offsetMs
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

// How long since the person last touched a key or the mouse.
async function idleMs($: EngineInterface): Promise<number> {
  try {
    const { stdout } = await $.process.run(['/usr/sbin/ioreg', '-c', 'IOHIDSystem', '-d', '4'], { timeoutMs: 5_000 })
    const ns = /"HIDIdleTime" = (\d+)/.exec(stdout)?.[1]

    return ns ? Number(ns) / 1e6 : 0
  } catch {
    return 0
  }
}

// The background Ghostty draws, which the shader shows the sky in place of.
async function ghosttyBackground($: EngineInterface, bin: string): Promise<number> {
  try {
    const { stdout } = await $.process.run([`${bin}/ghostty`, '+show-config', '--default'], { timeoutMs: 5_000 })
    const hex = /^background = #?([0-9a-f]{6})\s*$/im.exec(stdout)?.[1]

    return hex ? parseInt(hex, 16) : GHOSTTY_BACKGROUND
  } catch {
    return GHOSTTY_BACKGROUND
  }
}

// Ghostty's config files on macOS, the one to add the include to first.
function ghosttyConfigs(home: string): string[] {
  const support = `${home}/Library/Application Support/com.mitchellh.ghostty`

  return [`${support}/config.ghostty`, `${support}/config`, `${home}/.config/ghostty/config.ghostty`, `${home}/.config/ghostty/config`]
}

// Where a Ghostty session keeps the sky's files, and what it last wrote:
// the shader, the include, the heartbeat's time.
type Ghostty = {
  folder: string
  include: string
  shader: string
  heartbeat: string
  home: string
  background: number
  written: { shader: string; include: string; heartbeatAt: number; isBusy: boolean }
}

// Whether one of Ghostty's config files includes the mod's file.
async function isIncluded($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
  for (const path of ghosttyConfigs(ghostty.home)) {
    const text = await $.fs.read(path).catch(() => '')
    if (text.includes(ghostty.include)) return true
  }

  return false
}

async function reloadGhostty($: EngineInterface): Promise<void> {
  await $.process.run(['/usr/bin/osascript', ...RELOAD_GHOSTTY], { timeoutMs: 5_000 }).catch(() => undefined)
}

// The sky in Ghostty as it should be now: `shaderAt`'s shader while the
// person is here and the sky is not hidden, nothing otherwise. Ghostty
// reloads only when a file actually changed.
async function updateGhosttySky(
  $: EngineInterface,
  ghostty: Ghostty,
  isHidden: boolean,
  shaderAt: (now: number) => string,
): Promise<void> {
  const { written } = ghostty
  if (written.isBusy) return
  written.isBusy = true
  try {
    const now = await $.clock.now()
    if (now - written.heartbeatAt >= HEARTBEAT_MS) {
      await $.fs.write(ghostty.heartbeat, String(now))
      written.heartbeatAt = now
    }
    const isWanted = !isHidden && (await idleMs($)) < AWAY_MS
    let isChanged = false
    let include = ''
    if (isWanted) {
      const shader = shaderAt(now)
      if (shader !== written.shader) {
        await $.fs.write(ghostty.shader, shader)
        written.shader = shader
        isChanged = true
      }
      include = `custom-shader = ${ghostty.shader}\ncustom-shader-animation = true\n`
    }
    if (include !== written.include) {
      await $.fs.write(ghostty.include, include)
      written.include = include
      isChanged = true
    }
    if (isChanged) await reloadGhostty($)
  } finally {
    written.isBusy = false
  }
}

// The session is ending: its heartbeat goes, and the sky with it unless
// another session is still alive.
async function endGhosttySky($: EngineInterface, ghostty: Ghostty): Promise<void> {
  const { folder, heartbeat, include } = ghostty
  await $.process.run(['/bin/rm', '-f', heartbeat]).catch(() => undefined)
  const now = await $.clock.now()
  const entries = await $.fs.list(folder).catch(() => [])
  const isAnotherAlive = entries.some(
    entry => entry.name.startsWith('alive-') && `${folder}/${entry.name}` !== heartbeat && now - entry.mtimeMs < ALIVE_MS,
  )
  if (!isAnotherAlive && (await $.fs.read(include).catch(() => '')) !== '') {
    await $.fs.write(include, '')
    await reloadGhostty($)
  }
}

// Adds the one include line to the config Ghostty reads first; `?` keeps
// Ghostty quiet should the file ever be missing. Answers the line and file.
async function includeInGhostty($: EngineInterface, ghostty: Ghostty): Promise<{ line: string; config: string }> {
  const config = ghosttyConfigs(ghostty.home)[0]!
  const text = await $.fs.read(config).catch(() => '')
  const line = `config-file = ?${ghostty.include}`
  const gap = text === '' || text.endsWith('\n') ? '' : '\n'
  await $.fs.write(config, `${text}${gap}# Solar Clawd: the sky while a Claude session runs.\n${line}\n`)

  return { line, config }
}

export const register: Register = on => {
  // The band as last drawn, so the timer can repaint it in place, and the
  // terminal's size, which the wallpaper takes its shape from.
  let site: { requestId: string; columns: number; isPicture: boolean } | null = null
  // Set once the terminal answers a picture with its alt text: cells from then on.
  let isPictureRefused = false
  let viewport = { columns: 160, rows: 45 }
  // The iTerm2 window in points, once iTerm2 has said.
  let windowSize: { width: number; height: number } | null = null
  let moonTexture: MoonTexture | null = null
  let demoFrom: number | null = null
  let pinnedAt: number | null = null
  let isAuroraForced = false
  let isWindForced = false
  let track: string | null = null
  const where: Where = { place: STOCKHOLM, isChosen: false, weather: null, offsetMs: undefined, kp: null }
  // Claude's state as Clawd shows it: a turn running, waiting on the person,
  // and the last passing reaction.
  const claude = { isWorking: false, isWaiting: false, passing: null as { kind: Reaction; at: number } | null }
  // Set when this session runs in iTerm2: its session id and where the
  // wallpaper files go.
  let iterm: { sessionId: string; folder: string } | null = null
  const wallpaper = { at: 0, count: 0, isBusy: false, isShown: false, key: '' }
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

  const reactionAt = (now: number) => {
    const { passing } = claude
    if (passing) {
      const age = (now - passing.at) / 1000
      if (age < REACTION_SECONDS[passing.kind]) return { kind: passing.kind, age }
    }
    if (claude.isWaiting) return { kind: 'wave' as const, age: 0 }
    if (claude.isWorking) return { kind: 'working' as const, age: 0 }

    return null
  }

  // The corner picture's size in pixels: the terminal's cells at the
  // screen's own pixels, once iTerm2 has said its window's size.
  const cornerPixels = () => {
    const perColumn = windowSize ? (windowSize.width * BACKING_SCALE) / viewport.columns : 14.4
    const perRow = windowSize ? (windowSize.height * BACKING_SCALE) / viewport.rows : 31

    return { width: Math.round(HQ_COLUMNS * perColumn), height: Math.round(ROWS * perRow) }
  }

  const viewAt = (now: number, columns: number) => {
    const { ms, mode } = momentAt(now)

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
      isClear: iterm !== null || (ghostty !== null && ghostty.written.include !== ''),
      reaction: reactionAt(now),
      track,
    }
  }

  // The Ghostty shader for a moment: the scene then, or in a demo the day.
  const shaderAt = (now: number) => {
    const { ms, mode } = momentAt(now)
    const demo = mode === 'demo' ? { seconds: DEMO_MS / 1000, offsetMs: where.offsetMs } : null

    return skyShader(shaderParams({ ...viewAt(now, viewport.columns), ms }, { background: ghostty?.background ?? GHOSTTY_BACKGROUND, demo }))
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'solar',
      description: 'Show or hide the solar sky; demo plays a day, HH:MM pins a time, plats sets the place',
      argumentHint: '[demo | now | HH:MM | ÅÅÅÅ-MM-DD HH:MM | plats <stad> | norrsken | blåst | ghostty]',
      immediate: true,
    })

    const home = await $.env.get('HOME')
    const sessionId = (await $.env.get('ITERM_SESSION_ID'))?.split(':')[1]
    if (sessionId && home) {
      iterm = { sessionId, folder: `${home}/Library/Caches/solar-clawd` }
      await $.process.run(['/bin/mkdir', '-p', iterm.folder])
    }

    try {
      const { base64 } = await $.fs.read(`${$.plugin.root}/assets/moon.rgba`, { as: 'bytes' })
      const rgba = fromBase64(base64)
      if (rgba.length === MOON_SIZE * MOON_SIZE * 4) moonTexture = { size: MOON_SIZE, rgba }
    } catch {
      // A plain disc, then.
    }

    if ((await $.env.get('TERM_PROGRAM')) === 'ghostty' && home) {
      const folder = `${$.plugin.root}/runtime`
      const bin = (await $.env.get('GHOSTTY_BIN_DIR')) ?? '/Applications/Ghostty.app/Contents/MacOS'
      const id = await $.session.id().catch(() => 'session')
      ghostty = {
        folder,
        include: `${folder}/solar-clawd.ghostty`,
        shader: `${folder}/sky.glsl`,
        heartbeat: `${folder}/alive-${id}`,
        home,
        background: await ghosttyBackground($, bin),
        written: { shader: '', include: '', heartbeatAt: -Infinity, isBusy: false },
      }
      // The sky shows only once Ghostty's config includes the mod's file.
      if (!(await isIncluded($, ghostty))) $.ui.toast('Solar: kör /solar ghostty så visas himlen bakom terminalen.')
    }

    if (ghostty !== null) {
      const sky = ghostty
      const update = async () => updateGhosttySky($, sky, await read($, isHidden), shaderAt)
      void update().catch(() => undefined)
      $.clock.every(SKY_MS, () => void update().catch(() => undefined))
    }

    // The network is not waited on: the sky starts in Stockholm.
    void settlePlace($, where).catch(() => undefined)
    $.clock.every(WEATHER_MS, () => void refreshWeather($, where).catch(() => undefined))
    $.clock.every(MUSIC_MS, () => {
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
        wallpaper.count += 1
        path = `${iterm.folder}/${iterm.sessionId}-${wallpaper.count % 2}.png`
        await $.process.run(['/usr/bin/base64', '-D', '-o', path], {
          stdin: await wallpaperPng(view, width, height, () => $.clock.sleep(1), wallpaperCache),
        })
      }
      const { stdout } = await $.process.run([
        '/usr/bin/osascript',
        ...SET_BACKGROUND,
        iterm.sessionId,
        path,
      ])
      const [answer, w, h] = stdout.trim().split(' ')
      wallpaper.isShown = now !== null && answer === 'ok'
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
          const every = mode === 'demo' ? DEMO_WALLPAPER_MS : WALLPAPER_MS
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
        if (!drawn.isPicture) {
          const result = await $.ui.blit({
            requestId: drawn.requestId,
            key: KEY,
            cells: drawFrame(viewAt(now, drawn.columns)),
            columns: drawn.columns,
            rows: ROWS,
          })
          // Hidden, collapsed or resized: wait for the next draw to say where.
          if (result.deny && site === drawn) site = null

          return
        }

        const view = viewAt(now, drawn.columns - HQ_COLUMNS)
        const { width, height } = cornerPixels()
        const corner = drawCorner(view, width, height)
        const [sky, picture] = await Promise.all([
          $.ui.blit({
            requestId: drawn.requestId,
            key: KEY,
            cells: drawFrame(view, false),
            columns: drawn.columns - HQ_COLUMNS,
            rows: ROWS,
          }),
          $.ui.blit({
            requestId: drawn.requestId,
            key: PICTURE,
            source: { rgba: toBase64(corner.rgba), width, height },
            columns: HQ_COLUMNS,
            rows: ROWS,
          }),
        ])
        if (site !== drawn) return
        // A terminal that cannot draw pictures shows the alt: back to cells.
        if (picture.deny && /\balt\b/.test(picture.deny)) {
          isPictureRefused = true
          site = null
          $.ui.invalidate('ui.render')
        } else if (sky.deny || picture.deny) {
          site = null
        }
      })()
    })

    return next(e)
  })

  // Leave iTerm2 as it was found; in Ghostty the sky goes with the last
  // session that shows it.
  on('session.end', async ($, e, next) => {
    if (iterm !== null && wallpaper.isShown) {
      await $.process.run(['/usr/bin/osascript', ...SET_BACKGROUND, iterm.sessionId, ''])
    }
    if (ghostty !== null) await endGhosttySky($, ghostty)

    return next(e)
  })

  // Clawd follows the main conversation: busy while a turn runs, cheering
  // when it ends, a hand to his face when a tool fails, waving when Claude
  // waits on the person.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      claude.isWorking = true
      claude.isWaiting = false
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      claude.isWorking = false
      if (e.reason === 'answer') claude.passing = { kind: 'cheer', at: await $.clock.now() }
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    claude.isWaiting = false
    const result = await next(e)
    if (result.isError && e.agentId === undefined) {
      claude.passing = { kind: 'facepalm', at: await $.clock.now() }
    }

    return result
  })

  on('classic.Notification', async ($, e, next) => {
    claude.isWaiting = true

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    claude.isWaiting = false

    return next(e)
  })

  on('command.run', { command: 'solar' }, async ($, e) => {
    const arg = e.args.trim()
    const word = arg.toLowerCase()
    const now = await $.clock.now()

    if (word === '') {
      const wasHidden = await read($, isHidden)
      await update($, isHidden, () => !wasHidden)

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
      const { line, config } = await includeInGhostty($, ghostty)
      // Written again, so Ghostty reloads with the include in place.
      ghostty.written.include = ''
      await updateGhosttySky($, ghostty, await read($, isHidden), shaderAt)

      return { text: `Solar: lade till "${line}" i ${config}.` }
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

    return { text: 'Solar: /solar, /solar demo, /solar now, /solar HH:MM, /solar ÅÅÅÅ-MM-DD HH:MM, /solar plats <stad> /solar norrsken eller /solar blåst.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    if (await read($, isHidden)) return next(e)

    if (e.viewport) viewport = { columns: e.viewport.columns, rows: e.viewport.rows }
    const columns = e.props.bodyColumns
    if (columns < MIN_COLUMNS || e.props.maxRows < ROWS) return next(e)

    const now = await $.clock.now()
    const isPicture = !isPictureRefused && columns >= HQ_COLUMNS + MIN_COLUMNS
    site = { requestId: e.requestId, columns, isPicture }
    const { Box, Image, Raster } = $.ui.resolve(e)

    if (!isPicture) {
      return <Raster key={KEY} columns={columns} rows={ROWS} cells={drawFrame(viewAt(now, columns))} />
    }

    const view = viewAt(now, columns - HQ_COLUMNS)
    const { width, height } = cornerPixels()
    const corner = drawCorner(view, width, height)

    return (
      <Box flexDirection="row">
        <Raster key={KEY} columns={columns - HQ_COLUMNS} rows={ROWS} cells={drawFrame(view, false)} />
        <Image
          key={PICTURE}
          source={{ rgba: toBase64(corner.rgba), width, height }}
          columns={HQ_COLUMNS}
          rows={ROWS}
          alt=" "
        />
      </Box>
    )
  })
}
