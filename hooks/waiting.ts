// Claude waiting on the person: what the sky shows (WAITING, which fyr
// draws as its lighthouse lit), and how Ghostty animates the sky for it.
// Every session that waits on the person writes what it waits for; the sky
// any of them draws shows the most pressing.

// A question that has waited this long hurries (fyr's beam).
export const WAITING_URGENT_MS = 120_000
// The sky moves this long, even with Ghostty in the background; after
// that it stands still, still showing the wait, costing nothing.
export const WAITING_SWEEP_MS = 300_000
// And goes out this long after the wait began: the person has gone.
export const WAITING_MS = 1_800_000

export type Waiting = { mode: 'asking' | 'done'; since: number }

// What the sky shows for these waits: a question before work done, from
// the first of them; null when nothing waits, or has waited too long.
export function waitingAt(waits: readonly Waiting[], now: number): (Waiting & { isUrgent: boolean }) | null {
  const live = waits.filter(wait => now - wait.since < WAITING_MS)
  const mode = live.some(wait => wait.mode === 'asking') ? 'asking' : live.length > 0 ? 'done' : null
  if (mode === null) return null
  const since = Math.min(...live.filter(wait => wait.mode === mode).map(wait => wait.since))

  return { mode, since, isUrgent: mode === 'asking' && now - since >= WAITING_URGENT_MS }
}

// Ghostty's custom-shader-animation for the sky now: `always` while a
// fresh wait moves (fyr's beam sweeping, even with Ghostty in the
// background), `false` for a still sky (a wait that has stopped moving,
// the person away, or on battery), `true` (animate while focused)
// otherwise.
//
// A sky with nothing lively in it (no event, rain, fire or time-lapse)
// stands still too: the clouds drift a pixel a second, and Ghostty draws
// it anyway whenever the terminal changes, so it moves while Claude works,
// at no cost when nothing happens.
export function animationOf(o: { waiting: Waiting | null; now: number; isAway: boolean; isOnBattery: boolean; isLively: boolean }): 'true' | 'false' | 'always' {
  if (o.waiting && !o.isAway && o.now - o.waiting.since < WAITING_SWEEP_MS) return 'always'
  if (o.waiting || o.isAway || o.isOnBattery || !o.isLively) return 'false'

  return 'true'
}
