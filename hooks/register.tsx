import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { activityKindOf, HOLD_MS, heldTool, wantedTool } from './activity'
import type { Call, Shown, Work } from './activity'
import { localMidnight, STOCKHOLM } from './astro'
import type { Waiting } from './waiting'
import { drawFrame, nextPassing, REACTION_SECONDS, ROWS, skyGained, toolKind, workKind } from './clawd'
import type { Mode, Reaction } from './clawd'
import { contextAt, EVENTS, eventsAt, kindOf, PREVIEW_MS, showerAt, shootingRate, specsOf, wordsOf } from './events'
import type { Forced } from './events'
import {
  asScale,
  endGhosttySky,
  ghosttyConfigs,
  ghosttyKnowsReloadSignal,
  hasOurInclude,
  hasOurStage,
  includeInGhostty,
  includeVsync,
  isIncluded,
  isVsyncOff,
  readSettings,
  readThemeName,
  reloadGhostty,
  remark,
  restageGhostty,
  runtimeFolder,
  scaleAskedAt,
  setVsync,
  shareWaiting,
  stagedPadding,
  themeNameOf,
  tidy,
  ttyOf,
  updateGhosttySky,
  writeSettings,
  writeWhole,
} from './ghostty'
import type { Ghostty, SkyExtras, SkyState } from './ghostty'
import { idleMs, isGhosttyInFront, isLinuxHost, isOnBattery } from './host'
import { issVisible } from './iss'
import { AWAY_MS, FULL_STILL_MS, needsVsyncLine, versionOf } from './pace'
import type { Pace } from './pace'
import type { Elements } from './iss'
import { ITERM_FRONTMOST, NOW_PLAYING, SCREEN_SCALE, SET_BACKGROUND } from './mac'
import { MARKET_MS } from './market'
import { GAP, layout, LOOK_FOLDER, LOOK_PANE, pictureRows, watchLook } from './look'
import type { LookState } from './look'
import { markOf } from './mark'
import { CHOSEN_PLACE, findPlace, GUESSED_PLACE, ISS_MS, issElements, placeText, plain, refreshMarket, refreshWeather, settlePlace } from './net'
import type { Where } from './net'
import { fromBase64 } from './paint'
import { shaderParams, skyShader } from './shader'
import type { ShaderParams } from './shader'
import { skyOf, wallpaperPng } from './sky'
import type { MoonTexture, WallpaperCache, Weather } from './sky'
import { BASE_THEME, THEMES } from './themes/index'
import { themeNamed, themeNames } from './themes/named'
import { stagePtOf } from './themes/theme'
import type { Theme } from './themes/theme'
import { activeTune, asSettings, previewMoment } from './tune'

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
// How long /solar grill plays the keeper's grill (the wastebasket's fire
// in a band without the sky).
const GRILL_SHOWN_MS = 8_000
// How long the keeper's catch shows once another tenth of the context
// window has filled.
const CATCH_MS = 2_500
// How often the context window's fill is asked (it costs nothing), for the
// keeper's fish and the pile of paper by Clawd.
const FILL_MS = 30_000

// How often the sky is looked at: a new scene, the person away or back.
const SKY_MS = 10_000
// While Ghostty is in front, the screen its front window is on is asked
// this often, so the stage follows a window moved to another screen: by
// one session for all of them, about 0.6 % of a core.
const SCALE_MS = 10_000
// How often to ask whether the Mac runs on battery.
const BATTERY_MS = 60_000

// A subagent heard nothing of this long, and not listed as at work, is
// counted gone.
const AGENT_SILENT_MS = 10 * 60_000
// What $.agent.list() says of an agent still at work.
const AGENT_AT_WORK = ['pending', 'running', 'waiting']

// Drops the subagents the engine lists as ended, and those heard nothing
// of for AGENT_SILENT_MS that it does not list as at work (a workflow's
// agents are not listed at all); whether any went.
async function prunedAgents($: EngineInterface, agents: Map<string, number>, now: number): Promise<boolean> {
  const listed = await $.agent.list().catch(() => [])
  const atWork = new Set(listed.filter(agent => AGENT_AT_WORK.includes(agent.status)).map(agent => agent.id))
  const ended = new Set(listed.filter(agent => !atWork.has(agent.id)).map(agent => agent.id))
  let isChanged = false
  for (const [id, seen] of agents) {
    if (ended.has(id) || (!atWork.has(id) && now - seen >= AGENT_SILENT_MS)) isChanged = agents.delete(id) || isChanged
  }

  return isChanged
}

// A turn of Claude's this long earns confetti when it is done.
const MILESTONE_MS = 3 * 60_000
// While the ISS passes, the sky follows it this often.
const ISS_TICK_MS = 2_000

// The stage strip's width: the theme's points, or the right padding of the
// config that includes the sky where that is less, so a theme never draws
// its stage under text in a window opened with that padding; in pixels,
// times the scale of the screen the front Ghostty window is on (Linux has
// the points as they are). Every session reads the same config and theme.
async function stageOf($: EngineInterface, ghostty: Ghostty, pt: number): Promise<void> {
  ghostty.stagePt = Math.min(pt, (await stagedPadding($, ghostty)) ?? pt)
  ghostty.stagePx = ghostty.stagePt * (await askScale($, ghostty))
}

