import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { localMidnight, STOCKHOLM } from './astro'
import type { Waiting } from './beacon'
import { drawFrame, nextPassing, REACTION_SECONDS, ROWS, skyGained, THROW_SECONDS, toolKind, workKind } from './clawd'
import type { Mode, Reaction } from './clawd'
import { contextAt, EVENT_WORDS, eventsAt, OLD_EVENT_WORDS, PREVIEW_MS, showerAt, shootingRate } from './events'
import type { EventKind, Forced } from './events'
import {
  endGhosttySky,
  ghosttyConfigs,
  ghosttyKnowsReloadSignal,
  hasOurInclude,
  hasOurStage,
  includeInGhostty,
  isIncluded,
  reloadGhostty,
  runtimeFolder,
  shareWaiting,
  STAGE_PT,
  tidy,
  updateGhosttySky,
} from './ghostty'
import type { Ghostty, SkyExtras, SkyState } from './ghostty'
import { idleMs, isGhosttyInFront, isLinuxHost, isOnBattery } from './host'
import { issVisible } from './iss'
import type { Elements } from './iss'
import { ITERM_FRONTMOST, NOW_PLAYING, SCREEN_SCALE, SET_BACKGROUND } from './mac'
import { CHOSEN_PLACE, findPlace, GUESSED_PLACE, ISS_MS, issElements, placeText, plain, refreshWeather, settlePlace } from './net'
import type { Where } from './net'
import { fromBase64 } from './paint'
import { shaderParams, skyShader } from './shader'
import type { ShaderParams } from './shader'
import { skyOf, wallpaperPng } from './sky'
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
// Weather and aurora are asked for this often, music this often.
const WEATHER_MS = 15 * 60_000
const MUSIC_MS = 10_000
// How long /solar bränn plays the wastebasket's fire.
const BURN_SHOWN_MS = 8_000
// How often the context window's fill is asked (it costs nothing), for the
// pile of paper by Clawd.
const PAPER_MS = 30_000

// How often the sky is looked at: a new scene, the person away or back.
const SKY_MS = 10_000
// Away after this long without a key or the mouse: the sky stands still,
// and with it Ghostty's frame loop, until the person is back.
const AWAY_MS = 5 * 60_000
// How often to ask whether the Mac runs on battery.
const BATTERY_MS = 60_000

// A turn of Claude's this long earns confetti when it is done.
const MILESTONE_MS = 3 * 60_000
// While the ISS passes, the sky follows it this often.
const ISS_TICK_MS = 2_000

// The stage strip's width in pixels: its points times the screen's scale
// (asked once, on macOS; Linux has the points as they are). An answer that
// is no positive number counts as 1.
async function stagePxOf($: EngineInterface, isOnLinux: boolean): Promise<number> {
  if (isOnLinux) return STAGE_PT
  const answer = await $.process.run(['/usr/bin/osascript', '-l', 'JavaScript', ...SCREEN_SCALE], { timeoutMs: 5_000 }).catch(() => null)
  const scale = Number(answer?.stdout.trim())

  return STAGE_PT * (Number.isFinite(scale) && scale > 0 ? scale : 1)
}

// How full the context window is, 0 to 100, for Clawd's pile of paper;
// null when it could not say.
async function contextFill($: EngineInterface): Promise<number | null> {
  const usage = await $.session.usage().catch(() => null)

  return usage?.context.percent ?? null
}

