// The lighthouse: when it is lit, and how Ghostty animates the sky for it.
// Every session that waits on the person writes what it waits for; the sky
// any of them draws lights the lighthouse for the most pressing.

// A question that has waited this long makes the beam hurry.
export const BEACON_URGENT_MS = 120_000
// The beam sweeps this long, even with Ghostty in the background; after
// that the lighthouse stands lit, still, costing nothing.
export const BEACON_SWEEP_MS = 300_000
// And goes out this long after the wait began: the person has gone.
export const BEACON_MS = 1_800_000

export type Waiting = { mode: 'asking' | 'done'; since: number }

// The lighthouse for these waits: a question before work done, from the
// first of them; null when nothing waits, or has waited too long.
export function beaconAt(waits: readonly Waiting[], now: number): (Waiting & { isUrgent: boolean }) | null {
  const live = waits.filter(wait => now - wait.since < BEACON_MS)
  const mode = live.some(wait => wait.mode === 'asking') ? 'asking' : live.length > 0 ? 'done' : null
  if (mode === null) return null
  const since = Math.min(...live.filter(wait => wait.mode === mode).map(wait => wait.since))

  return { mode, since, isUrgent: mode === 'asking' && now - since >= BEACON_URGENT_MS }
}

// Ghostty's custom-shader-animation for the sky now: `always` while the
// beam sweeps (so it moves with Ghostty in the background), `false` for a
// still sky (the lighthouse lit but no longer sweeping, the person away,
// or on battery),
// `true` (animate while focused) otherwise.
export function animationOf(o: { beacon: Waiting | null; now: number; isAway: boolean; isOnBattery: boolean }): 'true' | 'false' | 'always' {
  if (o.beacon && !o.isAway && o.now - o.beacon.since < BEACON_SWEEP_MS) return 'always'
  if (o.beacon || o.isAway || o.isOnBattery) return 'false'

  return 'true'
}