// The scale of the screen the front Ghostty window is on, asked of the
// window server, and put in the runtime folder's scale file with when it
// was asked, for every session to draw the stage by: windows on two screens
// share one shader, which fits the one in front. An answer that is no
// positive number counts as 1.
async function askScale($: EngineInterface, ghostty: Ghostty): Promise<number> {
  if (ghostty.isLinux) return 1
  const answer = await $.process.run(['/usr/bin/osascript', '-l', 'JavaScript', ...SCREEN_SCALE], { timeoutMs: 5_000 }).catch(() => null)
  const scale = asScale(answer?.stdout ?? '') ?? 1
  await writeWhole($, `${ghostty.folder}/scale`, `${scale} ${await $.clock.now()}\n`, ghostty.id).catch(() => undefined)

  return scale
}

// How full the context window is, 0 to 100, for the keeper's fish and
// Clawd's pile of paper; null when it could not say.
async function contextFill($: EngineInterface): Promise<number | null> {
  const usage = await $.session.usage().catch(() => null)

  return usage?.context.percent ?? null
}

// The keeper's catch: in the sky at once (`refresh`), and back on the line
// once it is over.
function showCatch($: EngineInterface, refresh: () => void): void {
  refresh()
  void $.clock.sleep(CATCH_MS).then(refresh).catch(() => undefined)
}

// The keeper grills his catch for a while and the embers glow after
// (where there is no sky, the wastebasket burns): /solar grill plays it,
// and a /clear, which empties the context at once, leaves the line bare.
type Grilled = { grillShownUntil: number; passing: { kind: Reaction; at: number } | null; fill: number | null }
function playGrill($: EngineInterface, claude: Grilled, refresh: () => void, now: number, isCleared: boolean): void {
  claude.grillShownUntil = now + GRILL_SHOWN_MS
  refresh()
  void $.clock
    .sleep(GRILL_SHOWN_MS)
    .then(() => {
      claude.passing = { kind: 'embers', at: now + GRILL_SHOWN_MS }
      if (isCleared) claude.fill = null
      refresh()
    })
    .catch(() => undefined)
  void $.clock.sleep(GRILL_SHOWN_MS + REACTION_SECONDS.embers * 1000 + 200).then(refresh).catch(() => undefined)
}

// What /solar says of the sky's pace and Ghostty's vsync.
const PACE_WORDS = {
  full: 'Solar: full. The sky moves 24 times a second whenever it shows, in front or behind, on battery too, and stands still after 20 minutes without you.',
  spar: 'Solar: spar. The sky moves 24 times a second while Ghostty is in front and something in it moves, and stands still on battery, behind other apps and after 5 minutes without you; the lighthouse still sweeps behind them.',
  needsVsync:
    ' On Ghostty 1.3 that takes vsync off: /solar vsync off turns it off in every Ghostty window, with Claude or without, until /solar vsync on. Ghostty warns that drawing out of sync can cause a kernel panic on macOS 14.4 and later. Until then the sky runs as it did.',
  vsyncOff:
    'Solar: vsync is off in every Ghostty window, with Claude or without, until /solar vsync on. New tabs and windows draw the sky 24 times a second (⌘T opens one); tabs already open draw as before until they close, so restart Ghostty to have it everywhere. Ghostty warns that drawing out of sync can cause a kernel panic on macOS 14.4 and later.',
  vsyncOn: 'Solar: vsync is on again for new Ghostty tabs and windows; tabs already open keep it off until they close.',
  vsyncNotNeeded: 'Solar: this Ghostty draws the sky 24 times a second with vsync on; there is nothing to turn off.',
  notOnLinux: 'Solar: on Linux the sky keeps its pace as it is, for now.',
  unknownVersion: 'Solar: Ghostty did not say its version here, so the sky keeps its pace as it is and vsync is left alone.',
  includeFirst: "Solar: run /solar ghostty first; the sky is not in Ghostty's config yet.",
}
const NOT_GHOSTTY = 'Solar: this session is not running in Ghostty.'
const UNREADABLE_CONFIG = `Solar: could not read Ghostty's config, so it is left as it is.`

// The notifications that ask the person something.
const ASKING = ['permission_prompt', 'elicitation_dialog']

