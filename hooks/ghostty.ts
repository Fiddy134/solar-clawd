import type { EngineInterface } from 'claude-code'

import { animationOf, beaconAt } from './beacon'
import type { Waiting } from './beacon'
import { field, number } from './net'
import { tabMark } from './shader'
import type { ShaderParams } from './shader'
import { staleFiles } from './tidy'

// Ghostty draws the sky itself, from a shader the mod writes into its
// runtime folder: the config, the include, the tab's mark, the reload, and
// the files sessions share.

// Ghostty's config includes runtime/solar-clawd.ghostty, which names the
// shader while the sky is up and is empty otherwise; each change is
// followed by a reload, which Ghostty takes without a flicker.
const RELOAD_GHOSTTY = [
  '-e',
  'tell application id "com.mitchellh.ghostty" to perform action "reload_config" on focused terminal of selected tab of front window',
]

// Each Ghostty session leaves a heartbeat this often; one older than
// ALIVE_MS is a session gone.
const HEARTBEAT_MS = 60_000
const ALIVE_MS = 5 * 60_000

// Ghostty's config files, the one to add the include to first: on macOS
// Application Support before ~/.config, on Linux only the XDG folder.
export function ghosttyConfigs(home: string, isOnLinux: boolean, xdgConfig: string | null): string[] {
  const xdg = `${xdgConfig ?? `${home}/.config`}/ghostty`
  if (isOnLinux) return [`${xdg}/config.ghostty`, `${xdg}/config`]
  const support = `${home}/Library/Application Support/com.mitchellh.ghostty`

  return [`${support}/config.ghostty`, `${support}/config`, `${xdg}/config.ghostty`, `${xdg}/config`]
}