// The notifications that ask the person something.
const ASKING = ['permission_prompt', 'elicitation_dialog']

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

  // Whether anything in the sky moves enough to be worth Ghostty's frame
  // loop: an event, rain or snow, a fire, a time-lapse, a storm played.
  const livelyAt = (now: number): boolean => {
    const sky = where.weather ? skyOf(where.weather.code) : 'clear'
    const isWet = sky === 'drizzle' || sky === 'rain' || sky === 'thunder' || sky === 'snow'

    return momentAt(now).mode === 'demo' || eventsNow(now).events.length > 0 || isWet || isWindForced || basketAt(now)?.fire != null
  }
  const skyState = (): SkyState => ({ isAway: activity.isAway, isOnBattery: power.isOnBattery, waiting, basketAt, livelyAt })

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
      argumentHint: '[demo | now | HH:MM | YYYY-MM-DD HH:MM | place <city> | aurora | storm | events | event <name> | toss | burn | ghostty]',
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
      const xdgState = isOnLinux ? (await $.env.get('XDG_STATE_HOME')) || null : null
      const folder = runtimeFolder(home, isOnLinux, xdgState)
      await $.process.run(['/bin/mkdir', '-p', folder]).catch(() => undefined)
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
        // Asked below, once the config is known to include the sky.
        stagePx: STAGE_PT,
        knowsReloadSignal: isOnLinux && (await ghosttyKnowsReloadSignal($)),
        isIncluded: false,
        written: { shader: '', include: '', mark: '', heartbeatAt: -Infinity, isReloadOwed: false, isEnded: false, running: null, isAgain: false },
      }
      void tidy($, folder, [`alive-${id}`]).catch(() => undefined)
      // The sky shows only once Ghostty's config includes the mod's file.
      ghostty.isIncluded = await isIncluded($, ghostty)
      // An include the mod added before, to its own folder: moved here, and
      // the old file emptied so Ghostty draws no second sky from it.
      let isMarginNew = false
      if (!ghostty.isIncluded && (await hasOurInclude($, ghostty))) {
        const added = await includeInGhostty($, ghostty)
        ghostty.isIncluded = added !== null
        isMarginNew = added?.isMarginNew ?? false
        const old = `${$.plugin.root}/runtime/solar-clawd.ghostty`
        if (old !== ghostty.include && (await $.fs.exists(old).catch(() => false))) await $.fs.write(old, '').catch(() => undefined)
      }
      const isOurs = await hasOurInclude($, ghostty)
      // An include from before there was a stage gets it, once: after that
      // the margin is the person's, changed or taken away as they like.
      if (isOurs && !(await hasOurStage($, ghostty))) isMarginNew = (await includeInGhostty($, ghostty))?.isMarginNew ?? false
      if (isMarginNew) $.ui.toast(`Solar: gave the lighthouse a ${STAGE_PT}-point margin on the right of Ghostty's windows; new windows show it.`)
      // The screen's scale costs a moment of osascript: asked only for a sky
      // that shows.
      if (isOurs) ghostty.stagePx = await stagePxOf($, isOnLinux)
      if (!ghostty.isIncluded) $.ui.toast('Solar: run /solar ghostty to show the sky behind the terminal.')
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
    // The Swedish words it once took still work.
    const said = e.args.trim()
    const [first = '', ...rest] = said.split(/\s+/)
    const english = ({ plats: 'place', norrsken: 'aurora', blåst: 'storm', kasta: 'toss', bränn: 'burn' } as Record<string, string>)[first.toLowerCase()]
    const arg = english ? [english, ...rest].join(' ') : said
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

      return { text: wasHidden ? 'Solar: the sky is back.' : 'Solar: the sky is hidden.' }
    }

    if (word === 'demo') {
      demoFrom = now
      await update($, isHidden, () => false)

      return { text: 'Solar: a whole day in 48 seconds.' }
    }

    if (word === 'now') {
      demoFrom = null
      pinnedAt = null

      return { text: 'Solar: following the sun again.' }
    }

    if (word === 'ghostty') {
      if (ghostty === null) return { text: 'Solar: this session is not running in Ghostty.' }
      if (await isIncluded($, ghostty)) return { text: 'Solar: Ghostty already shows the sky.' }
      const added = await includeInGhostty($, ghostty)
      if (added === null) return { text: `Solar: could not read Ghostty's config, so it is left as it is.` }
      const { line, config } = added
      ghostty.isIncluded = true
      ghostty.stagePx = await stagePxOf($, ghostty.isLinux)
      await updateGhosttySky($, ghostty, shaderAt, skyState)
      await reloadGhostty($, ghostty)

      return { text: `Solar: added "${line}" to ${config}.` }
    }

    if (word === 'events') {
      const words = Object.values(EVENT_WORDS).join(', ')

      return { text: `Solar: ${words}. Play one with /solar event <name>.` }
    }

    if (word.startsWith('event')) {
      const name = word.slice('event'.length).trim()
      const kind = (Object.keys(EVENT_WORDS) as EventKind[]).find(k => EVENT_WORDS[k] === name || k.toLowerCase() === name) ?? OLD_EVENT_WORDS[name]
      if (!kind) return { text: `Solar: no event called "${name}". /solar events lists them.` }
      forced = [...forced.filter(event => event.kind !== kind), { kind, at: now }]
      await update($, isHidden, () => false)

      return { text: `Solar: ${EVENT_WORDS[kind]} for ${PREVIEW_MS / 1000} seconds.` }
    }

    // Clawd's wastebasket, played: a ball thrown in, or the context burnt.
    if (word === 'toss') {
      claude.passing = { kind: 'toss', at: now }
      claude.ballShownUntil = now + PREVIEW_MS
      void $.clock.sleep(THROW_SECONDS * 1000).then(() => refreshSky?.()).catch(() => undefined)
      void $.clock.sleep(PREVIEW_MS + 100).then(() => refreshSky?.()).catch(() => undefined)

      return { text: 'Solar: Clawd tosses a ball of paper into the wastebasket.' }
    }

    if (word === 'burn') {
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

      return { text: `Solar: the wastebasket burns for ${BURN_SHOWN_MS / 1000} seconds, as on /compact (the conversation is not touched).` }
    }

    if (word === 'aurora') {
      isAuroraForced = !isAuroraForced

      return { text: isAuroraForced ? 'Solar: aurora on, to see how it looks.' : 'Solar: aurora only when there is one.' }
    }

    if (word === 'storm') {
      isWindForced = !isWindForced

      return { text: isWindForced ? 'Solar: a storm, to see Clawd chase his hat.' : 'Solar: the wind as it really is.' }
    }

    if (word === 'place' || word.startsWith('place ')) {
      const name = arg.slice('place'.length).trim()
      if (name === '') return { text: `Solar: ${placeText(where)}.` }

      if (name.toLowerCase() === 'auto') {
        await $.store.delete(CHOSEN_PLACE)
        await $.store.delete(GUESSED_PLACE)
        await settlePlace($, where)

        return { text: `Solar: following where you are again, ${placeText(where)}.` }
      }

      const found = await findPlace($, name)
      if (!found) return { text: `Solar: found no place called "${name}".` }
      await $.store.set(CHOSEN_PLACE, found)
      where.place = found
      where.isChosen = true
      await refreshWeather($, where)

      return { text: `Solar: the sky is now over ${placeText(where)}.` }
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

        return { text: `Solar: pinned at ${at[1] ? `${at[1]}-${at[2]}-${at[3]} ` : ''}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}.` }
      }
    }

    return { text: 'Solar: /solar, /solar demo, /solar now, /solar HH:MM, /solar YYYY-MM-DD HH:MM, /solar place <city>, /solar aurora, /solar storm, /solar events, /solar event <name>, /solar toss or /solar burn.' }
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