export const register: Register = on => {
  // The checkpoint pane's pictures and notes as last read, what the folder
  // held then, and the timer that looks at it while the pane is open.
  const looking: LookState = { look: { pictures: [], notes: [] }, signature: null, watch: null }

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
  // What the sky's engine draws its world with: its scenery, who lives
  // there and the events of its own.
  let theme: Theme = THEMES[BASE_THEME]
  let themeName: string = BASE_THEME
  // A theme sky.json names that could not be drawn: not tried again until
  // the file names another.
  let refusedTheme: string | null = null
  // Claude's state as Clawd shows it: a turn running, waiting on the person,
  // and the last passing reaction.
  const claude = {
    isWorking: false,
    passing: null as { kind: Reaction; at: number } | null,
    // The main conversation's calls now running that read or write, by id.
    open: new Map<string, 'read' | 'write'>(),
    // The context window: how full it is, 0 to 100, as last asked; when the
    // conversation began clearing it (compacting), while it does; and until
    // when the keeper's catch shows another tenth just filled.
    fill: null as number | null,
    clearingSince: null as number | null,
    catchUntil: 0,
    // A grill played on request (/solar grill) until then, and a fish
    // caught on request (/solar catch) hanging on the line until then.
    grillShownUntil: 0,
    fishShownUntil: 0,
  }
  // What Claude is doing, for the tab's mark: its calls running in any loop
  // with their kinds, the kind shown and since when, the subagents at work
  // by id with the last moment one was heard of, and whether a mark is due
  // once a kind's hold is over.
  const work = {
    open: new Map<string, Call>(),
    shown: { tool: 'none', since: -Infinity } as Shown,
    agents: new Map<string, number>(),
    isHeldOver: false,
  }
  const workAt = (now: number): Work => {
    work.shown = heldTool(work.shown, wantedTool(work.open.values()), now)

    return { tool: work.shown.tool, agents: work.agents.size }
  }
  // Marks the tab at once for what Claude is doing, once a Ghostty session
  // has started.
  let remarkSky: (() => void) | null = null
  // What Claude waits on the person for: an answer (a permission or a
  // question), or the next task once work is done. The lighthouse's.
  let waiting: Waiting | null = null
  // The ISS's elements, once fetched.
  let issOrbit: Elements | null = null
  // Whether the Mac runs on battery, as last asked.
  const power = { isOnBattery: false }
  // Updates the Ghostty sky at once, once a Ghostty session has started.
  let refreshSky: (() => void) | null = null
  // Draws the sky with another theme in this session, giving the stage
  // its width where the margin is the mod's own (restageGhostty's answer);
  // null outside Ghostty.
  let useTheme: ((chosen: Theme, name: string) => Promise<Awaited<ReturnType<typeof restageGhostty>>>) | null = null
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
  // Set when this session runs in iTerm2: its session id, where the
  // wallpaper files go, and the settings file Ghostty's sessions share.
  let iterm: { sessionId: string; folder: string; settings: string } | null = null
  const wallpaper = { at: 0, count: 0, isBusy: false, isShown: false, key: '', last: '' }
  // Whether the person is at the computer (and how long they have been
  // away from the keys), iTerm2 or Ghostty in front, and the sky's pace for
  // every session, as last asked.
  const activity = { isAway: false, idleMs: null as number | null, isFrontmost: true, isGhosttyInFront: null as boolean | null, pace: 'spar' as Pace }
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

  // How full the context window is now: another tenth filled, the keeper
  // lands a fish (and where there is no sky, Clawd throws a ball of paper
  // in his basket). Whether one did.
  const takeFill = (fill: number | null, now: number): boolean => {
    const before = claude.fill
    claude.fill = fill ?? before
    if (before !== null && fill !== null && claude.clearingSince === null && Math.floor(fill / 10) > Math.floor(before / 10)) {
      claude.passing = { kind: 'toss', at: now }
      claude.catchUntil = now + CATCH_MS

      return true
    }

    return false
  }
  // The context window as the sky shows it: a fish for each tenth full, and
  // what is happening to it. The grill and its embers outrank the catch;
  // the embers leave the line bare.
  const catchAt = (now: number): ShaderParams['context'] => {
    const isEmbers = claude.passing?.kind === 'embers' && now - claude.passing.at < REACTION_SECONDS.embers * 1000
    const isGrill = claude.clearingSince !== null || now < claude.grillShownUntil
    const state = isGrill ? 'grill' : isEmbers ? 'embers' : now < claude.catchUntil ? 'catch' : 'idle'
    const fish = (claude.fill === null ? 0 : Math.floor(claude.fill / 10)) + (now < claude.fishShownUntil ? 1 : 0)

    return { fish: state === 'embers' ? 0 : fish, state }
  }

  const reactionAt = (now: number) => {
    if (claude.clearingSince !== null) return { kind: 'burn' as const, age: (now - claude.clearingSince) / 1000 }
    if (now < claude.grillShownUntil) return { kind: 'burn' as const, age: (now - (claude.grillShownUntil - GRILL_SHOWN_MS)) / 1000 }
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
    const events = eventsAt(ms, context, forced.map(event => ({ ...event, at: event.at - now + ms })), [...EVENTS, ...specsOf(theme)])

    return { events, context }
  }

  // Whether Ghostty's sky shows through the band, and with it the context
  // window on the keeper's line.
  const isInGhosttySky = () => ghostty !== null && ghostty.isIncluded && ghostty.written.include !== ''

  // What of the person, the app in front and the pace decides whether the
  // sky ticks, as one text to compare.
  const paceKey = () => {
    const idle = activity.idleMs ?? 0
    return `${activity.pace}|${idle >= AWAY_MS}|${idle >= FULL_STILL_MS}|${activity.isGhosttyInFront}`
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
      isClear: iterm !== null || isInGhosttySky(),
      reaction: reactionAt(now),
      paper: claude.fill,
      isContextInSky: isInGhosttySky(),
      track,
      event: events.length > 0 ? wordsOf(theme)[events[0]!.kind] : issNow(now, mode) ? 'ISS' : shower,
    }
  }

  // The ISS on a visible pass now; never in a demo or at a pinned time.
  const issNow = (now: number, mode: Mode) => (mode === 'live' ? issVisible(issOrbit, now, where.place) : null)

  // Whether anything in the sky moves enough to be worth Ghostty's frame
  // loop: an event, rain or snow, the grill or its embers, a time-lapse, a
  // storm played. Not the catch: every frame of it is a still of the same
  // moment, and it is over in seconds.
  const livelyAt = (now: number): boolean => {
    const sky = where.weather ? skyOf(where.weather.code) : 'clear'
    const isWet = sky === 'drizzle' || sky === 'rain' || sky === 'thunder' || sky === 'snow'
    const state = catchAt(now)?.state
    const isFire = state === 'grill' || state === 'embers'

    return momentAt(now).mode === 'demo' || eventsNow(now).events.length > 0 || isWet || isWindForced || isFire
  }
  const skyState = (): SkyState => ({
    idleMs: activity.idleMs,
    isOnBattery: power.isOnBattery,
    isGhosttyInFront: activity.isGhosttyInFront,
    pace: activity.pace,
    waiting,
    catchAt,
    workAt,
    livelyAt,
  })

  // The Ghostty shader for a moment: the scene then, or in a demo the day.
  // What was in the Ghostty sky last time it was drawn; null before the first.
  let lastSky: string[] | null = null

  const shaderAt = (now: number, { settings, ...extras }: SkyExtras) => {
    const { ms, mode } = momentAt(now)
    const { events, context } = eventsNow(now)

    const iss = issNow(now, mode)
    // Something new up there: Clawd looks up at it.
    const sky = [...events.map(event => event.kind as string), ...(iss ? ['iss'] : []), ...(extras.waiting ? ['waiting'] : [])]
    if (lastSky !== null) claude.passing = nextPassing(claude.passing, now, skyGained(lastSky, sky))
    lastSky = sky

    // The saved tune, or a preview while one lasts: the part of the day it
    // shows, at today's moment of it, with that part's values whatever the
    // sun, so every session draws the same and the pane shows exactly what
    // it changes. Only the drawn sky takes the preview's moment: the
    // events, Clawd and the waiting light keep the real one.
    const { tune, phase } = activeTune(settings, now)
    const shown = phase === null ? ms : previewMoment(phase, now, where.place)
    const tuned = phase === null ? tune : { dawn: tune[phase], day: tune[phase], dusk: tune[phase], night: tune[phase] }
    const demo = mode === 'demo' && phase === null ? { seconds: DEMO_MS / 1000, offsetMs: where.offsetMs } : null

    return skyShader(
      shaderParams({ ...viewAt(now, viewport.columns), ms: shown }, { demo, events, shootingRate: shootingRate(context), iss, ...extras, context: catchAt(now), tune: tuned }),
      theme,
    )
  }

  on('session.start', async ($, e, next) => {
    // A reload leaves the pane open and starts the module over: it looks at
    // the folder again.
    if ((await $.ui.panes().catch(() => [])).some(pane => pane.id === LOOK_PANE)) await watchLook($, looking)
    await $.command.register({
      name: 'solar',
      description: 'Show or hide the solar sky; demo plays a day, HH:MM pins a time, plats sets the place',
      argumentHint: '[demo | now | HH:MM | YYYY-MM-DD HH:MM | place <city> | aurora | storm | events | event <name> | catch | grill | ghostty | theme <name> | look | full | spar | vsync off|on]',
      immediate: true,
    })

    const home = await $.env.get('HOME')
    const sessionId = (await $.env.get('ITERM_SESSION_ID'))?.split(':')[1]
    if (sessionId && home) {
      iterm = { sessionId, folder: `${home}/Library/Caches/solar-clawd`, settings: `${runtimeFolder(home, false, null).slice(0, -'/runtime'.length)}/sky.json` }
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
      // The theme chosen with /solar theme, for every session; fyr where
      // none is, or where the one chosen cannot be drawn.
      const chosen = themeNameOf(await $.fs.read(`${folder.slice(0, -'/runtime'.length)}/sky.json`).catch(() => ''))
      if (typeof chosen === 'string' && chosen !== themeName) {
        const found = await themeNamed($, chosen)
        if ('error' in found) {
          refusedTheme = chosen
          $.ui.toast(`Solar: the sky keeps fyr: ${found.error}.`)
        } else [theme, themeName] = [found, chosen]
      }
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
        settings: `${folder.slice(0, -'/runtime'.length)}/sky.json`,
        vsync: `${folder}/vsync.ghostty`,
        market: theme.manifest.market === true ? `${folder}/market.json` : null,
        version: versionOf((await $.env.get('TERM_PROGRAM_VERSION')) ?? undefined),
        home,
        tty: await ttyOf($),
        configs: ghosttyConfigs(home, isOnLinux, xdgConfig),
        isLinux: isOnLinux,
        // Asked below, once the config is known to include the sky.
        stagePt: stagePtOf(theme),
        stagePx: stagePtOf(theme),
        knowsReloadSignal: isOnLinux && (await ghosttyKnowsReloadSignal($)),
        isIncluded: false,
        ticks: null,
        written: {
          shader: '',
          include: '',
          mark: '',
          marking: null,
          heartbeatAt: -Infinity,
          isReloadOwed: false,
          isEnded: false,
          isTicking: false,
          canTick: false,
          running: null,
          isAgain: false,
        },
      }
      void tidy($, folder, [`alive-${id}`]).catch(() => undefined)
      // A Ghostty that draws the sky at its own pace with vsync on needs no
      // vsync line: the one the person asked for on an older one goes.
      const { version } = ghostty
      if (!isOnLinux && version !== null && !needsVsyncLine(version) && (await isVsyncOff($, ghostty))) await setVsync($, ghostty, false)
      // The sky shows only once Ghostty's config includes the mod's file.
      ghostty.isIncluded = await isIncluded($, ghostty)
      // An include the mod added before, to its own folder: moved here, and
      // the old file emptied so Ghostty draws no second sky from it.
      let isMarginNew = false
      if (!ghostty.isIncluded && (await hasOurInclude($, ghostty))) {
        const added = await includeInGhostty($, ghostty, stagePtOf(theme))
        ghostty.isIncluded = added !== null
        isMarginNew = added?.isMarginNew ?? false
        const old = `${$.plugin.root}/runtime/solar-clawd.ghostty`
        if (old !== ghostty.include && (await $.fs.exists(old).catch(() => false))) await $.fs.write(old, '').catch(() => undefined)
      }
      const isOurs = await hasOurInclude($, ghostty)
      // An include from before there was a stage gets it, once: after that
      // the margin is the person's, changed or taken away as they like.
      if (isOurs && !(await hasOurStage($, ghostty))) isMarginNew = (await includeInGhostty($, ghostty, stagePtOf(theme)))?.isMarginNew ?? false
      if (isMarginNew) $.ui.toast(`Solar: gave the lighthouse a ${stagePtOf(theme)}-point margin on the right of Ghostty's windows; new windows show it.`)
      // The screen's scale costs a moment of osascript: asked only for a sky
      // that shows.
      if (isOurs) await stageOf($, ghostty, stagePtOf(theme))
      if (!ghostty.isIncluded) $.ui.toast('Solar: run /solar ghostty to show the sky behind the terminal.')
    }

    if (ghostty !== null) {
      const sky = ghostty
      const update = () => updateGhosttySky($, sky, shaderAt, skyState)
      // Whether the person is here, the power and the pace, before the
      // first sky.
      const idle = await idleMs($, isOnLinux)
      activity.idleMs = idle
      if (idle !== null) activity.isAway = idle >= AWAY_MS
      activity.pace = (await readSettings($, sky)).pace
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
      // What Claude is doing, in the tab's mark alone; a kind held back is
      // marked once its hold is over.
      remarkSky = () =>
        void (async () => {
          const now = await $.clock.now()
          await remark($, sky, markOf(catchAt(now), workAt(now)))
          if (wantedTool(work.open.values()) === work.shown.tool || work.isHeldOver) return
          work.isHeldOver = true
          $.clock.after(Math.max(1, work.shown.since + HOLD_MS - now), () => {
            work.isHeldOver = false
            remarkSky?.()
          })
        })().catch(() => undefined)
      $.clock.every(SKY_MS, () => {
        void (async () => {
          if (work.agents.size > 0 && (await prunedAgents($, work.agents, await $.clock.now()))) remarkSky?.()
          await update()
        })().catch(() => undefined)
      })
      // The market's prices, for a theme that shows them: the shared file
      // looked at every few minutes, fetched again only once it is old. The
      // theme may change: each look asks whether it still shows them.
      const fetchMarket = () => {
        const marketPath = sky.market
        if (marketPath !== null) void refreshMarket($, marketPath, sky.id).catch(() => undefined)
      }
      fetchMarket()
      $.clock.every(MARKET_MS, fetchMarket)
      // The screen's scale, asked only of a sky in Ghostty's config and with
      // Ghostty in front, and by one session for all: one that finds it
      // asked within the interval takes the answer. A window moved to a
      // screen of another scale takes its stage within SCALE_MS.
      $.clock.every(SCALE_MS, () => {
        void (async () => {
          if (isOnLinux || !sky.isIncluded || (await read($, isHidden))) return
          if ((await isGhosttyInFront($, isOnLinux)) !== true) return
          const before = sky.stagePx
          const text = await $.fs.read(`${sky.folder}/scale`).catch(() => '')
          const askedAt = scaleAskedAt(text)
          const shared = asScale(text)
          const isFresh = askedAt !== null && shared !== null && (await $.clock.now()) - askedAt < SCALE_MS - 1_000
          sky.stagePx = sky.stagePt * (isFresh ? shared : await askScale($, sky))
          if (sky.stagePx !== before) refreshSky?.()
        })().catch(() => undefined)
      })
      useTheme = async (chosen, name) => {
        ;[theme, themeName] = [chosen, name]
        refusedTheme = null
        // Events played of the old theme's own kinds end with it.
        const kinds = new Set([...EVENTS, ...specsOf(chosen)].map(spec => spec.kind as string))
        forced = forced.filter(event => kinds.has(event.kind))
        sky.market = chosen.manifest.market === true ? `${sky.folder}/market.json` : null
        fetchMarket()
        const pt = stagePtOf(chosen)
        const staged = (await hasOurInclude($, sky)) ? await restageGhostty($, sky, pt) : ({ theirs: null } as const)
        await stageOf($, sky, pt)
        refreshSky?.()

        return staged
      }
    }

    // The network is not waited on: the sky starts in Stockholm.
    void settlePlace($, where).catch(() => undefined)
    const fetchIss = async () => {
      issOrbit = (await issElements($)) ?? issOrbit
    }
    void fetchIss().catch(() => undefined)
    // Another tenth filled: the keeper's catch.
    const readFill = async () => {
      if (takeFill(await contextFill($), await $.clock.now())) showCatch($, () => refreshSky?.())
    }
    void readFill()
    $.clock.every(FILL_MS, () => void readFill())
    $.clock.every(ISS_MS / 24, () => void fetchIss().catch(() => undefined))
    $.clock.every(WEATHER_MS, () => void refreshWeather($, where).catch(() => undefined))
    // Away from the computer, or iTerm2 behind other windows: the wallpaper
    // stands still and the music is not asked after.
    $.clock.every(ACTIVITY_MS, () => {
      void (async () => {
        const wasIdle = activity.isAway || !activity.isFrontmost
        const before = paceKey()
        // An ioreg that failed says nothing: the last answer stands.
        const idle = await idleMs($, isOnLinux)
        if (idle !== null) activity.isAway = idle >= AWAY_MS
        if (idle !== null) activity.idleMs = idle
        // What the sky's ticks depend on, which another session's /solar
        // or the person may have changed: the sky is updated at once.
        if (ghostty !== null) {
          activity.pace = (await readSettings($, ghostty)).pace
          // Another session's /solar theme: this one follows. A file that
          // says nothing readable changes nothing, and a theme refused once
          // is not checked again every few seconds.
          const said = await readThemeName($, ghostty)
          const name = said === undefined ? themeName : (said ?? BASE_THEME)
          if (name !== themeName && name !== refusedTheme && useTheme !== null) {
            const found = await themeNamed($, name)
            if ('error' in found) refusedTheme = name
            else await useTheme(found, name)
          }
          // Ghostty in front matters only to spar's ticks.
          if (ghostty.written.canTick && activity.pace === 'spar') activity.isGhosttyInFront = await isGhosttyInFront($, isOnLinux)
          if (paceKey() !== before) refreshSky?.()
        }
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
        // The tune saved in sky.json, where there is one; never a preview,
        // which is Ghostty's, nor the text shade, which the wallpaper does
        // not draw.
        const saved = await $.fs.read(iterm.settings).catch(() => '')
        const view = { ...viewAt(now, viewport.columns), tune: saved ? asSettings(saved).tune : null }
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
    // A /clear empties the context at once, and the session goes on: the
    // keeper grills what he had caught, as for a compaction.
    if (e.reason === 'clear' && (claude.fill ?? 0) >= 10) playGrill($, claude, () => refreshSky?.(), await $.clock.now(), true)
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
    // A subagent's end, which every hook hears.
    if (e.agentId !== undefined && work.agents.delete(e.agentId)) remarkSky?.()
    if (e.agentId === undefined) {
      claude.isWorking = false
      claude.open.clear()
      const now = await $.clock.now()
      if (takeFill(await contextFill($), now)) showCatch($, () => refreshSky?.())
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
    // What Claude is doing, in any loop: a subagent not heard starting
    // counts from its first call.
    const doing = activityKindOf(e.tool)
    if (e.agentId !== undefined) {
      const isNew = !work.agents.has(e.agentId)
      work.agents.set(e.agentId, startedAt)
      if (isNew) remarkSky?.()
    }
    if (doing && e.tool_use_id) {
      work.open.set(e.tool_use_id, { tool: doing, at: startedAt })
      remarkSky?.()
    }
    const result = await next(e).finally(() => {
      claude.open.delete(e.tool_use_id)
      if (work.open.delete(e.tool_use_id)) remarkSky?.()
    })
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

  // A subagent started: one more at work, until its turn ends. A workflow's
  // remote agent has no id and is not counted.
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if ('agentId' in result && result.agentId) {
      work.agents.set(result.agentId, await $.clock.now())
      remarkSky?.()
    }

    return result
  })

  // The conversation compacting (not ahead of time): the keeper grills his
  // catch while it runs (where there is no sky, Clawd throws a match in his
  // basket and the context burns); embers after, unless it was skipped,
  // the line bare, and then hung with what the new reading says.
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    claude.clearingSince = await $.clock.now()
    refreshSky?.()
    try {
      const result = await next(e)
      if (!('skip' in result)) {
        const now = await $.clock.now()
        claude.passing = { kind: 'embers', at: now }
        claude.clearingSince = null
        claude.fill = null
        takeFill(await contextFill($), now)
        // Embers now, and the line as it is once they are out.
        void $.clock.sleep(REACTION_SECONDS.embers * 1000 + 200).then(() => refreshSky?.()).catch(() => undefined)
      }

      return result
    } finally {
      claude.clearingSince = null
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
    // The words it once took, Swedish and English, still work.
    const said = e.args.trim()
    const [first = '', ...rest] = said.split(/\s+/)
    const renamed = ({ plats: 'place', norrsken: 'aurora', blåst: 'storm', kasta: 'catch', bränn: 'grill', toss: 'catch', burn: 'grill' } as Record<string, string>)[first.toLowerCase()]
    const arg = renamed ? [renamed, ...rest].join(' ') : said
    const word = arg.toLowerCase()
    const now = await $.clock.now()

    if (word === '') {
      const wasHidden = await read($, isHidden)
      await update($, isHidden, () => !wasHidden)
      // Ghostty's sky is one for every session: hidden in all of them.
      if (ghostty !== null) {
        if (wasHidden) await $.process.run(['/bin/rm', '-f', ghostty.hidden]).catch(() => undefined)
        else await $.fs.write(ghostty.hidden, '')
        refreshSky?.()
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

    // The sky's pace, for every session: Ghostty on a Mac only, this round.
    const pace = word.replace(/\s+/g, ' ')
    if (pace === 'full' || pace === 'spar' || pace === 'vsync off' || pace === 'vsync on') {
      if (ghostty === null) return { text: NOT_GHOSTTY }
      if (ghostty.isLinux) return { text: PACE_WORDS.notOnLinux }
      // Without Ghostty's version the sky cannot tick: nothing is promised,
      // and vsync is only ever turned back on.
      if (ghostty.version === null && pace !== 'vsync on') return { text: PACE_WORDS.unknownVersion }
      const needsLine = ghostty.version === null || needsVsyncLine(ghostty.version)
      if (pace === 'full' || pace === 'spar') {
        await writeSettings($, ghostty, { pace })
        refreshSky?.()
        const isLineMissing = needsLine && !(await isVsyncOff($, ghostty))

        return { text: PACE_WORDS[pace] + (isLineMissing ? PACE_WORDS.needsVsync : '') }
      }
      if (!needsLine) return { text: PACE_WORDS.vsyncNotNeeded }
      if (pace === 'vsync off') {
        const included = await includeVsync($, ghostty)
        if (included === 'unreadable') return { text: UNREADABLE_CONFIG }
        if (included === 'no-include') return { text: PACE_WORDS.includeFirst }
      }
      await setVsync($, ghostty, pace === 'vsync off')
      refreshSky?.()

      return { text: pace === 'vsync off' ? PACE_WORDS.vsyncOff : PACE_WORDS.vsyncOn }
    }

    // The sky's theme, for every session: one built in or a folder of
    // themes/. The stage gets the theme's width where the margin is the
    // mod's own; the person's own padding stays theirs.
    if (word === 'theme' || word.startsWith('theme ')) {
      const names = await themeNames($)
      const name = word.slice('theme'.length).trim()
      if (name === '') return { text: `Solar: the sky's theme is ${themeName}. Themes: ${names.join(', ')}. /solar theme <name> changes it in every session.` }
      if (ghostty === null || useTheme === null) return { text: NOT_GHOSTTY }
      const found = await themeNamed($, name)
      if ('error' in found) return { text: `Solar: ${found.error}. Themes: ${names.join(', ')}.` }
      const isSame = name === themeName
      await writeSettings($, ghostty, { theme: name })
      if (isSame) return { text: `Solar: the sky's theme is already ${name}.` }
      const staged = await useTheme(found, name)
      const pt = stagePtOf(found)
      const theirs = typeof staged === 'object' ? staged.theirs : null
      const stage =
        staged === 'unreadable'
          ? ` Ghostty's config could not be read, so its stage is left as it is.`
          : staged === 'restaged'
            ? ` Its stage is ${pt} points wide; Ghostty's new windows show it.`
            : theirs !== null && theirs !== pt
              ? ` It wants a stage ${pt} points wide; your window-padding-x gives it ${theirs}, and stays as you set it.`
              : ''

      return { text: `Solar: the sky is ${name} now, in every session.${stage}` }
    }

    // The checkpoint's pictures in a pane beside the conversation.
    if (word === 'look') {
      if ((await $.ui.panes()).some(pane => pane.id === LOOK_PANE)) {
        await $.ui.close({ id: LOOK_PANE })
        return { text: 'Solar: the checkpoint pane is closed.' }
      }
      looking.signature = null
      await watchLook($, looking)
      const opened = await $.ui.open({ id: LOOK_PANE, title: 'Checkpoint', columns: 64 })

      return {
        text: opened.isPlaced
          ? `Solar: the checkpoint pane shows ${LOOK_FOLDER}; /solar look again closes it.`
          : `Solar: the checkpoint pane waits to be placed: ${opened.reason}.`,
      }
    }

    if (word === 'ghostty') {
      if (ghostty === null) return { text: NOT_GHOSTTY }
      const pt = stagePtOf(theme)
      // Already there: the stage as wide as the theme asks, where the line
      // is the mod's own; a padding of the person's own stays theirs.
      if (await isIncluded($, ghostty)) {
        const staged = await restageGhostty($, ghostty, pt)
        if (staged === 'unreadable') return { text: UNREADABLE_CONFIG }
        if (staged === 'restaged') {
          await stageOf($, ghostty, pt)
          await updateGhosttySky($, ghostty, shaderAt, skyState)
          await reloadGhostty($, ghostty)

          return { text: `Solar: the stage is now ${pt} points wide, as the theme wants; Ghostty's new windows show it.` }
        }
        const theirs = staged === 'same' ? null : staged.theirs
        const wanted = theirs === null ? '' : ` The theme wants a stage ${pt} points wide; your window-padding-x gives it ${theirs}, and stays as you set it.`

        return { text: `Solar: Ghostty already shows the sky.${wanted}` }
      }
      const added = await includeInGhostty($, ghostty, pt)
      if (added === null) return { text: UNREADABLE_CONFIG }
      const { line, config } = added
      ghostty.isIncluded = true
      await stageOf($, ghostty, pt)
      await updateGhosttySky($, ghostty, shaderAt, skyState)
      await reloadGhostty($, ghostty)

      return { text: `Solar: added "${line}" to ${config}.` }
    }

    if (word === 'events') {
      const words = Object.values(wordsOf(theme)).join(', ')

      return { text: `Solar: ${words}. Play one with /solar event <name>.` }
    }

    if (word.startsWith('event')) {
      const name = word.slice('event'.length).trim()
      const kind = kindOf(name, theme)
      if (!kind) return { text: `Solar: no event called "${name}". /solar events lists them.` }
      const words = wordsOf(theme)
      // A theme's previews (fyr's keeper surfing, a UFO taking him) play in
      // Ghostty's sky alone: the band has no lighthouse.
      if (theme.manifest.previews.some(preview => preview.kind === kind) && ghostty === null) {
        return { text: `Solar: the ${words[kind]} shows only in Ghostty's sky, and this session is not running in Ghostty.` }
      }
      forced = [...forced.filter(event => event.kind !== kind), { kind, at: now }]
      await update($, isHidden, () => false)

      return { text: `Solar: ${words[kind]} for ${PREVIEW_MS / 1000} seconds.` }
    }

    // The context window, played: the keeper's catch, a fish on his line
    // for a while, or his grill. Where there is no sky, Clawd's wastebasket:
    // a ball of paper thrown in, or the context burnt.
    if (word === 'catch') {
      claude.passing = { kind: 'toss', at: now }
      claude.catchUntil = now + CATCH_MS
      claude.fishShownUntil = now + PREVIEW_MS
      showCatch($, () => refreshSky?.())
      void $.clock.sleep(PREVIEW_MS + 100).then(() => refreshSky?.()).catch(() => undefined)

      return { text: isInGhosttySky() ? 'Solar: the keeper lands a fish, as when another tenth of the context window fills.' : 'Solar: Clawd tosses a ball of paper into the wastebasket.' }
    }

    if (word === 'grill') {
      playGrill($, claude, () => refreshSky?.(), now, false)
      const what = isInGhosttySky() ? 'the keeper grills his catch' : 'the wastebasket burns'

      return { text: `Solar: ${what} for ${GRILL_SHOWN_MS / 1000} seconds, as on /compact (the conversation is not touched).` }
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

    return { text: 'Solar: /solar, /solar demo, /solar now, /solar HH:MM, /solar YYYY-MM-DD HH:MM, /solar place <city>, /solar aurora, /solar storm, /solar events, /solar event <name>, /solar catch, /solar grill, /solar theme <name>, /solar look, /solar full, /solar spar or /solar vsync off|on.' }
  })

  on('ui.render', { component: 'Pane', requestId: LOOK_PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Image } = $.ui.resolve(e)
    const { look } = looking
    if (look.pictures.length === 0 && look.notes.length === 0) return <Text dimColor>Nothing in {LOOK_FOLDER} yet.</Text>
    const placed = layout(look.pictures, e.props.bodyColumns, pictureRows(e.props.scroll.bodyRows, look.notes.length))

    return (
      <Box flexDirection="column" gap={1}>
        {look.pictures.length > 0 && (
          <Box flexDirection={placed.isDown ? 'column' : 'row'} gap={placed.isDown ? 1 : GAP}>
            {look.pictures.map((picture, i) => (
              <Box key={picture.name} flexDirection="column" width={placed.boxes[i]!.columns}>
                <Image key={picture.name} source={{ png: picture.png }} columns={placed.boxes[i]!.columns} rows={placed.boxes[i]!.rows} alt={picture.name} />
                <Text wrap="truncate">{picture.name}</Text>
              </Box>
            ))}
          </Box>
        )}
        {look.notes.length > 0 && (
          <Box flexDirection="column">
            {look.notes.map(line => <Text>{line === '' ? ' ' : line}</Text>)}
          </Box>
        )}
      </Box>
    )
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