// Where a Ghostty session keeps the sky's files, and what it last wrote:
// the shader, the include, the heartbeat's time.
export type Ghostty = {
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
  // The stage strip's width in device pixels: STAGE_PT times the screen scale.
  stagePx: number
  // Whether Ghostty is new enough to reload on SIGUSR2 (Linux only).
  knowsReloadSignal: boolean
  // Whether Ghostty's config includes the mod's file, asked each minute.
  isIncluded: boolean
  written: {
    shader: string
    include: string
    // The tab's mark as last written (markOf).
    mark: string
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
export async function isIncluded($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
  for (const path of ghostty.configs) {
    const text = await $.fs.read(path).catch(() => '')
    const lines = text.split('\n').map(line => line.trim().replace(/^config-file\s*=\s*\??/, ''))
    if (text.split('\n').some((line, i) => /^config-file\s*=/.test(line.trim()) && lines[i] === ghostty.include)) return true
  }

  return false
}

// Removes what crashed sessions left in `folder`; `keep` is this session's.
export async function tidy($: EngineInterface, folder: string, keep: string[]): Promise<void> {
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
const UNMARK_TAB = '\x1b]104;16\x1b\\'
// The mark for this tab's context window: how full, and what is happening
// to it (tabMark).
function markOf(context: ShaderParams['context']): string {
  const hex = tabMark(context).map(v => v.toString(16).padStart(2, '0'))

  return `\x1b]4;16;rgb:${hex.join('/')}\x1b\\`
}
export async function markTab($: EngineInterface, sequence: string): Promise<void> {
  const script = 'tty=$(ps -o tty= -p $PPID | tr -d " "); case "$tty" in ""|"?"*) exit 1;; esac; printf "%s" "$1" > "/dev/$tty"'
  await $.process.run(['sh', '-c', script, 'sh', sequence], { timeoutMs: 5_000 }).catch(() => undefined)
}

// Whether Ghostty took the reload. On Linux Ghostty reloads on SIGUSR2:
// through systemd while it runs as its service, else sent to it straight,
// but only to a Ghostty new enough to know the signal (to an older one it
// is the end).
export async function reloadGhostty($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
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
export async function ghosttyKnowsReloadSignal($: EngineInterface): Promise<boolean> {
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
export type SkyState = {
  isAway: boolean
  isOnBattery: boolean
  waiting: Waiting | null
  catchAt: (now: number) => ShaderParams['context']
  livelyAt: (now: number) => boolean
}

// What the session's shader is asked to draw beyond the scene.
export type SkyExtras = { beacon: { mode: 'asking' | 'done'; isUrgent: boolean } | null; isYUp: boolean; stagePx: number; isLight: boolean }

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
export async function updateGhosttySky(
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


// Shares a change in what this session waits on the person for, and
// updates the sky for it at once.
export async function shareWaiting($: EngineInterface, ghostty: Ghostty | null, waiting: Waiting | null, refresh: (() => void) | null): Promise<void> {
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
  // The tab's mark when its context window changes, and again each minute:
  // a `reset` in the tab would have cleared it.
  const mark = markOf(state.catchAt(now))
  if (mark !== written.mark || now - written.heartbeatAt >= HEARTBEAT_MS) {
    await markTab($, mark)
    written.mark = mark
  }
  if (now - written.heartbeatAt >= HEARTBEAT_MS) {
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
    // Ghostty draws with OpenGL on Linux, where fragCoord has y up. On
    // battery or with the person away, the lighter sky.
    const extras = {
      beacon: beacon && { mode: beacon.mode, isUrgent: beacon.isUrgent },
      isYUp: ghostty.isLinux,
      stagePx: ghostty.stagePx,
      isLight: state.isOnBattery || state.isAway,
    }
    // Against the disk, not what this session last wrote: another session
    // may have written the same (no reload) or something else (put right).
    const shader = shaderAt(now, extras)
    if (shader !== (await $.fs.read(ghostty.shader).catch(() => null))) {
      await writeWhole($, ghostty.shader, shader, ghostty.id)
      written.isReloadOwed = true
    }
    written.shader = shader
    const animation = animationOf({ beacon, now, isAway: state.isAway, isOnBattery: state.isOnBattery, isLively: state.livelyAt(now) })
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
export async function endGhosttySky($: EngineInterface, ghostty: Ghostty, reason: string): Promise<void> {
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

// The width in points of the stage strip: the window padding on the right
// that terminal text never reaches, where the lighthouse stands.
export const STAGE_PT = 240

// The comment the mod writes above its include. The stage's margin came
// later, and is given once, with this comment: from then on the padding is
// the person's to change or take away, and stays as they leave it.
const STAGED = '# Solar Clawd: the sky while a Claude session runs, and a stage for the lighthouse.'

// The lines the mod itself added to a Ghostty config, from any folder it was
// loaded from: its comment (now or as it was), the include of its runtime
// file, and the padding that makes the stage strip.
const OUR_LINES = [
  /^# Solar Clawd: /,
  /^config-file\s*=\s*\??.*\/runtime\/solar-clawd\.ghostty$/,
  new RegExp(`^window-padding-x\\s*=\\s*\\d+\\s*,\\s*${STAGE_PT}$`),
]

// Whether a config was given the stage: the comment it came with, whatever
// the person has since done with the padding.
export async function hasOurStage($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
  for (const path of ghostty.configs) {
    const text = await $.fs.read(path).catch(() => '')
    if (text.split('\n').some(line => line.trim() === STAGED)) return true
  }

  return false
}

// Whether a config has an include line the mod added, wherever it points.
export async function hasOurInclude($: EngineInterface, ghostty: Ghostty): Promise<boolean> {
  for (const path of ghostty.configs) {
    const text = await $.fs.read(path).catch(() => '')
    if (text.split('\n').some(line => OUR_LINES[1]!.test(line.trim()))) return true
  }

  return false
}

// Where a Ghostty session keeps the sky's files: a folder of the person's
// own, so the include line in Ghostty's config outlives the plugin's folder
// (an installed plugin's moves with each update). It ends in /runtime, as
// OUR_LINES expects.
export function runtimeFolder(home: string, isOnLinux: boolean, xdgState: string | null): string {
  if (isOnLinux) return `${xdgState ?? `${home}/.local/state`}/solar-clawd/runtime`

  return `${home}/Library/Application Support/solar-clawd/runtime`
}

// Adds the one include line, under the mod's comment, to the config Ghostty
// reads first, in place of any the mod added before; `?` keeps Ghostty quiet
// should the file ever be missing. A config not yet given the stage gets
// its padding after the include, keeping the left number of the person's
// own window-padding-x (the last, which is the one Ghostty uses; else 2);
// one given it before keeps its padding lines as the person left them.
// Answers the line, the file, and whether the margin is new to the config;
// null when the config is there but cannot be read: never written over.
export async function includeInGhostty(
  $: EngineInterface,
  ghostty: Ghostty,
): Promise<{ line: string; config: string; isMarginNew: boolean } | null> {
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
  const isStaged = read.split('\n').some(row => row.trim() === STAGED)
  const hadMargin = read.split('\n').some(row => OUR_LINES[2]!.test(row.trim()))
  const ours = isStaged ? OUR_LINES.slice(0, 2) : OUR_LINES
  const rows = read.split('\n').filter(row => !ours.some(pattern => pattern.test(row.trim())))
  const text = rows.join('\n')
  const own = rows.map(row => /^window-padding-x\s*=\s*(\d+)/.exec(row.trim())).findLast(found => found !== null)
  const padding = isStaged ? '' : `window-padding-x = ${own ? own[1] : '2'},${STAGE_PT}\n`
  const line = `config-file = ?${ghostty.include}`
  const gap = text === '' || text.endsWith('\n') ? '' : '\n'
  await $.fs.write(config, `${text}${gap}${STAGED}\n${line}\n${padding}`)

  return { line, config, isMarginNew: !isStaged && !hadMargin }
}
