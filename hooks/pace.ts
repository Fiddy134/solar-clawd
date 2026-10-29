// The sky's own pace: the mod writes the tab's mark 24 times a second and
// Ghostty, drawing only when its terminal is written to, draws a frame for
// each (docs/gpu-measurements.md, "The sky at a frame rate of its own").
// Two paces, chosen with /solar and kept for every session: full moves
// whenever the sky shows, spar where today's sky would move. Where the mod
// cannot tick, the rules are today's.

import { asSettings } from './tune'
import { animationOf } from './waiting'
import type { Waiting } from './waiting'

// Frames a second while the sky ticks: as fast as Vincent could tell from
// 120 in a blind test, and film's own.
export const PACE_HZ = 24
// Away after this long without a key or the mouse: in spar the sky stands
// still, lighter, until the person is back.
export const AWAY_MS = 5 * 60_000
// In full the sky stands still only after this long without them.
export const FULL_STILL_MS = 20 * 60_000

export type Pace = 'full' | 'spar'

// The pace a settings file says, spar for anything it does not say plainly.
export function asPace(text: string): Pace {
  return asSettings(text).pace
}

// Ghostty's major and minor version from TERM_PROGRAM_VERSION (1.3.1,
// 1.4.0-dev+abc); null when it says no version.
export function versionOf(text: string | undefined): [number, number] | null {
  const found = /^(\d+)\.(\d+)/.exec(text ?? '')

  return found ? [Number(found[1]), Number(found[2])] : null
}

// Whether a Ghostty of this version draws the sky at every vsync while
// focused, whatever the animation, unless vsync is off: 1.3 and before.
export function needsVsyncLine(version: [number, number]): boolean {
  return version[0] < 1 || (version[0] === 1 && version[1] <= 3)
}

// Whether ticks would set the sky's pace here: on macOS, in a Ghostty whose
// version is known, and on 1.3 only with vsync off. Linux keeps today's
// pace until the ticks have been tried there.
export function canTick(o: { isLinux: boolean; version: [number, number] | null; isVsyncOff: boolean }): boolean {
  if (o.isLinux || o.version === null) return false

  return !needsVsyncLine(o.version) || o.isVsyncOff
}

// How Ghostty animates the sky, whether it is the light one (no clouds),
// and whether the mod ticks it. Without ticks, today's rules. With them the
// animation is always false: Ghostty draws at each tick, and `true` with
// vsync off would set its 8 ms timer running free. Full ticks until twenty
// minutes without the person, never light; spar ticks where today's sky
// would move: always while the lighthouse sweeps, and otherwise only with
// Ghostty in front (`true` animates the focused tab alone).
export function skyRules(o: {
  pace: Pace
  canTick: boolean
  waiting: Waiting | null
  now: number
  idleMs: number | null
  isOnBattery: boolean
  isLively: boolean
  isGhosttyInFront: boolean | null
}): { animation: 'true' | 'false' | 'always'; isLight: boolean; isTicking: boolean } {
  const isAway = o.idleMs !== null && o.idleMs >= AWAY_MS
  const today = animationOf({ waiting: o.waiting, now: o.now, isAway, isOnBattery: o.isOnBattery, isLively: o.isLively })
  if (!o.canTick) return { animation: today, isLight: o.isOnBattery || isAway, isTicking: false }
  if (o.pace === 'full') return { animation: 'false', isLight: false, isTicking: o.idleMs === null || o.idleMs < FULL_STILL_MS }
  const isTicking = today === 'always' || (today === 'true' && o.isGhosttyInFront !== false)

  return { animation: 'false', isLight: o.isOnBattery || isAway, isTicking }
}
